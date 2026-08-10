import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDirectory, "..");
const endpoints = fs.readFileSync(path.join(frontendRoot, "src", "api", "endpoints.ts"), "utf8");
const agentConsole = fs.readFileSync(path.join(frontendRoot, "src", "pages", "AgentConsole.tsx"), "utf8");
const agentAssistant = fs.readFileSync(path.join(frontendRoot, "src", "pages", "AgentAssistant.tsx"), "utf8");

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

console.log("api adapter contract: PASS");
