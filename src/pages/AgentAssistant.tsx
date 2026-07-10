import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  PlusOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Select,
  Space,
  Steps,
  Tag,
  Typography,
  message,
} from "antd";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/endpoints";
import { PageHeader } from "@/components/PageHeader";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";
import type {
  AgentPlanResponse,
  AgentToolExecutionAudit,
  AgentToolExecutionResult,
} from "@/types/domain";
import { AgentConsole } from "@/pages/AgentConsole";

interface ObjectMappingInput {
  sourceSchemaName?: string;
  sourceObjectName: string;
  targetSchemaName?: string;
  targetObjectName: string;
  whereCondition?: string;
}

interface AssistantFormValues {
  objective: string;
  taskName: string;
  sourceDatasourceId: number;
  targetDatasourceId: number;
  writeStrategy: "INSERT" | "UPDATE";
  objectMappings: ObjectMappingInput[];
}

const defaultObjective = "将 MySQL 中的 fs_test_customer_source 和 fs_test_customer_target 全量同步到 PostgreSQL public schema 的同名表。";

const defaultMappings: ObjectMappingInput[] = [
  {
    sourceObjectName: "fs_test_customer_source",
    targetSchemaName: "public",
    targetObjectName: "fs_test_customer_source",
  },
  {
    sourceObjectName: "fs_test_customer_target",
    targetSchemaName: "public",
    targetObjectName: "fs_test_customer_target",
  },
];

function textField(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败，请查看详细错误后重试";
}

function statusColor(state?: string) {
  if (state === "SUCCEEDED") return "green";
  if (state === "FAILED") return "red";
  if (state === "WAITING_APPROVAL" || state === "WAITING_HUMAN") return "gold";
  if (state === "EXECUTING" || state === "TOOL_CALLING") return "blue";
  return "default";
}

function UserAgentAssistant() {
  const navigate = useNavigate();
  const [form] = Form.useForm<AssistantFormValues>();
  const selectedProjectId = useUiStore((state) => state.selectedProjectId);
  const authUser = useAuthStore((state) => state.user);
  const [controlPlane, setControlPlane] = useState<{ sessionId: string; runId: string }>();
  const [plan, setPlan] = useState<AgentPlanResponse>();
  const [executionResults, setExecutionResults] = useState<AgentToolExecutionResult[]>([]);

  const sessionQuery = useQuery({
    queryKey: ["agent-assistant-session"],
    queryFn: api.getSession,
    retry: false,
  });
  const session = sessionQuery.data?.data;
  const projectId = selectedProjectId ? Number(selectedProjectId) : undefined;
  const sourceQuery = useQuery({
    queryKey: ["agent-assistant-source-datasources", projectId],
    queryFn: () => api.listDataSources({ current: 1, size: 100, projectId, usagePurpose: "SOURCE", status: "ENABLED" }),
    enabled: Boolean(projectId),
  });
  const targetQuery = useQuery({
    queryKey: ["agent-assistant-target-datasources", projectId],
    queryFn: () => api.listDataSources({ current: 1, size: 100, projectId, usagePurpose: "TARGET", status: "ENABLED" }),
    enabled: Boolean(projectId),
  });
  const sourceOptions = useMemo(
    () => (sourceQuery.data?.data.records ?? []).map((item) => ({
      value: item.id,
      label: `#${item.id} ${item.name}（${item.type}）`,
    })),
    [sourceQuery.data?.data.records],
  );
  const targetOptions = useMemo(
    () => (targetQuery.data?.data.records ?? []).map((item) => ({
      value: item.id,
      label: `#${item.id} ${item.name}（${item.type}）`,
    })),
    [targetQuery.data?.data.records],
  );

  const auditsQuery = useQuery({
    queryKey: ["agent-assistant-audits", controlPlane?.sessionId, controlPlane?.runId],
    queryFn: () => api.listAgentToolExecutions(controlPlane!.sessionId, controlPlane!.runId),
    enabled: Boolean(controlPlane?.sessionId && controlPlane?.runId),
    refetchInterval: controlPlane ? 3000 : false,
  });
  const audits = auditsQuery.data?.data ?? [];

  const planMutation = useMutation({
    mutationFn: async (values: AssistantFormValues) => {
      if (!session?.tenantId || !projectId || !session.actorId) {
        throw new Error("缺少登录租户、项目或操作者上下文，请先选择项目");
      }
      return api.createAgentPlan({
        tenant_id: String(session.tenantId),
        project_id: String(projectId),
        actor_id: String(session.actorId),
        objective: values.objective,
        preferred_workload: "agent_reasoning",
        locale: "zh-CN",
        variables: {
          frontendSurface: "UserAgentAssistant",
          runtimeProfile: "production",
          dataSyncRequest: {
            taskName: values.taskName,
            taskDescription: values.objective,
            sourceDatasourceId: values.sourceDatasourceId,
            targetDatasourceId: values.targetDatasourceId,
            syncMode: "FULL",
            writeStrategy: values.writeStrategy,
            groupCode: "DEFAULT",
            groupName: "默认分组",
            objectMappings: values.objectMappings.map((item, index) => ({
              objectKey: `agent-mapping-${index + 1}`,
              ...item,
            })),
          },
        },
      });
    },
    onSuccess: (result) => {
      const ingestion = result.data.controlPlaneIngestion;
      const sessionId = textField(ingestion, "sessionId");
      const runId = textField(ingestion, "runId");
      if (!sessionId || !runId) {
        message.error("计划已生成，但 Java 控制面未返回 sessionId/runId，请检查 plan ingestion");
        return;
      }
      setPlan(result.data);
      setControlPlane({ sessionId, runId });
      setExecutionResults([]);
      message.success("Agent 已生成可审计执行计划，请确认后执行");
    },
    onError: (error) => message.error(errorMessage(error)),
  });

  const executeMutation = useMutation({
    mutationFn: () => {
      if (!controlPlane) throw new Error("请先生成 Agent 计划");
      return api.confirmAndExecuteAgentRun(controlPlane.sessionId, controlPlane.runId, {
        confirmed: true,
        comment: "用户在智能助手页面确认执行数据同步计划",
      });
    },
    onSuccess: async (result) => {
      setExecutionResults(result.data.toolResults);
      if (result.data.failedCount > 0) {
        message.error(`Agent 计划有 ${result.data.failedCount} 个节点失败，请查看节点详情`);
      } else {
        message.success("Agent 控制面节点已执行完成，同步任务已进入真实业务执行链路");
      }
      await auditsQuery.refetch();
    },
    onError: (error) => message.error(errorMessage(error)),
  });

  const planItems = plan?.plan?.toolPlans ?? [];
  const hasDatasourceOptions = sourceOptions.length > 0 && targetOptions.length > 0;

  return (
    <div className="page-stack">
      <PageHeader
        title="智能助手"
        subtitle="用自然语言规划数据同步，凭据仍由数据源管理安全托管"
        actions={<Button icon={<DatabaseOutlined />} onClick={() => navigate("/datasources")}>数据源管理</Button>}
      />

      <Alert
        showIcon
        type="info"
        icon={<SafetyCertificateOutlined />}
        message="数据库密码不会进入 Agent"
        description="请先在数据源管理中安全创建并测试连接。智能助手只使用当前项目内已授权的数据源 ID，不读取密码，也不会把连接凭据写入模型、LangGraph 状态、计划、事件或日志。"
      />

      <div className="grid grid-two">
        <Card title="描述目标并确认业务参数" className="compact-card">
          <Form<AssistantFormValues>
            form={form}
            layout="vertical"
            initialValues={{
              objective: defaultObjective,
              taskName: "Agent-MySQL到PostgreSQL客户表全量同步",
              writeStrategy: "INSERT",
              objectMappings: defaultMappings,
            }}
            onFinish={(values) => planMutation.mutate(values)}
          >
            <Form.Item name="objective" label="你希望智能助手完成什么" rules={[{ required: true, message: "请输入目标" }]}>
              <Input.TextArea rows={4} placeholder="例如：把两张客户测试表从 MySQL 全量同步到 PostgreSQL public schema" />
            </Form.Item>
            <Form.Item name="taskName" label="任务名称" rules={[{ required: true, message: "请输入任务名称" }]}>
              <Input maxLength={128} />
            </Form.Item>
            <div className="grid grid-two-form">
              <Form.Item name="sourceDatasourceId" label="源端数据源" rules={[{ required: true, message: "请选择源端数据源" }]}>
                <Select showSearch optionFilterProp="label" options={sourceOptions} loading={sourceQuery.isLoading} placeholder="仅展示 SOURCE 数据源" />
              </Form.Item>
              <Form.Item name="targetDatasourceId" label="目标端数据源" rules={[{ required: true, message: "请选择目标端数据源" }]}>
                <Select showSearch optionFilterProp="label" options={targetOptions} loading={targetQuery.isLoading} placeholder="仅展示 TARGET 数据源" />
              </Form.Item>
            </div>
            {!hasDatasourceOptions && projectId ? (
              <Alert
                showIcon
                type="warning"
                message="当前项目缺少可用的源端或目标端数据源"
                description={<Button type="link" onClick={() => navigate("/datasources")}>前往数据源管理安全创建</Button>}
                style={{ marginBottom: 16 }}
              />
            ) : null}
            <Form.Item name="writeStrategy" label="写入策略" rules={[{ required: true }]}>
              <Select options={[
                { value: "INSERT", label: "INSERT（目标表需满足插入准入）" },
                { value: "UPDATE", label: "UPDATE / MERGE（目标表需具备主键或唯一键）" },
              ]} />
            </Form.Item>

            <Typography.Title level={5}>对象映射</Typography.Title>
            <Form.List name="objectMappings">
              {(fields, { add, remove }) => (
                <Space direction="vertical" style={{ width: "100%" }}>
                  {fields.map((field, index) => (
                    <Card key={field.key} size="small" title={`映射 ${index + 1}`} extra={fields.length > 1 ? (
                      <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                    ) : null}>
                      <div className="grid grid-two-form">
                        <Form.Item name={[field.name, "sourceSchemaName"]} label="源 schema（MySQL 可留空）">
                          <Input placeholder="可留空" />
                        </Form.Item>
                        <Form.Item name={[field.name, "sourceObjectName"]} label="源表" rules={[{ required: true, message: "请输入源表" }]}>
                          <Input />
                        </Form.Item>
                        <Form.Item name={[field.name, "targetSchemaName"]} label="目标 schema" rules={[{ required: true, message: "请输入目标 schema" }]}>
                          <Input />
                        </Form.Item>
                        <Form.Item name={[field.name, "targetObjectName"]} label="目标表" rules={[{ required: true, message: "请输入目标表" }]}>
                          <Input />
                        </Form.Item>
                      </div>
                      <Form.Item name={[field.name, "whereCondition"]} label="可选 WHERE 条件">
                        <Input placeholder="例如 status = 'ACTIVE'，支持现有 data-sync 安全解析能力" />
                      </Form.Item>
                    </Card>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ targetSchemaName: "public" })} block>
                    添加对象映射
                  </Button>
                </Space>
              )}
            </Form.List>

            <Button
              type="primary"
              htmlType="submit"
              icon={<RobotOutlined />}
              loading={planMutation.isPending}
              disabled={!projectId || !hasDatasourceOptions}
              style={{ marginTop: 20 }}
            >
              生成 Agent 执行计划
            </Button>
          </Form>
        </Card>

        <Card title="可观测执行计划" className="compact-card">
          {planItems.length ? (
            <>
              <Steps
                direction="vertical"
                size="small"
                items={planItems.map((item) => ({
                  title: item.toolName,
                  description: item.reason,
                  status: "wait",
                }))}
              />
              <Alert
                showIcon
                type="warning"
                message="确认后才会执行写节点"
                description="连接测试和元数据读取为只读节点；草稿保存、发布和运行会改变业务状态，只在本次确认后执行。"
                style={{ marginTop: 16, marginBottom: 16 }}
              />
              <Button
                type="primary"
                danger
                icon={<ArrowRightOutlined />}
                loading={executeMutation.isPending}
                onClick={() => executeMutation.mutate()}
              >
                确认并执行本次计划
              </Button>
            </>
          ) : (
            <Typography.Text type="secondary">填写左侧目标和映射后，系统会展示 LangGraph/Java 控制面可追踪工具节点。</Typography.Text>
          )}
        </Card>
      </div>

      {audits.length ? (
        <Card title="节点执行状态" className="compact-card">
          <Space direction="vertical" style={{ width: "100%" }}>
            {audits.map((audit: AgentToolExecutionAudit) => (
              <Card key={audit.auditId} size="small">
                <div className="split-row">
                  <Space>
                    {audit.state === "SUCCEEDED" ? <CheckCircleOutlined style={{ color: "#16a34a" }} /> : <RobotOutlined />}
                    <Typography.Text strong>{audit.toolCode}</Typography.Text>
                    <Tag color={statusColor(audit.state)}>{audit.state}</Tag>
                  </Space>
                  <Typography.Text type="secondary">{audit.message || audit.planReason || "等待执行"}</Typography.Text>
                </div>
              </Card>
            ))}
          </Space>
        </Card>
      ) : null}

      {executionResults.some((item) => item.audit.state === "FAILED") ? (
        <Card title="失败节点详情与建议" className="compact-card">
          <Space direction="vertical" style={{ width: "100%" }}>
            {executionResults.filter((item) => item.audit.state === "FAILED").map((item) => (
              <Alert
                key={item.audit.auditId}
                showIcon
                type="error"
                message={`${item.audit.toolCode}：${item.audit.message || "节点执行失败"}`}
                description={(
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {JSON.stringify(item.output, null, 2)}
                  </pre>
                )}
              />
            ))}
          </Space>
        </Card>
      ) : null}
    </div>
  );
}

export function AgentAssistant() {
  const actorRole = useAuthStore((state) => state.user?.actorRole?.toUpperCase());
  if (["ORDINARY_USER", "PROJECT_OWNER"].includes(actorRole ?? "")) {
    return <UserAgentAssistant />;
  }
  return <AgentConsole />;
}
