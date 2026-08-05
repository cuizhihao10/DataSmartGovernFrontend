import {
  ArrowRightOutlined,
  ApiOutlined,
  BranchesOutlined,
  CheckCircleOutlined,
  CodeOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileExcelOutlined,
  HistoryOutlined,
  InboxOutlined,
  PlusOutlined,
  PushpinFilled,
  PushpinOutlined,
  QuestionCircleOutlined,
  ReadOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
  ToolOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Checkbox,
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
  Upload,
  message,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "@/api/client";
import { api } from "@/api/endpoints";
import type { AgentPlanStreamFrame, AgentPlanStreamProgressEvent } from "@/api/endpoints";
import { PageHeader } from "@/components/PageHeader";
import {
  findMetadataTableByKey,
  findMetadataTableByName,
  findSameNameTargetTable,
  isMysqlLikeConnector,
  isRealtimeSyncMode,
  isScheduledSyncMode,
  isSqlSyncMode,
  makeFieldMappings,
  metadataTableOptions,
  normalizeUserSyncMode,
  sortedColumns,
  tableObjectKey,
  userSyncModeOptions,
  type SyncFieldMappingRow,
  type UserSyncMode,
} from "@/features/dataSync/syncTaskMapping";
import { AgentConsole } from "@/pages/AgentConsole";
import { useAuthStore } from "@/store/authStore";
import { useUiStore } from "@/store/uiStore";
import type {
  AgentPlanResponse,
  AgentObservationTimelineItem,
  AgentRun,
  AgentToolExecutionAudit,
  AgentToolExecutionFailure,
  AgentRepairProposal,
  AgentToolExecutionResult,
  SyncExecution,
  SyncTaskImportArtifact,
} from "@/types/domain";

interface ObjectMappingInput {
  objectKey?: string;
  sourceTableKey?: string;
  targetTableKey?: string;
  sourceSchemaName?: string;
  sourceObjectName?: string;
  targetSchemaName?: string;
  targetObjectName: string;
  whereCondition?: string;
  fieldMappings: SyncFieldMappingRow[];
}

interface ObjectiveFormValues {
  objective: string;
}

interface ClarificationFormValues {
  taskName: string;
  syncMode: UserSyncMode;
  sourceDatasourceId: number;
  targetDatasourceId: number;
  writeStrategy: "INSERT" | "UPDATE";
  scheduleConfig?: string;
  scheduleFrequency?: AgentScheduleFrequency;
  scheduleStartTime?: string;
  scheduleCron?: string;
  customSqlText?: string;
  customSqlConfirmed?: boolean;
  targetTableResolution?: "CREATE_FROM_SOURCE" | "SELECT_EXISTING";
  mappingDefaultsConfirmed?: boolean;
  objectMappings: ObjectMappingInput[];
}

interface QuickClarificationValues {
  sourceDatasourceId?: number;
  targetDatasourceId?: number;
  scheduleFrequency?: AgentScheduleFrequency;
  scheduleStartTime?: string;
  scheduleCron?: string;
  customSqlConfirmed?: boolean;
  targetTableResolution?: "CREATE_FROM_SOURCE" | "SELECT_EXISTING";
  mappingDefaultsConfirmed?: boolean;
}

type AgentScheduleFrequency = "HOURLY" | "DAILY" | "WEEKLY" | "CUSTOM_CRON";

interface PlanSubmission {
  objective: string;
  clarification?: Partial<ClarificationFormValues>;
  followUpMessage?: string;
  conversationContext?: AgentChatMessage[];
  taskImportArtifactRef?: string;
  taskImportRunImmediately?: boolean;
  recoveryTaskId?: number;
  recoveryExecutionId?: number;
  preserveTimeline?: boolean;
  startNewSession?: boolean;
}

interface AgentChatMessage {
  id: string;
  role: "USER" | "AGENT";
  content: string;
  /** 关联该消息所属的 Durable Run；历史回放据此把过程折叠条放在用户问题与最终回答之间。 */
  runId?: string;
  /** 服务端消息时间用于稳定恢复同一 Run 内多条阶段性回答的顺序。 */
  createTime?: string;
}

/**
 * 一个历史 Run 的完整可回放事实。
 *
 * run 保存模型路由、计划摘要和状态；audits 保存每个工具动作；results 保存工具返回的低敏结构化结果。
 * 三者组合后，页面才能像 Codex 一样展示“做了什么、怎么做、结果如何”，而不是只留下最终一句回答。
 */
interface HistoricalAgentRunProcess {
  run: AgentRun;
  audits: AgentToolExecutionAudit[];
  results: AgentToolExecutionResult[];
}

type HistoricalTranscriptEntry =
  | { key: string; kind: "MESSAGE"; message: AgentChatMessage }
  | { key: string; kind: "PROCESS"; process: HistoricalAgentRunProcess };

interface ExecutionAnswer {
  content: string;
  status: "SUCCESS" | "ERROR";
  taskId?: number;
  executionId?: number;
  failures?: AgentToolExecutionFailure[];
  recoveryRunId?: string;
  recoveryRequiresConfirmation?: boolean;
  continuationStatus?: string;
  repairProposal?: AgentRepairProposal;
  /**
   * 后续修复建议仍然有效，但承载该建议的 Durable Run 已不存在时记录原因。
   * 页面据此隐藏失效的确认按钮，并提供重新生成审核计划的持久入口。
   */
  recoveryRunUnavailableReason?: string;
}

/**
 * 一次 Agent 规划失败后保留在页面上的恢复上下文。
 *
 * 与 toast 不同，该对象会持续存在到用户重试、切换项目或开始新目标，确保用户能看到具体原因、系统是否允许
 * 原地恢复以及服务端建议。结构中不保存数据源密码、SQL 凭据或 Provider 原始响应。
 */
interface AgentPlanFailure {
  message: string;
  code?: string;
  recoverable: boolean;
  suggestions: string[];
}

type AgentProcessStatus = "IDLE" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

type AgentActionKind =
  | "MODEL_OUTPUT"
  | "API_CALL"
  | "CONFIG_CHANGE"
  | "RESULT"
  | "USER_INPUT"
  | "APPROVAL";

interface AgentActionItem {
  id: string;
  kind: AgentActionKind;
  status: string;
  title: string;
  summary: string;
  operation?: string;
  targetService?: string;
  safeInput?: unknown;
  safeOutput?: unknown;
  changedFields?: string[];
  evidence?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
  elapsedMs?: number;
}

const defaultObjective = "将 MySQL 中的 fs_test_customer_source 和 fs_test_customer_target 全量同步到 PostgreSQL public schema 的同名表。";
const taskImportObjective = "检查这个任务文件，先试运行；若失败则检索产品文档和历史案例，提出可执行修复方案，经我确认后修复、重新校验并导入。";

function normalizeScheduleStartAt(value?: string) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(normalized)) return normalized;
  return `${normalized.length === 16 ? `${normalized}:00` : normalized}+08:00`;
}

function buildAgentScheduleConfig(
  frequency?: AgentScheduleFrequency,
  startTime?: string,
  customCron?: string,
) {
  if (!frequency || !startTime) return undefined;
  const common = {
    timezone: "Asia/Shanghai",
    startAt: normalizeScheduleStartAt(startTime),
    misfirePolicy: "FIRE_ONCE",
    allowConcurrentRuns: false,
    maxCatchUpRuns: 1,
  };
  if (frequency === "CUSTOM_CRON") {
    const cron = customCron?.trim();
    return cron ? JSON.stringify({ ...common, type: "CRON", cron }) : undefined;
  }
  const intervalSeconds = frequency === "HOURLY" ? 3600 : frequency === "DAILY" ? 86_400 : 604_800;
  return JSON.stringify({ ...common, type: "FIXED_RATE", intervalSeconds });
}

function scheduleConfigSummary(value?: string) {
  if (!value?.trim()) return "非定期任务";
  try {
    const config = JSON.parse(value) as Record<string, unknown>;
    const timezone = typeof config.timezone === "string" ? config.timezone : "Asia/Shanghai";
    const startAt = typeof config.startAt === "string" ? `，首次 ${config.startAt}` : "";
    if (config.type === "FIXED_RATE" && typeof config.intervalSeconds === "number") {
      const seconds = config.intervalSeconds;
      const interval = seconds % 604_800 === 0
        ? `每 ${seconds / 604_800} 周`
        : seconds % 86_400 === 0
          ? `每 ${seconds / 86_400} 天`
          : seconds % 3_600 === 0
            ? `每 ${seconds / 3_600} 小时`
            : `每 ${seconds} 秒`;
      return `${interval}（${timezone}${startAt}）`;
    }
    if (typeof config.cron === "string") return `Cron ${config.cron}（${timezone}${startAt}）`;
  } catch {
    // The backend precheck will report malformed schedule JSON. The review
    // still shows the raw value so the user can inspect and correct it.
  }
  return value;
}

const syncModeLabels: Record<string, string> = {
  FULL: "全量传输",
  SCHEDULED_BATCH: "定期批量",
  SCHEDULED_FULL: "定期全量",
  CUSTOM_SQL_QUERY: "SQL 语句",
  CDC_STREAMING: "实时同步",
  REAL_TIME: "实时同步",
};

const clarificationParameterLabels: Record<string, string> = {
  sourceDatasourceId: "源端数据源",
  targetDatasourceId: "目标端数据源",
  objectMappings: "源表到目标表的对象映射",
  fieldMappings: "每条对象映射中至少一个有效字段映射",
  mappingDefaultsConfirmation: "默认同名字段映射与无 WHERE 范围确认",
  scheduleFrequency: "定期任务执行频率",
  scheduleStartTime: "首次执行时间",
  customSqlConfirmation: "SQL 内容确认",
  targetTableResolution: "目标表不存在时的处理方式",
  fieldMappingConversions: "字段类型冲突的转换或映射方案",
};

function clarificationParameterLabel(parameterName: string) {
  return clarificationParameterLabels[parameterName]
    || `其他必要配置（${parameterName}）`;
}

function textField(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

/** 只接受普通 JSON 对象，供历史 Run 从持久化 variables 中逐层读取模型治理事实。 */
function recordField(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function booleanField(record: Record<string, unknown> | undefined, key: string) {
  return record?.[key] === true;
}

function numberField(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function resolvedObjectMappings(value: unknown): ObjectMappingInput[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((rawMapping, mappingIndex) => {
    if (!rawMapping || typeof rawMapping !== "object" || Array.isArray(rawMapping)) return [];
    const mapping = rawMapping as Record<string, unknown>;
    const sourceObjectName = textField(mapping, "sourceObjectName");
    const targetObjectName = textField(mapping, "targetObjectName");
    if (!targetObjectName) return [];
    const rawFields = Array.isArray(mapping.fieldMappings) ? mapping.fieldMappings : [];
    const fieldMappings = rawFields.flatMap((rawField, fieldIndex) => {
      if (!rawField || typeof rawField !== "object" || Array.isArray(rawField)) return [];
      const field = rawField as Record<string, unknown>;
      const sourceField = textField(field, "sourceField");
      const targetField = textField(field, "targetField");
      if (!sourceField || !targetField) return [];
      return [{
        key: `agent-resolved-${mappingIndex}-${fieldIndex}-${sourceField}`,
        sourceField,
        sourceType: textField(field, "sourceType"),
        targetField,
        targetType: textField(field, "targetType"),
        nullable: field.nullable === undefined ? undefined : Boolean(field.nullable),
        primaryKey: field.primaryKey === undefined ? undefined : Boolean(field.primaryKey),
        syncEnabled: field.syncEnabled !== false,
        typeCompatible: field.typeCompatible === undefined ? undefined : Boolean(field.typeCompatible),
        transform: textField(field, "transform"),
      }];
    });
    return [{
      objectKey: textField(mapping, "objectKey") || `agent-resolved-mapping-${mappingIndex + 1}`,
      sourceSchemaName: textField(mapping, "sourceSchemaName"),
      sourceObjectName,
      targetSchemaName: textField(mapping, "targetSchemaName"),
      targetObjectName,
      whereCondition: textField(mapping, "whereCondition"),
      fieldMappings,
    }];
  });
}

function definedFormValues<T extends object>(values: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败，请查看详细错误后重试";
}

/**
 * 判断确认请求是否命中了已经失效的 Agent Run。
 *
 * 历史版本曾在追加助手消息时用旧会话快照覆盖整个聚合，导致 Python 刚生成的修复 Run 被删除。后端修复后
 * 新请求不会再产生该状态，但用户浏览器和数据库中仍可能保留旧 Run ID，因此页面必须提供一次性迁移恢复入口。
 */
function isMissingAgentRunError(error: unknown) {
  const message = errorMessage(error);
  return /Agent Run 不存在|runId=.*不存在|NEXT_RUN_NOT_DURABLE/i.test(message);
}

/** 将 API/流式异常转换成页面可持久展示的低敏恢复信息。 */
function agentPlanFailure(error: unknown): AgentPlanFailure {
  if (error instanceof ApiError) {
    return {
      message: error.message,
      code: error.reason,
      recoverable: error.recoverable !== false,
      suggestions: error.suggestions ?? [],
    };
  }
  return {
    message: errorMessage(error),
    recoverable: true,
    suggestions: [],
  };
}

function isAgentPlanAbort(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function observationColor(status: string) {
  if (["SUCCEEDED", "READY", "LOADED", "CACHED"].includes(status)) return "green";
  if (status === "FAILED" || status === "BLOCKED") return "red";
  if (["FALLBACK", "WAITING", "WAITING_INPUT", "WAITING_APPROVAL", "PAUSED", "CANCELLED"].includes(status)) return "orange";
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
    CANCELLED: "已停止",
    BLOCKED: "已阻止",
    FAILED: "失败",
    FALLBACK: "已降级",
    CACHED: "已命中缓存",
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
    model_public_output_stream_updated: { category: "MODEL", title: "模型正在回复", status: "RUNNING" },
    model_public_output_ready: { category: "MODEL", title: "模型公开输出" },
    model_tool_call_proposed: { category: "TOOL", title: "模型提出工具调用" },
    model_tool_call_accepted: { category: "TOOL", title: "工具建议通过治理" },
    model_tool_call_rejected: { category: "PERMISSION", title: "工具建议被安全门禁拒绝", status: "BLOCKED" },
    model_tool_call_approval_required: { category: "PERMISSION", title: "工具调用等待用户确认", status: "WAITING_APPROVAL" },
    model_tool_call_budget_guarded: { category: "PERMISSION", title: "执行工具预算门禁" },
    tool_planned: { category: "TOOL", title: "生成工具执行计划" },
    "agent.tool_execution.state_changed": { category: "TOOL", title: "收到真实工具执行结果" },
    tool_auto_execution_sync_completed: { category: "TOOL", title: "完成本轮受控工具执行" },
    tool_result_feedback_built: { category: "ORCHESTRATION", title: "构建模型可见的工具结果" },
    agent_loop_control_decided: { category: "PERMISSION", title: "评估是否允许 Agent 继续推进" },
    model_second_turn_completed: { category: "MODEL", title: "模型根据工具结果完成下一轮决策" },
    model_second_turn_skipped: { category: "MODEL", title: "本轮模型调用已安全停止" },
    model_follow_up_tool_batch_governed: { category: "TOOL", title: "治理模型选择的下一批工具" },
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
  // 规则分析器的 confidence 是内部启发式匹配分，不是模型校准置信度，也不适合驱动用户决策。
  // 工作过程只展示可验证的领域、候选工具、风险和缺参事实，避免把固定分值误读成 AI 自信程度。
  const publicAttributes = Object.fromEntries(
    Object.entries(event.attributes || {}).filter(([key]) => (
      !["confidence", "ruleConfidence", "publicContent"].includes(key)
    )),
  );
  const requestScope = event.requestId?.slice(0, 12) || "current";
  const publicContent = typeof event.attributes?.publicContent === "string"
    ? event.attributes.publicContent
    : undefined;
  const stableStreamId = event.eventType === "model_public_output_stream_updated"
    ? `${event.eventType}-${event.stage}-${String(event.attributes?.turn || "CURRENT")}`
    : `${event.eventType}-${event.sequence ?? event.stage}`;
  return {
    id: `live-${requestScope}-${stableStreamId}`,
    category: presentation.category,
    stage: event.stage,
    status: eventFailed ? "FAILED" : presentation.status || (eventWarning ? "FALLBACK" : "SUCCEEDED"),
    title: presentation.title,
    summary: publicContent || event.message,
    details: {
      ...publicAttributes,
      occurredAt: event.createdAt,
    },
  };
}

function formatAgentProcessElapsed(elapsedMs: number) {
  const totalSeconds = Math.max(0, Math.round(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function agentProcessActionSummaries(items: AgentActionItem[]) {
  const modelCount = items.filter((item) => item.kind === "MODEL_OUTPUT").length;
  const toolCount = items.filter((item) => ["API_CALL", "CONFIG_CHANGE"].includes(item.kind)).length;
  const completedCount = items.filter((item) => ["SUCCEEDED", "FAILED"].includes(item.status)).length;
  const waitingCount = items.filter((item) => ["WAITING_INPUT", "WAITING_APPROVAL"].includes(item.status)).length;
  return [
    modelCount ? `${modelCount} 次模型公开回复` : undefined,
    toolCount ? `${toolCount} 个受控工具动作` : undefined,
    completedCount ? `${completedCount} 项已有结果` : undefined,
    waitingCount ? `${waitingCount} 项等待你处理` : undefined,
  ].filter((item): item is string => Boolean(item));
}

const actionHiddenKey = /(password|secret|token|credential|authorization|cookie|rawpayload|rawrow|sampledata)/i;
const actionReviewedConfigKey = /(sql|wherecondition|filtercondition)/i;

function sanitizeAgentActionPayload(value: unknown, key = "", depth = 0): unknown {
  if (actionHiddenKey.test(key)) return "[已隐藏]";
  if (actionReviewedConfigKey.test(key)) return "[请在任务配置审核中查看]";
  if (value === null || value === undefined || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }
  if (depth >= 5) return "[内容已折叠]";
  if (Array.isArray(value)) {
    const visible = value.slice(0, 20).map((item) => sanitizeAgentActionPayload(item, key, depth + 1));
    return value.length > visible.length ? [...visible, `其余 ${value.length - visible.length} 项已折叠`] : visible;
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => (
        [childKey, sanitizeAgentActionPayload(childValue, childKey, depth + 1)]
      )),
    );
  }
  return String(value);
}

function agentToolHttpMethod(toolCode: string) {
  if ([
    "datasource.source.catalog.search",
    "datasource.target.catalog.search",
    "sync.execution.status",
  ].includes(toolCode)) return "GET";
  return "POST";
}

function resolvedAgentEndpoint(endpoint: string | undefined, argumentsValue: Record<string, unknown>) {
  if (!endpoint) return undefined;
  return Object.entries(argumentsValue).reduce((current, [key, value]) => (
    ["string", "number"].includes(typeof value)
      ? current.split(`{${key}}`).join(encodeURIComponent(String(value)))
      : current
  ), endpoint);
}

function agentActionElapsedMs(startedAt?: string, completedAt?: string) {
  if (!startedAt || !completedAt) return undefined;
  const value = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function agentActionStatus(state: string) {
  return {
    EXECUTING: "RUNNING",
    PLANNED: "PENDING",
  }[state] || state;
}

function agentActionKind(audit: AgentToolExecutionAudit): AgentActionKind {
  if (audit.state === "WAITING_APPROVAL") return "APPROVAL";
  if (audit.toolCode === "sync.task.draft.save" || audit.toolCode.endsWith(".repair.apply")) {
    return "CONFIG_CHANGE";
  }
  return "API_CALL";
}

function agentToolActionTitle(audit: AgentToolExecutionAudit) {
  const baseName = humanReadableToolName(audit.toolCode);
  if (audit.state === "WAITING_APPROVAL") return `等待确认：${baseName}`;
  if (audit.state === "PLANNED") return `准备调用：${baseName}`;
  if (audit.state === "EXECUTING") return `正在执行：${baseName}`;
  if (audit.state === "FAILED") return `执行失败：${baseName}`;
  if (audit.state === "SKIPPED") return `未执行：${baseName}`;
  return `已完成：${baseName}`;
}

function auditToAgentAction(
  audit: AgentToolExecutionAudit,
  result?: AgentToolExecutionResult,
): AgentActionItem {
  const endpoint = resolvedAgentEndpoint(audit.targetEndpoint, audit.planArguments);
  const changedFields = agentActionKind(audit) === "CONFIG_CHANGE"
    ? Object.keys(audit.planArguments).filter((key) => !actionHiddenKey.test(key))
    : undefined;
  return {
    id: `action-${audit.auditId}`,
    kind: agentActionKind(audit),
    status: agentActionStatus(audit.state),
    title: agentToolActionTitle(audit),
    summary: audit.outputSummary || audit.message || audit.planReason || "工具已进入受控执行链路。",
    operation: endpoint ? `${agentToolHttpMethod(audit.toolCode)} ${endpoint}` : audit.toolCode,
    targetService: audit.targetService,
    safeInput: sanitizeAgentActionPayload(audit.planArguments),
    safeOutput: result ? sanitizeAgentActionPayload(result.output) : undefined,
    changedFields,
    evidence: {
      auditId: audit.auditId,
      traceId: audit.traceId,
      toolCode: audit.toolCode,
      executionMode: audit.executionMode,
      readOnly: audit.readOnly,
      idempotent: audit.idempotent,
      errorCode: audit.errorCode,
    },
    startedAt: audit.executionStartTime || audit.createTime,
    completedAt: audit.executionFinishTime,
    elapsedMs: agentActionElapsedMs(audit.executionStartTime, audit.executionFinishTime),
  };
}

function agentActionIcon(kind: AgentActionKind) {
  if (kind === "MODEL_OUTPUT") return <RobotOutlined />;
  if (kind === "API_CALL") return <ApiOutlined />;
  if (kind === "CONFIG_CHANGE") return <EditOutlined />;
  if (kind === "APPROVAL") return <SafetyCertificateOutlined />;
  if (kind === "USER_INPUT") return <QuestionCircleOutlined />;
  return <CheckCircleOutlined />;
}

function agentActionKindLabel(kind: AgentActionKind) {
  return {
    MODEL_OUTPUT: "模型输出",
    API_CALL: "工具 / API",
    CONFIG_CHANGE: "配置变更",
    RESULT: "执行结果",
    USER_INPUT: "需要补充",
    APPROVAL: "等待确认",
  }[kind];
}

function actionPayloadText(value: unknown) {
  if (value === undefined) return undefined;
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

/**
 * 从 Durable Run 中恢复本轮公开的模型决策动作。
 *
 * 系统不会保存或展示模型隐藏思维链，但会持久化实际路由、公开计划摘要、所选工具和治理结果。这些事实足以
 * 解释模型是否参与、使用了哪个模型、提出了哪些受控动作，同时避免把系统提示词或 Provider 原始事件泄露给页面。
 */
function historicalModelAction(run: AgentRun): AgentActionItem | undefined {
  const variables = run.variables;
  const governance = recordField(variables, "modelGatewayGovernance");
  const governanceAttributes = recordField(governance, "attributes");
  const selectedRoute = recordField(governance, "selected_route")
    || recordField(governance, "selectedRoute");
  const cachePlan = recordField(governance, "cache_plan")
    || recordField(governance, "cachePlan");
  const budgetDecision = recordField(governance, "budget_decision")
    || recordField(governance, "budgetDecision");
  const toolPlans = Array.isArray(variables.toolPlans)
    ? variables.toolPlans.filter((item): item is Record<string, unknown> => (
        Boolean(item) && typeof item === "object" && !Array.isArray(item)
      ))
    : [];
  const proposedTools = toolPlans
    .map((item) => textField(item, "toolCode"))
    .filter((item): item is string => Boolean(item));
  const responseSummary = textField(variables, "responseSummary")
    || textField(variables, "modelIntentSummary")
    || run.message;
  const provider = textField(selectedRoute, "provider_name")
    || textField(selectedRoute, "providerName")
    || textField(governanceAttributes, "selectedProvider");
  const model = textField(selectedRoute, "model_name")
    || textField(selectedRoute, "modelName");
  if (!responseSummary && !provider && !model && !proposedTools.length) return undefined;
  return {
    id: `history-model-${run.runId}`,
    kind: "MODEL_OUTPUT",
    status: "SUCCEEDED",
    title: "模型已完成目标理解与工具决策",
    summary: responseSummary || `模型提出了 ${proposedTools.length} 个受控工具动作。`,
    operation: `Responses API${model ? ` · ${model}` : ""}`,
    targetService: provider || "model-gateway",
    safeInput: sanitizeAgentActionPayload({
      userInputPreview: run.userInputPreview,
      stateTrace: Array.isArray(variables.stateTrace) ? variables.stateTrace : undefined,
    }),
    safeOutput: sanitizeAgentActionPayload({
      publicDecisionSummary: responseSummary,
      proposedTools,
    }),
    evidence: {
      provider,
      model,
      cacheEnabled: cachePlan?.enabled,
      cacheScope: cachePlan?.scope,
      budgetAllowed: budgetDecision?.allowed,
      toolCount: proposedTools.length,
    },
    startedAt: run.createTime,
    completedAt: run.updateTime,
    elapsedMs: agentActionElapsedMs(run.createTime, run.updateTime),
  };
}

/** 根据 Run 与工具终态计算历史折叠条状态，避免把“等待审批”误显示成已经成功。 */
function historicalRunDisplayStatus(process: HistoricalAgentRunProcess) {
  const auditStates = process.audits.map((audit) => audit.state);
  if (process.run.state === "CANCELLED" || auditStates.includes("CANCELLED")) return "CANCELLED";
  if (process.run.state === "FAILED" || auditStates.includes("FAILED")) return "FAILED";
  if (auditStates.includes("EXECUTING")) return "RUNNING";
  if (auditStates.includes("WAITING_APPROVAL")) return "WAITING_APPROVAL";
  if (auditStates.includes("PLANNED") || auditStates.includes("APPROVED")) return "PENDING";
  if (process.audits.length && auditStates.every((state) => ["SUCCEEDED", "SKIPPED"].includes(state))) {
    return "SUCCEEDED";
  }
  return agentActionStatus(process.run.state);
}

/** 取 Run 或最后一个工具事实的结束时间，用于恢复真实处理耗时。 */
function historicalRunElapsedMs(process: HistoricalAgentRunProcess) {
  const auditTimes = process.audits.flatMap((audit) => (
    [audit.executionFinishTime, audit.updateTime].filter((item): item is string => Boolean(item))
  ));
  const candidates = [process.run.finishTime, process.run.updateTime, ...auditTimes]
    .filter((item): item is string => Boolean(item))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime());
  return agentActionElapsedMs(process.run.createTime, candidates[0]) ?? 0;
}

/**
 * 历史 Run 的 Codex 风格过程折叠条。
 *
 * 默认只显示“已处理/失败/等待 + 耗时”；展开后才展示模型公开决策、真实工具/API、脱敏参数、结果与审计证据。
 * 该组件只消费服务端事实，不会执行工具，也不会改变 Run 状态。
 */
function HistoricalAgentRunProcessPlayback({ process }: { process: HistoricalAgentRunProcess }) {
  const resultByAuditId = new Map(process.results.map((item) => [item.audit.auditId, item]));
  const modelAction = historicalModelAction(process.run);
  const actions = [
    ...(modelAction ? [modelAction] : []),
    ...process.audits.map((audit) => auditToAgentAction(audit, resultByAuditId.get(audit.auditId))),
  ];
  const status = historicalRunDisplayStatus(process);
  const elapsedMs = historicalRunElapsedMs(process);
  const statusLabel = status === "FAILED"
    ? "处理失败"
    : status === "CANCELLED"
      ? "已停止"
      : status === "RUNNING"
        ? "正在处理"
        : ["WAITING_APPROVAL", "PENDING"].includes(status)
          ? "等待继续"
          : "已处理";
  return (
    <div className={`agent-process-shell agent-history-process is-${status.toLowerCase()}`}>
      <Collapse
        ghost
        expandIconPosition="end"
        items={[{
          key: `history-process-${process.run.runId}`,
          label: (
            <Typography.Text
              strong
              className={status === "FAILED"
                ? "agent-process-failed"
                : status === "CANCELLED"
                  ? "agent-process-cancelled"
                  : undefined}
            >
              {statusLabel} {formatAgentProcessElapsed(elapsedMs)}
            </Typography.Text>
          ),
          children: actions.length ? (
            <div className="agent-process-body">
              <div className="agent-process-summary">
                {agentProcessActionSummaries(actions).map((summary) => <Tag key={summary}>{summary}</Tag>)}
                <Typography.Text type="secondary">
                  历史 Run 的真实模型路由、受控工具调用与低敏结果
                </Typography.Text>
              </div>
              <Timeline
                className="agent-process-timeline"
                items={actions.map((item) => {
                  const safeInputText = actionPayloadText(item.safeInput);
                  const safeOutputText = actionPayloadText(item.safeOutput);
                  const evidenceEntries = Object.entries(item.evidence ?? {}).filter(([, value]) => (
                    value !== undefined && value !== null && value !== ""
                  ));
                  return {
                    color: observationColor(item.status),
                    dot: agentActionIcon(item.kind),
                    children: (
                      <div className={`agent-process-step agent-action-step is-${item.kind.toLowerCase()}`}>
                        <Space wrap>
                          <Typography.Text strong>{item.title}</Typography.Text>
                          <Tag color="blue">{agentActionKindLabel(item.kind)}</Tag>
                          <Tag color={observationColor(item.status)}>{observationStatus(item.status)}</Tag>
                          {item.elapsedMs !== undefined ? (
                            <Typography.Text type="secondary">
                              {formatAgentProcessElapsed(item.elapsedMs)}
                            </Typography.Text>
                          ) : null}
                        </Space>
                        <Typography.Paragraph className="agent-process-step-summary">
                          {item.summary}
                        </Typography.Paragraph>
                        {item.operation ? (
                          <div className="agent-action-operation">
                            <CodeOutlined />
                            <Typography.Text code>{item.operation}</Typography.Text>
                            {item.targetService ? <Tag>{item.targetService}</Tag> : null}
                          </div>
                        ) : null}
                        {safeInputText || safeOutputText || item.changedFields?.length || evidenceEntries.length ? (
                          <Collapse
                            ghost
                            size="small"
                            items={[{
                              key: `${item.id}-history-details`,
                              label: "查看调用参数、结果与证据",
                              children: (
                                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                                  {item.changedFields?.length ? (
                                    <div className="agent-action-tags">
                                      {item.changedFields.map((field) => <Tag key={field}>{field}</Tag>)}
                                    </div>
                                  ) : null}
                                  {safeInputText ? <pre className="agent-action-payload">{safeInputText}</pre> : null}
                                  {safeOutputText ? <pre className="agent-action-payload">{safeOutputText}</pre> : null}
                                  {evidenceEntries.length ? (
                                    <Descriptions
                                      size="small"
                                      column={{ xs: 1, sm: 2, lg: 3 }}
                                      items={evidenceEntries.map(([key, value]) => ({
                                        key,
                                        label: observationDetailLabel(key),
                                        children: formatObservationValue(value, key),
                                      }))}
                                    />
                                  ) : null}
                                </Space>
                              ),
                            }]}
                          />
                        ) : null}
                      </div>
                    ),
                  };
                })}
              />
            </div>
          ) : (
            <Typography.Text type="secondary">
              该旧 Run 没有可展示的模型或工具过程事实，仅保留了最终会话消息。
            </Typography.Text>
          ),
        }]}
      />
    </div>
  );
}

/** 统一渲染用户与 Agent 消息，避免历史区和实时区继续维护两套聊天气泡。 */
function AgentConversationMessageBubble({ item }: { item: AgentChatMessage }) {
  return (
    <div className={`agent-message-row ${item.role === "USER" ? "is-user" : "is-agent"}`}>
      <div className="agent-message-meta">{item.role === "USER" ? "你" : "Agent"}</div>
      <div className={`agent-message-bubble${item.role === "AGENT" ? " is-final" : ""}`}>
        <Typography.Paragraph style={{ margin: 0, whiteSpace: "pre-wrap" }}>
          {item.content}
        </Typography.Paragraph>
      </div>
    </div>
  );
}

/**
 * 将持久消息和历史 Run 组装成稳定回合顺序。
 *
 * 数据库中同一时刻写入的 USER/AGENT 消息可能拥有相同毫秒时间，不能仅按时间字符串决定先后。这里固定为
 * “本 Run 的用户消息 -> 过程折叠条 -> 本 Run 的 Agent 消息”，同时把尚未取得 Run ID 的当前流式消息单独返回，
 * 由实时 processPanel 插入到用户输入与最终回答之间。
 */
function buildHistoricalConversationTranscript(
  messages: AgentChatMessage[],
  processes: HistoricalAgentRunProcess[],
) {
  const processRunIds = new Set(processes.map((process) => process.run.runId));
  const entries: HistoricalTranscriptEntry[] = [];
  processes.forEach((process) => {
    const runMessages = messages
      .filter((message) => message.runId === process.run.runId)
      .sort((left, right) => {
        if (left.role !== right.role) return left.role === "USER" ? -1 : 1;
        return new Date(left.createTime || 0).getTime() - new Date(right.createTime || 0).getTime();
      });
    runMessages.filter((message) => message.role === "USER").forEach((message) => {
      entries.push({ key: message.id, kind: "MESSAGE", message });
    });
    entries.push({
      key: `process-${process.run.runId}`,
      kind: "PROCESS",
      process,
    });
    runMessages.filter((message) => message.role === "AGENT").forEach((message) => {
      entries.push({ key: message.id, kind: "MESSAGE", message });
    });
  });
  return {
    entries,
    currentMessages: messages.filter((message) => !message.runId || !processRunIds.has(message.runId)),
  };
}

function observationDetailLabel(key: string) {
  return {
    provider: "模型 Provider",
    model: "模型",
    latencyMs: "本次响应耗时",
    providerLatencyMs: "原始 Provider 耗时",
    responseSource: "本次响应来源",
    responseAvailable: "公开回复可用",
    promptTokens: "输入 Token",
    completionTokens: "输出 Token",
    totalTokens: "总 Token",
    toolCallCount: "模型建议工具数",
    proposedToolNames: "模型建议工具",
    attemptCount: "调用尝试次数",
    cacheHit: "DataSmart 完整响应缓存",
    cachedPromptTokens: "Provider 缓存输入 Token",
    fallbackUsed: "是否降级",
    errorCode: "错误码",
    strategySummary: "策略摘要",
    selectedProviderName: "模型 Provider",
    selectedModelName: "实际响应模型",
    actualModelName: "实际响应模型",
    requestedModelName: "请求模型",
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
    modelRequestObjective: "发送给模型的用户目标",
    modelInstructionSummary: "发送给模型的公开指令摘要",
    modelMessageShape: "模型消息组成",
    modelStructuredBaseline: "发送给模型的权威结构化基线",
    modelVisibleToolNames: "模型实际可见工具",
    modelContextTitles: "模型可见上下文标题",
    modelPublicResponse: "模型完整公开回复（已脱敏）",
    modelSecondTurnResponse: "工具反馈后二轮公开回复（已脱敏）",
    toolSelectionSource: "最终工具选择来源",
    modelGeneratedToolCount: "模型原生建议工具数",
    modelGeneratedToolNames: "模型原生建议工具",
    ruleGeneratedToolCount: "系统规则补充工具数",
    ruleGeneratedToolNames: "系统规则补充工具",
    finalToolCount: "最终工具数",
    finalToolNames: "最终采用工具",
    planningSource: "该工具计划来源",
    turnIndex: "Agent 循环轮次",
    toolNames: "本轮提交工具",
    toolCount: "本轮工具数",
    feedbackCount: "工具反馈数",
    messageCount: "模型反馈消息数",
    expectedToolCallCount: "预期工具调用数",
    missingToolCallIds: "缺失工具反馈",
    extraFeedbackCallIds: "额外工具反馈",
    statusCounts: "工具状态统计",
    allowed: "允许自动继续",
    action: "循环控制动作",
    acceptedCount: "通过治理的工具数",
    rejectedCount: "被治理拒绝的工具数",
    repeatedCount: "重复工具数",
    executedCount: "已执行工具数",
    failedCount: "失败工具数",
    skippedCount: "跳过工具数",
    complete: "反馈是否完整",
  }[key] || key;
}

function observationDetailsTitle(category: string) {
  return {
    MODEL: "查看发送给模型的内容与模型公开回复",
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
  if ((key === "latencyMs" || key === "providerLatencyMs") && typeof value === "number") return `${value} ms`;
  if (key === "elapsedSeconds" && typeof value === "number") return `${value} 秒`;
  if ((key === "toolSelectionSource" || key === "planningSource") && typeof value === "string") {
    return {
      MODEL_AND_SYSTEM_RULE_MERGED: "模型建议与系统安全基线合并",
      MODEL_PROPOSED: "模型原生工具建议",
      SYSTEM_RULE_FALLBACK: "系统确定性规则兜底",
      MODEL_OVERRIDE_RULE_BASELINE: "模型建议覆盖同名规则基线",
      NO_TOOL_SELECTED: "本轮未选择工具",
      FINAL_PLAN: "最终受治理计划",
    }[value] || value;
  }
  if (key === "responseSource" && typeof value === "string") {
    return {
      MODEL_PROVIDER: "真实模型 Provider",
      DATASMART_RESULT_CACHE: "DataSmart 会话响应缓存",
      DRY_RUN: "本地诊断模拟（未调用真实模型）",
    }[value] || value;
  }
  if (Array.isArray(value)) return value.length ? value.join("、") : "无";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function scrollToAgentSection(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function findArtifactRef(value: unknown, depth = 0): string | undefined {
  if (depth > 4 || !value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.artifactRef === "string" && record.artifactRef.trim()) {
    return record.artifactRef;
  }
  for (const key of ["artifact", "data", "result", "output"]) {
    const nested = findArtifactRef(record[key], depth + 1);
    if (nested) return nested;
  }
  return undefined;
}

function findNumericField(value: unknown, keys: string[], depth = 0): number | undefined {
  if (depth > 5 || !value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) return candidate;
    if (typeof candidate === "string" && /^\d+$/.test(candidate) && Number(candidate) > 0) return Number(candidate);
  }
  for (const nested of Object.values(record)) {
    const found = findNumericField(nested, keys, depth + 1);
    if (found) return found;
  }
  return undefined;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

const terminalSyncExecutionStates = new Set([
  "SUCCEEDED",
  "PARTIALLY_SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "MANUALLY_TERMINATED",
  "SKIPPED",
]);

function syncExecutionSummary(execution: SyncExecution) {
  return `同步 execution #${execution.id}：${execution.executionState}；`
    + `已读 ${execution.recordsRead ?? 0} 行，已写 ${execution.recordsWritten ?? 0} 行，`
    + `失败 ${execution.failedRecordCount ?? 0} 行。`;
}

function humanReadableToolName(toolName: string) {
  return {
    "datasource.source.catalog.search": "检索可用源端数据源",
    "datasource.target.catalog.search": "检索可用目标端数据源",
    "datasource.source.connection.test": "测试源端数据源连接",
    "datasource.target.connection.test": "测试目标端数据源连接",
    "datasource.source.metadata.read": "读取源端表结构",
    "datasource.target.metadata.read": "读取目标端表结构",
    "datasource.target-table.create.preview": "预览目标表创建方案",
    "datasource.target-table.create.apply": "创建目标表",
    "sync.task.draft.save": "保存同步任务草稿",
    "sync.task.precheck": "运行同步任务预检查",
    "sync.task.publish": "发布同步任务",
    "sync.task.execute": "启动同步任务",
    "sync.cdc.readiness.check": "检查实时同步条件",
    "sync.task.import.dry-run": "任务文件试运行",
    "sync.task.import.rag.lookup": "检索修复案例与产品文档",
    "sync.task.import.repair.apply": "应用模型提出的修复补丁",
    "sync.task.import.commit": "正式导入任务文件",
    "sync.execution.status": "验证同步执行结果",
    "sync.execution.diagnose": "读取真实执行账本并诊断根因",
    "sync.execution.rag.lookup": "检索历史恢复案例与 Runbook",
    "sync.execution.failed-objects.retry": "选择性重试失败对象",
    "sync.dirty-record.quarantine.preview": "预览坏行隔离范围",
    "sync.dirty-record.quarantine.apply": "应用确认后的坏行隔离",
    "sync.dirty-record.replay": "重放已修复的坏行",
    "datasource.schema.repair.preview": "预览目标表白名单结构修复",
    "datasource.schema.repair.apply": "应用确认后的目标表结构修复",
    "sync.recovery.case.publish": "发布已验证恢复案例",
  }[toolName] || toolName;
}

function UserAgentAssistant() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [objectiveForm] = Form.useForm<ObjectiveFormValues>();
  const [clarificationForm] = Form.useForm<ClarificationFormValues>();
  const [quickClarificationForm] = Form.useForm<QuickClarificationValues>();
  const selectedProjectId = useUiStore((state) => state.selectedProjectId);
  const [objective, setObjective] = useState(defaultObjective);
  // 同一个助手页面生命周期内复用稳定会话 ID，使 SESSION_ONLY 模型响应缓存具备安全命中条件。
  // 缓存 key 仍包含租户、项目、模型、工具集合和完整消息摘要，不会把不同问题误命中为同一响应。
  const [agentConversationSessionId, setAgentConversationSessionId] = useState<string>(() => crypto.randomUUID());
  const [activeAgentRuntimeSessionId, setActiveAgentRuntimeSessionId] = useState<string>();
  const [activeSessionArchived, setActiveSessionArchived] = useState(false);
  const [showArchivedSessions, setShowArchivedSessions] = useState(false);
  const [controlPlane, setControlPlane] = useState<{ sessionId: string; runId: string }>();
  const [plan, setPlan] = useState<AgentPlanResponse>();
  const [liveObservationItems, setLiveObservationItems] = useState<AgentObservationTimelineItem[]>([]);
  const [liveRequestId, setLiveRequestId] = useState<string>();
  const [processStatus, setProcessStatus] = useState<AgentProcessStatus>("IDLE");
  const [processStartedAt, setProcessStartedAt] = useState<number>();
  const [processElapsedMs, setProcessElapsedMs] = useState(0);
  const [processExpanded, setProcessExpanded] = useState(true);
  const [executionInProgress, setExecutionInProgress] = useState(false);
  const [executionResults, setExecutionResults] = useState<AgentToolExecutionResult[]>([]);
  const [executionAnswer, setExecutionAnswer] = useState<ExecutionAnswer>();
  const [planFailure, setPlanFailure] = useState<AgentPlanFailure>();
  const [taskImportArtifact, setTaskImportArtifact] = useState<SyncTaskImportArtifact>();
  const [taskImportRunImmediately, setTaskImportRunImmediately] = useState(false);
  const [showAdvancedClarification, setShowAdvancedClarification] = useState(false);
  const [configurationReviewConfirmed, setConfigurationReviewConfirmed] = useState(false);
  const [followUpMessage, setFollowUpMessage] = useState("");
  const [conversationMessages, setConversationMessages] = useState<AgentChatMessage[]>([]);
  const [historicalRunProcesses, setHistoricalRunProcesses] = useState<HistoricalAgentRunProcess[]>([]);
  const [historyPlaybackWarning, setHistoryPlaybackWarning] = useState<string>();
  const autoAdvanceTurnRef = useRef<string>();
  const mappingDefaultsPromptTurnRef = useRef<string>();
  const processStartedAtRef = useRef<number>();
  const streamElapsedMsRef = useRef<number>();
  const processOwnerRef = useRef<"PLAN" | "EXECUTION">();
  const activePlanAbortControllerRef = useRef<AbortController>();
  const activePlanRequestRef = useRef<{
    tenantId: string;
    projectId: string;
    actorId: string;
    requestId: string;
  }>();
  const planStopRequestedRef = useRef(false);
  const reviewEditSnapshotRef = useRef<{
    values: Partial<ClarificationFormValues>;
    controlPlane?: { sessionId: string; runId: string };
    reviewConfirmed: boolean;
  }>();
  const historyProjectRef = useRef(selectedProjectId);

  /**
   * 项目是会话、数据源和任务的可见性边界。切换项目时必须停止旧请求并清空所有运行态，不能让旧项目的
   * sessionId、对话消息或执行结果被带入新项目；新的自然语言请求会生成全新的浏览器会话编号。
   */
  useEffect(() => {
    if (historyProjectRef.current === selectedProjectId) return;
    historyProjectRef.current = selectedProjectId;
    activePlanAbortControllerRef.current?.abort();
    setAgentConversationSessionId(crypto.randomUUID());
    setActiveAgentRuntimeSessionId(undefined);
    setActiveSessionArchived(false);
    setConversationMessages([]);
    setHistoricalRunProcesses([]);
    setHistoryPlaybackWarning(undefined);
    setPlan(undefined);
    setControlPlane(undefined);
    setLiveObservationItems([]);
    setExecutionResults([]);
    setExecutionAnswer(undefined);
    setPlanFailure(undefined);
    setFollowUpMessage("");
  }, [selectedProjectId]);

  const beginAgentProcess = (owner: "PLAN" | "EXECUTION") => {
    const startedAt = Date.now();
    processOwnerRef.current = owner;
    processStartedAtRef.current = startedAt;
    streamElapsedMsRef.current = undefined;
    setProcessStartedAt(startedAt);
    setProcessElapsedMs(0);
    setProcessStatus("RUNNING");
    setProcessExpanded(true);
  };

  const finishAgentProcess = (
    owner: "PLAN" | "EXECUTION",
    status: Exclude<AgentProcessStatus, "IDLE" | "RUNNING">,
  ) => {
    if (processOwnerRef.current !== owner) return;
    const measuredElapsedMs = processStartedAtRef.current
      ? Date.now() - processStartedAtRef.current
      : 0;
    setProcessElapsedMs(Math.max(streamElapsedMsRef.current ?? 0, measuredElapsedMs));
    setProcessStatus(status);
    setProcessExpanded(false);
    processOwnerRef.current = undefined;
  };

  useEffect(() => {
    if (processStatus !== "RUNNING" || !processStartedAt) return;
    const updateElapsed = () => setProcessElapsedMs(Date.now() - processStartedAt);
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 250);
    return () => window.clearInterval(timer);
  }, [processStartedAt, processStatus]);

  useEffect(() => () => {
    // 页面切换同样属于当前流的生命周期结束。服务端还会根据 NDJSON 断连取消工作线程，避免后台继续计费。
    activePlanAbortControllerRef.current?.abort();
  }, []);

  const sessionQuery = useQuery({
    queryKey: ["agent-assistant-session"],
    queryFn: api.getSession,
    retry: false,
  });
  const session = sessionQuery.data?.data;
  const projectId = selectedProjectId ? Number(selectedProjectId) : undefined;
  /**
   * 历史查询键同时包含项目和归档分区，使 React Query 不会把项目 A 或已归档列表缓存展示到项目 B 的
   * 活跃列表。后端会再次按 tenant/project/actor 做对象级过滤。
   */
  const sessionHistoryQuery = useQuery({
    queryKey: ["agent-assistant-session-history", projectId, showArchivedSessions],
    queryFn: () => api.listAgentSessions({ archived: showArchivedSessions, limit: 100 }),
    enabled: Boolean(projectId && session?.actorId),
    retry: false,
  });
  const sessionHistory = sessionHistoryQuery.data?.data ?? [];
  /**
   * 恢复完整持久会话，而不是只把标题填回输入框。成功后同步恢复消息、目标和 runtime sessionId，
   * 清空上一次临时计划与执行结果，确保下一次追问创建新 Run 但仍归属于所选历史会话。
   */
  const loadSessionMutation = useMutation({
    /**
     * 一次加载完整会话后，再按 Run 并行读取审计和批量结果。
     * 单个旧 Run 的过程接口失败不会阻断整个会话，页面仍展示消息并明确提示哪些过程事实未恢复。
     */
    mutationFn: async (sessionId: string) => {
      const sessionResult = await api.getAgentSession(sessionId);
      let failedRunCount = 0;
      const processes = await Promise.all(sessionResult.data.runs.map(async (run) => {
        const [auditsResult, resultsResult] = await Promise.allSettled([
          api.listAgentToolExecutions(sessionId, run.runId),
          api.listAgentToolExecutionResults(sessionId, run.runId),
        ]);
        if (auditsResult.status === "rejected" || resultsResult.status === "rejected") {
          failedRunCount += 1;
        }
        return {
          run,
          audits: auditsResult.status === "fulfilled" ? auditsResult.value.data : [],
          results: resultsResult.status === "fulfilled" ? resultsResult.value.data : [],
        } satisfies HistoricalAgentRunProcess;
      }));
      processes.sort((left, right) => (
        new Date(left.run.createTime || 0).getTime() - new Date(right.run.createTime || 0).getTime()
      ));
      return { sessionResult, processes, failedRunCount };
    },
    onMutate: () => {
      // 切换历史会话前停止旧页面流，防止旧请求结束后把计划和消息写入刚打开的另一个会话。
      activePlanAbortControllerRef.current?.abort();
      processOwnerRef.current = undefined;
    },
    onSuccess: (result) => {
      const historicalSession = result.sessionResult.data;
      setActiveAgentRuntimeSessionId(historicalSession.sessionId);
      setAgentConversationSessionId(historicalSession.sessionId);
      setActiveSessionArchived(historicalSession.archived);
      setObjective(historicalSession.objective);
      objectiveForm.setFieldsValue({ objective: historicalSession.objective });
      setConversationMessages(historicalSession.messages.map((item) => ({
        id: item.messageId,
        role: item.role,
        content: item.content,
        runId: item.runId,
        createTime: item.createTime,
      })));
      setHistoricalRunProcesses(result.processes);
      setHistoryPlaybackWarning(result.failedRunCount
        ? `有 ${result.failedRunCount} 个旧 Run 的部分过程事实暂时无法读取，消息与其余过程已正常恢复。`
        : undefined);
      setPlan(undefined);
      setControlPlane(undefined);
      setExecutionResults([]);
      setExecutionAnswer(undefined);
      setPlanFailure(undefined);
      setLiveObservationItems([]);
      setLiveRequestId(undefined);
      setFollowUpMessage("");
      setProcessStatus("IDLE");
      setProcessStartedAt(undefined);
      setProcessElapsedMs(0);
      setProcessExpanded(false);
      setConfigurationReviewConfirmed(false);
      setShowAdvancedClarification(false);
      // 历史会话依靠其持久消息、Run 与 Agent memory 继续推理，不能夹带刚才另一个会话的临时表单值。
      clarificationForm.resetFields();
      quickClarificationForm.resetFields();
    },
    onError: (error) => message.error(errorMessage(error)),
  });
  /** 修改置顶后使当前项目的两个历史分区缓存同时失效，以便服务端排序立即生效。 */
  const pinSessionMutation = useMutation({
    mutationFn: ({ sessionId, enabled }: { sessionId: string; enabled: boolean }) => (
      api.setAgentSessionPinned(sessionId, enabled)
    ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agent-assistant-session-history", projectId] });
    },
    onError: (error) => message.error(errorMessage(error)),
  });
  /**
   * 归档或恢复后刷新历史列表；若操作的是当前会话，还要同步编辑区只读状态，防止归档会话继续执行。
   */
  const archiveSessionMutation = useMutation({
    mutationFn: ({ sessionId, enabled }: { sessionId: string; enabled: boolean }) => (
      api.setAgentSessionArchived(sessionId, enabled)
    ),
    onSuccess: (result) => {
      if (result.data.sessionId === activeAgentRuntimeSessionId) {
        setActiveSessionArchived(result.data.archived);
      }
      void queryClient.invalidateQueries({ queryKey: ["agent-assistant-session-history", projectId] });
    },
    onError: (error) => message.error(errorMessage(error)),
  });
  const clarificationWatchOptions = { form: clarificationForm, preserve: true } as const;
  const clarificationSourceDatasourceId = Form.useWatch("sourceDatasourceId", clarificationWatchOptions);
  const clarificationTargetDatasourceId = Form.useWatch("targetDatasourceId", clarificationWatchOptions);
  const clarificationSyncMode = Form.useWatch("syncMode", clarificationWatchOptions);
  const clarificationTaskName = Form.useWatch("taskName", clarificationWatchOptions);
  const clarificationWriteStrategy = Form.useWatch("writeStrategy", clarificationWatchOptions);
  const clarificationScheduleConfig = Form.useWatch("scheduleConfig", clarificationWatchOptions);
  const clarificationCustomSqlText = Form.useWatch("customSqlText", clarificationWatchOptions);
  const clarificationMappingDefaultsConfirmed = Form.useWatch("mappingDefaultsConfirmed", clarificationWatchOptions);
  const watchedClarificationMappings = Form.useWatch("objectMappings", clarificationWatchOptions);
  const clarificationMappings = useMemo(
    () => watchedClarificationMappings ?? [],
    [watchedClarificationMappings],
  );
  const latestResolvedConfiguration = plan?.agentConversation?.resolvedConfiguration;
  const latestDraftArguments = plan?.plan?.toolPlans.find(
    (item) => item.toolName === "sync.task.draft.save",
  )?.arguments;
  const latestSourceMetadataArguments = plan?.plan?.toolPlans.find(
    (item) => item.toolName === "datasource.source.metadata.read",
  )?.arguments;
  const latestTargetMetadataArguments = plan?.plan?.toolPlans.find(
    (item) => item.toolName === "datasource.target.metadata.read",
  )?.arguments;
  const effectiveSourceDatasourceId = clarificationSourceDatasourceId
    ?? latestResolvedConfiguration?.sourceDatasourceId
    ?? numberField(latestDraftArguments, "sourceDatasourceId")
    ?? numberField(latestSourceMetadataArguments, "datasourceId");
  const effectiveTargetDatasourceId = clarificationTargetDatasourceId
    ?? latestResolvedConfiguration?.targetDatasourceId
    ?? numberField(latestDraftArguments, "targetDatasourceId")
    ?? numberField(latestTargetMetadataArguments, "datasourceId");
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
  const sourceDatasources = useMemo(
    () => sourceQuery.data?.data.records ?? [],
    [sourceQuery.data?.data.records],
  );
  const targetDatasources = useMemo(
    () => targetQuery.data?.data.records ?? [],
    [targetQuery.data?.data.records],
  );
  const sourceOptions = useMemo(
    () => sourceDatasources.map((item) => ({
      value: item.id,
      label: `#${item.id} ${item.name}（${item.type}）`,
    })),
    [sourceDatasources],
  );
  const targetOptions = useMemo(
    () => targetDatasources.map((item) => ({
      value: item.id,
      label: `#${item.id} ${item.name}（${item.type}）`,
    })),
    [targetDatasources],
  );
  const selectedSourceDatasource = sourceDatasources.find(
    (item) => Number(item.id) === Number(effectiveSourceDatasourceId),
  );
  const selectedTargetDatasource = targetDatasources.find(
    (item) => Number(item.id) === Number(effectiveTargetDatasourceId),
  );
  const sourceMetadataQuery = useQuery({
    queryKey: ["agent-assistant-source-metadata", projectId, effectiveSourceDatasourceId],
    queryFn: () => api.discoverSyncTaskMetadata({
      datasourceId: Number(effectiveSourceDatasourceId),
      side: "SOURCE",
      connectorType: selectedSourceDatasource?.type,
      filterMode: "ALL",
      includeColumns: true,
      includeViews: true,
      maxTables: 500,
      maxColumnsPerTable: 160,
    }),
    enabled: Boolean(projectId && effectiveSourceDatasourceId),
    staleTime: 30_000,
  });
  const targetMetadataQuery = useQuery({
    queryKey: ["agent-assistant-target-metadata", projectId, effectiveTargetDatasourceId],
    queryFn: () => api.discoverSyncTaskMetadata({
      datasourceId: Number(effectiveTargetDatasourceId),
      side: "TARGET",
      connectorType: selectedTargetDatasource?.type,
      filterMode: "ALL",
      includeColumns: true,
      includeViews: true,
      maxTables: 500,
      maxColumnsPerTable: 160,
    }),
    enabled: Boolean(projectId && effectiveTargetDatasourceId),
    staleTime: 30_000,
  });
  const sourceMetadata = sourceMetadataQuery.data?.data;
  const targetMetadata = targetMetadataQuery.data?.data;
  const sourceTableOptions = useMemo(() => metadataTableOptions(sourceMetadata), [sourceMetadata]);
  const targetTableOptions = useMemo(() => metadataTableOptions(targetMetadata), [targetMetadata]);

  const updateClarificationMapping = (index: number, patch: Partial<ObjectMappingInput>) => {
    const mappings = [...(clarificationForm.getFieldValue("objectMappings") ?? [])];
    mappings[index] = {
      fieldMappings: [],
      ...mappings[index],
      ...patch,
    };
    clarificationForm.setFieldsValue({
      objectMappings: mappings,
      mappingDefaultsConfirmed: false,
    });
    quickClarificationForm.setFieldValue("mappingDefaultsConfirmed", false);
  };

  const selectSourceMappingTable = (index: number, sourceTableKey: string) => {
    const sourceTable = findMetadataTableByKey(sourceMetadata, sourceTableKey);
    if (!sourceTable) return;
    const sameNameTarget = findSameNameTargetTable(sourceTable, targetMetadata);
    const sameNameTargetIndex = sameNameTarget
      ? (targetMetadata?.tables ?? []).indexOf(sameNameTarget)
      : -1;
    const targetTableKey = sameNameTarget && sameNameTargetIndex >= 0
      ? tableObjectKey(sameNameTarget, sameNameTargetIndex)
      : undefined;
    updateClarificationMapping(index, {
      objectKey: `agent-${sourceTableKey}`,
      sourceTableKey,
      sourceSchemaName: sourceTable.schemaName,
      sourceObjectName: sourceTable.tableName,
      // Only an actual same-name table may be filled automatically. Never use
      // "the first target table" as a fallback because that creates false pairs.
      targetTableKey,
      targetSchemaName: sameNameTarget?.schemaName,
      targetObjectName: sameNameTarget?.tableName ?? "",
      fieldMappings: makeFieldMappings(
        sortedColumns(sourceTable),
        sortedColumns(sameNameTarget),
      ),
    });
  };

  const selectTargetMappingTable = (index: number, targetTableKey: string) => {
    const mapping = (clarificationForm.getFieldValue("objectMappings") ?? [])[index];
    const sourceTable = findMetadataTableByKey(sourceMetadata, mapping?.sourceTableKey);
    const targetTable = findMetadataTableByKey(targetMetadata, targetTableKey);
    if (!targetTable) return;
    updateClarificationMapping(index, {
      targetTableKey,
      targetSchemaName: targetTable.schemaName,
      targetObjectName: targetTable.tableName,
      fieldMappings: isSqlSyncMode(clarificationSyncMode)
        ? mapping?.fieldMappings ?? []
        : makeFieldMappings(sortedColumns(sourceTable), sortedColumns(targetTable)),
    });
  };

  const clearTargetMappingTable = (index: number) => {
    const mapping = (clarificationForm.getFieldValue("objectMappings") ?? [])[index];
    const sourceTable = findMetadataTableByKey(sourceMetadata, mapping?.sourceTableKey);
    updateClarificationMapping(index, {
      targetTableKey: undefined,
      targetSchemaName: undefined,
      targetObjectName: "",
      fieldMappings: isSqlSyncMode(clarificationSyncMode)
        ? []
        : makeFieldMappings(sortedColumns(sourceTable), []),
    });
  };

  const changeClarificationSyncMode = (mode: UserSyncMode) => {
    const realtime = isRealtimeSyncMode(mode);
    const sql = isSqlSyncMode(mode);
    clarificationForm.setFieldsValue({
      syncMode: mode,
      writeStrategy: realtime ? "UPDATE" : clarificationForm.getFieldValue("writeStrategy") || "INSERT",
      scheduleConfig: isScheduledSyncMode(mode)
        ? clarificationForm.getFieldValue("scheduleConfig")
          || '{"cron":"0 0 2 * * ?","timezone":"Asia/Shanghai"}'
        : undefined,
      customSqlText: sql ? clarificationForm.getFieldValue("customSqlText") : undefined,
      mappingDefaultsConfirmed: false,
      objectMappings: sql
        ? [{
            objectKey: "agent-sql-result",
            targetObjectName: "",
            fieldMappings: [],
          }]
        : [],
    });
  };

  const observedControlPlane = useMemo(() => {
    if (controlPlane) return controlPlane;
    const durableTurn = [...(plan?.agentDurableModelToolLoop?.turns ?? [])]
      .reverse()
      .find((turn) => turn.sessionId && turn.runId);
    const ingestion = plan?.controlPlaneIngestion;
    const hasCompleteLifecyclePlan = (plan?.plan?.toolPlans ?? [])
      .some((item) => item.toolName === "sync.task.draft.save");
    const sessionId = hasCompleteLifecyclePlan
      ? textField(ingestion, "sessionId") || durableTurn?.sessionId
      : durableTurn?.sessionId || textField(ingestion, "sessionId");
    const runId = hasCompleteLifecyclePlan
      ? textField(ingestion, "runId") || durableTurn?.runId
      : durableTurn?.runId || textField(ingestion, "runId");
    return sessionId && runId ? { sessionId, runId } : undefined;
  }, [controlPlane, plan]);

  const auditsQuery = useQuery({
    queryKey: ["agent-assistant-audits", observedControlPlane?.sessionId, observedControlPlane?.runId],
    queryFn: () => api.listAgentToolExecutions(observedControlPlane!.sessionId, observedControlPlane!.runId),
    enabled: Boolean(observedControlPlane?.sessionId && observedControlPlane?.runId),
    // 用户确认执行后按 1 秒刷新真实工具审计，让正在执行和刚完成的节点及时进入时间线。
    // 未开始执行时保留较低频率，避免等待确认阶段产生无意义的控制面压力。
    refetchInterval: observedControlPlane && !executionAnswer
      ? (executionInProgress || processStatus === "RUNNING" ? 1000 : 3000)
      : false,
  });
  const audits = useMemo(() => auditsQuery.data?.data ?? [], [auditsQuery.data?.data]);

  /**
   * 重试与脏数据重放只表示“进入业务执行队列”，并不等于迁移已经成功。
   * 这里持续读取 data-sync 的真实 execution 账本，把业务进度追加到 Agent 时间线；
   * 只有 execution 到达终态后，才允许模型进入下一轮验证与恢复决策。
   */
  const waitForRecoveryExecution = async (taskId: number, expectedExecutionId?: number) => {
    const timelineId = `recovery-execution-${taskId}-${expectedExecutionId || Date.now()}`;
    const updateTimeline = (item: AgentObservationTimelineItem) => {
      setLiveObservationItems((current) => {
        const existingIndex = current.findIndex((candidate) => candidate.id === timelineId);
        if (existingIndex < 0) return [...current, item];
        const next = [...current];
        next[existingIndex] = item;
        return next;
      });
    };

    for (let attempt = 1; attempt <= 300; attempt += 1) {
      try {
        const response = await api.listSyncExecutions(taskId);
        const executions = [...response.data.records].sort((left, right) => Number(right.id) - Number(left.id));
        const execution = expectedExecutionId
          ? executions.find((item) => Number(item.id) === expectedExecutionId)
          : executions[0];
        if (!execution) {
          updateTimeline({
            id: timelineId,
            category: "COMMAND",
            stage: "wait_recovery_execution",
            status: "RUNNING",
            title: "等待 data-sync 创建恢复 execution",
            summary: `任务 #${taskId} 已进入恢复链路，正在等待 worker 接收执行。`,
            details: { taskId, expectedExecutionId, pollAttempt: attempt },
          });
          await wait(1000);
          continue;
        }

        const state = String(execution.executionState || "QUEUED").toUpperCase();
        updateTimeline({
          id: timelineId,
          category: "COMMAND",
          stage: "wait_recovery_execution",
          status: terminalSyncExecutionStates.has(state)
            ? (state === "SUCCEEDED" ? "SUCCEEDED" : state)
            : "RUNNING",
          title: `跟踪同步恢复执行 #${execution.id}`,
          summary: syncExecutionSummary(execution),
          details: {
            taskId,
            executionId: execution.id,
            executionState: state,
            recordsRead: execution.recordsRead ?? 0,
            recordsWritten: execution.recordsWritten ?? 0,
            failedRecordCount: execution.failedRecordCount ?? 0,
            executorId: execution.executorId,
            heartbeatTime: execution.heartbeatTime,
            pollAttempt: attempt,
          },
        });
        if (terminalSyncExecutionStates.has(state)) return execution;
      } catch (error) {
        updateTimeline({
          id: timelineId,
          category: "COMMAND",
          stage: "wait_recovery_execution",
          status: "RUNNING",
          title: "恢复执行状态暂时不可用",
          summary: `${errorMessage(error)}；Agent 会继续重试读取真实执行账本。`,
          details: { taskId, expectedExecutionId, pollAttempt: attempt },
        });
      }
      await wait(1000);
    }

    updateTimeline({
      id: timelineId,
      category: "USER_ACTION",
      stage: "wait_recovery_execution",
      status: "WAITING",
      title: "同步恢复执行仍在运行",
      summary: `任务 #${taskId} 在 5 分钟观察窗口内尚未结束；当前不会基于未完成结果继续模型决策。`,
      details: { taskId, expectedExecutionId, timeoutSeconds: 300 },
    });
    return undefined;
  };

  const consumePlanStreamFrame = (frame: AgentPlanStreamFrame) => {
    if (frame.requestId) setLiveRequestId(frame.requestId);
    if ((frame.type === "heartbeat" || frame.type === "result" || frame.type === "error")
      && frame.elapsedMs !== undefined) {
      streamElapsedMsRef.current = frame.elapsedMs;
      setProcessElapsedMs(frame.elapsedMs);
    }
    if (frame.type === "heartbeat") {
      const elapsedSeconds = Math.max(1, Math.round((frame.elapsedMs ?? 0) / 1000));
      setLiveObservationItems((current) => {
        const runningIndex = current.length - 1;
        if (runningIndex < 0 || current[runningIndex].status !== "RUNNING") return current;
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
      const next = current.map((candidate) => (
        candidate.status === "RUNNING" && candidate.stage === item.stage
          ? { ...candidate, status: "SUCCEEDED" }
          : candidate
      ));
      const existingIndex = next.findIndex((candidate) => candidate.id === item.id);
      if (existingIndex < 0) return [...next, item];
      next[existingIndex] = item;
      return next;
    });
  };

  /**
   * 提交一个自然语言回合并驱动流式 Agent 规划。
   *
   * startNewSession 明确区分“新目标”和“继续历史”：新目标不携带旧 runtime sessionId；追问优先复用
   * Java 控制面 sessionId，让持久消息、委托、Run 和审计都追加在同一聚合中。
   */
  const planMutation = useMutation({
    mutationFn: async (submission: PlanSubmission) => {
      if (!session?.tenantId || !projectId || !session.actorId) {
        throw new Error("缺少登录租户、项目或操作者上下文，请先选择项目");
      }
      const latestUserMessage = submission.followUpMessage?.trim();
      const requestConversation = submission.conversationContext ?? conversationMessages;
      const lastConversationMessage = requestConversation[requestConversation.length - 1];
      const currentTurnAlreadyIncluded = Boolean(
        latestUserMessage
        && lastConversationMessage?.role === "USER"
        && lastConversationMessage.content === latestUserMessage,
      );
      const completeConversation = latestUserMessage && !currentTurnAlreadyIncluded
        ? [...requestConversation, {
            id: `request-user-${crypto.randomUUID()}`,
            role: "USER" as const,
            content: latestUserMessage,
          }]
        : requestConversation;
      const continuedRuntimeSessionId = activeAgentRuntimeSessionId || controlPlane?.sessionId;
      const variables: Record<string, unknown> = {
        frontendSurface: "UserAgentAssistant",
        runtimeProfile: "production",
        sessionId: agentConversationSessionId,
        // 新会话禁止复用旧控制面状态；历史追问必须优先使用左侧所选的真实 runtime sessionId。
        // 这一区分正是“同一会话新增 Run”和“新建会话”的持久化边界，不能只依赖聊天内容是否相同。
        agentRuntimeSessionId: submission.startNewSession
          ? undefined
          : continuedRuntimeSessionId,
        cacheKeyScope: "session_only",
        conversationMessages: completeConversation.slice(-12).map((item) => ({
          role: item.role === "USER" ? "user" : "assistant",
          content: item.content,
        })),
        // Responses/Chat SSE 只传输经过累计脱敏的公开 assistant 文本。隐藏推理、系统提示词、
        // Provider 原始事件和未闭合工具参数不会进入浏览器，完整工具调用仍需聚合后通过治理才能执行。
        streamModelIntent: true,
      };
      if (latestUserMessage) {
        variables.latestUserMessage = latestUserMessage;
        variables.conversationMode = "CLARIFICATION_OR_CORRECTION";
        variables.previousTurnId = plan?.agentConversation?.turnId;
        variables.previousIntentType = plan?.agentConversation?.structuredIntent.intentType;
      }
      if (submission.clarification) {
        const clarification = submission.clarification;
        const selectedMode = normalizeUserSyncMode(
          clarification.syncMode
          || plan?.agentConversation?.structuredIntent.syncMode,
        );
        const dataSyncRequest: Record<string, unknown> = {
          taskDescription: submission.objective,
          groupCode: "DEFAULT",
          groupName: "默认分组",
        };
        if (clarification.taskName) dataSyncRequest.taskName = clarification.taskName;
        if (clarification.sourceDatasourceId) {
          dataSyncRequest.sourceDatasourceId = clarification.sourceDatasourceId;
        }
        if (clarification.targetDatasourceId) {
          dataSyncRequest.targetDatasourceId = clarification.targetDatasourceId;
        }
        if (selectedMode) {
          dataSyncRequest.syncMode = selectedMode;
          dataSyncRequest.writeStrategy = isRealtimeSyncMode(selectedMode)
            ? "UPDATE"
            : clarification.writeStrategy;
          if (isScheduledSyncMode(selectedMode)) {
            const scheduleConfig = clarification.scheduleConfig || buildAgentScheduleConfig(
              clarification.scheduleFrequency,
              clarification.scheduleStartTime,
              clarification.scheduleCron,
            );
            if (scheduleConfig) dataSyncRequest.scheduleConfig = scheduleConfig;
          }
          if (isSqlSyncMode(selectedMode) && clarification.customSqlText) {
            dataSyncRequest.customSqlText = clarification.customSqlText;
          }
        }
        if (clarification.customSqlConfirmed !== undefined) {
          dataSyncRequest.customSqlConfirmed = clarification.customSqlConfirmed;
        }
        if (clarification.targetTableResolution) {
          dataSyncRequest.targetTableResolution = clarification.targetTableResolution;
        }
        if (clarification.mappingDefaultsConfirmed !== undefined) {
          dataSyncRequest.mappingDefaultsConfirmed = clarification.mappingDefaultsConfirmed;
        }
        if (clarification.objectMappings?.length) {
          dataSyncRequest.objectMappings = clarification.objectMappings.map((item, index) => ({
            objectKey: item.objectKey || `agent-mapping-${index + 1}`,
            sourceSchemaName: selectedMode && isSqlSyncMode(selectedMode) ? undefined : item.sourceSchemaName,
            sourceObjectName: selectedMode && isSqlSyncMode(selectedMode) ? undefined : item.sourceObjectName,
            targetSchemaName: item.targetSchemaName,
            targetObjectName: item.targetObjectName,
            whereCondition: selectedMode && isSqlSyncMode(selectedMode) ? undefined : item.whereCondition,
            fieldMappings: item.fieldMappings
              .filter((field) => field.syncEnabled !== false && field.sourceField && field.targetField)
              .map((field) => ({
                sourceField: field.sourceField,
                sourceType: field.sourceType,
                targetField: field.targetField,
                targetType: field.targetType,
                nullable: field.nullable,
                primaryKey: field.primaryKey,
                syncEnabled: true,
                typeCompatible: field.typeCompatible,
                transform: field.transform,
              })),
          }));
        }
        variables.dataSyncRequest = dataSyncRequest;
      }
      if (submission.taskImportArtifactRef) {
        variables.taskImportArtifactRef = submission.taskImportArtifactRef;
        variables.taskImportRunImmediately = Boolean(submission.taskImportRunImmediately);
      }
      if (submission.recoveryTaskId) {
        variables.taskId = submission.recoveryTaskId;
        variables.diagnoseSyncExecution = true;
      }
      if (submission.recoveryExecutionId) {
        variables.executionId = submission.recoveryExecutionId;
        variables.recoveryExecutionId = submission.recoveryExecutionId;
      }
      const requestId = crypto.randomUUID();
      const abortController = new AbortController();
      activePlanAbortControllerRef.current = abortController;
      activePlanRequestRef.current = {
        tenantId: String(session.tenantId),
        projectId: String(projectId),
        actorId: String(session.actorId),
        requestId,
      };
      return api.createAgentPlanStream({
        tenant_id: String(session.tenantId),
        project_id: String(projectId),
        actor_id: String(session.actorId),
        request_id: requestId,
        objective: submission.objective,
        preferred_workload: "agent_reasoning",
        locale: "zh-CN",
        variables,
      }, consumePlanStreamFrame, { signal: abortController.signal });
    },
    onMutate: (submission) => {
      planStopRequestedRef.current = false;
      beginAgentProcess("PLAN");
      // A new natural-language turn or form submission may change the task
      // definition. The previous control-plane confirmation must never remain
      // executable while the latest configuration is being resolved.
      setControlPlane(undefined);
      setConfigurationReviewConfirmed(false);
      setPlanFailure(undefined);
      if (!submission.preserveTimeline) {
        setLiveObservationItems([]);
        setLiveRequestId(undefined);
      }
    },
    onSuccess: (result, submission) => {
      finishAgentProcess("PLAN", "SUCCEEDED");
      const nextPlan = result.data;
      const conversation = nextPlan.agentConversation;
      if (submission.preserveTimeline) {
        const historyScope = plan?.agentObservationTimeline?.requestId || plan?.plan?.requestId || "previous";
        const planningHistory = (plan?.agentObservationTimeline?.items ?? []).map((item) => ({
          ...item,
          id: `history-${historyScope}-${item.id}`,
        }));
        const auditHistory = audits.map((audit) => ({
          id: `history-audit-${audit.auditId}`,
          category: "TOOL",
          stage: "execute_java_tool",
          status: audit.state,
          title: `调用工具：${humanReadableToolName(audit.toolCode)}`,
          summary: audit.message || audit.planReason || "Java Agent Runtime 已处理该工具节点。",
          details: {
            auditId: audit.auditId,
            toolCode: audit.toolCode,
            targetService: audit.targetService,
            riskLevel: audit.riskLevel,
            requiresHumanApproval: audit.requiresApproval,
            outputSummary: audit.outputSummary,
            errorCode: audit.errorCode,
          },
        } satisfies AgentObservationTimelineItem));
        const resultHistory = executionResults.map((item) => ({
          id: `history-result-${item.audit.auditId}`,
          category: "TOOL",
          stage: "tool_result_received",
          status: item.audit.state,
          title: `工具结果：${humanReadableToolName(item.audit.toolCode)}`,
          summary: item.audit.message || item.audit.outputSummary || "工具已返回受治理结果。",
          details: {
            toolCode: item.audit.toolCode,
            result: item.output,
          },
        } satisfies AgentObservationTimelineItem));
        setLiveObservationItems((current) => {
          const merged = new Map(current.map((item) => [item.id, item]));
          [...planningHistory, ...auditHistory, ...resultHistory].forEach((item) => merged.set(item.id, item));
          return [...merged.values()];
        });
      }
      setPlan(nextPlan);
      const ingestedRuntimeSessionId = textField(nextPlan.controlPlaneIngestion, "sessionId");
      const ingestedRuntimeRunId = textField(nextPlan.controlPlaneIngestion, "runId");
      if (ingestedRuntimeSessionId) {
        setActiveAgentRuntimeSessionId(ingestedRuntimeSessionId);
        setActiveSessionArchived(false);
      }
      setLiveObservationItems((current) => current.map((item) => (
        item.id.startsWith("live-") && item.status === "RUNNING"
          ? {
              ...item,
              status: "SUCCEEDED",
              summary: "本轮阶段已完成，后续结果已写入当前会话。",
            }
          : item
      )));
      setExecutionResults([]);
      setExecutionAnswer(undefined);
      if (submission.followUpMessage) setFollowUpMessage("");
      if (conversation?.assistantMessage) {
        const messageId = `agent-${conversation.turnId || nextPlan.plan?.requestId || crypto.randomUUID()}`;
        setConversationMessages((current) => {
          const associatedMessages = [...current];
          // 新回合提交时，用户消息先在浏览器即时出现；Java Run ID 要到流式规划结束后才产生。
          // 这里把最后一条尚未关联的用户消息补上真实 Run ID，使当前页面与稍后重新加载的历史排序一致。
          if (ingestedRuntimeRunId && (submission.followUpMessage || submission.startNewSession)) {
            let userIndex = -1;
            for (let index = associatedMessages.length - 1; index >= 0; index -= 1) {
              if (associatedMessages[index].role === "USER" && !associatedMessages[index].runId) {
                userIndex = index;
                break;
              }
            }
            if (userIndex >= 0) {
              associatedMessages[userIndex] = { ...associatedMessages[userIndex], runId: ingestedRuntimeRunId };
            }
          }
          const existingIndex = associatedMessages.findIndex((item) => item.id === messageId);
          if (existingIndex >= 0) {
            associatedMessages[existingIndex] = {
              ...associatedMessages[existingIndex],
              content: conversation.assistantMessage,
              runId: ingestedRuntimeRunId || associatedMessages[existingIndex].runId,
            };
            return associatedMessages;
          }
          return [...associatedMessages, {
            id: messageId,
            role: "AGENT",
            content: conversation.assistantMessage,
            runId: ingestedRuntimeRunId,
          }];
        });
      }

      if (conversation?.resolvedConfiguration) {
        const resolved = conversation.resolvedConfiguration;
        const inferredMode = normalizeUserSyncMode(
          resolved.syncMode || conversation.structuredIntent.syncMode,
        );
        const currentValues = clarificationForm.getFieldsValue(true);
        const resolvedMappings = resolvedObjectMappings(resolved.objectMappings);
        const nextValues: Partial<ClarificationFormValues> = {
          taskName: currentValues.taskName || resolved.taskName || "Agent 创建的数据同步任务",
          syncMode: inferredMode,
          writeStrategy: isRealtimeSyncMode(inferredMode)
            ? "UPDATE"
            : (resolved.writeStrategy === "UPDATE" ? "UPDATE" : currentValues.writeStrategy || "INSERT"),
          scheduleConfig: resolved.scheduleConfig || currentValues.scheduleConfig,
          customSqlText: resolved.customSqlText || currentValues.customSqlText,
          customSqlConfirmed: resolved.customSqlConfirmed ?? currentValues.customSqlConfirmed,
          sourceDatasourceId: resolved.sourceDatasourceId || currentValues.sourceDatasourceId,
          targetDatasourceId: resolved.targetDatasourceId || currentValues.targetDatasourceId,
          targetTableResolution: resolved.targetTableResolution === "CREATE_FROM_SOURCE"
            || resolved.targetTableResolution === "SELECT_EXISTING"
            ? resolved.targetTableResolution
            : currentValues.targetTableResolution,
          mappingDefaultsConfirmed: resolved.mappingDefaultsConfirmed
            ?? currentValues.mappingDefaultsConfirmed,
          objectMappings: resolvedMappings.length
            ? resolvedMappings
            : currentValues.objectMappings?.length
              ? currentValues.objectMappings
              : [{
                  objectKey: isSqlSyncMode(inferredMode) ? "agent-sql-result" : "agent-mapping-1",
                  targetObjectName: "",
                  fieldMappings: [],
                }],
          ...submission.clarification,
        };
        if (submission.followUpMessage) {
          if (resolved.taskName) nextValues.taskName = resolved.taskName;
          if (resolved.syncMode) nextValues.syncMode = inferredMode;
          if (resolved.writeStrategy) {
            nextValues.writeStrategy = resolved.writeStrategy === "UPDATE" ? "UPDATE" : "INSERT";
          }
          if (resolved.scheduleConfig) nextValues.scheduleConfig = resolved.scheduleConfig;
          if (resolved.customSqlText) nextValues.customSqlText = resolved.customSqlText;
        }
        // Tool-resolved values are authoritative for the current turn. Merge
        // them while autonomous discovery is still running as well as when a
        // user-facing clarification is required, so metadata queries can start
        // immediately instead of waiting for the advanced editor to be opened.
        if (resolved.sourceDatasourceId) nextValues.sourceDatasourceId = resolved.sourceDatasourceId;
        if (resolved.targetDatasourceId) nextValues.targetDatasourceId = resolved.targetDatasourceId;
        if (resolvedMappings.length) nextValues.objectMappings = resolvedMappings;
        clarificationForm.setFieldsValue(nextValues);
        quickClarificationForm.setFieldsValue(nextValues);
      }

      if (conversation?.phase === "WAITING_CLARIFICATION") {
        setControlPlane(undefined);
        const missing = new Set(conversation.missingParameters);
        const needsDirectMappingEditor = missing.has("objectMappings") || missing.has("fieldMappings");
        const hasEarlierProgressiveQuestion = [
          "sourceDatasourceId",
          "targetDatasourceId",
          "scheduleFrequency",
          "scheduleStartTime",
          "customSqlText",
          "customSqlConfirmation",
          "targetTableResolution",
          "fieldMappingConversions",
          "mappingDefaultsConfirmation",
        ].some((parameter) => missing.has(parameter));
        setShowAdvancedClarification(needsDirectMappingEditor && !hasEarlierProgressiveQuestion);
        message.info("Agent 已理解目标，请补充执行所需参数");
        return;
      }

      if (conversation?.phase === "RESOLVING_AUTONOMOUSLY") {
        setControlPlane(undefined);
        message.info(conversation.assistantMessage);
        return;
      }

      if (conversation?.phase === "NO_EXECUTABLE_PLAN") {
        setControlPlane(undefined);
        message.warning(conversation.assistantMessage);
        return;
      }

      const durableTurn = [...(nextPlan.agentDurableModelToolLoop?.turns ?? [])]
        .reverse()
        .find((turn) => turn.sessionId && turn.runId);
      const ingestion = nextPlan.controlPlaneIngestion;
      const hasCompleteLifecyclePlan = (nextPlan.plan?.toolPlans ?? [])
        .some((item) => item.toolName === "sync.task.draft.save");
      const sessionId = hasCompleteLifecyclePlan
        ? textField(ingestion, "sessionId") || durableTurn?.sessionId
        : durableTurn?.sessionId || textField(ingestion, "sessionId");
      const runId = hasCompleteLifecyclePlan
        ? textField(ingestion, "runId") || durableTurn?.runId
        : durableTurn?.runId || textField(ingestion, "runId");
      if (!sessionId || !runId) {
        setControlPlane(undefined);
        message.error("参数已补齐，但 Java 控制面未返回 sessionId/runId，请检查计划接入状态");
        return;
      }
      setControlPlane({ sessionId, runId });
      setActiveAgentRuntimeSessionId(sessionId);
      setAgentConversationSessionId(sessionId);
      setActiveSessionArchived(false);
      void queryClient.invalidateQueries({ queryKey: ["agent-assistant-session-history", projectId] });
      setShowAdvancedClarification(false);
      reviewEditSnapshotRef.current = undefined;
      message.success(hasCompleteLifecyclePlan
        ? "Agent 已生成完整任务生命周期计划，请审核后一次确认执行"
        : durableTurn
          ? "Agent 已推进到下一批 Durable 工具，请查看过程并确认需要授权的动作"
          : "Agent 已生成可审计执行计划，请确认后执行");
    },
    onError: (error) => {
      if (planStopRequestedRef.current || isAgentPlanAbort(error)) {
        finishAgentProcess("PLAN", "CANCELLED");
        setControlPlane(undefined);
        setConversationMessages((current) => [...current, {
          id: `agent-cancelled-${crypto.randomUUID()}`,
          role: "AGENT",
          content: "已停止本轮处理。已经展示的过程会保留，尚未提交的计划不会继续执行；已启动的同步任务不会被自动撤销。",
        }]);
        setLiveObservationItems((current) => [
          ...current.map((item) => item.status === "RUNNING"
            ? { ...item, status: "CANCELLED", summary: "用户已停止本轮 Agent 处理。" }
            : item),
          {
            id: `live-plan-cancelled-${activePlanRequestRef.current?.requestId || crypto.randomUUID()}`,
            category: "USER_ACTION",
            stage: "agent_plan_cancelled",
            status: "CANCELLED",
            title: "已停止模型思考",
            summary: "当前模型请求和后续 Agent 推理已停止；已提交的业务操作需在对应任务页面单独管理。",
            details: { requestId: activePlanRequestRef.current?.requestId || liveRequestId },
          },
        ]);
        message.info("已停止本轮 Agent 处理");
        return;
      }
      finishAgentProcess("PLAN", "FAILED");
      const summary = errorMessage(error);
      setPlanFailure(agentPlanFailure(error));
      setConversationMessages((current) => [...current, {
        id: `agent-error-${crypto.randomUUID()}`,
        role: "AGENT",
        content: `本轮处理失败：${summary}`,
      }]);
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
    onSettled: () => {
      activePlanAbortControllerRef.current = undefined;
      activePlanRequestRef.current = undefined;
      planStopRequestedRef.current = false;
    },
  });

  const stopCurrentAgentPlan = () => {
    const activeRequest = activePlanRequestRef.current;
    const abortController = activePlanAbortControllerRef.current;
    if (!planMutation.isPending || !activeRequest || !abortController) return;

    planStopRequestedRef.current = true;
    const cancellation = api.cancelAgentPlan({
      tenant_id: activeRequest.tenantId,
      project_id: activeRequest.projectId,
      actor_id: activeRequest.actorId,
      request_id: activeRequest.requestId,
      objective: "停止当前 Agent 规划",
      preferred_workload: "agent_reasoning",
      locale: "zh-CN",
    });
    // 本地读取必须立即停止，不等待取消 API 往返；服务端还会把连接断开作为第二重取消信号。
    abortController.abort();
    void cancellation.catch(() => {
      message.warning("页面已停止等待；服务端取消确认暂未返回，连接断开保护会继续终止当前模型请求");
    });
  };

  const artifactUploadMutation = useMutation({
    mutationFn: (file: File) => api.uploadSyncTaskImportArtifact(file),
    onSuccess: (result) => {
      setTaskImportArtifact(result.data);
      message.success("任务文件已上传为项目内受控制品，模型不会读取原始文件正文");
    },
    onError: (error) => message.error(errorMessage(error)),
  });

  const executeMutation = useMutation({
    mutationFn: async () => {
      if (!controlPlane) throw new Error("请先生成 Agent 计划");
      const approvedToolCodes = new Set((plan?.plan?.toolPlans ?? []).map((item) => item.toolName));
      const approvedSyncMode = normalizeUserSyncMode(
        clarificationForm.getFieldValue("syncMode") || plan?.agentConversation?.structuredIntent.syncMode,
      );
      const resultByAuditId = new Map<string, AgentToolExecutionResult>();
      const visitedRunIds = new Set<string>();
      let currentRunId = controlPlane.runId;
      let totalPlanned = 0;
      let totalSucceeded = 0;
      let totalFailed = 0;

      for (let batchIndex = 0; batchIndex < 6; batchIndex += 1) {
        if (visitedRunIds.has(currentRunId)) {
          throw new Error(`Agent continuation 出现重复 Run：${currentRunId}`);
        }
        visitedRunIds.add(currentRunId);
        const pendingRepair = executionAnswer?.repairProposal;
        const result = await api.confirmAndExecuteAgentRun(controlPlane.sessionId, currentRunId, {
          confirmed: true,
          comment: batchIndex === 0
            ? pendingRepair?.kind === "DUPLICATE_TASK_NAME"
              ? `用户确认将任务名称从“${pendingRepair.originalTaskName}”改为“${pendingRepair.proposedTaskName}”，并同意重新保存、预检查、发布和执行`
              : "用户已审核完整同步任务配置，同意执行本次计划"
            : "沿用用户对同一完整同步任务计划的确认，继续执行受控生命周期节点",
        });
        result.data.toolResults.forEach((item) => resultByAuditId.set(item.audit.auditId, item));
        totalPlanned += result.data.plannedCount;
        totalSucceeded += result.data.succeededCount;
        totalFailed += result.data.failedCount;

        const combinedResults = [...resultByAuditId.values()];
        const succeededToolCodes = new Set(combinedResults
          .filter((item) => item.audit.state === "SUCCEEDED")
          .map((item) => item.audit.toolCode));
        const taskSubmissionReached = succeededToolCodes.has("sync.task.run")
          || (["SCHEDULED_BATCH", "SCHEDULED_FULL", "CDC_STREAMING"].includes(approvedSyncMode)
            && succeededToolCodes.has("sync.task.publish"));
        const aggregateResult = {
          ...result,
          data: {
            ...result.data,
            runId: currentRunId,
            plannedCount: totalPlanned,
            succeededCount: totalSucceeded,
            failedCount: totalFailed,
            toolResults: combinedResults,
          },
        };
        if (result.data.failedCount > 0 || taskSubmissionReached) {
          return aggregateResult;
        }

        const continuation = result.data.continuation;
        const nextRunId = continuation?.nextRunId;
        if (!nextRunId) {
          return aggregateResult;
        }
        if (continuation.sessionId && continuation.sessionId !== controlPlane.sessionId) {
          throw new Error("Agent continuation 返回了不同会话，已阻止跨会话自动执行");
        }

        // One review may cover several Durable batches, but never tools that
        // were absent from the configuration plan shown to the user.
        const nextAudits = (await api.listAgentToolExecutions(controlPlane.sessionId, nextRunId)).data;
        const unexpectedTools = [...new Set(nextAudits
          .map((audit) => audit.toolCode)
          .filter((toolCode) => !approvedToolCodes.has(toolCode)))];
        if (!nextAudits.length || unexpectedTools.length) {
          throw new Error(unexpectedTools.length
            ? `下一批出现未审核工具：${unexpectedTools.join("、")}，需要重新生成并确认计划`
            : "下一批 Agent Run 没有可执行工具，已停止自动续跑");
        }
        currentRunId = nextRunId;
      }
      throw new Error("Agent 受控续跑批次超过安全上限，请查看运行诊断");
    },
    onMutate: () => {
      beginAgentProcess("EXECUTION");
      setExecutionInProgress(true);
    },
    onSuccess: async (result) => {
      setExecutionResults(result.data.toolResults);
      setLiveObservationItems((current) => {
        const merged = new Map(current.map((item) => [item.id, item]));
        result.data.toolResults.forEach((item) => merged.set(`history-result-${item.audit.auditId}`, {
          id: `history-result-${item.audit.auditId}`,
          category: "TOOL",
          stage: "tool_result_received",
          status: item.audit.state,
          title: `工具结果：${humanReadableToolName(item.audit.toolCode)}`,
          summary: item.audit.message || item.audit.outputSummary || "工具已返回受治理结果。",
          details: {
            toolCode: item.audit.toolCode,
            result: item.output,
          },
        }));
        return [...merged.values()];
      });
      const succeededToolCodes = new Set(result.data.toolResults
        .filter((item) => item.audit.state === "SUCCEEDED")
        .map((item) => item.audit.toolCode));
      const taskLifecycleReached = succeededToolCodes.has("sync.task.run")
        || (["SCHEDULED_BATCH", "SCHEDULED_FULL", "CDC_STREAMING"].includes(reviewSyncMode)
          && succeededToolCodes.has("sync.task.publish"));
      const createdTaskId = [...result.data.toolResults]
        .reverse()
        .map((item) => findNumericField(item.output, ["taskId", "syncTaskId"]))
        .find(Boolean);
      const createdExecutionId = [...result.data.toolResults]
        .reverse()
        .map((item) => findNumericField(item.output, ["executionId"]))
        .find(Boolean);
      if (result.data.failedCount > 0 || taskLifecycleReached) {
        const recoveryRunId = result.data.failedCount > 0
          ? result.data.continuation?.nextRunId
          : undefined;
        setExecutionAnswer({
          content: result.data.assistantReply || (result.data.failedCount > 0
            ? "同步任务创建或提交失败，Agent 正在根据失败事实继续诊断。"
            : "同步任务已创建并进入业务执行链路。"),
          status: result.data.failedCount > 0 ? "ERROR" : "SUCCESS",
          taskId: createdTaskId,
          executionId: createdExecutionId,
          failures: result.data.failures,
          recoveryRunId,
          recoveryRequiresConfirmation: Boolean(result.data.continuation?.requiresConfirmation),
          continuationStatus: result.data.continuation?.status,
          repairProposal: result.data.continuation?.repairProposal,
          recoveryRunUnavailableReason: result.data.continuation?.stoppedReason === "NEXT_RUN_NOT_DURABLE"
            ? result.data.continuation.message || result.data.continuation.assistantReply
            : undefined,
        });
        if (recoveryRunId && result.data.continuation?.sessionId) {
          setControlPlane({
            sessionId: result.data.continuation.sessionId,
            runId: recoveryRunId,
          });
          setConfigurationReviewConfirmed(false);
        }
      } else {
        // Read-only discovery is an intermediate Agent step, not a task
        // creation conclusion. Keep the review surface available to continue.
        setExecutionAnswer(undefined);
      }
      if (result.data.failedCount > 0) {
        const firstFailure = result.data.failures?.[0];
        message.error(firstFailure
          ? `${humanReadableToolName(firstFailure.toolCode)}失败：${firstFailure.message}`
          : `工具执行失败 ${result.data.failedCount} 个，Agent 已进入失败诊断`);
        const failureContinuation = result.data.continuation;
        if (failureContinuation?.assistantReply) {
          setLiveObservationItems((current) => [...current, {
            id: `failure-diagnosis-${result.data.runId}`,
            category: "MODEL",
            stage: "failure_diagnosis_completed",
            status: failureContinuation.requiresConfirmation ? "WAITING_APPROVAL" : "SUCCEEDED",
            title: "Agent 已分析失败事实",
            summary: failureContinuation.assistantReply || "Agent 已完成失败事实分析。",
            details: {
              sourceRunId: result.data.runId,
              recoveryRunId: failureContinuation.nextRunId,
              stoppedReason: failureContinuation.stoppedReason,
            },
          }]);
        }
      } else if (taskLifecycleReached) {
        message.success(isScheduledSyncMode(reviewSyncMode)
          ? "同步任务已创建并启用调度，可在同步任务列表查看"
          : isRealtimeSyncMode(reviewSyncMode)
            ? "实时同步任务已创建并交由实时通道运行，可在同步任务列表持续查看"
            : "同步任务已创建并提交执行，可在同步任务列表持续查看进度");
      } else {
        message.info("本轮只完成只读工具核对，尚未创建或运行同步任务");
      }
      await auditsQuery.refetch();
      const repairedArtifactRef = result.data.toolResults
        .filter((item) => item.audit.toolCode === "sync.task.import.repair.apply" && item.audit.state === "SUCCEEDED")
        .map((item) => findArtifactRef(item.output))
        .find(Boolean);
      if (repairedArtifactRef) {
        setTaskImportArtifact((current) => current ? {
          ...current,
          artifactRef: repairedArtifactRef,
          parentArtifactRef: current.artifactRef,
          versionNumber: current.versionNumber + 1,
          artifactState: "REPAIRED",
        } : current);
        message.info("修复制品已生成，Agent 正在自动对新版本重新试运行");
        planMutation.mutate({
          objective: taskImportObjective,
          taskImportArtifactRef: repairedArtifactRef,
          taskImportRunImmediately,
          preserveTimeline: true,
        });
        return;
      }

      const recoveryToolNames = new Set([
        "datasource.schema.repair.apply",
        "sync.dirty-record.quarantine.apply",
        "sync.execution.failed-objects.retry",
        "sync.dirty-record.replay",
      ]);
      const recoveryResult = [...result.data.toolResults]
        .reverse()
        .find((item) => item.audit.state === "SUCCEEDED" && recoveryToolNames.has(item.audit.toolCode));
      if (!recoveryResult) return;

      const taskId = findNumericField(recoveryResult.output, ["taskId", "syncTaskId"])
        ?? planMutation.variables?.recoveryTaskId;
      const diagnosisExecutionId = findNumericField(
        recoveryResult.output,
        ["diagnosisExecutionId", "sourceExecutionId", "executionId"],
      ) ?? planMutation.variables?.recoveryExecutionId;
      if (!taskId || !diagnosisExecutionId) {
        message.warning("恢复动作已完成，但结果缺少任务或原失败 execution 标识；为避免基于猜测继续，Agent 已安全暂停。");
        return;
      }

      if (["sync.execution.failed-objects.retry", "sync.dirty-record.replay"].includes(recoveryResult.audit.toolCode)) {
        const expectedExecutionId = recoveryResult.audit.toolCode === "sync.dirty-record.replay"
          ? findNumericField(recoveryResult.output, ["replayExecutionId"])
          : findNumericField(recoveryResult.output, ["executionId"]);
        message.info("恢复执行已进入 data-sync 队列，Agent 正在实时跟踪 worker 结果");
        const terminalExecution = await waitForRecoveryExecution(taskId, expectedExecutionId);
        if (!terminalExecution) {
          message.warning("恢复执行仍未结束，Agent 已保留现场，不会提前宣告成功或继续修改数据。");
          return;
        }
      }

      message.info("恢复动作已取得真实结果，Agent 正在进入下一轮验证与决策");
      planMutation.mutate({
        objective: `继续排查并闭环同步任务 ${taskId}。读取原失败执行 ${diagnosisExecutionId}，验证最新执行结果；若已经成功且失败行数为 0，则沉淀恢复案例，否则仅提出下一项有证据、可预览、需确认的修复动作。`,
        recoveryTaskId: taskId,
        recoveryExecutionId: diagnosisExecutionId,
        preserveTimeline: true,
      });
    },
    onError: (error) => {
      if (isMissingAgentRunError(error)) {
        const reason = errorMessage(error);
        // 旧页面状态中的 recoveryRunId 已经无法执行。立即撤销控制面确认入口，但保留 repairProposal 和
        // 当前高级配置；用户随后点击“重新生成”只会形成一份新审核计划，不会绕过授权直接保存任务。
        setControlPlane(undefined);
        setConfigurationReviewConfirmed(false);
        setExecutionAnswer((current) => current ? {
          ...current,
          recoveryRunId: undefined,
          recoveryRequiresConfirmation: false,
          continuationStatus: "RECOVERY_RUN_UNAVAILABLE",
          recoveryRunUnavailableReason: reason,
        } : current);
        message.error("更名修复计划已失效，任务配置和建议名称仍已保留，请重新生成审核计划");
        return;
      }
      message.error(errorMessage(error));
    },
    onSettled: (data, error) => {
      finishAgentProcess(
        "EXECUTION",
        error || (data?.data.failedCount ?? 0) > 0 ? "FAILED" : "SUCCEEDED",
      );
      setExecutionInProgress(false);
    },
  });

  const conversation = plan?.agentConversation;

  /**
   * 把用户纠偏或补充作为同一会话的新一轮输入。
   *
   * 这里会合并当前表单中已确认的结构化参数，并只在自然语言明确提到源端或目标端时清除对应旧选择，
   * 既允许用户说“把目标改成 X”，又不会因普通追问丢失此前已确认配置。
   */
  const continueConversation = () => {
    const latestMessage = followUpMessage.trim();
    if (!latestMessage || planMutation.isPending) return;
    const clarification: Partial<ClarificationFormValues> = {
      ...clarificationForm.getFieldsValue(true),
      ...definedFormValues(quickClarificationForm.getFieldsValue(true)),
    };
    const mentionsSource = /(源数据源|源库|source\s*datasource)/i.test(latestMessage);
    const mentionsTarget = /(目标数据源|目标库|target\s*datasource)/i.test(latestMessage);
    const rejectsCurrentDatasource = /(不是(这个|当前)?数据源|数据源.*(错了|不对)|理解错.*数据源)/i.test(latestMessage);
    if (mentionsSource || (rejectsCurrentDatasource && !mentionsTarget)) {
      delete clarification.sourceDatasourceId;
      clarificationForm.setFieldValue("sourceDatasourceId", undefined);
      quickClarificationForm.setFieldValue("sourceDatasourceId", undefined);
    }
    if (mentionsTarget || (rejectsCurrentDatasource && !mentionsSource)) {
      delete clarification.targetDatasourceId;
      clarificationForm.setFieldValue("targetDatasourceId", undefined);
      quickClarificationForm.setFieldValue("targetDatasourceId", undefined);
    }
    const nextConversationMessages: AgentChatMessage[] = [...conversationMessages, {
      id: `user-${crypto.randomUUID()}`,
      role: "USER",
      content: latestMessage,
    }];
    setConversationMessages(nextConversationMessages);
    planMutation.mutate({
      objective,
      clarification,
      followUpMessage: latestMessage,
      conversationContext: nextConversationMessages,
      preserveTimeline: true,
    });
  };

  /**
   * 用当前浏览器表单中的最新配置重新发起核对。
   *
   * 失败后不能从旧 conversation.resolvedConfiguration 重建请求，因为它正是上一轮“目标端/映射缺失”的历史
   * 快照。这里直接读取两个表单并合并，让用户刚选择的数据源、两条对象映射、字段映射、WHERE 与确认标志完整
   * 进入 variables.dataSyncRequest。startNewSession 只决定是否复用 Java 控制面会话，不会清空当前配置。
   */
  const retryPlanWithCurrentConfiguration = (startNewSession = false) => {
    if (planMutation.isPending) return;
    const clarification: Partial<ClarificationFormValues> = {
      ...clarificationForm.getFieldsValue(true),
      ...definedFormValues(quickClarificationForm.getFieldsValue(true)),
    };
    if (startNewSession) {
      setAgentConversationSessionId(crypto.randomUUID());
      setActiveAgentRuntimeSessionId(undefined);
      setHistoricalRunProcesses([]);
      setHistoryPlaybackWarning(undefined);
    }
    planMutation.mutate({
      objective,
      clarification,
      preserveTimeline: true,
      startNewSession,
    });
  };

  /**
   * 使用 Agent 已建议的新名称和当前页面保留的完整配置重新生成受治理计划。
   *
   * 该动作只修复“历史 recovery Run 已丢失”的控制面引用，不自动保存、发布或执行同步任务。新计划仍会重新
   * 展示数据源、对象映射、字段映射和 WHERE，并要求用户再次确认，从而同时满足可恢复性与高风险写操作授权边界。
   */
  const regenerateTaskNameRepairPlan = () => {
    const proposedTaskName = executionAnswer?.repairProposal?.proposedTaskName?.trim();
    if (!proposedTaskName || planMutation.isPending) return;
    clarificationForm.setFieldValue("taskName", proposedTaskName);
    const clarification: Partial<ClarificationFormValues> = {
      ...clarificationForm.getFieldsValue(true),
      ...definedFormValues(quickClarificationForm.getFieldsValue(true)),
      taskName: proposedTaskName,
    };
    planMutation.mutate({
      objective,
      clarification,
      followUpMessage: `采用 Agent 建议，将任务名称改为“${proposedTaskName}”，使用当前已审核配置重新生成计划；不要直接执行。`,
      preserveTimeline: true,
    });
  };

  /** 打开当前页高级配置并滚动到真实元数据驱动的表单，不丢弃已有选择。 */
  const openRetainedAdvancedConfiguration = () => {
    setShowAdvancedClarification(true);
    window.setTimeout(() => scrollToAgentSection("agent-clarification-card"), 0);
  };
  const missingParameterSet = new Set(conversation?.missingParameters ?? []);
  const needsSourceDatasource = missingParameterSet.has("sourceDatasourceId");
  const needsTargetDatasource = missingParameterSet.has("targetDatasourceId");
  const needsObjectMappings = missingParameterSet.has("objectMappings");
  const backendNeedsFieldMappings = missingParameterSet.has("fieldMappings");
  const metadataBackedDefaultMappingsReady = backendNeedsFieldMappings && Boolean(
    sourceMetadata
    && targetMetadata
    && clarificationMappings.length
    && clarificationMappings.every((mapping) => {
      const sourceTable = findMetadataTableByName(
        sourceMetadata,
        mapping.sourceSchemaName,
        mapping.sourceObjectName,
      );
      const targetTable = findMetadataTableByName(
        targetMetadata,
        mapping.targetSchemaName,
        mapping.targetObjectName,
      );
      if (!sourceTable || !targetTable) return false;
      const sourceFields = new Set(sortedColumns(sourceTable).map((field) => field.fieldName.toLowerCase()));
      const targetFields = new Set(sortedColumns(targetTable).map((field) => field.fieldName.toLowerCase()));
      const enabledFields = mapping.fieldMappings.filter(
        (field) => field.syncEnabled !== false && field.sourceField && field.targetField,
      );
      return enabledFields.length > 0 && enabledFields.every((field) => (
        field.sourceField.toLowerCase() === field.targetField.toLowerCase()
        && sourceFields.has(field.sourceField.toLowerCase())
        && targetFields.has(field.targetField.toLowerCase())
      ));
    })
  );
  const needsFieldMappings = backendNeedsFieldMappings && !metadataBackedDefaultMappingsReady;
  const needsMappingDefaultsConfirmation = missingParameterSet.has("mappingDefaultsConfirmation")
    || metadataBackedDefaultMappingsReady;
  const needsScheduleFrequency = missingParameterSet.has("scheduleFrequency");
  const needsScheduleStartTime = missingParameterSet.has("scheduleStartTime");
  const needsSqlConfirmation = missingParameterSet.has("customSqlConfirmation");
  const needsTargetTableResolution = missingParameterSet.has("targetTableResolution");
  const needsFieldMappingConversions = missingParameterSet.has("fieldMappingConversions");
  const effectiveMissingParameters = (conversation?.missingParameters ?? []).map((parameterName) => (
    parameterName === "fieldMappings" && metadataBackedDefaultMappingsReady
      ? "mappingDefaultsConfirmation"
      : parameterName
  ));
  const missingParameterLabels = [...new Set(effectiveMissingParameters)]
    .map(clarificationParameterLabel);
  const metadataDefaultFieldCount = clarificationMappings.reduce(
    (count, mapping) => count + mapping.fieldMappings.filter(
      (field) => field.syncEnabled !== false && field.sourceField && field.targetField,
    ).length,
    0,
  );
  const metadataDefaultsConfirmationMessage = metadataBackedDefaultMappingsReady
    ? `我已根据两端真实元数据，为 ${clarificationMappings.length} 条表映射预设 ${metadataDefaultFieldCount} 个同名字段；`
      + "当前每条映射的 WHERE 均为空，表示同步该表的全部数据。请确认采用这些默认值，或打开当前页编辑器调整字段映射和 WHERE 条件。"
    : conversation?.assistantMessage || "请补充当前任务执行所需的信息。";
  const sourceClarification = conversation?.clarificationQuestions.find(
    (question) => question.parameterName === "sourceDatasourceId",
  );
  const targetClarification = conversation?.clarificationQuestions.find(
    (question) => question.parameterName === "targetDatasourceId",
  );
  const sqlConfirmationQuestion = conversation?.clarificationQuestions.find(
    (question) => question.parameterName === "customSqlConfirmation",
  );
  const mappingDefaultsQuestion = conversation?.clarificationQuestions.find(
    (question) => question.parameterName === "mappingDefaultsConfirmation",
  );
  const generatedSqlPreview = sqlConfirmationQuestion?.configurationPreview?.customSqlText;
  const quickScheduleFrequency = Form.useWatch("scheduleFrequency", quickClarificationForm);
  const quickSourceOptions = sourceClarification?.candidates?.length
    ? sourceClarification.candidates.map((item) => ({
        value: item.datasourceId,
        label: `#${item.datasourceId} ${item.name}（${item.type}）`,
      }))
    : sourceOptions;
  const quickTargetOptions = targetClarification?.candidates?.length
    ? targetClarification.candidates.map((item) => ({
        value: item.datasourceId,
        label: `#${item.datasourceId} ${item.name}（${item.type}）`,
      }))
    : targetOptions;
  const hasQuickClarificationFields = needsSourceDatasource
    || needsTargetDatasource
    || needsScheduleFrequency
    || needsScheduleStartTime
    || needsSqlConfirmation
    || needsTargetTableResolution
    || needsMappingDefaultsConfirmation;
  const planItems = plan?.plan?.toolPlans ?? [];
  const latestDurableTurn = [...(plan?.agentDurableModelToolLoop?.turns ?? [])]
    .reverse()
    .find((turn) => turn.sessionId && turn.runId);
  const failureRecoveryPlanActive = Boolean(
    executionAnswer?.recoveryRunId
    && controlPlane?.runId === executionAnswer.recoveryRunId,
  );
  const taskNameRepairActive = failureRecoveryPlanActive
    && executionAnswer?.repairProposal?.kind === "DUPLICATE_TASK_NAME";
  const taskNameRepairNeedsRegeneration = Boolean(
    executionAnswer?.repairProposal?.kind === "DUPLICATE_TASK_NAME"
    && !executionAnswer.recoveryRunId
    && executionAnswer.recoveryRunUnavailableReason,
  );
  const activeToolNames = failureRecoveryPlanActive
    ? [...new Set(audits.map((audit) => audit.toolCode))]
    : latestDurableTurn?.submittedToolNames?.length
    ? latestDurableTurn.submittedToolNames
    : planItems.map((item) => item.toolName);
  const activeRequiresConfirmation = failureRecoveryPlanActive
    ? Boolean(executionAnswer?.recoveryRequiresConfirmation)
      && audits.some((audit) => ["WAITING_APPROVAL", "PLANNED"].includes(audit.state))
    : latestDurableTurn
    ? ["WAITING_APPROVAL", "HUMAN_TAKEOVER_REQUIRED"].includes(
        plan?.agentDurableModelToolLoop?.stoppedReason ?? "",
      )
    : planItems.some((item) => item.requiresHumanApproval);
  const confirmationButtonLabel = taskNameRepairActive
    ? `确认改名为“${executionAnswer?.repairProposal?.proposedTaskName}”并重新执行`
    : failureRecoveryPlanActive
    ? "确认并执行 Agent 修复方案"
    : activeToolNames.includes("datasource.schema.repair.apply")
    ? "确认并应用目标表结构修复"
    : activeToolNames.includes("sync.dirty-record.quarantine.apply")
      ? "确认并隔离所选坏行"
      : activeToolNames.includes("sync.execution.failed-objects.retry")
        ? "确认并重试失败对象"
        : activeToolNames.includes("sync.dirty-record.replay")
          ? "确认并重放已修复坏行"
          : activeToolNames.includes("sync.task.import.repair.apply")
            ? "确认并应用模型修复"
            : activeToolNames.includes("sync.task.import.commit")
              ? "确认正式导入任务"
              : "确认并执行本次计划";
  const isRecoveryConfirmation = failureRecoveryPlanActive || activeToolNames.some((toolName) => [
    "datasource.schema.repair.apply",
    "sync.dirty-record.quarantine.apply",
    "sync.execution.failed-objects.retry",
    "sync.dirty-record.replay",
  ].includes(toolName));
  const hasDatasourceOptions = sourceOptions.length > 0 && targetOptions.length > 0;
  const syncMode = normalizeUserSyncMode(conversation?.structuredIntent.syncMode);
  const activeClarificationMode = normalizeUserSyncMode(clarificationSyncMode || syncMode);
  const sqlClarificationMode = isSqlSyncMode(activeClarificationMode);
  const scheduledClarificationMode = isScheduledSyncMode(activeClarificationMode);
  const realtimeClarificationMode = isRealtimeSyncMode(activeClarificationMode);
  const sourceSchemaOptional = isMysqlLikeConnector(selectedSourceDatasource?.type);
  const targetSchemaOptional = isMysqlLikeConnector(selectedTargetDatasource?.type);
  const resolverMode = textField(conversation?.intentResolver, "mode");
  const modelProvider = textField(conversation?.intentResolver, "modelProvider");
  const modelName = textField(conversation?.intentResolver, "modelName");
  const requestedModelName = textField(conversation?.intentResolver, "requestedModelName");
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
      item.id.startsWith("history-") || !finalizedStages.has(item.stage)
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

  const agentActions = useMemo<AgentActionItem[]>(() => {
    const resultByAuditId = new Map(
      executionResults.map((item) => [item.audit.auditId, item]),
    );
    const actions: AgentActionItem[] = [];
    const liveModelOutput = [...observationItems].reverse().find((item) => (
      item.id.includes("model_public_output_stream_updated")
    ));
    const finalModelOutput = [...observationItems].reverse().find((item) => (
      item.id.includes("model_public_output_ready")
    )) || observationItems.find((item) => item.id === "model-invocation");
    const modelStarted = [...observationItems].reverse().find((item) => (
      item.id.includes("model_query_started")
    ));
    const activeLiveModelOutput = liveModelOutput
      && ["RUNNING", "PENDING"].includes(liveModelOutput.status)
      ? liveModelOutput
      : undefined;
    const modelItem = activeLiveModelOutput || finalModelOutput || liveModelOutput || modelStarted;
    if (modelItem) {
      const details = modelItem.details;
      const actualModel = details.actualModelName || details.model || details.selectedModelName;
      const provider = details.provider || details.selectedProviderName;
      const responseSource = details.responseSource;
      const modelIsRunning = Boolean(activeLiveModelOutput)
        || (!finalModelOutput && ["RUNNING", "PENDING"].includes(modelItem.status));
      actions.push({
        id: `action-model-${String(details.turn || modelItem.stage)}`,
        kind: "MODEL_OUTPUT",
        status: modelIsRunning ? "RUNNING" : modelItem.status,
        title: modelIsRunning
          ? liveModelOutput
            ? "模型正在生成公开回复"
            : "模型正在理解目标并选择工具"
          : responseSource === "DATASMART_RESULT_CACHE"
            ? "从会话缓存取得模型公开回复"
            : "模型已完成目标理解与工具决策",
        summary: modelItem.summary || "正在等待模型返回公开内容。",
        operation: `${responseSource === "DATASMART_RESULT_CACHE" ? "DataSmart response cache" : "Responses API"}`
          + `${actualModel ? ` · ${String(actualModel)}` : ""}`,
        targetService: provider ? String(provider) : "model-gateway",
        safeInput: sanitizeAgentActionPayload({
          objective: details.modelRequestObjective,
          instructionSummary: details.modelInstructionSummary,
          visibleTools: details.modelVisibleToolNames,
          structuredBaseline: details.modelStructuredBaseline,
        }),
        safeOutput: sanitizeAgentActionPayload(modelItem.summary),
        evidence: {
          requestId: liveRequestId,
          responseSource,
          cacheHit: details.cacheHit,
          providerCachedPromptTokens: details.cachedPromptTokens,
          promptTokens: details.promptTokens,
          completionTokens: details.completionTokens,
          totalTokens: details.totalTokens,
          latencyMs: details.latencyMs,
        },
      });
    }

    audits.forEach((audit) => {
      actions.push(auditToAgentAction(audit, resultByAuditId.get(audit.auditId)));
    });

    const waitingItems = observationItems.filter((item) => (
      item.category === "USER_ACTION"
      || (item.id === "human-confirmation" && item.status === "WAITING_APPROVAL")
    ));
    waitingItems.forEach((item) => {
      actions.push({
        id: `action-waiting-${item.id}`,
        kind: item.category === "USER_ACTION" ? "USER_INPUT" : "APPROVAL",
        status: item.status,
        title: item.title,
        summary: item.summary,
        safeInput: sanitizeAgentActionPayload(item.details),
      });
    });
    return actions;
  }, [audits, executionResults, liveRequestId, observationItems]);

  const diagnosticItems = useMemo(() => observationItems.filter((item) => (
    !item.id.startsWith("execution-")
    && !item.id.includes("model_public_output_stream_updated")
  )), [observationItems]);

  useEffect(() => {
    if (!sourceMetadata || !targetMetadata || !clarificationMappings.length) return;
    let changed = false;
    const nextMappings = clarificationMappings.map((mapping, mappingIndex) => {
      if (!mapping.sourceObjectName || !mapping.targetObjectName) return mapping;
      const sourceTable = findMetadataTableByName(
        sourceMetadata,
        mapping.sourceSchemaName,
        mapping.sourceObjectName,
      );
      const targetTable = findMetadataTableByName(
        targetMetadata,
        mapping.targetSchemaName,
        mapping.targetObjectName,
      );
      if (!sourceTable || !targetTable) return mapping;
      const sourceIndex = (sourceMetadata.tables ?? []).indexOf(sourceTable);
      const targetIndex = (targetMetadata.tables ?? []).indexOf(targetTable);
      const sourceTableKey = tableObjectKey(sourceTable, sourceIndex);
      const targetTableKey = tableObjectKey(targetTable, targetIndex);
      const fieldMappings = makeFieldMappings(
        sortedColumns(sourceTable),
        sortedColumns(targetTable),
      );
      if (
        mapping.sourceTableKey === sourceTableKey
        && mapping.targetTableKey === targetTableKey
        && mapping.fieldMappings.length === fieldMappings.length
      ) {
        return mapping;
      }
      changed = true;
      return {
        ...mapping,
        objectKey: mapping.objectKey || `agent-resolved-mapping-${mappingIndex + 1}`,
        sourceTableKey,
        targetTableKey,
        sourceSchemaName: sourceTable.schemaName,
        sourceObjectName: sourceTable.tableName,
        targetSchemaName: targetTable.schemaName,
        targetObjectName: targetTable.tableName,
        fieldMappings,
      };
    });
    if (changed) {
      clarificationForm.setFieldsValue({
        objectMappings: nextMappings,
        mappingDefaultsConfirmed: false,
      });
      quickClarificationForm.setFieldValue("mappingDefaultsConfirmed", false);
    }
  }, [clarificationForm, clarificationMappings, quickClarificationForm, sourceMetadata, targetMetadata]);

  useEffect(() => {
    if (!metadataBackedDefaultMappingsReady || planMutation.isPending) return;
    const turnKey = [
      conversation?.turnId || plan?.plan?.requestId || "mapping-defaults",
      ...clarificationMappings.map((mapping) => (
        `${mapping.sourceSchemaName || ""}.${mapping.sourceObjectName}->`
        + `${mapping.targetSchemaName || ""}.${mapping.targetObjectName}`
      )),
    ].join("|");
    if (mappingDefaultsPromptTurnRef.current === turnKey) return;
    mappingDefaultsPromptTurnRef.current = turnKey;

    // The backend control-plane summary can intentionally omit column details.
    // Once the browser has loaded both authorized metadata snapshots, convert the
    // generic "missing fields" state into the actual user decision: accept the
    // verified same-name defaults or edit individual fields/WHERE expressions.
    setShowAdvancedClarification(false);
    clarificationForm.setFieldValue("mappingDefaultsConfirmed", false);
    quickClarificationForm.setFieldValue("mappingDefaultsConfirmed", false);
    const messageId = `agent-mapping-defaults-${turnKey}`;
    setConversationMessages((current) => (
      current.some((item) => item.id === messageId)
        ? current
        : [...current, { id: messageId, role: "AGENT", content: metadataDefaultsConfirmationMessage }]
    ));
  }, [
    clarificationForm,
    clarificationMappings,
    conversation?.turnId,
    metadataBackedDefaultMappingsReady,
    metadataDefaultsConfirmationMessage,
    plan?.plan?.requestId,
    planMutation.isPending,
    quickClarificationForm,
  ]);

  useEffect(() => {
    const resolved = conversation?.resolvedConfiguration;
    const mappingSource = resolved?.objectMappingSource;
    const phaseAllowsMetadataContinuation = conversation
      ? ["WAITING_CLARIFICATION", "RESOLVING_AUTONOMOUSLY"].includes(conversation.phase)
      : false;
    const hasOnlyMappingClarification = (conversation?.missingParameters ?? [])
      .every((parameterName) => parameterName === "objectMappings");
    const mappingsExistInMetadata = Boolean(
      sourceMetadata
      && targetMetadata
      && clarificationMappings.length
      && clarificationMappings.every((mapping) => (
        Boolean(mapping.sourceObjectName)
        && Boolean(mapping.targetObjectName)
        && Boolean(findMetadataTableByName(
          sourceMetadata,
          mapping.sourceSchemaName,
          mapping.sourceObjectName,
        ))
        && Boolean(findMetadataTableByName(
          targetMetadata,
          mapping.targetSchemaName,
          mapping.targetObjectName,
        ))
      )),
    );
    if (
      !phaseAllowsMetadataContinuation
      || !hasOnlyMappingClarification
      || !["VERIFIED_METADATA_SAME_NAME_MATCH", "USER_STATED_SAME_NAME_MAPPING"].includes(mappingSource || "")
      || !effectiveSourceDatasourceId
      || !effectiveTargetDatasourceId
      || !mappingsExistInMetadata
      || planMutation.isPending
    ) {
      return;
    }
    const turnKey = [
      conversation?.turnId,
      effectiveSourceDatasourceId,
      effectiveTargetDatasourceId,
      ...clarificationMappings.map((item) => (
        `${item.sourceSchemaName || ""}.${item.sourceObjectName}->`
        + `${item.targetSchemaName || ""}.${item.targetObjectName}`
      )),
    ].join("|");
    if (autoAdvanceTurnRef.current === turnKey) return;
    autoAdvanceTurnRef.current = turnKey;
    const timer = window.setTimeout(() => {
      const values = clarificationForm.getFieldsValue(true);
      message.info(`Agent 已根据真实元数据自动补全 ${clarificationMappings.length} 条同名表映射，正在继续核对`);
      planMutation.mutate({
        objective,
        clarification: values,
        preserveTimeline: true,
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [
    clarificationForm,
    clarificationMappings,
    conversation,
    effectiveSourceDatasourceId,
    effectiveTargetDatasourceId,
    objective,
    planMutation,
    sourceMetadata,
    targetMetadata,
  ]);

  const projectUnavailableMessage = sessionQuery.isError
    ? "登录或项目上下文加载失败，请刷新页面后重试"
    : "请先在页面顶部选择一个项目";

  /**
   * 从目标输入框开始全新会话。先重置浏览器和控制面会话标识，再清理旧计划、审批、执行和消息状态，
   * 避免“新建任务”错误续接到此前历史会话。
   */
  const submitObjective = (values: ObjectiveFormValues) => {
    const browserSessionId = crypto.randomUUID();
    setAgentConversationSessionId(browserSessionId);
    setActiveAgentRuntimeSessionId(undefined);
    setActiveSessionArchived(false);
    setObjective(values.objective);
    setPlan(undefined);
    setLiveObservationItems([]);
    setLiveRequestId(undefined);
    setControlPlane(undefined);
    setExecutionResults([]);
    setExecutionAnswer(undefined);
    setPlanFailure(undefined);
    setFollowUpMessage("");
    setShowAdvancedClarification(false);
    setConfigurationReviewConfirmed(false);
    reviewEditSnapshotRef.current = undefined;
    autoAdvanceTurnRef.current = undefined;
    mappingDefaultsPromptTurnRef.current = undefined;
    clarificationForm.resetFields();
    quickClarificationForm.resetFields();
    setHistoricalRunProcesses([]);
    setHistoryPlaybackWarning(undefined);
    setConversationMessages([{
      id: `user-${crypto.randomUUID()}`,
      role: "USER",
      content: values.objective,
    }]);
    planMutation.mutate({ objective: values.objective, startNewSession: true });
  };

  /**
   * 仅重置当前协作工作台，不删除或归档服务端历史。正在进行的流式请求会先被取消，随后恢复默认输入态。
   */
  const startNewConversation = () => {
    activePlanAbortControllerRef.current?.abort();
    const browserSessionId = crypto.randomUUID();
    setAgentConversationSessionId(browserSessionId);
    setActiveAgentRuntimeSessionId(undefined);
    setActiveSessionArchived(false);
    setObjective(defaultObjective);
    objectiveForm.setFieldsValue({ objective: defaultObjective });
    setConversationMessages([]);
    setHistoricalRunProcesses([]);
    setHistoryPlaybackWarning(undefined);
    setPlan(undefined);
    setControlPlane(undefined);
    setExecutionResults([]);
    setExecutionAnswer(undefined);
    setPlanFailure(undefined);
    setLiveObservationItems([]);
    setFollowUpMessage("");
    setShowAdvancedClarification(false);
    setConfigurationReviewConfirmed(false);
    clarificationForm.resetFields();
    quickClarificationForm.resetFields();
  };

  const submitTaskImportArtifact = () => {
    if (!taskImportArtifact) {
      message.warning("请先上传 CSV 或 XLSX 任务文件");
      return;
    }
    setObjective(taskImportObjective);
    setAgentConversationSessionId(crypto.randomUUID());
    setActiveAgentRuntimeSessionId(undefined);
    setActiveSessionArchived(false);
    setHistoricalRunProcesses([]);
    setHistoryPlaybackWarning(undefined);
    setPlan(undefined);
    setControlPlane(undefined);
    setExecutionResults([]);
    setExecutionAnswer(undefined);
    planMutation.mutate({
      objective: taskImportObjective,
      taskImportArtifactRef: taskImportArtifact.artifactRef,
      taskImportRunImmediately,
      startNewSession: true,
    });
  };

  const handoffToManualWizard = () => {
    const draftArguments = plan?.plan?.toolPlans.find(
      (item) => item.toolName === "sync.task.draft.save",
    )?.arguments;
    const formValues = clarificationForm.getFieldsValue(true);
    const mode = normalizeUserSyncMode(
      formValues.syncMode
      || textField(draftArguments, "syncMode")
      || conversation?.structuredIntent.syncMode,
    );
    const sourceDatasourceId = formValues.sourceDatasourceId || effectiveSourceDatasourceId;
    const targetDatasourceId = formValues.targetDatasourceId || effectiveTargetDatasourceId;
    const objectMappings = formValues.objectMappings?.length
      ? formValues.objectMappings
      : Array.isArray(draftArguments?.objectMappings)
        ? draftArguments.objectMappings
        : [];
    setControlPlane(undefined);
    setConfigurationReviewConfirmed(false);
    reviewEditSnapshotRef.current = undefined;
    navigate("/sync", {
      state: {
        agentWizardHandoff: {
          handoffId: crypto.randomUUID(),
          taskName: formValues.taskName || textField(draftArguments, "taskName") || "Agent 创建的数据同步任务",
          syncMode: mode,
          writeStrategy: isRealtimeSyncMode(mode)
            ? "UPDATE"
            : formValues.writeStrategy || textField(draftArguments, "writeStrategy") || "INSERT",
          sourceDatasourceId,
          targetDatasourceId,
          scheduleConfig: formValues.scheduleConfig || textField(draftArguments, "scheduleConfig"),
          customSqlText: formValues.customSqlText || textField(draftArguments, "customSqlText") || generatedSqlPreview,
          objectMappings,
          source: "AGENT_PROGRESSIVE_CLARIFICATION",
        },
      },
    });
  };

  const startConfigurationReviewEdit = () => {
    reviewEditSnapshotRef.current = {
      values: clarificationForm.getFieldsValue(true),
      controlPlane,
      reviewConfirmed: configurationReviewConfirmed,
    };
    setConfigurationReviewConfirmed(false);
    setShowAdvancedClarification(true);
    window.setTimeout(() => scrollToAgentSection("agent-clarification-card"), 0);
  };

  const cancelConfigurationReviewEdit = () => {
    const snapshot = reviewEditSnapshotRef.current;
    if (snapshot) {
      clarificationForm.setFieldsValue(snapshot.values);
      setControlPlane(snapshot.controlPlane);
      setConfigurationReviewConfirmed(snapshot.reviewConfirmed);
    }
    reviewEditSnapshotRef.current = undefined;
    setShowAdvancedClarification(false);
    window.setTimeout(() => scrollToAgentSection("agent-execution-plan-card"), 0);
  };

  const invalidateConfigurationReview = () => {
    setControlPlane(undefined);
    setConfigurationReviewConfirmed(false);
  };

  const resolvedConfiguration = latestResolvedConfiguration;
  const reviewSyncMode = normalizeUserSyncMode(
    clarificationSyncMode || resolvedConfiguration?.syncMode || conversation?.structuredIntent.syncMode,
  );
  const reviewWriteStrategy = isRealtimeSyncMode(reviewSyncMode)
    ? "UPDATE"
    : clarificationWriteStrategy || resolvedConfiguration?.writeStrategy || "INSERT";
  const reviewMappings = clarificationMappings.length
    ? clarificationMappings
    : resolvedObjectMappings(resolvedConfiguration?.objectMappings);
  const reviewTaskName = clarificationTaskName
    || resolvedConfiguration?.taskName
    || "Agent 创建的数据同步任务";
  const reviewSourceDatasource = selectedSourceDatasource || sourceDatasources.find(
    (item) => Number(item.id) === Number(resolvedConfiguration?.sourceDatasourceId),
  );
  const reviewTargetDatasource = selectedTargetDatasource || targetDatasources.find(
    (item) => Number(item.id) === Number(resolvedConfiguration?.targetDatasourceId),
  );
  const reviewSourceName = reviewSourceDatasource
    ? `#${reviewSourceDatasource.id} ${reviewSourceDatasource.name}（${reviewSourceDatasource.type}）`
    : resolvedConfiguration?.sourceDatasourceName
      || (resolvedConfiguration?.sourceDatasourceId ? `#${resolvedConfiguration.sourceDatasourceId}` : "未选择");
  const reviewTargetName = reviewTargetDatasource
    ? `#${reviewTargetDatasource.id} ${reviewTargetDatasource.name}（${reviewTargetDatasource.type}）`
    : resolvedConfiguration?.targetDatasourceName
      || (resolvedConfiguration?.targetDatasourceId ? `#${resolvedConfiguration.targetDatasourceId}` : "未选择");
  const reviewScheduleConfig = clarificationScheduleConfig || resolvedConfiguration?.scheduleConfig;
  const reviewCustomSqlText = clarificationCustomSqlText || resolvedConfiguration?.customSqlText;
  const isSyncTaskCreationReview = conversation?.structuredIntent.intentType === "CREATE_DATA_SYNC_TASK"
    || activeToolNames.includes("sync.task.draft.save");
  const configurationReadinessIssues: string[] = [];
  if (isSyncTaskCreationReview) {
    if (!effectiveSourceDatasourceId) configurationReadinessIssues.push("尚未选择源端数据源");
    if (!effectiveTargetDatasourceId) configurationReadinessIssues.push("尚未选择目标端数据源");
    if (sourceMetadataQuery.isLoading || targetMetadataQuery.isLoading) {
      configurationReadinessIssues.push("两端真实元数据仍在加载，请等待字段核对完成");
    } else {
      if (!sourceMetadata) configurationReadinessIssues.push("尚未取得源端真实表和字段元数据");
      if (!targetMetadata) configurationReadinessIssues.push("尚未取得目标端真实表和字段元数据");
    }
    if (!reviewMappings.length) configurationReadinessIssues.push("尚未配置任何源表到目标表映射");
    reviewMappings.forEach((mapping, index) => {
      const label = `映射 ${index + 1}`;
      if (!isSqlSyncMode(reviewSyncMode) && !mapping.sourceObjectName) {
        configurationReadinessIssues.push(`${label} 尚未选择源表`);
      }
      if (!mapping.targetObjectName) configurationReadinessIssues.push(`${label} 尚未选择或填写目标表`);
      if (!isSqlSyncMode(reviewSyncMode) && !sourceSchemaOptional && !mapping.sourceSchemaName) {
        configurationReadinessIssues.push(`${label} 缺少源端 schema`);
      }
      if (!targetSchemaOptional && !mapping.targetSchemaName) {
        configurationReadinessIssues.push(`${label} 缺少目标端 schema`);
      }
      const sourceTable = isSqlSyncMode(reviewSyncMode)
        ? undefined
        : findMetadataTableByName(sourceMetadata, mapping.sourceSchemaName, mapping.sourceObjectName);
      const targetTable = findMetadataTableByName(
        targetMetadata,
        mapping.targetSchemaName,
        mapping.targetObjectName,
      );
      if (!isSqlSyncMode(reviewSyncMode) && mapping.sourceObjectName && !sourceTable) {
        configurationReadinessIssues.push(`${label} 的源表不在真实元数据中`);
      }
      if (mapping.targetObjectName && !targetTable) {
        configurationReadinessIssues.push(`${label} 的目标表不在真实元数据中`);
      }
      const enabledFields = mapping.fieldMappings.filter(
        (field) => field.syncEnabled !== false && field.sourceField && field.targetField,
      );
      if (!enabledFields.length) {
        configurationReadinessIssues.push(`${label} 没有已确认的有效字段映射`);
      }
      const sourceFieldNames = new Set(sortedColumns(sourceTable).map((field) => field.fieldName.toLowerCase()));
      const targetFieldNames = new Set(sortedColumns(targetTable).map((field) => field.fieldName.toLowerCase()));
      enabledFields.forEach((field) => {
        if (!isSqlSyncMode(reviewSyncMode) && !sourceFieldNames.has(field.sourceField.toLowerCase())) {
          configurationReadinessIssues.push(`${label} 的源字段 ${field.sourceField} 不存在`);
        }
        if (!targetFieldNames.has(field.targetField.toLowerCase())) {
          configurationReadinessIssues.push(`${label} 的目标字段 ${field.targetField} 不存在`);
        }
      });
    });
    if (isScheduledSyncMode(reviewSyncMode) && !reviewScheduleConfig?.trim()) {
      configurationReadinessIssues.push("定期任务缺少调度周期和首次执行时间");
    }
    if (isSqlSyncMode(reviewSyncMode) && !reviewCustomSqlText?.trim()) {
      configurationReadinessIssues.push("SQL 语句模式缺少只读 SQL");
    }
    const defaultFieldsRequireConfirmation = needsMappingDefaultsConfirmation
      || resolvedConfiguration?.fieldMappingSource === "VERIFIED_METADATA_SAME_NAME_FIELDS";
    const mappingDefaultsConfirmed = clarificationMappingDefaultsConfirmed
      ?? resolvedConfiguration?.mappingDefaultsConfirmed
      ?? false;
    if (defaultFieldsRequireConfirmation && !mappingDefaultsConfirmed) {
      configurationReadinessIssues.push("尚未确认 Agent 默认的同名字段映射与无 WHERE 数据范围");
    }
  }
  const uniqueConfigurationReadinessIssues = [...new Set(configurationReadinessIssues)];
  const taskConfigurationReady = uniqueConfigurationReadinessIssues.length === 0;
  const editingReadyConfiguration = showAdvancedClarification
    && conversation?.phase !== "WAITING_CLARIFICATION";

  const historicalTranscript = useMemo(
    () => buildHistoricalConversationTranscript(conversationMessages, historicalRunProcesses),
    [conversationMessages, historicalRunProcesses],
  );
  const currentConversationMessages = historicalTranscript.currentMessages;
  let latestUserMessageIndex = -1;
  currentConversationMessages.forEach((item, index) => {
    if (item.role === "USER") latestUserMessageIndex = index;
  });
  let currentTurnAgentMessageIndex = -1;
  currentConversationMessages.forEach((item, index) => {
    if (index > latestUserMessageIndex && item.role === "AGENT") currentTurnAgentMessageIndex = index;
  });
  const currentTurnAgentMessage = currentTurnAgentMessageIndex >= 0
    ? currentConversationMessages[currentTurnAgentMessageIndex]
    : undefined;
  const currentConversationHistoryMessages = currentConversationMessages.filter(
    (_, index) => index !== currentTurnAgentMessageIndex,
  );
  const processActionSummaries = agentProcessActionSummaries(agentActions);
  const currentProcessItem = [...agentActions].reverse().find((item) => item.status === "RUNNING")
    || agentActions[agentActions.length - 1];
  const processPanel = processStartedAt || agentActions.length ? (
    <div className={`agent-process-shell is-${processStatus.toLowerCase()}`}>
      <Collapse
        ghost
        activeKey={processExpanded ? ["agent-process"] : []}
        onChange={(keys) => setProcessExpanded(Array.isArray(keys)
          ? keys.includes("agent-process")
          : keys === "agent-process")}
        expandIconPosition="end"
        items={[{
          key: "agent-process",
          label: processStatus === "RUNNING" ? (
            <div className="agent-process-heading is-running">
              <Spin size="small" />
              <Typography.Text strong>
                正在处理 {formatAgentProcessElapsed(processElapsedMs)}
              </Typography.Text>
              {currentProcessItem ? (
                <Typography.Text type="secondary" ellipsis>{currentProcessItem.title}</Typography.Text>
              ) : null}
            </div>
          ) : (
            <Typography.Text
              strong
              className={processStatus === "FAILED"
                ? "agent-process-failed"
                : processStatus === "CANCELLED"
                  ? "agent-process-cancelled"
                  : undefined}
            >
              {processStatus === "FAILED"
                ? "处理失败"
                : processStatus === "CANCELLED"
                  ? "已停止"
                  : "已处理"} {formatAgentProcessElapsed(processElapsedMs)}
            </Typography.Text>
          ),
          children: (
            <div className="agent-process-body">
              <div className="agent-process-summary">
                {processActionSummaries.map((summary) => <Tag key={summary}>{summary}</Tag>)}
                {liveRequestId ? <Tag>请求 {liveRequestId.slice(0, 8)}</Tag> : null}
                <Typography.Text type="secondary">实际动作与公开模型输出，敏感参数已隐藏</Typography.Text>
              </div>
              <Timeline
                className="agent-process-timeline"
                items={agentActions.map((item) => {
                  const safeInputText = actionPayloadText(item.safeInput);
                  const safeOutputText = actionPayloadText(item.safeOutput);
                  const evidenceEntries = Object.entries(item.evidence ?? {}).filter(([, value]) => (
                    value !== undefined && value !== null && value !== ""
                  ));
                  const needsInput = item.kind === "USER_INPUT";
                  const needsConfirmation = item.kind === "APPROVAL";
                  return {
                    color: observationColor(item.status),
                    dot: item.status === "RUNNING" ? <Spin size="small" /> : agentActionIcon(item.kind),
                    children: (
                      <div className={`agent-process-step agent-action-step is-${item.kind.toLowerCase()}`}>
                        <Space wrap>
                          <Typography.Text strong>{item.title}</Typography.Text>
                          <Tag color="blue">{agentActionKindLabel(item.kind)}</Tag>
                          <Tag color={observationColor(item.status)}>{observationStatus(item.status)}</Tag>
                          {item.elapsedMs !== undefined ? (
                            <Typography.Text type="secondary">{formatAgentProcessElapsed(item.elapsedMs)}</Typography.Text>
                          ) : null}
                        </Space>
                        <Typography.Paragraph className="agent-process-step-summary">
                          {item.summary}
                        </Typography.Paragraph>
                        {item.operation ? (
                          <div className="agent-action-operation">
                            <CodeOutlined />
                            <Typography.Text code>{item.operation}</Typography.Text>
                            {item.targetService ? <Tag>{item.targetService}</Tag> : null}
                          </div>
                        ) : null}
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
                        {safeInputText || safeOutputText || item.changedFields?.length || evidenceEntries.length ? (
                          <Collapse
                            ghost
                            size="small"
                            items={[{
                              key: `${item.id}-details`,
                              label: "查看调用参数、结果与证据",
                              children: (
                                <Space direction="vertical" size={12} style={{ width: "100%" }}>
                                  {item.changedFields?.length ? (
                                    <div>
                                      <Typography.Text type="secondary">本次配置字段</Typography.Text>
                                      <div className="agent-action-tags">
                                        {item.changedFields.map((field) => <Tag key={field}>{field}</Tag>)}
                                      </div>
                                    </div>
                                  ) : null}
                                  {safeInputText ? (
                                    <div>
                                      <Typography.Text type="secondary">脱敏调用参数</Typography.Text>
                                      <pre className="agent-action-payload">{safeInputText}</pre>
                                    </div>
                                  ) : null}
                                  {safeOutputText ? (
                                    <div>
                                      <Typography.Text type="secondary">实际返回结果</Typography.Text>
                                      <pre className="agent-action-payload">{safeOutputText}</pre>
                                    </div>
                                  ) : null}
                                  {evidenceEntries.length ? (
                                    <Descriptions
                                      size="small"
                                      column={{ xs: 1, sm: 2, lg: 3 }}
                                      items={evidenceEntries.map(([key, value]) => ({
                                        key,
                                        label: observationDetailLabel(key),
                                        children: formatObservationValue(value, key),
                                      }))}
                                    />
                                  ) : null}
                                </Space>
                              ),
                            }]}
                          />
                        ) : null}
                      </div>
                    ),
                  };
                })}
              />
            </div>
          ),
        }]}
      />
    </div>
  ) : null;

  /**
   * 规划失败后的常驻恢复区。它使用 useWatch 得到的当前表单值计算保留摘要，因此即使 plan 仍是上一次成功响应，
   * 页面也不会再把旧缺参状态误说成“用户没有填写”。
   */
  const planFailurePanel = planFailure ? (
    <Alert
      showIcon
      type="error"
      className="agent-plan-recovery"
      message="本轮计划未接入控制面，当前配置已保留"
      description={(
        <Space direction="vertical" size={10} style={{ width: "100%" }}>
          <Typography.Text>{planFailure.message}</Typography.Text>
          <Space wrap>
            {effectiveSourceDatasourceId ? <Tag color="green">源端 #{effectiveSourceDatasourceId}</Tag> : <Tag>源端未选择</Tag>}
            {effectiveTargetDatasourceId ? <Tag color="green">目标端 #{effectiveTargetDatasourceId}</Tag> : <Tag>目标端未选择</Tag>}
            <Tag color={clarificationMappings.length ? "green" : "default"}>
              已保留 {clarificationMappings.length} 条对象映射
            </Tag>
            <Tag color={metadataDefaultFieldCount ? "green" : "default"}>
              已保留 {metadataDefaultFieldCount} 个同步字段
            </Tag>
            {planFailure.code ? <Tag color="red">{planFailure.code}</Tag> : null}
          </Space>
          <Typography.Text type="secondary">
            下方上一轮“待补充”内容只是最后一次成功返回的历史快照，不代表当前表单；重试会提交以上已保留配置。
          </Typography.Text>
          {planFailure.suggestions.length ? (
            <Typography.Text type="secondary">建议：{planFailure.suggestions.join("；")}</Typography.Text>
          ) : null}
          <Space wrap>
            <Button type="primary" onClick={() => retryPlanWithCurrentConfiguration(false)}>
              使用当前配置重试
            </Button>
            <Button onClick={() => scrollToAgentSection("agent-conversation-composer")}>
              继续补充或纠偏
            </Button>
            <Button onClick={openRetainedAdvancedConfiguration}>打开高级配置</Button>
            <Button onClick={() => retryPlanWithCurrentConfiguration(true)}>新会话重试</Button>
          </Space>
        </Space>
      )}
    />
  ) : null;

  return (
    <div className="agent-assistant-shell">
      <aside className="agent-session-sidebar">
        <div className="agent-session-sidebar-header">
          <div>
            <Typography.Text strong>历史会话</Typography.Text>
            <Typography.Text type="secondary" className="agent-session-sidebar-caption">
              当前项目内的个人 Agent 记录
            </Typography.Text>
          </div>
          <Tooltip title="新建会话">
            <Button type="text" icon={<PlusOutlined />} onClick={startNewConversation} />
          </Tooltip>
        </div>
        <Button
          block
          icon={showArchivedSessions ? <HistoryOutlined /> : <InboxOutlined />}
          onClick={() => setShowArchivedSessions((current) => !current)}
        >
          {showArchivedSessions ? "返回进行中会话" : "查看已归档"}
        </Button>
        <div className="agent-session-list">
          {sessionHistoryQuery.isLoading ? <Spin size="small" /> : null}
          {!sessionHistoryQuery.isLoading && !sessionHistory.length ? (
            <Typography.Text type="secondary" className="agent-session-empty">
              {showArchivedSessions ? "暂无已归档会话" : "暂无历史会话"}
            </Typography.Text>
          ) : null}
          {sessionHistory.map((item) => (
            <div
              key={item.sessionId}
              role="button"
              tabIndex={0}
              className={`agent-session-item${activeAgentRuntimeSessionId === item.sessionId ? " is-active" : ""}`}
              onClick={() => loadSessionMutation.mutate(item.sessionId)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  loadSessionMutation.mutate(item.sessionId);
                }
              }}
            >
              <div className="agent-session-item-title">
                {item.pinned ? <PushpinFilled /> : null}
                <Typography.Text ellipsis>{item.objective || "未命名会话"}</Typography.Text>
              </div>
              <Typography.Text type="secondary" className="agent-session-item-time">
                {item.lastMessageAt || item.updateTime
                  ? new Date(item.lastMessageAt || item.updateTime || "").toLocaleString("zh-CN", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "刚刚"}
              </Typography.Text>
              <div className="agent-session-item-actions">
                <Tooltip title={item.pinned ? "取消置顶" : "置顶"}>
                  <Button
                    type="text"
                    size="small"
                    icon={item.pinned ? <PushpinFilled /> : <PushpinOutlined />}
                    onClick={(event) => {
                      event.stopPropagation();
                      pinSessionMutation.mutate({ sessionId: item.sessionId, enabled: !item.pinned });
                    }}
                  />
                </Tooltip>
                <Tooltip title={item.archived ? "恢复会话" : "归档"}>
                  <Button
                    type="text"
                    size="small"
                    icon={item.archived ? <HistoryOutlined /> : <InboxOutlined />}
                    onClick={(event) => {
                      event.stopPropagation();
                      archiveSessionMutation.mutate({ sessionId: item.sessionId, enabled: !item.archived });
                    }}
                  />
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      </aside>
      <div className="page-stack agent-assistant-main">
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

      <Card title="任务文件智能导入" className="compact-card">
        <Alert
          showIcon
          type="info"
          message="上传制品后由 Agent 试运行、诊断、检索案例并提出修复"
          description="原始 CSV/XLSX 只保存在当前租户与项目的数据同步服务中；模型仅接收制品引用、结构化错误码、低敏诊断和 RAG 证据。任何单元格修改与正式导入都必须由你明确确认。"
          style={{ marginBottom: 16 }}
        />
        <Space wrap>
          <Upload
            accept=".csv,.xlsx"
            maxCount={1}
            showUploadList={false}
            beforeUpload={(file) => {
              artifactUploadMutation.mutate(file as File);
              return false;
            }}
          >
            <Button icon={<UploadOutlined />} loading={artifactUploadMutation.isPending} disabled={!projectId}>
              上传 CSV / XLSX
            </Button>
          </Upload>
          <Checkbox
            checked={taskImportRunImmediately}
            onChange={(event) => setTaskImportRunImmediately(event.target.checked)}
          >
            导入成功后立即运行
          </Checkbox>
          <Button
            type="primary"
            icon={<FileExcelOutlined />}
            disabled={!taskImportArtifact || planMutation.isPending}
            onClick={submitTaskImportArtifact}
          >
            交给 Agent 检查并处理
          </Button>
        </Space>
        {taskImportArtifact ? (
          <Descriptions
            size="small"
            column={{ xs: 1, md: 3 }}
            style={{ marginTop: 16 }}
            items={[
              { key: "file", label: "文件", children: taskImportArtifact.fileName },
              { key: "version", label: "制品版本", children: `v${taskImportArtifact.versionNumber}` },
              { key: "state", label: "状态", children: <Tag color="blue">{taskImportArtifact.artifactState}</Tag> },
              { key: "ref", label: "制品引用", children: taskImportArtifact.artifactRef },
              { key: "size", label: "大小", children: `${Math.max(1, Math.ceil(taskImportArtifact.contentSizeBytes / 1024))} KiB` },
              { key: "scope", label: "项目", children: `#${taskImportArtifact.projectId}` },
            ]}
          />
        ) : null}
      </Card>

      {!conversation && (activeAgentRuntimeSessionId || conversationMessages.length || planMutation.isPending) ? (
        <Card
          title="与 Agent 协作"
          className="compact-card agent-conversation-card"
          extra={<Tag color={activeSessionArchived ? "default" : planMutation.isPending ? "processing" : "blue"}>
            {activeSessionArchived ? "已归档" : planMutation.isPending ? "Agent 正在处理" : "可继续追问"}
          </Tag>}
        >
          {activeSessionArchived ? (
            <Alert
              showIcon
              type="info"
              message="这是已归档会话"
              description="历史内容保持只读。点击左侧恢复按钮后，可以在同一个会话中继续追问。"
              style={{ marginBottom: 16 }}
            />
          ) : null}
          {historyPlaybackWarning ? (
            <Alert
              showIcon
              type="warning"
              message="部分历史过程暂未恢复"
              description={historyPlaybackWarning}
              style={{ marginBottom: 16 }}
            />
          ) : null}
          <div className="agent-message-list">
            {historicalTranscript.entries.map((entry) => entry.kind === "MESSAGE" ? (
              <AgentConversationMessageBubble key={entry.key} item={entry.message} />
            ) : (
              <div key={entry.key} className="agent-message-row is-agent agent-process-message-row">
                <div className="agent-message-meta">Agent</div>
                <HistoricalAgentRunProcessPlayback process={entry.process} />
              </div>
            ))}
            {currentConversationHistoryMessages.map((item) => (
              <AgentConversationMessageBubble key={item.id} item={item} />
            ))}
            {processPanel ? (
              <div className="agent-message-row is-agent agent-process-message-row">
                <div className="agent-message-meta">Agent</div>
                {processPanel}
              </div>
            ) : null}
            {currentTurnAgentMessage ? (
              <AgentConversationMessageBubble item={currentTurnAgentMessage} />
            ) : null}
          </div>
          {planFailurePanel}
          <div className="agent-composer">
            <Input.TextArea
              value={followUpMessage}
              onChange={(event) => setFollowUpMessage(event.target.value)}
              onPressEnter={(event) => {
                if (!event.shiftKey) {
                  event.preventDefault();
                  continueConversation();
                }
              }}
              autoSize={{ minRows: 2, maxRows: 6 }}
              placeholder="继续补充、追问或纠正 Agent。Enter 发送，Shift + Enter 换行"
              disabled={activeSessionArchived || executionInProgress || planMutation.isPending}
            />
            <div className="agent-composer-footer">
              <Typography.Text type="secondary">
                后续消息只会在当前会话中创建新 Run；仅左侧“+”会新建会话。
              </Typography.Text>
              {planMutation.isPending ? (
                <Button danger icon={<StopOutlined />} onClick={stopCurrentAgentPlan}>
                  停止思考
                </Button>
              ) : (
                <Button
                  type="primary"
                  icon={<ArrowRightOutlined />}
                  onClick={continueConversation}
                  disabled={activeSessionArchived || !followUpMessage.trim() || executionInProgress}
                >
                  发送
                </Button>
              )}
            </div>
          </div>
        </Card>
      ) : null}

      {!conversation && !activeAgentRuntimeSessionId && !conversationMessages.length && !planMutation.isPending ? (
      <Card title="与 Agent 协作" className="compact-card agent-conversation-card">
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
              {planMutation.isPending ? (
                <Button
                  danger
                  htmlType="button"
                  icon={<StopOutlined />}
                  onClick={stopCurrentAgentPlan}
                >
                  停止思考
                </Button>
              ) : (
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<RobotOutlined />}
                  disabled={!projectId}
                >
                  发送给 Agent
                </Button>
              )}
            </span>
          </Tooltip>
        </Form>
      </Card>
      ) : null}

      {conversation ? (
        <Card
          title="与 Agent 协作"
          className="compact-card agent-conversation-card"
          extra={<Tag color={planMutation.isPending ? "processing" : "blue"}>
            {planMutation.isPending ? "Agent 正在处理" : "可继续补充或纠正"}
          </Tag>}
        >
          {historyPlaybackWarning ? (
            <Alert
              showIcon
              type="warning"
              message="部分历史过程暂未恢复"
              description={historyPlaybackWarning}
              style={{ marginBottom: 16 }}
            />
          ) : null}
          <div className="agent-message-list">
            {historicalTranscript.entries.map((entry) => entry.kind === "MESSAGE" ? (
              <AgentConversationMessageBubble key={entry.key} item={entry.message} />
            ) : (
              <div key={entry.key} className="agent-message-row is-agent agent-process-message-row">
                <div className="agent-message-meta">Agent</div>
                <HistoricalAgentRunProcessPlayback process={entry.process} />
              </div>
            ))}
            {currentConversationHistoryMessages.map((item) => (
              <AgentConversationMessageBubble key={item.id} item={item} />
            ))}
            {processPanel ? (
              <div className="agent-message-row is-agent agent-process-message-row">
                <div className="agent-message-meta">Agent</div>
                {processPanel}
              </div>
            ) : null}
            {currentTurnAgentMessage ? (
              <AgentConversationMessageBubble item={currentTurnAgentMessage} />
            ) : null}
          </div>
          {planFailurePanel}
          <Space wrap className="agent-resolution-strip">
            <Tag color="blue">{conversation.structuredIntent.intentType}</Tag>
            {conversation.structuredIntent.syncMode ? (
              <Tag color="cyan">{syncModeLabels[syncMode] || syncMode}</Tag>
            ) : null}
            <Tag color={modelSucceeded ? "green" : "gold"}>
              {modelSucceeded ? "真实模型已参与" : modelInvoked ? "模型失败，规则降级" : "仅规则解析"}
            </Tag>
            {modelProvider ? <Tag color="geekblue">{modelProvider}</Tag> : null}
            {modelName ? <Tag color="blue">{modelName}</Tag> : null}
            {requestedModelName && requestedModelName !== modelName ? (
              <Tag>{`请求模型：${requestedModelName}`}</Tag>
            ) : null}
            {modelLatencyMs !== undefined ? <Tag>{modelLatencyMs} ms</Tag> : null}
            {modelTotalTokens !== undefined ? <Tag>{modelTotalTokens} tokens</Tag> : null}
            {conversation.resolvedConfiguration.taskName ? (
              <Tag color="blue">任务：{conversation.resolvedConfiguration.taskName}</Tag>
            ) : null}
            {conversation.resolvedConfiguration.sourceDatasourceName ? (
              <Tag color="green">源端：{conversation.resolvedConfiguration.sourceDatasourceName}</Tag>
            ) : null}
            {conversation.resolvedConfiguration.targetDatasourceName ? (
              <Tag color="green">目标端：{conversation.resolvedConfiguration.targetDatasourceName}</Tag>
            ) : null}
            {conversation.resolvedConfiguration.objectMappings.length ? (
              <Tag color="green">已补全 {conversation.resolvedConfiguration.objectMappings.length} 条对象映射</Tag>
            ) : null}
          </Space>
          {conversation.resolvedConfiguration.objectMappings.length ? (
            <div className="agent-resolved-mapping-list">
              {resolvedObjectMappings(conversation.resolvedConfiguration.objectMappings).map((mapping) => (
                <div className="agent-resolved-mapping-row" key={mapping.objectKey}>
                  <Typography.Text>
                    {mapping.sourceSchemaName ? `${mapping.sourceSchemaName}.` : ""}
                    {mapping.sourceObjectName || "SQL 结果集"}
                    {" → "}
                    {mapping.targetSchemaName ? `${mapping.targetSchemaName}.` : ""}
                    {mapping.targetObjectName}
                  </Typography.Text>
                  {mapping.whereCondition ? (
                    <Tag color="cyan">WHERE {mapping.whereCondition}</Tag>
                  ) : null}
                  {mapping.fieldMappings.length ? (
                    <Tag>{mapping.fieldMappings.length} 个字段</Tag>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          {!modelSucceeded ? (
            <Alert
              showIcon
              type="warning"
              style={{ marginTop: 12 }}
              message={modelInvoked ? "真实模型调用失败，本轮已安全降级" : "本轮没有调用真实模型"}
              description={modelFallbackReason ? `降级原因：${modelFallbackReason}` : `解析模式：${resolverMode || "DETERMINISTIC_FALLBACK"}`}
            />
          ) : null}
          {conversation.phase === "WAITING_CLARIFICATION" && !planFailure ? (
            <Alert
              showIcon
              type="warning"
              className="agent-inline-clarification"
              message="Agent 还需要确认以下信息"
              description={(
                <Space direction="vertical" size={8} style={{ width: "100%" }}>
                  <Space wrap>
                    {missingParameterLabels.length ? missingParameterLabels.map((label) => (
                      <Tag key={label} color="gold">{label}</Tag>
                    )) : (
                      <Tag color="gold">请根据 Agent 回复继续补充或纠正</Tag>
                    )}
                  </Space>
                  <Typography.Text type="secondary">
                    直接在下方用自然语言回答即可，Agent 会重新核对数据源和真实元数据，并自动更新已解析配置。
                  </Typography.Text>
                  <Button
                    type="link"
                    size="small"
                    className="agent-inline-clarification-link"
                    onClick={() => scrollToAgentSection("agent-clarification-card")}
                  >
                    自动补全失败时使用高级配置
                  </Button>
                </Space>
              )}
            />
          ) : null}
          <div id="agent-conversation-composer" className="agent-composer">
            <Input.TextArea
              value={followUpMessage}
              onChange={(event) => setFollowUpMessage(event.target.value)}
              onPressEnter={(event) => {
                if (!event.shiftKey) {
                  event.preventDefault();
                  continueConversation();
                }
              }}
              autoSize={{ minRows: 2, maxRows: 6 }}
              placeholder="继续告诉 Agent 需要补充、修改或纠正什么。Enter 发送，Shift + Enter 换行"
              disabled={executionInProgress || planMutation.isPending}
            />
            <div className="agent-composer-footer">
              <Typography.Text type="secondary">
                后续消息只会在当前会话中创建新 Run；Agent 会沿用上下文并更新已解析配置。
              </Typography.Text>
              {planMutation.isPending ? (
                <Tooltip title="停止当前模型请求和后续 Agent 推理，不会撤销已启动的同步任务">
                  <Button
                    danger
                    icon={<StopOutlined />}
                    onClick={stopCurrentAgentPlan}
                  >
                    停止思考
                  </Button>
                </Tooltip>
              ) : (
                <Button
                  type="primary"
                  icon={<ArrowRightOutlined />}
                  onClick={continueConversation}
                  disabled={!followUpMessage.trim() || executionInProgress}
                >
                  发送
                </Button>
              )}
            </div>
          </div>
        </Card>
      ) : null}

      {diagnosticItems.length ? (
        <Card
          title="运行诊断"
          className="compact-card agent-diagnostics-card"
          extra={<Tag>{diagnosticItems.length} 个编排与治理事件</Tag>}
        >
          <Collapse
            ghost
            items={[{
              key: "agent-runtime-diagnostics",
              label: "查看 LangGraph 编排、模型治理、Skill 与权限诊断",
              children: (
                <Timeline
                  className="agent-diagnostics-timeline"
                  items={diagnosticItems.map((item) => {
                    const detailEntries = Object.entries(item.details).filter(([key]) => key !== "sequence");
                    return {
                      color: observationColor(item.status),
                      dot: item.status === "RUNNING" ? <Spin size="small" /> : observationIcon(item.category),
                      children: (
                        <div className="agent-diagnostic-step">
                          <Space wrap>
                            <Typography.Text strong>{item.title}</Typography.Text>
                            <Tag color="blue">{observationCategory(item.category)}</Tag>
                            <Tag color={observationColor(item.status)}>{observationStatus(item.status)}</Tag>
                          </Space>
                          <Typography.Paragraph type="secondary" className="agent-process-step-summary">
                            {item.summary}
                          </Typography.Paragraph>
                          {detailEntries.length ? (
                            <Collapse
                              ghost
                              size="small"
                              items={[{
                                key: `${item.id}-diagnostic-details`,
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
              ),
            }]}
          />
        </Card>
      ) : null}

      {conversation?.phase === "RESOLVING_AUTONOMOUSLY" ? (
        <Alert
          showIcon
          icon={<Spin size="small" />}
          type="info"
          message="Agent 正在自主核对执行条件"
          description={conversation.assistantMessage}
          style={{ marginBottom: 16 }}
        />
      ) : null}

      {conversation && (conversation.phase === "WAITING_CLARIFICATION" || showAdvancedClarification) ? (
        <Card
          id="agent-clarification-card"
          title={editingReadyConfiguration
            ? "修改 Agent 任务配置"
            : showAdvancedClarification
              ? "高级配置"
              : "补充与确认任务配置"}
          className="compact-card"
        >
          <Alert
            showIcon
            type={editingReadyConfiguration ? "info" : "warning"}
            message={editingReadyConfiguration
              ? "正在修改最新 Agent 配置，保存后会重新生成审核计划"
              : `当前还需补充 ${missingParameterLabels.length || 1} 项任务配置`}
            description={(
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <Typography.Text>
                  {editingReadyConfiguration
                    ? "你可以调整任务名称、模式、数据源、对象映射、字段映射、WHERE、调度或 SQL。旧计划在配置发生变化后立即失效。"
                    : metadataDefaultsConfirmationMessage}
                </Typography.Text>
                {!editingReadyConfiguration ? (
                  <Space wrap>
                    {missingParameterLabels.length ? missingParameterLabels.map((label) => (
                      <Tag key={label} color="gold">必填：{label}</Tag>
                    )) : conversation.clarificationQuestions.map((question) => (
                      <Tag key={question.parameterName} color="gold">{question.question}</Tag>
                    ))}
                  </Space>
                ) : null}
              </Space>
            )}
            style={{ marginBottom: 16 }}
          />
          {!showAdvancedClarification ? (
            <>
              <Alert
                showIcon
                type={hasQuickClarificationFields ? "info" : "warning"}
                message={hasQuickClarificationFields
                  ? "只需回答当前缺失或存在歧义的信息"
                  : "Agent 已完成自动核对，但对象映射仍需要你确认"}
                description={hasQuickClarificationFields
                  ? `${metadataDefaultsConfirmationMessage} 提交后 Agent 会继续测试连接、读取真实元数据并尝试形成完整任务。`
                  : `${metadataDefaultsConfirmationMessage} 你可以切换到高级编辑器接管存在冲突的映射；其余内容继续沿用当前会话。`}
                style={{ marginBottom: 16 }}
              />
              {hasQuickClarificationFields ? (
                <Form<QuickClarificationValues>
                  form={quickClarificationForm}
                  layout="vertical"
                  onFinish={(values) => {
                    if (values.targetTableResolution === "SELECT_EXISTING") {
                      handoffToManualWizard();
                      return;
                    }
                    const currentConfiguration = clarificationForm.getFieldsValue(true);
                    planMutation.mutate({
                      objective,
                      clarification: {
                        ...currentConfiguration,
                        ...values,
                        customSqlText: values.customSqlConfirmed ? generatedSqlPreview : undefined,
                      },
                      preserveTimeline: true,
                    });
                  }}
                >
                  <div className="grid grid-two-form">
                    {needsSourceDatasource ? (
                      <Form.Item
                        name="sourceDatasourceId"
                        label="明确源端数据源"
                        rules={[{ required: true, message: "请选择 Agent 应使用的源端数据源" }]}
                      >
                        <Select
                          showSearch
                          optionFilterProp="label"
                          options={quickSourceOptions}
                          loading={sourceQuery.isLoading}
                          placeholder={sourceClarification?.candidates?.length
                            ? "名称存在歧义，请从候选中选择"
                            : "选择当前项目已授权的 SOURCE 数据源"}
                        />
                      </Form.Item>
                    ) : <div />}
                    {needsTargetDatasource ? (
                      <Form.Item
                        name="targetDatasourceId"
                        label="明确目标端数据源"
                        rules={[{ required: true, message: "请选择 Agent 应使用的目标端数据源" }]}
                      >
                        <Select
                          showSearch
                          optionFilterProp="label"
                          options={quickTargetOptions}
                          loading={targetQuery.isLoading}
                          placeholder={targetClarification?.candidates?.length
                            ? "名称存在歧义，请从候选中选择"
                            : "选择当前项目已授权的 TARGET 数据源"}
                        />
                      </Form.Item>
                    ) : <div />}
                  </div>
                  {needsScheduleFrequency || needsScheduleStartTime ? (
                    <div className="grid grid-two-form">
                      {needsScheduleFrequency ? (
                        <Form.Item
                          name="scheduleFrequency"
                          label="执行频率"
                          rules={[{ required: true, message: "请选择定期任务执行频率" }]}
                        >
                          <Select
                            options={[
                              { value: "HOURLY", label: "每小时" },
                              { value: "DAILY", label: "每天" },
                              { value: "WEEKLY", label: "每周" },
                              { value: "CUSTOM_CRON", label: "自定义 Cron" },
                            ]}
                          />
                        </Form.Item>
                      ) : <div />}
                      {needsScheduleStartTime ? (
                        <Form.Item
                          name="scheduleStartTime"
                          label="首次执行时间（北京时间）"
                          rules={[{ required: true, message: "请选择首次执行时间" }]}
                        >
                          <Input type="datetime-local" />
                        </Form.Item>
                      ) : <div />}
                    </div>
                  ) : null}
                  {quickScheduleFrequency === "CUSTOM_CRON" ? (
                    <Form.Item
                      name="scheduleCron"
                      label="Spring 六段 Cron"
                      rules={[{ required: true, message: "请输入六段 Cron 表达式" }]}
                    >
                      <Input placeholder="例如 0 0 2 * * *" />
                    </Form.Item>
                  ) : null}
                  {needsSqlConfirmation ? (
                    <Card size="small" title="Agent 生成的只读 SQL" style={{ marginBottom: 16 }}>
                      <Input.TextArea value={generatedSqlPreview} readOnly autoSize={{ minRows: 4, maxRows: 12 }} />
                      <Form.Item
                        name="customSqlConfirmed"
                        valuePropName="checked"
                        rules={[{
                          validator: async (_, checked?: boolean) => {
                            if (!checked) throw new Error("请确认 SQL，或进入高级编辑器修改");
                          },
                        }]}
                        style={{ marginTop: 12, marginBottom: 0 }}
                      >
                        <Checkbox>我已核对 SQL 的表、字段、别名和过滤范围，同意用于本任务</Checkbox>
                      </Form.Item>
                    </Card>
                  ) : null}
                  {needsTargetTableResolution ? (
                    <Form.Item
                      name="targetTableResolution"
                      label="目标表不存在，选择处理方式"
                      rules={[{ required: true, message: "请选择创建目标表或改选已有表" }]}
                    >
                      <Select options={[
                        { value: "CREATE_FROM_SOURCE", label: "按源表结构生成建表预览，确认后创建" },
                        { value: "SELECT_EXISTING", label: "进入手工向导选择其他已有目标表" },
                      ]} />
                    </Form.Item>
                  ) : null}
                  {needsMappingDefaultsConfirmation ? (
                    <Card size="small" title="确认 Agent 自动补全的字段与数据范围" style={{ marginBottom: 16 }}>
                      <Alert
                        showIcon
                        type="info"
                        message="默认映射真实存在于两端的全部同名字段"
                        description={mappingDefaultsQuestion?.question
                          || "当前 WHERE 为空，将同步每条对象映射范围内的全部数据。你可以接受默认配置，也可以打开当前页编辑器逐表修改。"}
                        style={{ marginBottom: 12 }}
                      />
                      <div className="agent-default-mapping-list">
                        {reviewMappings.map((mapping, index) => {
                          const enabledFields = mapping.fieldMappings.filter(
                            (field) => field.syncEnabled !== false && field.sourceField && field.targetField,
                          );
                          const disabledFieldCount = mapping.fieldMappings.length - enabledFields.length;
                          const sourceName = mapping.sourceSchemaName
                            ? `${mapping.sourceSchemaName}.${mapping.sourceObjectName || "未选择源表"}`
                            : mapping.sourceObjectName || "未选择源表";
                          const targetName = mapping.targetSchemaName
                            ? `${mapping.targetSchemaName}.${mapping.targetObjectName || "未选择目标表"}`
                            : mapping.targetObjectName || "未选择目标表";
                          return (
                            <section
                              key={mapping.objectKey || `default-review-${index}`}
                              className="agent-default-mapping-detail"
                            >
                              <div className="agent-default-mapping-header">
                                <div className="agent-default-mapping-title">
                                  <Tag color="blue">映射 {index + 1}</Tag>
                                  <Typography.Text strong>{sourceName} → {targetName}</Typography.Text>
                                </div>
                                <Space wrap>
                                  <Tag color={enabledFields.length ? "green" : "red"}>
                                    同步 {enabledFields.length} 个字段
                                  </Tag>
                                  {disabledFieldCount ? <Tag>不同步 {disabledFieldCount} 个字段</Tag> : null}
                                </Space>
                              </div>
                              <div className="agent-default-where-row">
                                <Typography.Text type="secondary">WHERE 条件</Typography.Text>
                                <Typography.Text code>
                                  {mapping.whereCondition || "未设置（同步该表全部数据）"}
                                </Typography.Text>
                              </div>
                              {mapping.fieldMappings.length ? (
                                <div className="agent-configuration-field-list">
                                  <div className="agent-configuration-field-row is-header" aria-hidden="true">
                                    <span>源字段</span>
                                    <span>源类型</span>
                                    <span />
                                    <span>目标字段</span>
                                    <span>目标类型</span>
                                    <span>同步状态</span>
                                  </div>
                                  {mapping.fieldMappings.map((field, fieldIndex) => {
                                    const fieldEnabled = field.syncEnabled !== false
                                      && Boolean(field.sourceField && field.targetField);
                                    return (
                                      <div
                                        className={`agent-configuration-field-row${fieldEnabled ? "" : " is-disabled"}`}
                                        key={field.key || `${mapping.objectKey}-default-field-${fieldIndex}`}
                                      >
                                        <Typography.Text code>{field.sourceField || "未设置"}</Typography.Text>
                                        <Typography.Text type="secondary">{field.sourceType || "未知类型"}</Typography.Text>
                                        <Typography.Text>→</Typography.Text>
                                        <Typography.Text code>{field.targetField || "未映射"}</Typography.Text>
                                        <Typography.Text type="secondary">{field.targetType || "未知类型"}</Typography.Text>
                                        <Tag color={!fieldEnabled ? "default" : field.typeCompatible === false ? "red" : "green"}>
                                          {!fieldEnabled ? "不同步" : field.typeCompatible === false ? "类型待处理" : "同步"}
                                        </Tag>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <Alert showIcon type="warning" message="尚未形成字段映射，不能接受当前默认配置" />
                              )}
                            </section>
                          );
                        })}
                      </div>
                      <Form.Item
                        name="mappingDefaultsConfirmed"
                        valuePropName="checked"
                        rules={[{
                          validator: async (_, checked?: boolean) => {
                            if (!checked) throw new Error("请接受默认配置，或打开当前页编辑器修改字段映射/WHERE");
                          },
                        }]}
                        style={{ marginTop: 12, marginBottom: 0 }}
                      >
                        <Checkbox>接受以上同名字段映射，并确认当前不设置 WHERE 条件</Checkbox>
                      </Form.Item>
                    </Card>
                  ) : null}
                  <Space wrap>
                    <Button
                      type="primary"
                      htmlType="submit"
                      icon={<ArrowRightOutlined />}
                      loading={planMutation.isPending && Boolean(planMutation.variables?.clarification)}
                    >
                      继续由 Agent 自动核对
                    </Button>
                    <Button onClick={handoffToManualWizard}>
                      进入完整任务向导
                    </Button>
                    <Button type="link" onClick={() => setShowAdvancedClarification(true)}>
                      当前页编辑映射
                    </Button>
                  </Space>
                </Form>
              ) : (
                <Space wrap>
                  <Button type="primary" onClick={handoffToManualWizard}>
                    {needsFieldMappingConversions ? "进入向导处理类型转换" : "进入完整任务向导"}
                  </Button>
                  <Button onClick={() => setShowAdvancedClarification(true)}>当前页编辑映射</Button>
                </Space>
              )}
              {needsObjectMappings && hasQuickClarificationFields ? (
                <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                  对象映射暂不要求手工填写。Agent 会先依据你选择的数据源读取真实元数据；只有无法唯一匹配或校验冲突时才再次追问。
                </Typography.Paragraph>
              ) : null}
            </>
          ) : (
          <Form<ClarificationFormValues>
            form={clarificationForm}
            layout="vertical"
            onValuesChange={invalidateConfigurationReview}
            onFinish={(values) => planMutation.mutate({
              objective,
              clarification: {
                ...values,
                mappingDefaultsConfirmed: true,
              },
              preserveTimeline: true,
            })}
          >
            <Button
              type="link"
              onClick={editingReadyConfiguration
                ? cancelConfigurationReviewEdit
                : () => setShowAdvancedClarification(false)}
              style={{ paddingInline: 0, marginBottom: 8 }}
            >
              {editingReadyConfiguration ? "取消修改并返回配置审核" : "返回渐进式追问"}
            </Button>
            <Alert
              showIcon
              type="info"
              message={editingReadyConfiguration ? "修改最新任务配置" : "请在下方补齐当前任务缺少的配置"}
              description={editingReadyConfiguration
                ? "保存后 Agent 会重新读取真实元数据、生成工具计划并进入新的审核阶段。未经重新审核，任务不会执行。"
                : `当前待填写：${missingParameterLabels.join("；") || "任务对象与字段映射"}。表和字段均来自已选数据源的真实元数据，不需要填写 JSON。`}
              style={{ marginBottom: 16 }}
            />
            <div className="grid grid-two-form">
              <Form.Item name="taskName" label="任务名称" rules={[{ required: true, message: "请输入任务名称" }]}>
                <Input maxLength={128} />
              </Form.Item>
              <Form.Item name="syncMode" label="传输模式" rules={[{ required: true, message: "请选择传输模式" }]}>
                <Select options={userSyncModeOptions} onChange={changeClarificationSyncMode} />
              </Form.Item>
            </div>
            <div className="grid grid-two-form">
              <Form.Item name="sourceDatasourceId" label="源端数据源" rules={[{ required: true, message: "请选择源端数据源" }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={sourceOptions}
                  loading={sourceQuery.isLoading}
                  placeholder="仅展示 SOURCE 数据源"
                  onChange={() => {
                    clarificationForm.setFieldsValue({
                      mappingDefaultsConfirmed: false,
                      objectMappings: [{
                        objectKey: sqlClarificationMode ? "agent-sql-result" : "agent-mapping-1",
                        targetObjectName: "",
                        fieldMappings: [],
                      }],
                    });
                    quickClarificationForm.setFieldValue("mappingDefaultsConfirmed", false);
                  }}
                />
              </Form.Item>
              <Form.Item name="targetDatasourceId" label="目标端数据源" rules={[{ required: true, message: "请选择目标端数据源" }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={targetOptions}
                  loading={targetQuery.isLoading}
                  placeholder="仅展示 TARGET 数据源"
                  onChange={() => {
                    clarificationForm.setFieldsValue({
                      mappingDefaultsConfirmed: false,
                      objectMappings: [{
                        objectKey: sqlClarificationMode ? "agent-sql-result" : "agent-mapping-1",
                        targetObjectName: "",
                        fieldMappings: [],
                      }],
                    });
                    quickClarificationForm.setFieldValue("mappingDefaultsConfirmed", false);
                  }}
                />
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
            {sourceMetadataQuery.isError || targetMetadataQuery.isError ? (
              <Alert
                showIcon
                type="error"
                message="元数据加载失败，暂时不能形成可靠的源表到目标表映射"
                description="请确认数据源连接及授权后重试。Agent 不会在缺少真实元数据时猜测表名或字段映射。"
                style={{ marginBottom: 16 }}
              />
            ) : null}
            {needsFieldMappings ? (
              <Alert
                showIcon
                type="warning"
                message="每条对象映射都必须确认至少一个字段"
                description="请先选择真实源表和目标表。系统会列出源表字段，并默认启用两端同名字段；你可以关闭不需要同步的字段或修改目标字段。"
                style={{ marginBottom: 16 }}
              />
            ) : null}
            {scheduledClarificationMode ? (
              <Form.Item
                name="scheduleConfig"
                label="定时配置"
                rules={[{ required: true, message: "定期全量/定期批量必须配置调度规则" }]}
              >
                <Input.TextArea rows={2} placeholder='{"cron":"0 0 2 * * ?","timezone":"Asia/Shanghai"}' />
              </Form.Item>
            ) : null}
            {sqlClarificationMode ? (
              <Form.Item
                name="customSqlText"
                label="只读 SQL"
                rules={[
                  { required: true, message: "SQL 语句模式必须填写查询 SQL" },
                  {
                    validator: async (_, value?: string) => {
                      const sql = value?.trim() || "";
                      if (!sql) return;
                      if (!/^(select|with)\b/i.test(sql)
                        || /\b(insert|update|delete|drop|truncate|alter|create|merge|call)\b/i.test(sql)) {
                        throw new Error("只允许单条 SELECT/WITH 只读查询，禁止 DDL/DML 和存储过程");
                      }
                    },
                  },
                ]}
              >
                <Input.TextArea
                  rows={5}
                  placeholder="SELECT id, name AS customer_name FROM customer WHERE status = 'ACTIVE'"
                />
              </Form.Item>
            ) : null}
            <Form.Item name="writeStrategy" label="写入策略" rules={[{ required: true }]}>
              <Select
                disabled={realtimeClarificationMode}
                options={[
                  { value: "INSERT", label: "INSERT（目标表需满足插入准入）" },
                  { value: "UPDATE", label: "UPDATE / MERGE（目标表需具备主键或唯一键）" },
                ]}
              />
            </Form.Item>

            <Alert
              showIcon
              type="info"
              message={sqlClarificationMode ? "SQL 结果集 → 目标表" : "每一行都必须是明确的“源表 → 目标表”映射"}
              description={sqlClarificationMode
                ? "源表和输出字段由 SQL 决定；这里只选择目标表，并把 SQL 输出字段或别名映射到目标字段。"
                : "源表只能从源端真实元数据中选择；目标端仅在存在同名表时自动匹配，否则保持为空，由你选择或编辑。字段映射与 WHERE 条件都绑定到当前这一对对象。"}
              style={{ marginBottom: 16 }}
            />
            <Typography.Title level={5}>{sqlClarificationMode ? "目标对象与字段映射" : "源表 → 目标表对象映射"}</Typography.Title>
            <Form.List
              name="objectMappings"
              rules={[{
                validator: async (_, mappings?: ObjectMappingInput[]) => {
                  if (!mappings?.length) throw new Error("请至少配置一条对象映射");
                  for (const [index, mapping] of mappings.entries()) {
                    if (!sqlClarificationMode && !mapping.sourceObjectName) {
                      throw new Error(`映射 ${index + 1} 尚未选择源表`);
                    }
                    if (!mapping.targetObjectName) {
                      throw new Error(`映射 ${index + 1} 尚未选择或填写目标表`);
                    }
                    if (!targetSchemaOptional && !mapping.targetSchemaName) {
                      throw new Error(`映射 ${index + 1} 的目标数据源需要填写 schema`);
                    }
                    const executableFields = (mapping.fieldMappings ?? [])
                      .filter((item) => item.syncEnabled !== false && item.sourceField && item.targetField);
                    if (!executableFields.length) {
                      throw new Error(`映射 ${index + 1} 尚未形成可执行字段映射`);
                    }
                  }
                },
              }]}
            >
              {(fields, { add, remove }, { errors }) => (
                <Space direction="vertical" style={{ width: "100%" }}>
                  {fields.map((field, index) => {
                    const mapping = clarificationMappings[index];
                    const selectedTargetTable = findMetadataTableByKey(targetMetadata, mapping?.targetTableKey);
                    const targetFieldOptions = sortedColumns(selectedTargetTable)
                      .map((item) => ({ value: item.fieldName, label: `${item.fieldName}（${item.dataTypeName || "未知类型"}）` }));
                    const sourceLabel = mapping?.sourceSchemaName
                      ? `${mapping.sourceSchemaName}.${mapping.sourceObjectName || "未选择"}`
                      : mapping?.sourceObjectName || "未选择源表";
                    const targetLabel = mapping?.targetSchemaName
                      ? `${mapping.targetSchemaName}.${mapping.targetObjectName || "未选择"}`
                      : mapping?.targetObjectName || "未选择目标表";
                    return (
                      <Card
                        key={field.key}
                        size="small"
                        title={sqlClarificationMode
                          ? `SQL 结果集 → ${targetLabel}`
                          : `映射 ${index + 1}：${sourceLabel} → ${targetLabel}`}
                        extra={!sqlClarificationMode && fields.length > 1 ? (
                          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                        ) : null}
                      >
                        <Form.Item name={[field.name, "objectKey"]} hidden><Input /></Form.Item>
                        <Form.Item name={[field.name, "sourceSchemaName"]} hidden><Input /></Form.Item>
                        <Form.Item name={[field.name, "sourceObjectName"]} hidden><Input /></Form.Item>
                        {!sqlClarificationMode ? (
                          <Form.Item
                            name={[field.name, "sourceTableKey"]}
                            label={`源端表${sourceSchemaOptional ? "（MySQL 无需 schema）" : ""}`}
                            rules={[{ required: true, message: "请选择真实源表" }]}
                          >
                            <Select
                              showSearch
                              optionFilterProp="label"
                              options={sourceTableOptions}
                              loading={sourceMetadataQuery.isLoading}
                              placeholder="从源端真实元数据中选择"
                              onChange={(value) => selectSourceMappingTable(index, value)}
                            />
                          </Form.Item>
                        ) : null}
                        <Form.Item name={[field.name, "targetTableKey"]} label="从目标端元数据选择表（可选）">
                          <Select
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            options={targetTableOptions}
                            loading={targetMetadataQuery.isLoading}
                            placeholder="选择后自动填写目标 schema、表名和同名字段"
                            onChange={(value) => value && selectTargetMappingTable(index, value)}
                            onClear={() => clearTargetMappingTable(index)}
                          />
                        </Form.Item>
                        <div className="grid grid-two-form">
                          <Form.Item
                            name={[field.name, "targetSchemaName"]}
                            label={`目标 schema${targetSchemaOptional ? "（MySQL 可留空）" : ""}`}
                            rules={targetSchemaOptional ? undefined : [{ required: true, message: "请输入目标 schema" }]}
                          >
                            <Input placeholder={targetSchemaOptional ? "MySQL/MariaDB 可留空" : "例如 public"} />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, "targetObjectName"]}
                            label="目标表"
                            rules={[{ required: true, message: "请选择或填写目标表" }]}
                          >
                            <Input placeholder="可以修改为目标端实际表名" />
                          </Form.Item>
                        </div>
                        {!sqlClarificationMode ? (
                          <Form.Item
                            name={[field.name, "whereCondition"]}
                            label="当前源表的 WHERE 条件（可选）"
                            extra="留空表示不筛选，将同步该对象映射范围内的全部数据。"
                          >
                            <Input placeholder="例如 status = 'ACTIVE'；支持 OR、括号、函数和子查询" />
                          </Form.Item>
                        ) : null}
                        {!mapping?.fieldMappings?.some(
                          (item) => item.syncEnabled !== false && item.sourceField && item.targetField,
                        ) ? (
                          <Alert
                            showIcon
                            type="error"
                            message="当前映射没有可同步字段"
                            description={!mapping?.sourceObjectName
                              ? "请先选择源端真实表，系统才能读取并展示源字段。"
                              : !mapping?.targetObjectName
                                ? "请再选择或填写目标表；目标表存在于真实元数据后，系统会默认映射同名字段。"
                                : "两端表没有可用同名字段，或目标表尚未匹配真实元数据。请检查目标 schema/表名并手动选择目标字段。"}
                            style={{ marginBottom: 12 }}
                          />
                        ) : null}
                        <Collapse
                          size="small"
                          defaultActiveKey={[`fields-${field.key}`]}
                          items={[{
                            key: `fields-${field.key}`,
                            label: `字段映射（${mapping?.fieldMappings?.length ?? 0} 个源字段）`,
                            children: (
                              <Form.List name={[field.name, "fieldMappings"]}>
                                {(fieldRows, { add: addField, remove: removeField }) => (
                                  <Space direction="vertical" style={{ width: "100%" }}>
                                    {fieldRows.map((fieldRow) => (
                                      <Card key={fieldRow.key} size="small">
                                        <Form.Item name={[fieldRow.name, "key"]} hidden><Input /></Form.Item>
                                        <Form.Item name={[fieldRow.name, "sourceType"]} hidden><Input /></Form.Item>
                                        <Form.Item name={[fieldRow.name, "targetType"]} hidden><Input /></Form.Item>
                                        <div className="grid grid-two-form">
                                          <Form.Item
                                            name={[fieldRow.name, "sourceField"]}
                                            label={sqlClarificationMode ? "SQL 输出字段/别名" : "源字段"}
                                            rules={[{ required: true, message: "请输入源字段或 SQL 别名" }]}
                                          >
                                            <Input disabled={!sqlClarificationMode} />
                                          </Form.Item>
                                          <Form.Item name={[fieldRow.name, "targetField"]} label="目标字段">
                                            <AutoComplete
                                              options={targetFieldOptions}
                                              placeholder="选择或填写目标字段"
                                              filterOption={(input, option) => String(option?.value || "").toLowerCase().includes(input.toLowerCase())}
                                            />
                                          </Form.Item>
                                        </div>
                                        <Space>
                                          <Form.Item name={[fieldRow.name, "syncEnabled"]} valuePropName="checked" noStyle>
                                            <Checkbox>同步该字段</Checkbox>
                                          </Form.Item>
                                          {sqlClarificationMode ? (
                                            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeField(fieldRow.name)}>
                                              删除
                                            </Button>
                                          ) : null}
                                        </Space>
                                        {mapping?.fieldMappings?.[fieldRow.name]?.compatibilityNote ? (
                                          <Typography.Text type="secondary">
                                            {mapping.fieldMappings[fieldRow.name].compatibilityNote}
                                          </Typography.Text>
                                        ) : null}
                                      </Card>
                                    ))}
                                    {sqlClarificationMode ? (
                                      <Button
                                        type="dashed"
                                        icon={<PlusOutlined />}
                                        onClick={() => addField({
                                          key: `sql-field-${Date.now()}`,
                                          sourceField: "",
                                          targetField: "",
                                          syncEnabled: true,
                                        })}
                                        block
                                      >
                                        添加 SQL 输出字段映射
                                      </Button>
                                    ) : null}
                                  </Space>
                                )}
                              </Form.List>
                            ),
                          }]}
                        />
                      </Card>
                    );
                  })}
                  {!sqlClarificationMode ? (
                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      onClick={() => add({
                        objectKey: `agent-mapping-${fields.length + 1}`,
                        targetObjectName: "",
                        fieldMappings: [],
                      })}
                      block
                    >
                      添加“源表 → 目标表”映射
                    </Button>
                  ) : null}
                  <Form.ErrorList errors={errors} />
                </Space>
              )}
            </Form.List>
            <Space wrap style={{ marginTop: 20 }}>
              <Button
                type="primary"
                htmlType="submit"
                icon={<ArrowRightOutlined />}
                loading={planMutation.isPending && Boolean(planMutation.variables?.clarification)}
                disabled={!hasDatasourceOptions || sourceMetadataQuery.isLoading || targetMetadataQuery.isLoading}
              >
                {editingReadyConfiguration ? "保存修改并重新生成审核计划" : "提交补充信息并生成计划"}
              </Button>
              {editingReadyConfiguration ? (
                <Button onClick={handoffToManualWizard}>进入完整四步任务向导</Button>
              ) : null}
            </Space>
          </Form>
          )}
        </Card>
      ) : null}

      {controlPlane && activeToolNames.length && activeRequiresConfirmation ? (
        <Card id="agent-execution-plan-card" title="可观测执行计划" className="compact-card">
          {isSyncTaskCreationReview && !failureRecoveryPlanActive ? (
            <div className="agent-configuration-review">
              <div className="agent-configuration-review-header">
                <Space>
                  <EyeOutlined />
                  <Typography.Title level={5} style={{ margin: 0 }}>执行前任务配置审核</Typography.Title>
                </Space>
                <Tag color="gold">尚未执行</Tag>
              </div>
              <Alert
                showIcon
                type="info"
                message="请先审核 Agent 将要创建的任务设置"
                description="以下内容是本次写入任务草稿、预检查、发布和运行所使用的最新配置。你可以只修改不认可的部分；任何修改都会使当前执行计划失效并重新生成。"
                style={{ marginBottom: 16 }}
              />
              {!taskConfigurationReady ? (
                <Alert
                  showIcon
                  type="error"
                  message="当前配置不具备创建或执行条件"
                  description={(
                    <Space direction="vertical" size={4}>
                      {uniqueConfigurationReadinessIssues.map((issue) => (
                        <Typography.Text key={issue}>• {issue}</Typography.Text>
                      ))}
                      <Typography.Text type="secondary">
                        请用对话补充，或在当前页修改设置。所有必填项和真实元数据校验通过后才能确认执行。
                      </Typography.Text>
                    </Space>
                  )}
                  style={{ marginBottom: 16 }}
                />
              ) : (
                <Alert
                  showIcon
                  type="success"
                  message="任务必填配置与真实元数据核对已通过"
                  description="对象、字段、数据范围和模式必填项均已形成可审核配置；最终数据库准入仍由真实预检查决定。"
                  style={{ marginBottom: 16 }}
                />
              )}
              <Descriptions
                size="small"
                bordered
                column={{ xs: 1, md: 2, xl: 3 }}
                items={[
                  { key: "taskName", label: "任务名称", children: reviewTaskName },
                  { key: "project", label: "所属项目", children: selectedProjectId ? `项目 #${selectedProjectId}` : "当前项目" },
                  { key: "group", label: "任务分组", children: "默认分组（可在完整向导修改）" },
                  { key: "source", label: "源端数据源", children: reviewSourceName },
                  { key: "target", label: "目标端数据源", children: reviewTargetName },
                  { key: "mode", label: "传输模式", children: syncModeLabels[reviewSyncMode] || reviewSyncMode },
                  { key: "write", label: "写入策略", children: reviewWriteStrategy === "UPDATE" ? "UPDATE / MERGE" : "INSERT" },
                  { key: "mappingCount", label: "对象映射", children: `${reviewMappings.length} 条` },
                  { key: "description", label: "任务目标", children: objective, span: 2 },
                  ...(isScheduledSyncMode(reviewSyncMode) ? [{
                    key: "schedule",
                    label: "调度周期",
                    children: scheduleConfigSummary(reviewScheduleConfig),
                    span: 3,
                  }] : []),
                ]}
              />
              {isSqlSyncMode(reviewSyncMode) ? (
                <div className="agent-configuration-review-section">
                  <Typography.Text strong>只读 SQL</Typography.Text>
                  <pre className="agent-configuration-sql">{reviewCustomSqlText || "尚未生成 SQL"}</pre>
                </div>
              ) : null}
              <div className="agent-configuration-review-section">
                <Typography.Text strong>源表 → 目标表映射</Typography.Text>
                {reviewMappings.length ? (
                  <Collapse
                    className="agent-configuration-mapping-collapse"
                    defaultActiveKey={reviewMappings.map((mapping, mappingIndex) => (
                      mapping.objectKey || `review-mapping-${mappingIndex + 1}`
                    ))}
                    items={reviewMappings.map((mapping, mappingIndex) => {
                      const enabledFields = mapping.fieldMappings.filter((field) => field.syncEnabled !== false);
                      const disabledFieldCount = mapping.fieldMappings.length - enabledFields.length;
                      const sourceName = mapping.sourceSchemaName
                        ? `${mapping.sourceSchemaName}.${mapping.sourceObjectName || "未选择"}`
                        : mapping.sourceObjectName || "SQL 结果集";
                      const targetName = mapping.targetSchemaName
                        ? `${mapping.targetSchemaName}.${mapping.targetObjectName}`
                        : mapping.targetObjectName;
                      return {
                        key: mapping.objectKey || `review-mapping-${mappingIndex + 1}`,
                        label: (
                          <div className="agent-configuration-mapping-label">
                            <Typography.Text strong>{sourceName} → {targetName}</Typography.Text>
                            <Space wrap>
                              {mapping.whereCondition ? <Tag color="cyan">WHERE {mapping.whereCondition}</Tag> : <Tag>无 WHERE</Tag>}
                              <Tag color="blue">同步 {enabledFields.length} 个字段</Tag>
                              {disabledFieldCount ? <Tag>忽略 {disabledFieldCount} 个字段</Tag> : null}
                            </Space>
                          </div>
                        ),
                        children: (
                          <div className="agent-configuration-field-list">
                            {mapping.fieldMappings.length ? mapping.fieldMappings.map((field, fieldIndex) => (
                              <div
                                className={`agent-configuration-field-row${field.syncEnabled === false ? " is-disabled" : ""}`}
                                key={field.key || `${mapping.objectKey}-field-${fieldIndex}`}
                              >
                                <Typography.Text code>{field.sourceField}</Typography.Text>
                                <Typography.Text type="secondary">{field.sourceType || "未知类型"}</Typography.Text>
                                <Typography.Text>→</Typography.Text>
                                <Typography.Text code>{field.targetField || "未映射"}</Typography.Text>
                                <Typography.Text type="secondary">{field.targetType || "未知类型"}</Typography.Text>
                                <Tag color={field.syncEnabled === false ? "default" : field.typeCompatible === false ? "red" : "green"}>
                                  {field.syncEnabled === false ? "不同步" : field.typeCompatible === false ? "类型待处理" : "同步"}
                                </Tag>
                              </div>
                            )) : (
                              <Alert showIcon type="warning" message="尚未形成字段映射，不能执行" />
                            )}
                          </div>
                        ),
                      };
                    })}
                  />
                ) : (
                  <Alert showIcon type="warning" message="尚未形成对象映射，不能执行" style={{ marginTop: 12 }} />
                )}
              </div>
              {isScheduledSyncMode(reviewSyncMode) && reviewScheduleConfig ? (
                <Collapse
                  ghost
                  size="small"
                  items={[{
                    key: "schedule-raw",
                    label: "查看调度配置原文",
                    children: <pre className="agent-configuration-sql">{reviewScheduleConfig}</pre>,
                  }]}
                />
              ) : null}
              <div className="agent-configuration-review-actions">
                <Space wrap>
                  <Button
                    icon={<EditOutlined />}
                    onClick={() => scrollToAgentSection("agent-conversation-composer")}
                  >
                    用对话补充或纠偏
                  </Button>
                  <Button icon={<EditOutlined />} onClick={startConfigurationReviewEdit}>
                    当前页修改设置
                  </Button>
                  <Button onClick={handoffToManualWizard}>进入完整四步任务向导</Button>
                </Space>
                <Checkbox
                  checked={configurationReviewConfirmed}
                  disabled={planMutation.isPending || showAdvancedClarification || !taskConfigurationReady}
                  onChange={(event) => setConfigurationReviewConfirmed(event.target.checked)}
                >
                  我已审核以上最新任务配置，同意按此配置执行
                </Checkbox>
              </div>
            </div>
          ) : null}
          <Steps
            direction="vertical"
            size="small"
            items={activeToolNames.map((toolName) => ({
              title: humanReadableToolName(toolName),
              description: planItems.find((item) => item.toolName === toolName)?.reason
                || "模型基于真实工具结果提出该动作，已通过平台工具与状态治理，等待你的明确授权。",
              status: "wait",
            }))}
          />
          {audits.filter((audit) => audit.state === "WAITING_APPROVAL" || audit.requiresApproval).map((audit) => {
            const patches = Array.isArray(audit.planArguments.patches) ? audit.planArguments.patches : [];
            return (
              <Card key={audit.auditId} size="small" title={humanReadableToolName(audit.toolCode)} style={{ marginTop: 12 }}>
                <Descriptions
                  size="small"
                  column={{ xs: 1, md: 2 }}
                  items={[
                    { key: "risk", label: "风险等级", children: audit.riskLevel },
                    { key: "permission", label: "授权要求", children: audit.requiresApproval ? "必须由当前用户确认" : "无需确认" },
                    { key: "patchCount", label: "建议修改数", children: patches.length },
                    { key: "run", label: "Durable Run", children: audit.runId },
                  ]}
                />
                {patches.length ? (
                  <Space direction="vertical" style={{ width: "100%", marginTop: 12 }}>
                    {patches.map((patch, index) => {
                      const item = patch && typeof patch === "object" ? patch as Record<string, unknown> : {};
                      return (
                        <Alert
                          key={`${audit.auditId}-patch-${index}`}
                          type="warning"
                          showIcon
                          message={`第 ${String(item.rowNumber ?? "-")} 行 · ${String(item.columnName ?? "未知列")}`}
                          description={`建议改为：${String(item.replacementValue ?? "空值")}`}
                        />
                      );
                    })}
                  </Space>
                ) : null}
                {failureRecoveryPlanActive ? (
                  <Collapse
                    ghost
                    size="small"
                    style={{ marginTop: 8 }}
                    items={[{
                      key: `${audit.auditId}-repair-arguments`,
                      label: "查看本次修复动作参数",
                      children: (
                        <pre className="agent-configuration-sql">
                          {JSON.stringify(sanitizeAgentActionPayload(audit.planArguments), null, 2)}
                        </pre>
                      ),
                    }]}
                  />
                ) : null}
              </Card>
            );
          })}
          {taskNameRepairActive && executionAnswer?.repairProposal ? (
            <Alert
              showIcon
              type="warning"
              message="同名任务修复需要你确认"
              description={(
                <Space direction="vertical" size={4} style={{ display: "flex" }}>
                  <Typography.Text>
                    原任务名称：<Typography.Text code>{executionAnswer.repairProposal.originalTaskName}</Typography.Text>
                  </Typography.Text>
                  <Typography.Text>
                    建议任务名称：<Typography.Text code>{executionAnswer.repairProposal.proposedTaskName}</Typography.Text>
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    仅修改任务名称；数据源、对象与字段映射、WHERE、同步模式和写入策略保持不变。当前尚未保存或执行。
                  </Typography.Text>
                </Space>
              )}
              style={{ marginTop: 16 }}
            />
          ) : null}
          <Alert
            showIcon
            type="warning"
            message={taskNameRepairActive
              ? "确认后才会使用新名称重新创建并提交任务"
              : isRecoveryConfirmation ? "确认后才会执行受控恢复动作" : "确认后才会执行写节点"}
            description={taskNameRepairActive
              ? "确认会授权 Agent 使用上方建议名称重新执行草稿保存、真实预检查、发布，并按任务同步模式立即运行或启用调度。若再次冲突，Agent 会保留新的失败事实并继续受控处理。"
              : isRecoveryConfirmation
              ? "诊断、RAG 检索和修复预览均为只读；结构修改、坏行隔离、失败对象重试或修复重放只在本次授权后执行。坏行隔离不会删除源端数据，执行完成后 Agent 会继续验证真实同步结果。"
              : "连接测试和元数据读取为只读节点；草稿保存、预检查、发布和运行会改变业务状态，只在本次确认后执行。"}
            style={{ marginTop: 16, marginBottom: 16 }}
          />
          <Button
            type="primary"
            danger
            icon={<ArrowRightOutlined />}
            loading={executeMutation.isPending}
            disabled={(Boolean(executionAnswer) && !failureRecoveryPlanActive)
              || planMutation.isPending
              || showAdvancedClarification
              || (isSyncTaskCreationReview && !failureRecoveryPlanActive && !taskConfigurationReady)
              || (isSyncTaskCreationReview && !failureRecoveryPlanActive && !configurationReviewConfirmed)}
            onClick={() => executeMutation.mutate()}
          >
            {confirmationButtonLabel}
          </Button>
        </Card>
      ) : null}

      {executionAnswer ? (
        <Card
          title={executionAnswer.status === "SUCCESS" ? "任务已创建并提交" : "执行失败"}
          className="compact-card"
        >
          <Alert
            showIcon
            type={executionAnswer.status === "ERROR" ? "error" : "success"}
            message={executionAnswer.status === "ERROR" ? "本轮执行未完成" : executionAnswer.content}
            description={executionAnswer.status === "ERROR" ? (
              <Typography.Paragraph style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                {executionAnswer.content}
              </Typography.Paragraph>
            ) : undefined}
          />
          {executionAnswer.failures?.map((failure, index) => (
            <div
              key={failure.auditId || `${failure.toolCode}-${index}`}
              style={{ padding: "14px 0", borderBottom: "1px solid var(--ant-color-border-secondary)" }}
            >
              <Space wrap style={{ marginBottom: 8 }}>
                <Typography.Text strong>{humanReadableToolName(failure.toolCode)}</Typography.Text>
                <Tag color="red">{failure.errorCode}</Tag>
                <Typography.Text type="secondary">{failure.toolCode}</Typography.Text>
              </Space>
              <Typography.Paragraph style={{ marginBottom: failure.details.length ? 8 : 0 }}>
                {failure.message}
              </Typography.Paragraph>
              {failure.details.length ? (
                <div style={{ marginBottom: 8 }}>
                  <Typography.Text strong>具体问题</Typography.Text>
                  <Space direction="vertical" size={2} style={{ display: "flex", marginTop: 4 }}>
                    {failure.details.map((detail) => (
                      <Typography.Text key={detail}>• {detail}</Typography.Text>
                    ))}
                  </Space>
                </div>
              ) : null}
              {failure.suggestions.length ? (
                <div>
                  <Typography.Text strong>建议解决方法</Typography.Text>
                  <Space direction="vertical" size={2} style={{ display: "flex", marginTop: 4 }}>
                    {failure.suggestions.map((suggestion) => (
                      <Typography.Text key={suggestion}>• {suggestion}</Typography.Text>
                    ))}
                  </Space>
                </div>
              ) : null}
            </div>
          ))}
          {executionAnswer.repairProposal?.kind === "DUPLICATE_TASK_NAME" ? (
            <Alert
              showIcon
              type="warning"
              message="Agent 已准备同名任务修复方案，尚未执行"
              description={(
                <div>
                  <Typography.Paragraph style={{ marginBottom: 8 }}>
                    {executionAnswer.repairProposal.summary}
                  </Typography.Paragraph>
                  <Descriptions
                    size="small"
                    column={1}
                    items={[
                      {
                        key: "original-name",
                        label: "原任务名称",
                        children: <Typography.Text code>{executionAnswer.repairProposal.originalTaskName}</Typography.Text>,
                      },
                      {
                        key: "proposed-name",
                        label: "建议任务名称",
                        children: <Typography.Text code>{executionAnswer.repairProposal.proposedTaskName}</Typography.Text>,
                      },
                    ]}
                  />
                </div>
              )}
              style={{ marginTop: 12 }}
            />
          ) : null}
          {executionAnswer.status === "ERROR" ? (
            <Alert
              showIcon
              type={executionAnswer.recoveryRunId ? "info" : "warning"}
              message={taskNameRepairNeedsRegeneration
                ? "上一次更名修复 Run 已失效，请重新生成审核计划"
                : executionAnswer.recoveryRunId
                ? (executionAnswer.repairProposal?.kind === "DUPLICATE_TASK_NAME"
                  ? "等待你确认任务名称修改"
                  : executionAnswer.recoveryRequiresConfirmation
                  ? "Agent 已完成只读诊断，并形成需要你确认的修复方案"
                  : "Agent 已创建后续诊断 Run")
                : "Agent 已完成失败分析，但尚未形成可执行修复动作"}
              description={taskNameRepairNeedsRegeneration
                ? `${executionAnswer.recoveryRunUnavailableReason} 建议名称与当前完整任务配置均已保留；重新生成后仍需你审核确认，系统不会直接保存或执行。`
                : executionAnswer.recoveryRunId
                ? executionAnswer.repairProposal?.kind === "DUPLICATE_TASK_NAME"
                  ? `后续 Run：${executionAnswer.recoveryRunId}。请在上方核对精确名称变更并确认；确认前不会重新保存或执行任务。`
                  : `后续 Run：${executionAnswer.recoveryRunId}。只读检查可自动执行；修改任务、表结构或数据前仍需你明确确认。`
                : "失败事实已保留。你可以继续用自然语言补充信息，Agent 会基于当前会话继续排查。"}
              action={taskNameRepairNeedsRegeneration ? (
                <Button
                  type="primary"
                  loading={planMutation.isPending}
                  onClick={regenerateTaskNameRepairPlan}
                >
                  重新生成更名修复计划
                </Button>
              ) : undefined}
              style={{ marginTop: 12 }}
            />
          ) : null}
          <Space wrap style={{ marginTop: 12 }}>
            {executionAnswer.taskId ? <Tag color="blue">任务 ID：{executionAnswer.taskId}</Tag> : null}
            {executionAnswer.executionId ? <Tag>执行 ID：{executionAnswer.executionId}</Tag> : null}
            {executionAnswer.continuationStatus ? <Tag>诊断状态：{executionAnswer.continuationStatus}</Tag> : null}
            {executionAnswer.status === "SUCCESS" ? (
              <Button type="primary" icon={<DatabaseOutlined />} onClick={() => navigate("/sync")}>
                查看同步任务列表
              </Button>
            ) : null}
          </Space>
        </Card>
      ) : null}
      </div>
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
