import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const assistantSourceUrl = new URL("../src/pages/AgentAssistant.tsx", import.meta.url);
const assistantSource = await readFile(assistantSourceUrl, "utf8");

function extractFunction(source, functionName) {
  const start = source.indexOf(`function ${functionName}(`);
  assert.notEqual(start, -1, `missing ${functionName} regression seam`);
  const signatureEnd = source.indexOf("): boolean {", start);
  const openingBrace = signatureEnd >= 0 ? source.indexOf("{", signatureEnd) : -1;
  assert.notEqual(openingBrace, -1, `${functionName} has no body`);

  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`could not find the end of ${functionName}`);
}

async function loadConfirmationGates() {
  const continuationHelper = extractFunction(assistantSource, "continuationNeedsManualConfirmation");
  const unexpectedHighRiskHelper = extractFunction(assistantSource, "isUnexpectedHighRiskAudit");
  const autopilotHelper = extractFunction(assistantSource, "shouldSubmitAutopilotPolicy");
  const emitted = ts.transpileModule(
    `${continuationHelper}\n${unexpectedHighRiskHelper}\n${autopilotHelper}\nexport { continuationNeedsManualConfirmation, isUnexpectedHighRiskAudit, shouldSubmitAutopilotPolicy };`,
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
      },
      fileName: "continuation-confirmation-gate.ts",
    },
  ).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(emitted).toString("base64")}`;
  return import(moduleUrl);
}

const {
  continuationNeedsManualConfirmation: gate,
  isUnexpectedHighRiskAudit,
  shouldSubmitAutopilotPolicy,
} = await loadConfirmationGates();

assert.equal(gate({ requiresConfirmation: true, status: "SUCCEEDED" }, false), true);
assert.equal(gate({ requiresConfirmation: false, status: "waiting_confirmation" }, false), true);
assert.equal(gate({ requiresConfirmation: false, status: "RUNNING" }, true), true);
assert.equal(gate({ requiresConfirmation: false, status: "RUNNING" }, false), false);

const initiallyApprovedTools = new Set(["sync.task.run"]);
assert.equal(isUnexpectedHighRiskAudit({ toolCode: "datasource.schema.repair.apply", riskLevel: "HIGH" }, initiallyApprovedTools), true);
assert.equal(isUnexpectedHighRiskAudit({ toolCode: "quality.remediation.submit", riskLevel: "CRITICAL" }, initiallyApprovedTools), true);
assert.equal(isUnexpectedHighRiskAudit({ toolCode: "sync.task.run", riskLevel: "HIGH" }, initiallyApprovedTools), false);
assert.equal(isUnexpectedHighRiskAudit({ toolCode: "metadata.read", riskLevel: "LOW" }, initiallyApprovedTools), false);

assert.equal(shouldSubmitAutopilotPolicy(true, false, false, false), true);
assert.equal(shouldSubmitAutopilotPolicy(false, false, false, false), false);
assert.equal(shouldSubmitAutopilotPolicy(true, true, false, false), false);
assert.equal(shouldSubmitAutopilotPolicy(true, false, true, false), false);
assert.equal(shouldSubmitAutopilotPolicy(true, false, false, true), false);

const executionMutationStart = assistantSource.indexOf("const executeMutation = useMutation");
const executionMutationEnd = assistantSource.indexOf("onMutate:", executionMutationStart);
assert.notEqual(executionMutationStart, -1, "execution mutation is missing");
assert.notEqual(executionMutationEnd, -1, "execution mutation must remain bounded");
const executionMutation = assistantSource.slice(executionMutationStart, executionMutationEnd);

assert.match(executionMutation, /autopilotPolicyForInitialConfirmation/);
assert.match(executionMutation, /executionMode:\s*autopilotPolicy\.executionMode/);
assert.match(executionMutation, /allowedRecoveryActions:/);
assert.doesNotMatch(executionMutation, /\ballowedActions\b/);
assert.match(executionMutation, /continuation\.sessionId\s*&&\s*continuation\.sessionId\s*!==\s*executionControlPlane\.sessionId/);
assert.match(executionMutation, /nextAudits\.some\(isPendingApprovalAudit\)/);
assert.match(executionMutation, /nextDurableRunStatus\s*===\s*"WAITING_CONFIRMATION"/);
assert.match(executionMutation, /unexpectedHighRiskTools\.length\s*>\s*0/);
assert.match(executionMutation, /if \(unexpectedTools\.length\s*&&\s*!unexpectedHighRiskTools\.length\)/);
assert.match(executionMutation, /if \(nextRunNeedsManualConfirmation\)[\s\S]*?withAutopilotSnapshot\(continuationSnapshot,\s*\{[\s\S]*?runId:\s*nextRunId/);
assert.doesNotMatch(executionMutation, /for \(let batchIndex = 0; batchIndex < 6/);
assert.doesNotMatch(executionMutation, /currentRunId\s*=\s*nextRunId/);
assert.equal((executionMutation.match(/confirmAndExecuteAgentRun/g) ?? []).length, 1,
  "the browser must submit exactly one confirmation request per click");
assert.match(executionMutation, /continuationSession\.actorId/);
assert.match(assistantSource, /setControlPlane\(awaitingManualConfirmation\)/);
assert.match(assistantSource, /continuationManualConfirmationActive[\s\S]*?activeRequiresConfirmation/);
assert.match(assistantSource, /agent_continuation_confirmation_required[\s\S]*?status:\s*"WAITING_CONFIRMATION"/);

console.log("PASS AUTOPILOT is attached only to the initial confirmation and continuation remains governed");
