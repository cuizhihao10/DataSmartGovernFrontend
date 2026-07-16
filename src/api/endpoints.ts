import { ApiError, request, requestFile, requestForm, requestWithFallback } from "@/api/client";
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
  AgentPlanCore,
  AgentPlanResponse,
  AgentConversation,
  AgentClarificationQuestion,
  AgentStructuredIntent,
  AgentRagQueryResult,
  AgentRun,
  AgentRunConfirmedExecutionResponse,
  AgentSession,
  AgentTool,
  AgentToolBinding,
  AgentToolExecutionAudit,
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
  SyncTaskMetadataDiscoveryResult,
  SyncTaskOperationResult,
  SyncTask,
  SyncTemplate,
  SyncTemplateExecutionPrecheckResponse,
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

export interface CreateSyncTemplatePayload {
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

export interface CreateSyncTaskPayload {
  tenantId?: number;
  projectId?: number;
  workspaceId?: number;
  templateId: number;
  groupCode?: string;
  groupName?: string;
  name?: string;
  description?: string;
  priority?: string;
  scheduleConfig?: string;
  runMode?: string;
  ownerId?: number;
}

export interface SyncTaskCreateWizardDraftPayload extends Omit<CreateSyncTemplatePayload, "name"> {
  taskId?: number;
  templateId?: number;
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
  templateId: number;
  created: boolean;
  currentState: string;
  scheduleEnabled?: boolean;
  nextFireTime?: string;
  groupCode?: string;
  groupName?: string;
  nextActions?: string[];
  task?: SyncTask;
  template?: SyncTemplate;
}

export interface SyncTaskQueryParams {
  tenantId?: number;
  projectId?: number;
  workspaceId?: number;
  templateId?: number;
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

function normalizeSyncTemplate(value: unknown, index: number): SyncTemplate {
  const record = isRecord(value) ? value : {};
  const id = readNumber(record.id, index + 1);
  return {
    id,
    tenantId: readOptionalNumber(record.tenantId),
    projectId: readOptionalNumber(record.projectId),
    workspaceId: readOptionalNumber(record.workspaceId),
    name: readString(record.name, `sync-template-${id}`),
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
    templateId: readNumber(record.templateId),
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
    templateId: readOptionalNumber(record.templateId),
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
    templateId: readOptionalNumber(record.templateId),
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
    runId: readString(record.runId, `run-${index + 1}`),
    sessionId: readString(record.sessionId),
    state: readString(record.state, "UNKNOWN"),
    workloadType: readOptionalString(record.workloadType),
    userInputPreview: readOptionalString(record.userInputPreview),
    dryRun: readBoolean(record.dryRun, true),
    requireHumanApproval: readBoolean(record.requireHumanApproval),
    nextActions: readStringArray(record.nextActions),
    variables: readRecord(record.variables),
    createTime: readOptionalString(record.createTime),
    updateTime: readOptionalString(record.updateTime),
    finishTime: readOptionalString(record.finishTime),
    message: readOptionalString(record.message),
  };
}

function normalizeAgentSession(value: unknown, index: number): AgentSession {
  const record = isRecord(value) ? value : {};
  const workspace = isRecord(record.workspace) ? record.workspace : undefined;
  return {
    sessionId: readString(record.sessionId, `session-${index + 1}`),
    tenantId: readOptionalNumber(record.tenantId),
    projectId: readOptionalNumber(record.projectId),
    workspaceId: readOptionalNumber(record.workspaceId),
    actorId: readString(record.actorId, "-"),
    channel: readOptionalString(record.channel),
    objective: readString(record.objective),
    state: readString(record.state, "UNKNOWN"),
    workspace,
    toolBindings: Array.isArray(record.toolBindings)
      ? record.toolBindings.map(normalizeAgentToolBinding)
      : [],
    runs: Array.isArray(record.runs) ? record.runs.map(normalizeAgentRun) : [],
    createTime: readOptionalString(record.createTime),
    updateTime: readOptionalString(record.updateTime),
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
  return {
    parameterName: readString(record.parameterName),
    fieldPath: readString(record.fieldPath),
    label: readString(record.label),
    question: readString(record.question),
    inputType: readString(record.inputType, "TEXT"),
    required: readBoolean(record.required, true),
    sensitive: readBoolean(record.sensitive),
  };
}

function normalizeAgentStructuredIntent(value: unknown): AgentStructuredIntent {
  const record = readRecord(value);
  return {
    intentType: readString(record.intentType, "GENERAL_GOVERNANCE_REQUEST"),
    domains: readStringArray(record.domains),
    candidateTools: readStringArray(record.candidateTools),
    riskTags: readStringArray(record.riskTags),
    confidence: readNumber(record.confidence),
    summary: readOptionalString(record.summary),
    syncMode: readOptionalString(record.syncMode),
    writeStrategy: readOptionalString(record.writeStrategy),
    sourceDatasourceSelected: readBoolean(record.sourceDatasourceSelected),
    targetDatasourceSelected: readBoolean(record.targetDatasourceSelected),
    objectMappingCount: readNumber(record.objectMappingCount),
  };
}

function normalizeAgentConversation(value: unknown): AgentConversation | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return {
    schemaVersion: readString(value.schemaVersion, "1.0"),
    turnId: readOptionalString(value.turnId),
    phase: readString(value.phase, "NO_EXECUTABLE_PLAN"),
    assistantMessage: readString(value.assistantMessage),
    structuredIntent: normalizeAgentStructuredIntent(value.structuredIntent),
    missingParameters: readStringArray(value.missingParameters),
    clarificationQuestions: Array.isArray(value.clarificationQuestions)
      ? value.clarificationQuestions.map(normalizeAgentClarificationQuestion)
      : [],
    canExecute: readBoolean(value.canExecute),
    controlPlaneIngested: readBoolean(value.controlPlaneIngested),
    nextAction: readString(value.nextAction),
    intentResolver: readRecord(value.intentResolver),
    payloadPolicy: readOptionalString(value.payloadPolicy),
  };
}

function normalizeAgentPlanResponse(value: unknown): AgentPlanResponse {
  const record = readRecord(value);
  return {
    plan: normalizeAgentPlanCore(record.plan),
    eventEnvelope: readRecord(record.eventEnvelope),
    modelGatewayGovernance: readRecord(record.modelGatewayGovernance),
    intelligentGatewayGovernance: readRecord(record.intelligentGatewayGovernance),
    toolExecutionReadiness: readRecord(record.toolExecutionReadiness),
    toolExecutionReadinessGraph: readRecord(record.toolExecutionReadinessGraph),
    agentExecutionGateWorkflow: readRecord(record.agentExecutionGateWorkflow),
    agentExecutionClosure: readRecord(record.agentExecutionClosure),
    agentCapabilityClosure: readRecord(record.agentCapabilityClosure),
    controlPlaneIngestion: readRecord(record.controlPlaneIngestion),
    controlPlaneFeedback: readRecord(record.controlPlaneFeedback),
    agentWorkflowDiagnostics: readRecord(record.agentWorkflowDiagnostics),
    agentCollaborationWorkflow: readRecord(record.agentCollaborationWorkflow),
    agentCollaborationExecutionPlan: readRecord(record.agentCollaborationExecutionPlan),
    agentExecutionSession: readRecord(record.agentExecutionSession),
    agentTurnRunner: readRecord(record.agentTurnRunner),
    agentMemoryRetrievalWorkflow: readRecord(record.agentMemoryRetrievalWorkflow),
    agentConversation: normalizeAgentConversation(record.agentConversation),
    raw: record,
  };
}

function normalizeAgentToolExecutionAudit(value: unknown, index: number): AgentToolExecutionAudit {
  const record = isRecord(value) ? value : {};
  return {
    auditId: readString(record.auditId, `audit-${index + 1}`),
    sessionId: readString(record.sessionId),
    runId: readString(record.runId),
    bindingId: readOptionalString(record.bindingId),
    toolCode: readString(record.toolCode, `tool-${index + 1}`),
    toolType: readOptionalString(record.toolType),
    targetService: readOptionalString(record.targetService),
    targetEndpoint: readOptionalString(record.targetEndpoint),
    targetResourceId: readOptionalNumber(record.targetResourceId),
    tenantId: readOptionalNumber(record.tenantId),
    projectId: readOptionalNumber(record.projectId),
    workspaceId: readOptionalNumber(record.workspaceId),
    actorId: readOptionalString(record.actorId),
    riskLevel: normalizeRisk(record.riskLevel),
    executionMode: normalizeAgentExecutionMode(record.executionMode),
    requiresApproval: readBoolean(record.requiresApproval),
    readOnly: readBoolean(record.readOnly),
    idempotent: readBoolean(record.idempotent),
    allowedActions: readStringArray(record.allowedActions),
    planReason: readOptionalString(record.planReason),
    planArguments: readRecord(record.planArguments),
    governanceHints: readRecord(record.governanceHints),
    parameterValidation: readRecord(record.parameterValidation),
    state: readString(record.state, "UNKNOWN"),
    traceId: readOptionalString(record.traceId),
    message: readOptionalString(record.message),
    approvalOperatorId: readOptionalString(record.approvalOperatorId),
    approvalComment: readOptionalString(record.approvalComment),
    approvalTime: readOptionalString(record.approvalTime),
    outputSummary: readOptionalString(record.outputSummary),
    errorCode: readOptionalString(record.errorCode),
    createTime: readOptionalString(record.createTime),
    updateTime: readOptionalString(record.updateTime),
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
  { key: "syncTemplates", name: "同步模板", path: "/sync/sync-templates?current=1&size=1" },
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
    const query = compactQueryString({ current: 1, size: 50, ...params });
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
  createSyncTemplate: (payload: CreateSyncTemplatePayload) =>
    postJson<SyncTemplate>("/sync/sync-templates", payload),
  validateSyncTemplate: (id: number) => postJson<unknown>(`/sync/sync-templates/${id}/validate`),
  getSyncTemplate: async (id: number) => {
    const result = await request<unknown>(`/sync/sync-templates/${id}`);
    return {
      ...result,
      data: normalizeSyncTemplate(result.data, 0),
    };
  },
  previewSyncTemplate: (id: number) => postJson<unknown>(`/sync/sync-templates/${id}/preview`),
  precheckSyncTemplate: (id: number) =>
    postJson<SyncTemplateExecutionPrecheckResponse>(`/sync/sync-templates/${id}/precheck`),
  buildSyncOfflineJobPlan: (id: number) =>
    postJson<Record<string, unknown>>(`/sync/sync-templates/${id}/offline-job-plan`),
  listSyncTemplates: () =>
    pageEndpoint<SyncTemplate>("/sync/sync-templates?current=1&size=20", [], normalizeSyncTemplate),
  createSyncTask: (payload: CreateSyncTaskPayload) => postJson<SyncTask>("/sync/sync-tasks", payload),
  getSyncTask: async (id: number) => {
    const result = await request<unknown>(`/sync/sync-tasks/${id}`);
    return {
      ...result,
      data: normalizeSyncTask(result.data, 0),
    };
  },
  saveSyncTaskCreateWizardDraft: (payload: SyncTaskCreateWizardDraftPayload) =>
    postJson<SyncTaskCreateWizardDraftResult>("/sync/sync-tasks/create-wizard/drafts", payload),
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
  listAgentSessions: () => arrayEndpoint<AgentSession>("/agent/sessions", [], normalizeAgentSession),
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
  getAgentToolExecutionPolicy: (sessionId: string, runId: string) =>
    request<Record<string, unknown>>(`/agent/sessions/${sessionId}/runs/${runId}/tool-executions/execution-policy`),
  getAgentToolDagPlan: (sessionId: string, runId: string) =>
    request<Record<string, unknown>>(`/agent/sessions/${sessionId}/runs/${runId}/tool-executions/dag-plan`),
  getAgentAsyncCommandPlans: (sessionId: string, runId: string) =>
    request<Record<string, unknown>>(`/agent/sessions/${sessionId}/runs/${runId}/tool-executions/async-command-plans`),
  confirmAndExecuteAgentRun: (sessionId: string, runId: string, payload: ConfirmAgentRunPayload) =>
    postJson<AgentRunConfirmedExecutionResponse>(
      `/agent/sessions/${sessionId}/runs/${runId}/confirm-and-execute`,
      payload,
    ),
  createAgentPlan: async (payload: CreateAgentPlanPayload) => {
    const result = await postJson<unknown>("/agent/plans", payload);
    return {
      ...result,
      data: normalizeAgentPlanResponse(result.data),
    };
  },
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
