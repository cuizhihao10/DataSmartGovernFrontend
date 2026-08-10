import type {
  AgentPostConfirmContinuation,
  JsonObject,
  PostBridgeVerificationSummary,
  SpecialistVerificationExecutionSummary,
} from "@/types/domain";

/**
 * Post-confirmation verification is deliberately limited to these two roles.
 *
 * DATA_SYNC/RECOVERY may produce a ToolPlan before confirmation, but once the
 * Java control plane has created or submitted a real task, the only follow-up
 * Specialist facts that belong in this verification lane are deterministic
 * precheck and monitoring observations.  Keeping the allowlist in the browser
 * is a defense-in-depth boundary for rolling backend deployments: an unrelated
 * role cannot appear as an authoritative post-submit verification result.
 */
const POST_CONFIRMATION_VERIFICATION_ROLES = new Set([
  "PRECHECK_AGENT",
  "MONITOR_AGENT",
]);

/**
 * Decide whether a Specialist role is allowed to appear after the task has
 * crossed the durable confirmation boundary.
 *
 * The same persisted snapshot feeds the live panel, historical playback, and
 * the collapsed action timeline.  Exporting this small predicate gives all
 * three presentation paths one allowlist instead of letting each path infer
 * post-confirmation eligibility from a status string.  Unknown or malformed
 * values deliberately return false: a missing role is never evidence that a
 * Recovery or planning action belongs to the PRECHECK/MONITOR verification
 * lane.
 */
export function isPostConfirmVerificationRole(role: unknown): boolean {
  return typeof role === "string"
    && POST_CONFIRMATION_VERIFICATION_ROLES.has(role.trim().toUpperCase());
}

/** The compact, already-low-sensitive result fields required by the UI panel. */
const PUBLIC_VERIFICATION_RESULT_FIELDS = new Set([
  "agentId",
  "agent_id",
  "agentRole",
  "agent_role",
  "role",
  "turnId",
  "turn_id",
  "status",
  "state",
  "publicSummary",
  "public_summary",
  "summary",
  "message",
  "structuredOutput",
  "structured_output",
  "output",
  "evidenceReferences",
  "evidence_references",
  "evidence",
  "toolActivities",
  "tool_activities",
  "tools",
  "modelInvocationSummary",
  "model_invocation_summary",
  "model",
  "requiredInputFields",
  "required_input_fields",
  "missingFields",
  "missing_fields",
  "errorCode",
  "error_code",
  "durationMs",
  "duration_ms",
]);

/**
 * 确认执行成功后可交给协作时间线渲染的低敏专业复核快照。
 *
 * 该类型刻意继承普通 JSON 对象合同，以便复用既有的
 * `specialistExecutionToAgentActions(...)` 投影器；但公开字段只包含后端已
 * 定义为低敏的专业批次，以及用户可用于跳转任务详情的可信资源编号。
 */
export type PostConfirmSpecialistSnapshot = Readonly<Record<string, unknown>> & {
  specialistVerificationExecution?: SpecialistVerificationExecutionSummary;
  postBridgeVerification?: PostConfirmPublicVerificationSummary;
};

/**
 * 后置复核桥接摘要的浏览器公开合同。
 *
 * Java 控制面还会保存资源指纹、执行边界和策略标识等诊断字段，它们对用户
 * 协作没有操作价值，且不应成为页面侧信道。因此这里明确采用白名单，而不是
 * 将完整 `PostBridgeVerificationSummary` 透传到 React 组件。
 */
export interface PostConfirmPublicVerificationSummary {
  status?: string;
  resourceChanged?: boolean;
  taskId?: number;
  executionId?: number;
  executedRoles?: string[];
  batchStatus?: string;
}

/**
 * 将后端状态码收敛为短、稳定的公开文本。
 *
 * 状态码用于展示复核是否完成或失败，不应该承载异常正文、SQL、日志片段等
 * 自由文本。因此只接受由字母、数字、下划线和连字符构成的有限长度代码；
 * 其他值一律不进入用户协作流。
 */
function publicStatus(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z][A-Z0-9_-]{0,79}$/.test(normalized) ? normalized : undefined;
}

/**
 * 校验来自 Java 控制面的可信资源编号。
 *
 * 任务和执行编号只允许为正安全整数。前端绝不从模型摘要、自然语言或资源
 * 指纹中推导编号，这样“查看任务详情”始终指向已由控制面确认的真实对象。
 */
function publicResourceId(value: unknown): number | undefined {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d+$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * 过滤并去重实际参与复核的专业 Agent 角色。
 *
 * 角色编码是可审计的业务身份，不是模型隐藏推理。限制格式与数量既能避免
 * 异常响应把大段文本塞进标签，也保证用户只看到真实、可读的执行角色。
 */
function publicRoles(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const roles = [...new Set(value.flatMap((item) => {
    if (typeof item !== "string") return [];
    const normalized = item.trim().toUpperCase();
    return isPostConfirmVerificationRole(normalized) ? [normalized] : [];
  }))].slice(0, 8);
  return roles.length ? roles : undefined;
}

/**
 * Resolve a Specialist role from either contract naming convention.
 *
 * The continuation is written by more than one runtime during a rolling
 * deployment.  Normalizing the role before filtering avoids a false negative
 * when Java emits `agentRole` while Python emits `agent_role`, without trusting
 * an arbitrary result shape or letting an unrecognized role reach the UI.
 */
function verificationResultRole(result: JsonObject): string | undefined {
  const candidate = result.agentRole ?? result.agent_role ?? result.role;
  if (typeof candidate !== "string") return undefined;
  const normalized = candidate.trim().toUpperCase();
  return isPostConfirmVerificationRole(normalized) ? normalized : undefined;
}

/**
 * Keep only public Specialist result fields after a role has passed the
 * post-confirmation allowlist.  The Agent panel still performs its existing
 * sensitive-field filtering for nested display data; this outer projection
 * prevents future transport-only fields such as raw traces, request context,
 * or internal bridge metadata from becoming visible merely because they were
 * added to a backend response.
 */
function publicVerificationResult(result: JsonObject): JsonObject | undefined {
  if (!verificationResultRole(result)) return undefined;
  const projected: JsonObject = {};
  for (const [key, value] of Object.entries(result)) {
    if (PUBLIC_VERIFICATION_RESULT_FIELDS.has(key)) projected[key] = value;
  }
  return projected;
}

/**
 * Convert a verification batch into the browser-safe post-confirmation view.
 *
 * When the backend returns explicit per-role results, counts are rebuilt from
 * the filtered list so an unexpected third role cannot inflate the visible
 * batch.  If a legacy response has no result list at all, its aggregate
 * counters are preserved because there is no role-bearing fact to filter.
 * A non-empty result list containing no PRECHECK/MONITOR result is rejected
 * completely instead of rendering an empty but apparently successful review.
 */
function publicVerificationExecution(
  verification: SpecialistVerificationExecutionSummary | undefined,
): SpecialistVerificationExecutionSummary | undefined {
  if (!verification) return undefined;
  const rawResults = Array.isArray(verification.results) ? verification.results : undefined;
  const results = rawResults?.flatMap((result) => {
    const projected = publicVerificationResult(result);
    return projected ? [projected] : [];
  });
  if (rawResults && rawResults.length > 0 && !results?.length) return undefined;

  const skippedRoles = verification.skippedRoles
    ? Object.fromEntries(Object.entries(verification.skippedRoles).flatMap(([role, reason]) => {
      const normalized = role.trim().toUpperCase();
      return POST_CONFIRMATION_VERIFICATION_ROLES.has(normalized) ? [[normalized, reason]] : [];
    }))
    : undefined;
  const executionWaves = verification.executionWaves
    ?.map((wave) => wave.filter((role) => isPostConfirmVerificationRole(role)))
    .filter((wave) => wave.length > 0);

  return {
    ...(publicStatus(verification.status) ? { status: publicStatus(verification.status) } : {}),
    ...(rawResults ? {
      ...(verification.executedCount !== undefined ? { executedCount: results?.length ?? 0 } : {}),
      results: results ?? [],
    } : {
      ...(verification.executedCount !== undefined ? { executedCount: verification.executedCount } : {}),
      ...(verification.completedCount !== undefined ? { completedCount: verification.completedCount } : {}),
      ...(verification.waitingInputCount !== undefined ? { waitingInputCount: verification.waitingInputCount } : {}),
      ...(verification.failedCount !== undefined ? { failedCount: verification.failedCount } : {}),
    }),
    ...(skippedRoles && Object.keys(skippedRoles).length ? { skippedRoles } : {}),
    ...(executionWaves?.length ? { executionWaves } : {}),
  };
}

/**
 * 提取确认执行接口中的专业 Agent 后置复核，并构建供页面安全展示的快照。
 *
 * `specialistVerificationExecution` 已是后端低敏合同，保留它可以让现有
 * 时间线继续显示 PRECHECK_AGENT 和 MONITOR_AGENT 的公开摘要、状态及实际
 * 工具活动。`postBridgeVerification` 则按白名单重新构造，主动丢弃资源指纹、
 * 原始日志、模型上下文和任意未知字段。没有任何可公开内容时返回 `undefined`，
 * 避免把一次普通确认误显示为已完成复核。
 */
export function buildPostConfirmSpecialistSnapshot(
  continuation: Pick<
    AgentPostConfirmContinuation,
    "specialistVerificationExecution" | "postBridgeVerification"
  > | undefined,
): PostConfirmSpecialistSnapshot | undefined {
  const projectedVerification = publicVerificationExecution(
    continuation?.specialistVerificationExecution,
  );
  const verification = hasPublicSpecialistVerificationExecution(projectedVerification)
    ? projectedVerification
    : undefined;
  const bridge = publicPostBridgeVerification(continuation?.postBridgeVerification);
  if (!verification && !bridge) return undefined;
  return {
    ...(verification ? { specialistVerificationExecution: verification } : {}),
    ...(bridge ? { postBridgeVerification: bridge } : {}),
  };
}

/**
 * 判断专业批次是否至少携带了一项可观察事实。
 *
 * `{}` 在 Java/Python 滚动升级或异常降级时可能代表“字段已预留但尚无结果”。如果
 * 将它当作有效复核，页面会显示一个没有角色、状态和动作的空节点，反而误导用户。
 * 这里保留显式的零计数和空数组，因为它们仍是后端已确认的真实批次结果。
 */
function hasPublicSpecialistVerificationExecution(
  verification: SpecialistVerificationExecutionSummary | undefined,
): verification is SpecialistVerificationExecutionSummary {
  if (!verification) return false;
  return verification.status !== undefined
    || verification.executedCount !== undefined
    || verification.completedCount !== undefined
    || verification.waitingInputCount !== undefined
    || verification.failedCount !== undefined
    || verification.results !== undefined
    || verification.skippedRoles !== undefined
    || verification.executionWaves !== undefined
    || verification.executionBoundary !== undefined
    || verification.payloadPolicy !== undefined;
}

/**
 * 从完整桥接摘要中拣选前端协作所需的最低限度事实。
 *
 * 这个步骤与 UI 渲染分离，原因是同一份响应会被当前会话、历史回放和未来的
 * 通知中心复用。把白名单放在适配层可以保证任一调用方都不会意外展示后端
 * 新增的内部字段。
 */
function publicPostBridgeVerification(
  verification: PostBridgeVerificationSummary | undefined,
): PostConfirmPublicVerificationSummary | undefined {
  if (!verification) return undefined;
  const publicSummary: PostConfirmPublicVerificationSummary = {
    status: publicStatus(verification.status),
    resourceChanged: verification.resourceChanged === true
      ? true
      : verification.resourceChanged === false
        ? false
        : undefined,
    taskId: publicResourceId(verification.taskId),
    executionId: publicResourceId(verification.executionId),
    executedRoles: publicRoles(verification.executedRoles),
    batchStatus: publicStatus(verification.batchStatus),
  };
  return Object.values(publicSummary).some((value) => value !== undefined)
    ? publicSummary
    : undefined;
}
