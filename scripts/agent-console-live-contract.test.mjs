import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

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
const backendVisibilityPath = path.resolve(
  frontendRoot,
  "..",
  "DataSmartGovernBackend",
  "python-ai-runtime",
  "src",
  "datasmart_ai_runtime",
  "services",
  "runtime_events",
  "runtime_event_visibility.py",
);

const page = fs.readFileSync(pagePath, "utf8");
const socket = fs.readFileSync(socketPath, "utf8");
const backendRoutes = fs.readFileSync(backendRoutesPath, "utf8");
const backendWebSocket = fs.readFileSync(backendWebSocketPath, "utf8");
const backendVisibility = fs.readFileSync(backendVisibilityPath, "utf8");

function requireMatch(source, expression, label) {
  assert.match(source, expression, label);
}

function waitFor(predicate, timeoutMs = 1_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (predicate()) {
        resolve();
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error("Timed out waiting for runtime socket state."));
        return;
      }
      setTimeout(poll, 10);
    };
    poll();
  });
}

/**
 * Load the TypeScript socket module with only its browser-independent helpers.
 *
 * The production module imports the authenticated API client and presentation
 * safety helpers through Vite aliases.  This contract test does not issue HTTP
 * requests or render content, so replacing those imports with small safe stubs
 * lets Node exercise the real connection state machine without a browser or a
 * Vite runtime.
 */
async function loadRuntimeEventSocketModule() {
  const testableSource = socket
    .replace(
      'import { request } from "@/api/client";',
      'const request = async () => ({ data: {}, meta: { source: "api" } });',
    )
    .replace(
      'import { projectAgentSseAttributes, publicAgentSummary } from "@/features/agent/publicPresentationSafety";',
      'const projectAgentSseAttributes = () => ({}); const publicAgentSummary = (value, fallback) => typeof value === "string" ? value : fallback;',
    );
  const emitted = ts.transpileModule(testableSource, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(emitted).toString("base64")}`;
  return import(moduleUrl);
}

const replayRoutePattern = /@app\.post\("\/agent\/events\/replay"\)|app\.post\("\/agent\/events\/replay"\)\(replay_agent_events\)/;
const controlRoutePattern = /@app\.post\("\/agent\/events\/control"\)|app\.post\("\/agent\/events\/control"\)\(control_agent_event_subscription\)/;
requireMatch(backendRoutes, replayRoutePattern, "backend replay route");
requireMatch(backendRoutes, controlRoutePattern, "backend control route");
requireMatch(backendRoutes, /@app\.websocket\("\/agent\/events\/ws"\)/, "backend websocket route");
requireMatch(backendWebSocket, /CONTROL_RESPONSE\s*=\s*"control_response"/, "backend control response frame");
requireMatch(backendWebSocket, /EVENT_ENVELOPE\s*=\s*"event_envelope"/, "backend event envelope frame");
requireMatch(backendWebSocket, /RUNTIME_EVENT_WEBSOCKET_SUBPROTOCOL\s*=\s*"datasmart-agent-events-v1"/,
  "backend websocket subprotocol");
requireMatch(backendWebSocket, /replay_envelope\.get\("sourceCursors"\)/,
  "backend can send a cursor-only replay envelope");

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
for (const eventType of ["autopilot_policy_activated", "autopilot_recovery_started", "autopilot_attention_required"]) {
  assert.doesNotMatch(backendVisibility, new RegExp(`"${eventType}"`),
    `${eventType} is not emitted by the current backend visibility contract`);
  assert.doesNotMatch(socket, new RegExp(`"${eventType}"`),
    `${eventType} must not be invented by the browser allowlist`);
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
requireMatch(socket, /lastAcknowledgedSourceCursors/, "source cursor acknowledgement checkpoint");
requireMatch(socket, /const sourceCursorsChanged = !cursorMapsEqual\(sourceCursors, mergedSourceCursors\);/,
  "cursor-only envelopes must update the reconnect bookmark");
requireMatch(socket, /!sequenceAdvanced && !sourceCursorsChanged/,
  "acknowledgement must consider both replay coordinates");
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
requireMatch(page, /autopilotSnapshot/, "console must render durable AUTOPILOT snapshot");
requireMatch(page, /maxRecoveryCycles/, "console must expose the server-owned AUTOPILOT recovery budget");

const { createAgentRuntimeEventSocket } = await loadRuntimeEventSocketModule();
const sentFrames = [];
const testSockets = [];
function createTestSocket() {
  return {
    readyState: 1,
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
    send(data) {
      sentFrames.push(JSON.parse(data));
    },
    close() {
      this.readyState = 3;
    },
  };
}
const socketHandle = createAgentRuntimeEventSocket({
  clientId: "contract-test-client",
  projectId: 27,
  websocketUrl: "ws://contract.test/api/agent/events/ws",
  onEvents: () => assert.fail("a cursor-only envelope must not manufacture a visible event"),
  reconnectBaseDelayMs: 50,
  reconnectMaxDelayMs: 50,
  random: () => 0,
  websocketFactory: () => {
    const testSocket = createTestSocket();
    testSockets.push(testSocket);
    return testSocket;
  },
});
await waitFor(() => testSockets.length === 1);
const testSocket = testSockets[0];
testSocket.onopen?.({});
await new Promise((resolve) => setTimeout(resolve, 0));
testSocket.onmessage?.({
  data: JSON.stringify({
    frameType: "control_response",
    payload: {
      accepted: true,
      messageType: "subscribe",
      subscription: { subscriptionId: "cursor-contract-subscription" },
    },
  }),
});
await new Promise((resolve) => setTimeout(resolve, 0));
testSocket.onmessage?.({
  data: JSON.stringify({
    frameType: "event_envelope",
    payload: {
      projectId: 27,
      events: [],
      sourceCursors: { javaRuntimeProjection: 41 },
    },
  }),
});
await new Promise((resolve) => setTimeout(resolve, 0));
assert.deepEqual(socketHandle.getState().sourceCursors, { javaRuntimeProjection: 41 },
  "cursor-only envelopes must update the reconnect request state");
assert.deepEqual(
  sentFrames.find((frame) => frame.type === "ack"),
  {
    type: "ack",
    subscriptionId: "cursor-contract-subscription",
    lastSequence: 0,
    sourceCursors: { javaRuntimeProjection: 41 },
  },
  "cursor-only envelopes must be acknowledged before the next heartbeat",
);

const frameCountBeforeDisconnect = sentFrames.length;
testSocket.readyState = 3;
testSocket.onclose?.({});
assert.equal(socketHandle.getState().subscriptionId, undefined,
  "a physical close must discard the server-owned subscription ID");
await waitFor(() => testSockets.length === 2);
const replacementSocket = testSockets[1];
replacementSocket.onopen?.({});
await waitFor(() => sentFrames.slice(frameCountBeforeDisconnect).some((frame) => frame.type === "subscribe"));
const reconnectFrames = sentFrames.slice(frameCountBeforeDisconnect);
const replacementSubscribe = reconnectFrames.find((frame) => frame.type === "subscribe");
assert.equal(reconnectFrames.some((frame) => frame.type === "reconnect"), false,
  "a physically closed subscription must not be resumed by its stale ID");
assert.deepEqual(replacementSubscribe?.subscription.sourceCursors, { javaRuntimeProjection: 41 },
  "the replacement subscription must retain the live replay cursor");
replacementSocket.onmessage?.({
  data: JSON.stringify({
    frameType: "control_response",
    payload: {
      accepted: true,
      messageType: "subscribe",
      subscription: { subscriptionId: "replacement-contract-subscription" },
    },
  }),
});
await waitFor(() => socketHandle.getState().subscriptionId === "replacement-contract-subscription");
socketHandle.close("contract_test_complete");

console.log("agent-console live contract: PASS");
