import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(resolve(root, "src/pages/DataSync.tsx"), "utf8");
const endpoints = readFileSync(resolve(root, "src/api/endpoints.ts"), "utf8");
const domain = readFileSync(resolve(root, "src/types/domain.ts"), "utf8");
const effectStart = source.indexOf("消费 Agent 历史结果携带的任务定位");
const effectEnd = source.indexOf("agentWizardHandoff", effectStart);
const effect = source.slice(effectStart, effectEnd);

assert(effectStart >= 0 && effectEnd > effectStart, "Agent task locator effect must remain discoverable");
assert(
  effect.indexOf("consumedAgentTaskLocator.current = locatorKey") > effect.indexOf(".then((result)"),
  "the locator must be consumed only after the task has loaded successfully",
);
assert(effect.includes("agentTaskLocatorRetryVersion"), "transient failures must expose a retry trigger");
assert(effect.includes("instanceof ApiError"), "HTTP scope failures must be distinguished from transient failures");
assert(effect.includes("status === 401") && effect.includes("status === 403") && effect.includes("status === 404"),
  "authorization/not-found status handling must stay explicit");
assert(effect.includes("重试"), "the transient failure message must offer a user retry action");
const syncTaskStart = domain.indexOf("export interface SyncTask {");
const syncTaskEnd = domain.indexOf("export interface SyncTaskGroupSummary", syncTaskStart);
assert(syncTaskStart >= 0 && syncTaskEnd > syncTaskStart, "SyncTask contract must remain discoverable");
assert.doesNotMatch(domain.slice(syncTaskStart, syncTaskEnd), /autopilotSnapshot/,
  "data-sync list responses must not invent an AUTOPILOT snapshot the backend does not return");
const wizardStart = endpoints.indexOf("export interface SyncTaskCreateWizardDraftPayload");
const wizardEnd = endpoints.indexOf("export interface SyncTaskCreateWizardDraftResult", wizardStart);
assert(wizardStart >= 0 && wizardEnd > wizardStart, "sync task wizard payload must remain discoverable");
assert.doesNotMatch(endpoints.slice(wizardStart, wizardEnd), /autopilotPolicy/,
  "browser DataSync requests must not send the Agent Runtime-only authorization snapshot");
assert.doesNotMatch(source, /autopilotSnapshot|autopilotPolicy/,
  "DataSync must not render or persist an unsupported AUTOPILOT transport field");
const recoveryCardStart = source.indexOf("title={`Autopilot 恢复状态");
const recoveryCardEnd = source.indexOf("{executionLogQuery.isError ?", recoveryCardStart);
const recoveryCard = source.slice(recoveryCardStart, recoveryCardEnd);
assert(recoveryCardStart >= 0 && recoveryCardEnd > recoveryCardStart,
  "execution detail must retain the Autopilot recovery status card");
assert.match(source, /getSyncAutopilotRecoveryStatus\(selectedTask!\.id, selectedExecutionId!\)/,
  "execution detail must request server-owned Autopilot recovery status");
assert.match(source, /queryKey:\s*\["sync-autopilot-recovery-status", selectedTask\?\.id, selectedExecutionId\]/,
  "Autopilot recovery query must be isolated by task and execution");
for (const field of [
  "available",
  "caseState",
  "cycle",
  "maxCycles",
  "recoveryAction",
  "riskLevel",
  "attentionReason",
  "outboxState",
  "producerDeliveryStatus",
  "producerDeliveryReasonCode",
  "consumerResultStatus",
  "quarantineSelectedCount",
  "quarantineAffectedCount",
  "quarantineOperationState",
  "quarantineReceiptState",
]) {
  assert.match(recoveryCard, new RegExp(`autopilotRecoveryStatus\\.${field}`),
    `Autopilot recovery card must render ${field}`);
}
assert.match(recoveryCard, /isTerminalAutopilotRecoveryCase/,
  "Autopilot recovery card must make terminal state visible");
assert.doesNotMatch(recoveryCard, /\b(?:authorizationDigest|policyDigest|eventId|rawLogs|modelText)\b/,
  "Autopilot recovery card must not render sensitive control-plane internals");

console.log("PASS DataSync Agent task locator preserves retry semantics without inventing Agent-only AUTOPILOT data");
