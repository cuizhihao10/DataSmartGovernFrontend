import { ApiError, request, requestFile, requestForm, requestWithFallback, streamJsonLines } from "@/api/client";
import {
  dataSources,
  governanceTasks,
  pageOf,
  qualityReports,
  qualityRules,
  roles,
  routePolicies,
  serviceHealth,
} from "@/api/mockData";
import type {
  ApprovalCenterRecord,
  AgentModelRoute,
  AgentObservationTimeline,
  AgentPlanCore,
  AgentPlanResponse,
  AgentConversation,
  AgentClarificationQuestion,
  AgentStructuredIntent,
  AgentRagQueryResult,
  AgentRun,
  AgentPostConfirmContinuation,
  AgentRepairProposal,
  AgentSpecialistTurnFact,
  AgentRunConfirmedExecutionResponse,
  AgentSession,
  PostBridgeVerificationSummary,
  SpecialistToolPlanBridgeSummary,
  SpecialistVerificationExecutionSummary,
  AgentTool,
  AgentToolBinding,
  AgentToolExecutionAudit,
  AgentToolExecutionFailure,
  AgentToolExecutionResult,
  AgentToolInputField,
  AgentToolPlan,
  AuthorizationSubjectCandidate,
  DataSourceAuthorizationRecord,
  DataSourceConnectionTestResult,
  DataSourceMetadataDiscoveryResult,
  DataSourceRecord,
  EndpointProbe,
  GatewaySession,
  GovernanceTask,
  LifecycleStatus,
  PermissionRole,
  PermissionMenuRecord,
  PermissionTenantRecord,
  PlatformHealth,
  PlatformPageResponse,
  ProjectCreationRequestRecord,
  ProjectJoinCandidateRecord,
  ProjectMembershipRecord,
  ProjectRecord,
  ProjectJoinRequestRecord,
  QualityReport,
  QualityRule,
  RiskLevel,
  RoutePolicy,
  RuntimeEvent,
  ServiceHealth,
  SyncConnectorCompatibility,
  SyncConnectorCapability,
  SyncAuditRecord,
  SyncCheckpoint,
  SyncErrorSample,
  SyncExecution,
  SyncExecutionLog,
  SyncExecutionPolicy,
  SyncExecutionPolicySnapshot,
  SyncIncident,
  SyncObjectExecution,
  SyncTaskBatchOperationResult,
  SyncTaskFieldMappingSuggestionResult,
  SyncTaskGroupSummary,
  SyncTaskGroupTreeNode,
  SyncTaskImportResult,
  SyncTaskImportArtifact,
  SyncTaskMetadataDiscoveryResult,
  SyncTaskOperationResult,
  SyncTask,
  SyncTaskDefinition,
  SyncTaskExecutionPrecheckResponse,
} from "@/types/domain";

export interface CreateDataSourcePayload {
  tenantId: number;
  projectId: number;
  workspaceId?: number;
  name: string;
  usageRole?: "SOURCE" | "TARGET";
  usagePurpose?: "SOURCE" | "TARGET";
  type: string;
  jdbcUrl: string;
  username: string;
  password: string;
  description?: string;
}

export interface UpdateDataSourcePayload {
  name: string;
  usagePurpose?: "SOURCE" | "TARGET";
  usageRole?: "SOURCE" | "TARGET";
  jdbcUrl: string;
  username: string;
  password?: string;
  description?: string;
}

export interface TestDataSourceConnectionPayload {
  type: string;
  jdbcUrl: string;
  username: string;
  password: string;
}

export interface TestExistingDataSourceConnectionPayload {
  jdbcUrl: string;
  username: string;
  password?: string;
}

export interface DataSourceListParams {
  current?: number;
  size?: number;
  tenantId?: number;
  projectId?: number;
  type?: string;
  usagePurpose?: "SOURCE" | "TARGET";
  status?: string;
  keyword?: string;
}

/**
 * Convert the console-facing datasource lifecycle into the datasource service query vocabulary.
 * Responses are normalized from ACTIVE/INACTIVE to ENABLED/DISABLED for UI consistency, so list filters must apply
 * the inverse conversion before crossing the API boundary. Keeping it here prevents Agent and task selectors from
 * implementing subtly different datasource visibility rules.
 */
function toDatasourceQueryStatus(status: string | undefined) {
  const normalized = status?.trim().toUpperCase();
  if (normalized === "ENABLED") {
    return "ACTIVE";
  }
  if (normalized === "DISABLED") {
    return "INACTIVE";
  }
  return normalized || undefined;
}

export interface GovernanceTaskListParams {
  current?: number;
  size?: number;
  status?: string;
  type?: string;
  tenantId?: number;
  ownerId?: number;
  projectId?: number;
  keyword?: string;
}

export interface GrantDataSourceAuthorizationPayload {
  subjectType: string;
  subjectId: string;
  subjectName?: string;
  subjectRole?: string;
  authorizedActions: string[];
  grantSource?: string;
  grantReason?: string;
  expireTime?: string;
}

export interface AuthorizationSubjectCandidateParams {
  tenantId?: number;
  projectId?: number;
  subjectType?: "USER" | "ROLE" | "SERVICE_ACCOUNT" | string;
  keyword?: string;
  activeOnly?: boolean;
  projectMembersOnly?: boolean;
  current?: number;
  size?: number;
}

export interface ProjectJoinRequestApplyPayload {
  tenantId?: number;
  projectId: number;
  applicantName?: string;
  requestedProjectRole?: "READER" | "MANAGER" | string;
  requestReason?: string;
}

export interface ProjectCreatePayload {
  tenantId?: number;
  applicationId?: number;
  projectCode?: string;
  projectName: string;
  projectType?: string;
  ownerActorId?: number;
  description?: string;
  reason?: string;
}

export interface ProjectCreationRequestApplyPayload {
  tenantId?: number;
  applicationId?: number;
  projectCode?: string;
  projectName: string;
  projectType?: string;
  applicantName?: string;
  ownerActorId?: number;
  description?: string;
  requestReason?: string;
}

export interface ProjectListParams {
  tenantId?: number;
  applicationId?: number;
  projectId?: number;
  projectCode?: string;
  projectName?: string;
  status?: string;
  onlyMine?: boolean;
  current?: number;
  size?: number;
}

export interface ProjectMembershipQueryParams {
  tenantId?: number;
  actorId?: number;
  projectId?: number;
  projectRole?: string;
  grantSource?: string;
  enabled?: boolean;
  current?: number;
  size?: number;
}

export interface ProjectMembershipUpdatePayload {
  projectRole?: "MANAGER" | "READER" | string;
  grantSource?: string;
  enabled?: boolean;
  reason?: string;
}

export interface ProjectJoinRequestQueryParams {
  tenantId?: number;
  projectId?: number;
  applicantActorId?: number;
  status?: string;
  current?: number;
  size?: number;
}

export interface ProjectJoinCandidateParams {
  tenantId?: number;
  keyword?: string;
  current?: number;
  size?: number;
}

export interface ProjectJoinRequestReviewPayload {
  approvedProjectRole?: "READER" | "MANAGER" | "OWNER" | string;
  reviewComment?: string;
}

export interface ProjectCreationRequestQueryParams {
  tenantId?: number;
  applicationId?: number;
  applicantActorId?: number;
  createdProjectId?: number;
  status?: string;
  current?: number;
  size?: number;
}

export interface ProjectCreationRequestReviewPayload {
  projectCode?: string;
  projectName?: string;
  projectType?: string;
  applicationId?: number;
  ownerActorId?: number;
  description?: string;
  reviewComment?: string;
}

export interface ApprovalCenterQueryParams {
  tenantId?: number;
  requestType?: "PROJECT_CREATION" | "PROJECT_JOIN" | string;
  status?: string;
  current?: number;
  size?: number;
}

export interface ApprovalCenterReviewPayload {
  approvedProjectRole?: "READER" | "MANAGER" | "OWNER" | string;
  projectCode?: string;
  projectName?: string;
  projectType?: string;
  applicationId?: number;
  ownerActorId?: number;
  description?: string;
  reviewComment?: string;
}

export interface TenantListParams {
  tenantId?: number;
  tenantCode?: string;
  tenantName?: string;
  tenantType?: string;
  status?: string;
  current?: number;
  size?: number;
}

export interface TenantOpenPayload {
  tenantCode: string;
  tenantName: string;
  tenantType?: "BUSINESS" | "INTERNAL" | "PLATFORM" | string;
  planCode?: string;
  ownerActorId?: number;
  applicationCode?: string;
  applicationName?: string;
  administratorUsername: string;
  administratorEmail?: string;
  administratorFirstName?: string;
  administratorLastName?: string;
  administratorInitialPassword: string;
  administratorTemporaryPassword?: boolean;
  description?: string;
  reason?: string;
}

export interface TenantUpdatePayload {
  tenantName?: string;
  tenantType?: "BUSINESS" | "INTERNAL" | "PLATFORM" | string;
  planCode?: string;
  ownerActorId?: number;
  description?: string;
  reason?: string;
}

export interface MetadataDiscoveryPayload {
  actorId: number;
  actorRole: string;
  actorTenantId: number;
  catalog?: string;
  schemaPattern?: string;
  tableNamePattern?: string;
  maxTables?: number;
  maxColumnsPerTable?: number;
  includeColumns?: boolean;
  includeViews?: boolean;
  includePrimaryKeys?: boolean;
  includeIndexes?: boolean;
  includeSampleRows?: boolean;
  sampleRowLimit?: number;
}

export interface CreateTaskPayload {
  name: string;
  description?: string;
  type: string;
  idempotencyKey?: string;
  tenantId?: number;
  ownerId?: number;
  projectId?: number;
  params?: string;
  priority?: string;
  maxRetryCount?: number;
  maxDeferCount?: number;
}

export interface CreateQualityRulePayload {
  tenantId: number;
  projectId: number;
  workspaceId?: number;
  name: string;
  ruleType: string;
  targetObject: string;
  targetType?: string;
  dataSourceId?: number;
  databaseName?: string;
  schemaName?: string;
  tableName?: string;
  fieldName?: string;
  comparisonOperator: string;
  expectedValue: number;
  severity?: string;
  description?: string;
}

export interface RunQualityCheckPayload {
  measuredValue: number;
  sampleSize: number;
  exceptionCount: number;
  notes?: string;
}

export interface SyncTaskDefinitionPayload {
  tenantId?: number;
  projectId?: number;
  workspaceId?: number;
  name: string;
  description?: string;
  sourceDatasourceId: number;
  targetDatasourceId: number;
  sourceSchemaName?: string;
  sourceObjectName?: string;
  targetSchemaName?: string;
  targetObjectName?: string;
  sourceConnectorType?: string;
  targetConnectorType?: string;
  syncMode: string;
  syncScopeType?: string;
  writeStrategy?: string;
  primaryKeyField?: string;
  incrementalField?: string;
  fieldMappingConfig?: string;
  objectMappingConfig?: string;
  customSqlConfig?: string;
  filterConfig?: string;
  partitionConfig?: string;
  retryPolicy?: string;
  timeoutPolicy?: string;
}

export interface SyncTaskCreateWizardDraftPayload extends Omit<SyncTaskDefinitionPayload, "name"> {
  taskId?: number;
  stepCode?: string;
  taskName?: string;
  name?: string;
  taskDescription?: string;
  groupCode?: string;
  groupName?: string;
  priority?: string;
  scheduleConfig?: string;
  ownerId?: number;
}

export interface SyncTaskCreateWizardDraftResult {
  taskId: number;
  created: boolean;
  currentState: string;
  scheduleEnabled?: boolean;
  nextFireTime?: string;
  groupCode?: string;
  groupName?: string;
  nextActions?: string[];
  task?: SyncTask;
  definition?: SyncTaskDefinition;
}

export interface SyncTaskQueryParams {
  tenantId?: number;
  projectId?: number;
  workspaceId?: number;
  ownerId?: number;
  groupCode?: string;
  currentState?: string;
  triggerType?: string;
  keyword?: string;
  current?: number;
  size?: number;
}

export interface UpdateSyncTaskPayload {
  name?: string;
  description?: string;
  priority?: string;
  ownerId?: number;
  groupCode?: string;
  groupName?: string;
  clearGroup?: boolean;
  scheduleConfig?: string;
  clearScheduleConfig?: boolean;
  runMode?: string;
  reason?: string;
}

export interface PublishSyncTaskPayload {
  enableSchedule?: boolean;
  reason?: string;
}

export interface UpdateSyncTaskGroupPayload {
  groupCode?: string;
  groupName?: string;
  reason?: string;
}

export interface CreateSyncTaskGroupPayload {
  tenantId?: number;
  projectId?: number;
  workspaceId?: number;
  parentGroupCode?: string;
  groupCode: string;
  groupName?: string;
  description?: string;
  displayOrder?: number;
}

export interface DeleteSyncTaskGroupParams {
  tenantId?: number;
  projectId?: number;
  workspaceId?: number;
  reason?: string;
}

export interface SyncTaskBatchOperationPayload {
  taskIds: number[];
  reason?: string;
  continueOnError?: boolean;
}

export interface SyncTaskBatchExportPayload {
  taskIds: number[];
  format?: "CSV" | "XLSX" | "EXCEL";
}

export interface SyncTaskMetadataDiscoveryPayload {
  datasourceId: number;
  side?: "SOURCE" | "TARGET" | string;
  connectorType?: string;
  filterMode?: "TABLE" | "SCHEMA" | "SCHEMA_AND_TABLE" | "CATALOG" | "ALL" | string;
  catalog?: string;
  schemaPattern?: string;
  tableNamePattern?: string;
  includeColumns?: boolean;
  includeViews?: boolean;
  maxTables?: number;
  maxColumnsPerTable?: number;
}

export interface SyncTaskFieldMappingSuggestionPayload {
  sourceDatasourceId: number;
  targetDatasourceId: number;
  sourceConnectorType?: string;
  targetConnectorType?: string;
  sourceCatalog?: string;
  sourceSchema?: string;
  sourceTable: string;
  targetCatalog?: string;
  targetSchema?: string;
  targetTable: string;
  maxColumnsPerTable?: number;
}

export interface CloneSyncTaskPayload {
  name?: string;
  description?: string;
  ownerId?: number;
  groupCode?: string;
  groupName?: string;
  keepScheduleConfig?: boolean;
  runImmediately?: boolean;
}

export interface SyncTaskLifecyclePayload {
  reason?: string;
}

export interface SyncTaskRecoveryPayload {
  sourceExecutionId?: number;
  sourceCheckpointId?: number;
  windowStart?: string;
  windowEnd?: string;
  shardOrPartition?: string;
  reason?: string;
}

export interface SyncWorkerLoopRunPayload {
  executorId?: string;
  tenantId?: number;
  maxExecutions?: number;
  leaseSeconds?: number;
}

export interface SyncTaskScheduleDispatchPayload {
  tenantId?: number;
  limit?: number;
  dryRun?: boolean;
}

export interface SyncExecutionPolicyQueryParams {
  tenantId?: number;
  projectId?: number;
  scopeType?: string;
  scopeKey?: string;
  datasourceId?: number;
  connectorType?: string;
  connectorRole?: string;
  syncTaskId?: number;
  enabled?: boolean;
  current?: number;
  size?: number;
}

/**
 * 管理员执行策略创建/更新载荷。
 *
 * 字段留空表示继承更低优先级策略，而不是把配置重置为 0。普通任务创建向导不会使用该载荷；
 * 它只服务“执行策略”管理页，运行时由后端按任务 > 项目 > 数据源/连接器 > 系统默认逐层合并。
 * CONNECTOR 作用域下 connectorType 也可以留空，表示“全部连接器”的通用读取/写入默认策略。
 */
export interface UpsertSyncExecutionPolicyPayload {
  id?: number;
  tenantId?: number;
  projectId?: number;
  scopeType: "SYSTEM" | "PROJECT" | "CONNECTOR" | "DATASOURCE" | "TASK" | string;
  scopeKey?: string;
  scopeName?: string;
  policyCode?: string;
  policyName?: string;
  enabled?: boolean;
  datasourceId?: number;
  connectorType?: string;
  connectorRole?: "SOURCE" | "TARGET" | "ANY" | string;
  syncTaskId?: number;
  targetRowsPerShard?: number;
  minShardCount?: number;
  maxShardCount?: number;
  maxChannel?: number;
  taskGroupSize?: number;
  readBatchSize?: number;
  writeBatchSize?: number;
  commitIntervalRecords?: number;
  timeoutSeconds?: number;
  maxRetryCount?: number;
  maxDirtyRecordCount?: number;
  maxDirtyRecordRatio?: number;
  priority?: number;
  description?: string;
}

export interface SyncObjectRetryPayload {
  objectExecutionIds?: number[];
  objectOrdinals?: number[];
  retryAttemptBudget?: number;
  resetAttemptCount?: boolean;
  reason?: string;
}

export interface SyncDirtyRecordReplayPayload {
  executionId: number;
  errorSampleIds?: number[];
  replayAllRetryableInExecution?: boolean;
  repairConfirmed?: boolean;
  repairStrategy?: string;
  maxSampleCount?: number;
  reason?: string;
}

export interface BindAgentToolPayload {
  toolCode: string;
  toolType?: string;
  displayName?: string;
  targetService?: string;
  targetResourceId?: number;
  readOnly?: boolean;
  allowedActions?: string[];
}

export interface CreateAgentSessionPayload {
  tenantId: number;
  projectId: number;
  workspaceId?: number;
  actorId: string;
  channel?: string;
  objective: string;
  isolationLevel?: string;
  toolBindings?: BindAgentToolPayload[];
}

export interface StartAgentRunPayload {
  userInput: string;
  workloadType?: string;
  requireHumanApproval?: boolean;
  variables?: Record<string, unknown>;
}

export interface CreateAgentPlanPayload {
  tenant_id?: string;
  project_id?: string;
  actor_id?: string;
  tenantId?: string | number;
  projectId?: string | number;
  actorId?: string | number;
  objective: string;
  variables?: Record<string, unknown>;
  preferred_workload?: string;
  preferredWorkload?: string;
  locale?: string;
  request_id?: string;
}

export interface AgentPlanStreamProgressEvent {
  eventType: string;
  stage: string;
  message: string;
  severity: string;
  requestId?: string;
  runId?: string;
  sessionId?: string;
  sequence?: number;
  attributes?: Record<string, unknown>;
  createdAt?: string;
}

export interface AgentPlanStreamFrame {
  type: "accepted" | "progress" | "heartbeat" | "result" | "cancelled" | "error" | string;
  requestId?: string;
  elapsedMs?: number;
  event?: AgentPlanStreamProgressEvent;
  data?: unknown;
  reason?: string;
  message?: string;
  error?: {
    code?: string;
    message?: string;
    errorType?: string;
    recoverable?: boolean;
    suggestions?: string[];
  };
}

export interface AgentPlanCancellationResponse {
  requestId: string;
  state: "ACTIVE" | "CANCELLED" | "COMPLETED" | "NOT_FOUND" | string;
  cancelled: boolean;
  reason?: string;
}

export interface AgentRagQueryPayload {
  tenantId?: string | number;
  projectId?: string | number;
  actorId?: string | number;
  workspaceKey?: string;
  question: string;
  topK?: number;
  candidateLimit?: number;
  maxContextChars?: number;
  generateAnswer?: boolean;
  traceId?: string;
  sessionId?: string;
}

export interface ConfirmAgentRunPayload {
  confirmed: true;
  comment?: string;
  /** Stable retry key for one durable Run confirmation boundary. */
  idempotencyKey?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPage<T>(value: unknown): value is PlatformPageResponse<T> {
  return isRecord(value) && Array.isArray(value.records);
}

function readString(value: unknown, fallback = "") {
  return value == null ? fallback : String(value);
}

function readNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function readBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Read an optional boolean without collapsing an absent value into `false`.
 *
 * Agent mapping snapshots use optional flags such as `syncEnabled` and
 * `typeCompatible`.  Treating a missing flag as `false` would disable a valid
 * source field during historical recovery, while treating the string "false"
 * as truthy would be equally unsafe.  This helper keeps all three states:
 * true, false, and not supplied.
 */
function readOptionalBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
}

function readOptionalNumber(value: unknown) {
  if (value == null || value === "") {
    return undefined;
  }
  const parsed = readNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => readString(item)).filter(Boolean) : [];
}

function readActionArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => readString(item).trim().toUpperCase()).filter(Boolean);
  }
  return readString(value)
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

function readOptionalString(value: unknown) {
  const text = readString(value).trim();
  return text || undefined;
}

function readRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

/**
 * 从多个兼容字段中读取第一个 JSON 对象。
 *
 * Agent Runtime 在不同版本中同时存在 camelCase 和 snake_case DTO；如果每个
 * 页面都自行判断字段名，很容易出现计划详情、历史回放和流式结果三处行为不一致。
 * 归一化层统一处理别名，并且只接受真正的对象，避免把字符串或数组误当成快照。
 */
function readFirstRecord(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (isRecord(value)) return value;
  }
  return {};
}

/**
 * 从多个兼容字段中读取第一个数组。
 *
 * 数组字段缺失时返回空数组，调用方可以安全地继续做 map/filter；这里不把
 * 非数组值强行转换为数组，以免把错误响应伪装成“有一个 specialist 结果”。
 */
function readFirstArray(record: Record<string, unknown>, ...keys: string[]) {
  let emptyArray: unknown[] | undefined;
  for (const key of keys) {
    const value = record[key];
    if (!Array.isArray(value)) continue;
    // A gateway can temporarily serialize both field versions while only the
    // legacy one is populated. Prefer the non-empty data-bearing alias but
    // still preserve an intentionally empty array when no alias has entries.
    if (value.length > 0) return value;
    emptyArray ??= value;
  }
  return emptyArray ?? [];
}

/**
 * Read the first non-null field from aliases without imposing a JSON shape.
 *
 * The API normalizer normally needs an object or array and can use the helpers
 * above.  Nested mapping flags may be strings, booleans, or names, so their
 * compatibility layer needs to preserve the raw value until the target type is
 * known.  `false` and `0` must stay visible and therefore cannot use `||`.
 */
function readFirstDefinedValue(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function normalizePage<T>(
  value: unknown,
  fallbackRecords: T[],
  mapper: (value: unknown, index: number) => T = (item) => item as T,
): PlatformPageResponse<T> {
  if (isPage<T>(value)) {
    return {
      ...value,
      records: value.records.map(mapper),
    };
  }
  if (Array.isArray(value)) {
    return pageOf(value.map(mapper));
  }
  return pageOf(fallbackRecords);
}

function normalizeArray<T>(
  value: unknown,
  fallbackRecords: T[],
  mapper: (value: unknown, index: number) => T = (item) => item as T,
): T[] {
  if (Array.isArray(value)) {
    return value.map(mapper);
  }
  if (isPage<T>(value)) {
    return value.records.map(mapper);
  }
  return fallbackRecords;
}

function normalizeHealth(value: unknown): PlatformHealth {
  const status = readString(value, "UNKNOWN").toUpperCase();
  return status === "UP" || status === "DEGRADED" || status === "DOWN" ? status : "UNKNOWN";
}

function normalizeRisk(value: unknown): RiskLevel {
  const risk = readString(value, "LOW").toUpperCase();
  return risk === "LOW" || risk === "MEDIUM" || risk === "HIGH" || risk === "CRITICAL" ? risk : "LOW";
}

function normalizeDatasourceType(value: unknown) {
  const type = readString(value, "API").toUpperCase();
  const typeMap: Record<string, string> = {
    MYSQL: "MySQL",
    POSTGRESQL: "PostgreSQL",
    POSTGRES: "PostgreSQL",
    KAFKA: "Kafka",
    MONGODB: "MongoDB",
    MINIO: "MinIO",
    API: "API",
    SQLSERVER: "SQLServer",
    ORACLE: "Oracle",
  };
  return typeMap[type] ?? type;
}

function normalizeDatasourceStatus(value: unknown): DataSourceRecord["status"] {
  const status = readString(value, "DISABLED").toUpperCase();
  if (status === "ACTIVE" || status === "ENABLED") {
    return "ENABLED";
  }
  if (status === "TESTING") {
    return "TESTING";
  }
  if (status === "ERROR" || status === "FAILED") {
    return "ERROR";
  }
  return "DISABLED";
}

function normalizeConnectionHealth(value: unknown, status: DataSourceRecord["status"]): PlatformHealth {
  const lastTestStatus = readString(value).toUpperCase();
  if (["SUCCESS", "PASSED", "UP", "OK"].includes(lastTestStatus)) {
    return "UP";
  }
  if (["FAILED", "DOWN", "ERROR"].includes(lastTestStatus)) {
    return "DOWN";
  }
  return status === "ERROR" ? "DOWN" : "UNKNOWN";
}

function normalizeDataSourceUsageRole(value: unknown): DataSourceRecord["usageRole"] {
  const role = readString(value, "SOURCE").toUpperCase();
  if (role === "SOURCE" || role === "TARGET") {
    return role;
  }
  return "SOURCE";
}

function inferDataSourceUsageRole(record: Record<string, unknown>): DataSourceRecord["usageRole"] {
  const explicitRole = record.usageRole ?? record.usagePurpose ?? record.usage_purpose ?? record.purpose ?? record.role;
  if (explicitRole != null && explicitRole !== "") {
    return normalizeDataSourceUsageRole(explicitRole);
  }

  const hint = `${readString(record.name)} ${readString(record.description)}`.toLowerCase();
  if (hint.includes("target") || hint.includes("目标端") || hint.includes("目标")) {
    return "TARGET";
  }
  return "SOURCE";
}

function normalizeDataSource(value: unknown, index: number): DataSourceRecord {
  const record = isRecord(value) ? value : {};
  const id = readNumber(record.id, index + 1);
  const status = normalizeDatasourceStatus(record.status);
  return {
    id,
    tenantId: readOptionalNumber(record.tenantId),
    projectId: readOptionalNumber(record.projectId),
    workspaceId: readOptionalNumber(record.workspaceId),
    ownerId: readOptionalNumber(record.ownerId),
    createdBy: readOptionalNumber(record.createdBy),
    projectName: readOptionalString(record.projectName),
    ownerName: readOptionalString(record.ownerName),
    effectiveActions: readActionArray(record.effectiveActions ?? record.authorizedActions ?? record.allowedActions),
    name: readString(record.name, `datasource-${id}`),
    type: normalizeDatasourceType(record.type),
    jdbcUrl: readString(record.jdbcUrl),
    username: readString(record.username),
    description: readString(record.description),
    environment: "DEV",
    owner: readString(record.ownerName ?? record.owner, readOptionalNumber(record.ownerId) == null ? "未标注所有者" : `Actor ${readNumber(record.ownerId)}`),
    usageRole: inferDataSourceUsageRole(record),
    status,
    sensitivity: "LOW",
    tableCount: 0,
    lastSyncAt: readString(record.lastTestTime ?? record.updateTime ?? record.createTime, ""),
    connectionHealth: normalizeConnectionHealth(record.lastTestStatus, status),
  };
}

function normalizeDataSourceAuthorization(value: unknown, index: number): DataSourceAuthorizationRecord {
  const record = isRecord(value) ? value : {};
  return {
    id: readNumber(record.id, index + 1),
    datasourceId: readNumber(record.datasourceId),
    datasourceName: readString(record.datasourceName),
    datasourceType: readString(record.datasourceType),
    tenantId: readOptionalNumber(record.tenantId),
    projectId: readOptionalNumber(record.projectId),
    subjectType: readString(record.subjectType, "USER"),
    subjectId: readString(record.subjectId),
    subjectName: readString(record.subjectName),
    subjectRole: readString(record.subjectRole),
    authorizedActions: readString(record.authorizedActions),
    grantSource: readString(record.grantSource),
    status: readString(record.status),
    grantReason: readString(record.grantReason),
    expireTime: readString(record.expireTime),
    grantedByActorId: readString(record.grantedByActorId),
    grantedByActorRole: readString(record.grantedByActorRole),
    grantedTime: readString(record.grantedTime),
    revokedByActorId: readString(record.revokedByActorId),
    revokedByActorRole: readString(record.revokedByActorRole),
    revokeReason: readString(record.revokeReason),
    revokedTime: readString(record.revokedTime),
    createTime: readString(record.createTime),
    updateTime: readString(record.updateTime),
  };
}

function normalizeAuthorizationSubjectCandidate(value: unknown, index: number): AuthorizationSubjectCandidate {
  const record = isRecord(value) ? value : {};
  const subjectType = readString(record.subjectType, "USER");
  const subjectId = readString(record.subjectId, `candidate-${index + 1}`);
  return {
    subjectType,
    subjectId,
    subjectName: readString(record.subjectName ?? record.displayName ?? record.username, subjectId),
    subjectRole: readString(record.subjectRole),
    actorType: readString(record.actorType),
    tenantId: readOptionalNumber(record.tenantId),
    projectId: readOptionalNumber(record.projectId),
    username: readString(record.username),
    maskedEmail: readString(record.maskedEmail),
    status: readString(record.status),
    sourceType: readString(record.sourceType),
    selectable: readBoolean(record.selectable, true),
    disabledReason: readString(record.disabledReason),
  };
}

function normalizeTaskStatus(value: unknown): LifecycleStatus {
  const status = readString(value, "DRAFT").toUpperCase();
  const knownStatuses: LifecycleStatus[] = [
    "DRAFT",
    "PENDING",
    "PENDING_REVIEW",
    "SCHEDULED",
    "RUNNING",
    "PAUSED",
    "DEFERRED",
    "SUCCEEDED",
    "PARTIAL_SUCCEEDED",
    "FAILED",
    "DEAD_LETTER",
    "CANCELLED",
    "ARCHIVED",
  ];
  return knownStatuses.includes(status as LifecycleStatus) ? (status as LifecycleStatus) : "DRAFT";
}

function normalizeTaskPriority(value: unknown): GovernanceTask["priority"] {
  const priority = readString(value, "MEDIUM").toUpperCase();
  return priority === "LOW" ||
    priority === "MEDIUM" ||
    priority === "NORMAL" ||
    priority === "HIGH" ||
    priority === "URGENT"
    ? priority
    : "MEDIUM";
}

function normalizeTask(value: unknown, index: number): GovernanceTask {
  const record = isRecord(value) ? value : {};
  const id = readNumber(record.id, index + 1);
  return {
    id,
    taskCode: readString(record.taskCode ?? record.creationIdempotencyKey, `TASK-${id}`),
    name: readString(record.name, `治理任务 ${id}`),
    type: readString(record.type, "TASK"),
    status: normalizeTaskStatus(record.status),
    priority: normalizeTaskPriority(record.priority),
    owner: record.ownerId == null ? "-" : `Actor ${readString(record.ownerId)}`,
    progress: Math.max(0, Math.min(100, readNumber(record.progress, 0))),
    retryCount: readNumber(record.retryCount, 0),
    nextFireAt: record.queuedTime == null ? undefined : readString(record.queuedTime),
    updatedAt: readString(record.updateTime ?? record.createTime, ""),
  };
}

function normalizeQualityStatus(value: unknown): QualityRule["status"] {
  const status = readString(value, "DISABLED").toUpperCase();
  if (status === "ACTIVE" || status === "ENABLED") {
    return "ENABLED";
  }
  if (status === "ARCHIVED") {
    return "ARCHIVED";
  }
  return "DISABLED";
}

function normalizeQualityRule(value: unknown, index: number): QualityRule {
  const record = isRecord(value) ? value : {};
  const id = readNumber(record.id, index + 1);
  const lastCheckStatus = readString(record.lastCheckStatus).toUpperCase();
  return {
    id,
    name: readString(record.name, `质量规则 ${id}`),
    datasourceName: record.dataSourceId == null ? "未绑定数据源" : `数据源 ${readString(record.dataSourceId)}`,
    targetTable: readString(record.tableName ?? record.targetObject ?? record.fieldName, "-"),
    ruleType: readString(record.ruleType, "CUSTOM"),
    status: normalizeQualityStatus(record.status),
    severity: normalizeRisk(record.severity),
    passRate: lastCheckStatus === "PASSED" ? 100 : lastCheckStatus === "FAILED" ? 0 : 0,
    anomalyCount: 0,
    lastRunAt: readString(record.lastCheckTime ?? record.updateTime ?? record.createTime, ""),
  };
}

function normalizeQualityReport(value: unknown, index: number): QualityReport {
  const record = isRecord(value) ? value : {};
  const status = readString(record.checkStatus, "WARNING").toUpperCase();
  return {
    id: readString(record.id, `RPT-${index + 1}`),
    ruleName: readString(record.ruleName, `规则 ${readString(record.ruleId, "-")}`),
    score: readNumber(record.passRate, 0),
    status: status === "PASSED" ? "PASSED" : status === "FAILED" ? "FAILED" : "WARNING",
    anomalies: readNumber(record.exceptionCount, 0),
    generatedAt: readString(record.createTime, ""),
  };
}

function normalizeSyncTaskDefinition(value: unknown, index: number): SyncTaskDefinition {
  const record = isRecord(value) ? value : {};
  const id = readNumber(record.id, index + 1);
  return {
    id,
    tenantId: readOptionalNumber(record.tenantId),
    projectId: readOptionalNumber(record.projectId),
    workspaceId: readOptionalNumber(record.workspaceId),
    name: readString(record.name, `sync-task-definition-${id}`),
    description: readString(record.description),
    sourceDatasourceId: readNumber(record.sourceDatasourceId),
    targetDatasourceId: readNumber(record.targetDatasourceId),
    sourceSchemaName: readString(record.sourceSchemaName),
    sourceObjectName: readString(record.sourceObjectName),
    targetSchemaName: readString(record.targetSchemaName),
    targetObjectName: readString(record.targetObjectName),
    sourceConnectorType: readString(record.sourceConnectorType),
    targetConnectorType: readString(record.targetConnectorType),
    syncMode: readString(record.syncMode, "FULL"),
    syncScopeType: readString(record.syncScopeType),
    writeStrategy: readString(record.writeStrategy, "INSERT"),
    primaryKeyField: readString(record.primaryKeyField),
    incrementalField: readString(record.incrementalField),
    fieldMappingConfig: readString(record.fieldMappingConfig),
    objectMappingConfig: readString(record.objectMappingConfig),
    customSqlConfig: readString(record.customSqlConfig),
    filterConfig: readString(record.filterConfig),
    partitionConfig: readString(record.partitionConfig),
    retryPolicy: readString(record.retryPolicy),
    timeoutPolicy: readString(record.timeoutPolicy),
    enabled: readBoolean(record.enabled, true),
    createdBy: readOptionalNumber(record.createdBy),
    updatedBy: readOptionalNumber(record.updatedBy),
    createTime: readString(record.createTime),
    updateTime: readString(record.updateTime),
  };
}

function normalizeSyncTask(value: unknown, index: number): SyncTask {
  const record = isRecord(value) ? value : {};
  const id = readNumber(record.id, index + 1);
  const groupCode = readString(record.groupCode).trim() || "DEFAULT";
  const groupName = readString(record.groupName).trim() || (groupCode === "DEFAULT" ? "默认分组" : groupCode);
  return {
    id,
    tenantId: readOptionalNumber(record.tenantId),
    projectId: readOptionalNumber(record.projectId),
    workspaceId: readOptionalNumber(record.workspaceId),
    definition: isRecord(record.definition)
      ? normalizeSyncTaskDefinition(record.definition, index)
      : undefined,
    groupCode,
    groupName,
    name: readString(record.name, `sync-task-${id}`),
    currentState: readString(record.currentState, "DRAFT"),
    priority: readString(record.priority, "MEDIUM"),
    scheduleConfig: readString(record.scheduleConfig),
    scheduleEnabled: readBoolean(record.scheduleEnabled),
    nextFireTime: readString(record.nextFireTime),
    lastFireTime: readString(record.lastFireTime),
    scheduleMisfireCount: readOptionalNumber(record.scheduleMisfireCount),
    scheduleDispatchCount: readOptionalNumber(record.scheduleDispatchCount),
    scheduleVersion: readOptionalNumber(record.scheduleVersion),
    runMode: readString(record.runMode, "MANUAL"),
    triggerType: readString(record.triggerType),
    ownerId: readOptionalNumber(record.ownerId),
    lastExecutionId: readOptionalNumber(record.lastExecutionId),
    attentionRequired: readBoolean(record.attentionRequired),
    attentionReason: readString(record.attentionReason),
    description: readString(record.description),
    createTime: readString(record.createTime),
    updateTime: readString(record.updateTime),
  };
}

function normalizeSyncTaskGroupSummary(value: unknown, index: number): SyncTaskGroupSummary {
  const record = isRecord(value) ? value : {};
  const groupCode = readString(record.groupCode, `GROUP-${index + 1}`);
  return {
    treeKey: readOptionalString(record.treeKey),
    scopeType: readOptionalString(record.scopeType),
    scopeLabel: readOptionalString(record.scopeLabel),
    displayName: readOptionalString(record.displayName),
    displayPath: readOptionalString(record.displayPath),
    tenantId: readOptionalNumber(record.tenantId),
    projectId: readOptionalNumber(record.projectId),
    workspaceId: readOptionalNumber(record.workspaceId),
    groupCode,
    groupName: readString(record.groupName, groupCode),
    taskCount: readNumber(record.taskCount),
    activeTaskCount: readNumber(record.activeTaskCount),
    scheduledTaskCount: readNumber(record.scheduledTaskCount),
    runningTaskCount: readNumber(record.runningTaskCount),
    failedTaskCount: readNumber(record.failedTaskCount),
    recycledTaskCount: readNumber(record.recycledTaskCount),
    subtreeTaskCount: readOptionalNumber(record.subtreeTaskCount),
    subtreeActiveTaskCount: readOptionalNumber(record.subtreeActiveTaskCount),
    subtreeScheduledTaskCount: readOptionalNumber(record.subtreeScheduledTaskCount),
    subtreeRunningTaskCount: readOptionalNumber(record.subtreeRunningTaskCount),
    subtreeFailedTaskCount: readOptionalNumber(record.subtreeFailedTaskCount),
    subtreeRecycledTaskCount: readOptionalNumber(record.subtreeRecycledTaskCount),
    lastUpdateTime: readString(record.lastUpdateTime),
  };
}

function normalizeSyncTaskGroupTreeNode(value: unknown, index: number): SyncTaskGroupTreeNode {
  const record = isRecord(value) ? value : {};
  const groupCode = readString(record.groupCode, `GROUP-${index + 1}`);
  return {
    id: readOptionalNumber(record.id),
    treeKey: readOptionalString(record.treeKey),
    scopeType: readOptionalString(record.scopeType),
    scopeLabel: readOptionalString(record.scopeLabel),
    displayName: readOptionalString(record.displayName),
    displayPath: readOptionalString(record.displayPath),
    tenantId: readOptionalNumber(record.tenantId),
    projectId: readOptionalNumber(record.projectId),
    workspaceId: readOptionalNumber(record.workspaceId),
    parentGroupCode: readOptionalString(record.parentGroupCode),
    groupCode,
    groupName: readString(record.groupName, groupCode),
    description: readOptionalString(record.description),
    displayOrder: readOptionalNumber(record.displayOrder),
    defaultGroup: readBoolean(record.defaultGroup),
    legacyOnly: readBoolean(record.legacyOnly),
    taskCount: readNumber(record.taskCount),
    activeTaskCount: readNumber(record.activeTaskCount),
    scheduledTaskCount: readNumber(record.scheduledTaskCount),
    runningTaskCount: readNumber(record.runningTaskCount),
    failedTaskCount: readNumber(record.failedTaskCount),
    recycledTaskCount: readNumber(record.recycledTaskCount),
    subtreeTaskCount: readOptionalNumber(record.subtreeTaskCount),
    subtreeActiveTaskCount: readOptionalNumber(record.subtreeActiveTaskCount),
    subtreeScheduledTaskCount: readOptionalNumber(record.subtreeScheduledTaskCount),
    subtreeRunningTaskCount: readOptionalNumber(record.subtreeRunningTaskCount),
    subtreeFailedTaskCount: readOptionalNumber(record.subtreeFailedTaskCount),
    subtreeRecycledTaskCount: readOptionalNumber(record.subtreeRecycledTaskCount),
    lastUpdateTime: readString(record.lastUpdateTime),
    children: Array.isArray(record.children) ? record.children.map(normalizeSyncTaskGroupTreeNode) : [],
  };
}

function normalizeSyncTaskBatchOperationResult(value: unknown): SyncTaskBatchOperationResult {
  const record = readRecord(value);
  const items = Array.isArray(record.items)
    ? record.items.map((item) => {
        const row = readRecord(item);
        return {
          taskId: readOptionalNumber(row.taskId),
          resultTaskId: readOptionalNumber(row.resultTaskId),
          success: readBoolean(row.success),
          code: readString(row.code, "UNKNOWN"),
          state: readOptionalString(row.state),
          message: readOptionalString(row.message),
        };
      })
    : [];
  return {
    operationType: readString(record.operationType, "UNKNOWN"),
    status: readString(record.status, "UNKNOWN"),
    totalCount: readNumber(record.totalCount, items.length),
    successCount: readNumber(record.successCount),
    failedCount: readNumber(record.failedCount),
    skippedCount: readNumber(record.skippedCount),
    continueOnError: readBoolean(record.continueOnError, true),
    items,
  };
}

function normalizeSyncTaskImportResult(value: unknown): SyncTaskImportResult {
  const record = readRecord(value);
  const rows = Array.isArray(record.rows)
    ? record.rows.map((row, index) => {
        const item = readRecord(row);
        return {
          rowNumber: readNumber(item.rowNumber, index + 2),
          taskId: readOptionalNumber(item.taskId),
          name: readOptionalString(item.name),
          status: readString(item.status, "UNKNOWN"),
          currentState: readOptionalString(item.currentState),
          message: readOptionalString(item.message),
          errorCode: readOptionalString(item.errorCode),
          fieldName: readOptionalString(item.fieldName),
          repairable: typeof item.repairable === "boolean" ? item.repairable : undefined,
          suggestedAction: readOptionalString(item.suggestedAction),
        };
      })
    : [];
  return {
    dryRun: readBoolean(record.dryRun),
    runImmediately: readBoolean(record.runImmediately),
    totalRows: readNumber(record.totalRows),
    validRows: readNumber(record.validRows),
    createdCount: readNumber(record.createdCount),
    draftCount: readNumber(record.draftCount),
    queuedCount: readNumber(record.queuedCount),
    conflictCount: readNumber(record.conflictCount),
    failedCount: readNumber(record.failedCount),
    status: readString(record.status, "UNKNOWN"),
    message: readOptionalString(record.message),
    rows,
  };
}

function normalizeSyncTaskMetadataDiscoveryResult(value: unknown): SyncTaskMetadataDiscoveryResult {
  const record = readRecord(value);
  const tables = Array.isArray(record.tables)
    ? record.tables.map((table) => {
        const item = readRecord(table);
        const fields = Array.isArray(item.fields)
          ? item.fields.map((field) => {
              const column = readRecord(field);
              return {
                fieldName: readString(column.fieldName),
                dataTypeName: readOptionalString(column.dataTypeName),
                nullable: readBoolean(column.nullable),
                primaryKey: readBoolean(column.primaryKey),
                ordinalPosition: readOptionalNumber(column.ordinalPosition),
                syncEnabled: readBoolean(column.syncEnabled, true),
              };
            })
          : [];
        return {
          catalog: readOptionalString(item.catalog),
          schemaName: readOptionalString(item.schemaName),
          tableName: readString(item.tableName),
          tableType: readOptionalString(item.tableType),
          primaryKeys: readStringArray(item.primaryKeys),
          fields,
        };
      })
    : [];
  return {
    datasourceId: readNumber(record.datasourceId),
    side: readOptionalString(record.side),
    connectorType: readOptionalString(record.connectorType),
    filterMode: readOptionalString(record.filterMode),
    discoverable: readBoolean(record.discoverable),
    schemas: readStringArray(record.schemas),
    tables,
    warnings: readStringArray(record.warnings),
  };
}

function normalizeSyncTaskFieldMappingSuggestionResult(value: unknown): SyncTaskFieldMappingSuggestionResult {
  const record = readRecord(value);
  const mappings = Array.isArray(record.mappings)
    ? record.mappings.map((mapping) => {
        const item = readRecord(mapping);
        return {
          sourceField: readString(item.sourceField),
          sourceType: readOptionalString(item.sourceType),
          targetField: readOptionalString(item.targetField),
          targetType: readOptionalString(item.targetType),
          syncEnabled: readBoolean(item.syncEnabled, true),
          typeCompatible: readBoolean(item.typeCompatible, true),
          primaryKey: readBoolean(item.primaryKey),
          nullable: readBoolean(item.nullable),
          compatibilityNote: readOptionalString(item.compatibilityNote),
        };
      })
    : [];
  return {
    sourceDatasourceId: readNumber(record.sourceDatasourceId),
    targetDatasourceId: readNumber(record.targetDatasourceId),
    sourceConnectorType: readOptionalString(record.sourceConnectorType),
    targetConnectorType: readOptionalString(record.targetConnectorType),
    sourceTable: readOptionalString(record.sourceTable),
    targetTable: readOptionalString(record.targetTable),
    mappings,
    warnings: readStringArray(record.warnings),
  };
}

function normalizeSyncExecution(value: unknown, index: number): SyncExecution {
  const record = isRecord(value) ? value : {};
  const id = readNumber(record.id, index + 1);
  return {
    id,
    tenantId: readOptionalNumber(record.tenantId),
    projectId: readOptionalNumber(record.projectId),
    workspaceId: readOptionalNumber(record.workspaceId),
    syncTaskId: readNumber(record.syncTaskId),
    executionNo: readOptionalNumber(record.executionNo),
    executionState: readString(record.executionState, "QUEUED"),
    triggerType: readString(record.triggerType),
    queuedAt: readString(record.queuedAt),
    startedAt: readString(record.startedAt),
    finishedAt: readString(record.finishedAt),
    checkpointRef: readString(record.checkpointRef),
    recordsRead: readNumber(record.recordsRead),
    recordsWritten: readNumber(record.recordsWritten),
    failedRecordCount: readNumber(record.failedRecordCount),
    errorSummary: readString(record.errorSummary),
    triggeredBy: readOptionalNumber(record.triggeredBy),
    executorId: readString(record.executorId),
    heartbeatTime: readString(record.heartbeatTime),
    leaseExpireTime: readString(record.leaseExpireTime),
    deferCount: readNumber(record.deferCount),
    createTime: readString(record.createTime),
    updateTime: readString(record.updateTime),
  };
}

function normalizeSyncExecutionLog(value: unknown, index: number): SyncExecutionLog {
  const record = isRecord(value) ? value : {};
  return {
    id: readNumber(record.id, index + 1),
    tenantId: readOptionalNumber(record.tenantId),
    projectId: readOptionalNumber(record.projectId),
    workspaceId: readOptionalNumber(record.workspaceId),
    syncTaskId: readNumber(record.syncTaskId),
    executionId: readNumber(record.executionId),
    logStage: readString(record.logStage),
    logLevel: readString(record.logLevel),
    eventType: readString(record.eventType),
    eventStatus: readString(record.eventStatus),
    message: readString(record.message),
    detailSummary: readString(record.detailSummary),
    executorId: readString(record.executorId),
    workUnitType: readString(record.workUnitType),
    objectExecutionId: readOptionalNumber(record.objectExecutionId),
    objectOrdinal: readOptionalNumber(record.objectOrdinal),
    shardOrPartition: readString(record.shardOrPartition),
    recordsRead: readOptionalNumber(record.recordsRead),
    recordsWritten: readOptionalNumber(record.recordsWritten),
    failedRecordCount: readOptionalNumber(record.failedRecordCount),
    completedWorkUnits: readOptionalNumber(record.completedWorkUnits),
    succeededWorkUnits: readOptionalNumber(record.succeededWorkUnits),
    failedWorkUnits: readOptionalNumber(record.failedWorkUnits),
    progressPercent: readOptionalNumber(record.progressPercent),
    speedRowsPerSecond: readOptionalNumber(record.speedRowsPerSecond),
    eventTime: readString(record.eventTime),
    traceId: readString(record.traceId),
    payloadPolicy: readString(record.payloadPolicy),
    createTime: readString(record.createTime),
  };
}

function normalizeSyncExecutionPolicy(value: unknown, index: number): SyncExecutionPolicy {
  const record = isRecord(value) ? value : {};
  return {
    id: readNumber(record.id, index + 1),
    tenantId: readOptionalNumber(record.tenantId),
    projectId: readOptionalNumber(record.projectId),
    scopeType: readString(record.scopeType, "SYSTEM"),
    scopeKey: readOptionalString(record.scopeKey),
    scopeName: readOptionalString(record.scopeName),
    policyCode: readOptionalString(record.policyCode),
    policyName: readOptionalString(record.policyName),
    enabled: readBoolean(record.enabled, true),
    datasourceId: readOptionalNumber(record.datasourceId),
    connectorType: readOptionalString(record.connectorType),
    connectorRole: readOptionalString(record.connectorRole),
    syncTaskId: readOptionalNumber(record.syncTaskId),
    targetRowsPerShard: readOptionalNumber(record.targetRowsPerShard),
    minShardCount: readOptionalNumber(record.minShardCount),
    maxShardCount: readOptionalNumber(record.maxShardCount),
    maxChannel: readOptionalNumber(record.maxChannel),
    taskGroupSize: readOptionalNumber(record.taskGroupSize),
    readBatchSize: readOptionalNumber(record.readBatchSize),
    writeBatchSize: readOptionalNumber(record.writeBatchSize),
    commitIntervalRecords: readOptionalNumber(record.commitIntervalRecords),
    timeoutSeconds: readOptionalNumber(record.timeoutSeconds),
    maxRetryCount: readOptionalNumber(record.maxRetryCount),
    maxDirtyRecordCount: readOptionalNumber(record.maxDirtyRecordCount),
    maxDirtyRecordRatio: readOptionalNumber(record.maxDirtyRecordRatio),
    priority: readOptionalNumber(record.priority),
    description: readOptionalString(record.description),
    createTime: readOptionalString(record.createTime),
    updateTime: readOptionalString(record.updateTime),
  };
}

function normalizeSyncExecutionPolicySnapshot(value: unknown): SyncExecutionPolicySnapshot {
  const record = isRecord(value) ? value : {};
  return {
    id: readNumber(record.id),
    tenantId: readOptionalNumber(record.tenantId),
    projectId: readOptionalNumber(record.projectId),
    syncTaskId: readNumber(record.syncTaskId),
    executionId: readNumber(record.executionId),
    policyCodeSummary: readOptionalString(record.policyCodeSummary),
    matchedPolicyCodes: readStringArray(record.matchedPolicyCodes),
    resolutionOrder: readOptionalString(record.resolutionOrder),
    targetRowsPerShard: readOptionalNumber(record.targetRowsPerShard),
    resolvedShardCount: readOptionalNumber(record.resolvedShardCount),
    resolvedChannel: readOptionalNumber(record.resolvedChannel),
    taskGroupSize: readOptionalNumber(record.taskGroupSize),
    readBatchSize: readOptionalNumber(record.readBatchSize),
    writeBatchSize: readOptionalNumber(record.writeBatchSize),
    commitIntervalRecords: readOptionalNumber(record.commitIntervalRecords),
    timeoutSeconds: readOptionalNumber(record.timeoutSeconds),
    maxRetryCount: readOptionalNumber(record.maxRetryCount),
    maxDirtyRecordCount: readOptionalNumber(record.maxDirtyRecordCount),
    maxDirtyRecordRatio: readOptionalNumber(record.maxDirtyRecordRatio),
    payloadPolicy: readOptionalString(record.payloadPolicy),
    snapshotJson: readOptionalString(record.snapshotJson),
    createTime: readOptionalString(record.createTime),
    updateTime: readOptionalString(record.updateTime),
  };
}

function normalizeSyncObjectExecution(value: unknown, index: number): SyncObjectExecution {
  const record = isRecord(value) ? value : {};
  return {
    id: readNumber(record.id, index + 1),
    tenantId: readOptionalNumber(record.tenantId),
    projectId: readOptionalNumber(record.projectId),
    workspaceId: readOptionalNumber(record.workspaceId),
    syncTaskId: readNumber(record.syncTaskId),
    executionId: readNumber(record.executionId),
    objectOrdinal: readOptionalNumber(record.objectOrdinal),
    workUnitType: readString(record.workUnitType),
    shardOrPartition: readString(record.shardOrPartition),
    partitionStrategy: readString(record.partitionStrategy),
    partitionField: readString(record.partitionField),
    sourceSchemaName: readString(record.sourceSchemaName),
    sourceObjectName: readString(record.sourceObjectName),
    targetSchemaName: readString(record.targetSchemaName),
    targetObjectName: readString(record.targetObjectName),
    objectState: readString(record.objectState, "UNKNOWN"),
    attemptCount: readOptionalNumber(record.attemptCount),
    maxAttemptCount: readOptionalNumber(record.maxAttemptCount),
    recordsRead: readNumber(record.recordsRead),
    recordsWritten: readNumber(record.recordsWritten),
    failedRecordCount: readNumber(record.failedRecordCount),
    lastErrorType: readString(record.lastErrorType),
    lastErrorCode: readString(record.lastErrorCode),
    lastErrorMessage: readString(record.lastErrorMessage),
    startedAt: readString(record.startedAt),
    finishedAt: readString(record.finishedAt),
    payloadPolicy: readString(record.payloadPolicy),
    createTime: readString(record.createTime),
    updateTime: readString(record.updateTime),
  };
}

function normalizeSyncErrorSample(value: unknown, index: number): SyncErrorSample {
  const record = isRecord(value) ? value : {};
  return {
    id: readNumber(record.id, index + 1),
    tenantId: readOptionalNumber(record.tenantId),
    projectId: readOptionalNumber(record.projectId),
    workspaceId: readOptionalNumber(record.workspaceId),
    syncTaskId: readNumber(record.syncTaskId),
    executionId: readNumber(record.executionId),
    errorType: readString(record.errorType),
    errorCode: readString(record.errorCode),
    errorMessage: readString(record.errorMessage),
    sourceRecordKey: readString(record.sourceRecordKey),
    targetRecordKey: readString(record.targetRecordKey),
    samplePayload: readString(record.samplePayload),
    retryable: readBoolean(record.retryable),
    createTime: readString(record.createTime),
  };
}

function normalizeSyncCheckpoint(value: unknown, index: number): SyncCheckpoint {
  const record = isRecord(value) ? value : {};
  return {
    id: readNumber(record.id, index + 1),
    tenantId: readOptionalNumber(record.tenantId),
    projectId: readOptionalNumber(record.projectId),
    workspaceId: readOptionalNumber(record.workspaceId),
    syncTaskId: readNumber(record.syncTaskId),
    executionId: readOptionalNumber(record.executionId),
    checkpointType: readString(record.checkpointType),
    checkpointValue: readString(record.checkpointValue),
    shardOrPartition: readString(record.shardOrPartition),
    recordsRead: readOptionalNumber(record.recordsRead),
    recordsWritten: readOptionalNumber(record.recordsWritten),
    checkpointTime: readString(record.checkpointTime),
    createTime: readString(record.createTime),
    updateTime: readString(record.updateTime),
  };
}

function normalizeSyncAuditRecord(value: unknown, index: number): SyncAuditRecord {
  const record = isRecord(value) ? value : {};
  return {
    id: readNumber(record.id, index + 1),
    tenantId: readOptionalNumber(record.tenantId),
    projectId: readOptionalNumber(record.projectId),
    workspaceId: readOptionalNumber(record.workspaceId),
    syncTaskId: readOptionalNumber(record.syncTaskId),
    executionId: readOptionalNumber(record.executionId),
    actionType: readString(record.actionType),
    actorId: readOptionalNumber(record.actorId),
    actorRole: readString(record.actorRole),
    actionPayload: readString(record.actionPayload),
    result: readString(record.result),
    traceId: readString(record.traceId),
    createTime: readString(record.createTime),
  };
}

function normalizeSyncIncident(value: unknown, index: number): SyncIncident {
  const record = isRecord(value) ? value : {};
  const id = readNumber(record.id, index + 1);
  return {
    id,
    tenantId: readOptionalNumber(record.tenantId),
    projectId: readOptionalNumber(record.projectId),
    workspaceId: readOptionalNumber(record.workspaceId),
    syncTaskId: readOptionalNumber(record.syncTaskId),
    executionId: readOptionalNumber(record.executionId),
    incidentType: readString(record.incidentType, "UNKNOWN"),
    severity: readString(record.severity, "P4"),
    incidentStatus: readString(record.incidentStatus, "OPEN"),
    title: readString(record.title, `sync-incident-${id}`),
    description: readString(record.description),
    operatorId: readOptionalNumber(record.operatorId),
    assignedOperatorId: readOptionalNumber(record.assignedOperatorId),
    resolutionSummary: readString(record.resolutionSummary),
    acknowledgedAt: readString(record.acknowledgedAt),
    resolvedAt: readString(record.resolvedAt),
    closedAt: readString(record.closedAt),
    createTime: readString(record.createTime),
    updateTime: readString(record.updateTime),
  };
}

function normalizeSyncConnectorCapability(value: unknown, index: number): SyncConnectorCapability {
  const record = isRecord(value) ? value : {};
  const connectorType = readString(record.connectorType, `CONNECTOR_${index + 1}`);
  return {
    connectorType,
    displayName: readString(record.displayName, connectorType),
    supportLevel: readString(record.supportLevel, "PREPARED"),
    canRead: readBoolean(record.canRead),
    canWrite: readBoolean(record.canWrite),
    supportsMetadataDiscovery: readBoolean(record.supportsMetadataDiscovery),
    supportsSchemaDiscovery: readBoolean(record.supportsSchemaDiscovery),
    supportsFieldSampling: readBoolean(record.supportsFieldSampling),
    supportsPreview: readBoolean(record.supportsPreview),
    supportsFullSync: readBoolean(record.supportsFullSync),
    supportsIncrementalSync: readBoolean(record.supportsIncrementalSync),
    supportsStreaming: readBoolean(record.supportsStreaming),
    supportsCheckpointResume: readBoolean(record.supportsCheckpointResume),
    supportsPartitionParallelism: readBoolean(record.supportsPartitionParallelism),
    supportsFieldMapping: readBoolean(record.supportsFieldMapping),
    supportsTransformationHook: readBoolean(record.supportsTransformationHook),
    supportsDataValidation: readBoolean(record.supportsDataValidation),
    supportsAdminThrottling: readBoolean(record.supportsAdminThrottling),
    supportedModes: readStringArray(record.supportedModes),
    recommendedCheckpointTypes: readStringArray(record.recommendedCheckpointTypes),
    performanceNotes: readStringArray(record.performanceNotes),
    safetyNotes: readStringArray(record.safetyNotes),
  };
}

function normalizeSyncConnectorCompatibility(value: unknown): SyncConnectorCompatibility {
  const record = isRecord(value) ? value : {};
  return {
    sourceConnectorType: readString(record.sourceConnectorType),
    targetConnectorType: readString(record.targetConnectorType),
    syncMode: readString(record.syncMode),
    supported: readBoolean(record.supported),
    consistencyGoal: readString(record.consistencyGoal),
    checkpointRequired: readBoolean(record.checkpointRequired),
    retryPattern: readString(record.retryPattern),
    issueCodes: readStringArray(record.issueCodes),
    recommendedActions: readStringArray(record.recommendedActions),
    payloadPolicy: readString(record.payloadPolicy),
    performanceNotes: readStringArray(record.performanceNotes),
    safetyNotes: readStringArray(record.safetyNotes),
  };
}

function normalizeRoleScope(roleCode: string): PermissionRole["scope"] {
  if (roleCode.includes("PLATFORM") || roleCode === "SERVICE_ACCOUNT") {
    return "PLATFORM";
  }
  if (roleCode.includes("TENANT")) {
    return "TENANT";
  }
  return "PROJECT";
}

function normalizeRole(value: unknown, index: number): PermissionRole {
  const record = isRecord(value) ? value : {};
  const code = readString(record.code ?? record.roleCode, `ROLE_${index + 1}`);
  return {
    id: readString(record.id, `role-${index + 1}`),
    name: readString(record.name ?? record.roleName, code),
    code,
    scope: normalizeRoleScope(code),
    members: readNumber(record.members, 0),
    enabled: readBoolean(record.enabled, true),
    policyCount: readNumber(record.policyCount, 0),
  };
}

function normalizeRoutePolicy(value: unknown, index: number): RoutePolicy {
  const record = isRecord(value) ? value : {};
  return {
    id: readString(record.id, `route-policy-${index + 1}`),
    pathPattern: readString(record.pathPattern, "-"),
    resourceType: readString(record.resourceType ?? record.roleCode, "UNKNOWN"),
    defaultAction: readString(record.defaultAction ?? record.action ?? record.effect ?? record.httpMethod, "-"),
    enabled: readBoolean(record.enabled, true),
  };
}

function normalizeProject(value: unknown, index: number): ProjectRecord {
  const record = readRecord(value);
  const projectId = readNumber(record.projectId ?? record.id, index + 1);
  return {
    projectId,
    tenantId: readOptionalNumber(record.tenantId),
    tenantName: readOptionalString(record.tenantName),
    projectCode: readOptionalString(record.projectCode),
    projectName: readString(record.projectName ?? record.name, `未命名项目（ID ${projectId}）`),
    projectType: readOptionalString(record.projectType),
    status: readOptionalString(record.status),
    ownerActorId: readOptionalNumber(record.ownerActorId),
    ownerUsername: readOptionalString(record.ownerUsername),
    description: readOptionalString(record.description),
    createTime: readOptionalString(record.createTime),
    updateTime: readOptionalString(record.updateTime),
  };
}

function normalizeProjectMembership(value: unknown, index: number): ProjectMembershipRecord {
  const record = readRecord(value);
  return {
    membershipId: readNumber(record.membershipId ?? record.id, index + 1),
    tenantId: readOptionalNumber(record.tenantId),
    actorId: readNumber(record.actorId),
    identityUserId: readOptionalNumber(record.identityUserId),
    username: readOptionalString(record.username),
    email: readOptionalString(record.email),
    actorRole: readOptionalString(record.actorRole),
    actorType: readOptionalString(record.actorType),
    userStatus: readOptionalString(record.userStatus),
    projectId: readNumber(record.projectId),
    projectCode: readOptionalString(record.projectCode),
    projectName: readOptionalString(record.projectName),
    projectStatus: readOptionalString(record.projectStatus),
    projectRole: readString(record.projectRole, "READER"),
    grantSource: readOptionalString(record.grantSource),
    enabled: readBoolean(record.enabled, true),
    createTime: readOptionalString(record.createTime),
    updateTime: readOptionalString(record.updateTime),
  };
}

function normalizeProjectJoinCandidate(value: unknown, index: number): ProjectJoinCandidateRecord {
  const record = readRecord(value);
  const projectId = readNumber(record.projectId ?? record.id, index + 1);
  return {
    projectId,
    tenantId: readOptionalNumber(record.tenantId),
    projectCode: readOptionalString(record.projectCode),
    projectName: readString(record.projectName ?? record.name, `未命名项目（ID ${projectId}）`),
    projectType: readOptionalString(record.projectType),
  };
}

function normalizeProjectJoinRequest(value: unknown, index: number): ProjectJoinRequestRecord {
  const record = readRecord(value);
  return {
    id: readNumber(record.id, index + 1),
    tenantId: readOptionalNumber(record.tenantId),
    projectId: readNumber(record.projectId),
    projectCode: readOptionalString(record.projectCode),
    projectName: readOptionalString(record.projectName),
    applicantActorId: readNumber(record.applicantActorId),
    applicantName: readOptionalString(record.applicantName),
    applicantUsername: readOptionalString(record.applicantUsername),
    requestedProjectRole: readString(record.requestedProjectRole, "READER"),
    status: readString(record.status, "PENDING"),
    reviewerActorId: readOptionalNumber(record.reviewerActorId),
    reviewerUsername: readOptionalString(record.reviewerUsername),
    reviewerActorRole: readOptionalString(record.reviewerActorRole),
    reviewComment: readOptionalString(record.reviewComment),
    reviewTime: readOptionalString(record.reviewTime),
    membershipId: readOptionalNumber(record.membershipId),
    createTime: readOptionalString(record.createTime),
    updateTime: readOptionalString(record.updateTime),
  };
}

function normalizeProjectCreationRequest(value: unknown, index: number): ProjectCreationRequestRecord {
  const record = readRecord(value);
  return {
    id: readNumber(record.id, index + 1),
    tenantId: readOptionalNumber(record.tenantId),
    applicationId: readOptionalNumber(record.applicationId),
    projectCode: readOptionalString(record.projectCode),
    projectName: readString(record.projectName, `project-request-${index + 1}`),
    projectType: readOptionalString(record.projectType),
    applicantActorId: readNumber(record.applicantActorId),
    applicantName: readOptionalString(record.applicantName),
    applicantUsername: readOptionalString(record.applicantUsername),
    ownerActorId: readOptionalNumber(record.ownerActorId),
    ownerUsername: readOptionalString(record.ownerUsername),
    description: readOptionalString(record.description),
    requestReason: readOptionalString(record.requestReason),
    status: readString(record.status, "PENDING"),
    reviewerActorId: readOptionalNumber(record.reviewerActorId),
    reviewerUsername: readOptionalString(record.reviewerUsername),
    reviewerActorRole: readOptionalString(record.reviewerActorRole),
    reviewComment: readOptionalString(record.reviewComment),
    reviewTime: readOptionalString(record.reviewTime),
    createdProjectId: readOptionalNumber(record.createdProjectId),
    createTime: readOptionalString(record.createTime),
    updateTime: readOptionalString(record.updateTime),
  };
}

function normalizeApprovalCenterRecord(value: unknown, index: number): ApprovalCenterRecord {
  const record = readRecord(value);
  return {
    requestType: readString(record.requestType),
    requestId: readNumber(record.requestId, index + 1),
    tenantId: readOptionalNumber(record.tenantId),
    applicationId: readOptionalNumber(record.applicationId),
    projectId: readOptionalNumber(record.projectId),
    projectCode: readOptionalString(record.projectCode),
    projectName: readOptionalString(record.projectName),
    applicantActorId: readNumber(record.applicantActorId),
    applicantName: readOptionalString(record.applicantName),
    applicantUsername: readOptionalString(record.applicantUsername),
    ownerActorId: readOptionalNumber(record.ownerActorId),
    ownerUsername: readOptionalString(record.ownerUsername),
    requestedProjectRole: readOptionalString(record.requestedProjectRole),
    requestReason: readOptionalString(record.requestReason),
    status: readString(record.status, "PENDING"),
    reviewerActorId: readOptionalNumber(record.reviewerActorId),
    reviewerUsername: readOptionalString(record.reviewerUsername),
    reviewerActorRole: readOptionalString(record.reviewerActorRole),
    reviewComment: readOptionalString(record.reviewComment),
    reviewTime: readOptionalString(record.reviewTime),
    resultResourceId: readOptionalNumber(record.resultResourceId),
    createTime: readOptionalString(record.createTime),
    updateTime: readOptionalString(record.updateTime),
    availableActions: readActionArray(record.availableActions),
  };
}

function normalizePermissionMenu(value: unknown, index: number): PermissionMenuRecord {
  const record = readRecord(value);
  return {
    id: readNumber(record.id, index + 1),
    menuCode: readString(record.menuCode),
    parentCode: readOptionalString(record.parentCode),
    menuName: readString(record.menuName),
    path: readString(record.path),
    icon: readOptionalString(record.icon),
    sortOrder: readOptionalNumber(record.sortOrder),
    enabled: readBoolean(record.enabled, true),
    description: readOptionalString(record.description),
  };
}

function normalizePermissionTenant(value: unknown, index: number): PermissionTenantRecord {
  const record = readRecord(value);
  return {
    tenantId: readNumber(record.tenantId, index + 1),
    tenantCode: readString(record.tenantCode),
    tenantName: readString(record.tenantName),
    tenantType: readString(record.tenantType, "BUSINESS"),
    planCode: readString(record.planCode, "STANDARD"),
    status: readString(record.status, "ACTIVE"),
    ownerActorId: readOptionalNumber(record.ownerActorId),
    openedBy: readOptionalNumber(record.openedBy),
    openedAt: readOptionalString(record.openedAt),
    description: readOptionalString(record.description),
    applicationId: readOptionalNumber(record.applicationId),
    applicationCode: readOptionalString(record.applicationCode),
    applicationName: readOptionalString(record.applicationName),
    applicationStatus: readOptionalString(record.applicationStatus),
    administratorActorId: readOptionalNumber(record.administratorActorId),
    administratorUsername: readOptionalString(record.administratorUsername),
    administratorStatus: readOptionalString(record.administratorStatus),
    createTime: readOptionalString(record.createTime),
    updateTime: readOptionalString(record.updateTime),
  };
}

function normalizeAgentExecutionMode(value: unknown) {
  const mode = readString(value, "SYNC").toUpperCase();
  const modeMap: Record<string, string> = {
    ASYNC: "ASYNC",
    ASYNC_TASK: "ASYNC_TASK",
    DRAFT_ONLY: "DRAFT_ONLY",
    APPROVAL_REQUIRED: "APPROVAL_REQUIRED",
    HUMAN_APPROVAL: "HUMAN_APPROVAL",
    SYNC: "SYNC",
  };
  return modeMap[mode] ?? mode;
}

function normalizeAgentToolInputField(value: unknown, index: number): AgentToolInputField {
  const record = isRecord(value) ? value : {};
  return {
    name: readString(record.name, `field-${index + 1}`),
    type: readString(record.type, "string"),
    required: readBoolean(record.required),
    description: readOptionalString(record.description),
    example: readOptionalString(record.example),
  };
}

function normalizeAgentTool(value: unknown, index: number): AgentTool {
  const record = isRecord(value) ? value : {};
  const toolCode = readString(record.toolCode ?? record.name ?? record.toolName, `tool-${index + 1}`);
  return {
    toolCode,
    toolType: readOptionalString(record.toolType ?? record.type),
    displayName: readString(record.displayName, toolCode || `工具 ${index + 1}`),
    description: readOptionalString(record.description),
    targetService: readString(record.targetService, "-"),
    targetEndpoint: readOptionalString(record.targetEndpoint),
    riskLevel: normalizeRisk(record.riskLevel),
    executionMode: normalizeAgentExecutionMode(record.executionMode),
    enabled: readBoolean(record.enabled, false),
    readOnly: readBoolean(record.readOnly),
    requiresApproval: readBoolean(record.requiresApproval),
    idempotent: readBoolean(record.idempotent),
    timeoutMs: readOptionalNumber(record.timeoutMs),
    maxRetries: readOptionalNumber(record.maxRetries),
    allowedActions: readStringArray(record.allowedActions),
    inputSchema: Array.isArray(record.inputSchema)
      ? record.inputSchema.map(normalizeAgentToolInputField)
      : [],
  };
}

function normalizeAgentToolBinding(value: unknown, index: number): AgentToolBinding {
  const record = isRecord(value) ? value : {};
  const toolCode = readString(record.toolCode, `tool-${index + 1}`);
  return {
    bindingId: readString(record.bindingId, `binding-${index + 1}`),
    toolCode,
    toolType: readOptionalString(record.toolType),
    displayName: readString(record.displayName, toolCode),
    targetService: readString(record.targetService, "-"),
    targetEndpoint: readOptionalString(record.targetEndpoint),
    targetResourceId: readOptionalNumber(record.targetResourceId),
    readOnly: readBoolean(record.readOnly),
    riskLevel: normalizeRisk(record.riskLevel),
    executionMode: normalizeAgentExecutionMode(record.executionMode),
    requiresApproval: readBoolean(record.requiresApproval),
    idempotent: readBoolean(record.idempotent),
    status: readString(record.status, "BOUND"),
    allowedActions: readStringArray(record.allowedActions),
    createTime: readOptionalString(record.createTime),
  };
}

function normalizeAgentRun(value: unknown, index: number): AgentRun {
  const record = isRecord(value) ? value : {};
  return {
    runId: readString(record.runId ?? record.run_id, `run-${index + 1}`),
    sessionId: readString(record.sessionId ?? record.session_id),
    state: readString(record.state ?? record.status, "UNKNOWN"),
    workloadType: readOptionalString(record.workloadType ?? record.workload_type),
    userInputPreview: readOptionalString(record.userInputPreview ?? record.user_input_preview),
    dryRun: readBoolean(record.dryRun ?? record.dry_run, true),
    requireHumanApproval: readBoolean(record.requireHumanApproval ?? record.require_human_approval),
    nextActions: readStringArray(record.nextActions ?? record.next_actions),
    variables: readRecord(record.variables ?? record.run_variables),
    createTime: readOptionalString(record.createTime ?? record.create_time),
    updateTime: readOptionalString(record.updateTime ?? record.update_time),
    finishTime: readOptionalString(record.finishTime ?? record.finish_time),
    message: readOptionalString(record.message ?? record.error_message),
  };
}

/**
 * 规范化 Java Agent Runtime 的专业 Agent 低敏事实。
 *
 * 事实接口不会返回完整模型响应、工具参数或工具结果，因此这里仅做字段
 * 兼容和类型收敛，不把缺失内容补成“看起来完整”的前端对象。这样历史页
 * 才能明确区分“有完整快照”和“只有低敏事实兜底”两种来源。
 */
function normalizeAgentSpecialistTurnFact(value: unknown, index: number): AgentSpecialistTurnFact {
  const record = isRecord(value) ? value : {};
  return {
    userId: readString(record.userId ?? record.user_id),
    tenantId: readNumber(record.tenantId ?? record.tenant_id),
    applicationId: readNumber(record.applicationId ?? record.application_id),
    projectId: readNumber(record.projectId ?? record.project_id),
    sessionId: readString(record.sessionId ?? record.session_id),
    runId: readString(record.runId ?? record.run_id),
    turnId: readString(record.turnId ?? record.turn_id, `turn-fact-${index + 1}`),
    idempotencyKey: readString(record.idempotencyKey ?? record.idempotency_key),
    agentId: readString(record.agentId ?? record.agent_id, `specialist-agent-${index + 1}`),
    role: readString(record.role ?? record.agentRole ?? record.agent_role, "SPECIALIST_AGENT"),
    delegationId: readOptionalString(record.delegationId ?? record.delegation_id),
    status: readString(record.status, "UNKNOWN"),
    lowSensitiveSummary: readString(record.lowSensitiveSummary ?? record.low_sensitive_summary),
    modelInvocationId: readOptionalString(record.modelInvocationId ?? record.model_invocation_id),
    modelName: readOptionalString(record.modelName ?? record.model_name),
    toolActivitySummaryRefs: readStringArray(
      record.toolActivitySummaryRefs ?? record.tool_activity_summary_refs,
    ),
    evidenceRefs: readStringArray(record.evidenceRefs ?? record.evidence_refs),
    durationMillis: readOptionalNumber(record.durationMillis ?? record.duration_millis),
    startedAt: readOptionalString(record.startedAt ?? record.started_at),
    finishedAt: readOptionalString(record.finishedAt ?? record.finished_at),
    createdAt: readOptionalString(record.createdAt ?? record.created_at),
    updatedAt: readOptionalString(record.updatedAt ?? record.updated_at),
  };
}

/**
 * 归一化 post-bridge 资源复核结果。
 *
 * taskId/executionId 是后续跳转数据同步详情页的唯一可靠定位信息，因此这里
 * 同时接受数字和字符串，并保留 null/缺失语义，不从自然语言摘要中猜测 ID。
 */
function normalizePostBridgeVerification(value: unknown): PostBridgeVerificationSummary | undefined {
  if (!isRecord(value)) return undefined;
  const record = value;
  const taskId = record.taskId ?? record.task_id;
  const executionId = record.executionId ?? record.execution_id;
  return {
    status: readOptionalString(record.status ?? record.state),
    resourceChanged: typeof (record.resourceChanged ?? record.resource_changed) === "boolean"
      ? (record.resourceChanged ?? record.resource_changed) as boolean
      : undefined,
    resourceFingerprint: readOptionalString(record.resourceFingerprint ?? record.resource_fingerprint),
    previousResourceFingerprint: readOptionalString(
      record.previousResourceFingerprint ?? record.previous_resource_fingerprint,
    ),
    taskId: taskId == null ? undefined : typeof taskId === "number" || typeof taskId === "string" ? taskId : undefined,
    executionId: executionId == null
      ? undefined
      : typeof executionId === "number" || typeof executionId === "string" ? executionId : undefined,
    executedRoles: readStringArray(record.executedRoles ?? record.executed_roles),
    batchStatus: record.batchStatus == null && record.batch_status == null
      ? undefined
      : readOptionalString(record.batchStatus ?? record.batch_status),
    payloadPolicy: readOptionalString(record.payloadPolicy ?? record.payload_policy),
  };
}

/**
 * 归一化 specialist 批次复核结果。
 *
 * 复核结果中的 results 只允许保留后端明确标记的低敏 JSON 对象；前端不会在
 * 这里补造结果数量，也不会把缺少 results 的响应渲染成“六个 Agent 已完成”。
 */
function normalizeSpecialistVerificationExecution(
  value: unknown,
): SpecialistVerificationExecutionSummary | undefined {
  if (!isRecord(value)) return undefined;
  const results = readFirstArray(value, "results", "specialistResults", "specialist_results", "agentResults", "agent_results")
    .map(readRecord)
    .filter((item) => Object.keys(item).length > 0);
  const skippedRoles = readFirstRecord(value, "skippedRoles", "skipped_roles");
  const executionWaves = readFirstArray(value, "executionWaves", "execution_waves")
    .map((wave) => readStringArray(wave))
    .filter((wave) => wave.length > 0);
  const normalizedSkippedRoles: Record<string, string> = Object.fromEntries(
    Object.entries(skippedRoles).map(([role, reason]) => [role, readString(reason)]),
  );
  return {
    status: readOptionalString(value.status ?? value.state),
    executedCount: readOptionalNumber(value.executedCount ?? value.executed_count),
    completedCount: readOptionalNumber(value.completedCount ?? value.completed_count),
    waitingInputCount: readOptionalNumber(value.waitingInputCount ?? value.waiting_input_count),
    failedCount: readOptionalNumber(value.failedCount ?? value.failed_count),
    results: results.length ? results : undefined,
    skippedRoles: Object.keys(normalizedSkippedRoles).length ? normalizedSkippedRoles : undefined,
    executionWaves: executionWaves.length ? executionWaves : undefined,
    executionBoundary: readOptionalString(value.executionBoundary ?? value.execution_boundary),
    payloadPolicy: readOptionalString(value.payloadPolicy ?? value.payload_policy),
  };
}

/**
 * 归一化 specialist 到 Java ToolPlan 的公开桥接摘要。
 *
 * 桥接层故意只展示工具名称和参数字段名，不展示原始参数、SQL 或凭据；这里
 * 只做字段命名兼容，真正的敏感信息过滤仍由 Agent 页面组件再次执行。
 */
function normalizeSpecialistToolPlanBridge(value: unknown, index: number): SpecialistToolPlanBridgeSummary {
  const record = isRecord(value) ? value : {};
  const handoff = readFirstRecord(record, "recoveryHandoff", "recovery_handoff");
  const issues = readFirstArray(record, "issues", "bridgeIssues", "bridge_issues")
    .map((item) => {
      const issue = readRecord(item);
      return {
        code: readOptionalString(issue.code ?? issue.issueCode ?? issue.issue_code),
        message: readOptionalString(issue.message ?? issue.publicMessage ?? issue.public_message ?? issue.summary),
      };
    })
    .filter((item) => item.code || item.message);
  return {
    schemaVersion: readOptionalString(record.schemaVersion ?? record.schema_version),
    status: readOptionalString(record.status ?? record.state),
    specialistRole: readOptionalString(record.specialistRole ?? record.specialist_role ?? record.agentRole)
      ?? `SPECIALIST_AGENT_${index + 1}`,
    specialistTurnId: readOptionalString(record.specialistTurnId ?? record.specialist_turn_id),
    publicSummary: readOptionalString(record.publicSummary ?? record.public_summary ?? record.summary),
    acceptedToolPlanCount: readOptionalNumber(record.acceptedToolPlanCount ?? record.accepted_tool_plan_count),
    acceptedToolNames: readStringArray(record.acceptedToolNames ?? record.accepted_tool_names),
    visibleToolNames: readStringArray(record.visibleToolNames ?? record.visible_tool_names),
    canSubmitDurableLoop: typeof (record.canSubmitDurableLoop ?? record.can_submit_durable_loop) === "boolean"
      ? (record.canSubmitDurableLoop ?? record.can_submit_durable_loop) as boolean
      : undefined,
    toolArgumentNameSets: readFirstArray(record, "toolArgumentNameSets", "tool_argument_name_sets")
      .map((fields) => readStringArray(fields)),
    issues: issues.length ? issues : undefined,
    specialistResultFingerprint: readOptionalString(
      record.specialistResultFingerprint ?? record.specialist_result_fingerprint,
    ),
    scopeBinding: Object.keys(readFirstRecord(record, "scopeBinding", "scope_binding")).length
      ? readFirstRecord(record, "scopeBinding", "scope_binding")
      : undefined,
    recoveryHandoff: Object.keys(handoff).length ? {
      schemaVersion: readOptionalString(handoff.schemaVersion ?? handoff.schema_version),
      approvalStatus: readOptionalString(handoff.approvalStatus ?? handoff.approval_status),
      approvalFactAccepted: typeof (handoff.approvalFactAccepted ?? handoff.approval_fact_accepted) === "boolean"
        ? (handoff.approvalFactAccepted ?? handoff.approval_fact_accepted) as boolean
        : undefined,
      blueprintCount: readOptionalNumber(handoff.blueprintCount ?? handoff.blueprint_count),
      requiresJavaRehydration: typeof (handoff.requiresJavaRehydration ?? handoff.requires_java_rehydration) === "boolean"
        ? (handoff.requiresJavaRehydration ?? handoff.requires_java_rehydration) as boolean
        : undefined,
      executionBoundary: readOptionalString(handoff.executionBoundary ?? handoff.execution_boundary),
      directExecution: typeof (handoff.directExecution ?? handoff.direct_execution) === "boolean"
        ? (handoff.directExecution ?? handoff.direct_execution) as boolean
        : undefined,
      requiredApprovalBindings: readStringArray(
        handoff.requiredApprovalBindings ?? handoff.required_approval_bindings,
      ),
    } : undefined,
    payloadPolicy: readOptionalString(record.payloadPolicy ?? record.payload_policy),
  };
}

/**
 * 将后端不可信 JSON 规范化为前端稳定的 AgentSession。
 *
 * 历史数据或滚动升级期间可能缺少 delegation/messages 等新字段，因此这里统一补空集合和布尔默认值；
 * 同时只接受可识别的 USER/AGENT 角色，避免组件到处重复做空值判断。该函数只做结构兼容，不推导权限。
 */
function normalizeAgentSession(value: unknown, index: number): AgentSession {
  const record = isRecord(value) ? value : {};
  const workspaceValue = record.workspace ?? record.workspace_info;
  const workspace = isRecord(workspaceValue) ? workspaceValue : undefined;
  const rawRuns = record.runs ?? record.runList ?? record.run_list;
  const rawMessages = record.messages
    ?? record.conversationMessages
    ?? record.conversation_messages
    ?? record.messageList
    ?? record.message_list;
  const rawToolBindings = record.toolBindings ?? record.tool_bindings ?? record.bindings;
  const delegation = readFirstRecord(record, "delegation", "delegationSnapshot", "delegation_snapshot");
  return {
    sessionId: readString(record.sessionId ?? record.session_id, `session-${index + 1}`),
    agentId: readOptionalString(record.agentId ?? record.agent_id),
    tenantId: readOptionalNumber(record.tenantId ?? record.tenant_id),
    projectId: readOptionalNumber(record.projectId ?? record.project_id),
    workspaceId: readOptionalNumber(record.workspaceId ?? record.workspace_id),
    actorId: readString(record.actorId ?? record.actor_id, "-"),
    channel: readOptionalString(record.channel ?? record.session_channel),
    objective: readString(record.objective ?? record.sessionObjective ?? record.session_objective),
    state: readString(record.state ?? record.status, "UNKNOWN"),
    workspace,
    toolBindings: Array.isArray(rawToolBindings)
      ? rawToolBindings.map(normalizeAgentToolBinding)
      : [],
    runs: Array.isArray(rawRuns) ? rawRuns.map(normalizeAgentRun) : [],
    delegation: Object.keys(delegation).length ? {
      delegationId: readString(delegation.delegationId ?? delegation.delegation_id),
      agentId: readString(delegation.agentId ?? delegation.agent_id),
      userActorId: readString(delegation.userActorId ?? delegation.user_actor_id),
      tenantId: readOptionalNumber(delegation.tenantId ?? delegation.tenant_id),
      projectId: readOptionalNumber(delegation.projectId ?? delegation.project_id),
      toolCodes: readStringArray(delegation.toolCodes ?? delegation.tool_codes),
      actions: readStringArray(delegation.actions),
      resourceScopes: readStringArray(delegation.resourceScopes ?? delegation.resource_scopes),
      status: readString(delegation.status ?? delegation.state, "UNKNOWN"),
      issuedAt: readOptionalString(delegation.issuedAt ?? delegation.issued_at),
      expiresAt: readOptionalString(delegation.expiresAt ?? delegation.expires_at),
      revokedAt: readOptionalString(delegation.revokedAt ?? delegation.revoked_at),
    } : undefined,
    messages: Array.isArray(rawMessages) ? rawMessages.map((item, messageIndex) => {
      const messageRecord = isRecord(item) ? item : {};
      const role = readString(messageRecord.role ?? messageRecord.message_role, "AGENT").toUpperCase();
      return {
        messageId: readString(messageRecord.messageId ?? messageRecord.message_id, `message-${messageIndex + 1}`),
        runId: readOptionalString(messageRecord.runId ?? messageRecord.run_id),
        role: role === "USER" ? "USER" as const : "AGENT" as const,
        content: readString(messageRecord.content ?? messageRecord.message_content),
        createTime: readOptionalString(messageRecord.createTime ?? messageRecord.create_time),
        // 新旧服务端可能使用两套字段名；只有真实对象才保留，避免空对象制造无内容面板。
        specialistAgentExecution: isRecord(
          messageRecord.specialistAgentExecution
            ?? messageRecord.specialist_agent_execution
            ?? messageRecord.executionSnapshot
            ?? messageRecord.execution_snapshot,
        )
          ? readRecord(
              messageRecord.specialistAgentExecution
                ?? messageRecord.specialist_agent_execution
                ?? messageRecord.executionSnapshot
                ?? messageRecord.execution_snapshot,
            )
          : undefined,
      };
    }) : [],
    pinned: readBoolean(record.pinned ?? record.isPinned ?? record.is_pinned),
    archived: readBoolean(record.archived ?? record.isArchived ?? record.is_archived),
    archivedAt: readOptionalString(record.archivedAt ?? record.archived_at),
    lastMessageAt: readOptionalString(record.lastMessageAt ?? record.last_message_at),
    createTime: readOptionalString(record.createTime ?? record.create_time),
    updateTime: readOptionalString(record.updateTime ?? record.update_time),
  };
}

function normalizeAgentModelRoute(value: unknown, index: number): AgentModelRoute {
  const record = isRecord(value) ? value : {};
  return {
    workloadType: readString(record.workloadType, `workload-${index + 1}`),
    enabled: readBoolean(record.enabled, true),
    providerName: readString(record.providerName, "-"),
    providerType: readString(record.providerType, "-"),
    modelName: readString(record.modelName, "-"),
    endpoint: readOptionalString(record.endpoint),
    timeoutMs: readOptionalNumber(record.timeoutMs),
    capabilities: readStringArray(record.capabilities),
  };
}

function normalizeAgentToolPlan(value: unknown, index: number): AgentToolPlan {
  const record = isRecord(value) ? value : {};
  const toolName = readString(record.toolName ?? record.tool_name ?? record.name, `tool-plan-${index + 1}`);
  return {
    toolName,
    reason: readOptionalString(record.reason),
    arguments: readRecord(record.arguments),
    riskLevel: normalizeRisk(record.riskLevel ?? record.risk_level),
    executionMode: normalizeAgentExecutionMode(record.executionMode ?? record.execution_mode),
    requiresHumanApproval: readBoolean(record.requiresHumanApproval ?? record.requires_human_approval),
    parameterValidation: readRecord(record.parameterValidation ?? record.parameter_validation),
    governanceHints: readRecord(record.governanceHints ?? record.governance_hints),
  };
}

function normalizeAgentPlanCore(value: unknown): AgentPlanCore | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const rawToolPlans = value.toolPlans ?? value.tool_plans;
  return {
    requestId: readOptionalString(value.requestId ?? value.request_id),
    stateTrace: readStringArray(value.stateTrace ?? value.state_trace),
    toolPlans: Array.isArray(rawToolPlans) ? rawToolPlans.map(normalizeAgentToolPlan) : [],
    requiresHumanApproval: readBoolean(value.requiresHumanApproval ?? value.requires_human_approval),
    responseSummary: readOptionalString(value.responseSummary ?? value.response_summary),
    nextActions: readStringArray(value.nextActions ?? value.next_actions),
    modelIntentSummary: readOptionalString(value.modelIntentSummary ?? value.model_intent_summary),
  };
}

function normalizeAgentClarificationQuestion(value: unknown): AgentClarificationQuestion {
  const record = readRecord(value);
  const rawCandidates = record.candidates ?? record.datasourceCandidates ?? record.datasource_candidates;
  const candidates = Array.isArray(rawCandidates)
    ? rawCandidates.map((item) => {
        const candidate = readRecord(item);
        return {
          datasourceId: readNumber(candidate.datasourceId ?? candidate.datasource_id ?? candidate.id),
          name: readString(candidate.name ?? candidate.datasourceName ?? candidate.datasource_name),
          type: readString(candidate.type ?? candidate.datasourceType ?? candidate.datasource_type),
          usagePurpose: readOptionalString(candidate.usagePurpose ?? candidate.usage_purpose),
        };
      }).filter((item) => item.datasourceId > 0 && item.name)
    : [];
  const rawOptions = record.options ?? record.choiceOptions ?? record.choice_options;
  const options = Array.isArray(rawOptions)
    ? rawOptions.map((item) => {
        const option = readRecord(item);
        const rawValue = option.value ?? option.optionValue ?? option.option_value;
        return {
          value: typeof rawValue === "boolean" ? rawValue : readString(rawValue),
          label: readString(option.label ?? option.name),
        };
      }).filter((item) => item.label && (typeof item.value === "boolean" || item.value))
    : [];
  const preview = readFirstRecord(record, "configurationPreview", "configuration_preview", "preview");
  return {
    parameterName: readString(record.parameterName ?? record.parameter_name),
    fieldPath: readString(record.fieldPath ?? record.field_path),
    label: readString(record.label ?? record.displayLabel ?? record.display_label),
    question: readString(record.question ?? record.prompt),
    inputType: readString(record.inputType ?? record.input_type, "TEXT"),
    required: readBoolean(record.required, true),
    sensitive: readBoolean(record.sensitive),
    candidates: candidates.length ? candidates : undefined,
    options: options.length ? options : undefined,
    reasonCode: readOptionalString(record.reasonCode ?? record.reason_code),
    ambiguityType: readOptionalString(record.ambiguityType ?? record.ambiguity_type),
    requestedDatasourceType: readOptionalString(record.requestedDatasourceType ?? record.requested_datasource_type),
    allowsNaturalLanguageCorrection: readBoolean(
      record.allowsNaturalLanguageCorrection ?? record.allows_natural_language_correction,
    ),
    repairGuidance: readOptionalString(record.repairGuidance ?? record.repair_guidance),
    configurationPreview: Object.keys(preview).length ? {
      kind: readOptionalString(preview.kind ?? preview.type),
      customSqlText: readOptionalString(preview.customSqlText ?? preview.custom_sql_text),
      generatedByAgent: readBoolean(preview.generatedByAgent ?? preview.generated_by_agent),
      requiresExplicitConfirmation: readBoolean(
        preview.requiresExplicitConfirmation ?? preview.requires_explicit_confirmation,
      ),
      payloadPolicy: readOptionalString(preview.payloadPolicy ?? preview.payload_policy),
    } : undefined,
  };
}

function normalizeAgentStructuredIntent(value: unknown): AgentStructuredIntent {
  const record = readRecord(value);
  return {
    intentType: readString(record.intentType ?? record.intent_type, "GENERAL_GOVERNANCE_REQUEST"),
    domains: readStringArray(record.domains ?? record.domain_list),
    candidateTools: readStringArray(record.candidateTools ?? record.candidate_tools),
    riskTags: readStringArray(record.riskTags ?? record.risk_tags),
    confidence: readNumber(record.confidence),
    summary: readOptionalString(record.summary),
    syncMode: readOptionalString(record.syncMode ?? record.sync_mode),
    writeStrategy: readOptionalString(record.writeStrategy ?? record.write_strategy),
    sourceDatasourceSelected: readBoolean(
      record.sourceDatasourceSelected ?? record.source_datasource_selected,
    ),
    targetDatasourceSelected: readBoolean(
      record.targetDatasourceSelected ?? record.target_datasource_selected,
    ),
    objectMappingCount: readNumber(record.objectMappingCount ?? record.object_mapping_count),
  };
}

/**
 * Normalize one Agent-generated field mapping to the form-editor vocabulary.
 *
 * A task plan can be produced by either runtime and later replayed from a
 * durable JSON snapshot.  The outer conversation decoder previously kept the
 * mapping object untouched, which meant a valid `source_field` or
 * `field_mappings` response could disappear when the form read only camelCase.
 * Keeping the original keys plus canonical UI aliases is intentionally
 * backward-compatible: unknown server additions survive, while the editor
 * always receives the fields it needs to render and validate a mapping.
 */
function normalizeAgentResolvedFieldMapping(value: unknown, index: number): Record<string, unknown> {
  const record = readRecord(value);
  if (!Object.keys(record).length) return {};
  const normalized: Record<string, unknown> = { ...record };
  const textAliases: Array<[string, string[]]> = [
    ["key", ["key", "mappingKey", "mapping_key"]],
    ["sourceField", ["sourceField", "source_field", "sourceColumn", "source_column", "sourceName", "source_name"]],
    ["sourceType", ["sourceType", "source_type"]],
    ["targetField", ["targetField", "target_field", "targetColumn", "target_column", "targetName", "target_name"]],
    ["targetType", ["targetType", "target_type"]],
    ["compatibilityNote", ["compatibilityNote", "compatibility_note", "conversionSuggestion", "conversion_suggestion"]],
    ["transform", ["transform", "transformation", "expression"]],
  ];
  textAliases.forEach(([canonicalKey, aliases]) => {
    const text = readOptionalString(readFirstDefinedValue(record, ...aliases));
    if (text) normalized[canonicalKey] = text;
  });
  const booleanAliases: Array<[string, string[]]> = [
    ["nullable", ["nullable", "isNullable", "is_nullable"]],
    ["primaryKey", ["primaryKey", "primary_key", "isPrimaryKey", "is_primary_key"]],
    ["syncEnabled", ["syncEnabled", "sync_enabled", "enabled"]],
    ["typeCompatible", ["typeCompatible", "type_compatible", "compatible"]],
  ];
  booleanAliases.forEach(([canonicalKey, aliases]) => {
    const boolean = readOptionalBoolean(readFirstDefinedValue(record, ...aliases));
    if (boolean !== undefined) normalized[canonicalKey] = boolean;
  });
  if (!normalized.key) normalized.key = `agent-field-${index + 1}`;
  return normalized;
}

/**
 * Normalize a source-to-target object mapping and all of its nested fields.
 *
 * The result remains a generic JSON object because the API contract is
 * extensible, but every mapping property used by the Agent review form is
 * written under its canonical camelCase key.  This makes new requests, stream
 * responses, and historical-session replay share one mapping model instead of
 * requiring every page to reimplement the Java/Python alias matrix.
 */
function normalizeAgentResolvedObjectMapping(value: unknown, index: number): Record<string, unknown> {
  const record = readRecord(value);
  if (!Object.keys(record).length) return {};
  const normalized: Record<string, unknown> = { ...record };
  const textAliases: Array<[string, string[]]> = [
    ["objectKey", ["objectKey", "object_key", "mappingKey", "mapping_key"]],
    ["sourceTableKey", ["sourceTableKey", "source_table_key"]],
    ["targetTableKey", ["targetTableKey", "target_table_key"]],
    ["sourceSchemaName", ["sourceSchemaName", "source_schema_name", "sourceSchema", "source_schema"]],
    ["sourceObjectName", ["sourceObjectName", "source_object_name", "sourceTableName", "source_table_name", "sourceTable", "source_table"]],
    ["targetSchemaName", ["targetSchemaName", "target_schema_name", "targetSchema", "target_schema"]],
    ["targetObjectName", ["targetObjectName", "target_object_name", "targetTableName", "target_table_name", "targetTable", "target_table"]],
    ["whereCondition", ["whereCondition", "where_condition", "whereClause", "where_clause", "filterCondition", "filter_condition", "where"]],
  ];
  textAliases.forEach(([canonicalKey, aliases]) => {
    const text = readOptionalString(readFirstDefinedValue(record, ...aliases));
    if (text) normalized[canonicalKey] = text;
  });
  const rawFieldMappings = readFirstArray(record, "fieldMappings", "field_mappings", "fields", "columns");
  normalized.fieldMappings = rawFieldMappings
    .map((item, fieldIndex) => normalizeAgentResolvedFieldMapping(item, fieldIndex))
    .filter((item) => Object.keys(item).length > 0);
  if (!normalized.objectKey) normalized.objectKey = `agent-mapping-${index + 1}`;
  return normalized;
}

function normalizeAgentConversation(value: unknown): AgentConversation | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const resolved = readFirstRecord(value, "resolvedConfiguration", "resolved_configuration", "configuration");
  const resolvedMappings = readFirstArray(resolved, "objectMappings", "object_mappings")
    .map((item, index) => normalizeAgentResolvedObjectMapping(item, index))
    .filter((item) => Object.keys(item).length > 0);
  const rawClarificationQuestions = value.clarificationQuestions ?? value.clarification_questions;
  return {
    schemaVersion: readString(value.schemaVersion ?? value.schema_version, "1.0"),
    turnId: readOptionalString(value.turnId ?? value.turn_id),
    phase: readString(value.phase ?? value.conversationPhase ?? value.conversation_phase, "NO_EXECUTABLE_PLAN"),
    assistantMessage: readString(value.assistantMessage ?? value.assistant_message),
    structuredIntent: normalizeAgentStructuredIntent(
      value.structuredIntent ?? value.structured_intent ?? value.intent,
    ),
    resolvedConfiguration: {
      taskName: readOptionalString(resolved.taskName ?? resolved.task_name),
      syncMode: readOptionalString(resolved.syncMode ?? resolved.sync_mode),
      writeStrategy: readOptionalString(resolved.writeStrategy ?? resolved.write_strategy),
      sourceDatasourceId: readOptionalNumber(resolved.sourceDatasourceId ?? resolved.source_datasource_id),
      sourceDatasourceName: readOptionalString(resolved.sourceDatasourceName ?? resolved.source_datasource_name),
      targetDatasourceId: readOptionalNumber(resolved.targetDatasourceId ?? resolved.target_datasource_id),
      targetDatasourceName: readOptionalString(resolved.targetDatasourceName ?? resolved.target_datasource_name),
      scheduleConfig: readOptionalString(resolved.scheduleConfig ?? resolved.schedule_config),
      customSqlText: readOptionalString(resolved.customSqlText ?? resolved.custom_sql_text),
      customSqlConfirmed: resolved.customSqlConfirmed === undefined && resolved.custom_sql_confirmed === undefined
        ? undefined
        : readBoolean(resolved.customSqlConfirmed ?? resolved.custom_sql_confirmed),
      targetTableResolution: readOptionalString(resolved.targetTableResolution ?? resolved.target_table_resolution),
      objectMappings: resolvedMappings,
      objectMappingSource: readOptionalString(resolved.objectMappingSource ?? resolved.object_mapping_source),
      fieldMappingSource: readOptionalString(resolved.fieldMappingSource ?? resolved.field_mapping_source),
      mappingDefaultsConfirmed: resolved.mappingDefaultsConfirmed === undefined
        && resolved.mapping_defaults_confirmed === undefined
        ? undefined
        : readBoolean(resolved.mappingDefaultsConfirmed ?? resolved.mapping_defaults_confirmed),
      autoFilledFields: readStringArray(resolved.autoFilledFields ?? resolved.auto_filled_fields),
      payloadPolicy: readOptionalString(resolved.payloadPolicy ?? resolved.payload_policy),
    },
    missingParameters: readStringArray(value.missingParameters ?? value.missing_parameters),
    clarificationQuestions: Array.isArray(rawClarificationQuestions)
      ? rawClarificationQuestions.map(normalizeAgentClarificationQuestion)
      : [],
    canExecute: readBoolean(value.canExecute ?? value.can_execute),
    controlPlaneIngested: readBoolean(value.controlPlaneIngested ?? value.control_plane_ingested),
    nextAction: readString(value.nextAction ?? value.next_action),
    intentResolver: readFirstRecord(value, "intentResolver", "intent_resolver"),
    payloadPolicy: readOptionalString(value.payloadPolicy ?? value.payload_policy),
  };
}

function normalizeAgentObservationTimeline(value: unknown): AgentObservationTimeline | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const rawItems = readFirstArray(value, "items", "timelineItems", "timeline_items", "observations");
  const items = rawItems.map((item, index) => {
    const record = readRecord(item);
    return {
      id: readString(record.id ?? record.observationId ?? record.observation_id, `observation-${index + 1}`),
      category: readString(record.category ?? record.eventCategory ?? record.event_category, "GRAPH"),
      stage: readString(record.stage ?? record.phase),
      status: readString(record.status ?? record.state, "UNKNOWN"),
      title: readString(record.title ?? record.displayTitle ?? record.display_title, `观察项 ${index + 1}`),
      summary: readString(record.summary ?? record.message),
      details: readFirstRecord(record, "details", "attributes", "publicDetails", "public_details"),
    };
  });
  return {
    schemaVersion: readString(value.schemaVersion ?? value.schema_version, "datasmart.agent-observation-timeline.v1"),
    payloadPolicy: readOptionalString(value.payloadPolicy ?? value.payload_policy),
    requestId: readOptionalString(value.requestId ?? value.request_id),
    itemCount: readNumber(value.itemCount ?? value.item_count, items.length),
    items,
    hiddenByDesign: readStringArray(value.hiddenByDesign ?? value.hidden_by_design),
  };
}

function normalizeAgentPlanResponse(value: unknown): AgentPlanResponse {
  const record = readRecord(value);
  /* 统一兼容计划聚合接口的两套字段命名，避免 specialist 生命周期在页面丢失。 */
  const planValue = record.plan ?? record.agentPlan ?? record.agent_plan;
  const durableLoop = readFirstRecord(
    record,
    "agentDurableModelToolLoop",
    "agent_durable_model_tool_loop",
    "durableModelToolLoop",
    "durable_model_tool_loop",
  );
  const durableTurns = readFirstArray(durableLoop, "turns", "loopTurns", "loop_turns")
    .map((item) => {
        const turn = readRecord(item);
        return {
          turnIndex: readNumber(turn.turnIndex ?? turn.turn_index),
          requestId: readString(turn.requestId ?? turn.request_id),
          sessionId: readOptionalString(turn.sessionId ?? turn.session_id),
          runId: readOptionalString(turn.runId ?? turn.run_id),
          submittedToolNames: readStringArray(turn.submittedToolNames ?? turn.submitted_tool_names),
          ingestionSucceeded: readBoolean(turn.ingestionSucceeded ?? turn.ingestion_succeeded),
          feedbackStatusCounts: Object.fromEntries(
            Object.entries(readFirstRecord(turn, "feedbackStatusCounts", "feedback_status_counts"))
              .map(([key, count]) => [key, readNumber(count)]),
          ),
          loopAction: readOptionalString(turn.loopAction ?? turn.loop_action),
          modelExecuted: readBoolean(turn.modelExecuted ?? turn.model_executed),
          nextToolNames: readStringArray(turn.nextToolNames ?? turn.next_tool_names),
          stopReason: readOptionalString(turn.stopReason ?? turn.stop_reason),
        };
      });
  const specialistExecutionValue = record.specialistAgentExecution
    ?? record.specialist_agent_execution
    ?? record.specialistExecution
    ?? record.specialist_execution;
  const verificationValue = record.specialistVerificationExecution
    ?? record.specialist_verification_execution;
  const bridgeValues = record.specialistToolPlanBridges
    ?? record.specialist_tool_plan_bridges;
  const postBridgeValue = record.postBridgeVerification
    ?? record.post_bridge_verification;
  return {
    plan: normalizeAgentPlanCore(planValue),
    eventEnvelope: readFirstRecord(record, "eventEnvelope", "event_envelope"),
    modelGatewayGovernance: readFirstRecord(record, "modelGatewayGovernance", "model_gateway_governance"),
    intelligentGatewayGovernance: readFirstRecord(
      record,
      "intelligentGatewayGovernance",
      "intelligent_gateway_governance",
    ),
    toolExecutionReadiness: readFirstRecord(record, "toolExecutionReadiness", "tool_execution_readiness"),
    toolExecutionReadinessGraph: readFirstRecord(
      record,
      "toolExecutionReadinessGraph",
      "tool_execution_readiness_graph",
    ),
    agentExecutionGateWorkflow: readFirstRecord(record, "agentExecutionGateWorkflow", "agent_execution_gate_workflow"),
    agentExecutionClosure: readFirstRecord(record, "agentExecutionClosure", "agent_execution_closure"),
    agentCapabilityClosure: readFirstRecord(record, "agentCapabilityClosure", "agent_capability_closure"),
    controlPlaneIngestion: readFirstRecord(record, "controlPlaneIngestion", "control_plane_ingestion"),
    controlPlaneFeedback: readFirstRecord(record, "controlPlaneFeedback", "control_plane_feedback"),
    agentWorkflowDiagnostics: readFirstRecord(record, "agentWorkflowDiagnostics", "agent_workflow_diagnostics"),
    agentCollaborationWorkflow: readFirstRecord(record, "agentCollaborationWorkflow", "agent_collaboration_workflow"),
    agentCollaborationExecutionPlan: readFirstRecord(
      record,
      "agentCollaborationExecutionPlan",
      "agent_collaboration_execution_plan",
    ),
    agentExecutionSession: readFirstRecord(record, "agentExecutionSession", "agent_execution_session"),
    agentTurnRunner: readFirstRecord(record, "agentTurnRunner", "agent_turn_runner"),
    specialistAgentExecution: isRecord(specialistExecutionValue)
      ? readRecord(specialistExecutionValue)
      : undefined,
    specialistVerificationExecution: normalizeSpecialistVerificationExecution(verificationValue),
    specialistToolPlanBridges: Array.isArray(bridgeValues)
      ? bridgeValues.map(normalizeSpecialistToolPlanBridge)
      : undefined,
    postBridgeVerification: normalizePostBridgeVerification(postBridgeValue),
    agentMemoryRetrievalWorkflow: readFirstRecord(record, "agentMemoryRetrievalWorkflow", "agent_memory_retrieval_workflow"),
    agentConversation: normalizeAgentConversation(record.agentConversation ?? record.agent_conversation),
    agentObservationTimeline: normalizeAgentObservationTimeline(
      record.agentObservationTimeline ?? record.agent_observation_timeline,
    ),
    agentDurableModelToolLoop: Object.keys(durableLoop).length ? {
      turnCount: readNumber(durableLoop.turnCount ?? durableLoop.turn_count, durableTurns.length),
      turns: durableTurns,
      stoppedReason: readString(durableLoop.stoppedReason ?? durableLoop.stopped_reason),
      continuesAfterResponse: readBoolean(
        durableLoop.continuesAfterResponse ?? durableLoop.continues_after_response,
      ),
      payloadPolicy: readOptionalString(durableLoop.payloadPolicy ?? durableLoop.payload_policy),
    } : undefined,
    raw: record,
  };
}

function normalizeAgentToolExecutionAudit(value: unknown, index: number): AgentToolExecutionAudit {
  const record = isRecord(value) ? value : {};
  return {
    auditId: readString(record.auditId ?? record.audit_id, `audit-${index + 1}`),
    sessionId: readString(record.sessionId ?? record.session_id),
    runId: readString(record.runId ?? record.run_id),
    bindingId: readOptionalString(record.bindingId ?? record.binding_id),
    toolCode: readString(record.toolCode ?? record.tool_code, `tool-${index + 1}`),
    toolType: readOptionalString(record.toolType ?? record.tool_type),
    targetService: readOptionalString(record.targetService ?? record.target_service),
    targetEndpoint: readOptionalString(record.targetEndpoint ?? record.target_endpoint),
    targetResourceId: readOptionalNumber(record.targetResourceId ?? record.target_resource_id),
    tenantId: readOptionalNumber(record.tenantId ?? record.tenant_id),
    projectId: readOptionalNumber(record.projectId ?? record.project_id),
    workspaceId: readOptionalNumber(record.workspaceId ?? record.workspace_id),
    actorId: readOptionalString(record.actorId ?? record.actor_id),
    riskLevel: normalizeRisk(record.riskLevel ?? record.risk_level),
    executionMode: normalizeAgentExecutionMode(record.executionMode ?? record.execution_mode),
    requiresApproval: readBoolean(record.requiresApproval ?? record.requires_approval),
    readOnly: readBoolean(record.readOnly ?? record.read_only),
    idempotent: readBoolean(record.idempotent),
    allowedActions: readStringArray(record.allowedActions ?? record.allowed_actions),
    planReason: readOptionalString(record.planReason ?? record.plan_reason),
    planArguments: readRecord(record.planArguments ?? record.plan_arguments),
    governanceHints: readRecord(record.governanceHints ?? record.governance_hints),
    parameterValidation: readRecord(record.parameterValidation ?? record.parameter_validation),
    state: readString(record.state ?? record.status, "UNKNOWN").toUpperCase(),
    traceId: readOptionalString(record.traceId ?? record.trace_id),
    message: readOptionalString(record.message ?? record.error_message),
    approvalOperatorId: readOptionalString(record.approvalOperatorId ?? record.approval_operator_id),
    approvalComment: readOptionalString(record.approvalComment ?? record.approval_comment),
    approvalTime: readOptionalString(record.approvalTime ?? record.approval_time),
    executionStartTime: readOptionalString(record.executionStartTime ?? record.execution_start_time),
    executionFinishTime: readOptionalString(record.executionFinishTime ?? record.execution_finish_time),
    outputSummary: readOptionalString(record.outputSummary ?? record.output_summary),
    errorCode: readOptionalString(record.errorCode ?? record.error_code),
    createTime: readOptionalString(record.createTime ?? record.create_time),
    updateTime: readOptionalString(record.updateTime ?? record.update_time),
  };
}

/**
 * 规范化历史工具结果快照。
 *
 * 历史会话回放不能只展示工具审计状态，因为审计中的 outputSummary 只是一句话摘要；真正用于解释
 * “Agent 调用了什么、得到了什么”的低敏结构化结果保存在 output 中。这里继续复用统一审计规范化，
 * 并把未知或滚动升级期间缺失的 output 安全收口为空对象，避免页面因单个旧结果损坏而无法打开会话。
 */
function normalizeAgentToolExecutionResult(value: unknown, index: number): AgentToolExecutionResult {
  const record = isRecord(value) ? value : {};
  return {
    audit: normalizeAgentToolExecutionAudit(record.audit ?? record.tool_execution_audit, index),
    output: readRecord(record.output ?? record.result ?? record.tool_result),
  };
}

function normalizeAgentRepairProposal(value: unknown): AgentRepairProposal | undefined {
  const record = readRecord(value);
  if (!Object.keys(record).length) return undefined;
  return {
    kind: readString(record.kind ?? record.recoveryKind ?? record.recovery_kind, "UNKNOWN"),
    failureCode: readOptionalString(record.failureCode ?? record.failure_code),
    failedToolName: readOptionalString(record.failedToolName ?? record.failed_tool_name),
    originalTaskName: readOptionalString(record.originalTaskName ?? record.original_task_name),
    proposedTaskName: readOptionalString(record.proposedTaskName ?? record.proposed_task_name),
    // Repair actions are only shown as confirmable when the backend explicitly
    // sends true; malformed or missing flags remain false.
    requiresConfirmation: readBoolean(
      record.requiresConfirmation ?? record.requires_confirmation,
    ),
    summary: readString(record.summary ?? record.publicSummary ?? record.public_summary),
    changes: readStringArray(record.changes ?? record.changeSummaries ?? record.change_summaries),
    payloadPolicy: readOptionalString(record.payloadPolicy ?? record.payload_policy),
  };
}

function normalizeAgentPostConfirmContinuation(value: unknown): AgentPostConfirmContinuation | undefined {
  const record = readRecord(value);
  if (!Object.keys(record).length) return undefined;

  const continued = readOptionalBoolean(
    readFirstDefinedValue(record, "continued", "continuationContinued", "continuation_continued"),
  ) ?? null;
  const modelSecondTurn = readFirstRecord(record, "modelSecondTurn", "model_second_turn");
  const durableLoop = readFirstRecord(record, "durableLoop", "durable_loop");
  const repairProposal = normalizeAgentRepairProposal(
    record.repairProposal ?? record.repair_proposal,
  );
  const specialistVerificationExecution = normalizeSpecialistVerificationExecution(
    record.specialistVerificationExecution ?? record.specialist_verification_execution,
  );
  const postBridgeVerification = normalizePostBridgeVerification(
    record.postBridgeVerification ?? record.post_bridge_verification,
  );

  return {
    schemaVersion: readString(
      record.schemaVersion ?? record.schema_version,
      "datasmart.post-confirm-continuation.v1",
    ),
    status: readString(record.status ?? record.state, "UNKNOWN").toUpperCase(),
    continued: readOptionalBoolean(
      readFirstDefinedValue(record, "continued", "continuationContinued", "continuation_continued"),
    ) ?? null,
    requestId: readOptionalString(record.requestId ?? record.request_id),
    sessionId: readOptionalString(record.sessionId ?? record.session_id),
    sourceRunId: readOptionalString(record.sourceRunId ?? record.source_run_id),
    // A next Run is an executable continuation.  Do not expose it to the
    // action caller unless the nullable backend flag explicitly says true.
    nextRunId: continued === true
      ? readOptionalString(record.nextRunId ?? record.next_run_id)
      : undefined,
    requiresConfirmation: readOptionalBoolean(
      readFirstDefinedValue(record, "requiresConfirmation", "requires_confirmation"),
    ) ?? null,
    stoppedReason: readOptionalString(record.stoppedReason ?? record.stopped_reason),
    assistantReply: readOptionalString(record.assistantReply ?? record.assistant_reply),
    modelSecondTurn: Object.keys(modelSecondTurn).length ? modelSecondTurn : undefined,
    durableLoop: Object.keys(durableLoop).length ? durableLoop : undefined,
    repairProposal,
    specialistVerificationExecution,
    postBridgeVerification,
    payloadPolicy: readOptionalString(record.payloadPolicy ?? record.payload_policy),
    message: readOptionalString(record.message),
  };
}

function normalizeAgentToolExecutionFailure(value: unknown, index: number): AgentToolExecutionFailure {
  const record = readRecord(value);
  return {
    auditId: readOptionalString(record.auditId ?? record.audit_id),
    toolCode: readString(record.toolCode ?? record.tool_code, `tool-${index + 1}`),
    errorCode: readString(record.errorCode ?? record.error_code, "UNKNOWN"),
    message: readString(record.message ?? record.publicMessage ?? record.public_message),
    outputSummary: readOptionalString(record.outputSummary ?? record.output_summary),
    details: readStringArray(record.details ?? record.detailSummaries ?? record.detail_summaries),
    suggestions: readStringArray(record.suggestions ?? record.recoverySuggestions ?? record.recovery_suggestions),
  };
}

function normalizeAgentRunConfirmedExecutionResponse(
  value: unknown,
): AgentRunConfirmedExecutionResponse {
  const record = readRecord(value);
  const toolResults = readFirstArray(record, "toolResults", "tool_results")
    .map(normalizeAgentToolExecutionResult);
  const failures = readFirstArray(record, "failures", "executionFailures", "execution_failures")
    .map(normalizeAgentToolExecutionFailure);
  const plannedCount = readNumber(
    record.plannedCount ?? record.planned_count,
    toolResults.length + failures.length,
  );
  const failedCount = readNumber(record.failedCount ?? record.failed_count, failures.length);
  const continuation = normalizeAgentPostConfirmContinuation(
    record.continuation ?? record.postConfirmContinuation ?? record.post_confirm_continuation,
  );
  return {
    sessionId: readString(record.sessionId ?? record.session_id),
    runId: readString(record.runId ?? record.run_id),
    runState: readString(record.runState ?? record.run_state ?? record.state, "UNKNOWN"),
    plannedCount,
    succeededCount: readNumber(
      record.succeededCount ?? record.succeeded_count,
      Math.max(0, plannedCount - failedCount),
    ),
    failedCount,
    toolResults,
    failures,
    nextActions: readStringArray(record.nextActions ?? record.next_actions),
    assistantReply: readString(record.assistantReply ?? record.assistant_reply),
    answerMode: readString(record.answerMode ?? record.answer_mode),
    modelProviderStatus: readString(
      record.modelProviderStatus ?? record.model_provider_status,
    ),
    ...(continuation ? { continuation } : {}),
  };
}

function normalizeAgentRagResult(value: unknown): AgentRagQueryResult {
  const record = readRecord(value);
  const citations = Array.isArray(record.citations)
    ? record.citations.map((item) => readRecord(item))
    : [];
  return {
    ...record,
    answer: readOptionalString(record.answer),
    citations,
    selectedChunks: Array.isArray(record.selectedChunks) ? record.selectedChunks : [],
    compressedContext: readOptionalString(record.compressedContext),
    retrievalSummary: readRecord(record.retrievalSummary),
    modelSummary: readRecord(record.modelSummary),
    langGraphCheckpoint: record.langGraphCheckpoint,
  };
}

function normalizeRuntimeEventLevel(value: unknown): RuntimeEvent["level"] {
  const level = readString(value, "INFO").toUpperCase();
  return level === "ERROR" ? "ERROR" : level === "WARN" || level === "WARNING" ? "WARN" : "INFO";
}

function normalizeRuntimeEvent(value: unknown, index: number): RuntimeEvent {
  const record = isRecord(value) ? value : {};
  const display = isRecord(record.display) ? record.display : {};
  return {
    id: readString(record.identityKey ?? record.replaySequence ?? record.sequence, `event-${index + 1}`),
    time: readString(record.createdAt ?? record.publishedAt ?? record.consumedAt, ""),
    level: normalizeRuntimeEventLevel(record.severity ?? display.status),
    title: readString(display.title ?? record.eventType, `运行事件 ${index + 1}`),
    detail: readString(display.summary ?? record.message ?? record.stage, "-"),
    domain: readString(record.source, "agent-runtime"),
  };
}

function normalizeRuntimeEventPage(value: unknown, fallbackRecords: RuntimeEvent[]) {
  if (isRecord(value) && Array.isArray(value.events)) {
    const records = value.events.map(normalizeRuntimeEvent);
    return {
      current: 1,
      size: readNumber(value.appliedLimit, records.length),
      total: readNumber(value.totalMatched, records.length),
      pages: 1,
      records,
    } satisfies PlatformPageResponse<RuntimeEvent>;
  }
  return normalizePage(value, fallbackRecords, normalizeRuntimeEvent);
}

function parsePortFromUrl(value: unknown) {
  try {
    const url = new URL(readString(value));
    return readNumber(url.port, url.protocol === "https:" ? 443 : 80);
  } catch {
    return 0;
  }
}

function normalizeServiceHealth(value: unknown, fallbackRecords: ServiceHealth[]): ServiceHealth[] {
  if (Array.isArray(value)) {
    return value as ServiceHealth[];
  }
  if (isRecord(value) && Array.isArray(value.probes)) {
    return value.probes.map((probe, index) => {
      const item = isRecord(probe) ? probe : {};
      const moduleCode = readString(item.moduleCode, `service-${index + 1}`);
      const status = normalizeHealth(item.status);
      return {
        key: moduleCode,
        serviceName: moduleCode,
        domain: readString(item.displayName ?? item.moduleKind, "平台服务"),
        status,
        port: parsePortFromUrl(item.targetUrl),
        p95LatencyMs: readNumber(item.durationMs, 0),
        errorRate: status === "UP" ? 0 : 100,
        updatedAt: readString(item.probedAt ?? value.generatedAt ?? new Date().toISOString()),
      } satisfies ServiceHealth;
    });
  }
  return fallbackRecords;
}

async function pageEndpoint<T>(path: string, fallbackRecords: T[], mapper?: (value: unknown, index: number) => T) {
  const result = await requestWithFallback<unknown>(path, pageOf(fallbackRecords));
  const fallback = result.meta.source === "mock" ? fallbackRecords : [];
  return {
    ...result,
    data: normalizePage<T>(result.data, fallback, mapper),
  };
}

async function realPageEndpoint<T>(path: string, mapper?: (value: unknown, index: number) => T) {
  /*
   * 执行日志、执行历史、审计证据这类数据属于“生产运行证据”，不能像看板样例数据一样静默降级为 mock。
   * 如果这里继续复用 requestWithFallback，一旦 token 过期、网关路由策略缺失、权限中心拒绝或后端接口异常，
   * 页面会收到一个空分页并显示“本地模拟数据未命中记录”，用户会误以为系统没有写运行日志。
   *
   * 因此真实证据类接口统一走 request：
   * 1. 接口成功时，按后端分页结构解析 records；
   * 2. 接口失败时，把真实 HTTP/平台错误抛给 React Query；
   * 3. 页面再把错误展示成可读提示，帮助定位是认证、权限、路由还是 data-sync 服务问题。
   */
  const result = await request<unknown>(path);
  return {
    ...result,
    data: normalizePage<T>(result.data, [], mapper),
  };
}

/**
 * 读取真实的低敏事实集合，不允许在生产历史回放中静默切换到 mock 数据。
 *
 * Agent 历史事实属于审计和回放证据，接口失败时应由调用方按“非阻断”策略
 * 处理并显示有限提示，而不是把本地样例误当成真实专业 Agent 过程。
 */
async function realArrayEndpoint<T>(path: string, mapper?: (value: unknown, index: number) => T) {
  const result = await request<unknown>(path);
  return {
    ...result,
    data: normalizeArray<T>(result.data, [], mapper),
  };
}

async function arrayEndpoint<T>(path: string, fallbackRecords: T[], mapper?: (value: unknown, index: number) => T) {
  const result = await requestWithFallback<unknown>(path, fallbackRecords);
  const fallback = result.meta.source === "mock" ? fallbackRecords : [];
  return {
    ...result,
    data: normalizeArray<T>(result.data, fallback, mapper),
  };
}

const closureProbeTargets: Array<{ key: string; name: string; path: string }> = [
  { key: "session", name: "网关会话", path: "/auth/session" },
  { key: "observability", name: "服务健康", path: "/observability/platform/service-health-snapshots" },
  { key: "datasource", name: "数据源列表", path: "/datasource/datasources?current=1&size=1" },
  { key: "task", name: "任务列表", path: "/task/tasks?current=1&size=1" },
  { key: "quality", name: "质量规则", path: "/quality/quality-rules?current=1&size=1" },
  { key: "syncCapabilities", name: "同步连接器", path: "/sync/sync-connectors/capabilities" },
  { key: "syncTasks", name: "同步任务", path: "/sync/sync-tasks?current=1&size=1" },
  { key: "agent", name: "Agent 工具", path: "/agent/tools?enabledOnly=false" },
  { key: "permission", name: "权限角色", path: "/permission/roles" },
];

async function probeEndpoint(target: (typeof closureProbeTargets)[number]): Promise<EndpointProbe> {
  const startedAt = performance.now();
  try {
    const response = await request<unknown>(target.path);
    return {
      ...target,
      status: "UP",
      latencyMs: Math.round(performance.now() - startedAt),
      traceId: response.meta.traceId,
      message: response.meta.message,
    };
  } catch (error) {
    return {
      ...target,
      status: "DOWN",
      latencyMs: Math.round(performance.now() - startedAt),
      message: error instanceof ApiError ? `${error.status ?? "ERR"} ${error.message}` : "接口探针失败",
    };
  }
}

function postJson<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: "POST",
    body: body == null ? undefined : JSON.stringify(body),
  });
}

function putJson<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: "PUT",
    body: body == null ? undefined : JSON.stringify(body),
  });
}

/**
 * 发送 JSON Merge 风格的局部状态修改请求。
 *
 * 当前用于置顶和归档等不会替换完整资源的动作；认证、项目 Header、刷新 token 与全局错误展开仍由
 * request() 统一处理，避免每个 API 重复实现安全链路。
 */
function patchJson<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: "PATCH",
    body: body == null ? undefined : JSON.stringify(body),
  });
}

function deleteJson<T>(path: string) {
  return request<T>(path, { method: "DELETE" });
}

function compactQueryString(params?: Record<string, unknown>) {
  const query = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([key, value]) => {
    // 工作空间已经从普通业务页面中剔除，API 客户端底层也会清理 workspace 字段；
    // 这里再做一次显式跳过，是为了让构造查询串的意图更清晰。
    if (key === "workspaceId" || value === undefined || value === null || value === "") {
      return;
    }
    query.set(key, String(value));
  });
  return query.toString();
}

function taskQueryString(params?: SyncTaskQueryParams) {
  const query = new URLSearchParams({
    current: String(params?.current ?? 1),
    size: String(params?.size ?? 20),
  });
  Object.entries(params ?? {}).forEach(([key, value]) => {
    // FlashSync 用户侧数据同步已经收敛为“租户 -> 项目 -> 任务/数据源”。
    // workspaceId 只保留在部分历史 DTO、Agent 沙箱和旧导入导出合同里，不能再作为页面查询参数发给后端；
    // 否则旧值如 workspace-a 会在后端参数绑定阶段被当成 Long 解析，从而把任务列表或创建向导打断。
    if (key === "workspaceId") {
      return;
    }
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  return query.toString();
}

export const api = {
  getSession: () => request<GatewaySession>("/auth/session"),
  runClosureProbes: () => Promise.all(closureProbeTargets.map(probeEndpoint)),
  createDataSource: async (payload: CreateDataSourcePayload) => {
    const { usageRole, usagePurpose, ...rest } = payload;
    const result = await postJson<unknown>("/datasource/datasources", {
      ...rest,
      usagePurpose: usagePurpose ?? usageRole,
    });
    const record = isRecord(result.data) ? result.data : {};
    return {
      ...result,
      data: {
        ...normalizeDataSource(result.data, 0),
        id: readOptionalNumber(record.id) ?? 0,
      },
    };
  },
  updateDataSource: (id: number, payload: UpdateDataSourcePayload) => {
    const { usageRole, usagePurpose, ...rest } = payload;
    return putJson<unknown>(`/datasource/datasources/${id}`, {
      ...rest,
      usagePurpose: usagePurpose ?? usageRole,
    });
  },
  deleteDataSource: (id: number) => deleteJson<unknown>(`/datasource/datasources/${id}`),
  enableDataSource: (id: number) => postJson<unknown>(`/datasource/datasources/${id}/enable`),
  disableDataSource: (id: number) => postJson<unknown>(`/datasource/datasources/${id}/disable`),
  testDataSourceConnection: (payload: TestDataSourceConnectionPayload) =>
    postJson<DataSourceConnectionTestResult>("/datasource/datasources/connection-test", payload),
  testExistingDataSourceConnection: (id: number, payload: TestExistingDataSourceConnectionPayload) =>
    postJson<DataSourceConnectionTestResult>(`/datasource/datasources/${id}/connection-test`, payload),
  testDataSource: (id: number) => postJson<DataSourceConnectionTestResult>(`/datasource/datasources/${id}/test`),
  discoverDataSourceMetadata: (id: number, payload: MetadataDiscoveryPayload) =>
    postJson<DataSourceMetadataDiscoveryResult>(`/datasource/datasources/${id}/metadata/discover`, payload),
  listDataSources: (params?: DataSourceListParams) => {
    const query = compactQueryString({
      current: 1,
      size: 50,
      ...params,
      status: toDatasourceQueryStatus(params?.status),
    });
    return pageEndpoint<DataSourceRecord>(`/datasource/datasources?${query}`, dataSources, normalizeDataSource);
  },
  listDataSourceAuthorizations: (datasourceId: number, params?: { current?: number; size?: number; subjectType?: string; status?: string }) => {
    const query = compactQueryString({ current: 1, size: 20, status: "ACTIVE", ...params });
    return pageEndpoint<DataSourceAuthorizationRecord>(
      `/datasource/datasources/${datasourceId}/authorizations?${query}`,
      [],
      normalizeDataSourceAuthorization,
    );
  },
  grantDataSourceAuthorization: (datasourceId: number, payload: GrantDataSourceAuthorizationPayload) =>
    postJson<DataSourceAuthorizationRecord>(`/datasource/datasources/${datasourceId}/authorizations`, payload),
  revokeDataSourceAuthorization: (datasourceId: number, authorizationId: number, reason?: string) =>
    request<DataSourceAuthorizationRecord>(`/datasource/datasources/${datasourceId}/authorizations/${authorizationId}`, {
      method: "DELETE",
      body: reason ? JSON.stringify({ revokeReason: reason }) : undefined,
    }),
  listAuthorizationSubjectCandidates: (params?: AuthorizationSubjectCandidateParams) => {
    const query = compactQueryString({ current: 1, size: 20, activeOnly: true, projectMembersOnly: true, ...params });
    return pageEndpoint<AuthorizationSubjectCandidate>(
      `/identity/authorization-subjects?${query}`,
      [],
      normalizeAuthorizationSubjectCandidate,
    );
  },
  createGovernanceTask: (payload: CreateTaskPayload) => postJson<unknown>("/task/tasks", payload),
  startGovernanceTask: (id: number) => postJson<unknown>(`/task/tasks/${id}/start`),
  pauseGovernanceTask: (id: number) => postJson<unknown>(`/task/tasks/${id}/pause`),
  retryGovernanceTask: (id: number) => postJson<unknown>(`/task/tasks/${id}/retry`),
  cancelGovernanceTask: (id: number) => postJson<unknown>(`/task/tasks/${id}/cancel`),
  listGovernanceTasks: (params?: GovernanceTaskListParams) => {
    const query = compactQueryString({ current: 1, size: 20, ...params });
    return pageEndpoint<GovernanceTask>(`/task/tasks?${query}`, governanceTasks, normalizeTask);
  },
  createQualityRule: (payload: CreateQualityRulePayload) =>
    postJson<unknown>("/quality/quality-rules", payload),
  runQualityCheck: (id: number, payload: RunQualityCheckPayload) =>
    postJson<unknown>(`/quality/quality-rules/${id}/run-check`, payload),
  listQualityRules: () =>
    pageEndpoint<QualityRule>("/quality/quality-rules?current=1&size=20", qualityRules, normalizeQualityRule),
  listQualityReports: () =>
    pageEndpoint<QualityReport>(
      "/quality/quality-rules/reports?current=1&size=10",
      qualityReports,
      normalizeQualityReport,
    ),
  getSyncTask: async (id: number) => {
    const result = await request<unknown>(`/sync/sync-tasks/${id}`);
    return {
      ...result,
      data: normalizeSyncTask(result.data, 0),
    };
  },
  saveSyncTaskCreateWizardDraft: (payload: SyncTaskCreateWizardDraftPayload) =>
    postJson<SyncTaskCreateWizardDraftResult>("/sync/sync-tasks/create-wizard/drafts", payload),
  precheckSyncTask: (id: number) =>
    postJson<SyncTaskExecutionPrecheckResponse>(`/sync/sync-tasks/${id}/precheck`),
  updateSyncTask: (id: number, payload?: UpdateSyncTaskPayload) => putJson<SyncTask>(`/sync/sync-tasks/${id}`, payload),
  publishSyncTask: (id: number, payload?: PublishSyncTaskPayload) =>
    postJson<SyncTaskOperationResult>(`/sync/sync-tasks/${id}/publish`, payload),
  updateSyncTaskGroup: (id: number, payload?: UpdateSyncTaskGroupPayload) =>
    postJson<SyncTaskOperationResult>(`/sync/sync-tasks/${id}/group`, payload),
  cloneSyncTask: (id: number, payload?: CloneSyncTaskPayload) =>
    postJson<SyncTaskOperationResult>(`/sync/sync-tasks/${id}/clone`, payload),
  runSyncTask: (id: number) => postJson<unknown>(`/sync/sync-tasks/${id}/run`),
  manualDispatchSyncTask: (id: number) =>
    postJson<SyncTaskOperationResult>(`/sync/sync-tasks/${id}/manual-dispatch`),
  pauseSyncTask: (id: number, payload?: SyncTaskLifecyclePayload) =>
    postJson<unknown>(`/sync/sync-tasks/${id}/pause`, payload),
  resumeSyncTask: (id: number, payload?: SyncTaskLifecyclePayload) =>
    postJson<unknown>(`/sync/sync-tasks/${id}/resume`, payload),
  retrySyncTask: (id: number, payload?: SyncTaskLifecyclePayload) =>
    postJson<unknown>(`/sync/sync-tasks/${id}/retry`, payload),
  cancelSyncTask: (id: number, payload?: SyncTaskLifecyclePayload) =>
    postJson<unknown>(`/sync/sync-tasks/${id}/cancel`, payload),
  terminateSyncTask: (id: number, payload?: SyncTaskLifecyclePayload) =>
    postJson<SyncTaskOperationResult>(`/sync/sync-tasks/${id}/terminate`, payload),
  offlineSyncTask: (id: number, payload?: SyncTaskLifecyclePayload) =>
    postJson<SyncTaskOperationResult>(`/sync/sync-tasks/${id}/offline`, payload),
  recycleSyncTask: (id: number, payload?: SyncTaskLifecyclePayload) =>
    postJson<SyncTaskOperationResult>(`/sync/sync-tasks/${id}/recycle`, payload),
  hardDeleteSyncTask: (id: number, payload?: SyncTaskLifecyclePayload) =>
    postJson<SyncTaskOperationResult>(`/sync/sync-tasks/${id}/hard-delete`, payload),
  replaySyncTask: (id: number, payload?: SyncTaskRecoveryPayload) =>
    postJson<unknown>(`/sync/sync-tasks/${id}/replay`, payload),
  backfillSyncTask: (id: number, payload?: SyncTaskRecoveryPayload) =>
    postJson<unknown>(`/sync/sync-tasks/${id}/backfill`, payload),
  listSyncTasks: (params?: SyncTaskQueryParams) =>
    pageEndpoint<SyncTask>(`/sync/sync-tasks?${taskQueryString(params)}`, [], normalizeSyncTask),
  listRecycledSyncTasks: (params?: SyncTaskQueryParams) =>
    pageEndpoint<SyncTask>(`/sync/sync-tasks/recycle-bin?${taskQueryString(params)}`, [], normalizeSyncTask),
  listSyncTaskGroups: (params?: SyncTaskQueryParams) =>
    arrayEndpoint<SyncTaskGroupSummary>(
      `/sync/sync-tasks/groups?${taskQueryString({ ...params, size: params?.size ?? 100 })}`,
      [],
      normalizeSyncTaskGroupSummary,
    ),
  listSyncTaskGroupTree: (params?: SyncTaskQueryParams) =>
    arrayEndpoint<SyncTaskGroupTreeNode>(
      `/sync/sync-tasks/groups/tree?${taskQueryString({ ...params, size: params?.size ?? 200 })}`,
      [],
      normalizeSyncTaskGroupTreeNode,
    ),
  createSyncTaskGroup: (payload: CreateSyncTaskGroupPayload) =>
    postJson<SyncTaskGroupTreeNode>("/sync/sync-tasks/groups", payload),
  deleteSyncTaskGroup: (groupCode: string, params?: DeleteSyncTaskGroupParams) => {
    const query = new URLSearchParams();
    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        query.set(key, String(value));
      }
    });
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return deleteJson<SyncTaskOperationResult>(`/sync/sync-tasks/groups/${encodeURIComponent(groupCode)}${suffix}`);
  },
  exportSyncTasks: (params?: SyncTaskQueryParams & { format?: "CSV" | "XLSX" | "EXCEL" }) =>
    requestFile(`/sync/sync-tasks/export?${taskQueryString({ ...params, size: params?.size ?? 500 })}`),
  batchExportSyncTasks: (payload: SyncTaskBatchExportPayload) =>
    requestFile("/sync/sync-tasks/batch/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  importSyncTasks: async (file: File, options?: { format?: string; dryRun?: boolean; runImmediately?: boolean }) => {
    const formData = new FormData();
    formData.append("file", file);
    if (options?.format) formData.append("format", options.format);
    if (options?.dryRun !== undefined) formData.append("dryRun", String(options.dryRun));
    if (options?.runImmediately !== undefined) formData.append("runImmediately", String(options.runImmediately));
    const result = await requestForm<unknown>("/sync/sync-tasks/import", formData);
    return {
      ...result,
      data: normalizeSyncTaskImportResult(result.data),
    };
  },
  batchImportSyncTasks: async (file: File, options?: { format?: string; dryRun?: boolean; runImmediately?: boolean }) => {
    const formData = new FormData();
    formData.append("file", file);
    if (options?.format) formData.append("format", options.format);
    if (options?.dryRun !== undefined) formData.append("dryRun", String(options.dryRun));
    if (options?.runImmediately !== undefined) formData.append("runImmediately", String(options.runImmediately));
    const result = await requestForm<unknown>("/sync/sync-tasks/batch/import", formData);
    return {
      ...result,
      data: normalizeSyncTaskImportResult(result.data),
    };
  },
  uploadSyncTaskImportArtifact: async (file: File, format?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    if (format) formData.append("format", format);
    return requestForm<SyncTaskImportArtifact>("/sync/sync-task-import-artifacts/upload", formData);
  },
  batchManualDispatchSyncTasks: async (payload: SyncTaskBatchOperationPayload) => {
    const result = await postJson<unknown>("/sync/sync-tasks/batch/manual-dispatch", payload);
    return {
      ...result,
      data: normalizeSyncTaskBatchOperationResult(result.data),
    };
  },
  batchOfflineSyncTasks: async (payload: SyncTaskBatchOperationPayload) => {
    const result = await postJson<unknown>("/sync/sync-tasks/batch/offline", payload);
    return {
      ...result,
      data: normalizeSyncTaskBatchOperationResult(result.data),
    };
  },
  batchRecycleSyncTasks: async (payload: SyncTaskBatchOperationPayload) => {
    const result = await postJson<unknown>("/sync/sync-tasks/batch/recycle", payload);
    return {
      ...result,
      data: normalizeSyncTaskBatchOperationResult(result.data),
    };
  },
  batchHardDeleteSyncTasks: async (payload: SyncTaskBatchOperationPayload) => {
    const result = await postJson<unknown>("/sync/sync-tasks/batch/hard-delete", payload);
    return {
      ...result,
      data: normalizeSyncTaskBatchOperationResult(result.data),
    };
  },
  discoverSyncTaskMetadata: async (payload: SyncTaskMetadataDiscoveryPayload) => {
    const result = await postJson<unknown>("/sync/sync-tasks/metadata/objects/discover", payload);
    return {
      ...result,
      data: normalizeSyncTaskMetadataDiscoveryResult(result.data),
    };
  },
  suggestSyncTaskFieldMappings: async (payload: SyncTaskFieldMappingSuggestionPayload) => {
    const result = await postJson<unknown>("/sync/sync-tasks/metadata/field-mappings/suggest", payload);
    return {
      ...result,
      data: normalizeSyncTaskFieldMappingSuggestionResult(result.data),
    };
  },
  listSyncExecutions: (taskId: number) =>
    pageEndpoint<SyncExecution>(`/sync/sync-tasks/${taskId}/executions?current=1&size=20`, [], normalizeSyncExecution),
  listSyncExecutionLogs: (taskId: number, executionId: number) =>
    realPageEndpoint<SyncExecutionLog>(
      `/sync/sync-tasks/${taskId}/executions/${executionId}/logs?current=1&size=100`,
      normalizeSyncExecutionLog,
    ),
  listSyncExecutionPolicies: (params?: SyncExecutionPolicyQueryParams) =>
    realPageEndpoint<SyncExecutionPolicy>(
      `/sync/sync-execution-policies?${compactQueryString({
        ...params,
        current: params?.current ?? 1,
        size: params?.size ?? 200,
      })}`,
      normalizeSyncExecutionPolicy,
    ),
  createSyncExecutionPolicy: async (payload: UpsertSyncExecutionPolicyPayload) => {
    const result = await postJson<unknown>("/sync/sync-execution-policies", payload);
    return { ...result, data: normalizeSyncExecutionPolicy(result.data, 0) };
  },
  updateSyncExecutionPolicy: async (id: number, payload: UpsertSyncExecutionPolicyPayload) => {
    const result = await putJson<unknown>(`/sync/sync-execution-policies/${id}`, payload);
    return { ...result, data: normalizeSyncExecutionPolicy(result.data, 0) };
  },
  disableSyncExecutionPolicy: (id: number) =>
    deleteJson<void>(`/sync/sync-execution-policies/${id}`),
  getSyncExecutionPolicySnapshot: async (taskId: number, executionId: number) => {
    const result = await request<unknown>(
      `/sync/sync-tasks/${taskId}/executions/${executionId}/policy-snapshot`,
    );
    return { ...result, data: normalizeSyncExecutionPolicySnapshot(result.data) };
  },
  listSyncObjectExecutions: (taskId: number, executionId: number) =>
    pageEndpoint<SyncObjectExecution>(
      `/sync/sync-tasks/${taskId}/executions/${executionId}/objects?current=1&size=50`,
      [],
      normalizeSyncObjectExecution,
    ),
  retrySyncObjectExecutions: (taskId: number, executionId: number, payload?: SyncObjectRetryPayload) =>
    postJson<Record<string, unknown>>(`/sync/sync-tasks/${taskId}/executions/${executionId}/objects/retry`, payload),
  listSyncErrorSamples: (taskId: number, executionId?: number) => {
    const params = new URLSearchParams({ current: "1", size: "50" });
    if (executionId) params.set("executionId", String(executionId));
    return pageEndpoint<SyncErrorSample>(
      `/sync/sync-tasks/${taskId}/errors?${params.toString()}`,
      [],
      normalizeSyncErrorSample,
    );
  },
  replaySyncDirtyRecords: (taskId: number, payload: SyncDirtyRecordReplayPayload) =>
    postJson<Record<string, unknown>>(`/sync/sync-tasks/${taskId}/errors/replay`, payload),
  listSyncCheckpoints: (taskId: number, executionId?: number) => {
    const params = new URLSearchParams({ current: "1", size: "50" });
    if (executionId) params.set("executionId", String(executionId));
    return pageEndpoint<SyncCheckpoint>(
      `/sync/sync-tasks/${taskId}/checkpoints?${params.toString()}`,
      [],
      normalizeSyncCheckpoint,
    );
  },
  listSyncAuditRecords: (taskId: number, executionId?: number) => {
    const params = new URLSearchParams({ current: "1", size: "50" });
    if (executionId) params.set("executionId", String(executionId));
    return pageEndpoint<SyncAuditRecord>(
      `/sync/sync-tasks/${taskId}/audit?${params.toString()}`,
      [],
      normalizeSyncAuditRecord,
    );
  },
  runSyncWorkerLoop: (payload?: SyncWorkerLoopRunPayload) =>
    postJson<Record<string, unknown>>("/sync/sync-workers/run-once", payload),
  dispatchDueSyncTasks: (payload?: SyncTaskScheduleDispatchPayload) =>
    postJson<Record<string, unknown>>("/sync/sync-task-schedulers/dispatch-due", payload),
  listSyncIncidents: () =>
    pageEndpoint<SyncIncident>("/sync/sync-incidents?current=1&size=20", [], normalizeSyncIncident),
  listSyncConnectorCapabilities: () =>
    arrayEndpoint<SyncConnectorCapability>(
      "/sync/sync-connectors/capabilities",
      [],
      normalizeSyncConnectorCapability,
    ),
  checkSyncConnectorCompatibility: async (
    sourceConnectorType: string,
    targetConnectorType: string,
    syncMode: string,
  ) => {
    const params = new URLSearchParams({ sourceConnectorType, targetConnectorType, syncMode });
    const result = await request<unknown>(`/sync/sync-connectors/compatibility?${params.toString()}`);
    return {
      ...result,
      data: normalizeSyncConnectorCompatibility(result.data),
    };
  },
  /**
   * 查询当前项目范围内可访问的 Agent 会话历史，可切换活跃/归档集合。
   *
   * projectId 显式进入查询参数，与网关的项目 Header 形成双重约束；这样项目
   * 切换时不会只依赖 React Query key，而让旧项目的会话短暂出现在新项目列表。
   */
  listAgentSessions: (params?: {
    archived?: boolean;
    limit?: number;
    actorId?: string;
    projectId?: number;
  }) => {
    const query = compactQueryString(params);
    return arrayEndpoint<AgentSession>(`/agent/sessions${query ? `?${query}` : ""}`, [], normalizeAgentSession);
  },
  /** 加载完整会话聚合，用于恢复消息并在同一 session 中继续追问。 */
  getAgentSession: async (sessionId: string) => {
    const result = await request<unknown>(`/agent/sessions/${sessionId}`);
    return { ...result, data: normalizeAgentSession(result.data, 0) };
  },
  /** 查询一个历史会话中的专业 Agent 低敏事实，权限上下文由 request 统一注入。 */
  listAgentSpecialistTurnFactsBySession: (sessionId: string) =>
    realArrayEndpoint<AgentSpecialistTurnFact>(
      `/agent/specialist-turn-facts/sessions/${encodeURIComponent(sessionId)}`,
      normalizeAgentSpecialistTurnFact,
    ),
  /**
   * 按 Run 查询专业 Agent 低敏事实。
   *
   * 历史会话优先使用 session 查询以避免 N+1；当 session 事实接口不可用或
   * 未来需要单独回放某个 Run 时，再由页面调用这个精确定位接口。
   */
  listAgentSpecialistTurnFactsByRun: (runId: string) =>
    realArrayEndpoint<AgentSpecialistTurnFact>(
      `/agent/specialist-turn-facts/runs/${encodeURIComponent(runId)}`,
      normalizeAgentSpecialistTurnFact,
    ),
  /** 修改会话置顶状态；后端仍会校验当前用户是会话所有者。 */
  setAgentSessionPinned: async (sessionId: string, enabled: boolean) => {
    const result = await patchJson<unknown>(`/agent/sessions/${sessionId}/pin`, { enabled });
    return { ...result, data: normalizeAgentSession(result.data, 0) };
  },
  /** 归档或恢复会话，操作不会删除消息、运行记录和审计证据。 */
  setAgentSessionArchived: async (sessionId: string, enabled: boolean) => {
    const result = await patchJson<unknown>(`/agent/sessions/${sessionId}/archive`, { enabled });
    return { ...result, data: normalizeAgentSession(result.data, 0) };
  },
  createAgentSession: async (payload: CreateAgentSessionPayload) => {
    const result = await postJson<unknown>("/agent/sessions", payload);
    return {
      ...result,
      data: normalizeAgentSession(result.data, 0),
    };
  },
  startAgentRun: async (sessionId: string, payload: StartAgentRunPayload) => {
    const result = await postJson<unknown>(`/agent/sessions/${sessionId}/runs`, payload);
    return {
      ...result,
      data: normalizeAgentRun(result.data, 0),
    };
  },
  cancelAgentRun: async (sessionId: string, runId: string) => {
    const result = await postJson<unknown>(`/agent/sessions/${sessionId}/runs/${runId}/cancel`);
    return {
      ...result,
      data: normalizeAgentRun(result.data, 0),
    };
  },
  listAgentToolExecutions: (sessionId: string, runId: string) =>
    arrayEndpoint<AgentToolExecutionAudit>(
      `/agent/sessions/${sessionId}/runs/${runId}/tool-executions`,
      [],
      normalizeAgentToolExecutionAudit,
    ),
  /**
   * 批量读取一个 Run 的低敏工具结果，供历史会话按回合恢复真实执行过程。
   * 使用后端批量路由而不是逐 audit 查询，可避免多工具 Run 产生 N+1 请求。
   */
  listAgentToolExecutionResults: (sessionId: string, runId: string) =>
    arrayEndpoint<AgentToolExecutionResult>(
      `/agent/sessions/${sessionId}/runs/${runId}/tool-executions/results`,
      [],
      normalizeAgentToolExecutionResult,
    ),
  getAgentToolExecutionPolicy: (sessionId: string, runId: string) =>
    request<Record<string, unknown>>(`/agent/sessions/${sessionId}/runs/${runId}/tool-executions/execution-policy`),
  getAgentToolDagPlan: (sessionId: string, runId: string) =>
    request<Record<string, unknown>>(`/agent/sessions/${sessionId}/runs/${runId}/tool-executions/dag-plan`),
  getAgentAsyncCommandPlans: (sessionId: string, runId: string) =>
    request<Record<string, unknown>>(`/agent/sessions/${sessionId}/runs/${runId}/tool-executions/async-command-plans`),
  confirmAndExecuteAgentRun: async (sessionId: string, runId: string, payload: ConfirmAgentRunPayload) => {
    const result = await postJson<unknown>(
      `/agent/sessions/${sessionId}/runs/${runId}/confirm-and-execute`,
      payload,
    );
    return {
      ...result,
      data: normalizeAgentRunConfirmedExecutionResponse(result.data),
    };
  },
  createAgentPlan: async (payload: CreateAgentPlanPayload) => {
    const result = await postJson<unknown>("/agent/plans", payload);
    return {
      ...result,
      data: normalizeAgentPlanResponse(result.data),
    };
  },
  createAgentPlanStream: async (
    payload: CreateAgentPlanPayload,
    onFrame: (frame: AgentPlanStreamFrame) => void,
    options: { signal?: AbortSignal } = {},
  ) => {
    let finalResponse: AgentPlanResponse | undefined;
    await streamJsonLines<AgentPlanStreamFrame>("/agent/plans/stream", payload, (frame) => {
      onFrame(frame);
      if (frame.type === "error") {
        throw new ApiError(
          frame.error?.message || "Agent 规划未能完成，请查看最后一个进度节点后重试。",
          {
            reason: frame.error?.code,
            recoverable: frame.error?.recoverable,
            suggestions: frame.error?.suggestions,
          },
        );
      }
      if (frame.type === "cancelled") {
        throw new DOMException(frame.message || "用户已停止本轮 Agent 处理。", "AbortError");
      }
      if (frame.type === "result") {
        finalResponse = normalizeAgentPlanResponse(frame.data);
      }
    }, options);
    if (!finalResponse) {
      throw new ApiError("Agent 实时规划已结束，但没有返回最终计划快照。", {
        reason: "AGENT_PLAN_STREAM_RESULT_MISSING",
      });
    }
    return {
      data: finalResponse,
      meta: { source: "api" as const },
    };
  },
  cancelAgentPlan: (payload: CreateAgentPlanPayload) => postJson<AgentPlanCancellationResponse>(
    "/agent/plans/cancel",
    payload,
  ),
  queryAgentRag: async (payload: AgentRagQueryPayload) => {
    const result = await postJson<unknown>("/agent/rag/query", payload);
    return {
      ...result,
      data: normalizeAgentRagResult(result.data),
    };
  },
  getAgentRagDiagnostics: () => request<Record<string, unknown>>("/agent/rag/diagnostics"),
  getAgentRuntimeDiagnostics: () => request<Record<string, unknown>>("/agent/runtime-events/diagnostics"),
  getAgentSkillVisibilityDiagnostics: () =>
    request<Record<string, unknown>>("/agent/runtime-events/skill-visibility-snapshots/diagnostics"),
  getAgentProviderHealthDiagnostics: () => request<Record<string, unknown>>("/agent/models/provider-health/diagnostics"),
  getAgentCapabilityDiagnostics: () => request<Record<string, unknown>>("/agent/capabilities/closure-readiness"),
  getAgentPlatformConvergenceDiagnostics: () =>
    request<Record<string, unknown>>("/agent/platform/convergence/diagnostics"),
  getAgentAsyncCommandOutboxDiagnostics: () =>
    request<Record<string, unknown>>("/agent/async-task-commands/outbox/diagnostics"),
  getAgentToolEventOutboxDiagnostics: () =>
    request<Record<string, unknown>>("/agent/tool-execution-events/outbox/diagnostics"),
  listAgentModelRoutes: () =>
    arrayEndpoint<AgentModelRoute>("/agent/models/routes", [], normalizeAgentModelRoute),
  listAgentTools: () => arrayEndpoint<AgentTool>("/agent/tools?enabledOnly=false", [], normalizeAgentTool),
  listRuntimeEvents: async () => {
    const result = await requestWithFallback<unknown>("/agent/runtime-events?limit=20", pageOf<RuntimeEvent>([]));
    return {
      ...result,
      data: normalizeRuntimeEventPage(result.data, []),
    };
  },
  listServiceHealth: async () => {
    const result = await requestWithFallback<unknown>(
      "/observability/platform/service-health-snapshots",
      serviceHealth,
    );
    return {
      ...result,
      data: normalizeServiceHealth(result.data, result.meta.source === "mock" ? serviceHealth : []),
    };
  },
  listRoles: () => arrayEndpoint<PermissionRole>("/permission/roles", roles, normalizeRole),
  listPermissionMenus: (tenantId: number | string | undefined, roleCode: string) => {
    const query = compactQueryString({ tenantId, roleCode });
    return arrayEndpoint<PermissionMenuRecord>(`/permission/menus?${query}`, [], normalizePermissionMenu);
  },
  listTenants: (params?: TenantListParams) => {
    const query = compactQueryString({ current: 1, size: 20, ...params });
    return pageEndpoint<PermissionTenantRecord>(`/permission/tenants?${query}`, [], normalizePermissionTenant);
  },
  getTenant: (tenantId: number) =>
    request<PermissionTenantRecord>(`/permission/tenants/${tenantId}`),
  openTenant: (payload: TenantOpenPayload) =>
    postJson<PermissionTenantRecord>("/permission/tenants", payload),
  updateTenant: (tenantId: number, payload: TenantUpdatePayload) =>
    putJson<PermissionTenantRecord>(`/permission/tenants/${tenantId}`, payload),
  activateTenant: (tenantId: number, reason: string) =>
    postJson<PermissionTenantRecord>(`/permission/tenants/${tenantId}/activate`, { reason }),
  suspendTenant: (tenantId: number, reason: string) =>
    postJson<PermissionTenantRecord>(`/permission/tenants/${tenantId}/suspend`, { reason }),
  closeTenant: (tenantId: number, reason: string) =>
    postJson<PermissionTenantRecord>(`/permission/tenants/${tenantId}/close`, { reason }),
  listRoutePolicies: () =>
    arrayEndpoint<RoutePolicy>("/permission/route-policies", routePolicies, normalizeRoutePolicy),
  listProjects: (params?: ProjectListParams) => {
    const query = compactQueryString({ current: 1, size: 50, onlyMine: true, ...params });
    return pageEndpoint<ProjectRecord>("/permission/projects?" + query, [], normalizeProject);
  },
  createProject: (payload: ProjectCreatePayload) =>
    postJson<ProjectRecord>("/permission/projects", payload),
  listProjectMemberships: (params?: ProjectMembershipQueryParams) => {
    const query = compactQueryString({ current: 1, size: 20, ...params });
    return pageEndpoint<ProjectMembershipRecord>(
      `/permission/project-memberships?${query}`,
      [],
      normalizeProjectMembership,
    );
  },
  updateProjectMembership: (membershipId: number, payload: ProjectMembershipUpdatePayload) =>
    putJson<unknown>(`/permission/project-memberships/${membershipId}`, payload),
  enableProjectMembership: (membershipId: number, reason?: string) =>
    postJson<unknown>(`/permission/project-memberships/${membershipId}/enable`, { reason }),
  disableProjectMembership: (membershipId: number, reason?: string) =>
    postJson<unknown>(`/permission/project-memberships/${membershipId}/disable`, { reason }),
  applyProjectCreationRequest: (payload: ProjectCreationRequestApplyPayload) =>
    postJson<ProjectCreationRequestRecord>("/permission/project-creation-requests", payload),
  listMyProjectCreationRequests: (params?: ProjectCreationRequestQueryParams) => {
    const query = compactQueryString({ current: 1, size: 20, ...params });
    return pageEndpoint<ProjectCreationRequestRecord>(
      `/permission/project-creation-requests/my?${query}`,
      [],
      normalizeProjectCreationRequest,
    );
  },
  listProjectCreationApprovals: (params?: ProjectCreationRequestQueryParams) => {
    const query = compactQueryString({ current: 1, size: 20, status: "PENDING", ...params });
    return pageEndpoint<ProjectCreationRequestRecord>(
      `/permission/project-creation-requests/approvals?${query}`,
      [],
      normalizeProjectCreationRequest,
    );
  },
  approveProjectCreationRequest: (requestId: number, payload?: ProjectCreationRequestReviewPayload) =>
    postJson<ProjectCreationRequestRecord>(`/permission/project-creation-requests/${requestId}/approve`, payload ?? {}),
  rejectProjectCreationRequest: (requestId: number, payload?: ProjectCreationRequestReviewPayload) =>
    postJson<ProjectCreationRequestRecord>(`/permission/project-creation-requests/${requestId}/reject`, payload ?? {}),
  cancelProjectCreationRequest: (requestId: number) =>
    postJson<ProjectCreationRequestRecord>(`/permission/project-creation-requests/${requestId}/cancel`),
  listMyApprovalRequests: (params?: ApprovalCenterQueryParams) => {
    const query = compactQueryString({ current: 1, size: 20, ...params });
    return pageEndpoint<ApprovalCenterRecord>(
      `/permission/approval-center/my?${query}`,
      [],
      normalizeApprovalCenterRecord,
    );
  },
  listPendingApprovalRequests: (params?: ApprovalCenterQueryParams) => {
    const query = compactQueryString({ current: 1, size: 20, status: "PENDING", ...params });
    return pageEndpoint<ApprovalCenterRecord>(
      `/permission/approval-center/pending?${query}`,
      [],
      normalizeApprovalCenterRecord,
    );
  },
  approveApprovalRequest: (requestType: string, requestId: number, payload?: ApprovalCenterReviewPayload) =>
    postJson<ApprovalCenterRecord>(
      `/permission/approval-center/${encodeURIComponent(requestType)}/${requestId}/approve`,
      payload ?? {},
    ),
  rejectApprovalRequest: (requestType: string, requestId: number, payload?: ApprovalCenterReviewPayload) =>
    postJson<ApprovalCenterRecord>(
      `/permission/approval-center/${encodeURIComponent(requestType)}/${requestId}/reject`,
      payload ?? {},
    ),
  cancelApprovalRequest: (requestType: string, requestId: number) =>
    postJson<ApprovalCenterRecord>(
      `/permission/approval-center/${encodeURIComponent(requestType)}/${requestId}/cancel`,
    ),
  applyProjectJoinRequest: (payload: ProjectJoinRequestApplyPayload) =>
    postJson<ProjectJoinRequestRecord>("/permission/project-join-requests", payload),
  listProjectJoinCandidates: (params?: ProjectJoinCandidateParams) => {
    const query = compactQueryString({ current: 1, size: 100, ...params });
    return pageEndpoint<ProjectJoinCandidateRecord>(
      `/permission/project-join-requests/candidates?${query}`,
      [],
      normalizeProjectJoinCandidate,
    );
  },
  listMyProjectJoinRequests: (params?: ProjectJoinRequestQueryParams) => {
    const query = compactQueryString({ current: 1, size: 20, ...params });
    return pageEndpoint<ProjectJoinRequestRecord>(
      `/permission/project-join-requests/my?${query}`,
      [],
      normalizeProjectJoinRequest,
    );
  },
  listProjectJoinApprovals: (params?: ProjectJoinRequestQueryParams) => {
    const query = compactQueryString({ current: 1, size: 20, status: "PENDING", ...params });
    return pageEndpoint<ProjectJoinRequestRecord>(
      `/permission/project-join-requests/approvals?${query}`,
      [],
      normalizeProjectJoinRequest,
    );
  },
  approveProjectJoinRequest: (requestId: number, payload?: ProjectJoinRequestReviewPayload) =>
    postJson<ProjectJoinRequestRecord>(`/permission/project-join-requests/${requestId}/approve`, payload ?? {}),
  rejectProjectJoinRequest: (requestId: number, payload?: ProjectJoinRequestReviewPayload) =>
    postJson<ProjectJoinRequestRecord>(`/permission/project-join-requests/${requestId}/reject`, payload ?? {}),
  cancelProjectJoinRequest: (requestId: number) =>
    postJson<ProjectJoinRequestRecord>(`/permission/project-join-requests/${requestId}/cancel`),
};
