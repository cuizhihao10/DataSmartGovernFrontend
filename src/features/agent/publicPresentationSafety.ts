/**
 * Browser-side defense in depth for Agent collaboration and diagnostics.
 *
 * Backend low-sensitive DTOs remain the authority. This module protects the
 * browser against rolling deployments and malformed SSE frames by projecting
 * only fields that are explicitly useful to a human operator. Unknown keys
 * are omitted instead of being treated as safe by default.
 */

/** Stable placeholders explain why a value is unavailable without exposing it. */
export const AGENT_PRESENTATION_REDACTION = {
  sensitive: "[Sensitive content hidden]",
  internal: "[Internal model content hidden]",
  configuration: "[Review this value in task configuration]",
  omitted: "[Content omitted]",
} as const;

/**
 * Field-level presentation policies make the allowlist readable and auditable.
 *
 * A policy describes the shape that a value is allowed to have, rather than a
 * list of dangerous names to reject. This is the primary security boundary:
 * new backend fields stay invisible until we intentionally classify them.
 */
type PublicValuePolicy =
  | "boolean"
  | "number"
  | "code"
  | "identifier"
  | "modelName"
  | "publicText"
  | "configuration"
  | "identifierList"
  | "publicTextList"
  | "sse"
  | "diagnostic"
  | "structuredOutput"
  | "taskConfiguration"
  | "objectMappings"
  | "objectMapping"
  | "fieldMappings"
  | "fieldMapping"
  | "datasourceCandidates"
  | "datasourceCandidate"
  | "datasourceResolutions"
  | "datasourceResolution"
  | "checkList"
  | "check"
  | "failureSummary"
  | "monitorSchedule"
  | "recoveryActions"
  | "recoveryAction"
  | "approvalRequest"
  | "toolActivities"
  | "toolActivity"
  | "modelSummary"
  | "evidenceReferences"
  | "bridgeIssues"
  | "bridgeIssue"
  | "recoveryHandoff"
  | "blocked";

type PublicObjectPolicy = Readonly<Record<string, PublicValuePolicy>>;

/** Convert transport aliases into one comparison form before looking them up. */
function normalizedFieldName(key: string): string {
  return key.replace(/[_-]/g, "").trim().toLowerCase();
}

/**
 * Keep model prompts, raw responses, and invocation envelopes out of every
 * public display path.
 *
 * This remains a defense-in-depth denial helper for callers that need to
 * label hidden content. It is not the security model for projection: the
 * object projectors below only retain allowlisted fields in the first place.
 */
export function isHiddenAgentPresentationKey(key: string): boolean {
  const normalized = normalizedFieldName(key);
  return normalized.endsWith("prompt")
    || normalized.includes("systemprompt")
    || normalized.includes("modelinput")
    || normalized.includes("modelmessage")
    || normalized.includes("modelcontext")
    || normalized.includes("modelrequestobjective")
    || normalized.includes("modelinstructionsummary")
    || normalized.includes("modelstructuredbaseline")
    || normalized.includes("modelrequestcontext")
    || normalized.includes("modelrequestpayload")
    || normalized.includes("systeminstruction")
    || normalized.includes("userinputpreview")
    || normalized.includes("statetrace")
    || normalized.includes("chainofthought")
    || normalized.includes("hiddenreasoning")
    || normalized.includes("rawresponse")
    || normalized.includes("rawoutput")
    || normalized.includes("rawtoolresult")
    || normalized.includes("modelresponse")
    || normalized.includes("modelpublicresponse")
    || normalized.includes("modeloutput")
    || normalized.includes("assistantresponse")
    || normalized.includes("toolarguments")
    || normalized.includes("toolinput")
    || normalized.includes("toolpayload")
    || normalized.includes("toolparameters")
    || [
      "reasoning",
      "modelreasoning",
      "reasoningsummary",
      "reasoningtrace",
      "thought",
      "thoughtsummary",
      "thinking",
      "chainofthought",
      "internalreasoning",
      "debug",
      "internal",
      "arguments",
      "payload",
      "parameters",
    ].includes(normalized);
}

/**
 * Identify credential and connection labels for secondary renderers.
 *
 * The strict object allowlist already drops unknown labels such as `rawLog` or
 * `AWS_SECRET_ACCESS_KEY`. This helper additionally protects a renderer that
 * receives one already-known field in isolation.
 */
export function isSensitiveAgentPresentationKey(key: string): boolean {
  const normalized = normalizedFieldName(key);
  return /(password|passwd|secret|token|credential|apikey|authorization|cookie|jwt)/i.test(normalized)
    || /(connection|jdbc|dsn|databaseurl|databaseuri|hostname|host|port|stacktrace|rawlog|sampledata)/i.test(normalized)
    || /(?:aws|azure|gcp|google|aliyun|tencent|cloud).*(?:key|secret|token|credential)/i.test(normalized);
}

/**
 * Task SQL and WHERE literals remain visible only in the dedicated task-review
 * form, never in an Agent stream or a diagnostics JSON block.
 */
export function isTaskConfigurationLiteralKey(key: string): boolean {
  const normalized = normalizedFieldName(key);
  return [
    "sql",
    "sqltext",
    "customsqltext",
    "query",
    "querytext",
    "statement",
    "where",
    "whereclause",
    "wherecondition",
    "filtercondition",
    "transform",
    "transformation",
  ].includes(normalized);
}

/**
 * The public SSE contract contains only operational facts that help explain
 * progress, ownership, approvals, mappings, and safe model metadata.
 *
 * Values not listed here are not displayed, even when a producer gives them a
 * harmless-looking name. This blocks future raw diagnostics by default.
 */
const PUBLIC_SSE_FIELDS: PublicObjectPolicy = {
  status: "code",
  state: "code",
  stage: "code",
  action: "code",
  actioncode: "code",
  eventid: "identifier",
  actionid: "identifier",
  requestid: "identifier",
  runid: "identifier",
  sessionid: "identifier",
  turnid: "identifier",
  specialistidentity: "identifier",
  agentrole: "code",
  agentid: "identifier",
  taskid: "identifier",
  executionid: "identifier",
  datasourceid: "identifier",
  sourcedatasourceid: "identifier",
  targetdatasourceid: "identifier",
  syncmode: "code",
  writestrategy: "code",
  taskstatus: "code",
  health: "code",
  severity: "code",
  risklevel: "code",
  errorcode: "code",
  code: "code",
  title: "publicText",
  message: "publicText",
  summary: "publicText",
  publicsummary: "publicText",
  publiccontent: "publicText",
  durationms: "number",
  elapsedms: "number",
  objectmappingcount: "number",
  fieldmappingcount: "number",
  actioncount: "number",
  highriskactioncount: "number",
  logreferencecount: "number",
  factcount: "number",
  citationcount: "number",
  evidencecount: "number",
  candidatecount: "number",
  progress: "number",
  progresspercent: "number",
  requiredinputcount: "number",
  anomalycount: "number",
  acceptedtoolplancount: "number",
  completedcount: "number",
  failedcount: "number",
  waitinginputcount: "number",
  nextpollafterseconds: "number",
  cachehit: "boolean",
  terminal: "boolean",
  persisted: "boolean",
  published: "boolean",
  executed: "boolean",
  draftonly: "boolean",
  planavailable: "boolean",
  javatoolplanpending: "boolean",
  sourcedatasourceresolved: "boolean",
  targetdatasourceresolved: "boolean",
  answeravailable: "boolean",
  grounded: "boolean",
  requiresapproval: "boolean",
  approvalrequired: "boolean",
  syncenabled: "boolean",
  typecompatible: "boolean",
  objectmappings: "objectMappings",
  fieldmappings: "fieldMappings",
  customsqltext: "configuration",
  sql: "configuration",
  sqltext: "configuration",
  where: "configuration",
  wherecondition: "configuration",
  whereclause: "configuration",
  filtercondition: "configuration",
  requiredinputfields: "identifierList",
  requiredevidence: "identifierList",
  missingfields: "identifierList",
  validationissuecodes: "identifierList",
  modelgovernanceissuecodes: "identifierList",
  requestedreadtools: "identifierList",
  userreviewedbaselineconflictfields: "identifierList",
  anomalycodes: "identifierList",
  datasourcecandidates: "datasourceCandidates",
  datasourceoptions: "datasourceCandidates",
  sourcecandidates: "datasourceCandidates",
  targetcandidates: "datasourceCandidates",
  checks: "checkList",
  precheckitems: "checkList",
  checkresults: "checkList",
  issues: "bridgeIssues",
  recommendations: "publicTextList",
  recommendedactions: "publicTextList",
  suggestions: "publicTextList",
  approvalrequest: "approvalRequest",
  toolactivities: "toolActivities",
  modelinvocationsummary: "modelSummary",
  modelsummary: "modelSummary",
  evidencereferences: "evidenceReferences",
  evidence: "evidenceReferences",
  structuredoutput: "structuredOutput",
  output: "structuredOutput",
  datasyncrequest: "taskConfiguration",
  taskconfiguration: "taskConfiguration",
  resolvedconfiguration: "taskConfiguration",
  metadata: "diagnostic",
  metadatadiscovery: "diagnostic",
  resolutions: "datasourceResolutions",
  failure: "failureSummary",
  recoveryactions: "recoveryActions",
  actions: "recoveryActions",
  schedule: "monitorSchedule",
  recoveryhandoff: "recoveryHandoff",
};

/**
 * Administrative diagnostics intentionally retain a smaller set than SSE.
 *
 * Diagnostics are often assembled from provider, connector, and middleware
 * objects. Limiting them to health and capacity facts prevents an operational
 * page from becoming a generic raw-error or connection viewer.
 */
const PUBLIC_DIAGNOSTIC_FIELDS: PublicObjectPolicy = {
  status: "code",
  state: "code",
  health: "code",
  severity: "code",
  code: "code",
  errorcode: "code",
  service: "code",
  servicename: "code",
  component: "code",
  provider: "code",
  providername: "code",
  model: "modelName",
  modelname: "modelName",
  version: "code",
  environment: "code",
  region: "code",
  message: "publicText",
  summary: "publicText",
  publicsummary: "publicText",
  title: "publicText",
  count: "number",
  total: "number",
  limit: "number",
  max: "number",
  runningcount: "number",
  queuedcount: "number",
  pendingcount: "number",
  completedcount: "number",
  successcount: "number",
  failedcount: "number",
  failurecount: "number",
  processedcount: "number",
  retrycount: "number",
  durationms: "number",
  latencyms: "number",
  timeoutms: "number",
  cachehitrate: "number",
  cachehit: "boolean",
  healthy: "boolean",
  available: "boolean",
  enabled: "boolean",
  configured: "boolean",
  ready: "boolean",
  lastupdatedat: "identifier",
  updatedat: "identifier",
  createdat: "identifier",
  timestamp: "identifier",
  capabilities: "identifierList",
  enabledtools: "identifierList",
  supportedactions: "identifierList",
  warnings: "publicTextList",
  suggestions: "publicTextList",
  issues: "bridgeIssues",
  checks: "checkList",
  modelsummary: "modelSummary",
  retrievalsummary: "diagnostic",
  governancesummary: "diagnostic",
  metadata: "diagnostic",
};

/**
 * The structured Specialist output is a task-plan summary, not an unrestricted
 * runtime payload. The union covers all six Specialist roles while keeping SQL,
 * credentials, raw logs, and provider envelopes outside the browser contract.
 */
const PUBLIC_STRUCTURED_OUTPUT_FIELDS: PublicObjectPolicy = {
  taskid: "identifier",
  executionid: "identifier",
  taskname: "publicText",
  taskkind: "code",
  syncmode: "code",
  writestrategy: "code",
  status: "code",
  taskstatus: "code",
  phase: "code",
  health: "code",
  precheckstatus: "code",
  canstartexecution: "boolean",
  terminal: "boolean",
  persisted: "boolean",
  published: "boolean",
  executed: "boolean",
  draftonly: "boolean",
  mappingdefaultsconfirmed: "boolean",
  userreviewedbaselineapplied: "boolean",
  planavailable: "boolean",
  javatoolplanpending: "boolean",
  sourcedatasourceresolved: "boolean",
  targetdatasourceresolved: "boolean",
  answeravailable: "boolean",
  grounded: "boolean",
  objectmappingcount: "number",
  fieldmappingcount: "number",
  actioncount: "number",
  highriskactioncount: "number",
  logreferencecount: "number",
  factcount: "number",
  citationcount: "number",
  evidencecount: "number",
  candidatecount: "number",
  progress: "number",
  progresspercent: "number",
  rowstotal: "number",
  rowsprocessed: "number",
  successcount: "number",
  failurecount: "number",
  throughputrowspersecond: "number",
  baselinethroughputrowspersecond: "number",
  latencyms: "number",
  heartbeatageseconds: "number",
  queuewaitseconds: "number",
  cdclagseconds: "number",
  nextpollafterseconds: "number",
  missedschedulecount: "number",
  schedulemissed: "boolean",
  heartbeatpresent: "boolean",
  sourcedatasourceid: "identifier",
  targetdatasourceid: "identifier",
  datasourceid: "identifier",
  sourceconnectortype: "code",
  targetconnectortype: "code",
  objectmappings: "objectMappings",
  fieldmappings: "fieldMappings",
  customsqltext: "configuration",
  sql: "configuration",
  sqltext: "configuration",
  where: "configuration",
  wherecondition: "configuration",
  whereclause: "configuration",
  filtercondition: "configuration",
  sourceobjectname: "identifier",
  targetobjectname: "identifier",
  sourceschemaname: "identifier",
  targetschemaname: "identifier",
  requiredinputfields: "identifierList",
  missingfields: "identifierList",
  autofilledfields: "identifierList",
  validationissuecodes: "identifierList",
  modelgovernanceissuecodes: "identifierList",
  userreviewedbaselineconflictfields: "identifierList",
  requestedreadtools: "identifierList",
  requiredevidence: "identifierList",
  anomalycodes: "identifierList",
  recommendedactions: "publicTextList",
  sourcecandidates: "datasourceCandidates",
  targetcandidates: "datasourceCandidates",
  datasourcecandidates: "datasourceCandidates",
  resolutions: "datasourceResolutions",
  metadatadiscovery: "diagnostic",
  checks: "checkList",
  prechecks: "checkList",
  checkresults: "checkList",
  anomalies: "checkList",
  failure: "failureSummary",
  recoveryactions: "recoveryActions",
  actions: "recoveryActions",
  approvalrequest: "approvalRequest",
  recoveryhandoff: "recoveryHandoff",
  evidencereferences: "evidenceReferences",
  checkpoint: "identifier",
  schedule: "monitorSchedule",
  modelsummary: "publicText",
  capturedat: "identifier",
  heartbeatat: "identifier",
  lastrunstatus: "code",
  lastrunat: "identifier",
  nextrunat: "identifier",
  lastsuccessat: "identifier",
};

/** The editable task configuration keeps mapping names but redacts literal SQL and WHERE values. */
const PUBLIC_TASK_CONFIGURATION_FIELDS: PublicObjectPolicy = {
  taskname: "publicText",
  syncmode: "code",
  writestrategy: "code",
  schedulefrequency: "code",
  targettableresolution: "code",
  mappingdefaultsconfirmed: "boolean",
  sourcedatasourceid: "identifier",
  targetdatasourceid: "identifier",
  objectmappings: "objectMappings",
  fieldmappings: "fieldMappings",
  customsqltext: "configuration",
  sql: "configuration",
  sqltext: "configuration",
  where: "configuration",
  wherecondition: "configuration",
  whereclause: "configuration",
  filtercondition: "configuration",
};

/** A mapping record may only expose logical object names and its mapping summary. */
const PUBLIC_OBJECT_MAPPING_FIELDS: PublicObjectPolicy = {
  objectkey: "identifier",
  sourcetablekey: "identifier",
  targettablekey: "identifier",
  sourceschemaname: "identifier",
  sourceobjectname: "identifier",
  targetschemaname: "identifier",
  targetobjectname: "identifier",
  syncenabled: "boolean",
  fieldmappings: "fieldMappings",
  where: "configuration",
  wherecondition: "configuration",
  whereclause: "configuration",
  filtercondition: "configuration",
};

/** A field mapping record may expose schema compatibility, but never transform expression text. */
const PUBLIC_FIELD_MAPPING_FIELDS: PublicObjectPolicy = {
  sourcefield: "identifier",
  sourcefieldname: "identifier",
  sourcetype: "code",
  targetfield: "identifier",
  targetfieldname: "identifier",
  targettype: "code",
  nullable: "boolean",
  sourcenullable: "boolean",
  targetnullable: "boolean",
  primarykey: "boolean",
  syncenabled: "boolean",
  typecompatible: "boolean",
  transform: "configuration",
  transformation: "configuration",
};

/** A datasource candidate deliberately includes identity and state, not connection material. */
const PUBLIC_DATASOURCE_CANDIDATE_FIELDS: PublicObjectPolicy = {
  id: "identifier",
  datasourceid: "identifier",
  name: "publicText",
  displayname: "publicText",
  type: "code",
  databasetype: "code",
  connectortype: "code",
  status: "code",
  projectid: "identifier",
  selected: "boolean",
  accessible: "boolean",
  authorized: "boolean",
};

/**
 * Datasource resolution records explain whether source and target selection is
 * complete without exposing their resolved connection settings.
 */
const PUBLIC_DATASOURCE_RESOLUTIONS_FIELDS: PublicObjectPolicy = {
  source: "datasourceResolution",
  target: "datasourceResolution",
};

/** A single direction can expose candidate identity, count, and clarification state only. */
const PUBLIC_DATASOURCE_RESOLUTION_FIELDS: PublicObjectPolicy = {
  direction: "code",
  status: "code",
  selecteddatasourceid: "identifier",
  datasourceid: "identifier",
  candidatecount: "number",
  candidatedatasourceids: "identifierList",
  candidatenames: "publicTextList",
  resolved: "boolean",
  ambiguous: "boolean",
  requiresinput: "boolean",
  reason: "publicText",
  summary: "publicText",
};

/** A precheck/anomaly record exposes a concise diagnosis and recommendation only. */
const PUBLIC_CHECK_FIELDS: PublicObjectPolicy = {
  id: "identifier",
  code: "code",
  status: "code",
  severity: "code",
  name: "publicText",
  title: "publicText",
  message: "publicText",
  summary: "publicText",
  publicsummary: "publicText",
  suggestion: "publicText",
  recommendation: "publicText",
  recommendedaction: "publicText",
  action: "code",
  count: "number",
  affectedcount: "number",
  blocking: "boolean",
  passed: "boolean",
  resolved: "boolean",
};

/** Recovery failure details retain the human explanation and counters, never raw logs or row samples. */
const PUBLIC_FAILURE_SUMMARY_FIELDS: PublicObjectPolicy = {
  failurecode: "code",
  code: "code",
  failurereason: "publicText",
  reason: "publicText",
  summary: "publicText",
  logreferencecount: "number",
  factcount: "number",
};

/** Monitoring schedule visibility is limited to state and timestamps; cron literals stay in reviewed configuration. */
const PUBLIC_MONITOR_SCHEDULE_FIELDS: PublicObjectPolicy = {
  enabled: "boolean",
  intervalseconds: "number",
  crondescription: "configuration",
  lastrunat: "identifier",
  lastrunstatus: "code",
  nextrunat: "identifier",
  missed: "boolean",
  missedcount: "number",
  lastsuccessat: "identifier",
};

/** Recovery actions describe their governed intent and risk without exposing action arguments. */
const PUBLIC_RECOVERY_ACTION_FIELDS: PublicObjectPolicy = {
  actiontype: "code",
  action: "code",
  code: "code",
  status: "code",
  risklevel: "code",
  requiresapproval: "boolean",
  title: "publicText",
  summary: "publicText",
  publicsummary: "publicText",
  affectedcount: "number",
  actioncount: "number",
};

/** A recovery approval can explain the requested action without exposing a repair payload. */
const PUBLIC_APPROVAL_REQUEST_FIELDS: PublicObjectPolicy = {
  required: "boolean",
  approvalrequired: "boolean",
  status: "code",
  approvalstatus: "code",
  approvalid: "identifier",
  action: "code",
  actioncode: "code",
  risklevel: "code",
  reason: "publicText",
  summary: "publicText",
  publicsummary: "publicText",
  expiresat: "identifier",
  patchcount: "number",
  blueprintcount: "number",
};

/** Tool activity fields are restricted to observable execution metadata. */
const PUBLIC_TOOL_ACTIVITY_FIELDS: PublicObjectPolicy = {
  toolname: "code",
  name: "code",
  status: "code",
  state: "code",
  publicsummary: "publicText",
  summary: "publicText",
  message: "publicText",
  evidencereference: "publicText",
  durationms: "number",
};

/** Model metadata is useful for provenance but must never carry prompt or raw response fields. */
const PUBLIC_MODEL_SUMMARY_FIELDS: PublicObjectPolicy = {
  modelname: "modelName",
  model: "modelName",
  provider: "code",
  providername: "code",
  source: "code",
  invocationcount: "number",
  callcount: "number",
  inputtokens: "number",
  prompttokens: "number",
  outputtokens: "number",
  completiontokens: "number",
  totaltokens: "number",
  cachehit: "boolean",
  cachehitrate: "number",
  reasoningeffect: "code",
  reasoningeffort: "code",
  finishreason: "code",
  responseid: "identifier",
  requestid: "identifier",
  durationms: "number",
  invoked: "boolean",
  providerinvoked: "boolean",
  providersucceeded: "boolean",
  skipped: "boolean",
  specialistmodelinvoked: "boolean",
  rawmodeloutputstored: "boolean",
};

/** Bridge issue records are limited to an error code and user-facing explanation. */
const PUBLIC_BRIDGE_ISSUE_FIELDS: PublicObjectPolicy = {
  code: "code",
  issuecode: "code",
  message: "publicText",
  publicmessage: "publicText",
  summary: "publicText",
};

/** Recovery handoffs advertise approval state and counts, never repair arguments or row samples. */
const PUBLIC_RECOVERY_HANDOFF_FIELDS: PublicObjectPolicy = {
  approvalstatus: "code",
  approvalfactaccepted: "boolean",
  blueprintcount: "number",
  requiresjavarehydration: "boolean",
  executionboundary: "code",
};

/**
 * Map a transport field to the dedicated public policy that owns its value.
 *
 * Returning `undefined` is intentional: it makes unknown fields disappear at
 * the boundary, so adding a property to an SSE event cannot create a browser
 * disclosure until this map is reviewed and updated with a matching test.
 */
function policyForField(policy: PublicObjectPolicy, key: string): PublicValuePolicy | undefined {
  return policy[normalizedFieldName(key)];
}

/**
 * Detect unsafe prose that arrives without a meaningful key.
 *
 * Allowlisting governs object shape, while this scanner protects the few
 * explicitly permitted human-readable summaries. It catches credentials and
 * connection material embedded in text without treating a finite key denylist
 * as the primary authorization decision.
 */
function unsafeAgentPresentationText(value: string): "sensitive" | "configuration" | "internal" | undefined {
  const text = value.trim();
  if (!text) return undefined;
  if (/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/.test(text)) {
    return "sensitive";
  }
  if (/\bauthorization\s*[:=]/i.test(text)
    || /\b(?:bearer|basic)\s+[a-z0-9._~+/-]{12,}\b/i.test(text)
    || /\b(?:sk|pk)_[a-z0-9_-]{8,}\b/i.test(text)) {
    return "sensitive";
  }
  if (/\b(?:AKIA|ASIA|A3T)[A-Z0-9]{16}\b/.test(text)
    || /\b(?:AWS|AZURE|GCP|GOOGLE|ALIYUN|TENCENT|CLOUD)[A-Z0-9_]*(?:KEY|SECRET|TOKEN|CREDENTIAL)[A-Z0-9_]*\b/i.test(text)
    || /\b(?:DefaultEndpointsProtocol|AccountKey|SharedAccessKey|private_key|client_secret)\s*[:=]/i.test(text)) {
    return "sensitive";
  }
  if (/\b(?:jdbc:[a-z]+:|(?:postgres(?:ql)?|mysql|mariadb|oracle|sqlserver|mongodb|redis|amqp|kafka|nats|ldap|ldaps|ftp|sftp):\/\/)/i.test(text)) {
    return "sensitive";
  }
  if (/\b[a-z][a-z0-9+.-]{1,31}:\/\//i.test(text) && !/\bhttps?:\/\//i.test(text)) {
    return "sensitive";
  }
  if (/\b(?:host|hostname|port|user(?:name)?|password|passwd|database|dbname|sslmode)\s*=/i.test(text)
    || /https?:\/\/[^\s/@]+:[^\s/@]+@/i.test(text)
    || /[?&](?:access_?token|api_?key|key|secret|password|passwd|credential|authorization)=[^&#\s]+/i.test(text)) {
    return "sensitive";
  }
  if (/(?:^|\n)\s*(?:at\s+[\w.$]+\([^\n]+:\d+\)|Traceback \(most recent call last\)|Caused by:)/m.test(text)) {
    return "internal";
  }
  if (/\b(?:select\s+[\s\S]{0,160}\s+from|insert\s+into|update\s+\S+\s+set|delete\s+from|merge\s+into|alter\s+table|create\s+(?:table|index|schema)|drop\s+(?:table|index|schema)|truncate\s+table|grant\s+[\s\S]{0,120}\s+on|revoke\s+[\s\S]{0,120}\s+on)\b/i.test(text)
    || /\bwhere\s+[^\n]{0,160}(?:=|<>|!=|>=|<=|\slike\s|\sin\s*\()/i.test(text)) {
    return "configuration";
  }
  if (text.startsWith("{") || text.startsWith("[")) return "internal";
  return undefined;
}

/**
 * Reduce a public label to bounded prose after checking it for embedded
 * secrets, queries, raw JSON, connection strings, and stack traces.
 */
function projectPublicText(value: unknown): unknown {
  if (typeof value !== "string") return AGENT_PRESENTATION_REDACTION.omitted;
  const unsafeKind = unsafeAgentPresentationText(value);
  if (unsafeKind) return AGENT_PRESENTATION_REDACTION[unsafeKind];
  return value.length > 500 ? `${value.slice(0, 500)}...` : value;
}

/**
 * Keep machine codes readable without allowing free-form payloads to masquerade
 * as a status or tool name. A rejected code is omitted rather than rendered.
 */
function projectCode(value: unknown): unknown {
  if (typeof value !== "string" && typeof value !== "number") return AGENT_PRESENTATION_REDACTION.omitted;
  const text = String(value).trim();
  if (!text || unsafeAgentPresentationText(text) || !/^[A-Za-z0-9._:/ -]{1,160}$/.test(text)) {
    return AGENT_PRESENTATION_REDACTION.omitted;
  }
  return text;
}

/**
 * Preserve a bounded identifier only when it is not a secret-bearing URI or
 * serialized payload. IDs, schemas, field names, and timestamps use this path.
 */
function projectIdentifier(value: unknown): unknown {
  if (typeof value !== "string" && typeof value !== "number") return AGENT_PRESENTATION_REDACTION.omitted;
  const text = String(value).trim();
  if (!text || unsafeAgentPresentationText(text) || text.length > 240) {
    return AGENT_PRESENTATION_REDACTION.omitted;
  }
  return text;
}

/**
 * Validate a model name separately from general prose so runtime provenance is
 * retained while URL-like provider configuration cannot appear in the UI.
 */
function projectModelName(value: unknown): unknown {
  if (typeof value !== "string") return AGENT_PRESENTATION_REDACTION.omitted;
  const text = value.trim();
  if (!text || unsafeAgentPresentationText(text) || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(text)) {
    return AGENT_PRESENTATION_REDACTION.omitted;
  }
  return text;
}

/**
 * Project a scalar according to an allowlisted field policy.
 *
 * Scalars are deliberately type-checked. For example, a string in a count
 * field is not converted automatically because malformed transport data should
 * not acquire the authority of a measured runtime fact.
 */
function projectScalar(value: unknown, policy: PublicValuePolicy): unknown {
  if (policy === "configuration") return AGENT_PRESENTATION_REDACTION.configuration;
  if (policy === "blocked") return AGENT_PRESENTATION_REDACTION.internal;
  if (policy === "boolean") return typeof value === "boolean" ? value : AGENT_PRESENTATION_REDACTION.omitted;
  if (policy === "number") return typeof value === "number" && Number.isFinite(value)
    ? value
    : AGENT_PRESENTATION_REDACTION.omitted;
  if (policy === "code") return projectCode(value);
  if (policy === "identifier") return projectIdentifier(value);
  if (policy === "modelName") return projectModelName(value);
  if (policy === "publicText") return projectPublicText(value);
  return undefined;
}

/**
 * Choose the child-field contract for each public object policy.
 *
 * Keeping this switch exhaustive makes an unhandled structured category fail
 * closed. New categories must be consciously mapped to one of the reviewed
 * contracts above before their payload can reach JSX.
 */
function fieldsForObjectPolicy(policy: PublicValuePolicy): PublicObjectPolicy | undefined {
  switch (policy) {
    case "sse": return PUBLIC_SSE_FIELDS;
    case "diagnostic": return PUBLIC_DIAGNOSTIC_FIELDS;
    case "structuredOutput": return PUBLIC_STRUCTURED_OUTPUT_FIELDS;
    case "taskConfiguration": return PUBLIC_TASK_CONFIGURATION_FIELDS;
    case "objectMapping": return PUBLIC_OBJECT_MAPPING_FIELDS;
    case "fieldMapping": return PUBLIC_FIELD_MAPPING_FIELDS;
    case "datasourceCandidate": return PUBLIC_DATASOURCE_CANDIDATE_FIELDS;
    case "datasourceResolutions": return PUBLIC_DATASOURCE_RESOLUTIONS_FIELDS;
    case "datasourceResolution": return PUBLIC_DATASOURCE_RESOLUTION_FIELDS;
    case "check": return PUBLIC_CHECK_FIELDS;
    case "failureSummary": return PUBLIC_FAILURE_SUMMARY_FIELDS;
    case "monitorSchedule": return PUBLIC_MONITOR_SCHEDULE_FIELDS;
    case "recoveryAction": return PUBLIC_RECOVERY_ACTION_FIELDS;
    case "approvalRequest": return PUBLIC_APPROVAL_REQUEST_FIELDS;
    case "toolActivity": return PUBLIC_TOOL_ACTIVITY_FIELDS;
    case "modelSummary": return PUBLIC_MODEL_SUMMARY_FIELDS;
    case "bridgeIssue": return PUBLIC_BRIDGE_ISSUE_FIELDS;
    case "recoveryHandoff": return PUBLIC_RECOVERY_HANDOFF_FIELDS;
    default: return undefined;
  }
}

/**
 * Select the item contract for a reviewed list type.
 *
 * Arrays are bounded below, and each member is independently projected. A
 * stray raw-log string or object cannot inherit the parent's trust merely
 * because it was placed beside valid items in the same SSE array.
 */
function itemPolicyForList(policy: PublicValuePolicy): PublicValuePolicy | undefined {
  switch (policy) {
    case "identifierList": return "identifier";
    case "publicTextList": return "publicText";
    case "objectMappings": return "objectMapping";
    case "fieldMappings": return "fieldMapping";
    case "datasourceCandidates": return "datasourceCandidate";
    case "checkList": return "check";
    case "recoveryActions": return "recoveryAction";
    case "toolActivities": return "toolActivity";
    case "evidenceReferences": return "publicText";
    case "bridgeIssues": return "bridgeIssue";
    default: return undefined;
  }
}

/**
 * Recursively project a reviewed value into browser-safe JSON.
 *
 * The recursion is intentionally tiny and bounded. A value is accepted only
 * when its parent field selected an explicit policy; unknown keys are skipped
 * before their values are visited, which is what makes this fail closed.
 */
function projectAllowlistedValue(value: unknown, policy: PublicValuePolicy, depth = 0): unknown {
  const scalar = projectScalar(value, policy);
  if (scalar !== undefined) return scalar;
  if (depth >= 5) return AGENT_PRESENTATION_REDACTION.omitted;

  const itemPolicy = itemPolicyForList(policy);
  if (itemPolicy) {
    if (!Array.isArray(value)) return AGENT_PRESENTATION_REDACTION.omitted;
    const items = value.slice(0, 20).map((item) => projectAllowlistedValue(item, itemPolicy, depth + 1));
    return value.length > items.length
      ? [...items, `${value.length - items.length} additional items omitted`]
      : items;
  }

  const fieldPolicy = fieldsForObjectPolicy(policy);
  if (!fieldPolicy || value === null || typeof value !== "object" || Array.isArray(value)) {
    return AGENT_PRESENTATION_REDACTION.omitted;
  }

  const projected: Record<string, unknown> = {};
  for (const [key, childValue] of Object.entries(value as Record<string, unknown>)) {
    const childPolicy = policyForField(fieldPolicy, key);
    if (!childPolicy) continue;
    projected[key] = projectAllowlistedValue(childValue, childPolicy, depth + 1);
  }
  return projected;
}

/**
 * Resolve a legacy caller's field key to a top-level reviewed contract.
 *
 * Existing renderers can continue to call `sanitizeAgentPresentationValue`,
 * while new SSE and diagnostics call their named projectors below. Unknown
 * caller keys intentionally map to `blocked`, avoiding an accidental generic
 * object renderer during a future refactor.
 */
function rootPolicyForKey(key: string): PublicValuePolicy {
  const normalized = normalizedFieldName(key);
  // Existing call sites without a field key render Specialist structured data.
  // Treat that legacy form as the reviewed structured-output contract instead
  // of falling back to a generic object projection.
  if (!normalized) return "structuredOutput";
  if (["sse", "sseattributes", "streamattributes", "observationdetails"].includes(normalized)) return "sse";
  if (["diagnostic", "ragdiagnostic", "governancehints", "metadatadiscovery"].includes(normalized)) return "diagnostic";
  if (["structuredoutput", "structuredoutput", "output"].includes(normalized)) return "structuredOutput";
  if (["modelinvocationsummary", "modelsummary", "model"].includes(normalized)) return "modelSummary";
  if (["taskconfiguration", "datasyncrequest", "resolvedconfiguration"].includes(normalized)) return "taskConfiguration";
  if (["toolarguments", "modeloutput", "internal", "actiondetails"].includes(normalized)) return "blocked";
  return policyForField(PUBLIC_SSE_FIELDS, key) ?? "blocked";
}

/**
 * Project a live SSE attributes object through the explicit low-sensitive
 * transport contract used by the collaboration timeline.
 */
export function projectAgentSseAttributes(value: unknown): Record<string, unknown> {
  const projected = projectAllowlistedValue(value, "sse");
  return projected && typeof projected === "object" && !Array.isArray(projected)
    ? projected as Record<string, unknown>
    : {};
}

/**
 * Project an administrative diagnostics payload through its own narrower
 * contract. This must not reuse the richer SSE schema because diagnostics may
 * originate from a connector or provider rather than the governed Agent API.
 */
export function projectAgentDiagnosticValue(value: unknown): unknown {
  return projectAllowlistedValue(value, "diagnostic");
}

/**
 * Compatibility entry point for existing renderers.
 *
 * Unlike the prior recursive sanitizer, this function does not preserve
 * arbitrary object keys. The supplied root key selects one reviewed contract,
 * so direct renderers and nested Specialist panels inherit the same fail-closed
 * policy as the dedicated SSE and diagnostics entry points.
 */
export function sanitizeAgentPresentationValue(value: unknown, key = "", depth = 0): unknown {
  return projectAllowlistedValue(value, rootPolicyForKey(key), depth);
}

/**
 * Return one safe line of public prose for a timeline or card.
 *
 * Summaries are intentionally not parsed as JSON or SQL. If a provider sends
 * unsafe content, callers receive their supplied neutral fallback rather than
 * a redaction string that might look like a meaningful task result.
 */
export function publicAgentSummary(value: unknown, fallback: string): string {
  const projected = projectPublicText(value);
  return typeof projected === "string" && !Object.values(AGENT_PRESENTATION_REDACTION).includes(projected as never)
    ? projected
    : fallback;
}
