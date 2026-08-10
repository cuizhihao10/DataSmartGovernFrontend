import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/**
 * Load the production TypeScript helper without adding a second test framework.
 *
 * This repository currently has no Jest/Vitest setup.  `transpileModule` lets
 * this focused regression test execute the exact source module with the
 * already-installed TypeScript compiler, while Node's native assertion library
 * keeps the test dependency-free and suitable for local or CI execution.
 */
async function loadControlPlaneSelector() {
  const scriptDirectory = fileURLToPath(new URL(".", import.meta.url));
  const sourceUrl = new URL("../src/features/agent/controlPlaneSelection.ts", import.meta.url);
  const source = await readFile(sourceUrl, "utf8");
  const emitted = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
    },
    fileName: `${scriptDirectory}controlPlaneSelection.ts`,
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(emitted).toString("base64")}`;
  return import(moduleUrl);
}

/**
 * 加载确认执行后专业复核的生产适配器，而不为这一组回归断言引入第二套测试框架。
 *
 * 适配器本身没有浏览器或 React 依赖，使用 TypeScript 的单文件转译即可执行真实
 * 源码。这样测试既能验证接口字段白名单，也能防止后续重构时将资源指纹、原始日志
 * 或未知桥接字段重新带回用户侧协作时间线。
 */
async function loadPostConfirmSpecialistProjection() {
  const scriptDirectory = fileURLToPath(new URL(".", import.meta.url));
  const sourceUrl = new URL("../src/features/agent/postConfirmSpecialistProjection.ts", import.meta.url);
  const source = await readFile(sourceUrl, "utf8");
  const emitted = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
    },
    fileName: `${scriptDirectory}postConfirmSpecialistProjection.ts`,
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(emitted).toString("base64")}`;
  return import(moduleUrl);
}

/**
 * Load the shared Specialist status classifier as a plain production module.
 *
 * Keeping the safety assertions independent from React makes these checks fast
 * enough for every local quality gate.  More importantly, the test exercises
 * the same classifier used by both the live collaboration timeline and the
 * durable historical-result panel instead of duplicating status regexes here.
 */
async function loadSpecialistStatus() {
  const scriptDirectory = fileURLToPath(new URL(".", import.meta.url));
  const sourceUrl = new URL("../src/features/agent/specialistStatus.ts", import.meta.url);
  const source = await readFile(sourceUrl, "utf8");
  const emitted = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
    },
    fileName: `${scriptDirectory}specialistStatus.ts`,
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(emitted).toString("base64")}`;
  return import(moduleUrl);
}

/**
 * Load the durable-fact projector with its two dependency-free presentation
 * modules linked through data URLs.  This keeps the regression on the exact
 * production projection instead of reimplementing its status counting here.
 */
async function loadSpecialistFactProjection() {
  const scriptDirectory = fileURLToPath(new URL(".", import.meta.url));
  const compile = async (relativePath, fileName) => {
    const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
    const emitted = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
      },
      fileName: `${scriptDirectory}${fileName}`,
    }).outputText;
    return `data:text/javascript;base64,${Buffer.from(emitted).toString("base64")}`;
  };
  const statusUrl = await compile("../src/features/agent/specialistStatus.ts", "specialistStatus.ts");
  const safetyUrl = await compile("../src/features/agent/publicPresentationSafety.ts", "publicPresentationSafety.ts");
  const source = await readFile(
    new URL("../src/features/agent/specialistFactProjection.ts", import.meta.url),
    "utf8",
  );
  const emitted = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
    },
    fileName: `${scriptDirectory}specialistFactProjection.ts`,
  }).outputText
    .replaceAll('from "@/features/agent/specialistStatus"', `from ${JSON.stringify(statusUrl)}`)
    .replaceAll('from "@/features/agent/publicPresentationSafety"', `from ${JSON.stringify(safetyUrl)}`);
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(emitted).toString("base64")}`;
  return import(moduleUrl);
}

/**
 * Load the shared browser-side presentation guard without mounting React.
 *
 * Sensitive data must be rejected before a component reaches JSX, so this
 * lightweight test exercises the same recursive projector used by the live
 * SSE timeline, durable-history replay, and Specialist result panel.  It
 * specifically prevents a later adapter change from turning one of those
 * presentation paths into a bypass for SQL, connection details, prompts, raw
 * model output, or tool arguments.
 */
async function loadPublicPresentationSafety() {
  const scriptDirectory = fileURLToPath(new URL(".", import.meta.url));
  const sourceUrl = new URL("../src/features/agent/publicPresentationSafety.ts", import.meta.url);
  const source = await readFile(sourceUrl, "utf8");
  const emitted = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
    },
    fileName: `${scriptDirectory}publicPresentationSafety.ts`,
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(emitted).toString("base64")}`;
  return import(moduleUrl);
}

/**
 * Run a small named assertion and leave a useful failure boundary in CI logs.
 *
 * Each case represents a control-plane fact pattern observed by the Agent UI;
 * naming the scenarios makes a failure explain which approval-boundary rule
 * regressed rather than only reporting a generic deep-equality mismatch.
 */
async function verifyScenario(name, callback) {
  try {
    await callback();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

const { selectLatestAgentControlPlane } = await loadControlPlaneSelector();
const {
  buildPostConfirmSpecialistSnapshot,
  isPostConfirmVerificationRole,
} = await loadPostConfirmSpecialistProjection();
const {
  aggregateSpecialistExecutionStatus,
  classifySpecialistLifecycleState,
  isSpecialistApprovalPendingStatus,
  isSpecialistBusinessInputPendingStatus,
  isSpecialistControlPlaneEvidencePendingStatus,
  isSpecialistInProgressStatus,
  isSpecialistPostBridgeEvidenceSuccessful,
  isSpecialistSuccessfulStatus,
  isTerminalSpecialistApprovalStatus,
} = await loadSpecialistStatus();
const { specialistExecutionFromDurableFacts } = await loadSpecialistFactProjection();
const {
  AGENT_PRESENTATION_REDACTION,
  projectAgentDiagnosticValue,
  projectAgentSseAttributes,
  publicAgentSummary,
  sanitizeAgentPresentationValue,
} = await loadPublicPresentationSafety();

await verifyScenario("prefers the latest lifecycle durable turn over metadata ingestion", () => {
  const reference = selectLatestAgentControlPlane([
    { sessionId: "metadata-session", runId: "metadata-run" },
    { sessionId: "lifecycle-session", runId: "lifecycle-run" },
  ], {
    sessionId: "metadata-session",
    runId: "metadata-run",
  });
  assert.deepEqual(reference, {
    sessionId: "lifecycle-session",
    runId: "lifecycle-run",
  });
});

await verifyScenario("falls back to ingestion only when no durable pair exists", () => {
  const reference = selectLatestAgentControlPlane([], {
    session_id: "ingestion-session",
    run_id: "ingestion-run",
  });
  assert.deepEqual(reference, {
    sessionId: "ingestion-session",
    runId: "ingestion-run",
  });
});

await verifyScenario("skips a partial newest turn and keeps the latest complete durable pair", () => {
  const reference = selectLatestAgentControlPlane([
    { sessionId: "complete-session", runId: "complete-run" },
    { sessionId: "partial-session", runId: "" },
  ], {
    sessionId: "metadata-session",
    runId: "metadata-run",
  });
  assert.deepEqual(reference, {
    sessionId: "complete-session",
    runId: "complete-run",
  });
});

await verifyScenario("does not manufacture a reference from incomplete facts", () => {
  const reference = selectLatestAgentControlPlane([
    { sessionId: "durable-session" },
    { runId: "durable-run" },
  ], {
    sessionId: "ingestion-session",
  });
  assert.equal(reference, undefined);
});

await verifyScenario("never promotes partial Specialist outcomes to a complete success", () => {
  assert.equal(classifySpecialistLifecycleState("PARTIALLY_FAILED"), "PARTIALLY_FAILED");
  assert.equal(isSpecialistSuccessfulStatus("PARTIALLY_FAILED"), false);
  assert.equal(classifySpecialistLifecycleState("PARTIALLY_SUCCEEDED"), "PARTIALLY_SUCCEEDED");
  assert.equal(isSpecialistSuccessfulStatus("PARTIALLY_SUCCEEDED"), false);
  assert.equal(classifySpecialistLifecycleState("SUCCEEDED"), "SUCCEEDED");
  assert.equal(isSpecialistSuccessfulStatus("SUCCEEDED"), true);
});

await verifyScenario("does not project PLANNED or RUNNING durable facts as business-input waits", () => {
  const baseFact = {
    userId: "user-1",
    tenantId: 1,
    applicationId: 42,
    projectId: 2,
    sessionId: "session-1",
    runId: "run-1",
    turnId: "turn-1",
    idempotencyKey: "fact-1",
    agentId: "agent-1",
    role: "DATA_SYNC_AGENT",
    status: "PLANNED",
    lowSensitiveSummary: "已生成同步规划。",
    toolActivitySummaryRefs: [],
    evidenceRefs: [],
  };
  const planned = specialistExecutionFromDurableFacts([baseFact]);
  const running = specialistExecutionFromDurableFacts([{ ...baseFact, status: "RUNNING", turnId: "turn-2" }]);
  assert.equal(planned?.status, "RUNNING");
  assert.equal(planned?.waitingInputCount, 0);
  assert.equal(running?.status, "RUNNING");
  assert.equal(running?.waitingInputCount, 0);
  assert.equal(planned?.results[0].applicationId, 42);
});

await verifyScenario("keeps control-plane evidence waits separate from business input waits", () => {
  assert.equal(isSpecialistControlPlaneEvidencePendingStatus("WAITING_FOR_CONTROL_PLANE_EVIDENCE"), true);
  assert.equal(isSpecialistControlPlaneEvidencePendingStatus("WAITING_FOR_JAVA_HANDOFF"), true);
  assert.equal(isSpecialistBusinessInputPendingStatus("WAITING_FOR_CONTROL_PLANE_EVIDENCE"), false);
  assert.equal(isSpecialistBusinessInputPendingStatus("WAITING_FOR_SPECIALIST_INPUT"), true);
  assert.equal(isSpecialistControlPlaneEvidencePendingStatus("WAITING_FOR_SPECIALIST_INPUT"), false);
  assert.equal(isSpecialistInProgressStatus("PLANNED"), true);
  assert.equal(isSpecialistInProgressStatus("RUNNING"), true);
});

await verifyScenario("keeps the effective batch state aligned with post-confirmation evidence", () => {
  assert.equal(aggregateSpecialistExecutionStatus({
    primaryStatus: "SUCCEEDED",
    postBridgeStatus: "FAILED",
  }), "FAILED");
  assert.equal(aggregateSpecialistExecutionStatus({
    primaryStatus: "SUCCEEDED",
    bridgeStatuses: ["PENDING"],
  }), "RUNNING");
  assert.equal(aggregateSpecialistExecutionStatus({
    primaryStatus: "SUCCEEDED",
    postBridgeStatus: "NO_TRUSTED_TASK_FACT",
  }), "WAITING_FOR_CONTROL_PLANE_EVIDENCE");
  assert.equal(aggregateSpecialistExecutionStatus({
    primaryStatus: "SUCCEEDED",
    postBridgeStatus: "EXECUTED",
  }), "WAITING_FOR_CONTROL_PLANE_EVIDENCE");
  assert.equal(aggregateSpecialistExecutionStatus({
    primaryStatus: "SUCCEEDED",
    postBridgeEvidence: {
      status: "EXECUTED",
      batchStatus: "COMPLETED",
      resultStatuses: ["SUCCEEDED", "SUCCEEDED"],
      resultCount: 2,
      completedCount: 2,
      failedCount: 0,
      waitingInputCount: 0,
    },
  }), "SUCCEEDED");
  assert.equal(isSpecialistPostBridgeEvidenceSuccessful({
    status: "EXECUTED",
    batchStatus: "COMPLETED",
    resultStatuses: ["SUCCEEDED"],
  }), true);
  assert.equal(isSpecialistPostBridgeEvidenceSuccessful({
    status: "EXECUTED",
    batchStatus: "COMPLETED",
  }), false);
  assert.equal(aggregateSpecialistExecutionStatus({
    primaryStatus: "SUCCEEDED",
    postBridgeEvidence: {
      status: "EXECUTED",
      batchStatus: "PARTIALLY_FAILED",
      resultStatuses: ["SUCCEEDED", "FAILED"],
    },
  }), "FAILED");
});

await verifyScenario("keeps bridge wait, failure, and no-op verification states distinct in the panel", async () => {
  const panelSource = await readFile(new URL("../src/components/agent/SpecialistAgentExecutionPanel.tsx", import.meta.url), "utf8");
  assert.equal(panelSource.includes('等待 Java 控制面返回真实任务/执行事实'), true);
  assert.equal(panelSource.includes('还缺少可靠的业务信息，补齐后才能生成可执行计划'), true);
  assert.equal(panelSource.includes('label: "等待控制面证据"'), true);
  assert.equal(panelSource.includes('if (isFailedStatus(status)) return "本次桥接没有进入执行链路，请根据下面的问题修正配置后重试。";'), true);
  assert.equal(panelSource.includes('function isSkippedPostBridgeVerification(status: string): boolean'), true);
  assert.equal(panelSource.includes('真实同步资源未发生变化，本轮不重复运行 PRECHECK 和 MONITOR。'), true);
});

await verifyScenario("parses nullable continuation booleans fail-closed", async () => {
  const [domainSource, endpointSource] = await Promise.all([
    readFile(new URL("../src/types/domain.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/api/endpoints.ts", import.meta.url), "utf8"),
  ]);
  assert.match(domainSource, /continued:\s*boolean\s*\|\s*null/);
  assert.match(domainSource, /requiresConfirmation:\s*boolean\s*\|\s*null/);
  assert.match(endpointSource, /normalizeAgentRunConfirmedExecutionResponse/);
  assert.match(endpointSource, /readOptionalBoolean\(/);
  assert.match(endpointSource, /requiresConfirmation:\s*readOptionalBoolean/);
  assert.match(endpointSource, /continued:\s*readOptionalBoolean/);
  assert.match(endpointSource, /=== true/);
});

await verifyScenario("prefers the actual model provenance over a requested model name", async () => {
  const assistantSource = await readFile(new URL("../src/pages/AgentAssistant.tsx", import.meta.url), "utf8");
  assert.equal(assistantSource.includes('const actualModelName = textField(conversation?.intentResolver, "actualModelName")'), true);
  assert.equal(assistantSource.includes('|| textField(conversation?.intentResolver, "selectedModelName")'), true);
  assert.equal(assistantSource.includes('{actualModelName ? <Tag color="blue">{actualModelName}</Tag> : null}'), true);
  assert.equal(assistantSource.includes('requestedModelName !== actualModelName'), true);
});

await verifyScenario("shows an approval action only while a human decision is actually pending", () => {
  assert.equal(isSpecialistApprovalPendingStatus("WAITING_APPROVAL"), true);
  assert.equal(isSpecialistApprovalPendingStatus("APPROVED"), false);
  assert.equal(isSpecialistApprovalPendingStatus("APPROVAL_REJECTED"), false);
  assert.equal(isSpecialistApprovalPendingStatus("APPROVAL_FAILED"), false);
  assert.equal(isTerminalSpecialistApprovalStatus("APPROVAL_REJECTED"), true);
});

await verifyScenario("keeps only low-sensitive post-confirm verification facts for the collaboration timeline", () => {
  const specialistVerificationExecution = {
    status: "SUCCEEDED",
    results: [{
      agentRole: "PRECHECK_AGENT",
      status: "SUCCEEDED",
      publicSummary: "目标表、字段映射和写入条件已完成复核。",
    }, {
      agentRole: "MONITOR_AGENT",
      status: "SUCCEEDED",
      publicSummary: "已开始观察已提交执行的状态。",
    }],
  };
  const snapshot = buildPostConfirmSpecialistSnapshot({
    specialistVerificationExecution,
    postBridgeVerification: {
      status: "SUCCEEDED",
      resourceChanged: true,
      taskId: "77",
      executionId: 1958,
      executedRoles: ["PRECHECK_AGENT", "MONITOR_AGENT", "PRECHECK_AGENT"],
      batchStatus: "COMPLETED",
      resourceFingerprint: "must-not-reach-the-browser",
      previousResourceFingerprint: "must-not-reach-the-browser",
      payloadPolicy: "INTERNAL_ONLY",
    },
  });

  assert.deepEqual(snapshot, {
    specialistVerificationExecution,
    postBridgeVerification: {
      status: "SUCCEEDED",
      resourceChanged: true,
      taskId: 77,
      executionId: 1958,
      executedRoles: ["PRECHECK_AGENT", "MONITOR_AGENT"],
      batchStatus: "COMPLETED",
    },
  });
  assert.equal(JSON.stringify(snapshot).includes("must-not-reach-the-browser"), false);
  assert.equal(JSON.stringify(snapshot).includes("INTERNAL_ONLY"), false);
});

await verifyScenario("does not invent a post-confirm specialist result when the backend returned no public verification", () => {
  assert.equal(buildPostConfirmSpecialistSnapshot({}), undefined);
  assert.equal(buildPostConfirmSpecialistSnapshot({
    specialistVerificationExecution: {},
  }), undefined);
});

await verifyScenario("limits post-confirmation facts to PRECHECK and MONITOR public summaries", () => {
  const snapshot = buildPostConfirmSpecialistSnapshot({
    specialistVerificationExecution: {
      status: "SUCCEEDED",
      executedCount: 3,
      results: [{
        agentRole: "PRECHECK_AGENT",
        publicSummary: "precheck summary",
        transportOnlyTrace: "must-not-reach-the-browser",
      }, {
        agentRole: "MONITOR_AGENT",
        publicSummary: "monitor summary",
      }, {
        agentRole: "RECOVERY_AGENT",
        publicSummary: "recovery internals must-not-reach-the-browser",
      }],
      skippedRoles: {
        PRECHECK_AGENT: "not needed",
        RECOVERY_AGENT: "must-not-reach-the-browser",
      },
      executionWaves: [["PRECHECK_AGENT", "RECOVERY_AGENT"], ["MONITOR_AGENT"]],
      payloadPolicy: "INTERNAL_ONLY",
    },
    postBridgeVerification: {
      status: "SUCCEEDED",
      executedRoles: ["PRECHECK_AGENT", "MONITOR_AGENT", "RECOVERY_AGENT"],
    },
  });

  assert.deepEqual(snapshot?.specialistVerificationExecution, {
    status: "SUCCEEDED",
    executedCount: 2,
    results: [{
      agentRole: "PRECHECK_AGENT",
      publicSummary: "precheck summary",
    }, {
      agentRole: "MONITOR_AGENT",
      publicSummary: "monitor summary",
    }],
    skippedRoles: { PRECHECK_AGENT: "not needed" },
    executionWaves: [["PRECHECK_AGENT"], ["MONITOR_AGENT"]],
  });
  assert.deepEqual(snapshot?.postBridgeVerification?.executedRoles, ["PRECHECK_AGENT", "MONITOR_AGENT"]);
  assert.equal(JSON.stringify(snapshot).includes("must-not-reach-the-browser"), false);
  assert.equal(JSON.stringify(snapshot).includes("INTERNAL_ONLY"), false);
});

await verifyScenario("treats only PRECHECK and MONITOR as post-confirmation Specialist roles", () => {
  assert.equal(isPostConfirmVerificationRole("PRECHECK_AGENT"), true);
  assert.equal(isPostConfirmVerificationRole(" monitor_agent "), true);
  assert.equal(isPostConfirmVerificationRole("RECOVERY_AGENT"), false);
  assert.equal(isPostConfirmVerificationRole("DATA_SYNC_AGENT"), false);
  assert.equal(isPostConfirmVerificationRole(undefined), false);
});

await verifyScenario("renders the post-confirm specialist snapshot through the existing collaboration action projection", async () => {
  const source = await readFile(new URL("../src/pages/AgentAssistant.tsx", import.meta.url), "utf8");
  assert.equal(source.includes("buildPostConfirmSpecialistSnapshot(result.data.continuation)"), true);
  assert.equal(source.includes("postConfirmSpecialistExecution,"), true);
  assert.equal(source.includes("postBridgeVerificationToAgentAction(snapshot, scope)"), true);
});

await verifyScenario("uses the structured-output allowlist while preserving safe mapping facts", () => {
  const projected = sanitizeAgentPresentationValue({
    sourceObjectName: "orders_source",
    targetObjectName: "orders_target",
    fieldMappings: [{ sourceFieldName: "customer_id", targetFieldName: "customer_id" }],
    whereCondition: "status = 'ACTIVE'",
    customSqlText: "SELECT customer_id FROM orders_source",
    jdbcUrl: "jdbc:postgresql://db.example.internal:5432/govern",
    password: "must-not-reach-the-browser",
    prompt: "must-not-reach-the-browser",
    modelRequestObjective: "must-not-reach-the-browser",
    modelInstructionSummary: "must-not-reach-the-browser",
    modelStructuredBaseline: "must-not-reach-the-browser",
    rawOutput: "must-not-reach-the-browser",
    toolArguments: { datasourceId: 51, token: "must-not-reach-the-browser" },
  });
  const text = JSON.stringify(projected);
  assert.equal(text.includes("orders_source"), true);
  assert.equal(text.includes("orders_target"), true);
  assert.equal(text.includes("customer_id"), true);
  assert.equal(text.includes("status = 'ACTIVE'"), false);
  assert.equal(text.includes("SELECT customer_id"), false);
  assert.equal(text.includes("db.example.internal"), false);
  assert.equal(text.includes("must-not-reach-the-browser"), false);
  assert.equal(text.includes(AGENT_PRESENTATION_REDACTION.configuration), true);
  assert.equal(text.includes("jdbcUrl"), false);
  assert.equal(text.includes("password"), false);
  assert.equal(text.includes("prompt"), false);
  assert.equal(text.includes("rawOutput"), false);
});

await verifyScenario("projects live SSE through an explicit low-sensitive allowlist", () => {
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZ2VudCJ9.signature-value";
  const projected = projectAgentSseAttributes({
    status: "WAITING_APPROVAL",
    objectMappings: [{
      sourceObjectName: "orders_source",
      targetObjectName: "orders_target",
      fieldMappings: [{ sourceFieldName: "customer_id", targetFieldName: "customer_id", typeCompatible: true }],
      whereCondition: "status = 'ACTIVE'",
      rawLog: "must-not-reach-the-browser",
      sampleData: [{ email: "must-not-reach-the-browser" }],
    }],
    approvalRequest: {
      required: true,
      status: "WAITING_APPROVAL",
      rawLog: "must-not-reach-the-browser",
    },
    Authorization: `Bearer ${jwt}`,
    stackTrace: "at com.datasmart.Agent.run(Agent.java:42)",
    rawLog: "must-not-reach-the-browser",
    sampleData: [{ customerEmail: "must-not-reach-the-browser" }],
    AWS_SECRET_ACCESS_KEY: "must-not-reach-the-browser",
    unknownSafeLookingField: "must-not-reach-the-browser",
    connectorEndpoint: "customdb+ssl://internal.example:8443/govern",
  });
  const text = JSON.stringify(projected);
  assert.equal(projected.status, "WAITING_APPROVAL");
  assert.equal(projected.approvalRequest?.status, "WAITING_APPROVAL");
  assert.equal(projected.objectMappings?.[0]?.sourceObjectName, "orders_source");
  assert.equal(projected.objectMappings?.[0]?.targetObjectName, "orders_target");
  assert.equal(text.includes(AGENT_PRESENTATION_REDACTION.configuration), true);
  assert.equal(text.includes("must-not-reach-the-browser"), false);
  assert.equal(text.includes(jwt), false);
  assert.equal(text.includes("rawLog"), false);
  assert.equal(text.includes("sampleData"), false);
  assert.equal(text.includes("stackTrace"), false);
  assert.equal(text.includes("AWS_SECRET_ACCESS_KEY"), false);
  assert.equal(text.includes("unknownSafeLookingField"), false);
  assert.equal(text.includes("customdb+ssl://"), false);
});

await verifyScenario("projects diagnostics through the narrower operational allowlist", () => {
  const projected = projectAgentDiagnosticValue({
    serviceName: "agent-runtime",
    healthy: true,
    runningCount: 4,
    modelName: "gpt-5.6-terra",
    message: "The governed runtime is healthy.",
    stackTrace: "Traceback (most recent call last): hidden",
    rawLog: "must-not-reach-the-browser",
    sampleData: [{ row: "must-not-reach-the-browser" }],
    AZURE_CLIENT_SECRET: "must-not-reach-the-browser",
    unknownProviderEnvelope: { accessToken: "must-not-reach-the-browser" },
    connector: "amqp+tls://broker.internal:5671/vhost",
  });
  const text = JSON.stringify(projected);
  assert.deepEqual(projected, {
    serviceName: "agent-runtime",
    healthy: true,
    runningCount: 4,
    modelName: "gpt-5.6-terra",
    message: "The governed runtime is healthy.",
  });
  assert.equal(text.includes("must-not-reach-the-browser"), false);
  assert.equal(text.includes("stackTrace"), false);
  assert.equal(text.includes("rawLog"), false);
  assert.equal(text.includes("sampleData"), false);
  assert.equal(text.includes("AZURE_CLIENT_SECRET"), false);
  assert.equal(text.includes("unknownProviderEnvelope"), false);
  assert.equal(text.includes("amqp+tls://"), false);
});

await verifyScenario("retains the reviewed public facts needed by all six Specialist roles", () => {
  const projected = sanitizeAgentPresentationValue({
    sourceDatasourceId: 11,
    targetDatasourceId: 12,
    resolutions: {
      source: { status: "RESOLVED", selectedDatasourceId: 11, candidateCount: 1, rawLog: "must-not-reach-the-browser" },
      target: { status: "WAITING_FOR_INPUT", candidateDatasourceIds: [12, 13], ambiguous: true },
    },
    objectMappings: [{
      sourceObjectName: "orders_source",
      targetObjectName: "orders_target",
      fieldMappings: [{ sourceField: "customer_id", targetField: "customer_id", typeCompatible: true }],
    }],
    checks: [{ code: "TARGET_TABLE_EXISTS", status: "PASSED", recommendation: "No action required." }],
    answerAvailable: true,
    grounded: true,
    citationCount: 3,
    failure: { failureCode: "DUPLICATE_TASK_NAME", failureReason: "Choose a new task name.", logReferenceCount: 2 },
    recoveryActions: [{ actionType: "TASK_NAME_RENAME", riskLevel: "MEDIUM", requiresApproval: true }],
    approvalRequest: { required: true, status: "WAITING_APPROVAL", reason: "Review the repair proposal." },
    rowsTotal: 100,
    rowsProcessed: 60,
    progress: 60,
    schedule: { enabled: true, intervalSeconds: 60, cronDescription: "0 * * * *", nextRunAt: "2026-08-07T10:00:00Z" },
  });
  const text = JSON.stringify(projected);
  assert.equal(projected.resolutions?.source?.selectedDatasourceId, "11");
  assert.equal(projected.objectMappings?.[0]?.fieldMappings?.[0]?.sourceField, "customer_id");
  assert.equal(projected.checks?.[0]?.code, "TARGET_TABLE_EXISTS");
  assert.equal(projected.answerAvailable, true);
  assert.equal(projected.failure?.failureCode, "DUPLICATE_TASK_NAME");
  assert.equal(projected.recoveryActions?.[0]?.requiresApproval, true);
  assert.equal(projected.approvalRequest?.status, "WAITING_APPROVAL");
  assert.equal(projected.rowsProcessed, 60);
  assert.equal(projected.schedule?.enabled, true);
  assert.equal(text.includes(AGENT_PRESENTATION_REDACTION.configuration), true);
  assert.equal(text.includes("must-not-reach-the-browser"), false);
});

await verifyScenario("does not promote SQL, connection strings, or raw JSON into a public summary", () => {
  assert.equal(
    publicAgentSummary("SELECT * FROM orders_source", "safe fallback"),
    "safe fallback",
  );
  assert.equal(
    publicAgentSummary("jdbc:mysql://db.example.internal:3306/govern", "safe fallback"),
    "safe fallback",
  );
  assert.equal(
    publicAgentSummary(JSON.stringify({ raw: "x".repeat(180) }), "safe fallback"),
    "safe fallback",
  );
  assert.equal(
    publicAgentSummary('{"raw":"short provider payload"}', "safe fallback"),
    "safe fallback",
  );
  assert.equal(
    publicAgentSummary("https://evidence.example/case?access_token=must-not-reach-the-browser", "safe fallback"),
    "safe fallback",
  );
  assert.equal(
    publicAgentSummary("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZ2VudCJ9.signature-value", "safe fallback"),
    "safe fallback",
  );
  assert.equal(
    publicAgentSummary("AWS_SECRET_ACCESS_KEY=must-not-reach-the-browser", "safe fallback"),
    "safe fallback",
  );
  assert.equal(
    publicAgentSummary("customdb+ssl://internal.example:8443/govern", "safe fallback"),
    "safe fallback",
  );
  assert.equal(
    publicAgentSummary("The metadata precheck completed successfully.", "safe fallback"),
    "The metadata precheck completed successfully.",
  );
});

await verifyScenario("keeps Agent process detail free of literal tool arguments and resolved endpoint values", async () => {
  const source = await readFile(new URL("../src/pages/AgentAssistant.tsx", import.meta.url), "utf8");
  assert.equal(source.includes("function visibleAgentEndpoint"), true);
  assert.equal(source.includes("function resolvedAgentEndpoint"), false);
  assert.equal(source.includes("argumentFields: Object.keys(audit.planArguments)"), true);
  assert.equal(source.includes("safeInput: sanitizeAgentActionPayload(audit.planArguments)"), false);
  assert.equal(source.includes("replacementValue"), false);
  assert.equal(source.includes("查看本次修复动作参数"), false);
  assert.equal(source.includes("<Tag color=\"cyan\">WHERE {mapping.whereCondition}</Tag>"), false);
});

await verifyScenario("keeps approval navigation tied to the real durable approval card", async () => {
  const source = await readFile(new URL("../src/pages/AgentAssistant.tsx", import.meta.url), "utf8");
  assert.equal(source.includes("const hasRealApprovalEntry = Boolean("), true);
  assert.equal(source.includes("onApproval: taskWorkflowCompleted || !hasRealApprovalEntry ? undefined"), true);
  assert.equal(source.includes("if (batch.scope === \"verification\" && !isPostConfirmVerificationRole(role)) return;"), true);
  assert.equal(source.includes("objective: details.modelRequestObjective"), false);
  assert.equal(source.includes("instructionSummary: details.modelInstructionSummary"), false);
  assert.equal(source.includes("structuredBaseline: details.modelStructuredBaseline"), false);
});

await verifyScenario("keeps the administrative console read-only for audit roles and closes display bypasses", async () => {
  const source = await readFile(new URL("../src/pages/AgentConsole.tsx", import.meta.url), "utf8");
  assert.equal(source.includes("const canManageAgent = [\"OPERATOR\", \"TENANT_ADMINISTRATOR\", \"PLATFORM_ADMINISTRATOR\"].includes(actorRole);"), true);
  assert.equal(source.includes("requireAgentConsoleManagement(canManageAgent);"), true);
  assert.equal((source.match(/disabled=\{!canManageAgent\}/g) ?? []).length, 3);
  assert.equal(source.includes('jsonBlock(record.planArguments, 220, "toolArguments")'), true);
  assert.equal(source.includes("{ragResult.answer || \"未生成回答\"}"), false);
  assert.equal(source.includes("{item.title || item.source || `引用 ${index + 1}`}"), false);
  assert.equal(source.includes("{event.detail}"), false);
  assert.equal(source.includes("fieldKey=\"modelOutput\""), true);
  assert.equal(source.includes("fieldKey=\"internal\""), true);
});

await verifyScenario("applies the shared presentation guard to both the timeline and Specialist panel", async () => {
  const assistantSource = await readFile(new URL("../src/pages/AgentAssistant.tsx", import.meta.url), "utf8");
  const consoleSource = await readFile(new URL("../src/pages/AgentConsole.tsx", import.meta.url), "utf8");
  const panelSource = await readFile(new URL("../src/components/agent/SpecialistAgentExecutionPanel.tsx", import.meta.url), "utf8");
  assert.equal(assistantSource.includes("projectAgentSseAttributes(event.attributes)"), true);
  assert.equal(consoleSource.includes("projectAgentDiagnosticValue(value ?? {})"), true);
  assert.match(assistantSource, /publicAgentSummary\(\s*event\.message,/);
  assert.equal(panelSource.includes("sanitizeAgentPresentationValue(input, fieldKey, depth)"), true);
  assert.equal(panelSource.includes("publicAgentSummary("), true);
});

await verifyScenario("keeps history pin and archive controls discoverable on touch devices", async () => {
  const styles = await readFile(new URL("../src/styles/global.css", import.meta.url), "utf8");
  const assistantSource = await readFile(new URL("../src/pages/AgentAssistant.tsx", import.meta.url), "utf8");
  assert.equal(styles.includes("@media (hover: none), (pointer: coarse)"), true);
  assert.match(styles, /@media \(hover: none\), \(pointer: coarse\)[\s\S]*?\.agent-session-item-actions\s*\{[\s\S]*?opacity:\s*1;/);
  assert.match(styles, /\.agent-session-item-actions \.ant-btn\s*\{[\s\S]*?min-height:\s*32px;/);
  assert.equal(assistantSource.includes("aria-label={item.pinned ? \"取消置顶会话\" : \"置顶会话\"}"), true);
  assert.equal(assistantSource.includes("aria-label={item.archived ? \"恢复会话\" : \"归档会话\"}"), true);
});
