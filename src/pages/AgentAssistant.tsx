import {
  ArrowRightOutlined,
  ApiOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  CodeOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  ReadOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Collapse,
  Descriptions,
  Form,
  Input,
  Select,
  Space,
  Spin,
  Steps,
  Tag,
  Timeline,
  Tooltip,
  Typography,
  message,
} from "antd";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/endpoints";
import type { AgentPlanStreamFrame, AgentPlanStreamProgressEvent } from "@/api/endpoints";
import { PageHeader } from "@/components/PageHeader";
import { AgentConsole } from "@/pages/AgentConsole";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";
import type {
  AgentPlanResponse,
  AgentObservationTimelineItem,
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

function booleanField(record: Record<string, unknown> | undefined, key: string) {
  return record?.[key] === true;
}

function numberField(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
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

function observationColor(status: string) {
  if (status === "SUCCEEDED" || status === "READY" || status === "LOADED") return "green";
  if (status === "FAILED" || status === "BLOCKED") return "red";
  if (["FALLBACK", "WAITING", "WAITING_INPUT", "WAITING_APPROVAL", "PAUSED"].includes(status)) return "orange";
  if (["PLANNED", "EXECUTING", "TOOL_CALLING", "RUNNING", "QUEUED", "PENDING"].includes(status)) return "blue";
  return "gray";
}

function observationIcon(category: string) {
  if (category === "MODEL") return <RobotOutlined />;
  if (category === "DECISION") return <ApiOutlined />;
  if (category === "SKILL") return <ReadOutlined />;
  if (category === "ORCHESTRATION") return <BranchesOutlined />;
  if (category === "TOOL") return <ToolOutlined />;
  if (category === "COMMAND") return <CodeOutlined />;
  if (category === "PERMISSION") return <SafetyCertificateOutlined />;
  return <QuestionCircleOutlined />;
}

function observationCategory(category: string) {
  return {
    MODEL: "模型决策",
    DECISION: "执行策略",
    SKILL: "Skill",
    ORCHESTRATION: "编排",
    TOOL: "工具调用",
    COMMAND: "命令 / API",
    PERMISSION: "权限与确认",
    USER_ACTION: "需要你操作",
  }[category] || category;
}

function observationStatus(status: string) {
  return {
    SUCCEEDED: "已完成",
    READY: "已就绪",
    LOADED: "已加载",
    PLANNED: "已规划",
    EXECUTING: "执行中",
    TOOL_CALLING: "调用中",
    RUNNING: "进行中",
    QUEUED: "排队中",
    PENDING: "等待执行",
    WAITING: "等待中",
    WAITING_INPUT: "等待补充信息",
    WAITING_APPROVAL: "等待确认",
    WAITING_HUMAN: "等待人工处理",
    PAUSED: "已安全暂停",
    BLOCKED: "已阻止",
    FAILED: "失败",
    FALLBACK: "已降级",
    SKIPPED: "未调用",
  }[status] || status;
}

function streamEventPresentation(event: AgentPlanStreamProgressEvent) {
  const presentations: Record<string, { category: string; title: string; status?: string }> = {
    agent_plan_started: { category: "ORCHESTRATION", title: "接收目标并启动 LangGraph", status: "RUNNING" },
    context_collected: { category: "ORCHESTRATION", title: "收集项目上下文" },
    context_filtered: { category: "ORCHESTRATION", title: "过滤无权或无关上下文" },
    context_deduplicated: { category: "ORCHESTRATION", title: "合并重复上下文" },
    context_truncated: { category: "ORCHESTRATION", title: "压缩上下文" },
    context_micro_compacted: { category: "ORCHESTRATION", title: "执行微压缩" },
    context_selected: { category: "ORCHESTRATION", title: "完成受控上下文构建" },
    model_gateway_routed: { category: "MODEL", title: "选择模型路由与治理策略" },
    intent_analyzed: { category: "DECISION", title: "形成规则安全基线" },
    skill_admission_evaluated: { category: "SKILL", title: "加载并校验 Skill" },
    model_query_started: { category: "MODEL", title: "调用真实模型", status: "RUNNING" },
    model_query_executed: { category: "MODEL", title: "真实模型调用完成" },
    model_tool_call_proposed: { category: "TOOL", title: "模型提出工具调用" },
    model_tool_call_accepted: { category: "TOOL", title: "工具建议通过治理" },
    model_tool_call_rejected: { category: "PERMISSION", title: "工具建议被安全门禁拒绝", status: "BLOCKED" },
    model_tool_call_approval_required: { category: "PERMISSION", title: "工具调用等待用户确认", status: "WAITING_APPROVAL" },
    model_tool_call_budget_guarded: { category: "PERMISSION", title: "执行工具预算门禁" },
    tool_planned: { category: "TOOL", title: "生成工具执行计划" },
    tool_parameter_validated: { category: "USER_ACTION", title: "校验工具执行参数", status: "WAITING_INPUT" },
    memory_retrieved: { category: "ORCHESTRATION", title: "检索受控记忆" },
    approval_waiting: { category: "PERMISSION", title: "等待用户确认", status: "WAITING_APPROVAL" },
    agent_plan_completed: { category: "ORCHESTRATION", title: "完成本轮受控规划" },
  };
  return presentations[event.eventType] || {
    category: "ORCHESTRATION",
    title: event.stage || event.eventType,
  };
}

function streamEventToObservation(event: AgentPlanStreamProgressEvent): AgentObservationTimelineItem {
  const presentation = streamEventPresentation(event);
  const eventFailed = event.severity?.toLowerCase() === "error";
  const eventWarning = event.severity?.toLowerCase() === "warning";
  const isModelStage = event.stage === "invoke_model_intent";
  // 规则分析器的 confidence 是内部启发式匹配分，不是模型校准置信度，也不适合驱动用户决策。
  // 工作过程只展示可验证的领域、候选工具、风险和缺参事实，避免把固定分值误读成 AI 自信程度。
  const publicAttributes = Object.fromEntries(
    Object.entries(event.attributes || {}).filter(([key]) => !["confidence", "ruleConfidence"].includes(key)),
  );
  return {
    id: isModelStage ? "live-model-invocation" : `live-${event.eventType}-${event.sequence ?? event.stage}`,
    category: presentation.category,
    stage: event.stage,
    status: eventFailed ? "FAILED" : presentation.status || (eventWarning ? "FALLBACK" : "SUCCEEDED"),
    title: presentation.title,
    summary: event.message,
    details: {
      ...publicAttributes,
      occurredAt: event.createdAt,
    },
  };
}

function observationDetailLabel(key: string) {
  return {
    provider: "模型 Provider",
    model: "模型",
    latencyMs: "调用耗时",
    promptTokens: "输入 Token",
    completionTokens: "输出 Token",
    totalTokens: "总 Token",
    toolCallCount: "模型建议工具数",
    proposedToolNames: "模型建议工具",
    attemptCount: "调用尝试次数",
    cacheHit: "命中缓存",
    fallbackUsed: "是否降级",
    errorCode: "错误码",
    strategySummary: "策略摘要",
    selectedProviderName: "模型 Provider",
    selectedModelName: "模型",
    visibleToolCount: "可见工具数",
    occurredAt: "发生时间",
    elapsedSeconds: "已等待时长",
    domains: "业务域",
    candidateTools: "候选工具",
    riskTags: "风险标签",
    missingInformation: "缺失信息",
    skillCode: "Skill 编码",
    domain: "所属业务域",
    matchScore: "匹配分数",
    requiredTools: "依赖工具",
    requiredPermissions: "所需权限",
    memoryDependencies: "记忆依赖",
    riskLevel: "风险等级",
    approvalPolicy: "确认策略",
    admissionStatus: "准入状态",
    completedStepCount: "已完成步骤数",
    completedSteps: "已完成步骤",
    currentPhase: "当前阶段",
    nextAction: "下一步",
    resumeSupported: "支持恢复",
    executionMode: "执行方式",
    requiresHumanApproval: "需要人工确认",
    parameterValidationPassed: "参数校验通过",
    missingFields: "待补字段",
    requiredAction: "所需操作",
    protectedToolCount: "受保护工具数",
    automaticExecutionBlocked: "已阻止自动执行",
    inputType: "输入类型",
    required: "是否必填",
    sensitive: "是否敏感",
    templateId: "命令模板 ID",
    decision: "准入决策",
    proposalState: "命令状态",
    missingEvidenceCodes: "缺失证据",
    sessionId: "会话 ID",
    runId: "运行 ID",
    toolAuditCount: "工具审计数",
    auditId: "审计 ID",
    targetService: "目标服务",
    outputSummary: "执行结果摘要",
    readOnly: "只读调用",
    idempotent: "支持幂等",
  }[key] || key;
}

function observationDetailsTitle(category: string) {
  return {
    MODEL: "查看模型调用信息",
    DECISION: "查看策略与安全约束",
    SKILL: "查看 Skill 加载详情",
    ORCHESTRATION: "查看编排摘要",
    TOOL: "查看工具调用详情",
    COMMAND: "查看命令与 API 详情",
    PERMISSION: "查看所需权限与确认",
    USER_ACTION: "查看需要补充的信息",
  }[category] || "查看详情";
}

function formatObservationValue(value: unknown, key?: string) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (key === "latencyMs" && typeof value === "number") return `${value} ms`;
  if (key === "elapsedSeconds" && typeof value === "number") return `${value} 秒`;
  if (Array.isArray(value)) return value.length ? value.join("、") : "无";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function scrollToAgentSection(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function UserAgentAssistant() {
  const navigate = useNavigate();
  const [objectiveForm] = Form.useForm<ObjectiveFormValues>();
  const [clarificationForm] = Form.useForm<ClarificationFormValues>();
  const selectedProjectId = useUiStore((state) => state.selectedProjectId);
  const [objective, setObjective] = useState(defaultObjective);
  const [controlPlane, setControlPlane] = useState<{ sessionId: string; runId: string }>();
  const [plan, setPlan] = useState<AgentPlanResponse>();
  const [liveObservationItems, setLiveObservationItems] = useState<AgentObservationTimelineItem[]>([]);
  const [liveRequestId, setLiveRequestId] = useState<string>();
  const [executionInProgress, setExecutionInProgress] = useState(false);
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
    // 用户确认执行后按 1 秒刷新真实工具审计，让正在执行和刚完成的节点及时进入时间线。
    // 未开始执行时保留较低频率，避免等待确认阶段产生无意义的控制面压力。
    refetchInterval: controlPlane && !executionAnswer ? (executionInProgress ? 1000 : 3000) : false,
  });
  const audits = useMemo(() => auditsQuery.data?.data ?? [], [auditsQuery.data?.data]);

  const consumePlanStreamFrame = (frame: AgentPlanStreamFrame) => {
    if (frame.requestId) setLiveRequestId(frame.requestId);
    if (frame.type === "heartbeat") {
      const elapsedSeconds = Math.max(1, Math.round((frame.elapsedMs ?? 0) / 1000));
      setLiveObservationItems((current) => {
        let runningIndex = -1;
        for (let index = current.length - 1; index >= 0; index -= 1) {
          if (current[index].status === "RUNNING") {
            runningIndex = index;
            break;
          }
        }
        if (runningIndex < 0) return current;
        const next = [...current];
        const runningItem = current[runningIndex];
        next[runningIndex] = {
          ...runningItem,
          summary: `当前步骤仍在进行，已等待 ${elapsedSeconds} 秒；连接正常，完成后会立即展示下一步。`,
          details: {
            ...runningItem.details,
            elapsedSeconds,
          },
        };
        return next;
      });
      return;
    }
    if (frame.type !== "progress" || !frame.event) return;
    const item = streamEventToObservation(frame.event);
    setLiveObservationItems((current) => {
      const existingIndex = current.findIndex((candidate) => candidate.id === item.id);
      if (existingIndex < 0) return [...current, item];
      const next = [...current];
      next[existingIndex] = item;
      return next;
    });
  };

  const planMutation = useMutation({
    mutationFn: async (submission: PlanSubmission) => {
      if (!session?.tenantId || !projectId || !session.actorId) {
        throw new Error("缺少登录租户、项目或操作者上下文，请先选择项目");
      }
      const variables: Record<string, unknown> = {
        frontendSurface: "UserAgentAssistant",
        runtimeProfile: "production",
        // NDJSON 只流式传输可审计的阶段事实；模型 token 流保持关闭，以便查询引擎完整治理
        // 限流、重试、fallback 和用量，同时避免向用户暴露原始模型推理。
        streamModelIntent: false,
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
      const requestId = crypto.randomUUID();
      return api.createAgentPlanStream({
        tenant_id: String(session.tenantId),
        project_id: String(projectId),
        actor_id: String(session.actorId),
        request_id: requestId,
        objective: submission.objective,
        preferred_workload: "agent_reasoning",
        locale: "zh-CN",
        variables,
      }, consumePlanStreamFrame);
    },
    onMutate: () => {
      setLiveObservationItems([]);
      setLiveRequestId(undefined);
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
    onError: (error) => {
      const summary = errorMessage(error);
      setLiveObservationItems((current) => [
        ...current.filter((item) => item.status !== "RUNNING"),
        {
          id: "live-plan-error",
          category: "ORCHESTRATION",
          stage: "agent_plan_failed",
          status: "FAILED",
          title: "Agent 规划失败",
          summary,
          details: { requestId: liveRequestId },
        },
      ]);
      message.error(summary);
    },
  });

  const executeMutation = useMutation({
    mutationFn: () => {
      if (!controlPlane) throw new Error("请先生成 Agent 计划");
      return api.confirmAndExecuteAgentRun(controlPlane.sessionId, controlPlane.runId, {
        confirmed: true,
        comment: "用户在智能助手页面确认执行数据同步计划",
      });
    },
    onMutate: () => setExecutionInProgress(true),
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
    onSettled: () => setExecutionInProgress(false),
  });

  const conversation = plan?.agentConversation;
  const planItems = plan?.plan?.toolPlans ?? [];
  const hasDatasourceOptions = sourceOptions.length > 0 && targetOptions.length > 0;
  const syncMode = conversation?.structuredIntent.syncMode || "FULL";
  const resolverMode = textField(conversation?.intentResolver, "mode");
  const modelProvider = textField(conversation?.intentResolver, "modelProvider");
  const modelName = textField(conversation?.intentResolver, "modelName");
  const modelInvoked = booleanField(conversation?.intentResolver, "providerInvokedForCurrentTurn");
  const modelSucceeded = booleanField(conversation?.intentResolver, "providerSucceededForCurrentTurn");
  const modelLatencyMs = numberField(conversation?.intentResolver, "latencyMs");
  const modelTotalTokens = numberField(conversation?.intentResolver, "totalTokens");
  const modelFallbackReason = textField(conversation?.intentResolver, "fallbackReasonCode");
  const observationItems = useMemo<AgentObservationTimelineItem[]>(() => {
    const planningItems = plan?.agentObservationTimeline?.items ?? [];
    const finalizedStages = new Set(planningItems.map((item) => item.stage));
    // 最终响应中的产品化摘要替换同阶段的临时事件；上下文等未被聚合覆盖的节点继续保留，便于完整回放。
    const retainedLiveItems = liveObservationItems.filter((item) => (
      item.status === "RUNNING" || !finalizedStages.has(item.stage)
    ));
    const executionItems = audits.map((audit) => ({
      id: `execution-${audit.auditId}`,
      category: "TOOL",
      stage: "execute_java_tool",
      status: audit.state,
      title: `调用工具：${audit.toolCode}`,
      summary: audit.message || audit.planReason || "Java Agent Runtime 正在处理工具节点。",
      details: {
        auditId: audit.auditId,
        targetService: audit.targetService,
        executionMode: audit.executionMode,
        riskLevel: audit.riskLevel,
        requiresHumanApproval: audit.requiresApproval,
        readOnly: audit.readOnly,
        idempotent: audit.idempotent,
        outputSummary: audit.outputSummary,
        errorCode: audit.errorCode,
      },
    } satisfies AgentObservationTimelineItem));
    return [...retainedLiveItems, ...planningItems, ...executionItems];
  }, [audits, liveObservationItems, plan?.agentObservationTimeline?.items]);
  const projectUnavailableMessage = sessionQuery.isError
    ? "登录或项目上下文加载失败，请刷新页面后重试"
    : "请先在页面顶部选择一个项目";

  const submitObjective = (values: ObjectiveFormValues) => {
    setObjective(values.objective);
    setPlan(undefined);
    setLiveObservationItems([]);
    setLiveRequestId(undefined);
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

      {planMutation.isPending && !planMutation.variables?.clarification && liveObservationItems.length === 0 ? (
        <Card title="Agent 工作过程" className="compact-card">
          <Timeline
            items={[{
              color: "blue",
              dot: <Spin size="small" />,
              children: (
                <div>
                  <Space wrap>
                    <Typography.Text strong>模型正在理解目标并生成受控计划</Typography.Text>
                    <Tag color="blue">处理中</Tag>
                  </Space>
                  <Typography.Paragraph type="secondary" style={{ margin: "8px 0 0" }}>
                    正在建立带认证的实时规划流；连接建立后，每个真实阶段会立即追加到下方工作过程。
                  </Typography.Paragraph>
                </div>
              ),
            }]}
          />
        </Card>
      ) : null}

      {conversation ? (
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
            <Tag color={modelSucceeded ? "green" : "gold"}>
              {modelSucceeded ? "真实模型已参与" : modelInvoked ? "模型失败，规则降级" : "仅规则解析"}
            </Tag>
            {modelProvider ? <Tag color="geekblue">{modelProvider}</Tag> : null}
            {modelName ? <Tag color="blue">{modelName}</Tag> : null}
            {modelLatencyMs !== undefined ? <Tag>{modelLatencyMs} ms</Tag> : null}
            {modelTotalTokens !== undefined ? <Tag>{modelTotalTokens} tokens</Tag> : null}
          </Space>
          {!modelSucceeded ? (
            <Alert
              showIcon
              type="warning"
              style={{ marginTop: 12 }}
              message={modelInvoked ? "真实模型调用失败，本轮已安全降级" : "本轮没有调用真实模型"}
              description={modelFallbackReason ? `降级原因：${modelFallbackReason}` : `解析模式：${resolverMode || "DETERMINISTIC_FALLBACK"}`}
            />
          ) : null}
        </Card>
      ) : null}

      {observationItems.length ? (
        <Card
          title="Agent 工作过程"
          className="compact-card"
          extra={(
            <Space wrap>
              {planMutation.isPending ? <Tag color="processing" icon={<Spin size="small" />}>实时规划中</Tag> : null}
              {liveRequestId ? <Tag>请求 {liveRequestId.slice(0, 8)}</Tag> : null}
              <Tag color="cyan">公开摘要，不展示隐藏思维链</Tag>
            </Space>
          )}
        >
          <Alert
            showIcon
            type="info"
            message="这里展示真实、可操作、可审计的 Agent 工作过程"
            description="节点完成后会立即出现，当前节点会保持“进行中”；包含模型公开决策摘要、Skill 加载、LangGraph 编排、工具与命令调用、权限门禁、待补信息和执行结果。系统提示词、隐藏推理、凭据与原始参数不会展示。"
            style={{ marginBottom: 20 }}
          />
          <Timeline
            items={observationItems.map((item) => {
              // v1 返回过纯排序字段 sequence；即使滚动升级期间命中旧缓存，也不再把它伪装成治理详情。
              const detailEntries = Object.entries(item.details).filter(([key]) => key !== "sequence");
              const needsInput = item.category === "USER_ACTION"
                || (item.category === "PERMISSION" && item.status === "WAITING_INPUT");
              const needsConfirmation = item.category === "PERMISSION" && item.status === "WAITING_APPROVAL";
              return {
                color: observationColor(item.status),
                dot: item.status === "RUNNING" ? <Spin size="small" /> : observationIcon(item.category),
                children: (
                  <div style={{ paddingBottom: 8 }}>
                    <Space wrap>
                      <Typography.Text strong>{item.title}</Typography.Text>
                      <Tag color="blue">{observationCategory(item.category)}</Tag>
                      <Tag color={observationColor(item.status)}>{observationStatus(item.status)}</Tag>
                    </Space>
                    <Typography.Paragraph style={{ margin: "8px 0" }}>{item.summary}</Typography.Paragraph>
                    {needsInput ? (
                      <Button type="link" size="small" onClick={() => scrollToAgentSection("agent-clarification-card")}>
                        补充执行信息
                      </Button>
                    ) : null}
                    {needsConfirmation ? (
                      <Button type="link" size="small" onClick={() => scrollToAgentSection("agent-execution-plan-card")}>
                        查看并确认执行
                      </Button>
                    ) : null}
                    {detailEntries.length ? (
                      <Collapse
                        ghost
                        size="small"
                        items={[{
                          key: `${item.id}-details`,
                          label: observationDetailsTitle(item.category),
                          children: (
                            <Descriptions
                              size="small"
                              column={{ xs: 1, sm: 2, lg: 3 }}
                              items={detailEntries.map(([key, value]) => ({
                                key,
                                label: observationDetailLabel(key),
                                children: formatObservationValue(value, key),
                              }))}
                            />
                          ),
                        }]}
                      />
                    ) : null}
                  </div>
                ),
              };
            })}
          />
        </Card>
      ) : null}

      {conversation?.phase === "WAITING_CLARIFICATION" ? (
        <Card id="agent-clarification-card" title="补充 Agent 执行所需信息" className="compact-card">
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
        <Card id="agent-execution-plan-card" title="可观测执行计划" className="compact-card">
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
