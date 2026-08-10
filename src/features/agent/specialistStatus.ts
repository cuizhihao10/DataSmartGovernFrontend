/**
 * Shared, conservative lifecycle classification for Specialist Agent results.
 *
 * Specialist results arrive through live SSE, durable Java facts, and the
 * post-confirmation continuation.  Those producers do not always use exactly
 * the same status vocabulary, so presentation code must not infer success by
 * merely finding the word `SUCCESS` inside an arbitrary value.  In particular,
 * a partial failure is a useful terminal observation, but it is never a
 * successful result and must not unlock a follow-up action.
 */
export type SpecialistLifecycleState =
  | "SUCCEEDED"
  | "PARTIALLY_SUCCEEDED"
  | "PARTIALLY_FAILED"
  | "FAILED"
  | "CANCELLED"
  | "WAITING_APPROVAL"
  | "WAITING_FOR_INPUT"
  | "WAITING_FOR_CONTROL_PLANE_EVIDENCE"
  | "RUNNING"
  | "PENDING"
  | "UNKNOWN";

/** Inputs that are known independently of the backend's coarse turn status. */
export interface SpecialistLifecycleSignals {
  hasFailure?: boolean;
  waitsForApproval?: boolean;
  waitsForInput?: boolean;
}

/**
 * Independent evidence required before a post-bridge `EXECUTED` marker can
 * become a successful Specialist outcome.  The marker means that the
 * verification wave was dispatched; the batch and its actual results are the
 * evidence that it completed successfully.
 */
export interface SpecialistPostBridgeEvidenceSignals {
  status?: unknown;
  batchStatus?: unknown;
  resultStatuses?: readonly unknown[];
  resultCount?: number;
  completedCount?: number;
  failedCount?: number;
  waitingInputCount?: number;
}

/**
 * Low-sensitive status facts needed to derive the one state shown for a whole
 * Specialist batch.
 *
 * A batch spans three independently persisted boundaries: the initial
 * Specialist turn, the DATA_SYNC/RECOVERY handoff to the Java control plane,
 * and the post-confirm PRECHECK/MONITOR verification.  The UI must combine
 * those facts without treating an early planning success as the final outcome
 * after a later controlled step has failed or is still waiting for evidence.
 */
export interface SpecialistBatchStatusSignals {
  primaryStatus: unknown;
  bridgeStatuses?: readonly unknown[];
  verificationStatus?: unknown;
  verificationFailedCount?: number;
  verificationWaitingInputCount?: number;
  postBridgeStatus?: unknown;
  postBridgeEvidence?: SpecialistPostBridgeEvidenceSignals;
}

/**
 * Normalize a status value without making an absent or malformed value look
 * healthy.  Keeping this conversion in one small dependency-free module also
 * lets the regression test exercise the exact production decision table
 * without mounting React or relying on browser-only APIs.
 */
function normalizedStatus(value: unknown): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

/**
 * Return whether a status represents a failure outcome, including partial
 * failure.  `REJECTED` is grouped with failures because a rejected ToolPlan is
 * not eligible for another automatic execution attempt; the user must review
 * the reported issue or create a new approved plan.
 */
export function isSpecialistFailureStatus(value: unknown): boolean {
  const status = normalizedStatus(value);
  return /PARTIALLY[_-]?FAILED|FAILED|ERROR|CANCELLED|CANCELED|REJECTED/.test(status);
}

/**
 * Detect a partial-success state separately from complete success.  A partial
 * success can still be useful for diagnostics, but it must not be rendered as
 * an all-clear or used as the completion condition of the six-Agent batch.
 */
export function isSpecialistPartiallySuccessfulStatus(value: unknown): boolean {
  const status = normalizedStatus(value);
  return /PARTIALLY[_-]?(SUCCEEDED|SUCCESS)|PARTIAL[_-]?(SUCCEEDED|SUCCESS)/.test(status);
}

/**
 * Report only unambiguous complete-success states.  The negative checks are
 * intentionally evaluated first: state names such as `PARTIALLY_FAILED` or
 * `APPROVAL_REJECTED` must never become successful just because another
 * producer appended a generic terminal word.
 */
export function isSpecialistSuccessfulStatus(value: unknown): boolean {
  const status = normalizedStatus(value);
  return Boolean(status)
    && !isSpecialistFailureStatus(status)
    && !isSpecialistPartiallySuccessfulStatus(status)
    && /SUCCEEDED|SUCCESS|COMPLETED|DONE|EXECUTED/.test(status);
}

/**
 * Identify the approval states that still require a human decision.  This is
 * deliberately narrower than `status.includes("APPROVAL")`: statuses such as
 * `APPROVED`, `APPROVAL_REJECTED`, or `APPROVAL_FAILED` describe a completed
 * decision and must never produce an active approval button in historical UI.
 */
export function isSpecialistApprovalPendingStatus(value: unknown): boolean {
  const status = normalizedStatus(value);
  if (!status || isTerminalSpecialistApprovalStatus(status)) return false;
  return /WAITING[_-]?(FOR[_-]?)?APPROVAL|APPROVAL[_-]?REQUIRED|REVIEW[_-]?REQUIRED|PENDING[_-]?APPROVAL|APPROVAL[_-]?PENDING/.test(status);
}

/**
 * Decide whether an approval request has already reached a terminal decision.
 * The function accepts a missing value because older durable facts can omit
 * the nested approval state; an omitted state remains pending only when the
 * caller has an explicit `approvalRequired=true` fact.
 */
export function isTerminalSpecialistApprovalStatus(value: unknown): boolean {
  const status = normalizedStatus(value);
  return Boolean(status) && (
    isSpecialistFailureStatus(status)
    || /APPROVED|EXECUTED|SUCCEEDED|SUCCESS|COMPLETED|DONE/.test(status)
  );
}

/**
 * Return whether a status explicitly says that a human must provide business
 * input.  Control-plane evidence waits are deliberately excluded: the user
 * cannot resolve a missing Java receipt by filling a business form.
 */
export function isSpecialistBusinessInputPendingStatus(value: unknown): boolean {
  const status = normalizedStatus(value);
  return Boolean(status)
    && !isSpecialistFailureStatus(status)
    && !isSpecialistApprovalPendingStatus(status)
    && /WAITING[_-]?(FOR[_-]?)?(INPUT|USER)|WAITING[_-]?INPUT|REQUIRED[_-]?INPUT|NEED[_-]?INPUT|SPECIALIST[_-]?INPUT/.test(status);
}

/**
 * Return whether the browser is waiting for a trusted control-plane fact.
 * These states are operational evidence waits, not missing business
 * parameters, and therefore receive a different status and user instruction.
 */
export function isSpecialistControlPlaneEvidencePendingStatus(value: unknown): boolean {
  const status = normalizedStatus(value);
  return Boolean(status)
    && !isSpecialistFailureStatus(status)
    && (
      status.includes("CONTROL_PLANE")
      || status.includes("JAVA_HANDOFF")
      || status.includes("NO_TRUSTED_TASK_FACT")
      || status.includes("WAITING_FOR_JAVA")
    );
}

/**
 * Return whether a status is still progressing rather than providing a final
 * business outcome.  `EXECUTED` is intentionally not included here because it
 * is a successful terminal marker, even though it starts with the same letters
 * as `EXECUTING`.
 */
export function isSpecialistInProgressStatus(value: unknown): boolean {
  const status = normalizedStatus(value);
  return Boolean(status)
    && !isSpecialistFailureStatus(status)
    && !isSpecialistApprovalPendingStatus(status)
    && !isSpecialistBusinessInputPendingStatus(status)
    && !isSpecialistControlPlaneEvidencePendingStatus(status)
    && /RUNNING|PROCESSING|EXECUTING|STARTED|PENDING|PLANNED|QUEUED|READY|IN_PROGRESS/.test(status);
}

/** Backwards-compatible name for callers that used the old private concept. */
export function isSpecialistInputPendingStatus(value: unknown): boolean {
  return isSpecialistBusinessInputPendingStatus(value);
}

function finiteCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function successfulBatchStatus(value: unknown): boolean {
  const status = normalizedStatus(value);
  return status === "COMPLETED"
    || status === "SUCCEEDED"
    || status === "SUCCESS"
    || status === "DONE";
}

function resultStatuses(value: readonly unknown[] | undefined): string[] {
  return (value ?? []).map(normalizedStatus).filter(Boolean);
}

/**
 * Require both lifecycle and result evidence for a post-bridge success.
 * `status=EXECUTED` only says that the wave was invoked; it is not proof that
 * PRECHECK/MONITOR returned successful results.
 */
export function isSpecialistPostBridgeEvidenceSuccessful(
  evidence: SpecialistPostBridgeEvidenceSignals,
): boolean {
  const status = normalizedStatus(evidence.status);
  if (!isSpecialistSuccessfulStatus(status) || !successfulBatchStatus(evidence.batchStatus)) {
    return false;
  }

  const statuses = resultStatuses(evidence.resultStatuses);
  if (statuses.length > 0) {
    return statuses.every(isSpecialistSuccessfulStatus);
  }
  if (evidence.resultStatuses) return false;

  const resultCount = finiteCount(evidence.resultCount);
  const completedCount = finiteCount(evidence.completedCount);
  const failedCount = finiteCount(evidence.failedCount) ?? 0;
  const waitingInputCount = finiteCount(evidence.waitingInputCount) ?? 0;
  const inferredResultCount = resultCount ?? (
    completedCount !== undefined || evidence.failedCount !== undefined || evidence.waitingInputCount !== undefined
      ? (completedCount ?? 0) + failedCount + waitingInputCount
      : undefined
  );
  return inferredResultCount !== undefined
    && inferredResultCount > 0
    && completedCount === inferredResultCount
    && failedCount === 0
    && waitingInputCount === 0;
}

/**
 * Derive the effective public state of a complete Specialist execution.
 *
 * A later durable boundary outranks a generic primary success.  For example,
 * the planning Specialist can complete successfully while the Java handoff is
 * awaiting approval, or while the post-confirmation verification reports a
 * failure.  Returning a conservative waiting/failure state in those cases
 * keeps the top-level badge aligned with the detailed cards and prevents a
 * user from assuming that a task is executable before the trusted control
 * plane has supplied the required evidence.
 */
export function aggregateSpecialistExecutionStatus(
  signals: SpecialistBatchStatusSignals,
): string {
  const bridgeStatuses = (signals.bridgeStatuses ?? []).map(normalizedStatus);
  if (bridgeStatuses.some(isSpecialistFailureStatus)) return "FAILED";
  if (bridgeStatuses.some(isSpecialistApprovalPendingStatus)) return "WAITING_FOR_APPROVAL";
  if (bridgeStatuses.some(isSpecialistControlPlaneEvidencePendingStatus)) {
    return "WAITING_FOR_CONTROL_PLANE_EVIDENCE";
  }
  if (bridgeStatuses.some(isSpecialistBusinessInputPendingStatus)) return "WAITING_FOR_INPUT";
  if (bridgeStatuses.some(isSpecialistInProgressStatus)) return "RUNNING";

  const postBridgeEvidence: SpecialistPostBridgeEvidenceSignals | undefined = signals.postBridgeEvidence
    ? {
        ...(signals.postBridgeStatus !== undefined ? { status: signals.postBridgeStatus } : {}),
        ...signals.postBridgeEvidence,
      }
    : signals.postBridgeStatus !== undefined
      ? { status: signals.postBridgeStatus }
      : undefined;
  const postBridgeStatus = normalizedStatus(postBridgeEvidence?.status);
  const postBridgeBatchStatus = normalizedStatus(postBridgeEvidence?.batchStatus);
  const postBridgeResultStatuses = resultStatuses(postBridgeEvidence?.resultStatuses);
  if (isSpecialistFailureStatus(postBridgeStatus)
    || isSpecialistFailureStatus(postBridgeBatchStatus)
    || postBridgeResultStatuses.some(isSpecialistFailureStatus)
    || (postBridgeEvidence?.failedCount ?? 0) > 0) {
    return "FAILED";
  }
  if (isSpecialistApprovalPendingStatus(postBridgeStatus)
    || isSpecialistApprovalPendingStatus(postBridgeBatchStatus)
    || postBridgeResultStatuses.some(isSpecialistApprovalPendingStatus)) {
    return "WAITING_FOR_APPROVAL";
  }
  if (isSpecialistControlPlaneEvidencePendingStatus(postBridgeStatus)
    || isSpecialistControlPlaneEvidencePendingStatus(postBridgeBatchStatus)) {
    return "WAITING_FOR_CONTROL_PLANE_EVIDENCE";
  }
  if (isSpecialistBusinessInputPendingStatus(postBridgeStatus)
    || isSpecialistBusinessInputPendingStatus(postBridgeBatchStatus)
    || postBridgeResultStatuses.some(isSpecialistBusinessInputPendingStatus)) return "WAITING_FOR_INPUT";
  if (isSpecialistInProgressStatus(postBridgeStatus)
    || isSpecialistInProgressStatus(postBridgeBatchStatus)
    || postBridgeResultStatuses.some(isSpecialistInProgressStatus)) return "RUNNING";
  if (postBridgeEvidence && isSpecialistSuccessfulStatus(postBridgeStatus)
    && !isSpecialistPostBridgeEvidenceSuccessful(postBridgeEvidence)) {
    return "WAITING_FOR_CONTROL_PLANE_EVIDENCE";
  }

  if ((signals.verificationFailedCount ?? 0) > 0 || isSpecialistFailureStatus(signals.verificationStatus)) {
    return "FAILED";
  }
  if ((signals.verificationWaitingInputCount ?? 0) > 0) return "RUNNING";
  if (isSpecialistApprovalPendingStatus(signals.verificationStatus)) return "WAITING_FOR_APPROVAL";
  if (isSpecialistControlPlaneEvidencePendingStatus(signals.verificationStatus)) {
    return "WAITING_FOR_CONTROL_PLANE_EVIDENCE";
  }
  if (isSpecialistBusinessInputPendingStatus(signals.verificationStatus)) return "WAITING_FOR_INPUT";
  if (isSpecialistInProgressStatus(signals.verificationStatus)) return "RUNNING";

  return normalizedStatus(signals.primaryStatus) || "UNKNOWN";
}

/**
 * Map a raw specialist state and independent governance facts to the compact
 * states used by the collaboration timeline.  Explicit error, approval, and
 * missing-input signals outrank a generic completed turn because a planning
 * turn may complete while its proposed repair still waits for user approval.
 */
export function classifySpecialistLifecycleState(
  value: unknown,
  signals: SpecialistLifecycleSignals = {},
): SpecialistLifecycleState | string {
  const status = normalizedStatus(value);
  if (signals.hasFailure || isSpecialistFailureStatus(status)) {
    if (status.includes("PARTIAL")) return "PARTIALLY_FAILED";
    return status.includes("CANCEL") ? "CANCELLED" : "FAILED";
  }
  if (signals.waitsForApproval || isSpecialistApprovalPendingStatus(status)) return "WAITING_APPROVAL";
  if (signals.waitsForInput || isSpecialistInputPendingStatus(status)) {
    return "WAITING_FOR_INPUT";
  }
  if (isSpecialistPartiallySuccessfulStatus(status)) return "PARTIALLY_SUCCEEDED";
  if (isSpecialistSuccessfulStatus(status)) return "SUCCEEDED";
  if (/RUNNING|PROCESSING|EXECUTING|STARTED/.test(status)) return "RUNNING";
  if (/PENDING|PLANNED|QUEUED|READY/.test(status)) return "PENDING";
  return status || "UNKNOWN";
}
