import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDirectory, "..");
const pagePath = path.join(frontendRoot, "src", "pages", "AgentConsole.tsx");
const socketPath = path.join(frontendRoot, "src", "features", "agent", "runtimeEventSocket.ts");
const backendRoutesPath = path.resolve(
  frontendRoot,
  "..",
  "DataSmartGovernBackend",
  "python-ai-runtime",
  "src",
  "datasmart_ai_runtime",
  "api",
  "agent",
  "routes.py",
);
const backendWebSocketPath = path.resolve(
  frontendRoot,
  "..",
  "DataSmartGovernBackend",
  "python-ai-runtime",
  "src",
  "datasmart_ai_runtime",
  "services",
  "runtime_events",
  "runtime_event_websocket.py",
);

const page = fs.readFileSync(pagePath, "utf8");
const socket = fs.readFileSync(socketPath, "utf8");
const backendRoutes = fs.readFileSync(backendRoutesPath, "utf8");
const backendWebSocket = fs.readFileSync(backendWebSocketPath, "utf8");

function requireMatch(source, expression, label) {
  assert.match(source, expression, label);
}

const replayRoutePattern = /@app\.post\("\/agent\/events\/replay"\)|app\.post\("\/agent\/events\/replay"\)\(replay_agent_events\)/;
const controlRoutePattern = /@app\.post\("\/agent\/events\/control"\)|app\.post\("\/agent\/events\/control"\)\(control_agent_event_subscription\)/;
requireMatch(backendRoutes, replayRoutePattern, "backend replay route");
requireMatch(backendRoutes, controlRoutePattern, "backend control route");
requireMatch(backendRoutes, /@app\.websocket\("\/agent\/events\/ws"\)/, "backend websocket route");
requireMatch(backendWebSocket, /CONTROL_RESPONSE\s*=\s*"control_response"/, "backend control response frame");
requireMatch(backendWebSocket, /EVENT_ENVELOPE\s*=\s*"event_envelope"/, "backend event envelope frame");

requireMatch(socket, /\/api\/agent\/events\/ws/, "gateway websocket path");
requireMatch(socket, /AGENT_RUNTIME_EVENT_WEBSOCKET_PROTOCOL/, "websocket application protocol");
requireMatch(socket, /AGENT_RUNTIME_EVENT_BEARER_PROTOCOL_PREFIX/, "websocket bearer protocol");
requireMatch(socket, /accessTokenProvider/, "OIDC websocket token provider");
requireMatch(socket, /new WebSocket\(url, protocols\)/, "websocket protocol transport");
requireMatch(socket, /\/agent\/events\/replay/, "REST replay path");
requireMatch(socket, /\/agent\/events\/control/, "REST control path");
for (const controlType of ["subscribe", "ack", "heartbeat", "reconnect", "unsubscribe"]) {
  requireMatch(socket, new RegExp(`type: "${controlType}"`), `${controlType} control message`);
}
requireMatch(socket, /frameType.*control_response/, "control response parser");
requireMatch(socket, /frameType.*event_envelope/, "event envelope parser");
requireMatch(socket, /frameType.*error/, "error frame parser");
requireMatch(socket, /Math\.pow\(2,\s*exponent\)/, "exponential reconnect backoff");
requireMatch(socket, /setTimeout/, "reconnect timer");
requireMatch(socket, /clearTimeout/, "timeout cleanup");
requireMatch(socket, /setInterval/, "heartbeat timer");
requireMatch(socket, /clearInterval/, "interval cleanup");
requireMatch(socket, /connectionGeneration/, "stale socket generation guard");
requireMatch(socket, /projectAgentSseAttributes/, "low-sensitive attribute projection");
requireMatch(socket, /LOW_SENSITIVITY_RUNTIME_EVENT_TYPES/, "event type allowlist");
assert.doesNotMatch(socket, /safeAttributes\s*:\s*readAlias\(/, "raw event attributes must not be returned");

for (const queryName of [
  "agent-gateway-session",
  "agent-tools",
  "agent-sessions",
  "agent-model-routes",
  "runtime-events",
  "agent-rag-diagnostics",
  "agent-runtime-diagnostics",
  "agent-specialist-turn-facts",
]) {
  const queryPattern = new RegExp(String.raw`queryKey:\s*\["${queryName}"[^\]]*projectScopeId`);
  requireMatch(page, queryPattern, `${queryName} project-scoped React Query key`);
}
requireMatch(page, /listAgentSessions\(\{\s*projectId:\s*projectScopeId\s*\}\)/, "project-scoped session request");
requireMatch(page, /replayAgentRuntimeEvents\(\{[\s\S]*?projectId:\s*projectScopeId/, "project-scoped replay request");
requireMatch(page, /filter\(\(session\)\s*=>\s*isCurrentProject/, "session response scope guard");
requireMatch(page, /filter\(\(fact\)\s*=>\s*\(/, "fact response scope guard");
requireMatch(page, /projectGenerationRef\.current\s*(?:\+\+|\+=\s*1)/, "project generation increment");
requireMatch(page, /setLiveEvents\(\[\]\)/, "project switch live-event reset");
requireMatch(page, /createPlanMutation\.reset|resetCreatePlanMutation/, "project switch plan reset");
requireMatch(page, /ragQueryMutation\.reset|resetRagQueryMutation/, "project switch RAG reset");
requireMatch(page, /socket\.close\("project_changed_or_unmount"\)/, "socket cleanup on scope change");
requireMatch(page, /invalidateQueries\(\{\s*queryKey:\s*\[\"runtime-events\",\s*projectScopeId\]/, "scoped REST invalidation fallback");
assert.doesNotMatch(page, /event\.attributes/, "page must not render raw event attributes");

console.log("agent-console live contract: PASS");
