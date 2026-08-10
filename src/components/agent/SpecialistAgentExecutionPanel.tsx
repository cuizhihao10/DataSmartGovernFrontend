import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  FileSearchOutlined,
  LoadingOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  ToolOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Badge,
  Button,
  Card,
  Collapse,
  Descriptions,
  Empty,
  List,
  Progress,
  Space,
  Tag,
  Typography,
} from "antd";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  aggregateSpecialistExecutionStatus,
  isSpecialistApprovalPendingStatus,
  isSpecialistBusinessInputPendingStatus,
  isSpecialistControlPlaneEvidencePendingStatus,
  isSpecialistFailureStatus,
  isSpecialistPartiallySuccessfulStatus,
  isSpecialistInProgressStatus,
  isSpecialistPostBridgeEvidenceSuccessful,
  isSpecialistSuccessfulStatus,
  isTerminalSpecialistApprovalStatus,
} from "@/features/agent/specialistStatus";
import {
  isHiddenAgentPresentationKey,
  isSensitiveAgentPresentationKey,
  publicAgentSummary,
  sanitizeAgentPresentationValue,
} from "@/features/agent/publicPresentationSafety";
import "./SpecialistAgentExecutionPanel.css";

/**
 * 结构化输出允许后端返回任意 JSON 形状，但组件只把它作为“可读字段”展示。
 * 这里不使用 `any`，同时保留未知字段的安全边界，避免一个后端新增字段就让整个前端类型失效。
 */
export type SpecialistStructuredValue =
  | string
  | number
  | boolean
  | null
  | SpecialistStructuredValue[]
  | { [key: string]: SpecialistStructuredValue };

/** 单次工具活动的低敏公开视图。 */
export interface SpecialistToolActivity {
  toolName: string;
  status: string;
  publicSummary: string;
  evidenceReference?: string | null;
  durationMs?: number;
}

/** 专业 Agent 单次 turn 的低敏公开结果。 */
export interface SpecialistAgentResult {
  applicationId?: number;
  agentId: string;
  agentRole: string;
  turnId: string;
  status: string;
  publicSummary: string;
  structuredOutput: Readonly<Record<string, unknown>>;
  evidenceReferences: string[];
  toolActivities: SpecialistToolActivity[];
  modelInvocationSummary: Readonly<Record<string, unknown>>;
  requiredInputFields: string[];
  errorCode?: string | null;
  durationMs: number;
}

/** 专业 Agent 批次的后端公开结果。 */
export interface SpecialistAgentExecution {
  status: string;
  executedCount: number;
  completedCount: number;
  waitingInputCount: number;
  failedCount: number;
  results: SpecialistAgentResult[];
  skippedRoles: Readonly<Record<string, string>>;
  executionWaves: string[][];
  /** 首轮之外的生命周期摘要由新的后端字段提供，旧快照可以没有这些字段。 */
  specialistVerificationExecution?: Readonly<Record<string, unknown>>;
  specialistToolPlanBridges?: readonly Readonly<Record<string, unknown>>[];
  postBridgeVerification?: Readonly<Record<string, unknown>>;
}

/**
 * 组件允许接收后端新合同，也允许接收旧接口返回的普通对象。
 * 旧接口可能使用 snake_case 或附带额外字段，因此输入侧刻意比输出侧宽松，内部会统一归一化。
 */
export type SpecialistAgentExecutionInput =
  | SpecialistAgentExecution
  | Readonly<Record<string, unknown>>;

/** 专业 Agent 结果面板的回调和展示参数。 */
export interface SpecialistAgentExecutionPanelProps {
  specialistAgentExecution?: SpecialistAgentExecutionInput | null;
  /** `execution` 是便于复用的别名，已有页面不必为了接入组件改造响应对象。 */
  execution?: SpecialistAgentExecutionInput | null;
  loading?: boolean;
  className?: string;
  title?: string;
  /** 缺少业务参数时由宿主打开补参表单或滚动到对应配置区域。 */
  onRequiredInput?: (result: SpecialistAgentResult) => void;
  /** 专业 Agent 请求业务审批时，由宿主打开已有审核/确认区域。 */
  onApproval?: (result: SpecialistAgentResult) => void;
  /** 专业 Agent 失败时由宿主进入故障诊断、重试或人工处理流程。 */
  onFailure?: (result: SpecialistAgentResult) => void;
  /** 任务类专业 Agent 返回任务或执行结果时，由宿主跳转到真实任务详情。 */
  onViewTaskDetails?: (result: SpecialistAgentResult) => void;
  /** post-bridge 返回真实资源 ID 时，宿主用同一个入口打开任务及指定 execution。 */
  onViewTaskLocator?: (locator: SpecialistTaskDetailLocator) => void;
}

/** 同步任务详情跳转所需的最小真实资源定位。 */
export interface SpecialistTaskDetailLocator {
  taskId?: number;
  executionId?: number;
}

interface NormalizedExecution extends SpecialistAgentExecution {
  hasPayload: boolean;
  verificationExecution?: NormalizedBatchExecution;
  bridges: NormalizedToolPlanBridge[];
  postBridgeSummary?: NormalizedPostBridgeVerification;
}

/** 面向用户展示的 ToolPlan 桥接问题，不包含工具参数值。 */
interface NormalizedBridgeIssue {
  code?: string;
  message: string;
}

/** DATA_SYNC/RECOVERY 桥接摘要的前端安全投影。 */
interface NormalizedToolPlanBridge {
  status: string;
  specialistRole: string;
  specialistTurnId?: string;
  publicSummary: string;
  acceptedToolPlanCount: number;
  acceptedToolNames: string[];
  visibleToolNames: string[];
  canSubmitDurableLoop?: boolean;
  argumentFieldNames: string[][];
  issues: NormalizedBridgeIssue[];
  recoveryHandoff?: {
    approvalStatus?: string;
    approvalFactAccepted?: boolean;
    blueprintCount?: number;
    requiresJavaRehydration?: boolean;
    executionBoundary?: string;
  };
}

/** Java 返回的 post-bridge 资源复核定位摘要。 */
interface NormalizedPostBridgeVerification {
  status: string;
  resourceChanged?: boolean;
  taskId?: string;
  executionId?: string;
  executedRoles: string[];
  batchStatus?: string;
}

/** 不带生命周期扩展的专项 Agent 批次，用于复用首轮和复核结果渲染。 */
interface NormalizedBatchExecution {
  status: string;
  executedCount: number;
  completedCount: number;
  waitingInputCount: number;
  failedCount: number;
  results: SpecialistAgentResult[];
  skippedRoles: Readonly<Record<string, string>>;
  executionWaves: string[][];
  /** Whether the payload carried an actual result list or explicit counters. */
  hasExplicitResultEvidence: boolean;
}

interface StatusMeta {
  label: string;
  color: string;
  icon: ReactNode;
}

/**
 * One visible coverage row for each of the six initial Specialist roles.
 *
 * The role is shown even when the current payload has no result for it.  That
 * distinction matters in a governed workflow: an omitted result may mean an
 * intentional skip, an in-flight response, or a degraded backend response,
 * but it must never look like a successful Specialist turn.
 */
interface InitialSpecialistRoleCoverage {
  role: string;
  state: "REPORTED" | "SKIPPED" | "NOT_REPORTED";
  resultCount?: number;
  status?: string;
  skippedReason?: string;
}

const ROLE_LABELS: Readonly<Record<string, string>> = {
  DATASOURCE_AGENT: "数据源 Agent",
  DATA_SOURCE_AGENT: "数据源 Agent",
  DATA_QUALITY_AGENT: "数据质量 Agent",
  DATA_SYNC_AGENT: "同步规划 Agent",
  TASK_AGENT: "任务执行 Agent",
  PERMISSION_AGENT: "权限 Agent",
  MEMORY_AGENT: "记忆 Agent",
  OPS_AGENT: "运行监控 Agent",
  KNOWLEDGE_AGENT: "知识检索 Agent",
  PRECHECK_AGENT: "预检查 Agent",
  PRE_CHECK_AGENT: "预检查 Agent",
  SYNC_PRECHECK_AGENT: "同步预检查 Agent",
  SYNC_VALIDATION_AGENT: "同步预检查 Agent",
  RECOVERY_AGENT: "故障恢复 Agent",
  MONITOR_AGENT: "运行监控 Agent",
};

/** 首轮六个业务 Specialist 的稳定顺序，避免并发返回顺序变化导致页面跳动。 */
const INITIAL_SPECIALIST_ROLE_ORDER = [
  "KNOWLEDGE_AGENT",
  "DATASOURCE_AGENT",
  "DATA_SYNC_AGENT",
  "PRECHECK_AGENT",
  "RECOVERY_AGENT",
  "MONITOR_AGENT",
] as const;

const FIELD_LABELS: Readonly<Record<string, string>> = {
  objectMappings: "对象映射",
  object_mappings: "对象映射",
  sourceSchemaName: "源端 schema",
  source_schema_name: "源端 schema",
  sourceObjectName: "源端表",
  source_object_name: "源端表",
  targetSchemaName: "目标端 schema",
  target_schema_name: "目标端 schema",
  targetObjectName: "目标端表",
  target_object_name: "目标端表",
  fieldMappings: "字段映射",
  field_mappings: "字段映射",
  sourceField: "源字段",
  source_field: "源字段",
  targetField: "目标字段",
  target_field: "目标字段",
  sourceType: "源字段类型",
  source_type: "源字段类型",
  targetType: "目标字段类型",
  target_type: "目标字段类型",
  sourceTable: "源端表",
  source_table: "源端表",
  targetTable: "目标端表",
  target_table: "目标端表",
  sourceTableName: "源端表",
  source_table_name: "源端表",
  targetTableName: "目标端表",
  target_table_name: "目标端表",
  where: "WHERE 条件",
  whereClause: "WHERE 条件",
  where_clause: "WHERE 条件",
  whereCondition: "WHERE 条件",
  where_condition: "WHERE 条件",
  filterCondition: "WHERE 条件",
  filter_condition: "WHERE 条件",
  syncEnabled: "是否同步",
  sync_enabled: "是否同步",
  typeCompatible: "类型兼容",
  type_compatible: "类型兼容",
  model: "模型",
  modelName: "模型",
  provider: "模型服务商",
  providerName: "模型服务商",
  modelProvider: "模型服务商",
  invocationCount: "调用次数",
  callCount: "调用次数",
  inputTokens: "输入 Token",
  promptTokens: "输入 Token",
  outputTokens: "输出 Token",
  completionTokens: "输出 Token",
  totalTokens: "Token 总量",
  cacheHit: "缓存命中",
  cacheHitRate: "缓存命中率",
  reasoningEffort: "推理强度",
  finishReason: "结束原因",
  responseId: "响应编号",
  requestId: "请求编号",
  durationMs: "模型耗时",
};

/**
 * 公开结果展示的字段白名单边界之外，以下字段只代表模型内部上下文。
 * 后端应当在低敏合同层就删除它们，前端再次过滤是为了防止旧接口或异常
 * 代理把 prompt、原始响应或隐藏思维链混入 structuredOutput 后直接展示。
 */
function isHiddenModelField(key: string): boolean {
  return isHiddenAgentPresentationKey(key);
}

/** 判断结构化字段是否属于任务映射；映射详情不使用通用 JSON 截断策略。 */
function isMappingDetailField(key: string): boolean {
  const normalized = key.replace(/[_-]/g, "").toLowerCase();
  return normalized === "objectmappings"
    || normalized === "fieldmappings"
    || normalized === "where"
    || normalized === "whereclause"
    || normalized === "wherecondition"
    || normalized === "filtercondition";
}

/** 把未知值安全地收窄为普通对象，所有旧响应读取都经过此函数。 */
function asRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Readonly<Record<string, unknown>>;
}

/** 从 camelCase 和 snake_case 两套字段中读取第一个存在的值。 */
function firstValue(record: Readonly<Record<string, unknown>>, names: string[]): unknown {
  for (const name of names) {
    if (record[name] !== undefined && record[name] !== null) return record[name];
  }
  return undefined;
}

/**
 * Read a versioned array while preferring the first populated alias.
 *
 * During a Java/Python rolling upgrade, an adapter can emit `results: []` and
 * a populated `specialist_results` in the same payload.  A generic first-value
 * lookup would pick the empty array and hide six real Agent results.  Returning
 * the first empty array only when every alias is empty preserves intentional
 * empty batches without discarding a compatible result source.
 */
function firstArrayValue(record: Readonly<Record<string, unknown>>, names: string[]): unknown[] {
  let emptyArray: unknown[] | undefined;
  for (const name of names) {
    const value = record[name];
    if (!Array.isArray(value)) continue;
    if (value.length > 0) return value;
    emptyArray ??= value;
  }
  return emptyArray ?? [];
}

/** 将任意后端值转换为非空文本；不会把对象强行 JSON.stringify 到页面。 */
function textValue(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

/** 读取非负数，避免旧接口把 null、字符串空值或负数带入耗时和计数。 */
function nonNegativeNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/** 将后端数组或单值规范化为数组，兼容早期只返回一个证据/缺参的接口。 */
function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null || value === "" ? [] : [value];
}

/** 将证据、缺参等轻量值转成文本，并忽略不可安全展示的复杂对象。 */
function textList(value: unknown): string[] {
  return asArray(value)
    .map((item) => {
      if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
        return String(item).trim();
      }
      const itemRecord = asRecord(item);
      return textValue(firstValue(itemRecord ?? {}, ["label", "name", "fieldName", "field", "reference", "id"]));
    })
    .filter((item): item is string => Boolean(item));
}

/** 把工具活动转换为统一结构，兼容 Java/Python 之间的命名差异。 */
function normalizeToolActivities(value: unknown): SpecialistToolActivity[] {
  return asArray(value).flatMap((item, index) => {
    const record = asRecord(item);
    if (!record) return [];
    return [{
      toolName: textValue(firstValue(record, ["toolName", "tool_name", "name"]), `工具 ${index + 1}`),
      status: textValue(firstValue(record, ["status", "state"]), "UNKNOWN"),
      publicSummary: publicAgentSummary(
        firstValue(record, ["publicSummary", "public_summary", "summary", "message"]),
        "已完成一次受控工具活动。",
      ),
      evidenceReference: publicAgentSummary(
        firstValue(record, ["evidenceReference", "evidence_reference"]),
        "",
      ) || null,
      durationMs: nonNegativeNumber(firstValue(record, ["durationMs", "duration_ms"])),
    }];
  });
}

/**
 * 把单个专家结果归一化为页面合同。
 * 归一化阶段只保留公开摘要和结构化结果，不保留 prompt、工具参数、原始工具输出或思维链。
 */
function normalizeResult(value: unknown, index: number): SpecialistAgentResult | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const role = textValue(firstValue(record, ["agentRole", "agent_role", "role"]), "SPECIALIST_AGENT");
  const structuredOutput = asRecord(sanitizeAgentPresentationValue(
    firstValue(record, ["structuredOutput", "structured_output", "output"]),
    "structuredOutput",
  ));
  const modelSummary = asRecord(sanitizeAgentPresentationValue(
    firstValue(record, ["modelInvocationSummary", "model_invocation_summary", "model"]),
    "modelInvocationSummary",
  ));
  const requiredFields = textList(firstValue(record, ["requiredInputFields", "required_input_fields", "missingFields"]));
  return {
    applicationId: publicResourceNumber(firstValue(record, ["applicationId", "application_id"])),
    agentId: textValue(firstValue(record, ["agentId", "agent_id"]), `${role.toLowerCase()}-${index + 1}`),
    agentRole: role,
    turnId: textValue(firstValue(record, ["turnId", "turn_id"]), `turn-${index + 1}`),
    status: textValue(firstValue(record, ["status", "state"]), "UNKNOWN").toUpperCase(),
    publicSummary: publicAgentSummary(
      firstValue(record, ["publicSummary", "public_summary", "summary", "message"]),
      "该专业 Agent 未返回公开摘要。",
    ),
    structuredOutput: structuredOutput ?? {},
    evidenceReferences: textList(firstValue(record, ["evidenceReferences", "evidence_references", "evidence"]))
      .map((reference) => publicAgentSummary(reference, ""))
      .filter(Boolean),
    toolActivities: normalizeToolActivities(firstValue(record, ["toolActivities", "tool_activities", "tools"])),
    modelInvocationSummary: modelSummary ?? {},
    requiredInputFields: requiredFields,
    errorCode: textValue(firstValue(record, ["errorCode", "error_code"]), "") || null,
    durationMs: nonNegativeNumber(firstValue(record, ["durationMs", "duration_ms"])),
  };
}

/** 计算旧响应缺失的批次计数，保证列表和顶部统计一致。 */
function countResults(results: SpecialistAgentResult[]) {
  return {
    completed: results.filter((result) => isCompletedStatus(result.status)).length,
    waiting: results.filter((result) => isWaitingStatus(result.status)).length,
    failed: results.filter((result) => isFailedStatus(result.status)).length,
  };
}

/**
 * 归一化一个 Specialist 批次。
 *
 * 首轮和 post-bridge 复核使用同一份低敏结果协议，因此共用这段解析逻辑。
 * 缺字段时根据实际 results 推导统计值，既能支持旧快照，也不会因为新后端
 * 增加一个字段而让历史消息无法打开。
 */
function normalizeBatchExecution(value: unknown): NormalizedBatchExecution | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  /*
   * Java serializes the public batch as `specialistResults` in some versions,
   * while the Python runtime uses `specialist_results`.  Treat them as one
   * contract here so a valid six-Agent response never becomes an empty panel
   * merely because the producer changed its JSON naming convention.
   */
  const results = firstArrayValue(record, [
    "results",
    "specialistResults",
    "specialist_results",
    "agentResults",
    "agent_results",
  ])
    .map((item, index) => normalizeResult(item, index))
    .filter((item): item is SpecialistAgentResult => Boolean(item));
  const hasExplicitResultEvidence = results.length > 0
    || [
      "results",
      "specialistResults",
      "specialist_results",
      "agentResults",
      "agent_results",
      "executedCount",
      "executed_count",
      "completedCount",
      "completed_count",
      "waitingInputCount",
      "waiting_input_count",
      "failedCount",
      "failed_count",
    ].some((key) => record[key] !== undefined && record[key] !== null);
  const counts = countResults(results);
  const skippedRecord = asRecord(firstValue(record, ["skippedRoles", "skipped_roles"]));
  const skippedRoles = Object.fromEntries(
    Object.entries(skippedRecord ?? {}).map(([role, reason]) => [role, textValue(reason, "本轮未执行")]),
  );
  /*
   * A skipped-role reason is free-form text emitted by more than one runtime.
   * Convert it to the same public-summary contract as result messages before
   * retaining it for the collapsed batch card; otherwise an adapter error can
   * accidentally surface a SQL fragment or connection diagnostic here.
   */
  const publicSkippedRoles = Object.fromEntries(
    Object.entries(skippedRoles).map(([role, reason]) => [role, publicAgentSummary(reason, "")]),
  );
  const executionWaves = asArray(firstValue(record, ["executionWaves", "execution_waves"]))
    .map((wave) => textList(wave))
    .filter((wave) => wave.length > 0);
  return {
    status: textValue(
      firstValue(record, ["status", "state"]),
      results.length ? "COMPLETED" : "NO_EXECUTABLE_SPECIALISTS",
    ).toUpperCase(),
    executedCount: nonNegativeNumber(firstValue(record, ["executedCount", "executed_count"]), results.length),
    completedCount: nonNegativeNumber(firstValue(record, ["completedCount", "completed_count"]), counts.completed),
    waitingInputCount: nonNegativeNumber(firstValue(record, ["waitingInputCount", "waiting_input_count"]), counts.waiting),
    failedCount: nonNegativeNumber(firstValue(record, ["failedCount", "failed_count"]), counts.failed),
    results,
    skippedRoles: publicSkippedRoles,
    executionWaves,
    hasExplicitResultEvidence,
  };
}

/** 将后端的数值或数字字符串转换成可公开展示的资源 ID。 */
function publicResourceId(value: unknown): string | undefined {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return Number.isInteger(parsed) && parsed > 0 ? String(parsed) : undefined;
}

function publicResourceNumber(value: unknown): number | undefined {
  const id = publicResourceId(value);
  return id ? Number(id) : undefined;
}

/** 归一化桥接问题，只保留人能读懂的说明和可定位的错误码。 */
function normalizeBridgeIssues(value: unknown): NormalizedBridgeIssue[] {
  return asArray(value).flatMap((item) => {
    const record = asRecord(item);
    if (!record) return [];
    const message = publicAgentSummary(
      firstValue(record, ["message", "publicMessage", "summary"]),
      "桥接阶段需要控制面继续处理",
    );
    return [{ code: textValue(firstValue(record, ["code", "issueCode"]), "") || undefined, message }];
  });
}

/**
 * 归一化 DATA_SYNC/RECOVERY 到 Java ToolPlan 的桥接摘要。
 *
 * acceptedToolNames 是允许展示的工具名称，argumentFieldNames 只展示字段名
 * 集合，绝不读取或渲染 arguments、SQL、凭据等原始内容。
 */
function normalizeBridge(value: unknown, index: number): NormalizedToolPlanBridge | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const handoff = asRecord(firstValue(record, ["recoveryHandoff", "recovery_handoff"]));
  const canSubmitValue = firstValue(record, ["canSubmitDurableLoop", "can_submit_durable_loop"]);
  const acceptedCount = firstValue(record, ["acceptedToolPlanCount", "accepted_tool_plan_count"]);
  return {
    status: textValue(firstValue(record, ["status", "state"]), "UNKNOWN").toUpperCase(),
    specialistRole: textValue(
      firstValue(record, ["specialistRole", "specialist_role", "agentRole"]),
      `SPECIALIST_AGENT_${index + 1}`,
    ),
    specialistTurnId: textValue(firstValue(record, ["specialistTurnId", "specialist_turn_id"]), "") || undefined,
    publicSummary: publicAgentSummary(
      firstValue(record, ["publicSummary", "public_summary", "summary"]),
      "已完成一次受控的 ToolPlan 桥接检查",
    ),
    acceptedToolPlanCount: nonNegativeNumber(acceptedCount),
    acceptedToolNames: textList(firstValue(record, ["acceptedToolNames", "accepted_tool_names"])),
    visibleToolNames: textList(firstValue(record, ["visibleToolNames", "visible_tool_names"])),
    canSubmitDurableLoop: typeof canSubmitValue === "boolean" ? canSubmitValue : undefined,
    argumentFieldNames: asArray(firstValue(record, ["toolArgumentNameSets", "tool_argument_name_sets"]))
      .map((fields) => textList(fields)),
    issues: normalizeBridgeIssues(firstValue(record, ["issues", "bridgeIssues", "bridge_issues"])),
    recoveryHandoff: handoff ? {
      approvalStatus: textValue(firstValue(handoff, ["approvalStatus", "approval_status"]), "") || undefined,
      approvalFactAccepted: typeof firstValue(handoff, ["approvalFactAccepted", "approval_fact_accepted"]) === "boolean"
        ? firstValue(handoff, ["approvalFactAccepted", "approval_fact_accepted"]) as boolean
        : undefined,
      blueprintCount: nonNegativeNumber(firstValue(handoff, ["blueprintCount", "blueprint_count"])),
      requiresJavaRehydration: typeof firstValue(handoff, ["requiresJavaRehydration", "requires_java_rehydration"]) === "boolean"
        ? firstValue(handoff, ["requiresJavaRehydration", "requires_java_rehydration"]) as boolean
        : undefined,
      executionBoundary: textValue(firstValue(handoff, ["executionBoundary", "execution_boundary"]), "") || undefined,
    } : undefined,
  };
}

/** 归一化 post-bridge 复核摘要，并仅接受正整数任务/执行定位。 */
function normalizePostBridgeVerification(value: unknown): NormalizedPostBridgeVerification | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  return {
    status: textValue(firstValue(record, ["status", "state"]), "UNKNOWN").toUpperCase(),
    resourceChanged: typeof firstValue(record, ["resourceChanged", "resource_changed"]) === "boolean"
      ? firstValue(record, ["resourceChanged", "resource_changed"]) as boolean
      : undefined,
    taskId: publicResourceId(firstValue(record, ["taskId", "task_id"])),
    executionId: publicResourceId(firstValue(record, ["executionId", "execution_id"])),
    executedRoles: textList(firstValue(record, ["executedRoles", "executed_roles"])),
    batchStatus: textValue(firstValue(record, ["batchStatus", "batch_status"]), "") || undefined,
  };
}

/** 将首轮、桥接和复核状态收敛为面板顶部可读的总体状态。 */
function aggregateExecutionStatus(
  primary: NormalizedBatchExecution,
  verification: NormalizedBatchExecution | undefined,
  bridges: NormalizedToolPlanBridge[],
  postBridge: NormalizedPostBridgeVerification | undefined,
): string {
  return aggregateSpecialistExecutionStatus({
    primaryStatus: primary.status,
    bridgeStatuses: bridges.map((bridge) => bridge.status),
    verificationStatus: verification?.status,
    verificationFailedCount: verification?.failedCount,
    verificationWaitingInputCount: verification?.waitingInputCount,
    postBridgeStatus: postBridge?.status,
    postBridgeEvidence: postBridge
      ? postBridgeEvidenceSignals(postBridge, verification)
      : undefined,
  });
}

/** Combine the post-bridge marker with the actual verification batch evidence. */
function postBridgeEvidenceSignals(
  postBridge: NormalizedPostBridgeVerification,
  verification: NormalizedBatchExecution | undefined,
) {
  const hasEvidence = verification?.hasExplicitResultEvidence === true;
  return {
    status: postBridge.status,
    batchStatus: postBridge.batchStatus,
    resultStatuses: hasEvidence ? verification?.results.map((result) => result.status) : undefined,
    resultCount: hasEvidence ? verification?.results.length : undefined,
    completedCount: hasEvidence ? verification?.completedCount : undefined,
    failedCount: hasEvidence ? verification?.failedCount : undefined,
    waitingInputCount: hasEvidence ? verification?.waitingInputCount : undefined,
  };
}

/** 将新旧响应格式统一为带有桥接和复核扩展的面板模型。 */
function normalizeExecution(input: SpecialistAgentExecutionInput | null | undefined): NormalizedExecution | undefined {
  const record = asRecord(input);
  if (!record) return undefined;
  const primary = normalizeBatchExecution(record) ?? {
    status: "NO_EXECUTABLE_SPECIALISTS",
    executedCount: 0,
    completedCount: 0,
    waitingInputCount: 0,
    failedCount: 0,
    results: [],
    skippedRoles: {},
    executionWaves: [],
    hasExplicitResultEvidence: false,
  };
  const verificationPayload = firstValue(record, ["specialistVerificationExecution", "specialist_verification_execution"]);
  const verification = normalizeBatchExecution(verificationPayload);
  const bridgePayload = firstArrayValue(record, ["specialistToolPlanBridges", "specialist_tool_plan_bridges"])
    .map(asRecord)
    .filter((item): item is Readonly<Record<string, unknown>> => Boolean(item));
  const bridges = bridgePayload
    .map((item, index) => normalizeBridge(item, index))
    .filter((item): item is NormalizedToolPlanBridge => Boolean(item));
  const postBridgePayload = firstValue(record, ["postBridgeVerification", "post_bridge_verification"]);
  const postBridgeVerification = normalizePostBridgeVerification(postBridgePayload);
  return {
    ...primary,
    hasPayload: true,
    status: aggregateExecutionStatus(primary, verification, bridges, postBridgeVerification),
    specialistVerificationExecution: asRecord(verificationPayload),
    specialistToolPlanBridges: bridgePayload,
    postBridgeVerification: asRecord(postBridgePayload),
    verificationExecution: verification,
    bridges,
    postBridgeSummary: postBridgeVerification,
  };
}

/** 统一角色的中文名称；未知角色保留可读的英文编码，避免误显示成空白。 */
function roleLabel(role: string): string {
  const normalized = role.toUpperCase();
  if (ROLE_LABELS[normalized]) return ROLE_LABELS[normalized];
  return normalized
    .replace(/_AGENT$/, " Agent")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/** 统一状态的中文名称、颜色和图标，页面不直接向用户暴露内部枚举。 */
function statusMeta(status: string): StatusMeta {
  const normalized = status.toUpperCase();
  if (normalized === "ACCEPTED") {
    return { label: "已接入", color: "success", icon: <CheckCircleOutlined /> };
  }
  if (isApprovalStatus(normalized)) {
    return { label: "等待审批", color: "warning", icon: <ExclamationCircleOutlined /> };
  }
  if (isSpecialistControlPlaneEvidencePendingStatus(normalized)) {
    return { label: "等待控制面证据", color: "processing", icon: <LoadingOutlined /> };
  }
  if (isWaitingStatus(normalized)) {
    return { label: "等待补充信息", color: "warning", icon: <ExclamationCircleOutlined /> };
  }
  if (isFailedStatus(normalized)) {
    return { label: "执行失败", color: "error", icon: <CloseCircleOutlined /> };
  }
  if (isSpecialistPartiallySuccessfulStatus(normalized)) {
    return { label: "部分完成", color: "warning", icon: <ExclamationCircleOutlined /> };
  }
  if (isCompletedStatus(normalized)) {
    return { label: "已完成", color: "success", icon: <CheckCircleOutlined /> };
  }
  if (isInProgressStatus(normalized)) {
    return { label: "处理中", color: "processing", icon: <LoadingOutlined /> };
  }
  if (normalized.includes("SKIP")) {
    return { label: "已跳过", color: "default", icon: <ClockCircleOutlined /> };
  }
  return { label: "待确认", color: "default", icon: <ClockCircleOutlined /> };
}

/** 判断结果是否仍在执行中，用于自动展开正在处理的专业 Agent。 */
function isInProgressStatus(status: string): boolean {
  return isSpecialistInProgressStatus(status);
}

/** 判断是否是可折叠的终态。 */
function isCompletedStatus(status: string): boolean {
  return isSpecialistSuccessfulStatus(status);
}

/** 判断等待人工输入的状态，等待输入不是技术失败。 */
function isWaitingStatus(status: string): boolean {
  return isSpecialistBusinessInputPendingStatus(status)
    || isSpecialistControlPlaneEvidencePendingStatus(status);
}

function isControlPlaneEvidenceWaitingStatus(status: string): boolean {
  return isSpecialistControlPlaneEvidencePendingStatus(status);
}

/** 审批属于可继续的人工动作，不能与普通缺参或技术失败混为一谈。 */
function isApprovalStatus(status: string): boolean {
  return isSpecialistApprovalPendingStatus(status);
}

/**
 * 判断专业 Agent 是否已经生成一份尚待控制面处理的审批请求。
 *
 * RECOVERY_AGENT 等角色的业务 turn 可能已经正常完成，但它提出的高风险动作仍需要进入 Java
 * ToolPlan、审批和 outbox；因此只看 turn 顶层状态会把“方案已完成、动作待审批”误判成普通完成态。
 * 这里仅识别后端显式返回的 `approvalRequest.required=true`，不会根据自然语言摘要猜测审批状态。
 */
function hasPendingApprovalRequest(result: SpecialistAgentResult): boolean {
  const approvalRequest = asRecord(firstValue(result.structuredOutput, [
    "approvalRequest",
    "approval_request",
  ]));
  const requiredValue = approvalRequest
    ? firstValue(approvalRequest, ["required", "approvalRequired", "approval_required"])
    : undefined;
  // Durable JSON from an older runtime can preserve booleans as strings.  Only
  // the explicit true value is accepted; a missing or malformed flag must not
  // manufacture a high-risk approval card in a historical conversation.
  const approvalRequired = requiredValue === true || String(requiredValue).trim().toLowerCase() === "true";
  if (!approvalRequest || !approvalRequired) {
    return false;
  }
  const status = textValue(firstValue(approvalRequest, ["status", "state"])).toUpperCase();
  return !isTerminalSpecialistApprovalStatus(status);
}

/**
 * Surface a terminally rejected or failed approval as a failure of the
 * Specialist outcome rather than as a completed planning turn.  A Recovery
 * Agent commonly finishes drafting its repair before Java rejects the related
 * ToolPlan; without this check the historical panel would misleadingly show
 * the turn as successful simply because its top-level status is `COMPLETED`.
 */
function hasFailedApprovalRequest(result: SpecialistAgentResult): boolean {
  const approvalRequest = asRecord(firstValue(result.structuredOutput, [
    "approvalRequest",
    "approval_request",
  ]));
  const requiredValue = approvalRequest
    ? firstValue(approvalRequest, ["required", "approvalRequired", "approval_required"])
    : undefined;
  const approvalRequired = requiredValue === true || requiredValue === "true";
  if (!approvalRequired) return false;
  const status = textValue(firstValue(approvalRequest ?? {}, ["status", "state"])).toUpperCase();
  return isSpecialistFailureStatus(status);
}

/** 统一判断结果是否需要用户当前介入，供明细和整批折叠状态共同使用。 */
function resultRequiresAttention(result: SpecialistAgentResult): boolean {
  return isInProgressStatus(result.status)
    || isWaitingStatus(result.status)
    || isApprovalStatus(result.status)
    || hasPendingApprovalRequest(result)
    || hasFailedApprovalRequest(result)
    || isFailedStatus(result.status)
    || Boolean(result.errorCode)
    || result.requiredInputFields.length > 0;
}

/** 判断专业 Agent 是否失败，便于顶部计数和失败操作保持一致。 */
function isFailedStatus(status: string): boolean {
  return isSpecialistFailureStatus(status);
}

/**
 * 从完整专业 Agent 结构化结果中提取真实任务定位信息。
 *
 * Durable 低敏事实不会进入这里，因为事实表不保存 structuredOutput；因此
 * 该函数不会凭空生成 ID，也不会把 sessionId、turnId 当成同步任务 ID 使用。
 */
function findTaskDetailLocator(value: unknown, depth = 0): SpecialistTaskDetailLocator {
  if (depth > 4 || !value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const readPositiveNumber = (candidate: unknown) => {
    const parsed = typeof candidate === "number" ? candidate : Number(candidate);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  };
  const taskId = readPositiveNumber(record.taskId ?? record.task_id ?? record.syncTaskId ?? record.sync_task_id);
  const executionId = readPositiveNumber(record.executionId ?? record.execution_id);
  if (taskId || executionId) return { taskId, executionId };
  for (const child of Object.values(record)) {
    const nested = findTaskDetailLocator(child, depth + 1);
    if (nested.taskId || nested.executionId) return nested;
  }
  return {};
}

/** 运行中或需要人工处理的结果保持展开，只有无待办的完成结果默认折叠。 */
function shouldExpandResult(status: string): boolean {
  return isInProgressStatus(status)
    || isWaitingStatus(status)
    || isApprovalStatus(status)
    || isFailedStatus(status);
}

/** 将内部字段名转换成适合用户阅读的中文字段名。 */
function fieldLabel(key: string): string {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

/** 避免把密码、令牌等意外出现在结构化结果或模型摘要中。 */
function isSensitiveKey(key: string): boolean {
  return isSensitiveAgentPresentationKey(key);
}

/** 把普通值显示为短文本，复杂值交给下面的结构化渲染器处理。 */
function primitiveText(value: unknown): string | undefined {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}

/**
 * 以有限深度、有限条数展示结构化结果。
 * 这个函数故意不输出 JSON 原文：用户需要的是配置结论和字段值，而不是调试负载或模型内部上下文。
 */
function renderStructuredValue(
  input: unknown,
  depth = 0,
  preserveMappingDetail = false,
  fieldKey = "",
): ReactNode {
  /*
   * `structuredOutput` can originate from a live stream, a durable historical
   * fact, or a rolling-version adapter.  Sanitizing directly before rendering
   * closes the gap where a new nested field could otherwise bypass the earlier
   * normalization boundary when this renderer is reused by another section.
   */
  const value = sanitizeAgentPresentationValue(input, fieldKey, depth);
  const primitive = primitiveText(value);
  if (primitive !== undefined) return <Typography.Text>{primitive}</Typography.Text>;
  /*
   * 对象映射通常是“对象数组 -> 字段映射数组 -> 字段对象”三层结构。
   * 深度限制至少要允许这三层，否则用户只能看到“有几条映射”，看不到源字段、
   * 目标字段和 WHERE。普通结构化结果第六层以后收口，避免异常响应把整棵 JSON 倾倒到页面；
   * 映射路径会显式传递 preserveMappingDetail，即使被包在 resolvedConfiguration 中也不截断字段对象。
   */
  if (depth >= 6 && !preserveMappingDetail) {
    return <Typography.Text type="secondary">已省略更深层级</Typography.Text>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <Typography.Text type="secondary">无</Typography.Text>;
    const visibleItems = preserveMappingDetail ? value : value.slice(0, 20);
    return (
      <Space direction="vertical" size={6} className="specialist-agent-value-list">
        {visibleItems.map((item, index) => {
          const itemPrimitive = primitiveText(item);
          return itemPrimitive !== undefined ? (
            <Tag key={`value-${index}`}>{itemPrimitive}</Tag>
          ) : (
            <div className="specialist-agent-array-item" key={`value-${index}`}>
              {renderStructuredValue(item, depth + 1, preserveMappingDetail, fieldKey)}
            </div>
          );
        })}
        {!preserveMappingDetail && value.length > visibleItems.length ? (
          <Typography.Text type="secondary">还有 {value.length - visibleItems.length} 项</Typography.Text>
        ) : null}
      </Space>
    );
  }
  const record = asRecord(value);
  if (!record) return <Typography.Text type="secondary">不可展示</Typography.Text>;
  const allEntries = Object.entries(record).filter(([key]) => !isHiddenModelField(key));
  const entries = preserveMappingDetail ? allEntries : allEntries.slice(0, 20);
  if (entries.length === 0) return <Typography.Text type="secondary">没有可公开展示的字段</Typography.Text>;
  return (
    <div className="specialist-agent-nested-values">
      {entries.map(([key, nestedValue]) => (
        <div className="specialist-agent-nested-value" key={key}>
          <Typography.Text type="secondary">{fieldLabel(key)}</Typography.Text>
          {isSensitiveKey(key)
            ? <Tag>已隐藏敏感信息</Tag>
            : renderStructuredValue(
              nestedValue,
              depth + 1,
              preserveMappingDetail || isMappingDetailField(key),
              key,
            )}
        </div>
      ))}
      {!preserveMappingDetail && allEntries.length > entries.length ? (
        <Typography.Text type="secondary">还有 {allEntries.length - entries.length} 项</Typography.Text>
      ) : null}
    </div>
  );
}

/** 计算耗时的用户可读文本，同时保留毫秒级精度以便排查快速调用和长调用。 */
function durationLabel(durationMs: number): string {
  if (durationMs < 1_000) return `${Math.round(durationMs)} ms`;
  const seconds = durationMs / 1_000;
  if (seconds < 60) return `${seconds.toFixed(seconds >= 10 ? 0 : 1)} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} 分 ${Math.round(seconds % 60)} 秒`;
}

/** 将工具状态映射成不暴露内部状态码的中文标签。 */
function activityStatusLabel(status: string): { label: string; color: string } {
  const normalized = status.toUpperCase();
  if (isFailedStatus(normalized)) return { label: "失败", color: "error" };
  if (isApprovalStatus(normalized)) return { label: "等待审批", color: "warning" };
  if (isSpecialistPartiallySuccessfulStatus(normalized)) return { label: "部分完成", color: "warning" };
  if (isCompletedStatus(normalized)) return { label: "完成", color: "success" };
  if (isInProgressStatus(normalized)) return { label: "处理中", color: "processing" };
  if (isControlPlaneEvidenceWaitingStatus(normalized)) return { label: "等待控制面证据", color: "processing" };
  if (isWaitingStatus(normalized)) return { label: "等待输入", color: "warning" };
  return { label: "已记录", color: "default" };
}

/** 动态显示模型调用摘要，模型名称来自后端真实返回值而不是前端写死。 */
function ModelInvocationSummary({ summary }: { summary: Readonly<Record<string, unknown>> }) {
  const items = Object.entries(summary)
    .filter(([key, value]) => (
      !isSensitiveKey(key)
      && !isHiddenModelField(key)
      && (primitiveText(value) !== undefined || Array.isArray(value))
    ))
    .slice(0, 14)
    .map(([key, value]) => ({ key, label: fieldLabel(key), value }));
  return (
    <div className="specialist-agent-section">
      <div className="specialist-agent-section-title">
        <RobotOutlined />
        <Typography.Text strong>模型调用摘要</Typography.Text>
      </div>
      {items.length ? (
        <Descriptions className="specialist-agent-descriptions" size="small" column={{ xs: 1, sm: 2 }} bordered>
          {items.map((item) => (
            <Descriptions.Item key={item.key} label={item.label}>
              {isSensitiveKey(item.key) ? "已隐藏敏感信息" : renderStructuredValue(item.value)}
            </Descriptions.Item>
          ))}
        </Descriptions>
      ) : (
        <Typography.Text type="secondary">本轮没有可公开的模型调用明细。</Typography.Text>
      )}
    </div>
  );
}

/** 展示工具名称、公开动作摘要和证据引用，不显示工具参数及原始返回体。 */
function ToolActivityList({ activities }: { activities: SpecialistToolActivity[] }) {
  if (!activities.length) {
    return <Typography.Text type="secondary">本专业 Agent 本轮没有记录工具活动。</Typography.Text>;
  }
  return (
    <List
      className="specialist-agent-tool-list"
      size="small"
      dataSource={activities}
      renderItem={(activity, index) => {
        const meta = activityStatusLabel(activity.status);
        return (
          <List.Item key={`${activity.toolName}-${index}`}>
            <div className="specialist-agent-tool-activity">
              <div className="specialist-agent-tool-icon"><ToolOutlined /></div>
              <div className="specialist-agent-tool-body">
                <Space wrap size={[6, 4]}>
                  <Typography.Text strong>{activity.toolName}</Typography.Text>
                  <Tag color={meta.color}>{meta.label}</Tag>
                  {activity.durationMs ? <Typography.Text type="secondary">{durationLabel(activity.durationMs)}</Typography.Text> : null}
                </Space>
                <Typography.Paragraph className="specialist-agent-public-summary" type="secondary">
                  {activity.publicSummary}
                </Typography.Paragraph>
                {activity.evidenceReference ? (
                  <EvidenceReference value={activity.evidenceReference} compact />
                ) : null}
              </div>
            </div>
          </List.Item>
        );
      }}
    />
  );
}

/** 展示证据引用；URL 可以打开，其余引用以安全的代码文本呈现。 */
function EvidenceReference({ value, compact = false }: { value: string; compact?: boolean }) {
  const isUrl = /^https?:\/\//i.test(value);
  const content = isUrl ? (
    <a href={value} target="_blank" rel="noreferrer">
      {value}
    </a>
  ) : (
    <Typography.Text code>{value}</Typography.Text>
  );
  return (
    <div className={`specialist-agent-evidence-reference${compact ? " is-compact" : ""}`}>
      <FileSearchOutlined />
      <Typography.Text type="secondary">证据：{content}</Typography.Text>
    </div>
  );
}

/** 展示单个专业 Agent 的所有公开结果和可操作状态。 */
function SpecialistResultContent({
  result,
  onRequiredInput,
  onApproval,
  onFailure,
  onViewTaskDetails,
}: {
  result: SpecialistAgentResult;
  onRequiredInput?: (result: SpecialistAgentResult) => void;
  onApproval?: (result: SpecialistAgentResult) => void;
  onFailure?: (result: SpecialistAgentResult) => void;
  onViewTaskDetails?: (result: SpecialistAgentResult) => void;
}) {
  const meta = statusMeta(result.status);
  const hasFailure = isFailedStatus(result.status) || hasFailedApprovalRequest(result) || Boolean(result.errorCode);
  const waitsForApproval = isApprovalStatus(result.status) || hasPendingApprovalRequest(result);
  const waitsForControlPlaneEvidence = isControlPlaneEvidenceWaitingStatus(result.status);
  const waitsForBusinessInput = !waitsForControlPlaneEvidence
    && (isSpecialistBusinessInputPendingStatus(result.status) || result.requiredInputFields.length > 0);
  const isRecoveryApproval = waitsForApproval && result.agentRole.trim().toUpperCase() === "RECOVERY_AGENT";
  const taskDetailLocator = findTaskDetailLocator(result.structuredOutput);
  const isCompletedTaskResult = isCompletedStatus(result.status)
    && (result.agentRole.toUpperCase().includes("TASK") || Boolean(taskDetailLocator.taskId));
  // 任务详情页至少需要 taskId 才能定位任务；executionId 可选，用于直接选中某次执行。
  const hasTaskDetailLocator = Boolean(taskDetailLocator.taskId);
  return (
    <div className="specialist-agent-result-content">
      <div className="specialist-agent-result-identifiers">
        <Typography.Text type="secondary">Agent ID：{result.agentId}</Typography.Text>
        <Typography.Text type="secondary">Turn ID：{result.turnId}</Typography.Text>
      </div>

      {waitsForApproval ? (
        <Alert
          className="specialist-agent-required-input"
          type="warning"
          showIcon
          message={isRecoveryApproval ? "修复方案等待你的审批，尚未执行任何修复动作" : "该专业 Agent 正在等待你的审批"}
          description={(
            <Space direction="vertical" size={8} className="specialist-agent-full-width">
              <Typography.Text>{result.publicSummary}</Typography.Text>
              {isRecoveryApproval ? (
                <Typography.Text type="secondary">
                  故障恢复只能在你查看并确认真实审批计划后继续，页面不会自动批准、自动改表或自动重试。
                </Typography.Text>
              ) : null}
              {onApproval ? (
                <Button size="small" type="primary" onClick={() => onApproval(result)}>
                  {isRecoveryApproval ? "查看修复审批" : "定位审批入口"}
                </Button>
              ) : (
                <Typography.Text type="secondary">
                  已识别待审批动作，但当前历史快照没有恢复真实 Java sessionId/runId；请重新打开该会话以恢复审批入口。
                </Typography.Text>
              )}
            </Space>
          )}
        />
      ) : null}

      {!waitsForApproval && waitsForControlPlaneEvidence ? (
        <Alert
          className="specialist-agent-required-input"
          type="info"
          showIcon
          message="等待控制面证据"
          description={(
            <Space direction="vertical" size={8} className="specialist-agent-full-width">
              <Typography.Text>{result.publicSummary}</Typography.Text>
              <Typography.Text type="secondary">
                方案已生成，正在等待 Java 控制面返回真实任务/执行事实后继续。
              </Typography.Text>
            </Space>
          )}
        />
      ) : null}

      {!waitsForApproval && waitsForBusinessInput ? (
        <Alert
          className="specialist-agent-required-input"
          type="warning"
          showIcon
          message="还需要补充以下信息"
          description={(
            <Space direction="vertical" size={8} className="specialist-agent-full-width">
              <Typography.Text>{result.publicSummary}</Typography.Text>
              <div className="specialist-agent-missing-fields">
                {result.requiredInputFields.length ? result.requiredInputFields.map((field) => <Tag key={field}>{fieldLabel(field)}</Tag>) : <Tag>待确认的业务参数</Tag>}
              </div>
              {onRequiredInput ? (
                <Button size="small" type="primary" onClick={() => onRequiredInput(result)}>
                  补充信息
                </Button>
              ) : null}
            </Space>
          )}
        />
      ) : null}

      {hasFailure ? (
        <Alert
          className="specialist-agent-failure"
          type="error"
          showIcon
          message={result.errorCode ? `执行失败：${result.errorCode}` : "专业 Agent 执行失败"}
          description={(
            <Space direction="vertical" size={8} className="specialist-agent-full-width">
              <Typography.Text>{result.publicSummary}</Typography.Text>
              {onFailure ? (
                <Button size="small" danger onClick={() => onFailure(result)}>
                  让 Agent 继续诊断
                </Button>
              ) : null}
            </Space>
          )}
        />
      ) : null}

      {!hasFailure && !isWaitingStatus(result.status) && !waitsForApproval ? (
        <div className="specialist-agent-public-result">
          <div className="specialist-agent-section-title">
            {meta.icon}
            <Typography.Text strong>处理结果</Typography.Text>
          </div>
          <Typography.Paragraph className="specialist-agent-public-summary">
            {result.publicSummary}
          </Typography.Paragraph>
          {isCompletedTaskResult && onViewTaskDetails && hasTaskDetailLocator ? (
            <Button size="small" type="link" onClick={() => onViewTaskDetails(result)}>
              查看任务详情
            </Button>
          ) : null}
          {isCompletedTaskResult && !hasTaskDetailLocator ? (
            <Typography.Text type="secondary">
              本次结果没有真实 taskId，暂不显示任务详情入口。
            </Typography.Text>
          ) : null}
        </div>
      ) : null}

      {Object.keys(result.structuredOutput).some((key) => !isHiddenModelField(key)) ? (
        <div className="specialist-agent-section">
          <div className="specialist-agent-section-title">
            <CheckCircleOutlined />
            <Typography.Text strong>结构化结论</Typography.Text>
          </div>
          <Descriptions className="specialist-agent-descriptions" size="small" column={1} bordered>
            {Object.entries(result.structuredOutput)
              .filter(([key]) => !isHiddenModelField(key))
              .map(([key, value]) => (
                <Descriptions.Item key={key} label={fieldLabel(key)}>
                  {isSensitiveKey(key)
                    ? "已隐藏敏感信息"
                    : renderStructuredValue(value, 0, isMappingDetailField(key))}
                </Descriptions.Item>
              ))}
          </Descriptions>
        </div>
      ) : null}

      <div className="specialist-agent-section">
        <div className="specialist-agent-section-title">
          <ToolOutlined />
          <Typography.Text strong>工具活动</Typography.Text>
        </div>
        <ToolActivityList activities={result.toolActivities} />
      </div>

      {result.modelInvocationSummary && Object.keys(result.modelInvocationSummary).length ? (
        <ModelInvocationSummary summary={result.modelInvocationSummary} />
      ) : null}

      {result.evidenceReferences.length ? (
        <div className="specialist-agent-section">
          <div className="specialist-agent-section-title">
            <FileSearchOutlined />
            <Typography.Text strong>参考证据</Typography.Text>
          </div>
          <Space direction="vertical" size={6} className="specialist-agent-full-width">
            {result.evidenceReferences.map((reference) => <EvidenceReference key={reference} value={reference} />)}
          </Space>
        </div>
      ) : null}
    </div>
  );
}

/** 生成一条专业 Agent 的折叠面板标题，让折叠状态仍能看见最重要的进度信息。 */
function resultPanelLabel(result: SpecialistAgentResult): ReactNode {
  const meta = statusMeta(result.status);
  return (
    <div className="specialist-agent-result-header">
      <div className="specialist-agent-result-title">
        <span className={`specialist-agent-status-icon is-${meta.color}`}>{meta.icon}</span>
        <Typography.Text strong>{roleLabel(result.agentRole)}</Typography.Text>
        <Tag color={meta.color}>{meta.label}</Tag>
      </div>
      <Space size={8} className="specialist-agent-result-duration">
        {result.durationMs ? <Typography.Text type="secondary">{durationLabel(result.durationMs)}</Typography.Text> : null}
        <Typography.Text type="secondary" className="specialist-agent-turn-id">{result.turnId}</Typography.Text>
      </Space>
    </div>
  );
}

/** 将跳过角色的原因展示给用户，但不把内部调度图或 checkpoint 字段倾倒出来。 */
function SkippedRoles({ skippedRoles }: { skippedRoles: Readonly<Record<string, string>> }) {
  const entries = Object.entries(skippedRoles);
  if (!entries.length) return null;
  return (
    <Alert
      className="specialist-agent-skipped"
      type="info"
      showIcon
      message="本轮有专业 Agent 未启动"
      description={(
        <Space direction="vertical" size={4} className="specialist-agent-full-width">
          {entries.map(([role, reason]) => (
            <div className="specialist-agent-skipped-row" key={role}>
              <Typography.Text strong>{roleLabel(role)}</Typography.Text>
              <Typography.Text type="secondary">{reason}</Typography.Text>
            </div>
          ))}
        </Space>
      )}
    />
  );
}

/** 展示实际执行波次，避免把 LangGraph 节点当作用户业务步骤。 */
function ExecutionWaves({ waves }: { waves: string[][] }) {
  if (!waves.length) return null;
  return (
    <Collapse
      className="specialist-agent-waves"
      ghost
      items={[{
        key: "execution-waves",
        label: <span><ClockCircleOutlined /> 实际专业 Agent 执行顺序（{waves.length} 个波次）</span>,
        children: (
          <div className="specialist-agent-wave-list">
            {waves.map((wave, index) => (
              <div className="specialist-agent-wave" key={`wave-${index}`}>
                <Badge count={index + 1} className="specialist-agent-wave-index" />
                <Space wrap size={[6, 4]}>
                  {wave.map((role) => <Tag key={`${index}-${role}`}>{roleLabel(role)}</Tag>)}
                </Space>
              </div>
            ))}
          </div>
        ),
      }]}
    />
  );
}

/** 判断桥接是否仍需要用户或 Java 控制面继续处理。 */
function bridgeRequiresAttention(bridge: NormalizedToolPlanBridge): boolean {
  return bridge.status !== "ACCEPTED"
    || Boolean(bridge.issues.length)
    || bridge.recoveryHandoff?.approvalStatus?.toUpperCase().includes("PENDING") === true
    || bridge.recoveryHandoff?.requiresJavaRehydration === true;
}

/** 将桥接状态翻译成用户能直接采取行动的说明，而不是展示内部枚举。 */
function bridgeStatusInstruction(bridge: NormalizedToolPlanBridge): string {
  const status = bridge.status;
  if (isApprovalStatus(status)) return "该动作需要你在审批入口确认，Agent 不会绕过审批直接执行。";
  if (isControlPlaneEvidenceWaitingStatus(status)) {
    return "同步方案已生成，正在等待 Java 控制面返回真实任务/执行事实后继续。";
  }
  if (isSpecialistBusinessInputPendingStatus(status)) return "该专项 Agent 还缺少可靠的业务信息，补齐后才能生成可执行计划。";
  if (isFailedStatus(status)) return "本次桥接没有进入执行链路，请根据下面的问题修正配置后重试。";
  if (isInProgressStatus(status)) return "桥接仍在处理中，Java 控制面尚未确认可继续的执行边界。";
  return "已通过当前用户权限和工具治理检查，后续由 Java Durable 执行链路处理。";
}

/** 将 Java handoff 的审批枚举转换为用户可理解的状态。 */
function approvalStatusLabel(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized.includes("APPROVED")) return "已批准";
  if (normalized.includes("REJECTED")) return "已拒绝";
  if (normalized.includes("PENDING") || normalized.includes("WAITING")) return "等待审批";
  if (normalized.includes("EXECUT")) return "已进入执行";
  return "已记录";
}

/** 将 post-bridge 生命周期状态转换成页面上的业务语言，避免直接暴露内部枚举。 */
function postBridgeStatusLabel(
  status: string,
  evidence?: Parameters<typeof isSpecialistPostBridgeEvidenceSuccessful>[0],
): string {
  if (evidence && isSpecialistPostBridgeEvidenceSuccessful(evidence)) return "已完成复核";
  if (isSpecialistSuccessfulStatus(status)) return "已提交复核，等待实际结果";
  if (status.includes("NO_TRUSTED_TASK_FACT")) return "等待可信任务定位";
  if (status.includes("RESOURCE_FACT_UNCHANGED")) return "资源未变化，跳过重复复核";
  if (status.includes("FAILED") || status.includes("ERROR")) return "复核失败";
  if (status.includes("RUNNING") || status.includes("EXECUT")) return "复核处理中";
  return "等待复核";
}

/**
 * RESOURCE_FACT_UNCHANGED is a deliberate no-op, not an unfinished review.
 * Keep it separate from generic waiting states so an unchanged durable task
 * never makes PRECHECK/MONITOR look as though they are still running.
 */
function isSkippedPostBridgeVerification(status: string): boolean {
  return status.includes("RESOURCE_FACT_UNCHANGED") || status.includes("SKIPPED");
}

/**
 * 展示 DATA_SYNC/RECOVERY 到 Java ToolPlan 的桥接过程。
 *
 * 桥接摘要使用受控白名单：工具名、状态、问题摘要和参数字段名可以帮助
 * 用户理解系统在等待什么；原始 arguments、SQL、凭据和模型正文永远不会
 * 从这里渲染。运行中或等待中的条目自动展开，完成后允许用户手动查看。
 */
function ToolPlanBridgeSection({ bridges }: { bridges: NormalizedToolPlanBridge[] }) {
  const attentionKeys = useMemo(
    () => bridges
      .map((bridge, index) => bridgeRequiresAttention(bridge) ? `bridge-${index}` : undefined)
      .filter((key): key is string => Boolean(key)),
    [bridges],
  );
  const [activeKeys, setActiveKeys] = useState<string[]>(attentionKeys);
  const previousAttentionRef = useRef(new Set<string>());

  /**
   * 实时轮询会不断替换同一个桥接摘要。这里只自动打开新增的待处理项，
   * 并在它从待处理变成完成后收起，避免刷新时抢走用户正在阅读的控制权。
   */
  useEffect(() => {
    setActiveKeys((current) => {
      const next = new Set(current);
      attentionKeys.forEach((key) => next.add(key));
      for (const key of previousAttentionRef.current) {
        if (!attentionKeys.includes(key)) next.delete(key);
      }
      previousAttentionRef.current = new Set(attentionKeys);
      return [...next];
    });
  }, [attentionKeys]);

  if (!bridges.length) return null;

  return (
    <div className="specialist-agent-lifecycle-section specialist-agent-bridge-section">
      <div className="specialist-agent-section-title">
        <ToolOutlined />
        <Typography.Text strong>ToolPlan 桥接</Typography.Text>
        <Tag color="blue">DATA_SYNC / RECOVERY</Tag>
      </div>
      <Typography.Paragraph type="secondary" className="specialist-agent-lifecycle-description">
        这里展示专项 Agent 的方案是否已经交给 Java 控制面；桥接本身不执行高风险动作。
      </Typography.Paragraph>
      <Collapse
        className="specialist-agent-lifecycle-collapse"
        activeKey={activeKeys}
        onChange={(keys) => setActiveKeys(Array.isArray(keys) ? keys : [keys])}
        items={bridges.map((bridge, index) => {
          const meta = statusMeta(bridge.status);
          const acceptedNames = bridge.acceptedToolNames.length
            ? bridge.acceptedToolNames.join("、")
            : "尚未生成可提交工具计划";
          return {
            key: `bridge-${index}`,
            label: (
              <div className="specialist-agent-lifecycle-heading">
                <div className="specialist-agent-lifecycle-title">
                  <span className={`specialist-agent-status-icon is-${meta.color}`}>{meta.icon}</span>
                  <Typography.Text strong>{roleLabel(bridge.specialistRole)}</Typography.Text>
                  <Tag color={meta.color}>{meta.label}</Tag>
                </div>
                <Typography.Text type="secondary" ellipsis>
                  {bridge.acceptedToolPlanCount} 个 ToolPlan · {acceptedNames}
                </Typography.Text>
              </div>
            ),
            children: (
              <Space direction="vertical" size={10} className="specialist-agent-full-width">
                <Typography.Paragraph className="specialist-agent-public-summary">
                  {bridge.publicSummary}
                </Typography.Paragraph>
                <Alert
                  type={bridgeRequiresAttention(bridge) ? "warning" : "success"}
                  showIcon
                  message={bridgeStatusInstruction(bridge)}
                />
                <Descriptions className="specialist-agent-descriptions" size="small" column={{ xs: 1, sm: 2 }} bordered>
                  <Descriptions.Item label="桥接结果">{meta.label}</Descriptions.Item>
                  <Descriptions.Item label="可提交工具">
                    {bridge.acceptedToolNames.length ? (
                      <Space wrap size={[4, 4]}>{bridge.acceptedToolNames.map((name) => <Tag key={name}>{name}</Tag>)}</Space>
                    ) : "无"}
                  </Descriptions.Item>
                  <Descriptions.Item label="当前可见工具">
                    {bridge.visibleToolNames.length ? (
                      <Space wrap size={[4, 4]}>{bridge.visibleToolNames.map((name) => <Tag key={name}>{name}</Tag>)}</Space>
                    ) : "未返回"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Durable 提交">
                    {bridge.canSubmitDurableLoop === undefined
                      ? "未提供"
                      : bridge.canSubmitDurableLoop ? "允许继续提交" : "暂不能继续提交"}
                  </Descriptions.Item>
                </Descriptions>
                {bridge.argumentFieldNames.some((fields) => fields.length) ? (
                  <div className="specialist-agent-bridge-field-list">
                    <Typography.Text type="secondary">控制面涉及的参数字段名（未展示参数值）</Typography.Text>
                    <Space wrap size={[4, 4]}>
                      {[...new Set(bridge.argumentFieldNames.flat())].map((field) => <Tag key={field}>{fieldLabel(field)}</Tag>)}
                    </Space>
                  </div>
                ) : null}
                {bridge.recoveryHandoff ? (
                  <div className="specialist-agent-bridge-handoff">
                    <Typography.Text strong>Recovery Java handoff</Typography.Text>
                    <Space wrap size={[6, 4]}>
                      {bridge.recoveryHandoff.approvalStatus ? (
                        <Tag color={bridge.recoveryHandoff.approvalStatus.toUpperCase().includes("APPROVED") ? "success" : "warning"}>
                          审批状态：{approvalStatusLabel(bridge.recoveryHandoff.approvalStatus)}
                        </Tag>
                      ) : null}
                      {bridge.recoveryHandoff.approvalFactAccepted !== undefined ? (
                        <Tag>审批事实：{bridge.recoveryHandoff.approvalFactAccepted ? "已被可信控制面接受" : "尚未接受"}</Tag>
                      ) : null}
                      {bridge.recoveryHandoff.requiresJavaRehydration ? (
                        <Tag color="warning">等待 Java 根据真实事实补齐动作</Tag>
                      ) : null}
                      {bridge.recoveryHandoff.blueprintCount !== undefined ? (
                        <Tag>{bridge.recoveryHandoff.blueprintCount} 个修复动作蓝图</Tag>
                      ) : null}
                    </Space>
                  </div>
                ) : null}
                {bridge.issues.length ? (
                  <div className="specialist-agent-bridge-issues">
                    <Typography.Text strong>需要继续处理的问题</Typography.Text>
                    {bridge.issues.map((issue, issueIndex) => (
                      <Alert
                        key={`${issue.code || "issue"}-${issueIndex}`}
                        type="warning"
                        showIcon
                        message={issue.message}
                        description={issue.code ? `定位码：${issue.code}` : undefined}
                      />
                    ))}
                  </div>
                ) : null}
              </Space>
            ),
          };
        })}
      />
    </div>
  );
}

/** 将 post-bridge 是否完成及真实资源定位展示给用户，避免只显示“复核已执行”。 */
function PostBridgeVerificationSection({
  verification,
  postBridge,
  onViewTaskLocator,
}: {
  verification?: NormalizedBatchExecution;
  postBridge?: NormalizedPostBridgeVerification;
  onViewTaskLocator?: (locator: SpecialistTaskDetailLocator) => void;
}) {
  if (!postBridge && !verification) return null;
  const status = postBridge?.status || verification?.status || "UNKNOWN";
  const verificationSkipped = isSkippedPostBridgeVerification(status);
  const evidence = postBridge
    ? postBridgeEvidenceSignals(postBridge, verification)
    : verification
      ? {
          status: verification.status,
          batchStatus: verification.status,
          resultStatuses: verification.hasExplicitResultEvidence
            ? verification.results.map((result) => result.status)
            : undefined,
          resultCount: verification.hasExplicitResultEvidence ? verification.results.length : undefined,
          completedCount: verification.hasExplicitResultEvidence ? verification.completedCount : undefined,
          failedCount: verification.hasExplicitResultEvidence ? verification.failedCount : undefined,
          waitingInputCount: verification.hasExplicitResultEvidence ? verification.waitingInputCount : undefined,
        }
      : undefined;
  const verificationCompleted = Boolean(evidence && isSpecialistPostBridgeEvidenceSuccessful(evidence));
  const verificationFailed = isFailedStatus(status)
    || isFailedStatus(postBridge?.batchStatus ?? "")
    || (verification?.failedCount ?? 0) > 0
    || verification?.results.some((result) => isFailedStatus(result.status)) === true;
  const meta = verificationCompleted
    ? { label: "已完成复核", color: "success", icon: <CheckCircleOutlined /> }
    : verificationFailed
      ? statusMeta("FAILED")
      : verificationSkipped
        ? { label: "暂未重复复核", color: "default", icon: <ClockCircleOutlined /> }
        : isSpecialistSuccessfulStatus(status)
          ? { label: "等待实际复核结果", color: "processing", icon: <LoadingOutlined /> }
          : statusMeta(status);
  const hasResourceLocator = Boolean(postBridge?.taskId || postBridge?.executionId);
  const taskIdNumber = postBridge?.taskId ? Number(postBridge.taskId) : undefined;
  const executionIdNumber = postBridge?.executionId ? Number(postBridge.executionId) : undefined;
  return (
    <div className="specialist-agent-lifecycle-section specialist-agent-verification-section">
      <div className="specialist-agent-section-title">
        <SafetyCertificateOutlined />
        <Typography.Text strong>执行后复核</Typography.Text>
        <Tag color={meta.color} icon={meta.icon}>{meta.label}</Tag>
      </div>
      <Descriptions className="specialist-agent-descriptions" size="small" column={{ xs: 1, sm: 2 }} bordered>
        <Descriptions.Item label="复核状态">
          {postBridgeStatusLabel(postBridge?.status || verification?.status || "UNKNOWN", evidence)}
        </Descriptions.Item>
        <Descriptions.Item label="复核 Agent">
          {postBridge?.executedRoles.length
            ? postBridge.executedRoles.map(roleLabel).join("、")
            : verification?.results.map((result) => roleLabel(result.agentRole)).join("、") || "未执行"}
        </Descriptions.Item>
        <Descriptions.Item label="taskId">{postBridge?.taskId ? `#${postBridge.taskId}` : "未返回可信 taskId"}</Descriptions.Item>
        <Descriptions.Item label="executionId">{postBridge?.executionId ? `#${postBridge.executionId}` : "未返回可信 executionId"}</Descriptions.Item>
      </Descriptions>
      {hasResourceLocator ? (
        <Alert
          className="specialist-agent-verification-note"
          type={verificationCompleted ? "success" : "info"}
          showIcon
          message={verificationCompleted
            ? "PRECHECK 和 MONITOR 已针对 Java 控制面返回的真实资源执行复核。"
            : verificationFailed
              ? "复核批次包含失败结果，当前不能视为完成。"
            : verificationSkipped
              ? "真实同步资源未发生变化，本轮不重复运行 PRECHECK 和 MONITOR。"
              : "已识别真实同步资源，复核结果会随着后续运行状态更新。"}
        />
      ) : (
        <Typography.Text type="secondary" className="specialist-agent-verification-note">
          当前没有可信的任务或执行定位，因此不会凭空判断复核是否通过。
        </Typography.Text>
      )}
      {onViewTaskLocator && Number.isInteger(taskIdNumber) && taskIdNumber && taskIdNumber > 0 ? (
        <Button
          size="small"
          type="link"
          icon={<FileSearchOutlined />}
          onClick={() => onViewTaskLocator({
            taskId: taskIdNumber,
            executionId: Number.isInteger(executionIdNumber) && executionIdNumber && executionIdNumber > 0
              ? executionIdNumber
              : undefined,
          })}
        >
          查看任务与本次执行详情
        </Button>
      ) : null}
      {verification?.results.length ? (
        <Typography.Text type="secondary" className="specialist-agent-verification-count">
          复核批次：已完成 {verification.completedCount}，处理中/等待 {verification.waitingInputCount}，失败 {verification.failedCount}
        </Typography.Text>
      ) : null}
    </div>
  );
}

/** 计算批次进度；没有有效计数时不绘制误导性的 0% 进度条。 */
function executionProgress(execution: NormalizedExecution): number | undefined {
  const verification = execution.verificationExecution;
  const executedCount = execution.executedCount + (verification?.executedCount ?? 0);
  if (executedCount <= 0) return undefined;
  const completed = execution.completedCount
    + execution.failedCount
    + (verification?.completedCount ?? 0)
    + (verification?.failedCount ?? 0);
  return Math.min(100, Math.round((completed / executedCount) * 100));
}

/**
 * 计算专业 Agent 的累计处理耗时。
 * 后端当前为每个 specialist turn 返回 durationMs，尚未提供批次墙钟时间；这里明确采用累计值，避免把
 * 并行 turn 中的最大值误说成整个批次耗时。后端未来返回 batchDurationMs 后可在归一化层直接替换。
 */
function totalExecutionDuration(execution: NormalizedExecution): number {
  const primaryDuration = execution.results.reduce((total, result) => total + result.durationMs, 0);
  const verificationDuration = execution.verificationExecution?.results
    .reduce((total, result) => total + result.durationMs, 0) ?? 0;
  return primaryDuration + verificationDuration;
}

/**
 * 按六个首轮 Specialist 的业务顺序稳定展示结果；未知角色放在末尾。
 * 后端为了并发可能按完成时间返回结果，前端不能让用户每次刷新都看到
 * 不同的顺序，否则很难判断哪一项属于首轮、哪一项属于复核。
 */
function orderSpecialistResults(results: SpecialistAgentResult[]): SpecialistAgentResult[] {
  return [...results].sort((left, right) => {
    const leftRole = left.agentRole.toUpperCase();
    const rightRole = right.agentRole.toUpperCase();
    const leftIndex = INITIAL_SPECIALIST_ROLE_ORDER.indexOf(leftRole as (typeof INITIAL_SPECIALIST_ROLE_ORDER)[number]);
    const rightIndex = INITIAL_SPECIALIST_ROLE_ORDER.indexOf(rightRole as (typeof INITIAL_SPECIALIST_ROLE_ORDER)[number]);
    return (leftIndex < 0 ? INITIAL_SPECIALIST_ROLE_ORDER.length : leftIndex)
      - (rightIndex < 0 ? INITIAL_SPECIALIST_ROLE_ORDER.length : rightIndex);
  });
}

/**
 * Build an explicit six-role coverage ledger from the initial batch.
 *
 * Results are intentionally not synthesized for missing roles.  A role can be
 * marked as skipped only when the runtime supplied a public skip fact; every
 * other absence stays `NOT_REPORTED` so the user can distinguish an incomplete
 * response from an intentional workflow optimization before relying on the
 * final status badge.
 */
function initialSpecialistRoleCoverage(
  results: SpecialistAgentResult[],
  skippedRoles: Readonly<Record<string, string>>,
): InitialSpecialistRoleCoverage[] {
  const skippedReasons = new Map(
    Object.entries(skippedRoles).map(([role, reason]) => [role.trim().toUpperCase(), reason]),
  );
  return INITIAL_SPECIALIST_ROLE_ORDER.map((role) => {
    const roleResults = results.filter((result) => result.agentRole.trim().toUpperCase() === role);
    if (roleResults.length) {
      const latestResult = roleResults[roleResults.length - 1];
      return {
        role,
        state: "REPORTED",
        resultCount: roleResults.length,
        status: latestResult.status,
      };
    }
    const skippedReason = skippedReasons.get(role);
    return skippedReason
      ? { role, state: "SKIPPED", skippedReason }
      : { role, state: "NOT_REPORTED" };
  });
}

/**
 * Render the stable six-Specialist roster above the detailed result cards.
 *
 * Detailed cards retain every real turn, including repeated turns from a
 * streaming retry.  This small ledger answers the separate operator question
 * of whether each expected role reported, was deliberately skipped, or is
 * still absent.  It contains only role names, normalized states, and already
 * sanitized skip reasons; no internal orchestration graph or tool payload is
 * exposed here.
 */
function InitialSpecialistRoleCoverage({
  results,
  skippedRoles,
}: {
  results: SpecialistAgentResult[];
  skippedRoles: Readonly<Record<string, string>>;
}) {
  const coverage = initialSpecialistRoleCoverage(results, skippedRoles);
  return (
    <div className="specialist-agent-role-coverage">
      <Typography.Text strong>首轮六个 Specialist Agent 覆盖情况</Typography.Text>
      <div className="specialist-agent-role-coverage-grid">
        {coverage.map((entry) => {
          const meta = entry.state === "REPORTED" ? statusMeta(entry.status ?? "UNKNOWN") : undefined;
          const label = entry.state === "REPORTED"
            ? meta?.label ?? "已返回"
            : entry.state === "SKIPPED"
              ? "已跳过"
              : "尚未返回";
          const color = entry.state === "REPORTED"
            ? meta?.color ?? "default"
            : entry.state === "SKIPPED"
              ? "default"
              : "warning";
          const detail = entry.state === "REPORTED"
            ? `已收到 ${entry.resultCount} 个公开结果，详细内容见下方。`
            : entry.state === "SKIPPED"
              ? entry.skippedReason || "运行时已明确记录本轮跳过。"
              : "本轮尚未收到该角色的公开结果，不会被视为成功。";
          return (
            <div className="specialist-agent-role-coverage-item" key={entry.role}>
              <Space size={[4, 4]} wrap>
                <Typography.Text strong>{roleLabel(entry.role)}</Typography.Text>
                <Tag color={color}>{label}</Tag>
              </Space>
              <Typography.Text type="secondary" className="specialist-agent-role-coverage-detail">
                {detail}
              </Typography.Text>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * 生成折叠面板的稳定键，并把首轮/复核批次纳入键空间。
 * 同一个后端 specialist 可能在 post-bridge 复核再次返回相同 agentId/turnId，
 * 如果省略批次前缀，Ant Design Collapse 会把两条结果当成同一条。
 */
function specialistResultKey(result: SpecialistAgentResult, scope: "initial" | "verification") {
  return `${scope}:${result.agentId}:${result.turnId}`;
}

/**
 * 真实专业 Agent 执行结果展示组件。
 * - 处理中结果自动展开，进入终态后自动收起；用户手动展开/收起不会被后续刷新覆盖；
 * - 只展示公开摘要、结构化结论、工具活动、证据和待补参数；
 * - 失败和缺参通过宿主回调接入故障处理或补参表单，不在组件内擅自执行高风险动作。
 */
export function SpecialistAgentExecutionPanel({
  specialistAgentExecution,
  execution,
  loading = false,
  className,
  title = "专业 Agent 执行",
  onRequiredInput,
  onApproval,
  onFailure,
  onViewTaskDetails,
  onViewTaskLocator,
}: SpecialistAgentExecutionPanelProps) {
  const normalized = useMemo(
    () => normalizeExecution(specialistAgentExecution ?? execution),
    [execution, specialistAgentExecution],
  );
  const initialResults = useMemo(
    () => orderSpecialistResults(normalized?.results ?? []),
    [normalized?.results],
  );
  const verificationResults = useMemo(
    () => orderSpecialistResults(normalized?.verificationExecution?.results ?? []),
    [normalized?.verificationExecution?.results],
  );
  const allResults = useMemo(
    () => [...initialResults, ...verificationResults],
    [initialResults, verificationResults],
  );
  const resultKeys = useMemo(
    () => [
      ...initialResults.map((result) => specialistResultKey(result, "initial")),
      ...verificationResults.map((result) => specialistResultKey(result, "verification")),
    ],
    [initialResults, verificationResults],
  );
  const initialOpenKeys = useMemo(
    () => [
      ...initialResults
        .filter(resultRequiresAttention)
        .map((result) => specialistResultKey(result, "initial")),
      ...verificationResults
        .filter(resultRequiresAttention)
        .map((result) => specialistResultKey(result, "verification")),
    ],
    [initialResults, verificationResults],
  );
  const [expandedKeys, setExpandedKeys] = useState<string[]>(initialOpenKeys);
  const previousAttentionRef = useRef<Map<string, boolean>>(new Map());
  const batchShouldStayOpen = normalized
    ? shouldExpandResult(normalized.status)
      || allResults.some(resultRequiresAttention)
      || normalized.bridges.some(bridgeRequiresAttention)
    : false;
  const [panelExpanded, setPanelExpanded] = useState(batchShouldStayOpen);
  const previousBatchOpenRef = useRef(batchShouldStayOpen);

  /**
   * 运行中、缺参、审批和失败结果保持展开；仅在第一次进入无待办完成态时自动收起。
   * 用户手动重新展开完成结果后，状态未变化的轮询不会再次抢走折叠控制权。
   */
  useEffect(() => {
    if (!normalized) return;
    setExpandedKeys((currentKeys) => {
      const current = new Set(currentKeys.filter((key) => resultKeys.includes(key)));
      for (const { result, scope } of [
        ...initialResults.map((item) => ({ result: item, scope: "initial" as const })),
        ...verificationResults.map((item) => ({ result: item, scope: "verification" as const })),
      ]) {
        const key = specialistResultKey(result, scope);
        const attention = resultRequiresAttention(result);
        const previousAttention = previousAttentionRef.current.get(key);
        if (attention) current.add(key);
        /*
         * 审批请求可能从 pending 变为 APPROVED，而专业 turn 顶层状态仍保持
         * COMPLETED；只比较 status 会漏掉这个转移，导致已处理结果一直展开。
         * 记录“是否需要介入”本身，才能在审批/补参/失败解决后可靠自动折叠。
         */
        if (previousAttention === true && !attention) current.delete(key);
        previousAttentionRef.current.set(key, attention);
      }
      return [...current];
    });
  }, [allResults, initialResults, normalized, resultKeys, verificationResults]);

  /**
   * 整批运行或需要补参、审批、故障处理时保持展开；全部完成后自动折叠成一行。
   * 完成态下用户手动重新展开后，只要状态没有再次变化，轮询刷新就不会抢走用户的阅读控制权。
   */
  useEffect(() => {
    if (batchShouldStayOpen) setPanelExpanded(true);
    if (previousBatchOpenRef.current && !batchShouldStayOpen) setPanelExpanded(false);
    previousBatchOpenRef.current = batchShouldStayOpen;
  }, [batchShouldStayOpen]);

  if (loading) {
    return (
      <Card className={`specialist-agent-panel${className ? ` ${className}` : ""}`} loading title={title}>
        <Typography.Text type="secondary">正在加载专业 Agent 执行结果...</Typography.Text>
      </Card>
    );
  }

  if (!normalized) return null;
  if (!initialResults.length
    && !verificationResults.length
    && !Object.keys(normalized.skippedRoles).length
    && !normalized.bridges.length
    && !normalized.postBridgeSummary) {
    return (
      <Card className={`specialist-agent-panel${className ? ` ${className}` : ""}`} title={title}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前没有专业 Agent 结果" />
      </Card>
    );
  }

  const batchMeta = statusMeta(normalized.status);
  const progress = executionProgress(normalized);
  const totalDuration = totalExecutionDuration(normalized);
  const panelItems = initialResults.map((result) => ({
    key: specialistResultKey(result, "initial"),
    label: resultPanelLabel(result),
    children: (
      <SpecialistResultContent
        result={result}
        onRequiredInput={onRequiredInput}
        onApproval={onApproval}
        onFailure={onFailure}
        onViewTaskDetails={onViewTaskDetails}
      />
    ),
  }));
  const verificationPanelItems = verificationResults.map((result) => ({
    key: specialistResultKey(result, "verification"),
    label: resultPanelLabel(result),
    children: (
      <SpecialistResultContent
        result={result}
        onRequiredInput={onRequiredInput}
        onApproval={onApproval}
        onFailure={onFailure}
        onViewTaskDetails={onViewTaskDetails}
      />
    ),
  }));

  return (
    <div className={`specialist-agent-panel${className ? ` ${className}` : ""}`}>
      <Collapse
        className="specialist-agent-batch-collapse"
        activeKey={panelExpanded ? ["specialist-agent-batch"] : []}
        onChange={(keys) => setPanelExpanded(Array.isArray(keys)
          ? keys.includes("specialist-agent-batch")
          : keys === "specialist-agent-batch")}
        expandIconPosition="end"
        items={[{
          key: "specialist-agent-batch",
          label: (
            <div className="specialist-agent-batch-heading">
              <div className="specialist-agent-panel-title">
                <RobotOutlined />
                <Typography.Text strong>{title}</Typography.Text>
                <Tag color={batchMeta.color} icon={batchMeta.icon}>{batchMeta.label}</Tag>
              </div>
              <Space size={8} wrap className="specialist-agent-batch-metrics">
                <Typography.Text type="secondary">首轮 {normalized.executedCount} 个 Agent</Typography.Text>
                {normalized.verificationExecution ? (
                  <Typography.Text type="secondary">复核 {normalized.verificationExecution.executedCount} 个 Agent</Typography.Text>
                ) : null}
                {totalDuration ? (
                  <Typography.Text type="secondary">累计 {durationLabel(totalDuration)}</Typography.Text>
                ) : null}
              </Space>
            </div>
          ),
          children: (
            <div className="specialist-agent-batch-body">
              <div className="specialist-agent-overview">
        <div className="specialist-agent-overview-heading">
          <div>
            <Typography.Text strong>首轮六个 Specialist Agent 结果</Typography.Text>
            <Typography.Paragraph type="secondary" className="specialist-agent-overview-summary">
              下面展示知识检索、数据源、同步规划、预检查、故障恢复和运行监控六类 Agent 的公开摘要与受控活动；不包含 LangGraph 节点、隐藏思维过程或原始敏感参数。
            </Typography.Paragraph>
          </div>
          {progress !== undefined ? (
            <div className="specialist-agent-progress">
              <Typography.Text type="secondary">批次进度 {progress}%</Typography.Text>
              <Progress percent={progress} size="small" showInfo={false} status={normalized.failedCount ? "exception" : undefined} />
            </div>
          ) : null}
        </div>
        <div className="specialist-agent-counts">
          <Tag color="blue">首轮已启动 {normalized.executedCount}</Tag>
          <Tag color="success">首轮已完成 {normalized.completedCount}</Tag>
          <Tag color="warning">首轮待处理 {normalized.waitingInputCount}</Tag>
          <Tag color="error">首轮失败 {normalized.failedCount}</Tag>
        </div>
      </div>

      <InitialSpecialistRoleCoverage
        results={initialResults}
        skippedRoles={normalized.skippedRoles}
      />
      <SkippedRoles skippedRoles={normalized.skippedRoles} />
      <ExecutionWaves waves={normalized.executionWaves} />
      <Collapse
        className="specialist-agent-results"
        activeKey={expandedKeys}
        onChange={(keys) => setExpandedKeys(Array.isArray(keys) ? keys : [keys])}
        items={panelItems}
      />
      {verificationPanelItems.length ? (
        <div className="specialist-agent-lifecycle-section specialist-agent-verification-results">
          <div className="specialist-agent-section-title">
            <SafetyCertificateOutlined />
            <Typography.Text strong>执行后 PRECHECK / MONITOR 复核结果</Typography.Text>
            <Tag color={normalized.verificationExecution?.status === "SUCCEEDED" ? "success" : "processing"}>
              {normalized.verificationExecution?.executedCount ?? verificationPanelItems.length} 个复核 Agent
            </Tag>
          </div>
          <Collapse
            className="specialist-agent-results"
            activeKey={expandedKeys}
            onChange={(keys) => setExpandedKeys(Array.isArray(keys) ? keys : [keys])}
            items={verificationPanelItems}
          />
        </div>
      ) : null}
      <ToolPlanBridgeSection bridges={normalized.bridges} />
      <PostBridgeVerificationSection
        verification={normalized.verificationExecution}
        postBridge={normalized.postBridgeSummary}
        onViewTaskLocator={onViewTaskLocator}
      />
      {!initialResults.length && !verificationPanelItems.length ? (
        <Alert
          className="specialist-agent-no-result"
          type="info"
          showIcon
          icon={<WarningOutlined />}
          message="本轮没有可展示的专业 Agent 结果"
          description="请查看未启动原因，或在宿主页面重新提交可执行的 Agent 委派。"
        />
      ) : null}
            </div>
          ),
        }]}
      />
    </div>
  );
}

export default SpecialistAgentExecutionPanel;
