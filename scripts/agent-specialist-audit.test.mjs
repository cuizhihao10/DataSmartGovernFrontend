import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/**
 * Keep the administrative Specialist audit from silently regressing into a
 * generic tool-audit view.
 *
 * This repository deliberately uses dependency-free Node contract tests for
 * presentation boundaries. The assertions validate that the console fetches
 * durable facts, projects them through the shared low-sensitive adapter, and
 * renders the existing six-role panel without introducing a console-side
 * approval mutation that could bypass the user collaboration flow.
 */
async function verifyAdministrativeSpecialistAudit() {
  const [consoleSource, projectionSource] = await Promise.all([
    readFile(new URL("../src/pages/AgentConsole.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/features/agent/specialistFactProjection.ts", import.meta.url), "utf8"),
  ]);

  assert.match(consoleSource, /api\.listAgentSpecialistTurnFactsByRun\(activeRun!\.runId\)/);
  assert.match(consoleSource, /specialistExecutionFromDurableFacts\(specialistFacts\)/);
  assert.match(consoleSource, /<SpecialistAgentExecutionPanel/);
  assert.match(consoleSource, /key: "specialist-audit"/);
  assert.match(consoleSource, /message="持久化 Specialist 事实审计"/);
  assert.doesNotMatch(consoleSource, /approveAgentToolExecution\(/);

  assert.match(projectionSource, /AgentSpecialistTurnFact/);
  assert.match(projectionSource, /isSpecialistFailureStatus/);
  assert.match(projectionSource, /evidenceReferences: fact\.evidenceRefs/);
  assert.match(projectionSource, /toolActivitySummaryRefs/);
  assert.match(projectionSource, /must never infer a missing result/i);
}

await verifyAdministrativeSpecialistAudit();
console.log("PASS administrative Specialist audit exposes durable facts without an approval bypass");
