import type { ReactNode } from "react";

export type PlatformHealth = "UP" | "DEGRADED" | "DOWN" | "UNKNOWN";
export type LifecycleStatus =
  | "DRAFT"
  | "PENDING"
  | "PENDING_REVIEW"
  | "SCHEDULED"
  | "RUNNING"
  | "PAUSED"
  | "DEFERRED"
  | "SUCCEEDED"
  | "PARTIAL_SUCCEEDED"
  | "FAILED"
  | "DEAD_LETTER"
  | "CANCELLED"
  | "ARCHIVED";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type SyncTaskState =
  | "DRAFT"
  | "CONFIGURED"
  | "PENDING_APPROVAL"
  | "SCHEDULED"
  | "QUEUED"
  | "RUNNING"
  | "PAUSED"
  | "RETRYING"
  | "PARTIALLY_SUCCEEDED"
  | "SUCCEEDED"
  | "FAILED"
  | "AWAITING_OPERATOR_ACTION"
  | "MANUALLY_TERMINATED"
  | "OFFLINE"
  | "RECYCLED"
  | "CANCELLED"
  | "ARCHIVED"
  | "DELETED";

export type SyncApprovalState = "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED";
export type SyncExecutionState =
  | "QUEUED"
  | "RUNNING"
  | "PAUSED"
  | "RETRYING"
  | "PARTIALLY_SUCCEEDED"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "MANUALLY_TERMINATED"
  | "SKIPPED";

export interface PlatformApiResponse<T> {
  code: number;
  reason?: string;
  message?: string;
  data: T;
  traceId?: string;
  timestamp?: string;
}

export interface PlatformPageResponse<T> {
  current: number;
  size: number;
  total: number;
  pages: number;
  records: T[];
}

export interface RequestMeta {
  source: "api" | "mock";
  traceId?: string;
  message?: string;
}

export interface WithMeta<T> {
  data: T;
  meta: RequestMeta;
}

export interface DashboardKpi {
  key: string;
  title: string;
  value: number | string;
  suffix?: string;
  trend: "up" | "down" | "flat";
  delta: string;
  tone: "blue" | "green" | "amber" | "red" | "violet";
}

export interface ServiceHealth {
  key: string;
  serviceName: string;
  domain: string;
  status: PlatformHealth;
  port: number;
  p95LatencyMs: number;
  errorRate: number;
  updatedAt: string;
}

export interface QueueSnapshot {
  key: string;
  name: string;
  pending: number;
  running: number;
  failed: number;
  maxLagSeconds: number;
}

export interface AgentSnapshot {
  key: string;
  name: string;
  role: string;
  status: PlatformHealth;
  activeRuns: number;
  risk: RiskLevel;
  tools: string[];
}

export type DataSourceUsageRole = "SOURCE" | "TARGET";

export interface DataSourceRecord {
  id: number;
  tenantId?: number;
  projectId?: number;
  workspaceId?: number;
  name: string;
  type: string;
  jdbcUrl?: string;
  username?: string;
  description?: string;
  environment: "DEV" | "TEST" | "PROD";
  owner: string;
  usageRole?: DataSourceUsageRole;
  status: "ENABLED" | "DISABLED" | "TESTING" | "ERROR";
  sensitivity: RiskLevel;
  tableCount: number;
  lastSyncAt: string;
  connectionHealth: PlatformHealth;
}

export interface DataSourceColumnMetadata {
  columnName: string;
  dataTypeName?: string;
  columnSize?: number;
  nullable: boolean;
  defaultValue?: string;
  decimalDigits?: number;
  autoIncrement: boolean;
  primaryKey: boolean;
  remarks?: string;
  ordinalPosition?: number;
}

export interface DataSourceTableMetadata {
  catalog?: string;
  schemaName?: string;
  tableName: string;
  tableType?: string;
  remarks?: string;
  columnCount?: number;
  totalColumnCount?: number;
  columnsTruncated?: boolean;
  primaryKeys?: string[];
  columns?: DataSourceColumnMetadata[];
}

export interface DataSourceMetadataDiscoveryResult {
  datasourceId: number;
  datasourceName?: string;
  datasourceType?: string;
  productName?: string;
  productVersion?: string;
  catalog?: string;
  schemaPattern?: string;
  tableNamePattern?: string;
  tableCount?: number;
  cacheHit?: boolean;
  discoveryDurationMs?: number;
  discoveredAt?: string;
  tables?: DataSourceTableMetadata[];
  warnings?: string[];
}

export interface DataSourceConnectionTestResult {
  datasourceId: number;
  testStatus: "SUCCESS" | "FAILED" | "UNKNOWN" | string;
  message?: string;
  testedAt?: string;
  productName?: string;
  productVersion?: string;
  driverName?: string;
  currentCatalog?: string;
  currentSchema?: string;
  metadataDiscoverable?: boolean;
  discoveredTableCount?: number;
  warnings?: string[];
}

export interface DataSourceAuthorizationRecord {
  id: number;
  datasourceId: number;
  datasourceName?: string;
  datasourceType?: string;
  tenantId?: number;
  projectId?: number;
  subjectType: "USER" | "ROLE" | "SERVICE_ACCOUNT" | string;
  subjectId: string;
  subjectName?: string;
  subjectRole?: string;
  authorizedActions?: string;
  grantSource?: string;
  status?: string;
  grantReason?: string;
  expireTime?: string;
  grantedByActorId?: string;
  grantedByActorRole?: string;
  grantedTime?: string;
  revokedByActorId?: string;
  revokedByActorRole?: string;
  revokeReason?: string;
  revokedTime?: string;
  createTime?: string;
  updateTime?: string;
}

export interface AuthorizationSubjectCandidate {
  subjectType: "USER" | "ROLE" | "SERVICE_ACCOUNT" | string;
  subjectId: string;
  subjectName?: string;
  subjectRole?: string;
  actorType?: string;
  tenantId?: number;
  projectId?: number;
  username?: string;
  maskedEmail?: string;
  status?: string;
  sourceType?: string;
  selectable?: boolean;
  disabledReason?: string;
}

export interface GovernanceTask {
  id: number;
  taskCode: string;
  name: string;
  type: string;
  status: LifecycleStatus;
  priority: "LOW" | "MEDIUM" | "NORMAL" | "HIGH" | "URGENT";
  owner: string;
  progress: number;
  retryCount: number;
  nextFireAt?: string;
  updatedAt: string;
}

export interface QualityRule {
  id: number;
  name: string;
  datasourceName: string;
  targetTable: string;
  ruleType: string;
  status: "ENABLED" | "DISABLED" | "ARCHIVED";
  severity: RiskLevel;
  passRate: number;
  anomalyCount: number;
  lastRunAt: string;
}

export interface QualityReport {
  id: string;
  ruleName: string;
  score: number;
  status: "PASSED" | "WARNING" | "FAILED";
  anomalies: number;
  generatedAt: string;
}

export interface SyncTemplate {
  id: number;
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
  enabled: boolean;
  createdBy?: number;
  updatedBy?: number;
  createTime?: string;
  updateTime?: string;
}

export interface SyncTask {
  id: number;
  tenantId?: number;
  projectId?: number;
  workspaceId?: number;
  templateId: number;
  groupCode?: string;
  groupName?: string;
  name: string;
  currentState: SyncTaskState | string;
  approvalState: SyncApprovalState | string;
  priority: "LOW" | "MEDIUM" | "NORMAL" | "HIGH" | "URGENT" | string;
  scheduleConfig?: string;
  scheduleEnabled?: boolean;
  nextFireTime?: string;
  lastFireTime?: string;
  scheduleMisfireCount?: number;
  scheduleDispatchCount?: number;
  scheduleVersion?: number;
  runMode?: string;
  triggerType?: string;
  ownerId?: number;
  lastExecutionId?: number;
  attentionRequired: boolean;
  attentionReason?: string;
  description?: string;
  createTime?: string;
  updateTime?: string;
}

export interface SyncTaskGroupSummary {
  /**
   * 后端生成的前端树节点稳定 key。
   *
   * 分组编码 groupCode 只在同一个租户/项目作用域内唯一，历史 DEFAULT 分组尤其容易重复。
   * 前端渲染树、记录选中态和展开态时应优先使用 treeKey，避免把多个默认分组误合并或误覆盖。
   */
  treeKey?: string;
  scopeType?: string;
  scopeLabel?: string;
  displayName?: string;
  displayPath?: string;
  tenantId?: number;
  projectId?: number;
  workspaceId?: number;
  groupCode: string;
  groupName?: string;
  taskCount: number;
  activeTaskCount: number;
  scheduledTaskCount: number;
  runningTaskCount: number;
  failedTaskCount: number;
  recycledTaskCount: number;
  /**
   * 当前分组及子分组的汇总计数。
   *
   * taskCount 表示直接挂在当前分组下的任务数；subtreeTaskCount 表示包含所有子分组后的数量。
   * 左侧“全部同步任务”和父分组徽标应优先使用 subtree*，否则多级分组下会出现数量少算。
   */
  subtreeTaskCount?: number;
  subtreeActiveTaskCount?: number;
  subtreeScheduledTaskCount?: number;
  subtreeRunningTaskCount?: number;
  subtreeFailedTaskCount?: number;
  subtreeRecycledTaskCount?: number;
  lastUpdateTime?: string;
}

export interface SyncTaskGroupTreeNode extends SyncTaskGroupSummary {
  id?: number;
  parentGroupCode?: string;
  description?: string;
  displayOrder?: number;
  defaultGroup?: boolean;
  legacyOnly?: boolean;
  children?: SyncTaskGroupTreeNode[];
}

export interface SyncTaskOperationResult {
  taskId: number;
  state: string;
  message?: string;
}

export interface SyncTaskBatchItemResult {
  taskId?: number;
  resultTaskId?: number;
  success: boolean;
  code: string;
  state?: string;
  message?: string;
}

export interface SyncTaskBatchOperationResult {
  operationType: string;
  status: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  continueOnError: boolean;
  items: SyncTaskBatchItemResult[];
}

export interface SyncTaskImportRowResult {
  rowNumber: number;
  taskId?: number;
  name?: string;
  status: string;
  currentState?: string;
  message?: string;
}

export interface SyncTaskImportResult {
  dryRun: boolean;
  runImmediately: boolean;
  totalRows: number;
  validRows: number;
  createdCount: number;
  draftCount: number;
  queuedCount: number;
  conflictCount: number;
  failedCount: number;
  status: string;
  message?: string;
  rows: SyncTaskImportRowResult[];
}

export interface SyncTaskMetadataField {
  fieldName: string;
  dataTypeName?: string;
  nullable?: boolean;
  primaryKey?: boolean;
  ordinalPosition?: number;
  syncEnabled?: boolean;
}

export interface SyncTaskMetadataTable {
  catalog?: string;
  schemaName?: string;
  tableName: string;
  tableType?: string;
  primaryKeys?: string[];
  fields?: SyncTaskMetadataField[];
}

export interface SyncTaskMetadataDiscoveryResult {
  datasourceId: number;
  side?: string;
  connectorType?: string;
  filterMode?: string;
  discoverable?: boolean;
  schemas?: string[];
  tables?: SyncTaskMetadataTable[];
  warnings?: string[];
}

export interface SyncTemplateExecutionPrecheckResponse {
  templateId?: number;
  tenantId?: number;
  projectId?: number;
  workspaceId?: number;
  syncMode?: string;
  transferChannel?: string;
  referenceRuntime?: string;
  syncScopeType?: string;
  precheckStatus?: string;
  canCreateTaskDraft?: boolean;
  canStartExecution?: boolean;
  connectorFactsComplete?: boolean;
  connectorCompatibilitySupported?: boolean;
  scopeContractValid?: boolean;
  fieldMappingDeclared?: boolean;
  fieldMappingRunnableByMinimalBridge?: boolean;
  objectMappingDeclared?: boolean;
  customSqlDeclared?: boolean;
  customSqlSafetyPassed?: boolean;
  approvalRequired?: boolean;
  executableByCurrentRunner?: boolean;
  checkpointRequired?: boolean;
  checkpointHandoffSupported?: boolean;
  issueCodes?: string[];
  recommendedActions?: string[];
  performanceNotes?: string[];
  safetyNotes?: string[];
  payloadPolicy?: string;
}

export interface SyncTaskFieldMappingSuggestionItem {
  sourceField: string;
  sourceType?: string;
  targetField?: string;
  targetType?: string;
  syncEnabled?: boolean;
  typeCompatible?: boolean;
  primaryKey?: boolean;
  nullable?: boolean;
  compatibilityNote?: string;
}

export interface SyncTaskFieldMappingSuggestionResult {
  sourceDatasourceId: number;
  targetDatasourceId: number;
  sourceConnectorType?: string;
  targetConnectorType?: string;
  sourceTable?: string;
  targetTable?: string;
  mappings: SyncTaskFieldMappingSuggestionItem[];
  warnings?: string[];
}

export interface SyncExecution {
  id: number;
  tenantId?: number;
  projectId?: number;
  workspaceId?: number;
  syncTaskId: number;
  executionNo?: number;
  executionState: SyncExecutionState | string;
  triggerType?: string;
  queuedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  checkpointRef?: string;
  recordsRead: number;
  recordsWritten: number;
  failedRecordCount: number;
  errorSummary?: string;
  triggeredBy?: number;
  executorId?: string;
  heartbeatTime?: string;
  leaseExpireTime?: string;
  deferCount: number;
  createTime?: string;
  updateTime?: string;
}

export interface SyncExecutionLog {
  id: number;
  tenantId?: number;
  projectId?: number;
  workspaceId?: number;
  syncTaskId: number;
  executionId: number;
  logStage?: string;
  logLevel?: string;
  eventType?: string;
  eventStatus?: string;
  message?: string;
  detailSummary?: string;
  executorId?: string;
  workUnitType?: string;
  objectExecutionId?: number;
  objectOrdinal?: number;
  shardOrPartition?: string;
  recordsRead?: number;
  recordsWritten?: number;
  failedRecordCount?: number;
  completedWorkUnits?: number;
  succeededWorkUnits?: number;
  failedWorkUnits?: number;
  progressPercent?: number;
  speedRowsPerSecond?: number;
  eventTime?: string;
  traceId?: string;
  payloadPolicy?: string;
  createTime?: string;
}

export interface SyncExecutionPolicy {
  id: number;
  tenantId?: number;
  projectId?: number;
  scopeType: string;
  scopeKey?: string;
  scopeName?: string;
  policyCode?: string;
  policyName?: string;
  enabled: boolean;
  datasourceId?: number;
  connectorType?: string;
  connectorRole?: string;
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
  createTime?: string;
  updateTime?: string;
}

export interface SyncExecutionPolicySnapshot {
  id: number;
  tenantId?: number;
  projectId?: number;
  syncTaskId: number;
  executionId: number;
  policyCodeSummary?: string;
  matchedPolicyCodes?: string[];
  resolutionOrder?: string;
  targetRowsPerShard?: number;
  resolvedShardCount?: number;
  resolvedChannel?: number;
  taskGroupSize?: number;
  readBatchSize?: number;
  writeBatchSize?: number;
  commitIntervalRecords?: number;
  timeoutSeconds?: number;
  maxRetryCount?: number;
  maxDirtyRecordCount?: number;
  maxDirtyRecordRatio?: number;
  payloadPolicy?: string;
  snapshotJson?: string;
  createTime?: string;
  updateTime?: string;
}

export interface SyncObjectExecution {
  id: number;
  tenantId?: number;
  projectId?: number;
  workspaceId?: number;
  syncTaskId: number;
  executionId: number;
  templateId?: number;
  objectOrdinal?: number;
  workUnitType?: string;
  shardOrPartition?: string;
  partitionStrategy?: string;
  partitionField?: string;
  sourceSchemaName?: string;
  sourceObjectName?: string;
  targetSchemaName?: string;
  targetObjectName?: string;
  objectState: string;
  attemptCount?: number;
  maxAttemptCount?: number;
  recordsRead: number;
  recordsWritten: number;
  failedRecordCount: number;
  lastErrorType?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  startedAt?: string;
  finishedAt?: string;
  payloadPolicy?: string;
  createTime?: string;
  updateTime?: string;
}

export interface SyncErrorSample {
  id: number;
  tenantId?: number;
  projectId?: number;
  workspaceId?: number;
  syncTaskId: number;
  executionId: number;
  errorType?: string;
  errorCode?: string;
  errorMessage?: string;
  sourceRecordKey?: string;
  targetRecordKey?: string;
  samplePayload?: string;
  retryable: boolean;
  createTime?: string;
}

export interface SyncCheckpoint {
  id: number;
  tenantId?: number;
  projectId?: number;
  workspaceId?: number;
  syncTaskId: number;
  executionId?: number;
  checkpointType?: string;
  checkpointValue?: string;
  shardOrPartition?: string;
  recordsRead?: number;
  recordsWritten?: number;
  checkpointTime?: string;
  createTime?: string;
  updateTime?: string;
}

export interface SyncAuditRecord {
  id: number;
  tenantId?: number;
  projectId?: number;
  workspaceId?: number;
  templateId?: number;
  syncTaskId?: number;
  executionId?: number;
  actionType?: string;
  actorId?: number;
  actorRole?: string;
  actionPayload?: string;
  result?: string;
  traceId?: string;
  createTime?: string;
}

export interface SyncIncident {
  id: number;
  tenantId?: number;
  projectId?: number;
  workspaceId?: number;
  syncTaskId?: number;
  executionId?: number;
  incidentType: string;
  severity: string;
  incidentStatus: string;
  title: string;
  description?: string;
  operatorId?: number;
  assignedOperatorId?: number;
  resolutionSummary?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  createTime?: string;
  updateTime?: string;
}

export interface SyncConnectorCapability {
  connectorType: string;
  displayName: string;
  supportLevel: string;
  canRead: boolean;
  canWrite: boolean;
  supportsMetadataDiscovery: boolean;
  supportsSchemaDiscovery: boolean;
  supportsFieldSampling: boolean;
  supportsPreview: boolean;
  supportsFullSync: boolean;
  supportsIncrementalSync: boolean;
  supportsStreaming: boolean;
  supportsCheckpointResume: boolean;
  supportsPartitionParallelism: boolean;
  supportsFieldMapping: boolean;
  supportsTransformationHook: boolean;
  supportsDataValidation: boolean;
  supportsAdminThrottling: boolean;
  supportedModes: string[];
  recommendedCheckpointTypes: string[];
  performanceNotes: string[];
  safetyNotes: string[];
}

export interface SyncConnectorCompatibility {
  sourceConnectorType: string;
  targetConnectorType: string;
  syncMode: string;
  supported: boolean;
  consistencyGoal?: string;
  checkpointRequired: boolean;
  retryPattern?: string;
  issueCodes: string[];
  recommendedActions: string[];
  payloadPolicy?: string;
  performanceNotes: string[];
  safetyNotes: string[];
}

export interface PermissionRole {
  id: string;
  name: string;
  code: string;
  scope: "PLATFORM" | "TENANT" | "PROJECT";
  members: number;
  enabled: boolean;
  policyCount: number;
}

export interface RoutePolicy {
  id: string;
  pathPattern: string;
  resourceType: string;
  defaultAction: string;
  enabled: boolean;
}

export type JsonObject = Record<string, unknown>;
export type AgentExecutionMode =
  | "SYNC"
  | "ASYNC"
  | "ASYNC_TASK"
  | "DRAFT_ONLY"
  | "APPROVAL_REQUIRED"
  | "HUMAN_APPROVAL"
  | string;

export interface AgentToolInputField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  example?: string;
}

export interface AgentTool {
  toolCode: string;
  toolType?: string;
  displayName: string;
  description?: string;
  targetService: string;
  targetEndpoint?: string;
  riskLevel: RiskLevel;
  executionMode: AgentExecutionMode;
  enabled: boolean;
  readOnly?: boolean;
  requiresApproval?: boolean;
  idempotent?: boolean;
  timeoutMs?: number;
  maxRetries?: number;
  allowedActions?: string[];
  inputSchema?: AgentToolInputField[];
}

export interface AgentToolBinding {
  bindingId: string;
  toolCode: string;
  toolType?: string;
  displayName: string;
  targetService: string;
  targetEndpoint?: string;
  targetResourceId?: number;
  readOnly: boolean;
  riskLevel: RiskLevel;
  executionMode: AgentExecutionMode;
  requiresApproval: boolean;
  idempotent: boolean;
  status: string;
  allowedActions: string[];
  createTime?: string;
}

export interface AgentWorkspace {
  workspaceId?: number;
  workspaceKey?: string;
  isolationLevel?: string;
  storageRoot?: string;
  status?: string;
  [key: string]: unknown;
}

export interface AgentRun {
  runId: string;
  sessionId: string;
  state: string;
  workloadType?: string;
  userInputPreview?: string;
  dryRun: boolean;
  requireHumanApproval: boolean;
  nextActions: string[];
  variables: JsonObject;
  createTime?: string;
  updateTime?: string;
  finishTime?: string;
  message?: string;
}

export interface AgentSession {
  sessionId: string;
  tenantId?: number;
  projectId?: number;
  workspaceId?: number;
  actorId: string;
  channel?: string;
  objective: string;
  state: string;
  workspace?: AgentWorkspace;
  toolBindings: AgentToolBinding[];
  runs: AgentRun[];
  createTime?: string;
  updateTime?: string;
}

export interface AgentModelRoute {
  workloadType: string;
  enabled: boolean;
  providerName: string;
  providerType: string;
  modelName: string;
  endpoint?: string;
  timeoutMs?: number;
  capabilities: string[];
}

export interface AgentToolPlan {
  toolName: string;
  reason?: string;
  arguments?: JsonObject;
  riskLevel: RiskLevel;
  executionMode: AgentExecutionMode;
  requiresHumanApproval: boolean;
  parameterValidation?: JsonObject;
  governanceHints?: JsonObject;
}

export interface AgentPlanCore {
  requestId?: string;
  stateTrace: string[];
  toolPlans: AgentToolPlan[];
  requiresHumanApproval: boolean;
  responseSummary?: string;
  nextActions: string[];
  modelIntentSummary?: string;
}

export interface AgentPlanResponse {
  plan?: AgentPlanCore;
  eventEnvelope?: JsonObject;
  modelGatewayGovernance?: JsonObject;
  intelligentGatewayGovernance?: JsonObject;
  toolExecutionReadiness?: JsonObject;
  toolExecutionReadinessGraph?: JsonObject;
  agentExecutionGateWorkflow?: JsonObject;
  agentExecutionClosure?: JsonObject;
  agentCapabilityClosure?: JsonObject;
  controlPlaneIngestion?: JsonObject;
  controlPlaneFeedback?: JsonObject;
  agentWorkflowDiagnostics?: JsonObject;
  agentCollaborationWorkflow?: JsonObject;
  agentCollaborationExecutionPlan?: JsonObject;
  agentExecutionSession?: JsonObject;
  agentTurnRunner?: JsonObject;
  agentMemoryRetrievalWorkflow?: JsonObject;
  raw: JsonObject;
}

export interface AgentToolExecutionAudit {
  auditId: string;
  sessionId: string;
  runId: string;
  bindingId?: string;
  toolCode: string;
  toolType?: string;
  targetService?: string;
  targetEndpoint?: string;
  targetResourceId?: number;
  tenantId?: number;
  projectId?: number;
  workspaceId?: number;
  actorId?: string;
  riskLevel: RiskLevel;
  executionMode: AgentExecutionMode;
  requiresApproval: boolean;
  readOnly: boolean;
  idempotent: boolean;
  allowedActions: string[];
  planReason?: string;
  planArguments: JsonObject;
  governanceHints: JsonObject;
  parameterValidation: JsonObject;
  state: string;
  traceId?: string;
  message?: string;
  approvalOperatorId?: string;
  approvalComment?: string;
  approvalTime?: string;
  outputSummary?: string;
  errorCode?: string;
  createTime?: string;
  updateTime?: string;
}

export interface AgentRagCitation {
  title?: string;
  source?: string;
  documentId?: string;
  chunkId?: string;
  score?: number;
  [key: string]: unknown;
}

export interface AgentRagQueryResult {
  answer?: string;
  citations?: AgentRagCitation[];
  selectedChunks?: unknown[];
  compressedContext?: string;
  retrievalSummary?: JsonObject;
  modelSummary?: JsonObject;
  langGraphCheckpoint?: unknown;
  [key: string]: unknown;
}

export interface RuntimeEvent {
  id: string;
  time: string;
  level: "INFO" | "WARN" | "ERROR";
  title: string;
  detail: string;
  domain: string;
}

export interface NavItem {
  key: string;
  path: string;
  label: string;
  icon: ReactNode;
}

export interface GatewaySession {
  authenticated: boolean;
  authenticationType: string;
  tenantId: number | string;
  actorId: number | string;
  actorRole: string;
  actorType: "USER" | "SERVICE_ACCOUNT" | "AGENT" | "SYSTEM_SCHEDULER";
  workspaceId?: string;
  workspaceName?: string;
  projectName?: string;
  dataScopeLevel?: string | null;
  authorizedProjectIds?: Array<number | string>;
  authorizedProjects?: Array<{
    id?: number | string;
    projectId?: number | string;
    name?: string;
    projectName?: string;
  }>;
  issueCodes?: string[];
  payloadPolicy?: string;
}

export interface EndpointProbe {
  key: string;
  name: string;
  path: string;
  status: PlatformHealth;
  latencyMs: number;
  traceId?: string;
  message?: string;
}
