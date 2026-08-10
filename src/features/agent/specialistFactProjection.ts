import type {
  SpecialistAgentExecution,
  SpecialistAgentResult,
} from "@/components/agent/SpecialistAgentExecutionPanel";
import {
  isSpecialistBusinessInputPendingStatus,
  isSpecialistControlPlaneEvidencePendingStatus,
  isSpecialistApprovalPendingStatus,
  isSpecialistFailureStatus,
  isSpecialistInProgressStatus,
  isSpecialistSuccessfulStatus,
} from "@/features/agent/specialistStatus";
import { publicAgentSummary } from "@/features/agent/publicPresentationSafety";
import type { AgentSpecialistTurnFact } from "@/types/domain";

/**
 * Converts persisted, low-sensitive Specialist facts into the same read-only
 * shape used by the live collaboration panel.
 *
 * The durable-fact endpoint intentionally omits model prompts, raw outputs,
 * tool arguments, and database values. This projection preserves that boundary:
 * it only turns facts that the server has already approved for browser display
 * into statuses, summaries, evidence references, and tool activity names.
 * It must never infer a missing result or promote an absent role to success.
 */
export function specialistExecutionFromDurableFacts(
  facts: readonly AgentSpecialistTurnFact[],
): SpecialistAgentExecution | undefined {
  if (!facts.length) return undefined;

  const results = facts
    .slice()
    .sort((left, right) => {
      const leftTime = Date.parse(left.finishedAt ?? left.updatedAt ?? left.createdAt ?? "") || 0;
      const rightTime = Date.parse(right.finishedAt ?? right.updatedAt ?? right.createdAt ?? "") || 0;
      return leftTime - rightTime;
    })
    .map(durableFactToSpecialistResult);
  const completedCount = results.filter((result) => isSpecialistSuccessfulStatus(result.status)).length;
  const failedCount = results.filter((result) => isSpecialistFailureStatus(result.status)).length;
  // Only an explicit business-input state is a missing-parameter wait.  A
  // planned or running durable turn is still progressing and must remain
  // visible as such in the historical panel.
  const waitingInputCount = results.filter((result) => (
    isSpecialistBusinessInputPendingStatus(result.status)
  )).length;

  return {
    status: aggregateFactBatchStatus(results, completedCount, failedCount, waitingInputCount),
    executedCount: results.length,
    completedCount,
    waitingInputCount,
    failedCount,
    results,
    skippedRoles: {},
    // Facts expose durable Specialist turns, not the private LangGraph graph.
    executionWaves: results.map((result) => [result.agentRole]),
  };
}

/**
 * Reduces one server fact to the panel contract without inventing a structured
 * output. A durable record is useful historical evidence, but it is not a
 * complete model response and cannot safely recreate missing mappings,
 * approval payloads, or task locators.
 */
function durableFactToSpecialistResult(fact: AgentSpecialistTurnFact): SpecialistAgentResult {
  const status = fact.status.trim().toUpperCase() || "UNKNOWN";
  return {
    applicationId: fact.applicationId,
    agentId: fact.agentId,
    agentRole: fact.role,
    turnId: fact.turnId,
    status,
    publicSummary: publicAgentSummary(
      fact.lowSensitiveSummary,
      "该 Specialist 已记录持久化事实，但未提供可公开的处理摘要。",
    ),
    structuredOutput: fact.modelName ? { modelName: fact.modelName } : {},
    evidenceReferences: fact.evidenceRefs,
    toolActivities: fact.toolActivitySummaryRefs.map((reference) => ({
      toolName: "受控工具活动",
      status,
      publicSummary: "已记录受控工具活动引用；参数与原始返回值不会在浏览器展示。",
      evidenceReference: reference,
    })),
    modelInvocationSummary: fact.modelName ? { modelName: fact.modelName } : {},
    requiredInputFields: isSpecialistApprovalPendingStatus(status) ? ["需要在原会话中完成审批"] : [],
    durationMs: Math.max(0, fact.durationMillis ?? 0),
  };
}

/**
 * Produces a conservative batch state for historical facts. Failure wins over
 * completion, and an unfinished or approval state stays visible even when
 * other Specialists have completed.
 */
function aggregateFactBatchStatus(
  results: readonly SpecialistAgentResult[],
  completedCount: number,
  failedCount: number,
  waitingInputCount: number,
): string {
  if (failedCount > 0) return "FAILED";
  if (results.some((result) => isSpecialistApprovalPendingStatus(result.status))) return "WAITING_APPROVAL";
  if (results.some((result) => isSpecialistControlPlaneEvidencePendingStatus(result.status))) {
    return "WAITING_FOR_CONTROL_PLANE_EVIDENCE";
  }
  if (waitingInputCount > 0) return "WAITING_FOR_INPUT";
  if (results.some((result) => isSpecialistInProgressStatus(result.status))) return "RUNNING";
  return completedCount === results.length ? "SUCCEEDED" : "UNKNOWN";
}
