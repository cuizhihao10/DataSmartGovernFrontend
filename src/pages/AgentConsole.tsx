import {
  BranchesOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeploymentUnitOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  RobotOutlined,
  SearchOutlined,
  ToolOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Form,
  Input,
  InputNumber,
  List,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Timeline,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  api,
  type BindAgentToolPayload,
  type CreateAgentSessionPayload,
  type StartAgentRunPayload,
} from "@/api/endpoints";
import { DataSourceIndicator } from "@/components/DataSourceIndicator";
import { PageHeader } from "@/components/PageHeader";
import { RealEmpty } from "@/components/RealEmpty";
import { BooleanTag, RiskTag } from "@/components/StatusTag";
import { SpecialistAgentExecutionPanel } from "@/components/agent/SpecialistAgentExecutionPanel";
import {
  createAgentRuntimeEventSocket,
  mergeRuntimeEvents,
  replayAgentRuntimeEvents,
  type AgentRuntimeEventProjection,
  type RuntimeEventSocketStatus,
} from "@/features/agent/runtimeEventSocket";
import { specialistExecutionFromDurableFacts } from "@/features/agent/specialistFactProjection";
import {
  projectAgentDiagnosticValue,
  publicAgentSummary,
  sanitizeAgentPresentationValue,
} from "@/features/agent/publicPresentationSafety";
import { ensureApiAccessToken, useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";
import type {
  AgentModelRoute,
  AgentPlanResponse,
  AgentRagQueryResult,
  AgentRun,
  AgentSession,
  AgentSpecialistTurnFact,
  AgentTool,
  AgentToolExecutionAudit,
  AgentToolPlan,
  RuntimeEvent,
} from "@/types/domain";
import { formatDateTime } from "@/utils/format";
import { defaultListPagination, defaultTablePagination, sortByIdDesc } from "@/utils/table";
import {
  agentToolTypeLabels,
  agentWorkloadLabels,
  executionModeLabels,
  labelOf,
  optionsOf,
  statusLabels,
} from "@/utils/labels";

const { TextArea } = Input;

const defaultObjective = "检查 CRM 会员手机号唯一性异常，生成修复建议并等待人工确认";

const eventColor: Record<RuntimeEvent["level"], string> = {
  INFO: "blue",
  WARN: "orange",
  ERROR: "red",
};

const runStateColor: Record<string, string> = {
  PLANNING: "blue",
  RUNNING: "processing",
  WAITING_HUMAN: "gold",
  WAITING_APPROVAL: "gold",
  SUCCEEDED: "success",
  FAILED: "error",
  CANCELLED: "default",
  UNKNOWN: "default",
};

const providerTypeLabels: Record<string, string> = {
  OPENAI_COMPATIBLE: "OpenAI 兼容接口",
  LOCAL_MODEL: "本地模型服务",
  VLLM: "vLLM 推理服务",
  OLLAMA: "Ollama 本地服务",
  MOCK: "试运行模拟服务",
};

const runtimeDomainLabels: Record<string, string> = {
  gateway: "网关入口",
  "agent-runtime": "智能体运行时",
  "python-runtime": "Python 智能运行时",
  "task-management": "任务管理",
  "data-sync": "数据同步",
};

interface AgentConsoleFormValues {
  tenantId?: number;
  projectId?: number;
  actorId?: string;
  channel?: string;
  objective?: string;
  selectedToolCodes?: string[];
  workloadType?: string;
  requireHumanApproval?: boolean;
}

interface RagFormValues {
  tenantId?: number;
  projectId?: number;
  actorId?: string;
  question?: string;
  topK?: number;
  candidateLimit?: number;
  maxContextChars?: number;
  generateAnswer?: boolean;
}

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function projectScopeIdOf(value: unknown) {
  const parsed = numeric(value);
  return parsed != null && parsed > 0 ? Math.floor(parsed) : undefined;
}

function isCurrentProject(projectId: unknown, currentProjectId?: number) {
  return currentProjectId != null && projectScopeIdOf(projectId) === currentProjectId;
}

function compact<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter((entry) => entry[1] !== undefined && entry[1] !== null && entry[1] !== ""),
  ) as T;
}

/**
 * Render diagnostics through the same low-sensitive browser projection used
 * by the collaboration timeline.
 *
 * Agent Console is an administrative observation surface, not an exception to
 * the credential and prompt boundary.  Diagnostic DTOs can come from rolling
 * runtimes and may unexpectedly carry raw provider payloads, SQL, connection
 * details, or tool arguments.  Sanitizing before `JSON.stringify` protects
 * every JSON panel in this page while preserving safe counters, status codes,
 * model names, and governance facts needed for troubleshooting.
 */
function jsonBlock(value: unknown, maxHeight = 320, fieldKey = "diagnostic") {
  /*
   * Diagnostics can originate outside the Agent runtime. Route them through
   * the dedicated low-sensitive contract instead of a generic JSON sanitizer;
   * only health, capacity, model provenance, and reviewed issue summaries are
   * allowed to remain visible.
   */
  const safeValue = fieldKey === "diagnostic" || fieldKey === "ragDiagnostic" || fieldKey === "governanceHints"
    ? projectAgentDiagnosticValue(value ?? {})
    : sanitizeAgentPresentationValue(value ?? {}, fieldKey);
  return (
    <pre className="mono" style={{ whiteSpace: "pre-wrap", overflow: "auto", maxHeight, margin: 0 }}>
      {JSON.stringify(safeValue ?? {}, null, 2)}
    </pre>
  );
}

/**
 * Convert an API failure into a public notification without replaying a raw
 * proxy/database/model error.  Detailed protected diagnostics remain inside
 * the server-side audit trail; the browser only needs a concise failure state
 * and can safely ask the operator to open the governed review flow.
 */
function errorText(error: unknown) {
  return error instanceof Error
    ? publicAgentSummary(error.message, "接口请求失败，请查看受权限保护的审计详情。")
    : "接口请求失败，请查看受权限保护的审计详情。";
}

/**
 * Show a catalog endpoint only as a path template, never as a resolved tool
 * call.  Runtime values in a URL can disclose task/session identifiers or be
 * combined with a mistakenly returned query string containing credentials;
 * replacing placeholders and rejecting non-relative paths keeps the catalog
 * useful without turning it into another tool-argument viewer.
 */
function visibleToolEndpoint(endpoint: unknown): string | undefined {
  if (typeof endpoint !== "string") return undefined;
  const template = endpoint.split("?", 1)[0].replace(/\{[^}]+\}/g, ":value");
  return template.startsWith("/") && /^[A-Za-z0-9_./:-]{1,240}$/.test(template)
    ? template
    : undefined;
}

/**
 * Fail closed for console-side mutations when the current role is meant to
 * observe Agent activity only.  The backend remains authoritative, but this
 * local guard prevents an auditor or an unrecognized future role from sending
 * a write request after navigating directly to `/agent` instead of using the
 * menu.  Keeping the check in the mutation as well as the disabled button
 * protects keyboard shortcuts and future call sites.
 */
function requireAgentConsoleManagement(canManageAgent: boolean) {
  if (!canManageAgent) {
    throw new Error("当前角色仅可查看 Agent 审计与运行状态，不能创建会话、计划或运行。");
  }
}

function requireCurrentAgentProject(projectId: unknown, currentProjectId?: number) {
  if (!isCurrentProject(projectId, currentProjectId)) {
    throw new Error("当前项目上下文已变化，请重新选择项目后再提交 Agent 操作。");
  }
}

function modeTag(value?: string) {
  const mode = value || "UNKNOWN";
  const color =
    mode.includes("APPROVAL") || mode.includes("HUMAN")
      ? "orange"
      : mode.includes("ASYNC")
        ? "purple"
        : mode.includes("DRAFT")
          ? "cyan"
          : "blue";
  return <Tag color={color}>{labelOf(mode, executionModeLabels)}</Tag>;
}

function statusTag(value?: string) {
  const state = value || "UNKNOWN";
  return <Tag color={runStateColor[state] ?? "default"}>{labelOf(state, statusLabels)}</Tag>;
}

function workloadToPython(value?: string) {
  const map: Record<string, string> = {
    AGENT_REASONING: "agent_reasoning",
    GOVERNANCE_QA: "governance_qa",
    CODE_GENERATION: "code_generation",
    EMBEDDING: "embedding",
    RERANK: "rerank",
  };
  return map[value || "AGENT_REASONING"] ?? "agent_reasoning";
}

function inferToolType(tool: AgentTool) {
  if (tool.toolType) return tool.toolType;
  if (tool.toolCode.includes("datasource")) return "DATASOURCE_METADATA";
  if (tool.toolCode.includes("quality")) return "DATA_QUALITY";
  if (tool.toolCode.includes("sync")) return "DATA_SYNC";
  if (tool.toolCode.includes("task")) return "TASK_MANAGEMENT";
  if (tool.toolCode.includes("rag") || tool.toolCode.includes("knowledge")) return "KNOWLEDGE_RETRIEVAL";
  return "READONLY_ANALYTICS";
}

function buildToolBindings(tools: AgentTool[], selectedCodes: string[] = []): BindAgentToolPayload[] {
  return selectedCodes
    .map((toolCode) => tools.find((tool) => tool.toolCode === toolCode))
    .filter((tool): tool is AgentTool => Boolean(tool))
    .map((tool) => ({
      toolCode: tool.toolCode,
      toolType: inferToolType(tool),
      displayName: tool.displayName,
      targetService: tool.targetService,
      readOnly: tool.readOnly,
      allowedActions: tool.allowedActions ?? [],
    }));
}

/**
 * Reduce a newly generated plan to the public facts appropriate for the
 * console.  The model response and next actions are free-form transport data,
 * so they are treated as summaries rather than trusted HTML or raw model
 * output; unsafe values degrade to an explanatory product message.
 */
function planSummary(planResult?: AgentPlanResponse) {
  const plan = planResult?.plan;
  return {
    requestId: plan?.requestId || "-",
    summary: publicAgentSummary(plan?.responseSummary, "暂无可公开的计划摘要。"),
    requiresHumanApproval: plan?.requiresHumanApproval ?? false,
    toolCount: plan?.toolPlans.length ?? 0,
    nextActions: (plan?.nextActions ?? [])
      .map((action) => publicAgentSummary(action, "Agent 已记录一个受控后续步骤。")),
  };
}

function selectedRunFromSession(session?: AgentSession, runId?: string) {
  if (!session?.runs.length) return undefined;
  return session.runs.find((run) => run.runId === runId) ?? session.runs[0];
}

/**
 * Render an administrative diagnostic payload through an explicit presentation
 * category.
 *
 * Most diagnostics contain operational counters that are useful to an
 * auditor, while model summaries and orchestration checkpoints can contain a
 * provider response or internal state.  Callers therefore supply the same
 * field category used by the shared sanitizer instead of relying on a generic
 * JSON block to guess the trust level of a whole backend payload.
 */
function DiagnosticsBlock({
  title,
  data,
  error,
  loading,
  fieldKey = "diagnostic",
}: {
  title: string;
  data?: unknown;
  error?: unknown;
  loading?: boolean;
  fieldKey?: string;
}) {
  return (
    <div className="timeline-item">
      <div className="split-row" style={{ marginBottom: 10 }}>
        <Typography.Text strong>{title}</Typography.Text>
        {loading ? <Tag color="processing">加载中</Tag> : error ? <Tag color="error">异常</Tag> : <Tag color="success">已返回</Tag>}
      </div>
      {error ? <Alert showIcon type="error" message={errorText(error)} /> : jsonBlock(data, 320, fieldKey)}
    </div>
  );
}

/**
 * Reduce a runtime event to the public status line that belongs on an
 * administrative timeline.
 *
 * Runtime events are transport diagnostics and may be produced by the model
 * gateway, a connector, or an asynchronous worker.  Their title and detail
 * must therefore be treated as untrusted free text: an event can explain that
 * work happened, but it cannot turn the console into a viewer for prompts,
 * connection strings, SQL, or raw model completions.
 */
function publicRuntimeEvent(event: RuntimeEvent) {
  return {
    title: publicAgentSummary(event.title, "已记录受控运行事件。"),
    detail: publicAgentSummary(event.detail, "内部事件详情已安全隐藏。"),
  };
}

const runtimeEventStatusLabels: Record<RuntimeEventSocketStatus, string> = {
  idle: "未连接",
  connecting: "连接中",
  open: "实时连接",
  reconnecting: "等待重连",
  replay: "REST 回放",
  closed: "已关闭",
  error: "连接异常",
};

const runtimeEventStatusColors: Record<RuntimeEventSocketStatus, string> = {
  idle: "default",
  connecting: "processing",
  open: "success",
  reconnecting: "warning",
  replay: "processing",
  closed: "default",
  error: "error",
};

export function AgentConsole() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const selectedProjectId = useUiStore((state) => state.selectedProjectId);
  const projectOptions = useUiStore((state) => state.projectOptions);
  const authActorRole = useAuthStore((state) => state.user?.actorRole ?? "");
  const runtimeEventClientId = `agent-console-${useId()}`;
  const projectScopeId = projectScopeIdOf(selectedProjectId);
  const projectScopeReady = projectScopeId != null;
  const [agentForm] = Form.useForm<AgentConsoleFormValues>();
  const [ragForm] = Form.useForm<RagFormValues>();
  const [activeSessionId, setActiveSessionId] = useState<string>();
  const [activeRunId, setActiveRunId] = useState<string>();
  const [activeTab, setActiveTab] = useState("session-plan");
  const [liveEvents, setLiveEvents] = useState<AgentRuntimeEventProjection[]>([]);
  const [runtimeEventSocketStatus, setRuntimeEventSocketStatus] = useState<RuntimeEventSocketStatus>("idle");
  const projectGenerationRef = useRef(0);

  const gatewaySessionQuery = useQuery({
    queryKey: ["agent-gateway-session", projectScopeId],
    queryFn: api.getSession,
  });
  const toolsQuery = useQuery({
    queryKey: ["agent-tools", projectScopeId],
    queryFn: api.listAgentTools,
    enabled: projectScopeReady,
  });
  // 管理控制台使用 API 的默认活跃会话范围；用户历史页另行传 archived 参数切换归档分区。
  const sessionsQuery = useQuery({
    queryKey: ["agent-sessions", projectScopeId],
    queryFn: () => api.listAgentSessions({ projectId: projectScopeId }),
    enabled: projectScopeReady,
  });
  const routesQuery = useQuery({
    queryKey: ["agent-model-routes", projectScopeId],
    queryFn: api.listAgentModelRoutes,
    enabled: projectScopeReady,
  });
  const eventsQuery = useQuery({
    queryKey: ["runtime-events", projectScopeId],
    queryFn: () => replayAgentRuntimeEvents({
      clientId: runtimeEventClientId,
      tenantId: numeric(gatewaySessionQuery.data?.data.tenantId),
      projectId: projectScopeId!,
      actorId: numeric(gatewaySessionQuery.data?.data.actorId),
      roles: gatewaySessionQuery.data?.data.actorRole ? [gatewaySessionQuery.data.data.actorRole] : [],
      includeSnapshot: true,
    }),
    enabled: projectScopeReady,
  });
  const ragDiagnosticsQuery = useQuery({
    queryKey: ["agent-rag-diagnostics", projectScopeId],
    queryFn: api.getAgentRagDiagnostics,
    enabled: projectScopeReady,
  });
  const runtimeDiagnosticsQuery = useQuery({
    queryKey: ["agent-runtime-diagnostics", projectScopeId],
    queryFn: api.getAgentRuntimeDiagnostics,
    enabled: projectScopeReady,
  });
  const skillDiagnosticsQuery = useQuery({
    queryKey: ["agent-skill-diagnostics", projectScopeId],
    queryFn: api.getAgentSkillVisibilityDiagnostics,
    enabled: projectScopeReady,
  });
  const providerDiagnosticsQuery = useQuery({
    queryKey: ["agent-provider-health-diagnostics", projectScopeId],
    queryFn: api.getAgentProviderHealthDiagnostics,
    enabled: projectScopeReady,
  });
  const capabilityDiagnosticsQuery = useQuery({
    queryKey: ["agent-capability-diagnostics", projectScopeId],
    queryFn: api.getAgentCapabilityDiagnostics,
    enabled: projectScopeReady,
  });
  const asyncOutboxDiagnosticsQuery = useQuery({
    queryKey: ["agent-async-outbox-diagnostics", projectScopeId],
    queryFn: api.getAgentAsyncCommandOutboxDiagnostics,
    enabled: projectScopeReady,
  });
  const eventOutboxDiagnosticsQuery = useQuery({
    queryKey: ["agent-event-outbox-diagnostics", projectScopeId],
    queryFn: api.getAgentToolEventOutboxDiagnostics,
    enabled: projectScopeReady,
  });

  /*
   * The gateway session wins over the cached browser profile because roles can
   * change while a user keeps the console open.  Falling back to the profile
   * avoids a brief false read-only flash during bootstrap, but a refreshed
   * gateway response immediately controls which mutations are enabled.
   */
  const actorRole = String(gatewaySessionQuery.data?.data.actorRole ?? authActorRole).trim().toUpperCase();
  const canManageAgent = ["OPERATOR", "TENANT_ADMINISTRATOR", "PLATFORM_ADMINISTRATOR"].includes(actorRole);

  const sessions = useMemo(
    () => (sessionsQuery.data?.data ?? []).filter((session) => isCurrentProject(session.projectId, projectScopeId)),
    [projectScopeId, sessionsQuery.data?.data],
  );
  const tools = useMemo(() => toolsQuery.data?.data ?? [], [toolsQuery.data?.data]);
  const enabledTools = tools.filter((tool) => tool.enabled);
  const routes = routesQuery.data?.data ?? [];
  const events = useMemo(
    () => mergeRuntimeEvents(
      (eventsQuery.data?.data.records ?? []).filter((event) => isCurrentProject(event.projectId, projectScopeId)),
      liveEvents.filter((event) => isCurrentProject(event.projectId, projectScopeId)),
    ),
    [eventsQuery.data?.data.records, liveEvents, projectScopeId],
  );
  const activeSession = sessions.find((session) => session.sessionId === activeSessionId);
  const activeRun = selectedRunFromSession(activeSession, activeRunId);
  const projectSelectOptions = useMemo(() => projectOptions.map((project) => ({
    value: Number(project.value),
    label: project.label,
  })).filter((project) => Number.isFinite(project.value)), [projectOptions]);
  const projectNameOf = (projectId?: number) => projectOptions.find(
    (project) => project.value === String(projectId),
  )?.label ?? (projectId == null ? "未选择项目" : "未找到项目名称");
  const ragDefaults = useMemo<RagFormValues>(() => {
    const gatewaySession = gatewaySessionQuery.data?.data;
    const tenantId = numeric(gatewaySession?.tenantId);
    return {
      tenantId,
      projectId: projectScopeId,
      actorId: String(gatewaySession?.actorId ?? ""),
      question: "数据质量规则建议为什么需要人工确认？",
      topK: 5,
      candidateLimit: 32,
      maxContextChars: 4000,
      generateAnswer: true,
    };
  }, [gatewaySessionQuery.data?.data, projectScopeId]);

  const toolExecutionsQuery = useQuery({
    queryKey: ["agent-tool-executions", projectScopeId, activeSession?.sessionId, activeRun?.runId],
    queryFn: () => api.listAgentToolExecutions(activeSession!.sessionId, activeRun!.runId),
    enabled: Boolean(projectScopeReady && activeSession?.sessionId && activeRun?.runId),
  });
  const executionPolicyQuery = useQuery({
    queryKey: ["agent-tool-execution-policy", projectScopeId, activeSession?.sessionId, activeRun?.runId],
    queryFn: () => api.getAgentToolExecutionPolicy(activeSession!.sessionId, activeRun!.runId),
    enabled: Boolean(projectScopeReady && activeSession?.sessionId && activeRun?.runId),
  });
  const dagPlanQuery = useQuery({
    queryKey: ["agent-tool-dag-plan", projectScopeId, activeSession?.sessionId, activeRun?.runId],
    queryFn: () => api.getAgentToolDagPlan(activeSession!.sessionId, activeRun!.runId),
    enabled: Boolean(projectScopeReady && activeSession?.sessionId && activeRun?.runId),
  });
  const asyncPlansQuery = useQuery({
    queryKey: ["agent-async-command-plans", projectScopeId, activeSession?.sessionId, activeRun?.runId],
    queryFn: () => api.getAgentAsyncCommandPlans(activeSession!.sessionId, activeRun!.runId),
    enabled: Boolean(projectScopeReady && activeSession?.sessionId && activeRun?.runId),
  });
  /**
   * Reads immutable, low-sensitive evidence for the selected durable run.
   *
   * This is deliberately separate from live plan data. A historical run can
   * outlive a browser tab and still be audited after reload, while the backend
   * retains responsibility for validating the actor, tenant, project, session,
   * and run scope of this request.
   */
  const specialistFactsQuery = useQuery({
    queryKey: ["agent-specialist-turn-facts", projectScopeId, activeSession?.sessionId, activeRun?.runId],
    queryFn: () => api.listAgentSpecialistTurnFactsByRun(activeRun!.runId),
    enabled: Boolean(projectScopeReady && activeSession?.sessionId && activeRun?.runId),
  });
  const specialistFacts = useMemo<AgentSpecialistTurnFact[]>(
    () => (specialistFactsQuery.data?.data ?? []).filter((fact) => (
      isCurrentProject(fact.projectId, projectScopeId)
      && fact.sessionId === activeSession?.sessionId
      && fact.runId === activeRun?.runId
    )),
    [activeRun?.runId, activeSession?.sessionId, projectScopeId, specialistFactsQuery.data?.data],
  );
  const specialistExecution = useMemo(
    () => specialistExecutionFromDurableFacts(specialistFacts),
    [specialistFacts],
  );
  const toolExecutions = useMemo(
    () => (toolExecutionsQuery.data?.data ?? []).filter((audit) => (
      isCurrentProject(audit.projectId, projectScopeId)
      && audit.sessionId === activeSession?.sessionId
      && audit.runId === activeRun?.runId
    )),
    [activeRun?.runId, activeSession?.sessionId, projectScopeId, toolExecutionsQuery.data?.data],
  );

  useEffect(() => {
    const gatewaySession = gatewaySessionQuery.data?.data;
    if (!gatewaySession) return;
    const defaults = {
      tenantId: numeric(gatewaySession.tenantId),
      projectId: projectScopeId,
      actorId: String(gatewaySession.actorId ?? ""),
      channel: "WEB",
      objective: defaultObjective,
      selectedToolCodes: ["datasource.metadata.read", "quality.rule.suggest", "task.create.draft", "knowledge.rag.query"],
      workloadType: "AGENT_REASONING",
      requireHumanApproval: true,
    };
    agentForm.setFieldsValue(defaults);
  }, [agentForm, gatewaySessionQuery.data?.data, projectScopeId]);

  useEffect(() => {
    if (activeTab === "rag") {
      ragForm.setFieldsValue(ragDefaults);
    }
  }, [activeTab, ragDefaults, ragForm]);

  useEffect(() => {
    if (!activeSessionId && sessions[0]?.sessionId) {
      setActiveSessionId(sessions[0].sessionId);
    }
  }, [activeSessionId, sessions]);

  useEffect(() => {
    if (!activeSession?.runs.some((run) => run.runId === activeRunId)) {
      setActiveRunId(undefined);
    }
  }, [activeRunId, activeSession]);

  const refetchAgentState = async () => {
    if (!projectScopeReady) return;
    await Promise.all([
      sessionsQuery.refetch(),
      toolsQuery.refetch(),
      routesQuery.refetch(),
      eventsQuery.refetch(),
      toolExecutionsQuery.refetch(),
      executionPolicyQuery.refetch(),
      dagPlanQuery.refetch(),
      asyncPlansQuery.refetch(),
      specialistFactsQuery.refetch(),
    ]);
  };

  const createSessionMutation = useMutation({
    mutationFn: async (values: AgentConsoleFormValues) => {
      requireAgentConsoleManagement(canManageAgent);
      requireCurrentAgentProject(values.projectId, projectScopeId);
      const payload = compact<CreateAgentSessionPayload>({
        tenantId: Number(values.tenantId),
        projectId: Number(values.projectId),
        actorId: values.actorId || "",
        channel: values.channel,
        objective: values.objective || defaultObjective,
        isolationLevel: "PROJECT",
        toolBindings: buildToolBindings(tools, values.selectedToolCodes),
      });
      return api.createAgentSession(payload);
    },
    onSuccess: async (result, values) => {
      if (!isCurrentProject(values.projectId, projectScopeId)) return;
      setActiveSessionId(result.data.sessionId);
      message.success("智能体控制面会话已创建");
      await refetchAgentState();
    },
    onError: (error) => message.error(errorText(error)),
  });

  const createPlanMutation = useMutation({
    mutationFn: async (values: AgentConsoleFormValues) => {
      requireAgentConsoleManagement(canManageAgent);
      requireCurrentAgentProject(values.projectId, projectScopeId);
      return api.createAgentPlan({
        tenant_id: String(values.tenantId ?? ""),
        project_id: String(values.projectId ?? ""),
        actor_id: String(values.actorId ?? ""),
        objective: values.objective || defaultObjective,
        preferred_workload: workloadToPython(values.workloadType),
        locale: "zh-CN",
        variables: {
          selectedToolCodes: values.selectedToolCodes ?? [],
          frontendSurface: "AgentConsole",
        },
      });
    },
    onSuccess: async (_, values) => {
      if (!isCurrentProject(values.projectId, projectScopeId)) return;
      message.success("Python 运行时已返回智能体计划");
      await Promise.all([eventsQuery.refetch(), sessionsQuery.refetch()]);
    },
    onError: (error) => message.error(errorText(error)),
  });

  const startRunMutation = useMutation({
    mutationFn: async (values: AgentConsoleFormValues) => {
      requireAgentConsoleManagement(canManageAgent);
      requireCurrentAgentProject(values.projectId, projectScopeId);
      let sessionId = activeSessionId;
      let createdSession: AgentSession | undefined;
      if (!sessionId) {
        const sessionResult = await api.createAgentSession(
          compact<CreateAgentSessionPayload>({
            tenantId: Number(values.tenantId),
            projectId: Number(values.projectId),
            actorId: values.actorId || "",
            channel: values.channel,
            objective: values.objective || defaultObjective,
            isolationLevel: "PROJECT",
            toolBindings: buildToolBindings(tools, values.selectedToolCodes),
          }),
        );
        createdSession = sessionResult.data;
        sessionId = sessionResult.data.sessionId;
      }
      const runPayload = compact<StartAgentRunPayload>({
        userInput: values.objective || defaultObjective,
        workloadType: values.workloadType,
        requireHumanApproval: values.requireHumanApproval,
        variables: {
          selectedToolCodes: values.selectedToolCodes ?? [],
          frontendSurface: "AgentConsole",
        },
      });
      const runResult = await api.startAgentRun(sessionId, runPayload);
      return { session: createdSession, run: runResult.data };
    },
    onSuccess: async (result, values) => {
      if (!isCurrentProject(values.projectId, projectScopeId)) return;
      if (result.session) {
        setActiveSessionId(result.session.sessionId);
      }
      setActiveRunId(result.run.runId);
      message.success("Java 智能体运行记录已创建");
      await refetchAgentState();
    },
    onError: (error) => message.error(errorText(error)),
  });

  const ragQueryMutation = useMutation({
    mutationFn: async (values: RagFormValues) => {
      requireCurrentAgentProject(values.projectId, projectScopeId);
      return api.queryAgentRag({
        tenantId: values.tenantId,
        projectId: values.projectId,
        actorId: values.actorId,
        question: values.question || "",
        topK: values.topK,
        candidateLimit: values.candidateLimit,
        maxContextChars: values.maxContextChars,
        generateAnswer: values.generateAnswer,
        sessionId: activeSession?.sessionId,
      });
    },
    onSuccess: (_, values) => {
      if (isCurrentProject(values.projectId, projectScopeId)) message.success("知识检索查询已返回");
    },
    onError: (error) => message.error(errorText(error)),
  });

  const resetCreatePlanMutation = createPlanMutation.reset;
  const resetRagQueryMutation = ragQueryMutation.reset;

  useEffect(() => {
    projectGenerationRef.current += 1;
    setActiveSessionId(undefined);
    setActiveRunId(undefined);
    setLiveEvents([]);
    resetCreatePlanMutation();
    resetRagQueryMutation();
  }, [projectScopeId, resetCreatePlanMutation, resetRagQueryMutation]);

  useEffect(() => {
    if (!projectScopeId) {
      setRuntimeEventSocketStatus("idle");
      return undefined;
    }
    const generation = projectGenerationRef.current;
    let disposed = false;
    const gatewaySession = gatewaySessionQuery.data?.data;
    const socket = createAgentRuntimeEventSocket({
      clientId: runtimeEventClientId,
      tenantId: gatewaySession?.tenantId,
      projectId: projectScopeId,
      actorId: gatewaySession?.actorId,
      roles: [actorRole].filter(Boolean),
      includeSnapshot: true,
      accessTokenProvider: () => ensureApiAccessToken({ minValidSeconds: 60 }),
      onStatus: (status) => {
        if (!disposed && generation === projectGenerationRef.current) setRuntimeEventSocketStatus(status);
      },
      onEvents: (incoming) => {
        if (disposed || generation !== projectGenerationRef.current) return;
        const scoped = incoming.filter((event) => isCurrentProject(event.projectId, projectScopeId));
        if (scoped.length) setLiveEvents((current) => mergeRuntimeEvents(current, scoped));
      },
      onError: () => {
        if (!disposed && generation === projectGenerationRef.current) setRuntimeEventSocketStatus("error");
      },
      onInvalidate: () => {
        if (disposed || generation !== projectGenerationRef.current) return;
        void queryClient.invalidateQueries({ queryKey: ["runtime-events", projectScopeId] });
      },
    });
    return () => {
      disposed = true;
      socket.close("project_changed_or_unmount");
    };
  }, [
    actorRole,
    gatewaySessionQuery.data?.data,
    projectScopeId,
    queryClient,
    runtimeEventClientId,
  ]);

  const toolOptions = useMemo(
    () =>
      enabledTools.map((tool) => ({
        value: tool.toolCode,
        label: `${tool.displayName}（${tool.toolCode}）`,
      })),
    [enabledTools],
  );

  const sessionColumns: ColumnsType<AgentSession> = [
    {
      title: "会话",
      dataIndex: "objective",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>受控 Agent 会话</Typography.Text>
          <Typography.Text className="mono" type="secondary">
            {record.sessionId}
          </Typography.Text>
        </Space>
      ),
    },
    { title: "状态", dataIndex: "state", render: statusTag },
    { title: "所属项目", render: (_, record) => projectNameOf(record.projectId) },
    { title: "操作者", dataIndex: "actorId" },
    { title: "工具", render: (_, record) => record.toolBindings.length },
    {
      title: "操作",
      render: (_, record) => (
        <Button size="small" onClick={() => setActiveSessionId(record.sessionId)}>
          选中
        </Button>
      ),
    },
  ];

  const runColumns: ColumnsType<AgentRun> = [
    {
      title: "运行记录",
      dataIndex: "runId",
      render: (value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text className="mono">{value}</Typography.Text>
          <Typography.Text type="secondary">
            {publicAgentSummary(record.message, "已记录受控运行状态；用户输入与模型上下文不会在此展示。")}
          </Typography.Text>
        </Space>
      ),
    },
    { title: "状态", dataIndex: "state", render: statusTag },
    { title: "任务类型", dataIndex: "workloadType", render: (value) => labelOf(value, agentWorkloadLabels) },
    { title: "人工确认", dataIndex: "requireHumanApproval", render: (value) => <BooleanTag value={Boolean(value)} trueLabel="需要" falseLabel="不需要" /> },
    { title: "创建时间", dataIndex: "createTime", render: (value) => formatDateTime(value) },
    {
      title: "操作",
      render: (_, record) => (
        <Button size="small" onClick={() => {
          setActiveRunId(record.runId);
          setActiveTab("specialist-audit");
        }}>
          查看工具审计
        </Button>
      ),
    },
  ];

  const toolColumns: ColumnsType<AgentTool> = [
    {
      title: "工具",
      dataIndex: "displayName",
      render: (value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{value}</Typography.Text>
          <Typography.Text className="mono" type="secondary">
            {record.toolCode}
          </Typography.Text>
        </Space>
      ),
    },
    { title: "类型", dataIndex: "toolType", render: (_, record) => <Tag>{labelOf(inferToolType(record), agentToolTypeLabels)}</Tag> },
    {
      title: "目标",
      render: (_, record) => {
        const endpoint = visibleToolEndpoint(record.targetEndpoint);
        return (
          <Space direction="vertical" size={0}>
            <Tag>{record.targetService}</Tag>
            {endpoint ? <Typography.Text className="mono" type="secondary">{endpoint}</Typography.Text> : null}
          </Space>
        );
      },
    },
    { title: "风险", dataIndex: "riskLevel", render: (value) => <RiskTag value={value} /> },
    { title: "模式", dataIndex: "executionMode", render: modeTag },
    {
      title: "治理",
      render: (_, record) => (
        <Space wrap>
          {record.readOnly ? <Tag color="green">只读</Tag> : <Tag color="orange">写入候选</Tag>}
          {record.requiresApproval ? <Tag color="gold">需审批</Tag> : <Tag>无需审批</Tag>}
          {record.idempotent ? <Tag>幂等</Tag> : null}
        </Space>
      ),
    },
    { title: "状态", dataIndex: "enabled", render: (value) => <BooleanTag value={Boolean(value)} /> },
  ];

  const routeColumns: ColumnsType<AgentModelRoute> = [
    { title: "任务类型", dataIndex: "workloadType", render: (value) => labelOf(value, agentWorkloadLabels) },
    { title: "模型服务", dataIndex: "providerName" },
    { title: "类型", dataIndex: "providerType", render: (value) => <Tag>{labelOf(value, providerTypeLabels)}</Tag> },
    { title: "模型", dataIndex: "modelName" },
    { title: "超时", dataIndex: "timeoutMs", render: (value) => (value ? `${value} ms` : "-") },
    { title: "状态", dataIndex: "enabled", render: (value) => <BooleanTag value={Boolean(value)} /> },
  ];

  const planToolColumns: ColumnsType<AgentToolPlan> = [
    { title: "工具", dataIndex: "toolName", render: (value) => <Typography.Text className="mono">{value}</Typography.Text> },
    { title: "风险", dataIndex: "riskLevel", render: (value) => <RiskTag value={value} /> },
    { title: "模式", dataIndex: "executionMode", render: modeTag },
    { title: "人工确认", dataIndex: "requiresHumanApproval", render: (value) => <BooleanTag value={Boolean(value)} trueLabel="需要" falseLabel="不需要" /> },
    {
      title: "原因",
      dataIndex: "reason",
      render: (value) => publicAgentSummary(value, "已记录受控工具决策原因。"),
    },
  ];

  const auditColumns: ColumnsType<AgentToolExecutionAudit> = [
    {
      title: "审计记录",
      dataIndex: "auditId",
      render: (value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text className="mono">{value}</Typography.Text>
          <Typography.Text type="secondary">
            {publicAgentSummary(record.message || record.planReason, "已记录受控工具审计状态。")}
          </Typography.Text>
        </Space>
      ),
    },
    { title: "工具", dataIndex: "toolCode", render: (value) => <Typography.Text className="mono">{value}</Typography.Text> },
    { title: "状态", dataIndex: "state", render: statusTag },
    { title: "风险", dataIndex: "riskLevel", render: (value) => <RiskTag value={value} /> },
    { title: "模式", dataIndex: "executionMode", render: modeTag },
    { title: "审批", dataIndex: "requiresApproval", render: (value) => <BooleanTag value={Boolean(value)} trueLabel="需要" falseLabel="不需要" /> },
  ];

  const currentPlanResult = createPlanMutation.variables && isCurrentProject(createPlanMutation.variables.projectId, projectScopeId)
    ? createPlanMutation.data?.data
    : undefined;
  const plan = planSummary(currentPlanResult);
  const ragResult = ragQueryMutation.variables && isCurrentProject(ragQueryMutation.variables.projectId, projectScopeId)
    ? ragQueryMutation.data?.data as AgentRagQueryResult | undefined
    : undefined;

  return (
    <div className="page-stack">
      <PageHeader
        title="智能体助手与知识检索"
        subtitle="智能体会话、计划生成、知识检索、工具治理和运行诊断"
        actions={
          <>
            <DataSourceIndicator meta={toolsQuery.data?.meta ?? sessionsQuery.data?.meta ?? routesQuery.data?.meta} />
            <Button aria-label="刷新智能体数据" title="刷新智能体数据" icon={<ReloadOutlined />} onClick={refetchAgentState} />
          </>
        }
      />

      <Alert
        showIcon
        type="warning"
        message="真实能力边界"
        description="Java 智能体运行时已接入会话、运行记录、工具目录、模型路由、工具审计、执行图/策略预检和异步消息诊断；Python 运行时已接入智能体计划、LangGraph 规划视图、知识检索查询和低敏诊断。当前页面不会把试运行、诊断或执行前预检包装成已经完成真实自治执行。"
      />

      {!canManageAgent ? (
        <Alert
          showIcon
          type="info"
          message="当前角色为只读审计"
          description="可以查看已脱敏的会话、运行、工具和诊断信息；创建控制面会话、生成计划和启动运行已禁用。实际接口仍会由后端再次校验权限。"
        />
      ) : null}

      <div className="grid grid-three">
        <Card className="compact-card">
          <div className="split-row">
            <Typography.Text type="secondary">控制面会话</Typography.Text>
            <RobotOutlined style={{ color: "#2563eb" }} />
          </div>
          <div className="metric-value">{sessions.length}</div>
          <div className="metric-delta">{activeSession?.sessionId || "暂无选中会话"}</div>
        </Card>
        <Card className="compact-card">
          <div className="split-row">
            <Typography.Text type="secondary">启用工具</Typography.Text>
            <ToolOutlined style={{ color: "#0f9f6e" }} />
          </div>
          <div className="metric-value">{enabledTools.length}</div>
          <div className="metric-delta">{tools.length} 个工具已登记</div>
        </Card>
        <Card className="compact-card">
          <div className="split-row">
            <Typography.Text type="secondary">运行事件</Typography.Text>
            <DeploymentUnitOutlined style={{ color: "#d97706" }} />
          </div>
          <div className="metric-value">{events.length}</div>
          <div className="metric-delta">{runtimeDiagnosticsQuery.data?.meta.traceId || "运行事件投影"}</div>
        </Card>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: "session-plan",
            label: "会话与计划",
            children: (
              <div className="page-stack">
                <div className="grid grid-two">
                  <Card className="compact-card" title="会话输入">
                    <Form<AgentConsoleFormValues> form={agentForm} layout="vertical">
                      <div className="grid grid-two-form">
                        <Form.Item name="tenantId" label="当前租户" rules={[{ required: true, message: "缺少登录租户上下文" }]}>
                          <InputNumber min={1} disabled style={{ width: "100%" }} />
                        </Form.Item>
                        <Form.Item name="projectId" label="所属项目" rules={[{ required: true, message: "请选择项目" }]}>
                          <Select showSearch optionFilterProp="label" options={projectSelectOptions} placeholder="选择项目" />
                        </Form.Item>
                      </div>
                      <div className="grid grid-two-form">
                        <Form.Item name="actorId" label="操作者" rules={[{ required: true, message: "请输入操作者" }]}>
                          <Input disabled />
                        </Form.Item>
                        <Form.Item name="channel" label="渠道">
                          <Select options={[{ value: "WEB", label: "网页控制台" }, { value: "API", label: "接口调用" }, { value: "SYSTEM", label: "系统内部" }]} />
                        </Form.Item>
                      </div>
                      <Form.Item name="objective" label="治理目标" rules={[{ required: true, message: "请输入治理目标" }]}>
                        <TextArea rows={4} />
                      </Form.Item>
                      <Form.Item name="selectedToolCodes" label="绑定工具">
                        <Select mode="multiple" options={toolOptions} loading={toolsQuery.isLoading} />
                      </Form.Item>
                      <div className="grid grid-two-form">
                        <Form.Item name="workloadType" label="任务类型">
                          <Select
                            options={optionsOf(["AGENT_REASONING", "GOVERNANCE_QA", "CODE_GENERATION"], agentWorkloadLabels)}
                          />
                        </Form.Item>
                        <Form.Item name="requireHumanApproval" label="默认人工确认" valuePropName="checked">
                          <Checkbox>需要人工确认</Checkbox>
                        </Form.Item>
                      </div>
                      <Space wrap>
                        <Button
                          icon={<RobotOutlined />}
                          loading={createSessionMutation.isPending}
                          disabled={!canManageAgent}
                          onClick={() => agentForm.validateFields().then((values) => createSessionMutation.mutate(values))}
                        >
                          创建控制面会话
                        </Button>
                        <Button
                          type="primary"
                          icon={<BranchesOutlined />}
                          loading={createPlanMutation.isPending}
                          disabled={!canManageAgent}
                          onClick={() => agentForm.validateFields().then((values) => createPlanMutation.mutate(values))}
                        >
                          生成智能体计划
                        </Button>
                        <Button
                          icon={<PlayCircleOutlined />}
                          loading={startRunMutation.isPending}
                          disabled={!canManageAgent}
                          onClick={() => agentForm.validateFields().then((values) => startRunMutation.mutate(values))}
                        >
                          启动智能体运行
                        </Button>
                      </Space>
                    </Form>
                  </Card>

                  <Card className="compact-card" title="当前控制面">
                    {activeSession ? (
                      <Space direction="vertical" size={14} style={{ width: "100%" }}>
                        <Descriptions size="small" bordered column={1}>
                          <Descriptions.Item label="会话编号">
                            <Typography.Text className="mono">{activeSession.sessionId}</Typography.Text>
                          </Descriptions.Item>
                          <Descriptions.Item label="状态">{statusTag(activeSession.state)}</Descriptions.Item>
                          <Descriptions.Item label="运行记录">
                            {activeRun ? <Typography.Text className="mono">{activeRun.runId}</Typography.Text> : "-"}
                          </Descriptions.Item>
                          <Descriptions.Item label="工具绑定">{activeSession.toolBindings.length}</Descriptions.Item>
                        </Descriptions>
                        <div className="timeline-item">
                          <Space>
                            <WarningOutlined style={{ color: "#d97706" }} />
                            <Typography.Text>真实副作用仍由审批、策略预检、异步消息箱、执行回执和权限门禁继续约束。</Typography.Text>
                          </Space>
                        </div>
                        <div className="timeline-item">
                          <Space>
                            <CheckCircleOutlined style={{ color: "#0f9f6e" }} />
                            <Typography.Text>低风险只读工具可进入执行候选，高风险或写入型工具会停在人工确认语义。</Typography.Text>
                          </Space>
                        </div>
                      </Space>
                    ) : (
                      <RealEmpty meta={sessionsQuery.data?.meta} description="暂无智能体会话" />
                    )}
                  </Card>
                </div>

                {currentPlanResult ? (
                  <Card className="table-card" title="智能体计划">
                    <div style={{ padding: 16 }}>
                      <Space direction="vertical" size={14} style={{ width: "100%" }}>
                        <Descriptions size="small" bordered column={3}>
                          <Descriptions.Item label="请求编号">
                            <Typography.Text className="mono">{plan.requestId}</Typography.Text>
                          </Descriptions.Item>
                          <Descriptions.Item label="工具数">{plan.toolCount}</Descriptions.Item>
                          <Descriptions.Item label="人工确认">
                            <BooleanTag value={plan.requiresHumanApproval} trueLabel="需要" falseLabel="不需要" />
                          </Descriptions.Item>
                        </Descriptions>
                        <Typography.Paragraph style={{ marginBottom: 0 }}>{plan.summary}</Typography.Paragraph>
                        {plan.nextActions.length ? (
                          <List
                            size="small"
                            dataSource={plan.nextActions}
                            pagination={defaultListPagination(8)}
                            renderItem={(item) => (
                              <List.Item>
                                <Space>
                                  <ClockCircleOutlined style={{ color: "#d97706" }} />
                                  <Typography.Text>{item}</Typography.Text>
                                </Space>
                              </List.Item>
                            )}
                          />
                        ) : null}
                        <Table
                          rowKey="toolName"
                          size="middle"
                          columns={planToolColumns}
                           dataSource={currentPlanResult?.plan?.toolPlans ?? []}
                          pagination={defaultTablePagination(8)}
                        />
                      </Space>
                    </div>
                  </Card>
                ) : null}

                <div className="grid grid-two">
                  <Card className="table-card" title="会话列表">
                    <Table
                      rowKey="sessionId"
                      columns={sessionColumns}
                      dataSource={sortByIdDesc(sessions)}
                      loading={sessionsQuery.isLoading}
                      locale={{ emptyText: <RealEmpty meta={sessionsQuery.data?.meta} description="暂无智能体会话" /> }}
                      pagination={defaultTablePagination(6)}
                    />
                  </Card>
                  <Card className="table-card" title="运行记录历史">
                    <Table
                      rowKey="runId"
                      columns={runColumns}
                      dataSource={sortByIdDesc(activeSession?.runs)}
                      locale={{ emptyText: <RealEmpty meta={sessionsQuery.data?.meta} description="暂无运行记录" /> }}
                      pagination={defaultTablePagination(6)}
                    />
                  </Card>
                </div>
              </div>
            ),
          },
          {
            key: "specialist-audit",
            label: "Specialist 审计",
            children: (
              <div className="page-stack">
                <Alert
                  showIcon
                  type="info"
                  message="持久化 Specialist 事实审计"
                  description="展示当前运行记录的六类 Specialist 状态、失败摘要、RAG/证据引用、恢复审批等待和运行监控结果。审批和补参必须回到用户协作会话完成，本页面不会绕过治理边界。"
                />
                {activeSession && activeRun ? (
                  <Descriptions size="small" bordered column={{ xs: 1, sm: 2 }}>
                    <Descriptions.Item label="会话"><Typography.Text className="mono">{activeSession.sessionId}</Typography.Text></Descriptions.Item>
                    <Descriptions.Item label="运行记录"><Typography.Text className="mono">{activeRun.runId}</Typography.Text></Descriptions.Item>
                    <Descriptions.Item label="运行状态">{statusTag(activeRun.state)}</Descriptions.Item>
                    <Descriptions.Item label="事实数量">{specialistFacts.length}</Descriptions.Item>
                  </Descriptions>
                ) : (
                  <RealEmpty meta={sessionsQuery.data?.meta} description="请先在会话与运行记录中选择一条 Agent 运行。" />
                )}
                {specialistFactsQuery.isError ? (
                  <Alert showIcon type="error" message="无法读取 Specialist 持久化事实" description={errorText(specialistFactsQuery.error)} />
                ) : null}
                {activeRun ? (
                  <SpecialistAgentExecutionPanel
                    specialistAgentExecution={specialistExecution}
                    loading={specialistFactsQuery.isLoading || specialistFactsQuery.isFetching}
                    title="六类 Specialist 执行与事实"
                  />
                ) : null}
                {specialistFacts.length ? (
                  <Card className="table-card" title="持久化事实记录">
                    <Table
                      rowKey={(record) => `${record.runId}-${record.role}-${record.agentId}-${record.turnId}`}
                      size="middle"
                      dataSource={specialistFacts}
                      columns={[
                        { title: "Specialist", dataIndex: "role", render: (value) => <Tag>{value}</Tag> },
                        { title: "状态", dataIndex: "status", render: statusTag },
                        { title: "处理摘要", dataIndex: "lowSensitiveSummary", render: (value) => publicAgentSummary(value, "未返回可公开摘要") },
                        { title: "模型", dataIndex: "modelName", render: (value) => value || "-" },
                        { title: "RAG/证据", dataIndex: "evidenceRefs", render: (value: string[]) => value?.length ?? 0 },
                        { title: "耗时", dataIndex: "durationMillis", render: (value) => value == null ? "-" : `${value} ms` },
                        { title: "完成时间", dataIndex: "finishedAt", render: formatDateTime },
                      ]}
                      pagination={defaultTablePagination(10)}
                    />
                  </Card>
                ) : null}
              </div>
            ),
          },
          {
            key: "tool-audit",
            label: "工具审计",
            children: (
              <div className="page-stack">
                <Card className="table-card" title="运行记录的工具执行审计">
                  <Table
                    rowKey="auditId"
                    columns={auditColumns}
                    dataSource={sortByIdDesc(toolExecutions)}
                    loading={toolExecutionsQuery.isLoading}
                    expandable={{
                      expandedRowRender: (record) => (
                        <div className="grid grid-two-form">
                          <div>{jsonBlock(record.planArguments, 220, "toolArguments")}</div>
                          <div>{jsonBlock(record.governanceHints, 220, "governanceHints")}</div>
                        </div>
                      ),
                    }}
                    locale={{ emptyText: <RealEmpty meta={toolExecutionsQuery.data?.meta} description="暂无工具审计记录" /> }}
                    pagination={defaultTablePagination(8)}
                  />
                </Card>
                <div className="grid grid-three">
                  <DiagnosticsBlock title="执行策略预检" data={executionPolicyQuery.data?.data} error={executionPolicyQuery.error} loading={executionPolicyQuery.isLoading} />
                  <DiagnosticsBlock title="工具执行图" data={dagPlanQuery.data?.data} error={dagPlanQuery.error} loading={dagPlanQuery.isLoading} />
                  <DiagnosticsBlock title="异步命令草案" data={asyncPlansQuery.data?.data} error={asyncPlansQuery.error} loading={asyncPlansQuery.isLoading} />
                </div>
              </div>
            ),
          },
          {
            key: "rag",
            label: "知识检索",
            children: (
              <div className="page-stack">
                <div className="grid grid-two">
                  <Card className="compact-card" title="治理知识查询">
                    <Form<RagFormValues> form={ragForm} layout="vertical" initialValues={ragDefaults}>
                      <div className="grid grid-three">
                        <Form.Item name="tenantId" label="当前租户">
                          <InputNumber min={1} disabled style={{ width: "100%" }} />
                        </Form.Item>
                        <Form.Item name="projectId" label="所属项目">
                          <Select showSearch optionFilterProp="label" options={projectSelectOptions} placeholder="选择项目" />
                        </Form.Item>
                        <Form.Item name="actorId" label="操作者">
                          <Input disabled />
                        </Form.Item>
                      </div>
                      <Form.Item name="question" label="问题" rules={[{ required: true, message: "请输入知识检索问题" }]}>
                        <TextArea rows={4} />
                      </Form.Item>
                      <div className="grid grid-three">
                        <Form.Item name="topK" label="返回片段数">
                          <InputNumber min={1} max={20} style={{ width: "100%" }} />
                        </Form.Item>
                        <Form.Item name="candidateLimit" label="候选上限">
                          <InputNumber min={1} max={100} style={{ width: "100%" }} />
                        </Form.Item>
                        <Form.Item name="maxContextChars" label="上下文字符">
                          <InputNumber min={500} max={12000} step={500} style={{ width: "100%" }} />
                        </Form.Item>
                      </div>
                      <Form.Item name="generateAnswer" valuePropName="checked">
                        <Checkbox>生成回答</Checkbox>
                      </Form.Item>
                      <Button
                        type="primary"
                        icon={<SearchOutlined />}
                        loading={ragQueryMutation.isPending}
                        onClick={() => ragForm.validateFields().then((values) => ragQueryMutation.mutate(values))}
                      >
                        查询知识库
                      </Button>
                    </Form>
                  </Card>
                  <Card className="compact-card" title="知识检索结果">
                    {ragResult ? (
                      <Space direction="vertical" size={14} style={{ width: "100%" }}>
                        <Typography.Paragraph style={{ marginBottom: 0 }}>
                          {ragResult.answer
                            ? "已生成受控知识检索回答；模型原始回答不会在管理控制台展示。"
                            : "本次检索未生成可展示的公开回答。"}
                        </Typography.Paragraph>
                        <Descriptions size="small" bordered column={1}>
                          <Descriptions.Item label="引用数">{ragResult.citations?.length ?? 0}</Descriptions.Item>
                          <Descriptions.Item label="选中片段">{ragResult.selectedChunks?.length ?? 0}</Descriptions.Item>
                        </Descriptions>
                        {ragResult.citations?.length ? (
                          <Typography.Text type="secondary">
                            引用来源会在通过资源权限校验的协作会话中展示；管理控制台仅保留计数。
                          </Typography.Text>
                        ) : null}
                      </Space>
                    ) : (
                      <RealEmpty meta={ragDiagnosticsQuery.data?.meta} description="暂无知识检索结果" />
                    )}
                  </Card>
                </div>
                {ragResult ? (
                  <div className="grid grid-three">
                    <DiagnosticsBlock title="检索摘要" data={ragResult.retrievalSummary} fieldKey="ragDiagnostic" />
                    <DiagnosticsBlock title="模型摘要" data={ragResult.modelSummary} fieldKey="modelOutput" />
                    <DiagnosticsBlock title="LangGraph 断点" data={ragResult.langGraphCheckpoint} fieldKey="internal" />
                  </div>
                ) : null}
              </div>
            ),
          },
          {
            key: "tools-models",
            label: "工具与模型",
            children: (
              <div className="page-stack">
                <div className="grid grid-two">
                  <Card className="table-card" title="工具目录">
                    <Table
                      rowKey="toolCode"
                      columns={toolColumns}
                      dataSource={sortByIdDesc(tools)}
                      loading={toolsQuery.isLoading}
                      expandable={{
                        expandedRowRender: (record) => (
                          <div className="page-stack" style={{ padding: 12 }}>
                            <Typography.Paragraph style={{ marginBottom: 0 }}>
                              {publicAgentSummary(record.description, "暂无可公开的工具说明。")}
                            </Typography.Paragraph>
                            <Space wrap>
                              {(record.allowedActions ?? []).map((action) => (
                                <Tag key={action}>{action}</Tag>
                              ))}
                            </Space>
                            {record.inputSchema?.length ? (
                              <Table
                                rowKey="name"
                                size="small"
                                pagination={defaultTablePagination(8)}
                                dataSource={record.inputSchema}
                                columns={[
                                  { title: "字段", dataIndex: "name" },
                                  { title: "类型", dataIndex: "type" },
                                  { title: "必填", dataIndex: "required", render: (value: boolean) => <BooleanTag value={value} trueLabel="必填" falseLabel="可选" /> },
                                  {
                                    title: "说明",
                                    dataIndex: "description",
                                    render: (value?: string) => publicAgentSummary(value, "-"),
                                  },
                                ]}
                              />
                            ) : null}
                          </div>
                        ),
                      }}
                      locale={{ emptyText: <RealEmpty meta={toolsQuery.data?.meta} description="暂无智能体工具记录" /> }}
                      pagination={defaultTablePagination(8)}
                    />
                  </Card>
                  <Card className="table-card" title="模型路由">
                    <Table
                      rowKey="workloadType"
                      columns={routeColumns}
                      dataSource={routes}
                      loading={routesQuery.isLoading}
                      locale={{ emptyText: <RealEmpty meta={routesQuery.data?.meta} description="暂无模型路由记录" /> }}
                      pagination={defaultTablePagination(8)}
                    />
                  </Card>
                </div>
                <Alert
                  showIcon
                  type="info"
                  message="模型路由口径"
                  description="Java 模型对话接口当前仍是试运行契约验证；真实推理、LangGraph 规划、知识检索和模型服务健康取决于 Python 运行时与模型服务配置。"
                />
              </div>
            ),
          },
          {
            key: "diagnostics",
            label: "运行诊断",
            children: (
              <div className="grid grid-three">
                <DiagnosticsBlock title="知识检索管线诊断" data={ragDiagnosticsQuery.data?.data} error={ragDiagnosticsQuery.error} loading={ragDiagnosticsQuery.isLoading} />
                <DiagnosticsBlock title="运行事件诊断" data={runtimeDiagnosticsQuery.data?.data} error={runtimeDiagnosticsQuery.error} loading={runtimeDiagnosticsQuery.isLoading} />
                <DiagnosticsBlock title="Skill 可见性索引" data={skillDiagnosticsQuery.data?.data} error={skillDiagnosticsQuery.error} loading={skillDiagnosticsQuery.isLoading} />
                <DiagnosticsBlock title="模型服务健康" data={providerDiagnosticsQuery.data?.data} error={providerDiagnosticsQuery.error} loading={providerDiagnosticsQuery.isLoading} />
                <DiagnosticsBlock title="能力闭口门禁" data={capabilityDiagnosticsQuery.data?.data} error={capabilityDiagnosticsQuery.error} loading={capabilityDiagnosticsQuery.isLoading} />
                <DiagnosticsBlock title="异步命令消息箱" data={asyncOutboxDiagnosticsQuery.data?.data} error={asyncOutboxDiagnosticsQuery.error} loading={asyncOutboxDiagnosticsQuery.isLoading} />
                <DiagnosticsBlock title="工具事件消息箱" data={eventOutboxDiagnosticsQuery.data?.data} error={eventOutboxDiagnosticsQuery.error} loading={eventOutboxDiagnosticsQuery.isLoading} />
              </div>
            ),
          },
          {
            key: "events",
            label: "运行事件",
            children: (
              <Card
                className="compact-card"
                title={(
                  <Space size={8}>
                    <span>运行事件投影</span>
                    <Tag color={runtimeEventStatusColors[runtimeEventSocketStatus]}>
                      {runtimeEventStatusLabels[runtimeEventSocketStatus]}
                    </Tag>
                  </Space>
                )}
              >
                {eventsQuery.isError ? (
                  <Alert showIcon type="warning" message="实时事件回放暂不可用" description="页面不会展示未确认项目范围的事件；系统将继续尝试受控 REST 回放和重连。" />
                ) : null}
                {events.length ? (
                  <Timeline
                    items={events.map((event) => {
                      const presentation = publicRuntimeEvent(event);
                      return {
                        color: eventColor[event.level],
                        children: (
                          <Space direction="vertical" size={2}>
                            <Space wrap>
                              <Typography.Text strong>{presentation.title}</Typography.Text>
                              <Tag>{labelOf(event.domain, runtimeDomainLabels)}</Tag>
                            </Space>
                            <Typography.Text type="secondary">{presentation.detail}</Typography.Text>
                            <Typography.Text type="secondary">{formatDateTime(event.time)}</Typography.Text>
                          </Space>
                        ),
                      };
                    })}
                  />
                ) : (
                  <RealEmpty meta={eventsQuery.data?.meta} description="暂无运行事件记录" />
                )}
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
