import { request } from "@/api/client";
import { projectAgentSseAttributes, publicAgentSummary } from "@/features/agent/publicPresentationSafety";
import type { WithMeta } from "@/types/domain";

/** The gateway-facing path. Authentication stays in the same-origin session. */
export const AGENT_RUNTIME_EVENT_WS_PATH = "/api/agent/events/ws";
export const AGENT_RUNTIME_EVENT_REPLAY_PATH = "/agent/events/replay";
export const AGENT_RUNTIME_EVENT_CONTROL_PATH = "/agent/events/control";
export const AGENT_RUNTIME_EVENT_WEBSOCKET_PROTOCOL = "datasmart-agent-events-v1";
export const AGENT_RUNTIME_EVENT_BEARER_PROTOCOL_PREFIX = "datasmart-bearer-v1.";

const SOCKET_OPEN = 1;
const DEFAULT_RECONNECT_BASE_DELAY_MS = 500;
const DEFAULT_RECONNECT_MAX_DELAY_MS = 30_000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 20_000;
const STABLE_CONNECTION_WINDOW_MS = 10_000;
const MAX_PROJECTED_EVENTS = 100;

/**
 * These are the event kinds that can be shown as operational progress. The
 * server performs the authoritative visibility check; this second allowlist
 * keeps a rolling deployment from turning the browser into a raw event viewer.
 */
export const LOW_SENSITIVITY_RUNTIME_EVENT_TYPES = [
  "agent_plan_started",
  "agent_plan_completed",
  "context_collected",
  "context_filtered",
  "context_deduplicated",
  "context_truncated",
  "context_selected",
  "intent_analyzed",
  "tool_planned",
  "tool_parameter_validated",
  "tool_action_intake_recorded",
  "tool_execution_readiness_recorded",
  "agent_execution_gate_recorded",
  "model_tool_call_proposed",
  "model_tool_call_accepted",
  "model_tool_call_rejected",
  "model_tool_call_approval_required",
  "skill_visibility_snapshot_recorded",
  "tool_execution_state_changed",
  "tool_auto_execution_sync_completed",
  "tool_result_feedback_built",
  "agent_loop_control_decided",
  "model_second_turn_completed",
  "model_second_turn_skipped",
  "model_public_output_ready",
  "approval_waiting",
  "run_started",
  "run_completed",
  "run_failed",
  "started",
  "completed",
  "failed",
  "cancelled",
  "canceled",
  "progress",
  "status",
  "approval_required",
  "approval_waiting",
  "tool_execution",
  "tool_completed",
] as const;

const LOW_SENSITIVITY_RUNTIME_EVENT_TYPE_SET = new Set<string>(LOW_SENSITIVITY_RUNTIME_EVENT_TYPES);

export type RuntimeEventSocketStatus =
  | "idle"
  | "connecting"
  | "open"
  | "reconnecting"
  | "replay"
  | "closed"
  | "error";

export interface AgentRuntimeEventSubscription {
  clientId: string;
  tenantId?: number | string;
  projectId: number | string;
  actorId?: number | string;
  roles?: string[];
  sessionId?: string;
  runId?: string;
  requestId?: string;
  afterSequence?: number;
  sourceCursors?: Record<string, number>;
  /** Keep empty by default: the backend enum is versioned and filters by role. */
  eventTypes?: string[];
  includeSnapshot?: boolean;
}

export interface RuntimeEventProjectionScope {
  projectId: number;
  tenantId?: number;
  sessionId?: string;
  runId?: string;
  requestId?: string;
}

export interface AgentRuntimeEventProjection {
  id: string;
  time: string;
  level: "INFO" | "WARN" | "ERROR";
  title: string;
  detail: string;
  domain: string;
  projectId: number;
  tenantId?: number;
  actorId?: string;
  sessionId?: string;
  runId?: string;
  requestId?: string;
  sequence?: number;
  eventType: string;
  /** Already allowlisted; callers must not render transport attributes directly. */
  safeAttributes: Record<string, unknown>;
}

export interface ProjectedRuntimeEventEnvelope {
  envelopeId?: string;
  projectId?: number;
  sequenceFrom?: number;
  sequenceTo?: number;
  replayFromSequence?: number;
  hasMore: boolean;
  sourceCursors: Record<string, number>;
  events: AgentRuntimeEventProjection[];
  lastSequence?: number;
}

export interface AgentRuntimeEventReplayPage {
  current: number;
  size: number;
  total: number;
  pages: number;
  records: AgentRuntimeEventProjection[];
  envelope: ProjectedRuntimeEventEnvelope;
}

export interface RuntimeEventSocketFrame {
  frameType: "control_response" | "event_envelope" | "error" | string;
  payload: Record<string, unknown>;
}

export interface AgentRuntimeEventSocketEnvelopeContext {
  envelope: ProjectedRuntimeEventEnvelope;
  source: "websocket" | "replay";
}

export interface AgentRuntimeEventSocketOptions extends AgentRuntimeEventSubscription {
  onEvents: (events: AgentRuntimeEventProjection[], context: AgentRuntimeEventSocketEnvelopeContext) => void;
  onStatus?: (status: RuntimeEventSocketStatus) => void;
  onError?: (error: unknown) => void;
  /** Called after a failed replay so the scoped React Query entry can retry. */
  onInvalidate?: (reason: string) => void;
  websocketUrl?: string;
  /** Current OIDC token; never put it in the URL or a control frame. */
  accessToken?: string | null;
  /** Refresh the OIDC token before each initial/reconnect handshake. */
  accessTokenProvider?: () => Promise<string | null>;
  websocketFactory?: (url: string, protocols?: string[]) => RuntimeEventWebSocketLike;
  reconnectBaseDelayMs?: number;
  reconnectMaxDelayMs?: number;
  heartbeatIntervalMs?: number;
  random?: () => number;
}

export interface RuntimeEventWebSocketLike {
  readonly readyState: number;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export interface AgentRuntimeEventSocketHandle {
  close: (reason?: string) => void;
  getState: () => {
    status: RuntimeEventSocketStatus;
    subscriptionId?: string;
    lastSequence: number;
    sourceCursors: Record<string, number>;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readAlias(record: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (key in record && record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const text = String(value).trim();
  return text || undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readPositiveInteger(value: unknown): number | undefined {
  const parsed = readNumber(value);
  return parsed != null && parsed > 0 ? Math.floor(parsed) : undefined;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeProjectId(value: unknown): number | undefined {
  const parsed = readPositiveInteger(value);
  return parsed;
}

function normalizeSequence(value: unknown, fallback = 0): number {
  const parsed = readPositiveInteger(value);
  return parsed ?? Math.max(0, Math.floor(fallback));
}

function safeCode(value: unknown, fallback: string): string {
  const text = readString(value);
  return text && /^[A-Za-z0-9._:/ -]{1,160}$/.test(text) ? text : fallback;
}

function safeTime(value: unknown): string {
  const text = readString(value);
  if (!text) return "";
  return Number.isNaN(Date.parse(text)) ? "" : text;
}

function normalizeEventType(value: unknown): string | undefined {
  const text = readString(value)?.toLowerCase();
  return text && LOW_SENSITIVITY_RUNTIME_EVENT_TYPE_SET.has(text) ? text : undefined;
}

function normalizeSeverity(value: unknown): AgentRuntimeEventProjection["level"] {
  const severity = readString(value)?.toLowerCase();
  if (severity === "error") return "ERROR";
  if (severity === "warning" || severity === "warn") return "WARN";
  return "INFO";
}

function eventIdentity(event: AgentRuntimeEventProjection): string {
  return event.sequence != null
    ? `sequence:${event.sequence}`
    : `event:${event.id}:${event.eventType}:${event.sessionId ?? ""}:${event.runId ?? ""}`;
}

function normalizeCursorMap(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const cursors: Record<string, number> = {};
  for (const [key, cursor] of Object.entries(value)) {
    const normalized = readPositiveInteger(cursor);
    if (key.trim() && normalized != null) cursors[key.trim()] = normalized;
  }
  return cursors;
}

function mergeCursorMaps(...values: unknown[]): Record<string, number> {
  return values.reduce<Record<string, number>>((merged, value) => {
    Object.entries(normalizeCursorMap(value)).forEach(([key, cursor]) => {
      merged[key] = Math.max(merged[key] ?? 0, cursor);
    });
    return merged;
  }, {});
}

/**
 * Compare source-level replay bookmarks by value instead of object identity.
 *
 * `sourceCursors` belong to external sources such as the Java runtime-event
 * projection, Redis Streams, or Kafka.  An envelope can advance one of these
 * bookmarks without adding a browser-facing event or global sequence number.
 * The client therefore needs an explicit value comparison to decide whether it
 * must acknowledge the new bookmark and preserve it for the next reconnect.
 */
function cursorMapsEqual(left: Record<string, number>, right: Record<string, number>): boolean {
  const leftEntries = Object.entries(left);
  if (leftEntries.length !== Object.keys(right).length) return false;
  return leftEntries.every(([key, cursor]) => right[key] === cursor);
}

function normalizedScope(scope: RuntimeEventProjectionScope): RuntimeEventProjectionScope {
  return {
    ...scope,
    projectId: normalizeProjectId(scope.projectId) ?? 0,
    tenantId: normalizeProjectId(scope.tenantId),
  };
}

/**
 * Project one wire event. Missing project scope is rejected deliberately: a
 * browser cannot infer ownership from a session or a human-readable message.
 */
export function projectRuntimeEvent(
  value: unknown,
  scope: RuntimeEventProjectionScope,
  envelopeProjectId?: number,
): AgentRuntimeEventProjection | undefined {
  if (!isRecord(value)) return undefined;
  const normalized = normalizedScope(scope);
  if (!normalized.projectId) return undefined;

  const eventType = normalizeEventType(readAlias(value, "eventType", "event_type", "type"));
  if (!eventType) return undefined;

  const eventProjectId = normalizeProjectId(readAlias(value, "projectId", "project_id"));
  const scopedEnvelopeProjectId = normalizeProjectId(envelopeProjectId);
  if (eventProjectId != null && eventProjectId !== normalized.projectId) return undefined;
  if (scopedEnvelopeProjectId != null && scopedEnvelopeProjectId !== normalized.projectId) return undefined;
  const projectId = eventProjectId ?? scopedEnvelopeProjectId;
  if (projectId == null || projectId !== normalized.projectId) return undefined;

  const eventTenantId = normalizeProjectId(readAlias(value, "tenantId", "tenant_id"));
  if (normalized.tenantId != null && eventTenantId != null && eventTenantId !== normalized.tenantId) return undefined;
  if (normalized.sessionId && readString(readAlias(value, "sessionId", "session_id")) !== normalized.sessionId) return undefined;
  if (normalized.runId && readString(readAlias(value, "runId", "run_id")) !== normalized.runId) return undefined;
  if (normalized.requestId && readString(readAlias(value, "requestId", "request_id")) !== normalized.requestId) return undefined;

  const sequence = readPositiveInteger(readAlias(value, "sequence", "replaySequence", "replay_sequence"));
  const eventId = safeCode(
    readAlias(value, "eventId", "event_id", "identityKey", "identity_key", "id"),
    sequence != null ? `${eventType}:${sequence}` : `${eventType}:${projectId}`,
  );
  const stage = safeCode(readAlias(value, "stage"), "runtime");
  const message = publicAgentSummary(readAlias(value, "message"), "");
  const safeAttributes = projectAgentSseAttributes(readAlias(value, "attributes") ?? {});
  const detail = message || (stage === "runtime" ? "已记录低敏运行事件。" : `阶段：${stage}`);

  return {
    id: eventId,
    time: safeTime(readAlias(value, "createdAt", "created_at", "publishedAt", "published_at")),
    level: normalizeSeverity(readAlias(value, "severity", "level")),
    title: eventType,
    detail,
    domain: "agent-runtime",
    projectId,
    tenantId: eventTenantId,
    actorId: readString(readAlias(value, "actorId", "actor_id")),
    sessionId: readString(readAlias(value, "sessionId", "session_id")),
    runId: readString(readAlias(value, "runId", "run_id")),
    requestId: readString(readAlias(value, "requestId", "request_id")),
    sequence,
    eventType,
    safeAttributes,
  };
}

/** Project a complete event envelope and reject an envelope from another project. */
export function projectRuntimeEventEnvelope(
  value: unknown,
  scope: RuntimeEventProjectionScope,
): ProjectedRuntimeEventEnvelope {
  const record = isRecord(value) ? value : {};
  const rawAttributes = readAlias(record, "attributes") ?? {};
  const envelopeProjectId = normalizeProjectId(readAlias(record, "projectId", "project_id"));
  const eventValues = readArray(readAlias(record, "events"));
  const events = eventValues
    .map((event) => projectRuntimeEvent(event, scope, envelopeProjectId))
    .filter((event): event is AgentRuntimeEventProjection => Boolean(event));
  const sequenceFrom = readPositiveInteger(readAlias(record, "sequenceFrom", "sequence_from"));
  const sequenceTo = readPositiveInteger(readAlias(record, "sequenceTo", "sequence_to"));
  const replayFromSequence = readPositiveInteger(readAlias(record, "replayFromSequence", "replay_from_sequence"));
  const eventSequence = events.reduce<number | undefined>(
    (maximum, event) => event.sequence == null ? maximum : Math.max(maximum ?? 0, event.sequence),
    undefined,
  );
  const lastSequence = [sequenceTo, eventSequence]
    .filter((sequence): sequence is number => sequence != null)
    .reduce<number | undefined>((maximum, sequence) => Math.max(maximum ?? 0, sequence), undefined);
  const sourceCursors = mergeCursorMaps(
    readAlias(record, "sourceCursors", "source_cursors"),
    isRecord(rawAttributes) ? readAlias(rawAttributes, "sourceCursors", "source_cursors") : undefined,
  );

  return {
    envelopeId: readString(readAlias(record, "envelopeId", "envelope_id")),
    projectId: envelopeProjectId,
    sequenceFrom,
    sequenceTo,
    replayFromSequence,
    hasMore: Boolean(readAlias(record, "hasMore", "has_more")),
    sourceCursors,
    events,
    lastSequence,
  };
}

/** Stable, bounded merge used by both REST replay and live frames. */
export function mergeRuntimeEvents(
  current: readonly AgentRuntimeEventProjection[],
  incoming: readonly AgentRuntimeEventProjection[],
  limit = MAX_PROJECTED_EVENTS,
): AgentRuntimeEventProjection[] {
  const byIdentity = new Map<string, AgentRuntimeEventProjection>();
  [...current, ...incoming].forEach((event) => {
    const identity = eventIdentity(event);
    const previous = byIdentity.get(identity);
    byIdentity.set(identity, previous ? { ...previous, ...event, safeAttributes: { ...previous.safeAttributes, ...event.safeAttributes } } : event);
  });
  return [...byIdentity.values()]
    .sort((left, right) => {
      if (left.sequence != null && right.sequence != null && left.sequence !== right.sequence) {
        return left.sequence - right.sequence;
      }
      return (Date.parse(left.time) || 0) - (Date.parse(right.time) || 0);
    })
    .slice(-Math.max(1, limit));
}

export function buildSubscriptionRequest(subscription: AgentRuntimeEventSubscription): Record<string, unknown> {
  return {
    clientId: subscription.clientId,
    tenantId: subscription.tenantId,
    projectId: subscription.projectId,
    actorId: subscription.actorId,
    roles: subscription.roles ?? [],
    sessionId: subscription.sessionId,
    runId: subscription.runId,
    requestId: subscription.requestId,
    afterSequence: normalizeSequence(subscription.afterSequence),
    sourceCursors: normalizeCursorMap(subscription.sourceCursors),
    eventTypes: subscription.eventTypes ?? [],
    includeSnapshot: subscription.includeSnapshot ?? true,
  };
}

export function buildSubscribeMessage(subscription: AgentRuntimeEventSubscription) {
  return { type: "subscribe", subscription: buildSubscriptionRequest(subscription) } as const;
}

export function buildAckMessage(
  subscriptionId: string,
  lastSequence: number,
  sourceCursors: Record<string, number> = {},
) {
  return {
    type: "ack",
    subscriptionId,
    lastSequence: normalizeSequence(lastSequence),
    sourceCursors: normalizeCursorMap(sourceCursors),
  } as const;
}

export function buildHeartbeatMessage(
  subscriptionId: string,
  lastSequence: number,
  sourceCursors: Record<string, number> = {},
) {
  return {
    type: "heartbeat",
    subscriptionId,
    lastSequence: normalizeSequence(lastSequence),
    sourceCursors: normalizeCursorMap(sourceCursors),
  } as const;
}

export function buildReconnectMessage(
  subscriptionId: string,
  afterSequence: number,
  sourceCursors: Record<string, number> = {},
) {
  return {
    type: "reconnect",
    subscriptionId,
    afterSequence: normalizeSequence(afterSequence),
    sourceCursors: normalizeCursorMap(sourceCursors),
  } as const;
}

export function buildUnsubscribeMessage(subscriptionId: string, reason = "client_unmount") {
  return { type: "unsubscribe", subscriptionId, reason } as const;
}

function envelopeFromReplayData(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {};
  const nested = readAlias(value, "eventEnvelope", "event_envelope");
  if (isRecord(nested)) return nested;
  const nestedData = readAlias(value, "data");
  if (isRecord(nestedData)) {
    const nestedEnvelope = readAlias(nestedData, "eventEnvelope", "event_envelope");
    if (isRecord(nestedEnvelope)) return nestedEnvelope;
    if ("events" in nestedData) return nestedData;
  }
  return "events" in value ? value : {};
}

function replayPageFromEnvelope(
  envelope: ProjectedRuntimeEventEnvelope,
): AgentRuntimeEventReplayPage {
  return {
    current: 1,
    size: envelope.events.length,
    total: envelope.events.length,
    pages: 1,
    records: envelope.events,
    envelope,
  };
}

/** REST snapshot/replay contract used on initial load and after a socket fault. */
export async function replayAgentRuntimeEvents(
  subscription: AgentRuntimeEventSubscription,
): Promise<WithMeta<AgentRuntimeEventReplayPage>> {
  const result = await request<unknown>(AGENT_RUNTIME_EVENT_REPLAY_PATH, {
    method: "POST",
    body: JSON.stringify({ subscription: buildSubscriptionRequest(subscription) }),
  });
  const envelope = projectRuntimeEventEnvelope(
    envelopeFromReplayData(result.data),
    {
      projectId: normalizeProjectId(subscription.projectId) ?? 0,
      tenantId: normalizeProjectId(subscription.tenantId),
      sessionId: subscription.sessionId,
      runId: subscription.runId,
      requestId: subscription.requestId,
    },
  );
  return { ...result, data: replayPageFromEnvelope(envelope) };
}

/** HTTP version of the same control contract, useful when WebSocket is unavailable. */
export async function controlAgentRuntimeEvent(payload: Record<string, unknown>): Promise<WithMeta<unknown>> {
  return request<unknown>(AGENT_RUNTIME_EVENT_CONTROL_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function buildAgentRuntimeEventWebSocketUrl(
  path = AGENT_RUNTIME_EVENT_WS_PATH,
  locationLike?: Pick<Location, "href">,
): string {
  if (/^wss?:\/\//i.test(path)) return path;
  if (typeof window === "undefined" && !locationLike) return path;
  const base = locationLike?.href ?? window.location.href;
  const url = new URL(path, base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function encodeWebSocketToken(token: string): string {
  const bytes = new TextEncoder().encode(token);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * Native browser WebSocket cannot set Authorization headers.  The token is
 * carried in a dedicated subprotocol only for the authenticated handshake;
 * the Gateway strips it before proxying to Python Runtime.
 */
export function buildAgentRuntimeEventWebSocketProtocols(accessToken?: string | null): string[] {
  const protocols = [AGENT_RUNTIME_EVENT_WEBSOCKET_PROTOCOL];
  const token = accessToken?.trim();
  if (token) protocols.push(`${AGENT_RUNTIME_EVENT_BEARER_PROTOCOL_PREFIX}${encodeWebSocketToken(token)}`);
  return protocols;
}

function parseFrame(value: unknown): RuntimeEventSocketFrame | undefined {
  if (!isRecord(value)) return undefined;
  const frameType = readString(readAlias(value, "frameType", "frame_type"))?.toLowerCase();
  const payload = readAlias(value, "payload");
  if (frameType && isRecord(payload)) {
    return { frameType, payload };
  }
  if ("events" in value) return { frameType: "event_envelope", payload: value };
  if ("accepted" in value || "messageType" in value || "message_type" in value) {
    return { frameType: "control_response", payload: value };
  }
  return undefined;
}

function errorFromFrame(payload: Record<string, unknown>): Error {
  const nested = readAlias(payload, "error");
  const message = isRecord(nested)
    ? readString(readAlias(nested, "message", "detail"))
    : readString(nested);
  return new Error(message || "Agent runtime event socket returned an error frame.");
}

async function messageData(value: unknown): Promise<unknown> {
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return undefined; }
  }
  if (value instanceof Blob) {
    try { return JSON.parse(await value.text()); } catch { return undefined; }
  }
  if (value instanceof ArrayBuffer) {
    try { return JSON.parse(new TextDecoder().decode(value)); } catch { return undefined; }
  }
  return value;
}

/**
 * Create one project-scoped runtime event connection. All callbacks check the
 * closed generation, so a late frame cannot repopulate a page after switching
 * projects or unmounting it.
 */
export function createAgentRuntimeEventSocket(
  options: AgentRuntimeEventSocketOptions,
): AgentRuntimeEventSocketHandle {
  const projectId = normalizeProjectId(options.projectId) ?? 0;
  const scope: RuntimeEventProjectionScope = {
    projectId,
    tenantId: normalizeProjectId(options.tenantId),
    sessionId: options.sessionId,
    runId: options.runId,
    requestId: options.requestId,
  };
  const subscription: AgentRuntimeEventSubscription = {
    ...options,
    projectId,
    afterSequence: normalizeSequence(options.afterSequence),
    sourceCursors: normalizeCursorMap(options.sourceCursors),
  };
  const baseDelay = Math.max(50, options.reconnectBaseDelayMs ?? DEFAULT_RECONNECT_BASE_DELAY_MS);
  const maxDelay = Math.max(baseDelay, options.reconnectMaxDelayMs ?? DEFAULT_RECONNECT_MAX_DELAY_MS);
  const heartbeatInterval = Math.max(1_000, options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS);
  const random = options.random ?? Math.random;
  const websocketFactory = options.websocketFactory
    ?? ((url: string, protocols?: string[]) => new WebSocket(url, protocols));

  let status: RuntimeEventSocketStatus = "idle";
  let connection: RuntimeEventWebSocketLike | undefined;
  let connectionGeneration = 0;
  let subscriptionId: string | undefined;
  let lastSequence = normalizeSequence(subscription.afterSequence);
  let sourceCursors = normalizeCursorMap(subscription.sourceCursors);
  let lastAckSequence = lastSequence;
  let lastAcknowledgedSourceCursors = { ...sourceCursors };
  let reconnectAttempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let stableTimer: ReturnType<typeof setTimeout> | undefined;
  let replayPromise: Promise<void> | undefined;
  let closed = false;

  const emitStatus = (nextStatus: RuntimeEventSocketStatus) => {
    status = nextStatus;
    options.onStatus?.(nextStatus);
  };

  const reportError = (error: unknown) => {
    options.onError?.(error);
  };

  const clearHeartbeat = () => {
    if (heartbeatTimer !== undefined) clearInterval(heartbeatTimer);
    heartbeatTimer = undefined;
    if (stableTimer !== undefined) clearTimeout(stableTimer);
    stableTimer = undefined;
  };

  const clearRetry = () => {
    if (retryTimer !== undefined) clearTimeout(retryTimer);
    retryTimer = undefined;
  };

  const send = (payload: Record<string, unknown>) => {
    if (closed || !connection || connection.readyState !== SOCKET_OPEN) return false;
    try {
      connection.send(JSON.stringify(payload));
      return true;
    } catch (error) {
      reportError(error);
      return false;
    }
  };

  /**
   * Acknowledge both coordinates of the replay protocol.
   *
   * `lastSequence` is the browser's presentation sequence, while
   * `sourceCursors` are source-owned bookmarks.  Either coordinate can move
   * independently, so only checking the global sequence would lose an empty
   * external replay page and make the next reconnect request it again.
   */
  const acknowledge = () => {
    const sequenceAdvanced = lastSequence > lastAckSequence;
    const sourceCursorsChanged = !cursorMapsEqual(sourceCursors, lastAcknowledgedSourceCursors);
    if (!subscriptionId || (!sequenceAdvanced && !sourceCursorsChanged)) return;
    if (send(buildAckMessage(subscriptionId, lastSequence, sourceCursors))) {
      lastAckSequence = lastSequence;
      lastAcknowledgedSourceCursors = { ...sourceCursors };
    }
  };

  /**
   * Apply one replay or live envelope to the local subscription state.
   *
   * The server may return a source cursor even when its visibility policy
   * filtered every event from the page.  Update the cursor before deciding
   * whether there is anything to render, then acknowledge it when a socket is
   * available.  This keeps external replay sources incremental without showing
   * hidden events or inventing a UI event for an empty envelope.
   */
  const acceptEnvelope = (
    envelope: ProjectedRuntimeEventEnvelope,
    source: "websocket" | "replay",
    generation: number,
  ) => {
    if (closed || generation !== connectionGeneration) return;
    const nextSequence = envelope.lastSequence ?? lastSequence;
    const sequenceAdvanced = nextSequence > lastSequence;
    const mergedSourceCursors = mergeCursorMaps(sourceCursors, envelope.sourceCursors);
    const sourceCursorsChanged = !cursorMapsEqual(sourceCursors, mergedSourceCursors);
    if (sequenceAdvanced) lastSequence = nextSequence;
    sourceCursors = mergedSourceCursors;
    subscription.afterSequence = lastSequence;
    subscription.sourceCursors = sourceCursors;
    if (!envelope.events.length && !sequenceAdvanced && !sourceCursorsChanged) return;
    if (envelope.events.length) {
      options.onEvents(envelope.events, { envelope, source });
    }
    acknowledge();
  };

  const replayFromRest = async (reason: string, generation: number) => {
    if (closed || generation !== connectionGeneration) return;
    if (replayPromise) return replayPromise;
    replayPromise = (async () => {
      emitStatus("replay");
      try {
        const result = await replayAgentRuntimeEvents({
          ...subscription,
          afterSequence: lastSequence,
          sourceCursors,
        });
        if (closed || generation !== connectionGeneration) return;
        acceptEnvelope(result.data.envelope, "replay", generation);
      } catch (error) {
        if (closed || generation !== connectionGeneration) return;
        reportError(error);
        options.onInvalidate?.(reason);
      } finally {
        replayPromise = undefined;
      }
    })();
    return replayPromise;
  };

  const nextReconnectDelay = () => {
    const exponent = Math.min(reconnectAttempt, 8);
    const exponentialDelay = Math.min(maxDelay, baseDelay * Math.pow(2, exponent));
    reconnectAttempt += 1;
    const jitter = Math.floor(exponentialDelay * 0.2 * Math.max(0, Math.min(1, random())));
    return Math.min(maxDelay, exponentialDelay + jitter);
  };

  const scheduleReconnect = (reason: string, generation: number) => {
    if (closed || generation !== connectionGeneration || retryTimer !== undefined) return;
    const delay = nextReconnectDelay();
    emitStatus("reconnecting");
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      if (closed || generation !== connectionGeneration) return;
      connect();
    }, delay);
    void reason;
  };

  const handleDisconnect = (reason: string, generation: number) => {
    if (closed || generation !== connectionGeneration) return;
    clearHeartbeat();
    connection = undefined;
    // A physical socket close also destroys the server-side subscription. Never
    // reconnect it by ID: retain replay cursors, then establish a new subscription.
    subscriptionId = undefined;
    void replayFromRest(reason, generation).finally(() => scheduleReconnect(reason, generation));
  };

  const startHeartbeat = (generation: number) => {
    clearHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (closed || generation !== connectionGeneration || !subscriptionId) return;
      send(buildHeartbeatMessage(subscriptionId, lastSequence, sourceCursors));
    }, heartbeatInterval);
    stableTimer = setTimeout(() => {
      if (!closed && generation === connectionGeneration) reconnectAttempt = 0;
    }, STABLE_CONNECTION_WINDOW_MS);
  };

  const handleControlResponse = (payload: Record<string, unknown>, generation: number) => {
    const accepted = payload.accepted !== false;
    const messageType = readString(readAlias(payload, "messageType", "message_type"))?.toLowerCase();
    const rawSubscription = readAlias(payload, "subscription");
    const serverSubscription = isRecord(rawSubscription) ? rawSubscription : {};
    const serverSubscriptionId = readString(readAlias(serverSubscription, "subscriptionId", "subscription_id"));

    if (!accepted) {
      const error = errorFromFrame(payload);
      reportError(error);
      if (messageType === "reconnect") {
        subscriptionId = undefined;
        send(buildSubscribeMessage({ ...subscription, afterSequence: lastSequence, sourceCursors }));
      }
      return;
    }

    if ((messageType === "subscribe" || messageType === "reconnect") && serverSubscriptionId) {
      subscriptionId = serverSubscriptionId;
    }
    if (messageType === "unsubscribe") subscriptionId = undefined;

    const replayEnvelope = readAlias(serverSubscription, "replayEnvelope", "replay_envelope");
    if (isRecord(replayEnvelope)) {
      acceptEnvelope(projectRuntimeEventEnvelope(replayEnvelope, scope), "websocket", generation);
    }
  };

  const handleFrame = (frame: RuntimeEventSocketFrame, generation: number) => {
    if (closed || generation !== connectionGeneration) return;
    if (frame.frameType === "control_response") {
      handleControlResponse(frame.payload, generation);
      return;
    }
    if (frame.frameType === "event_envelope") {
      acceptEnvelope(projectRuntimeEventEnvelope(frame.payload, scope), "websocket", generation);
      return;
    }
    if (frame.frameType === "error") {
      reportError(errorFromFrame(frame.payload));
    }
  };

  const connect = () => {
    if (closed) return;
    const generation = ++connectionGeneration;
    emitStatus(reconnectAttempt ? "reconnecting" : "connecting");
    void (options.accessTokenProvider ? options.accessTokenProvider() : Promise.resolve(options.accessToken ?? null))
      .then((accessToken) => {
        if (closed || generation !== connectionGeneration) return;
        try {
          const nextConnection = websocketFactory(
            buildAgentRuntimeEventWebSocketUrl(options.websocketUrl),
            buildAgentRuntimeEventWebSocketProtocols(accessToken),
          );
          connection = nextConnection;
          nextConnection.onopen = () => {
            if (closed || generation !== connectionGeneration) return;
            clearRetry();
            emitStatus("open");
            startHeartbeat(generation);
            const sent = subscriptionId
              ? send(buildReconnectMessage(subscriptionId, lastSequence, sourceCursors))
              : send(buildSubscribeMessage({ ...subscription, afterSequence: lastSequence, sourceCursors }));
            if (!sent) handleDisconnect("send_subscribe_failed", generation);
          };
          nextConnection.onmessage = (event) => {
            void messageData(event.data).then((value) => {
              if (closed || generation !== connectionGeneration) return;
              const frame = parseFrame(value);
              if (frame) handleFrame(frame, generation);
            });
          };
          nextConnection.onerror = (event) => {
            if (closed || generation !== connectionGeneration) return;
            reportError(event);
          };
          nextConnection.onclose = () => {
            handleDisconnect("socket_closed", generation);
          };
        } catch (error) {
          if (closed || generation !== connectionGeneration) return;
          reportError(error);
          handleDisconnect("socket_unavailable", generation);
        }
      })
      .catch((error) => {
        if (closed || generation !== connectionGeneration) return;
        reportError(error);
        handleDisconnect("socket_auth_unavailable", generation);
      });
  };

  const close = (reason = "client_unmount") => {
    if (closed) return;
    closed = true;
    clearRetry();
    clearHeartbeat();
    connectionGeneration += 1;
    const currentConnection = connection;
    if (currentConnection?.readyState === SOCKET_OPEN && subscriptionId) {
      try {
        currentConnection.send(JSON.stringify(buildUnsubscribeMessage(subscriptionId, reason)));
      } catch (error) {
        reportError(error);
      }
    }
    subscriptionId = undefined;
    connection = undefined;
    try {
      currentConnection?.close(1000, reason);
    } catch (error) {
      reportError(error);
    }
    emitStatus("closed");
  };

  emitStatus("idle");
  connect();

  return {
    close,
    getState: () => ({
      status,
      subscriptionId,
      lastSequence,
      sourceCursors: { ...sourceCursors },
    }),
  };
}
