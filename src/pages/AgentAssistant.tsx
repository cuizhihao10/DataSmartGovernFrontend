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
  Tooltip,
  Typography,
  message,
} from "antd";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/endpoints";
import { PageHeader } from "@/components/PageHeader";
import { AgentConsole } from "@/pages/AgentConsole";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";
import type {
  AgentPlanResponse,
  AgentToolExecutionAudit,
  AgentToolExecutionResult,
} from "@/types/domain";

interface ObjectMappingInput {
  sourceSchemaName?: string;
  sourceObjectName: string;
  targetSchemaName?: string;
  targetObjectName: string;
  whereCondition?: string;
}

interface ObjectiveFormValues {
  objective: string;
}

interface ClarificationFormValues {
  taskName: string;
  sourceDatasourceId: number;
  targetDatasourceId: number;
  writeStrategy: "INSERT" | "UPDATE";
  objectMappings: ObjectMappingInput[];
}

interface PlanSubmission {
  objective: string;
  clarification?: ClarificationFormValues;
  syncMode?: string;
}

interface ExecutionAnswer {
  content: string;
  mode: string;
  modelProviderStatus: string;
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

const syncModeLabels: Record<string, string> = {
  FULL: "全量传输",
  SCHEDULED_BATCH: "定期批量",
  SCHEDULED_FULL: "定期全量",
  CUSTOM_SQL_QUERY: "SQL 语句",
  REAL_TIME: "实时同步",
};

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
  const [objectiveForm] = Form.useForm<ObjectiveFormValues>();
  const [clarificationForm] = Form.useForm<ClarificationFormValues>();
  const selectedProjectId = useUiStore((state) => state.selectedProjectId);
  const [objective, setObjective] = useState(defaultObjective);
  const [controlPlane, setControlPlane] = useState<{ sessionId: string; runId: string }>();
  const [plan, setPlan] = useState<AgentPlanResponse>();
  const [executionResults, setExecutionResults] = useState<AgentToolExecutionResult[]>([]);
  const [executionAnswer, setExecutionAnswer] = useState<ExecutionAnswer>();

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
    refetchInterval: controlPlane && !executionAnswer ? 3000 : false,
  });
  const audits = auditsQuery.data?.data ?? [];

  const planMutation = useMutation({
    mutationFn: async (submission: PlanSubmission) => {
      if (!session?.tenantId || !projectId || !session.actorId) {
        throw new Error("缺少登录租户、项目或操作者上下文，请先选择项目");
      }
      const variables: Record<string, unknown> = {
        frontendSurface: "UserAgentAssistant",
        runtimeProfile: "production",
      };
      if (submission.clarification) {
        variables.dataSyncRequest = {
          taskName: submission.clarification.taskName,
          taskDescription: submission.objective,
          sourceDatasourceId: submission.clarification.sourceDatasourceId,
          targetDatasourceId: submission.clarification.targetDatasourceId,
          syncMode: submission.syncMode || "FULL",
          writeStrategy: submission.syncMode === "REAL_TIME"
            ? "UPDATE"
            : submission.clarification.writeStrategy,
          groupCode: "DEFAULT",
          groupName: "默认分组",
          objectMappings: submission.clarification.objectMappings.map((item, index) => ({
            objectKey: `agent-mapping-${index + 1}`,
            ...item,
          })),
        };
      }
      return api.createAgentPlan({
        tenant_id: String(session.tenantId),
        project_id: String(projectId),
        actor_id: String(session.actorId),
        objective: submission.objective,
        preferred_workload: "agent_reasoning",
        locale: "zh-CN",
        variables,
      });
    },
    onSuccess: (result, submission) => {
      const nextPlan = result.data;
      const conversation = nextPlan.agentConversation;
      setPlan(nextPlan);
      setExecutionResults([]);
      setExecutionAnswer(undefined);

      if (conversation?.phase === "WAITING_CLARIFICATION") {
        setControlPlane(undefined);
        if (!submission.clarification) {
          clarificationForm.resetFields();
          clarificationForm.setFieldsValue({
            taskName: "Agent 创建的数据同步任务",
            writeStrategy: conversation.structuredIntent.syncMode === "REAL_TIME" ? "UPDATE" : "INSERT",
            objectMappings: submission.objective === defaultObjective
              ? defaultMappings.map((item) => ({ ...item }))
              : [{ sourceObjectName: "", targetSchemaName: "public", targetObjectName: "" }],
          });
        }
        message.info("Agent 已理解目标，请补充执行所需参数");
        return;
      }

      if (conversation?.phase === "NO_EXECUTABLE_PLAN") {
        setControlPlane(undefined);
        message.warning(conversation.assistantMessage);
        return;
      }

      const ingestion = nextPlan.controlPlaneIngestion;
      const sessionId = textField(ingestion, "sessionId");
      const runId = textField(ingestion, "runId");
      if (!sessionId || !runId) {
        setControlPlane(undefined);
        message.error("参数已补齐，但 Java 控制面未返回 sessionId/runId，请检查计划接入状态");
        return;
      }
      setControlPlane({ sessionId, runId });
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
      setExecutionAnswer({
        content: result.data.assistantReply || "工具执行已经结束，请查看节点状态。",
        mode: result.data.answerMode || "DETERMINISTIC_FALLBACK",
        modelProviderStatus: result.data.modelProviderStatus || "RESERVED_NOT_INVOKED",
      });
      if (result.data.failedCount > 0) {
        message.error(`Agent 计划有 ${result.data.failedCount} 个节点失败，请查看节点详情`);
      } else {
        message.success("Agent 控制面节点已执行完成，同步任务已进入真实业务执行链路");
      }
      await auditsQuery.refetch();
    },
    onError: (error) => message.error(errorMessage(error)),
  });

  const conversation = plan?.agentConversation;
  const planItems = plan?.plan?.toolPlans ?? [];
  const hasDatasourceOptions = sourceOptions.length > 0 && targetOptions.length > 0;
  const syncMode = conversation?.structuredIntent.syncMode || "FULL";
  const resolverMode = textField(conversation?.intentResolver, "mode");
  const projectUnavailableMessage = sessionQuery.isError
    ? "登录或项目上下文加载失败，请刷新页面后重试"
    : "请先在页面顶部选择一个项目";

  const submitObjective = (values: ObjectiveFormValues) => {
    setObjective(values.objective);
    setPlan(undefined);
    setControlPlane(undefined);
    setExecutionResults([]);
    setExecutionAnswer(undefined);
    planMutation.mutate({ objective: values.objective });
  };

  return (
    <div className="page-stack">
      <PageHeader
        title="智能助手"
        subtitle="从自然语言理解、缺参追问到真实工具执行的受控 Agent"
        actions={<Button icon={<DatabaseOutlined />} onClick={() => navigate("/datasources")}>数据源管理</Button>}
      />

      <Alert
        showIcon
        type="info"
        icon={<SafetyCertificateOutlined />}
        message="数据库密码不会进入 Agent"
        description="Agent 只使用当前项目内已授权的数据源 ID。连接凭据不会进入自然语言、LangGraph 状态、模型接口、计划、事件或日志。"
      />

      <Card title="告诉 Agent 你想完成什么" className="compact-card">
        <Form<ObjectiveFormValues>
          form={objectiveForm}
          layout="vertical"
          initialValues={{ objective: defaultObjective }}
          onFinish={submitObjective}
        >
          <Form.Item name="objective" rules={[{ required: true, message: "请输入目标" }]}>
            <Input.TextArea
              rows={4}
              placeholder="例如：把两张客户测试表从 MySQL 全量同步到 PostgreSQL public schema"
            />
          </Form.Item>
          <Tooltip title={!projectId ? projectUnavailableMessage : undefined}>
            <span>
              <Button
                type="primary"
                htmlType="submit"
                icon={<RobotOutlined />}
                loading={planMutation.isPending && !planMutation.variables?.clarification}
                disabled={!projectId}
              >
                发送给 Agent
              </Button>
            </span>
          </Tooltip>
        </Form>
      </Card>

      {conversation ? (
        <div className="grid grid-two">
          <Card title="Agent 回复" className="compact-card">
            <Alert
              showIcon
              type={conversation.phase === "NO_EXECUTABLE_PLAN" ? "warning" : "success"}
              message={conversation.assistantMessage}
            />
            <Space wrap style={{ marginTop: 16 }}>
              <Tag color="blue">{conversation.structuredIntent.intentType}</Tag>
              {conversation.structuredIntent.syncMode ? (
                <Tag color="cyan">{syncModeLabels[syncMode] || syncMode}</Tag>
              ) : null}
              <Tag>置信度 {Math.round(conversation.structuredIntent.confidence * 100)}%</Tag>
              <Tag color={resolverMode === "DETERMINISTIC_FALLBACK" ? "gold" : "green"}>
                {resolverMode === "DETERMINISTIC_FALLBACK" ? "规则兜底解析" : resolverMode}
              </Tag>
            </Space>
          </Card>

          <Card title="结构化意图" className="compact-card">
            <Space direction="vertical" style={{ width: "100%" }}>
              <Typography.Text>{conversation.structuredIntent.summary}</Typography.Text>
              <Typography.Text type="secondary">
                业务域：{conversation.structuredIntent.domains.join("、") || "未识别"}
              </Typography.Text>
              <Typography.Text type="secondary">
                候选工具：{conversation.structuredIntent.candidateTools.join("、") || "暂无"}
              </Typography.Text>
              <Typography.Text type="secondary">
                下一步：{conversation.nextAction}
              </Typography.Text>
            </Space>
          </Card>
        </div>
      ) : null}

      {conversation?.phase === "WAITING_CLARIFICATION" ? (
        <Card title="补充 Agent 执行所需信息" className="compact-card">
          <Space wrap style={{ marginBottom: 16 }}>
            {conversation.clarificationQuestions.map((question) => (
              <Tag key={question.parameterName} color="gold">{question.question}</Tag>
            ))}
          </Space>
          <Form<ClarificationFormValues>
            form={clarificationForm}
            layout="vertical"
            onFinish={(values) => planMutation.mutate({ objective, clarification: values, syncMode })}
          >
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
            {!hasDatasourceOptions ? (
              <Alert
                showIcon
                type="warning"
                message="当前项目缺少可用的源端或目标端数据源"
                description={<Button type="link" onClick={() => navigate("/datasources")}>前往数据源管理安全创建</Button>}
                style={{ marginBottom: 16 }}
              />
            ) : null}
            <Form.Item name="writeStrategy" label="写入策略" rules={[{ required: true }]}>
              <Select
                disabled={syncMode === "REAL_TIME"}
                options={[
                  { value: "INSERT", label: "INSERT（目标表需满足插入准入）" },
                  { value: "UPDATE", label: "UPDATE / MERGE（目标表需具备主键或唯一键）" },
                ]}
              />
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
                          <Input placeholder="MySQL 可留空" />
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
                        <Input placeholder="例如 status = 'ACTIVE'，仍由 data-sync 安全解析与预检查" />
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
              icon={<ArrowRightOutlined />}
              loading={planMutation.isPending && Boolean(planMutation.variables?.clarification)}
              disabled={!hasDatasourceOptions}
              style={{ marginTop: 20 }}
            >
              提交补充信息并生成计划
            </Button>
          </Form>
        </Card>
      ) : null}

      {controlPlane && planItems.length ? (
        <Card title="可观测执行计划" className="compact-card">
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
            description="连接测试和元数据读取为只读节点；草稿保存、预检查、发布和运行会改变业务状态，只在本次确认后执行。"
            style={{ marginTop: 16, marginBottom: 16 }}
          />
          <Button
            type="primary"
            danger
            icon={<ArrowRightOutlined />}
            loading={executeMutation.isPending}
            disabled={Boolean(executionAnswer)}
            onClick={() => executeMutation.mutate()}
          >
            确认并执行本次计划
          </Button>
        </Card>
      ) : null}

      {executionAnswer ? (
        <Card title="Agent 二轮回答" className="compact-card">
          <Alert
            showIcon
            type={executionResults.some((item) => item.audit.state === "FAILED") ? "error" : "success"}
            message={executionAnswer.content}
          />
          <Space wrap style={{ marginTop: 12 }}>
            <Tag>{executionAnswer.mode}</Tag>
            <Tag color="gold">{executionAnswer.modelProviderStatus}</Tag>
          </Space>
        </Card>
      ) : null}

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
