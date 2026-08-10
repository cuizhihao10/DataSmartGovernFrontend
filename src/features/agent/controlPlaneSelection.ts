/**
 * The minimum durable Run reference required by the frontend confirmation API.
 *
 * The full Agent turn contains model and tool metadata as well, but this helper
 * intentionally accepts only the two identifiers needed to select the real
 * lifecycle Run.  Keeping the input narrow makes the ordering rule reusable
 * from live planning and prevents a presentation-only field from influencing
 * which privileged Run receives a user approval.
 */
export interface AgentDurableControlPlaneTurn {
  sessionId?: string;
  runId?: string;
}

/** A trusted Java-control-plane fallback emitted by the ingestion stage. */
export type AgentControlPlaneIngestion = Readonly<Record<string, unknown>> | undefined;

/** The concrete session/run pair that may be queried or confirmed by the UI. */
export interface AgentControlPlaneReference {
  sessionId: string;
  runId: string;
}

/**
 * Read an identifier only when it is a non-blank string.
 *
 * IDs must be complete and non-empty before this page can use them in an audit
 * query or a confirmation request.  Returning `undefined` for a partial or
 * malformed value makes the caller fall back safely instead of constructing a
 * cross-Run request from one stale identifier and one current identifier.
 */
function nonBlankIdentifier(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Build one valid control-plane reference from an unknown ingestion payload.
 *
 * Ingestion DTOs are handled by rolling Java versions, so both camelCase and
 * snake_case aliases are accepted.  A pair is returned only when both values
 * are present; mixed pairs are deliberately rejected because session/run IDs
 * belong to one durable execution boundary.
 */
function ingestionReference(
  ingestion: AgentControlPlaneIngestion,
): AgentControlPlaneReference | undefined {
  const sessionId = nonBlankIdentifier(ingestion?.sessionId ?? ingestion?.session_id);
  const runId = nonBlankIdentifier(ingestion?.runId ?? ingestion?.run_id);
  return sessionId && runId ? { sessionId, runId } : undefined;
}

/**
 * Select the Run that the frontend is allowed to audit and confirm.
 *
 * `controlPlaneIngestion` describes the initial ingress Run and may therefore
 * point at datasource metadata discovery.  A complete task lifecycle creates
 * a later durable Run containing `sync.task.draft.save`, precheck, publish, or
 * run actions.  The most recent turn with a complete session/run pair is the
 * authoritative approval boundary and must win over the ingress snapshot.
 * Only when no durable turn is available may the UI fall back to ingestion.
 */
export function selectLatestAgentControlPlane(
  durableTurns: readonly AgentDurableControlPlaneTurn[] | undefined,
  ingestion: AgentControlPlaneIngestion,
): AgentControlPlaneReference | undefined {
  const durableReference = [...(durableTurns ?? [])]
    .reverse()
    .flatMap((turn) => {
      const sessionId = nonBlankIdentifier(turn.sessionId);
      const runId = nonBlankIdentifier(turn.runId);
      return sessionId && runId ? [{ sessionId, runId }] : [];
    })[0];
  return durableReference ?? ingestionReference(ingestion);
}
