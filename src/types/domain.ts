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
  ownerId?: number;
  createdBy?: number;
  projectName?: string;
  ownerName?: string;
  effectiveActions?: string[];
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

export interface SyncTaskDefinition {
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
  definition?: SyncTaskDefinition;
  groupCode?: string;
  groupName?: string;
  name: string;
  currentState: SyncTaskState | string;
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
  errorCode?: string;
  fieldName?: string;
  repairable?: boolean;
  suggestedAction?: string;
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

export interface SyncTaskImportArtifact {
  artifactRef: string;
  tenantId: number;
  projectId: number;
  ownerId: number;
  parentArtifactRef?: string;
  versionNumber: number;
  fileName: string;
  fileFormat: string;
  contentHash: string;
  contentSizeBytes: number;
  artifactState: string;
  dryRunStatus?: string;
  dryRunDigest?: string;
  repairPatchDigest?: string;
  createTime?: string;
  updateTime?: string;
}

export interface SyncTaskImportArtifactDryRunResult {
  artifact: SyncTaskImportArtifact;
  importResult: SyncTaskImportResult;
  confirmationDigest: string;
  ragQuery?: string;
  repairRequired: boolean;
}

export interface AgentDurableModelToolLoopTurn {
  turnIndex: number;
  requestId: string;
  sessionId?: string;
  runId?: string;
  submittedToolNames: string[];
  ingestionSucceeded: boolean;
  feedbackStatusCounts: Record<string, number>;
  loopAction?: string;
  modelExecuted: boolean;
  nextToolNames: string[];
  stopReason?: string;
}

export interface AgentDurableModelToolLoop {
  turnCount: number;
  turns: AgentDurableModelToolLoopTurn[];
  stoppedReason: string;
  continuesAfterResponse: boolean;
  payloadPolicy?: string;
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

export interface SyncTaskExecutionPrecheckResponse {
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

export interface PermissionMenuRecord {
  id: number;
  menuCode: string;
  parentCode?: string;
  menuName: string;
  path: string;
  icon?: string;
  sortOrder?: number;
  enabled: boolean;
  description?: string;
}

export interface PermissionTenantRecord {
  tenantId: number;
  tenantCode: string;
  tenantName: string;
  tenantType: string;
  planCode: string;
  status: "ACTIVE" | "SUSPENDED" | "CLOSED" | string;
  ownerActorId?: number;
  openedBy?: number;
  openedAt?: string;
  description?: string;
  applicationId?: number;
  applicationCode?: string;
  applicationName?: string;
  applicationStatus?: string;
  administratorActorId?: number;
  administratorUsername?: string;
  administratorStatus?: string;
  createTime?: string;
  updateTime?: string;
}

export interface ProjectRecord {
  projectId: number;
  tenantId?: number;
  tenantName?: string;
  projectCode?: string;
  projectName: string;
  projectType?: string;
  status?: string;
  ownerActorId?: number;
  ownerUsername?: string;
  description?: string;
  createTime?: string;
  updateTime?: string;
}

export interface ProjectMembershipRecord {
  membershipId: number;
  tenantId?: number;
  actorId: number;
  identityUserId?: number;
  username?: string;
  email?: string;
  actorRole?: string;
  actorType?: string;
  userStatus?: string;
  projectId: number;
  projectCode?: string;
  projectName?: string;
  projectStatus?: string;
  projectRole: "OWNER" | "MANAGER" | "READER" | "SERVICE" | string;
  grantSource?: string;
  enabled: boolean;
  createTime?: string;
  updateTime?: string;
}

export interface ProjectJoinCandidateRecord {
  projectId: number;
  tenantId?: number;
  projectCode?: string;
  projectName: string;
  projectType?: string;
}

export interface ProjectJoinRequestRecord {
  id: number;
  tenantId?: number;
  projectId: number;
  projectCode?: string;
  projectName?: string;
  applicantActorId: number;
  applicantName?: string;
  applicantUsername?: string;
  requestedProjectRole: "READER" | "MANAGER" | "OWNER" | string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | string;
  reviewerActorId?: number;
  reviewerUsername?: string;
  reviewerActorRole?: string;
  reviewComment?: string;
  reviewTime?: string;
  membershipId?: number;
  createTime?: string;
  updateTime?: string;
}

export interface ProjectCreationRequestRecord {
  id: number;
  tenantId?: number;
  applicationId?: number;
  projectCode?: string;
  projectName: string;
  projectType?: string;
  applicantActorId: number;
  applicantName?: string;
  applicantUsername?: string;
  ownerActorId?: number;
  ownerUsername?: string;
  description?: string;
  requestReason?: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | string;
  reviewerActorId?: number;
  reviewerUsername?: string;
  reviewerActorRole?: string;
  reviewComment?: string;
  reviewTime?: string;
  createdProjectId?: number;
  createTime?: string;
  updateTime?: string;
}

export interface ApprovalCenterRecord {
  requestType: "PROJECT_CREATION" | "PROJECT_JOIN" | string;
  requestId: number;
  tenantId?: number;
  applicationId?: number;
  projectId?: number;
  projectCode?: string;
  projectName?: string;
  applicantActorId: number;
  applicantName?: string;
  applicantUsername?: string;
  ownerActorId?: number;
  ownerUsername?: string;
  requestedProjectRole?: string;
  requestReason?: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | string;
  reviewerActorId?: number;
  reviewerUsername?: string;
  reviewerActorRole?: string;
  reviewComment?: string;
  reviewTime?: string;
  resultResourceId?: number;
  createTime?: string;
  updateTime?: string;
  availableActions: string[];
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

/**
 * Java Agent Runtime 持久化的专业 Agent 低敏事实。
 *
 * 这不是完整的模型响应，也不是工具审计详情：后端故意只保存可用于历史
 * 定位和过程概览的摘要、引用和身份字段。前端因此只能把它渲染成“事实兜底”
 * 面板，不能根据 toolActivitySummaryRefs 推断工具参数、返回值或结构化结论。
 */
export interface AgentSpecialistTurnFact {
  userId: string;
  tenantId: number;
  /** Java fact scope; this is a required backend isolation boundary. */
  applicationId: number;
  projectId: number;
  sessionId: string;
  runId: string;
  turnId: string;
  idempotencyKey: string;
  agentId: string;
  role: string;
  delegationId?: string;
  status: string;
  lowSensitiveSummary: string;
  modelInvocationId?: string;
  modelName?: string;
  toolActivitySummaryRefs: string[];
  evidenceRefs: string[];
  durationMillis?: number;
  startedAt?: string;
  finishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 用户授予 Agent 的最小权限快照。
 *
 * 该结构用于向用户解释 Agent 被允许调用哪些工具和资源，不表示前端可以自行授权；实际执行仍由后端
 * 校验有效期、撤销状态、用户权限和下游资源归属。
 */
export interface AgentDelegation {
  /** 委托审计编号，用于关联 user + agent + session + run。 */
  delegationId: string;
  /** 被委托执行的 Agent 主体。 */
  agentId: string;
  /** 授权来源用户，Agent 权限不能超过该用户。 */
  userActorId: string;
  tenantId?: number;
  projectId?: number;
  toolCodes: string[];
  actions: string[];
  resourceScopes: string[];
  status: string;
  issuedAt?: string;
  expiresAt?: string;
  revokedAt?: string;
}

/** 一条持久化对话消息，runId 用于关联产生该轮消息的具体 Agent 运行。 */
export interface AgentConversationMessage {
  messageId: string;
  runId?: string;
  role: "USER" | "AGENT";
  content: string;
  createTime?: string;
  /** 对应本消息回合的真实专业 Agent 低敏执行快照，用于持久历史回放。 */
  specialistAgentExecution?: JsonObject;
}

export interface AgentSession {
  sessionId: string;
  /** 与 actorId 并列的执行主体，实现用户与 Agent 双主体审计。 */
  agentId?: string;
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
  /** 本会话当前生效或已失效的委托快照。 */
  delegation?: AgentDelegation;
  /** 按时间顺序恢复的多轮对话上下文。 */
  messages: AgentConversationMessage[];
  /** 仅影响用户历史列表顺序。 */
  pinned: boolean;
  /** 归档仅隐藏到历史分区，不删除记录。 */
  archived: boolean;
  archivedAt?: string;
  lastMessageAt?: string;
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

export interface AgentClarificationQuestion {
  parameterName: string;
  fieldPath: string;
  label: string;
  question: string;
  inputType: string;
  required: boolean;
  sensitive: boolean;
  candidates?: Array<{
    datasourceId: number;
    name: string;
    type: string;
    usagePurpose?: string;
  }>;
  options?: Array<{
    value: string | boolean;
    label: string;
  }>;
  reasonCode?: string;
  ambiguityType?: string;
  requestedDatasourceType?: string;
  allowsNaturalLanguageCorrection?: boolean;
  repairGuidance?: string;
  configurationPreview?: {
    kind?: string;
    customSqlText?: string;
    generatedByAgent?: boolean;
    requiresExplicitConfirmation?: boolean;
    payloadPolicy?: string;
  };
}

export interface AgentStructuredIntent {
  intentType: string;
  domains: string[];
  candidateTools: string[];
  riskTags: string[];
  confidence: number;
  summary?: string;
  syncMode?: string;
  writeStrategy?: string;
  sourceDatasourceSelected: boolean;
  targetDatasourceSelected: boolean;
  objectMappingCount: number;
}

export interface AgentResolvedSyncConfiguration {
  taskName?: string;
  syncMode?: string;
  writeStrategy?: string;
  sourceDatasourceId?: number;
  sourceDatasourceName?: string;
  targetDatasourceId?: number;
  targetDatasourceName?: string;
  scheduleConfig?: string;
  customSqlText?: string;
  customSqlConfirmed?: boolean;
  targetTableResolution?: string;
  objectMappings: JsonObject[];
  objectMappingSource?: string;
  fieldMappingSource?: string;
  mappingDefaultsConfirmed?: boolean;
  autoFilledFields: string[];
  payloadPolicy?: string;
}

export interface AgentConversation {
  schemaVersion: string;
  turnId?: string;
  phase:
    | "WAITING_CLARIFICATION"
    | "RESOLVING_AUTONOMOUSLY"
    | "READY_FOR_CONFIRMATION"
    | "NO_EXECUTABLE_PLAN"
    | string;
  assistantMessage: string;
  structuredIntent: AgentStructuredIntent;
  resolvedConfiguration: AgentResolvedSyncConfiguration;
  missingParameters: string[];
  clarificationQuestions: AgentClarificationQuestion[];
  canExecute: boolean;
  controlPlaneIngested: boolean;
  nextAction: string;
  intentResolver: JsonObject;
  payloadPolicy?: string;
}

export interface AgentObservationTimelineItem {
  id: string;
  category:
    | "MODEL"
    | "DECISION"
    | "SKILL"
    | "ORCHESTRATION"
    | "TOOL"
    | "COMMAND"
    | "PERMISSION"
    | "USER_ACTION"
    | string;
  stage: string;
  status: string;
  title: string;
  summary: string;
  details: JsonObject;
}

export interface AgentObservationTimeline {
  schemaVersion: string;
  payloadPolicy?: string;
  requestId?: string;
  itemCount: number;
  items: AgentObservationTimelineItem[];
  hiddenByDesign: string[];
}

/**
 * Specialist Agent 到 Java ToolPlan 桥接阶段公开给前端的问题摘要。
 *
 * 桥接层只允许返回错误码和面向用户的说明，不返回 ToolPlan 参数值、SQL、
 * 凭据或模型内部文本。前端可以据此告诉用户“正在等待什么”，但不能把
 * 这些字段当成可以直接执行的命令。
 */
export interface SpecialistToolPlanBridgeIssueSummary {
  code?: string;
  message?: string;
}

/**
 * RECOVERY_AGENT 交给 Java 控制面的低敏 handoff 摘要。
 *
 * blueprint 只保留动作类型和参数字段名集合，真实参数必须由 Java 根据
 * 受信控制面事实重新组装，因此这里刻意不定义或保存 arguments 字段。
 */
export interface SpecialistRecoveryHandoffSummary {
  schemaVersion?: string;
  approvalStatus?: string;
  approvalFactAccepted?: boolean;
  blueprintCount?: number;
  requiresJavaRehydration?: boolean;
  executionBoundary?: string;
  directExecution?: boolean;
  requiredApprovalBindings?: string[];
}

/**
 * DATA_SYNC_AGENT/RECOVERY_AGENT 进入 Java ToolPlan 生命周期的公开桥接状态。
 *
 * 这个类型服务于实时响应和历史快照，所有属性都是可选的，以兼容旧版本
 * 后端只返回 specialistAgentExecution 的情况。
 */
export interface SpecialistToolPlanBridgeSummary {
  schemaVersion?: string;
  status?: string;
  specialistRole?: string;
  specialistTurnId?: string;
  publicSummary?: string;
  acceptedToolPlanCount?: number;
  acceptedToolNames?: string[];
  visibleToolNames?: string[];
  canSubmitDurableLoop?: boolean;
  toolArgumentNameSets?: string[][];
  issues?: SpecialistToolPlanBridgeIssueSummary[];
  specialistResultFingerprint?: string;
  scopeBinding?: JsonObject;
  recoveryHandoff?: SpecialistRecoveryHandoffSummary;
  payloadPolicy?: string;
}

/**
 * post-bridge 的 PRECHECK_AGENT/MONITOR_AGENT 批次摘要。
 *
 * 复核结果本身沿用 Specialist Agent 的低敏结果结构；这里保留 JsonObject
 * 是为了兼容后端以后增加只读检查项，同时仍由前端统一过滤敏感字段。
 */
export interface SpecialistVerificationExecutionSummary {
  status?: string;
  executedCount?: number;
  completedCount?: number;
  waitingInputCount?: number;
  failedCount?: number;
  results?: JsonObject[];
  skippedRoles?: Record<string, string>;
  executionWaves?: string[][];
  executionBoundary?: string;
  payloadPolicy?: string;
}

/**
 * Java 控制面返回真实任务/执行定位后，后端是否启动复核波次的摘要。
 *
 * taskId 和 executionId 只接受真实控制面反馈，前端不会从自然语言或模型
 * 文本中猜测它们；缺失时只展示“尚未具备可信定位”的用户提示。
 */
export interface PostBridgeVerificationSummary {
  status?: string;
  resourceChanged?: boolean;
  resourceFingerprint?: string;
  previousResourceFingerprint?: string;
  taskId?: number | string | null;
  executionId?: number | string | null;
  executedRoles?: string[];
  batchStatus?: string | null;
  payloadPolicy?: string;
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
  specialistAgentExecution?: JsonObject;
  specialistVerificationExecution?: SpecialistVerificationExecutionSummary;
  specialistToolPlanBridges?: SpecialistToolPlanBridgeSummary[];
  postBridgeVerification?: PostBridgeVerificationSummary;
  agentMemoryRetrievalWorkflow?: JsonObject;
  agentConversation?: AgentConversation;
  agentObservationTimeline?: AgentObservationTimeline;
  agentDurableModelToolLoop?: AgentDurableModelToolLoop;
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
  executionStartTime?: string;
  executionFinishTime?: string;
  outputSummary?: string;
  errorCode?: string;
  createTime?: string;
  updateTime?: string;
}

export interface AgentRunConfirmedExecutionResponse {
  sessionId: string;
  runId: string;
  runState: string;
  plannedCount: number;
  succeededCount: number;
  failedCount: number;
  toolResults: AgentToolExecutionResult[];
  failures: AgentToolExecutionFailure[];
  nextActions: string[];
  assistantReply: string;
  answerMode: string;
  modelProviderStatus: string;
  continuation?: AgentPostConfirmContinuation;
}

export interface AgentToolExecutionFailure {
  auditId?: string;
  toolCode: string;
  errorCode: string;
  message: string;
  outputSummary?: string;
  details: string[];
  suggestions: string[];
}

export interface AgentPostConfirmContinuation {
  schemaVersion: string;
  status: string;
  /** Java uses nullable `Boolean`; null must never claim that a next run exists. */
  continued: boolean | null;
  requestId?: string;
  sessionId?: string;
  sourceRunId?: string;
  nextRunId?: string;
  /** Null/missing confirmation flags are treated as false by action callers. */
  requiresConfirmation: boolean | null;
  stoppedReason?: string;
  assistantReply?: string;
  modelSecondTurn?: JsonObject;
  durableLoop?: JsonObject;
  repairProposal?: AgentRepairProposal;
  /** 提交后基于真实 task/execution 运行的 PRECHECK/MONITOR 专业批次。 */
  specialistVerificationExecution?: SpecialistVerificationExecutionSummary;
  /** 只包含资源定位、执行角色和批次状态的低敏后置复核摘要。 */
  postBridgeVerification?: PostBridgeVerificationSummary;
  payloadPolicy?: string;
  message?: string;
}

export interface AgentRepairProposal {
  kind: string;
  failureCode?: string;
  failedToolName?: string;
  originalTaskName?: string;
  proposedTaskName?: string;
  requiresConfirmation: boolean;
  summary: string;
  changes: string[];
  payloadPolicy?: string;
}

export interface AgentToolExecutionResult {
  audit: AgentToolExecutionAudit;
  output: JsonObject;
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
    tenantId?: number;
    name?: string;
    projectName?: string;
    role?: string;
    projectRole?: string;
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
