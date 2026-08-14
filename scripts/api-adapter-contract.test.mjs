import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDirectory, "..");
const endpoints = fs.readFileSync(path.join(frontendRoot, "src", "api", "endpoints.ts"), "utf8");
const agentConsole = fs.readFileSync(path.join(frontendRoot, "src", "pages", "AgentConsole.tsx"), "utf8");
const agentAssistant = fs.readFileSync(path.join(frontendRoot, "src", "pages", "AgentAssistant.tsx"), "utf8");
const domain = fs.readFileSync(path.join(frontendRoot, "src", "types", "domain.ts"), "utf8");
const backendRoot = path.resolve(frontendRoot, "..", "DataSmartGovernBackend");
const backendAutopilotRequest = fs.readFileSync(
  path.join(backendRoot, "agent-runtime", "src", "main", "java", "com", "czh", "datasmart", "govern", "agent", "controller", "dto", "AgentAutopilotPolicyRequest.java"),
  "utf8",
);
const backendAgentRunView = fs.readFileSync(
  path.join(backendRoot, "agent-runtime", "src", "main", "java", "com", "czh", "datasmart", "govern", "agent", "controller", "dto", "AgentRunView.java"),
  "utf8",
);
const backendConfirmedExecutionResponse = fs.readFileSync(
  path.join(backendRoot, "agent-runtime", "src", "main", "java", "com", "czh", "datasmart", "govern", "agent", "controller", "dto", "AgentRunConfirmedExecutionResponse.java"),
  "utf8",
);
const backendWizardDraftRequest = fs.readFileSync(
  path.join(backendRoot, "data-sync", "src", "main", "java", "com", "czh", "datasmart", "govern", "datasync", "controller", "dto", "SyncTaskCreateWizardDraftSaveRequest.java"),
  "utf8",
);
const backendAutopilotSnapshot = fs.readFileSync(
  path.join(backendRoot, "agent-runtime", "src", "main", "java", "com", "czh", "datasmart", "govern", "agent", "service", "autopilot", "AgentAutopilotAuthorizationSnapshot.java"),
  "utf8",
);

function sourceBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `Could not locate ${startMarker}`);
  return source.slice(start, end);
}

const taskStatusAdapter = sourceBlock(
  endpoints,
  "function normalizeTaskStatus",
  "function normalizeTaskPriority",
);
assert.match(
  taskStatusAdapter,
  /const normalizedStatus = status === "SUCCESS" \? "SUCCEEDED" : status;/,
  "backend SUCCESS must normalize to the frontend SUCCEEDED lifecycle status",
);
assert.match(
  taskStatusAdapter,
  /knownStatuses\.includes\(normalizedStatus as LifecycleStatus\)/,
  "the normalized status must be checked before the DRAFT fallback",
);

const agentPlanPayload = sourceBlock(
  endpoints,
  "export interface CreateAgentPlanPayload",
  "export interface AgentPlanStreamProgressEvent",
);
for (const field of ["tenant_id", "project_id", "actor_id", "preferred_workload"]) {
  assert.match(agentPlanPayload, new RegExp(`\\b${field}\\?: string;`), `${field} must remain public`);
}
assert.doesNotMatch(
  agentPlanPayload,
  /\b(?:tenantId|projectId|actorId|preferredWorkload)\??\s*:/,
  "CreateAgentPlanPayload must not expose camelCase runtime fields",
);

for (const [source, call] of [
  [agentConsole, "api.createAgentPlan({"],
  [agentAssistant, "api.createAgentPlanStream({"],
]) {
  const payload = source.slice(source.indexOf(call), source.indexOf("});", source.indexOf(call)));
  assert.ok(payload.length > call.length, `${call} payload must remain discoverable`);
  for (const field of ["tenant_id", "project_id", "actor_id", "preferred_workload"]) {
    assert.match(payload, new RegExp(`\\b${field}:`), `${call} must send ${field}`);
  }
}

const autopilotPolicy = sourceBlock(
  domain,
  "export interface AutopilotPolicyInput",
  "export interface AutopilotPolicyDraft",
);
for (const field of [
  "executionMode",
  "allowedRecoveryActions",
  "maxAutomaticRiskLevel",
  "maxRecoveryCycles",
  "maxTotalDurationMinutes",
  "requireApprovalFor",
  "expiresAt",
]) {
  assert.match(autopilotPolicy, new RegExp(`\\b${field}\\??\\s*:`), `AUTOPILOT policy must expose ${field}`);
}
assert.doesNotMatch(autopilotPolicy, /\b(?:enabled|allowedActions)\??\s*:/,
  "wire policy must not send browser-only fields or obsolete action names");
const autopilotPolicyDraft = sourceBlock(
  domain,
  "export interface AutopilotPolicyDraft",
  "export interface AutopilotSnapshot",
);
assert.match(autopilotPolicyDraft, /\benabled\s*:\s*boolean;/,
  "the browser-only enable switch belongs to the local policy draft");
for (const field of [
  "String executionMode",
  "Integer maxRecoveryCycles",
  "Integer maxTotalDurationMinutes",
  "String maxAutomaticRiskLevel",
  "List<@Size\\(max = 80\\) String> allowedRecoveryActions",
  "List<@Size\\(max = 80\\) String> requireApprovalFor",
  "OffsetDateTime expiresAt",
]) {
  assert.match(backendAutopilotRequest, new RegExp(field), `backend AUTOPILOT request must expose ${field}`);
}
assert.match(domain, /\| "AUTOPILOT"/, "Agent execution mode must include AUTOPILOT");
assert.match(domain, /maxRecoveryCycles:\s*5/, "AUTOPILOT default recovery budget must remain five cycles");
assert.match(domain, /maxTotalDurationMinutes:\s*120/, "AUTOPILOT default time budget must remain 120 minutes");
assert.match(domain, /maxAutomaticRiskLevel:\s*"LOW"/, "AUTOPILOT must default to low automatic risk");
assert.match(domain, /"RETRY_EXECUTION"/, "AUTOPILOT defaults must use backend recovery action codes");
const defaultAutopilotRecoveryActions = sourceBlock(
  domain,
  "export const DEFAULT_AUTOPILOT_RECOVERY_ACTIONS",
  "export const DEFAULT_AUTOPILOT_APPROVAL_ACTIONS",
);
for (const governedExecutor of [
  "RETRY_EXECUTION",
  "APPLY_QUARANTINE",
  "ROLLBACK_EXECUTION_POLICY",
  "TUNE_EXECUTION_POLICY",
  "REFRESH_METADATA",
  "RESUME_FROM_CHECKPOINT",
  "REPLAY_FAILED_SHARDS",
  "REPAIR_FIELD_MAPPING",
]) {
  assert.match(defaultAutopilotRecoveryActions, new RegExp(`"${governedExecutor}"`),
    `${governedExecutor} must be enabled by the initial authorization default because the backend has a governed executor`);
}
for (const actionWithoutExecutor of ["RECONNECT_DATASOURCE"]) {
  assert.doesNotMatch(defaultAutopilotRecoveryActions, new RegExp(`"${actionWithoutExecutor}"`),
    `${actionWithoutExecutor} must not be authorized before its governed executor exists`);
}

const confirmPayload = sourceBlock(
  endpoints,
  "export interface ConfirmAgentRunPayload",
  "function isRecord",
);
assert.match(confirmPayload, /autopilotPolicy\??:\s*AutopilotPolicyInput;/, "initial confirmation must accept AUTOPILOT policy");
for (const normalizer of ["normalizeAutopilotSnapshot", "normalizeAgentRun", "normalizeAgentSession"]) {
  assert.match(endpoints, new RegExp(`function ${normalizer}`), `${normalizer} must remain available`);
}
assert.match(backendAgentRunView, /Map<String, Object> variables/,
  "backend exposes AUTOPILOT authorization through AgentRunView.variables");
assert.match(backendConfirmedExecutionResponse, /AgentAutopilotSnapshotView\s+autopilotSnapshot/,
  "confirmation response must expose the backend-owned public AUTOPILOT snapshot");
for (const field of [
  "policyId",
  "policyVersion",
  "state",
  "rootSessionId",
  "rootRunId",
  "maxRecoveryCycles",
  "maxTotalDurationMinutes",
  "maxAutomaticRiskLevel",
  "allowedRecoveryActions",
  "requireApprovalFor",
  "issuedAt",
  "expiresAt",
]) {
  assert.match(backendAutopilotSnapshot, new RegExp(`\\b${field}\\b`),
    `backend AUTOPILOT snapshot must expose ${field}`);
}
const autopilotSnapshotAdapter = sourceBlock(
  endpoints,
  "function normalizeAutopilotSnapshot",
  "function readOptionalString",
);
assert.doesNotMatch(autopilotSnapshotAdapter, /\b(?:allowedActions|allowed_actions)\b/,
  "snapshot adapter must not revive the obsolete allowedActions field");
const confirmedExecutionAdapter = sourceBlock(
  endpoints,
  "function normalizeAgentRunConfirmedExecutionResponse",
  "function normalizeAgentRagResult",
);
assert.match(confirmedExecutionAdapter, /record\.autopilotSnapshot\s*\?\?\s*record\.autopilot_snapshot/,
  "confirmation adapter must read both Java JSON naming variants for the AUTOPILOT snapshot");
const confirmedExecutionResponse = sourceBlock(
  domain,
  "export interface AgentRunConfirmedExecutionResponse",
  "export interface AgentToolExecutionFailure",
);
assert.match(confirmedExecutionResponse, /autopilotSnapshot\??:\s*AutopilotSnapshot;/,
  "frontend confirmation response type must retain the public AUTOPILOT snapshot");
const agentRunAdapter = sourceBlock(endpoints, "function normalizeAgentRun", "function normalizeAgentSpecialistTurnFact");
assert.match(agentRunAdapter, /variables\.(?:autopilotAuthorization|autopilot_authorization)/,
  "run adapter must read the durable AUTOPILOT authorization from variables");
assert.doesNotMatch(agentRunAdapter, /record\.autopilot(?:Snapshot|_snapshot)/,
  "run adapter must not invent a top-level AUTOPILOT snapshot transport");
const agentSessionAdapter = sourceBlock(endpoints, "function normalizeAgentSession", "function normalizeAgentModelRoute");
assert.doesNotMatch(agentSessionAdapter, /record\.autopilot(?:Snapshot|_snapshot)/,
  "session adapter must derive AUTOPILOT state from durable Runs");
assert.match(agentSessionAdapter, /\[\.\.\.runs\]\.reverse\(\)\.map\(\(run\) => run\.autopilotSnapshot\)/,
  "session adapter must expose the latest durable Run AUTOPILOT snapshot");
const syncTaskContract = sourceBlock(domain, "export interface SyncTask {", "export interface SyncTaskGroupSummary");
assert.doesNotMatch(syncTaskContract, /autopilotSnapshot/,
  "data-sync task list has no public AUTOPILOT snapshot field");
const wizardDraftPayload = sourceBlock(
  endpoints,
  "export interface SyncTaskCreateWizardDraftPayload",
  "export interface SyncTaskCreateWizardDraftResult",
);
assert.match(
  wizardDraftPayload,
  /Omit<\s*SyncTaskDefinitionPayload,\s*"name"\s*\|\s*"primaryKeyField"\s*\|\s*"incrementalField"\s*>/,
  "wizard draft payload must omit fields that the current Java request DTO does not accept",
);
for (const field of ["primaryKeyField", "incrementalField"]) {
  assert.doesNotMatch(backendWizardDraftRequest, new RegExp(`\\b${field}\\b`),
    `backend wizard draft request must remain the source of truth for ${field}`);
}

const syncAutopilotRecoveryStatus = sourceBlock(
  domain,
  "export interface SyncAutopilotRecoveryStatus",
  "export interface SyncExecutionLog",
);
assert.match(syncAutopilotRecoveryStatus, /\bavailable\s*:\s*boolean;/,
  "Autopilot recovery availability must always be explicit");
for (const field of [
  "syncTaskId",
  "rootExecutionId",
  "currentExecutionId",
  "executionState",
  "executionFinishedAt",
  "caseId",
  "caseState",
  "cycle",
  "maxCycles",
  "recoveryAction",
  "riskLevel",
  "attentionReason",
  "deadlineAt",
  "version",
  "caseCreatedAt",
  "caseUpdatedAt",
  "outboxState",
  "outboxAttemptCount",
  "outboxMaxAttemptCount",
  "outboxLastErrorCode",
  "producerDeliveryStatus",
  "producerDeliveryReasonCode",
  "consumerResultStatus",
  "consumerResultReasonCode",
  "consumerResultAt",
  "retrievalDecision",
  "retrievalStrategy",
  "retrievalEvidenceCount",
  "retrievalEvidenceDigest",
  "quarantineSelectedCount",
  "quarantineAffectedCount",
  "quarantineOperationState",
  "quarantineReceiptState",
  "quarantineUpdatedAt",
]) {
  assert.match(syncAutopilotRecoveryStatus, new RegExp(`\\b${field}\\??\\s*:`),
    `public Autopilot recovery status must retain ${field}`);
}
assert.doesNotMatch(syncAutopilotRecoveryStatus, /\b(?:authorizationDigest|policyDigest|eventId|rawLogs|modelText)\b/,
  "Autopilot recovery type must not expose sensitive control-plane internals");
const syncAutopilotRecoveryAdapter = sourceBlock(
  endpoints,
  "function normalizeSyncAutopilotRecoveryStatus",
  "function normalizeSyncExecutionLog",
);
for (const field of [
  "available",
  "syncTaskId",
  "rootExecutionId",
  "currentExecutionId",
  "executionState",
  "executionFinishedAt",
  "caseId",
  "caseState",
  "cycle",
  "maxCycles",
  "recoveryAction",
  "riskLevel",
  "attentionReason",
  "deadlineAt",
  "version",
  "caseCreatedAt",
  "caseUpdatedAt",
  "outboxState",
  "outboxAttemptCount",
  "outboxMaxAttemptCount",
  "outboxLastErrorCode",
  "producerDeliveryStatus",
  "producerDeliveryReasonCode",
  "consumerResultStatus",
  "consumerResultReasonCode",
  "consumerResultAt",
  "retrievalDecision",
  "retrievalStrategy",
  "retrievalEvidenceCount",
  "retrievalEvidenceDigest",
  "quarantineSelectedCount",
  "quarantineAffectedCount",
  "quarantineOperationState",
  "quarantineReceiptState",
  "quarantineUpdatedAt",
]) {
  assert.match(syncAutopilotRecoveryAdapter, new RegExp(`record\\.${field}`),
    `Autopilot recovery adapter must whitelist ${field}`);
}
assert.doesNotMatch(syncAutopilotRecoveryAdapter, /\b(?:authorizationDigest|policyDigest|eventId|rawLogs|modelText)\b/,
  "Autopilot recovery adapter must drop sensitive control-plane internals");
const syncAutopilotRecoveryEndpoint = sourceBlock(
  endpoints,
  "getSyncAutopilotRecoveryStatus:",
  "listSyncObjectExecutions:",
);
assert.match(syncAutopilotRecoveryEndpoint,
  /\/sync\/sync-tasks\/\$\{taskId\}\/executions\/\$\{executionId\}\/autopilot-recovery/,
  "Autopilot recovery status must use the execution-scoped read endpoint");
assert.match(syncAutopilotRecoveryEndpoint, /normalizeSyncAutopilotRecoveryStatus\(result\.data\)/,
  "Autopilot recovery endpoint must return its constrained normalized projection");

console.log("api adapter contract: PASS");
