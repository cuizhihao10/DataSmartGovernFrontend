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

async function loadConfirmationGate() {
  const helper = extractFunction(assistantSource, "continuationNeedsManualConfirmation");
  const emitted = ts.transpileModule(
    `${helper}\nexport { continuationNeedsManualConfirmation };`,
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
      },
      fileName: "continuation-confirmation-gate.ts",
    },
  ).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(emitted).toString("base64")}`;
  return (await import(moduleUrl)).continuationNeedsManualConfirmation;
}

const gate = await loadConfirmationGate();

assert.equal(gate({ requiresConfirmation: true, status: "SUCCEEDED" }, false), true);
assert.equal(gate({ requiresConfirmation: false, status: "waiting_confirmation" }, false), true);
assert.equal(gate({ requiresConfirmation: false, status: "RUNNING" }, true), true);
assert.equal(gate({ requiresConfirmation: false, status: "RUNNING" }, false), false);

const continuationStart = assistantSource.indexOf("const continuation = result.data.continuation;");
const nextRunAssignment = assistantSource.indexOf("currentRunId = nextRunId;", continuationStart);
assert.notEqual(continuationStart, -1, "continuation loop is missing");
assert.notEqual(nextRunAssignment, -1, "continuation loop no longer advances by durable Run");
const continuationBlock = assistantSource.slice(continuationStart, nextRunAssignment + "currentRunId = nextRunId;".length);

assert.match(continuationBlock, /continuation\.sessionId\s*&&\s*continuation\.sessionId\s*!==\s*executionControlPlane\.sessionId/);
assert.match(continuationBlock, /nextAudits[\s\S]*?\.map\(\(audit\)\s*=>\s*audit\.toolCode\)/);
assert.match(continuationBlock, /nextAudits\.some\(isPendingApprovalAudit\)/);
assert.match(continuationBlock, /nextDurableRunStatus\s*===\s*"WAITING_CONFIRMATION"/);
assert.match(continuationBlock, /if \(nextRunNeedsManualConfirmation\)[\s\S]*?awaitingManualConfirmation/);
assert.match(continuationBlock, /awaitingManualConfirmation[\s\S]*?runId:\s*nextRunId/);
assert.equal(continuationBlock.includes("confirmAndExecuteAgentRun"), false);
assert.match(continuationBlock, /continuationSession\.actorId/);
assert.match(assistantSource, /setControlPlane\(awaitingManualConfirmation\)/);
assert.match(assistantSource, /continuationManualConfirmationActive[\s\S]*?activeRequiresConfirmation/);

console.log("PASS continuation confirmation cannot be reused for a new pending Durable Run");
