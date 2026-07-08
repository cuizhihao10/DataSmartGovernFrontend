import {
  CheckCircleOutlined,
  CloudSyncOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FolderOutlined,
  InboxOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RedoOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
  StopOutlined,
  SyncOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  AutoComplete,
  Button,
  Card,
  Checkbox,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Steps,
  Table,
  Tabs,
  Tag,
  Tree,
  Typography,
  Upload,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { DataNode } from "antd/es/tree";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Key } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  api,
  type CloneSyncTaskPayload,
  type CreateSyncTaskGroupPayload,
  type PublishSyncTaskPayload,
  type SyncDirtyRecordReplayPayload,
  type SyncObjectRetryPayload,
  type SyncTaskBatchExportPayload,
  type SyncTaskBatchOperationPayload,
  type SyncTaskCreateWizardDraftPayload,
  type SyncTaskMetadataDiscoveryPayload,
  type SyncTaskScheduleDispatchPayload,
  type SyncTaskRecoveryPayload,
  type UpdateSyncTaskGroupPayload,
  type UpdateSyncTaskPayload,
  type SyncWorkerLoopRunPayload,
} from "@/api/endpoints";
import { DataSourceIndicator } from "@/components/DataSourceIndicator";
import { RealEmpty } from "@/components/RealEmpty";
import { BooleanTag } from "@/components/StatusTag";
import { PageHeader } from "@/components/PageHeader";
import { useUiStore } from "@/store/uiStore";
import type {
  SyncConnectorCapability,
  SyncConnectorCompatibility,
  SyncAuditRecord,
  SyncCheckpoint,
  SyncErrorSample,
  SyncExecution,
  SyncExecutionLog,
  SyncIncident,
  SyncObjectExecution,
  SyncTask,
  SyncTaskBatchItemResult,
  SyncTaskBatchOperationResult,
  SyncTaskGroupTreeNode,
  SyncTaskImportResult,
  SyncTaskImportRowResult,
  SyncTaskMetadataDiscoveryResult,
  SyncTaskMetadataField,
  SyncTaskMetadataTable,
  SyncTemplate,
  SyncTemplateExecutionPrecheckResponse,
} from "@/types/domain";
import { formatDateTime } from "@/utils/format";
import {
  approvalLabels,
  actorRoleLabels,
  importStatusLabels,
  labelOf,
  optionsOf,
  priorityLabels,
  statusLabels,
  syncExecutionStateLabels,
  syncModeLabels,
  syncScopeLabels,
  syncTaskStateLabels,
  writeStrategyLabels,
} from "@/utils/labels";

const transferModeProfiles = {
  FULL_TRANSFER: { label: "全量传输", syncMode: "FULL", syncScopeType: "OBJECT_LIST", objectScopeType: "TABLES", runMode: "MANUAL" },
  SCHEDULED_BATCH: { label: "定期批量", syncMode: "SCHEDULED_BATCH", syncScopeType: "OBJECT_LIST", objectScopeType: "TABLES", runMode: "SCHEDULED" },
  SCHEDULED_FULL: { label: "定期全量", syncMode: "SCHEDULED_FULL", syncScopeType: "OBJECT_LIST", objectScopeType: "TABLES", runMode: "SCHEDULED" },
  CUSTOM_SQL_QUERY: { label: "SQL 语句", syncMode: "CUSTOM_SQL_QUERY", syncScopeType: "CUSTOM_SQL_QUERY", objectScopeType: "TABLES", runMode: "MANUAL" },
  CDC_STREAMING: { label: "实时", syncMode: "CDC_STREAMING", syncScopeType: "OBJECT_LIST", objectScopeType: "TABLES", runMode: "MANUAL" },
} as const;

const transferModeOptions = Object.entries(transferModeProfiles).map(([value, profile]) => ({ value, label: profile.label }));

type ObjectScopeType = "TABLES" | "SCHEMA_FULL" | "SCHEMA_AND_TABLES" | "DATABASE_FULL";

function transferModeFromSyncMode(syncMode?: string) {
  const normalized = (syncMode || "").toUpperCase();
  return (Object.entries(transferModeProfiles).find(([, profile]) => profile.syncMode === normalized)?.[0]
    ?? "FULL_TRANSFER") as keyof typeof transferModeProfiles;
}

const objectScopeOptions: Array<{ value: ObjectScopeType; label: string }> = [
  { value: "TABLES", label: "按表选择" },
  { value: "SCHEMA_FULL", label: "按 Schema 传输" },
  { value: "SCHEMA_AND_TABLES", label: "按 Schema 和表选择" },
  { value: "DATABASE_FULL", label: "全库传输" },
];

const writeStrategies = ["INSERT", "UPDATE"];
const syncWriteStrategyLabels: Record<string, string> = {
  INSERT: "insert（仅插入）",
  UPDATE: "update / merge（更新或合并）",
};

const dataSourceUsageLabels: Record<string, string> = {
  SOURCE: "仅源端",
  TARGET: "仅目标端",
};

function isNumericScopeValue(value?: string | number) {
  if (value == null || value === "") {
    return false;
  }
  return Number.isFinite(Number(value));
}

const syncTaskActionLabels: Record<string, string> = {
  run: "运行",
  manualDispatch: "立即执行一次",
  pause: "暂停",
  resume: "恢复",
  retry: "重试",
  cancel: "取消",
  terminate: "手工结束",
  offline: "下线",
  recycle: "移入回收站",
  hardDelete: "彻底删除",
  replay: "回放",
  backfill: "补数",
};

const stateColor: Record<string, string> = {
  DRAFT: "default",
  CONFIGURED: "blue",
  PENDING_APPROVAL: "gold",
  SCHEDULED: "processing",
  QUEUED: "cyan",
  RUNNING: "blue",
  PAUSED: "orange",
  RETRYING: "purple",
  PARTIALLY_SUCCEEDED: "cyan",
  SUCCEEDED: "success",
  FAILED: "error",
  AWAITING_OPERATOR_ACTION: "volcano",
  MANUALLY_TERMINATED: "default",
  OFFLINE: "default",
  RECYCLED: "default",
  CANCELLED: "default",
  ARCHIVED: "default",
  DELETED: "default",
  SKIPPED: "default",
};

const executionLogLevelColor: Record<string, string> = {
  INFO: "blue",
  WARN: "gold",
  ERROR: "red",
};

const executionLogStageLabels: Record<string, string> = {
  QUEUE: "入队",
  CLAIM: "认领",
  PLAN: "计划",
  METADATA_DISCOVERY: "元数据发现",
  OBJECT_FAN_OUT: "对象拆分",
  OBJECT: "对象执行",
  SHARD: "分片执行",
  CHANNEL: "通道",
  REMOTE_BATCH: "批次同步",
  CHECKPOINT: "断点",
  COMPLETE: "完成",
  FAILED: "失败",
};

const executionLogStatusLabels: Record<string, string> = {
  STARTED: "开始",
  PROGRESS: "进行中",
  SUCCEEDED: "成功",
  PARTIALLY_SUCCEEDED: "部分成功",
  FAILED: "失败",
  BLOCKED: "阻断",
  RETRYING: "重试中",
  SKIPPED: "跳过",
};

const approvalColor: Record<string, string> = {
  NOT_REQUIRED: "default",
  PENDING: "gold",
  APPROVED: "success",
  REJECTED: "error",
};

const severityColor: Record<string, string> = {
  P1: "red",
  P2: "volcano",
  P3: "orange",
  P4: "blue",
};

const triggerTypeLabels: Record<string, string> = {
  MANUAL: "手动触发",
  SCHEDULED: "定时触发",
  RETRY: "重试触发",
  REPLAY: "回放触发",
  BACKFILL: "补数触发",
};

const supportLevelLabels: Record<string, string> = {
  PRIMARY: "主推",
  SECONDARY: "可用",
  EXPERIMENTAL: "实验",
};

const incidentStatusLabels: Record<string, string> = {
  OPEN: "待处理",
  ACKNOWLEDGED: "已确认",
  ASSIGNED: "已分派",
  RESOLVED: "已解决",
  CLOSED: "已关闭",
};

const auditActionLabels: Record<string, string> = {
  UNKNOWN: "未知动作",
  CREATE_TEMPLATE: "创建模板",
  VALIDATE_TEMPLATE: "校验模板",
  CREATE_TASK: "创建任务",
  CREATE_EXECUTION: "创建执行记录",
  RUN_TASK: "运行任务",
  PAUSE_TASK: "暂停任务",
  RESUME_TASK: "恢复任务",
  RETRY_TASK: "重试任务",
  CANCEL_TASK: "取消任务",
  REPLAY_TASK: "回放任务",
  BACKFILL_TASK: "补数任务",
  UPDATE_TASK: "编辑任务",
  PUBLISH_TASK: "发布任务",
  UPDATE_TASK_GROUP: "调整分组",
  EXPORT_TASKS: "导出任务定义",
  IMPORT_TASKS: "导入任务定义",
  MANUAL_DISPATCH_TASK: "手工调度",
  MANUAL_TERMINATE_TASK: "手工结束",
  OFFLINE_TASK: "下线任务",
  RECYCLE_TASK: "移入回收站",
  HARD_DELETE_TASK: "彻底删除",
  CLONE_TASK: "克隆任务",
  RETRY_OBJECT_EXECUTION: "重试对象",
  REPLAY_DIRTY_RECORD: "脏数据回放",
  UPDATE_CHECKPOINT: "更新断点",
  RECORD_ERROR_SAMPLE: "记录错误样本",
};

const taskStateOptions = [
  "DRAFT",
  "PENDING_APPROVAL",
  "CONFIGURED",
  "SCHEDULED",
  "QUEUED",
  "RUNNING",
  "PAUSED",
  "RETRYING",
  "PARTIALLY_SUCCEEDED",
  "SUCCEEDED",
  "FAILED",
  "AWAITING_OPERATOR_ACTION",
  "MANUALLY_TERMINATED",
  "OFFLINE",
  "RECYCLED",
  "DELETED",
  "CANCELLED",
  "ARCHIVED",
];

const editAllowedStates = new Set([
  "DRAFT",
  "CONFIGURED",
  "PENDING_APPROVAL",
  "SCHEDULED",
  "PAUSED",
  "PARTIALLY_SUCCEEDED",
  "SUCCEEDED",
  "FAILED",
  "AWAITING_OPERATOR_ACTION",
  "MANUALLY_TERMINATED",
  "OFFLINE",
  "CANCELLED",
]);

const publishAllowedStates = new Set([
  "DRAFT",
  "CONFIGURED",
  "PENDING_APPROVAL",
  "PAUSED",
  "PARTIALLY_SUCCEEDED",
  "SUCCEEDED",
  "FAILED",
  "AWAITING_OPERATOR_ACTION",
  "MANUALLY_TERMINATED",
  "OFFLINE",
  "CANCELLED",
]);

const runAllowedStates = new Set(["CONFIGURED", "SCHEDULED", "PAUSED", "FAILED", "PARTIALLY_SUCCEEDED"]);
const pauseAllowedStates = new Set(["SCHEDULED", "QUEUED", "RUNNING", "RETRYING"]);
const resumeAllowedStates = new Set(["PAUSED"]);
const retryAllowedStates = new Set(["FAILED", "PARTIALLY_SUCCEEDED"]);
const cancelAllowedStates = new Set([
  "DRAFT",
  "CONFIGURED",
  "PENDING_APPROVAL",
  "SCHEDULED",
  "QUEUED",
  "RUNNING",
  "PAUSED",
  "RETRYING",
  "PARTIALLY_SUCCEEDED",
  "FAILED",
]);
const terminateAllowedStates = new Set(["QUEUED", "RUNNING", "RETRYING", "PAUSED"]);
const offlineAllowedStates = new Set([
  "DRAFT",
  "CONFIGURED",
  "PENDING_APPROVAL",
  "SCHEDULED",
  "PAUSED",
  "PARTIALLY_SUCCEEDED",
  "SUCCEEDED",
  "FAILED",
  "AWAITING_OPERATOR_ACTION",
  "CANCELLED",
  "MANUALLY_TERMINATED",
  "ARCHIVED",
]);

interface FieldMappingRow {
  key: string;
  sourceField: string;
  sourceType?: string;
  targetField: string;
  targetType?: string;
  nullable?: boolean;
  primaryKey?: boolean;
  syncEnabled?: boolean;
  typeCompatible?: boolean;
  compatibilityNote?: string;
  transform?: string;
}

interface ObjectMappingRow {
  key: string;
  sourceTableIndex?: string;
  targetTableIndex?: string;
  sourceSchemaName?: string;
  sourceObjectName?: string;
  targetSchemaName?: string;
  targetObjectName?: string;
  objectType?: string;
  whereCondition?: string;
}

interface SyncWizardValues {
  tenantId?: number;
  projectId?: number;
  transferMode?: keyof typeof transferModeProfiles;
  objectScopeType?: ObjectScopeType;
  syncScopeType: "SINGLE_OBJECT" | "OBJECT_LIST" | "SCHEMA_FULL" | "DATABASE_FULL" | "CUSTOM_SQL_QUERY";
  sourceDatasourceId?: number;
  targetDatasourceId?: number;
  sourceConnectorType?: string;
  targetConnectorType?: string;
  sourceTableIndex?: string;
  targetTableIndex?: string;
  sourceSchemaName?: string;
  sourceObjectName?: string;
  targetSchemaName?: string;
  targetObjectName?: string;
  syncMode: string;
  writeStrategy: string;
  customSqlText?: string;
  filterConfig?: string;
  groupCode?: string;
  groupName?: string;
  taskName?: string;
  taskDescription?: string;
  priority?: string;
  runMode?: string;
  scheduleConfig?: string;
  ownerId?: number;
}

type WizardPrecheckStatus = "PASS" | "WARNING" | "BLOCKED" | "PENDING";

interface WizardPrecheckItem {
  key: string;
  category: string;
  title: string;
  status: WizardPrecheckStatus;
  summary: string;
  details: string[];
  issueCodes?: string[];
  step?: number;
  stepName?: string;
}

interface ImportTaskValues {
  format?: "CSV" | "XLSX";
  dryRun?: boolean;
  runImmediately?: boolean;
}

type UiSyncTaskGroupTreeNode = Omit<SyncTaskGroupTreeNode, "children"> & {
  uiKey: string;
  groupName: string;
  children?: UiSyncTaskGroupTreeNode[];
};

const DEFAULT_SYNC_GROUP_CODE = "DEFAULT";
const SYNC_TASK_TABLE_PAGE_SIZE = 8;
const UNNAMED_SYNC_GROUP = "未命名分组";
const METADATA_DISCOVERY_MAX_TABLES = 500;
const METADATA_DISCOVERY_MAX_COLUMNS_PER_TABLE = 160;

function compactPayload<T extends object>(values: T): T {
  return Object.fromEntries(
    Object.entries(values).filter((entry) => entry[1] !== "" && entry[1] !== undefined && entry[1] !== null),
  ) as T;
}

function generateResourceCode(prefix: string) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}_${timestamp}_${random}`;
}

function syncGroupDisplayName(node: SyncTaskGroupTreeNode) {
  return node.displayName?.trim() || node.groupName?.trim() || UNNAMED_SYNC_GROUP;
}

function syncGroupScopeKey(node: SyncTaskGroupTreeNode) {
  /*
   * 后端现在会返回 treeKey，语义等价于 tenant/project/group 的稳定组合键。
   * 这里仍保留前端拼接兜底，是为了兼容旧服务或本地 mock 数据；正常真实服务应优先使用后端 treeKey，
   * 避免 DEFAULT 这类重复 groupCode 在树节点 key、选中态、展开折叠态上互相覆盖。
   */
  if (node.treeKey?.trim()) {
    return node.treeKey.trim();
  }
  return [
    node.tenantId ?? "tenant",
    node.projectId ?? "project",
    node.groupCode || "NO_GROUP",
  ].join(":");
}

function syncGroupMergeKey(node: SyncTaskGroupTreeNode) {
  if (node.treeKey?.trim()) {
    return `tree:${node.treeKey.trim()}`;
  }
  const code = node.groupCode?.trim();
  if (code === DEFAULT_SYNC_GROUP_CODE) {
    return `code:${DEFAULT_SYNC_GROUP_CODE}`;
  }
  if (code) {
    return `code:${code}`;
  }
  return `name:${syncGroupDisplayName(node)}`;
}

function addSyncGroupNumber(left?: number, right?: number) {
  return (left ?? 0) + (right ?? 0);
}

function latestSyncGroupTime(left?: string, right?: string) {
  if (!left) return right;
  if (!right) return left;
  return left >= right ? left : right;
}

function mergeUiSyncGroupChildren(
  currentChildren: UiSyncTaskGroupTreeNode[] = [],
  incomingChildren: UiSyncTaskGroupTreeNode[] = [],
) {
  const merged = new Map<string, UiSyncTaskGroupTreeNode>();
  currentChildren.forEach((child) => merged.set(syncGroupMergeKey(child), child));
  incomingChildren.forEach((child) => {
    const mergeKey = syncGroupMergeKey(child);
    const existing = merged.get(mergeKey);
    if (existing) {
      mergeUiSyncGroupNode(existing, child);
    } else {
      merged.set(mergeKey, child);
    }
  });
  return Array.from(merged.values());
}

function mergeUiSyncGroupNode(target: UiSyncTaskGroupTreeNode, source: UiSyncTaskGroupTreeNode) {
  target.taskCount = addSyncGroupNumber(target.taskCount, source.taskCount);
  target.activeTaskCount = addSyncGroupNumber(target.activeTaskCount, source.activeTaskCount);
  target.scheduledTaskCount = addSyncGroupNumber(target.scheduledTaskCount, source.scheduledTaskCount);
  target.runningTaskCount = addSyncGroupNumber(target.runningTaskCount, source.runningTaskCount);
  target.failedTaskCount = addSyncGroupNumber(target.failedTaskCount, source.failedTaskCount);
  target.recycledTaskCount = addSyncGroupNumber(target.recycledTaskCount, source.recycledTaskCount);
  target.subtreeTaskCount = addSyncGroupNumber(target.subtreeTaskCount, source.subtreeTaskCount);
  target.subtreeActiveTaskCount = addSyncGroupNumber(target.subtreeActiveTaskCount, source.subtreeActiveTaskCount);
  target.subtreeScheduledTaskCount = addSyncGroupNumber(target.subtreeScheduledTaskCount, source.subtreeScheduledTaskCount);
  target.subtreeRunningTaskCount = addSyncGroupNumber(target.subtreeRunningTaskCount, source.subtreeRunningTaskCount);
  target.subtreeFailedTaskCount = addSyncGroupNumber(target.subtreeFailedTaskCount, source.subtreeFailedTaskCount);
  target.subtreeRecycledTaskCount = addSyncGroupNumber(target.subtreeRecycledTaskCount, source.subtreeRecycledTaskCount);
  target.lastUpdateTime = latestSyncGroupTime(target.lastUpdateTime, source.lastUpdateTime);
  target.defaultGroup = Boolean(target.defaultGroup || source.defaultGroup);
  target.legacyOnly = Boolean(target.legacyOnly && source.legacyOnly);
  target.id = target.id ?? source.id;
  target.description = target.description || source.description;
  target.scopeLabel = target.scopeLabel || source.scopeLabel;
  target.displayPath = target.displayPath || source.displayPath;
  target.displayName = target.displayName || source.displayName;
  target.displayOrder = Math.min(target.displayOrder ?? 100, source.displayOrder ?? 100);
  target.children = mergeUiSyncGroupChildren(target.children, source.children);
}

function toUiSyncGroupNode(
  node: SyncTaskGroupTreeNode,
  parentKey: string,
  index: number,
): UiSyncTaskGroupTreeNode {
  const uiKey = `group:${parentKey}:${syncGroupScopeKey(node)}:${index}`;
  return {
    ...node,
    uiKey,
    groupName: syncGroupDisplayName(node),
    taskCount: node.taskCount ?? 0,
    activeTaskCount: node.activeTaskCount ?? 0,
    scheduledTaskCount: node.scheduledTaskCount ?? 0,
    runningTaskCount: node.runningTaskCount ?? 0,
    failedTaskCount: node.failedTaskCount ?? 0,
    recycledTaskCount: node.recycledTaskCount ?? 0,
    children: normalizeSyncGroupTree(node.children ?? [], uiKey),
  };
}

function normalizeSyncGroupTree(nodes: SyncTaskGroupTreeNode[], parentKey = "root") {
  const merged = new Map<string, UiSyncTaskGroupTreeNode>();
  nodes.forEach((node, index) => {
    const uiNode = toUiSyncGroupNode(node, parentKey, index);
    const mergeKey = syncGroupMergeKey(uiNode);
    const existing = merged.get(mergeKey);
    if (existing) {
      mergeUiSyncGroupNode(existing, uiNode);
    } else {
      merged.set(mergeKey, uiNode);
    }
  });
  return Array.from(merged.values());
}

function sumSyncGroupTaskCount(nodes: UiSyncTaskGroupTreeNode[]): number {
  /*
   * 后端 tree DTO 明确区分：
   * - taskCount：直接归属到当前分组的任务；
   * - subtreeTaskCount：当前分组及全部子分组汇总任务。
   * “全部同步任务”要展示树口径总量，应优先加根节点 subtreeTaskCount；只有旧后端没有 subtree 字段时，
   * 才递归加 taskCount 兜底，避免父子分组场景下重复计算或少算。
   */
  return nodes.reduce((total, node) => {
    if (node.subtreeTaskCount != null) {
      return total + node.subtreeTaskCount;
    }
    return total + (node.taskCount ?? 0) + sumSyncGroupTaskCount(node.children ?? []);
  }, 0);
}

function sumSyncGroupRecycledTaskCount(nodes: UiSyncTaskGroupTreeNode[]): number {
  return nodes.reduce((total, node) => {
    if (node.subtreeRecycledTaskCount != null) {
      return total + node.subtreeRecycledTaskCount;
    }
    return total + (node.recycledTaskCount ?? 0) + sumSyncGroupRecycledTaskCount(node.children ?? []);
  }, 0);
}

function syncGroupTaskCount(node: UiSyncTaskGroupTreeNode) {
  if (node.subtreeTaskCount != null) {
    return node.subtreeTaskCount;
  }
  return (node.taskCount ?? 0) + sumSyncGroupTaskCount(node.children ?? []);
}

function syncGroupRecycledTaskCount(node: UiSyncTaskGroupTreeNode) {
  if (node.subtreeRecycledTaskCount != null) {
    return node.subtreeRecycledTaskCount;
  }
  return (node.recycledTaskCount ?? 0) + sumSyncGroupRecycledTaskCount(node.children ?? []);
}

function syncGroupNormalTaskCount(node: UiSyncTaskGroupTreeNode) {
  return Math.max(0, syncGroupTaskCount(node) - syncGroupRecycledTaskCount(node));
}

function sumSyncGroupNormalTaskCount(nodes: UiSyncTaskGroupTreeNode[]): number {
  return nodes.reduce((total, node) => total + syncGroupNormalTaskCount(node), 0);
}

function syncGroupVisibleCount(node: UiSyncTaskGroupTreeNode, field: keyof UiSyncTaskGroupTreeNode, fallbackField: keyof UiSyncTaskGroupTreeNode) {
  const subtreeValue = node[field];
  if (typeof subtreeValue === "number") {
    return subtreeValue;
  }
  const directValue = node[fallbackField];
  return typeof directValue === "number" ? directValue : 0;
}

function statusTag(value: string, colorMap: Record<string, string>, labels: Record<string, string> = statusLabels) {
  return <Tag color={colorMap[value] ?? "default"}>{labelOf(value, labels)}</Tag>;
}

function codeFromDataSourceType(type?: string) {
  const normalized = (type || "").replace(/\s+/g, "").toUpperCase();
  const map: Record<string, string> = {
    MYSQL: "MYSQL",
    POSTGRESQL: "POSTGRESQL",
    POSTGRES: "POSTGRESQL",
    KAFKA: "KAFKA",
    MONGODB: "MONGODB",
    MINIO: "OBJECT_STORAGE",
    API: "API",
    SQLSERVER: "SQLSERVER",
    ORACLE: "ORACLE",
  };
  return map[normalized] ?? normalized;
}

function tableObjectKey(table: SyncTaskMetadataTable, index: number) {
  return `${table.schemaName || "默认Schema"}.${table.tableName}#${index}`;
}

function isMysqlLikeConnector(connectorType?: string) {
  const normalized = (connectorType || "").toUpperCase();
  return normalized.includes("MYSQL") || normalized.includes("MARIADB");
}

function filterMetadataTables(
  discovery: SyncTaskMetadataDiscoveryResult | null,
  keyword: string,
  schemaFilter?: string,
) {
  const normalized = keyword.trim().toLowerCase();
  return (discovery?.tables ?? [])
    .map((table, index) => ({ ...table, key: tableObjectKey(table, index), index: String(index), fieldCount: table.fields?.length ?? 0 }))
    .filter((table) => {
      if (schemaFilter && table.schemaName !== schemaFilter) {
        return false;
      }
      if (!normalized) return true;
      const schema = (table.schemaName || "").toLowerCase();
      const name = table.tableName.toLowerCase();
      return schema.includes(normalized) || name.includes(normalized) || `${schema}.${name}`.includes(normalized);
    });
}

function metadataSchemas(discovery: SyncTaskMetadataDiscoveryResult | null) {
  const schemas = discovery?.schemas?.length
    ? discovery.schemas
    : Array.from(new Set((discovery?.tables ?? []).map((table) => table.schemaName).filter(Boolean) as string[]));
  return schemas.map((schema) => ({ value: schema, label: schema }));
}
function findTable(discovery: SyncTaskMetadataDiscoveryResult | null, index?: string) {
  if (!discovery?.tables || index == null) {
    return undefined;
  }
  return discovery.tables[Number(index)];
}

function findMetadataTableByName(
  discovery: SyncTaskMetadataDiscoveryResult | null,
  schemaName?: string,
  objectName?: string,
) {
  if (!objectName) {
    return undefined;
  }
  const normalizedObjectName = objectName.toLowerCase();
  const normalizedSchemaName = schemaName?.toLowerCase();
  return (discovery?.tables ?? []).find((table) => {
    const sameObject = table.tableName.toLowerCase() === normalizedObjectName;
    const sameSchema = !normalizedSchemaName || !table.schemaName || table.schemaName.toLowerCase() === normalizedSchemaName;
    return sameObject && sameSchema;
  });
}

function hasPrimaryKey(table?: SyncTaskMetadataTable) {
  return Boolean(
    table?.primaryKeys?.length
      || table?.fields?.some((field) => field.primaryKey),
  );
}

function sortedColumns(table?: SyncTaskMetadataTable) {
  return [...(table?.fields ?? [])].sort((left, right) => (left.ordinalPosition ?? 0) - (right.ordinalPosition ?? 0));
}

function makeFieldMappings(sourceColumns: SyncTaskMetadataField[], targetColumns: SyncTaskMetadataField[]): FieldMappingRow[] {
  /*
   * 字段映射以“源端字段”为主视角。
   * 数据同步的真实数据流是 source -> target，源端不存在的字段不会产生任何待写入值；
   * 因此目标表独有字段不应该出现在映射表里让用户困惑，它们是否允许为空、是否有默认值、是否由触发器生成，
   * 应交给第四步服务端预检查和目标库结构约束判断。这里仅对同名目标字段做自动预填，源端字段没有匹配目标时
   * 默认不勾选，用户可以手工填写目标字段后再让预检查判断是否成立。
   */
  const targetByName = new Map(targetColumns.map((column) => [column.fieldName.toLowerCase(), column]));
  return sourceColumns.map((column) => {
    const target = targetByName.get(column.fieldName.toLowerCase());
    return {
      key: `source-${column.fieldName}-${column.ordinalPosition ?? sourceColumns.indexOf(column)}`,
      sourceField: column.fieldName,
      sourceType: column.dataTypeName,
      targetField: target?.fieldName ?? "",
      targetType: target?.dataTypeName,
      nullable: column.nullable,
      primaryKey: column.primaryKey,
      syncEnabled: Boolean(target) && (column.syncEnabled ?? true),
      typeCompatible: target ? true : undefined,
      compatibilityNote: target ? undefined : "目标端未发现同名字段；该源字段默认不传输，可手工选择目标字段后再同步",
    } satisfies FieldMappingRow;
  });
}

function serializeFieldRows(rows: FieldMappingRow[]) {
  return rows
    .filter((row) => row.syncEnabled !== false && row.sourceField && row.targetField)
    .map((row) => ({
      sourceField: row.sourceField,
      targetField: row.targetField,
      sourceType: row.sourceType,
      targetType: row.targetType,
      nullable: row.nullable,
      primaryKey: row.primaryKey,
      typeCompatible: row.typeCompatible,
      compatibilityNote: row.compatibilityNote,
      transform: row.transform || undefined,
    }));
}

function buildFieldMappingConfig(
  rows: FieldMappingRow[],
  objectRows: ObjectMappingRow[] = [],
  rowsByObjectKey: Record<string, FieldMappingRow[]> = {},
) {
  const objectMappings = objectRows.map((object, index) => ({
    ordinal: index + 1,
    objectKey: object.key,
    sourceSchemaName: object.sourceSchemaName,
    sourceObjectName: object.sourceObjectName,
    targetSchemaName: object.targetSchemaName,
    targetObjectName: object.targetObjectName,
    whereCondition: object.whereCondition || undefined,
    mappings: serializeFieldRows(rowsByObjectKey[object.key] ?? []),
  }));
  return JSON.stringify(
    {
      version: objectRows.length ? "datasmart.sync.field-mapping.v2" : "datasmart.sync.field-mapping.v1",
      mappings: objectRows.length ? undefined : serializeFieldRows(rows),
      objectMappings: objectRows.length ? objectMappings : undefined,
    },
    null,
    2,
  );
}

function parseJsonRecord(text?: string) {
  if (!text?.trim()) {
    return undefined;
  }
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function booleanValue(value: unknown, fallback = true) {
  return typeof value === "boolean" ? value : fallback;
}

function parseObjectMappingsConfig(text?: string): ObjectMappingRow[] {
  const config = parseJsonRecord(text);
  const mappings = Array.isArray(config?.mappings) ? config.mappings : [];
  /*
   * objectMappingConfig 是“创建向导第二步”的持久化快照。
   * 后端执行时只需要 schema/table 等低敏定位字段，但前端恢复草稿时还需要一个稳定 key，
   * 否则字段映射无法重新挂回对应的对象行。这里优先使用 objectKey，缺失时用源端 schema/table 和序号合成。
   */
  return mappings
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .map((item, index) => {
      const sourceSchemaName = stringValue(item.sourceSchemaName);
      const sourceObjectName = stringValue(item.sourceObjectName);
      const fallbackKey = `${sourceSchemaName || "source"}.${sourceObjectName || "object"}#${index}`;
      return {
        key: stringValue(item.objectKey) || fallbackKey,
        sourceSchemaName,
        sourceObjectName,
        targetSchemaName: stringValue(item.targetSchemaName),
        targetObjectName: stringValue(item.targetObjectName),
        objectType: stringValue(item.objectType) || "TABLE",
        whereCondition: stringValue(item.whereCondition),
      } satisfies ObjectMappingRow;
    });
}

function parseFieldMappingConfig(text?: string) {
  const config = parseJsonRecord(text);
  const parseRows = (value: unknown): FieldMappingRow[] => Array.isArray(value)
    ? value
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
      .map((item, index) => ({
        key: stringValue(item.key) || `draft-field-${index}`,
        sourceField: stringValue(item.sourceField) || "",
        sourceType: stringValue(item.sourceType),
        targetField: stringValue(item.targetField) || "",
        targetType: stringValue(item.targetType),
        nullable: typeof item.nullable === "boolean" ? item.nullable : undefined,
        primaryKey: typeof item.primaryKey === "boolean" ? item.primaryKey : undefined,
        syncEnabled: booleanValue(item.syncEnabled, true),
        typeCompatible: typeof item.typeCompatible === "boolean" ? item.typeCompatible : undefined,
        compatibilityNote: stringValue(item.compatibilityNote),
        transform: stringValue(item.transform),
      } satisfies FieldMappingRow))
    : [];

  const rowsByObjectKey: Record<string, FieldMappingRow[]> = {};
  const objectRows: ObjectMappingRow[] = [];
  const objectConfigs = Array.isArray(config?.objectMappings) ? config.objectMappings : [];
  objectConfigs
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
    .forEach((item, index) => {
      const objectKey = stringValue(item.objectKey)
        || `${stringValue(item.sourceSchemaName) || "source"}.${stringValue(item.sourceObjectName) || "object"}#${index}`;
      rowsByObjectKey[objectKey] = parseRows(item.mappings);
      objectRows.push({
        key: objectKey,
        sourceSchemaName: stringValue(item.sourceSchemaName),
        sourceObjectName: stringValue(item.sourceObjectName),
        targetSchemaName: stringValue(item.targetSchemaName),
        targetObjectName: stringValue(item.targetObjectName),
        objectType: stringValue(item.objectType) || "TABLE",
        whereCondition: stringValue(item.whereCondition),
      });
    });

  return {
    rows: parseRows(config?.mappings),
    rowsByObjectKey,
    objectRows,
  };
}

function parseCustomSqlConfig(text?: string) {
  const config = parseJsonRecord(text);
  return stringValue(config?.sql);
}

function compactObjectName(schemaName?: string, objectName?: string) {
  return [schemaName, objectName].filter(Boolean).join(".") || objectName || "-";
}

function stateOf(task: SyncTask) {
  return String(task.currentState || "").toUpperCase();
}

function canOperate(task: SyncTask, allowedStates: Set<string>) {
  return allowedStates.has(stateOf(task));
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function DataSync() {
  const { message, modal } = App.useApp();
  const [wizardForm] = Form.useForm<SyncWizardValues>();
  const [createGroupForm] = Form.useForm<CreateSyncTaskGroupPayload>();
  const [editTaskForm] = Form.useForm<UpdateSyncTaskPayload>();
  const [publishForm] = Form.useForm<PublishSyncTaskPayload>();
  const [groupForm] = Form.useForm<UpdateSyncTaskGroupPayload>();
  const [cloneForm] = Form.useForm<CloneSyncTaskPayload>();
  const [importForm] = Form.useForm<ImportTaskValues>();
  const [recoveryForm] = Form.useForm<SyncTaskRecoveryPayload>();
  const [objectRetryForm] = Form.useForm<SyncObjectRetryPayload>();
  const [dirtyReplayForm] = Form.useForm<SyncDirtyRecordReplayPayload>();
  const [workerForm] = Form.useForm<SyncWorkerLoopRunPayload>();
  const [schedulerForm] = Form.useForm<SyncTaskScheduleDispatchPayload>();
  const [activeTab, setActiveTab] = useState("tasks");
  const [taskTreeView, setTaskTreeView] = useState<"tasks" | "recycle">("tasks");
  const [templateKeyword, setTemplateKeyword] = useState("");
  const [taskKeyword, setTaskKeyword] = useState("");
  const [taskGroupFilter, setTaskGroupFilter] = useState<string>();
  const [taskGroupTreeKeyFilter, setTaskGroupTreeKeyFilter] = useState<string>();
  const [taskStateFilter, setTaskStateFilter] = useState<string>();
  const [taskApprovalFilter, setTaskApprovalFilter] = useState<string>();
  const [taskPage, setTaskPage] = useState(1);
  const [recycleTaskPage, setRecycleTaskPage] = useState(1);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [editTask, setEditTask] = useState<SyncTask | null>(null);
  const [publishTask, setPublishTask] = useState<SyncTask | null>(null);
  const [groupTask, setGroupTask] = useState<SyncTask | null>(null);
  const [cloneTask, setCloneTask] = useState<SyncTask | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<SyncTaskImportResult | null>(null);
  const [wizardStep, setWizardStep] = useState(0);
  const [, setWizardVersion] = useState(0);
  const [objectMappings, setObjectMappings] = useState<ObjectMappingRow[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMappingRow[]>([]);
  const [fieldMappingsByObjectKey, setFieldMappingsByObjectKey] = useState<Record<string, FieldMappingRow[]>>({});
  const [activeObjectMappingKey, setActiveObjectMappingKey] = useState<string>();
  const [wizardDraft, setWizardDraft] = useState<{ taskId?: number; templateId?: number } | null>(null);
  const [wizardSaving, setWizardSaving] = useState(false);
  const [wizardPrecheckLoading, setWizardPrecheckLoading] = useState(false);
  const [wizardPrecheckResult, setWizardPrecheckResult] = useState<SyncTemplateExecutionPrecheckResponse | null>(null);
  const [wizardPrecheckDetail, setWizardPrecheckDetail] = useState<WizardPrecheckItem | null>(null);
  const [sourceObjectPageSize, setSourceObjectPageSize] = useState(10);
  const [targetObjectPageSize, setTargetObjectPageSize] = useState(10);
  const [mappingObjectPageSize, setMappingObjectPageSize] = useState(10);
  const [fieldMappingPageSize, setFieldMappingPageSize] = useState(20);
  const [activeObjectEditor, setActiveObjectEditor] = useState<"FIELDS" | "WHERE">("FIELDS");
  const [batchWhereCondition, setBatchWhereCondition] = useState("");
  const [sourceDiscovery, setSourceDiscovery] = useState<SyncTaskMetadataDiscoveryResult | null>(null);
  const [targetDiscovery, setTargetDiscovery] = useState<SyncTaskMetadataDiscoveryResult | null>(null);
  const [compatibility, setCompatibility] = useState<SyncConnectorCompatibility | null>(null);
  const [previewPayload, setPreviewPayload] = useState<unknown | null>(null);
  const [batchResult, setBatchResult] = useState<SyncTaskBatchOperationResult | null>(null);
  const [selectedTaskRowKeys, setSelectedTaskRowKeys] = useState<number[]>([]);
  const [selectedRecycleTaskRowKeys, setSelectedRecycleTaskRowKeys] = useState<number[]>([]);
  const [selectedTask, setSelectedTask] = useState<SyncTask | null>(null);
  const [selectedExecutionId, setSelectedExecutionId] = useState<number>();
  const [recoveryAction, setRecoveryAction] = useState<"replay" | "backfill" | null>(null);
  const [recoveryTask, setRecoveryTask] = useState<SyncTask | null>(null);
  const [sourceObjectKeyword, setSourceObjectKeyword] = useState("");
  const [targetObjectKeyword, setTargetObjectKeyword] = useState("");
  const [sourceSchemaFilter, setSourceSchemaFilter] = useState<string>();
  const [targetSchemaFilter, setTargetSchemaFilter] = useState<string>();
  const [excludedSourceObjects, setExcludedSourceObjects] = useState<string[]>([]);
  const selectedProjectId = useUiStore((state) => state.selectedProjectId);
  const setProjectOptions = useUiStore((state) => state.setProjectOptions);
  const selectedProjectScopeId = isNumericScopeValue(selectedProjectId) ? Number(selectedProjectId) : undefined;
  const normalizedTaskKeyword = taskKeyword.trim();

  const sessionQuery = useQuery({
    queryKey: ["sync-gateway-session"],
    queryFn: api.getSession,
  });
  const dataSourceQuery = useQuery({
    queryKey: ["sync-datasources"],
    queryFn: () => api.listDataSources({ size: 100 }),
  });
  const capabilityQuery = useQuery({
    queryKey: ["sync-connector-capabilities"],
    queryFn: api.listSyncConnectorCapabilities,
  });
  const templateQuery = useQuery({
    queryKey: ["sync-templates"],
    queryFn: api.listSyncTemplates,
  });
  const taskQuery = useQuery({
    queryKey: ["sync-tasks", selectedProjectScopeId, taskGroupFilter, taskStateFilter, taskApprovalFilter, normalizedTaskKeyword, taskPage],
    queryFn: () =>
      api.listSyncTasks(
        compactPayload({
          projectId: selectedProjectScopeId,
          groupCode: taskGroupFilter,
          currentState: taskStateFilter,
          approvalState: taskApprovalFilter,
          keyword: normalizedTaskKeyword,
          current: taskPage,
          size: SYNC_TASK_TABLE_PAGE_SIZE,
        }),
      ),
  });
  const taskGroupQuery = useQuery({
    queryKey: ["sync-task-groups", selectedProjectScopeId],
    queryFn: () => api.listSyncTaskGroups(compactPayload({ projectId: selectedProjectScopeId, size: 100 })),
  });
  const taskGroupTreeQuery = useQuery({
    queryKey: ["sync-task-group-tree", selectedProjectScopeId],
    queryFn: () => api.listSyncTaskGroupTree(compactPayload({ projectId: selectedProjectScopeId, size: 200 })),
  });
  const recycleBinQuery = useQuery({
    queryKey: ["sync-recycle-bin", selectedProjectScopeId, taskGroupFilter, taskApprovalFilter, normalizedTaskKeyword, recycleTaskPage],
    queryFn: () =>
      api.listRecycledSyncTasks(
        compactPayload({
          projectId: selectedProjectScopeId,
          groupCode: taskGroupFilter,
          approvalState: taskApprovalFilter,
          keyword: normalizedTaskKeyword,
          current: recycleTaskPage,
          size: SYNC_TASK_TABLE_PAGE_SIZE,
        }),
      ),
  });
  const incidentQuery = useQuery({
    queryKey: ["sync-incidents"],
    queryFn: api.listSyncIncidents,
  });
  const executionQuery = useQuery({
    queryKey: ["sync-executions", selectedTask?.id],
    queryFn: () => api.listSyncExecutions(selectedTask!.id),
    enabled: Boolean(selectedTask),
  });
  const objectExecutionQuery = useQuery({
    queryKey: ["sync-object-executions", selectedTask?.id, selectedExecutionId],
    queryFn: () => api.listSyncObjectExecutions(selectedTask!.id, selectedExecutionId!),
    enabled: Boolean(selectedTask?.id && selectedExecutionId),
  });
  const errorSampleQuery = useQuery({
    queryKey: ["sync-error-samples", selectedTask?.id, selectedExecutionId],
    queryFn: () => api.listSyncErrorSamples(selectedTask!.id, selectedExecutionId),
    enabled: Boolean(selectedTask?.id),
  });
  const checkpointQuery = useQuery({
    queryKey: ["sync-checkpoints", selectedTask?.id, selectedExecutionId],
    queryFn: () => api.listSyncCheckpoints(selectedTask!.id, selectedExecutionId),
    enabled: Boolean(selectedTask?.id),
  });
  const auditQuery = useQuery({
    queryKey: ["sync-audit-records", selectedTask?.id, selectedExecutionId],
    queryFn: () => api.listSyncAuditRecords(selectedTask!.id, selectedExecutionId),
    enabled: Boolean(selectedTask?.id),
  });

  const dataSources = useMemo(() => dataSourceQuery.data?.data.records ?? [], [dataSourceQuery.data?.data.records]);
  const capabilities = useMemo(() => capabilityQuery.data?.data ?? [], [capabilityQuery.data?.data]);
  const templates = useMemo(() => templateQuery.data?.data.records ?? [], [templateQuery.data?.data.records]);
  const tasks = useMemo(() => taskQuery.data?.data.records ?? [], [taskQuery.data?.data.records]);
  const taskGroupTree = useMemo(
    () => normalizeSyncGroupTree(taskGroupTreeQuery.data?.data ?? []),
    [taskGroupTreeQuery.data?.data],
  );
  const allSyncTaskTotal = useMemo(() => sumSyncGroupTaskCount(taskGroupTree), [taskGroupTree]);
  const allNormalSyncTaskTotal = useMemo(() => sumSyncGroupNormalTaskCount(taskGroupTree), [taskGroupTree]);
  const recycledTasks = useMemo(() => recycleBinQuery.data?.data.records ?? [], [recycleBinQuery.data?.data.records]);
  const incidents = incidentQuery.data?.data.records ?? [];
  const executions = executionQuery.data?.data.records ?? [];
  const selectedExecutionRecord = useMemo(
    () => executions.find((record) => record.id === selectedExecutionId),
    [executions, selectedExecutionId],
  );
  const selectedExecutionIsLive = ["QUEUED", "RUNNING", "RETRYING"].includes(
    String(selectedExecutionRecord?.executionState ?? "").toUpperCase(),
  );
  const executionLogQuery = useQuery({
    queryKey: ["sync-execution-logs", selectedTask?.id, selectedExecutionId],
    queryFn: () => api.listSyncExecutionLogs(selectedTask!.id, selectedExecutionId!),
    enabled: Boolean(selectedTask?.id && selectedExecutionId),
    refetchInterval: selectedExecutionIsLive ? 3000 : false,
  });
  const objectExecutions = objectExecutionQuery.data?.data.records ?? [];
  const executionLogs = executionLogQuery.data?.data.records ?? [];
  const errorSamples = errorSampleQuery.data?.data.records ?? [];
  const checkpoints = checkpointQuery.data?.data.records ?? [];
  const auditRecords = auditQuery.data?.data.records ?? [];
  useEffect(() => {
    setTaskPage((page) => (page === 1 ? page : 1));
  }, [selectedProjectScopeId, taskGroupFilter, taskStateFilter, taskApprovalFilter, normalizedTaskKeyword]);
  useEffect(() => {
    setRecycleTaskPage((page) => (page === 1 ? page : 1));
  }, [selectedProjectScopeId, taskGroupFilter, taskApprovalFilter, normalizedTaskKeyword]);
  useEffect(() => {
    const projectIds = Array.from(
      new Set(
        [...dataSources, ...templates, ...tasks, ...recycledTasks]
          .map((record) => record.projectId)
          .filter((id): id is number => id != null),
      ),
    );
    if (projectIds.length) {
      setProjectOptions(projectIds.map((id) => ({ value: String(id), label: `项目 ${id}` })));
    }
  }, [dataSources, recycledTasks, setProjectOptions, tasks, templates]);
  const flatGroupNodes = useMemo(() => {
    const walk = (nodes: UiSyncTaskGroupTreeNode[], parentPath: string[] = []): UiSyncTaskGroupTreeNode[] =>
      nodes.flatMap((node) => {
        const path = [...parentPath, node.groupName || UNNAMED_SYNC_GROUP].filter(Boolean);
        return [
          { ...node, groupName: path.join(" / ") || UNNAMED_SYNC_GROUP },
          ...walk(node.children ?? [], path),
        ];
      });
    return walk(taskGroupTree);
  }, [taskGroupTree]);
  const groupOptions = useMemo(() => {
    const seenGroupCodes = new Set<string>();
    return flatGroupNodes
      .filter((group) => {
        if (seenGroupCodes.has(group.groupCode)) {
          return false;
        }
        seenGroupCodes.add(group.groupCode);
        return true;
      })
      .map((group) => ({
        value: group.groupCode,
        label: group.displayPath || group.displayName || group.groupName || UNNAMED_SYNC_GROUP,
      }));
  }, [flatGroupNodes]);

  const discoverSourceMutation = useMutation({
    mutationFn: (payload: SyncTaskMetadataDiscoveryPayload) => api.discoverSyncTaskMetadata(payload),
    onSuccess: (result) => {
      setSourceDiscovery(result.data);
      message.success("源端元数据发现完成");
    },
  });

  const discoverTargetMutation = useMutation({
    mutationFn: (payload: SyncTaskMetadataDiscoveryPayload) => api.discoverSyncTaskMetadata(payload),
    onSuccess: (result) => {
      setTargetDiscovery(result.data);
      message.success("目标端元数据发现完成");
    },
  });

  const resolveSubmitSyncScopeType = (values: SyncWizardValues) => {
    if (values.syncMode === "CUSTOM_SQL_QUERY") {
      return "CUSTOM_SQL_QUERY";
    }
    if (values.objectScopeType === "DATABASE_FULL") {
      return "DATABASE_FULL";
    }
    if (objectMappings.length) {
      return objectMappings.length <= 1 ? "SINGLE_OBJECT" : "OBJECT_LIST";
    }
    if (values.objectScopeType === "SCHEMA_FULL") {
      return "SCHEMA_FULL";
    }
    return objectMappings.length <= 1 ? "SINGLE_OBJECT" : "OBJECT_LIST";
  };

  const buildObjectMappingConfigForSubmit = (values: SyncWizardValues) => {
    const submitScopeType = resolveSubmitSyncScopeType(values);
    if (submitScopeType === "CUSTOM_SQL_QUERY") {
      return undefined;
    }
    const fallbackMapping: ObjectMappingRow | undefined = submitScopeType === "DATABASE_FULL"
      ? {
          key: "database-full",
          sourceSchemaName: values.sourceSchemaName,
          targetSchemaName: values.targetSchemaName,
          objectType: "DATABASE",
        }
      : submitScopeType === "SCHEMA_FULL"
        ? {
            key: "schema-full",
            sourceSchemaName: values.sourceSchemaName,
            targetSchemaName: values.targetSchemaName,
            objectType: "SCHEMA",
          }
        : values.sourceObjectName || values.targetObjectName
          ? {
              key: "single-object",
              sourceSchemaName: values.sourceSchemaName,
              sourceObjectName: values.sourceObjectName,
              targetSchemaName: values.targetSchemaName,
              targetObjectName: values.targetObjectName,
              objectType: "TABLE",
            }
          : undefined;
    const rows = objectMappings.length ? objectMappings : fallbackMapping ? [fallbackMapping] : [];
    const mapping = {
      version: "datasmart.sync.object-mapping.v1",
      discoveryPolicy: {
        filterMode: metadataFilterMode(submitScopeType),
        includeTables: true,
        includeViews: false,
        excludedSourceObjects,
      },
      mappings: rows.map((row, index) => ({
        ordinal: index + 1,
        objectKey: row.key,
        sourceSchemaName: row.sourceSchemaName,
        sourceObjectName: row.sourceObjectName,
        targetSchemaName: row.targetSchemaName,
        targetObjectName: row.targetObjectName,
        objectType: row.objectType || (submitScopeType === "SCHEMA_FULL" ? "SCHEMA" : submitScopeType === "DATABASE_FULL" ? "DATABASE" : "TABLE"),
        whereCondition: row.whereCondition || undefined,
      })),
    };
    return JSON.stringify(mapping, null, 2);
  };

  const buildCustomSqlConfigForSubmit = (values: SyncWizardValues) => {
    const sql = values.customSqlText?.trim();
    if (!sql) {
      return undefined;
    }
    return JSON.stringify({ version: "datasmart.sync.custom-sql.v1", sql }, null, 2);
  };
  const buildWizardDraftPayload = (
    stepCode: string,
    discoverySnapshot?: { sourceDiscovery?: SyncTaskMetadataDiscoveryResult | null; targetDiscovery?: SyncTaskMetadataDiscoveryResult | null },
  ) => {
    const values = wizardForm.getFieldsValue(true);
    const submitSyncScopeType = resolveSubmitSyncScopeType(values);
    const firstMapping = objectMappings[0];
    const sourceObjectName = values.sourceObjectName?.trim() || firstMapping?.sourceObjectName?.trim();
    const targetObjectName = values.targetObjectName?.trim() || firstMapping?.targetObjectName?.trim();
    const sourceSchemaName = values.sourceSchemaName || firstMapping?.sourceSchemaName;
    const targetSchemaName = values.targetSchemaName || firstMapping?.targetSchemaName;
    /*
     * 保存草稿时也做一次“源字段默认映射”兜底。
     * UI 上展示的字段行如果只是由源表元数据即时生成，而用户没有逐行修改，React state 里可能还没有对应 rows。
     * 这里在提交前把每个对象缺失或为空的 rows 补成源字段列表，保证“页面看到的默认映射”和“后端持久化的草稿”
     * 语义一致，避免用户进入第四步预检查时后端仍认为字段映射为空。
     */
    const effectiveRowsByObjectKey = objectMappings.reduce<Record<string, FieldMappingRow[]>>((rows, mapping) => {
      const existingRows = fieldMappingsByObjectKey[mapping.key];
      rows[mapping.key] = existingRows && existingRows.length > 0
        ? existingRows
        : makeFieldMappingsForObject(mapping, discoverySnapshot?.sourceDiscovery, discoverySnapshot?.targetDiscovery);
      return rows;
    }, {});
    const fieldConfig = buildFieldMappingConfig(fieldMappings, objectMappings, effectiveRowsByObjectKey);
    return compactPayload<SyncTaskCreateWizardDraftPayload>({
      taskId: wizardDraft?.taskId,
      templateId: wizardDraft?.templateId,
      stepCode,
      tenantId: values.tenantId,
      projectId: values.projectId,
      taskName: values.taskName,
      name: values.taskName || `${sourceObjectName || (values.syncMode === "CUSTOM_SQL_QUERY" ? "sql_result" : "source")}_to_${targetObjectName || "target"}`,
      taskDescription: values.taskDescription,
      description: values.taskDescription,
      groupCode: values.groupCode,
      groupName: values.groupName,
      priority: values.priority,
      scheduleConfig: values.scheduleConfig,
      ownerId: values.ownerId,
      sourceDatasourceId: values.sourceDatasourceId!,
      targetDatasourceId: values.targetDatasourceId!,
      sourceSchemaName,
      sourceObjectName,
      targetSchemaName,
      targetObjectName,
      sourceConnectorType: values.sourceConnectorType,
      targetConnectorType: values.targetConnectorType,
      syncMode: values.syncMode,
      syncScopeType: submitSyncScopeType,
      writeStrategy: values.writeStrategy === "MERGE" ? "UPDATE" : values.writeStrategy,
      fieldMappingConfig: fieldConfig,
      objectMappingConfig: buildObjectMappingConfigForSubmit(values),
      customSqlConfig: buildCustomSqlConfigForSubmit(values),
    });
  };

  const saveWizardDraft = async (
    stepCode: string,
    discoverySnapshot?: { sourceDiscovery?: SyncTaskMetadataDiscoveryResult | null; targetDiscovery?: SyncTaskMetadataDiscoveryResult | null },
  ) => {
    setWizardSaving(true);
    try {
      const result = await api.saveSyncTaskCreateWizardDraft(buildWizardDraftPayload(stepCode, discoverySnapshot));
      setWizardDraft({ taskId: result.data.taskId, templateId: result.data.templateId });
      message.success(result.data.created ? "同步任务草稿已创建，任务列表会显示编辑中记录" : "同步任务草稿已保存");
      await Promise.all([templateQuery.refetch(), taskQuery.refetch(), taskGroupQuery.refetch(), taskGroupTreeQuery.refetch()]);
      return result.data;
    } finally {
      setWizardSaving(false);
    }
  };

  const runWizardAutoPrecheck = async (templateId?: number) => {
    const effectiveTemplateId = templateId ?? wizardDraft?.templateId;
    if (!effectiveTemplateId) {
      setWizardPrecheckResult(null);
      return;
    }
    setWizardPrecheckLoading(true);
    try {
      const precheckResult = await api.precheckSyncTemplate(effectiveTemplateId);
      setWizardPrecheckResult(precheckResult.data);
      message.success("服务端预检查已完成");
    } catch (error) {
      setWizardPrecheckResult(null);
      message.error(error instanceof Error ? error.message : "服务端预检查失败");
    } finally {
      setWizardPrecheckLoading(false);
    }
  };

  useEffect(() => {
    if (!wizardOpen || wizardStep !== 3 || !wizardDraft?.templateId) {
      return;
    }
    void runWizardAutoPrecheck(wizardDraft.templateId);
  }, [wizardOpen, wizardStep, wizardDraft?.templateId]);

  const createGroupMutation = useMutation({
    mutationFn: (payload: CreateSyncTaskGroupPayload) => api.createSyncTaskGroup(payload),
    onSuccess: async (result) => {
      message.success(`任务分组已创建：${result.data.groupName || "未命名分组"}`);
      setCreateGroupOpen(false);
      createGroupForm.resetFields();
      await Promise.all([taskGroupQuery.refetch(), taskGroupTreeQuery.refetch()]);
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "任务分组创建失败"),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: ({ groupCode, reason }: { groupCode: string; reason?: string }) =>
      api.deleteSyncTaskGroup(groupCode, { reason }),
    onSuccess: async (result, variables) => {
      setPreviewPayload(result.data);
      if (taskGroupFilter === variables.groupCode) {
        setTaskGroupFilter(undefined);
        setTaskGroupTreeKeyFilter(undefined);
      }
      message.success("任务分组已删除，组内任务已由后端迁回默认分组");
      await Promise.all([taskQuery.refetch(), taskGroupQuery.refetch(), taskGroupTreeQuery.refetch(), recycleBinQuery.refetch()]);
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "任务分组删除失败"),
  });

  const taskActionMutation = useMutation({
    mutationFn: async ({
      id,
      action,
      payload,
    }: {
      id: number;
      action:
        | "run"
        | "manualDispatch"
        | "pause"
        | "resume"
        | "retry"
        | "cancel"
        | "terminate"
        | "offline"
        | "recycle"
        | "hardDelete"
        | "replay"
        | "backfill";
      payload?: SyncTaskRecoveryPayload | { reason?: string };
    }) => {
      if (action === "run") return api.runSyncTask(id);
      if (action === "manualDispatch") return api.manualDispatchSyncTask(id);
      if (action === "pause") return api.pauseSyncTask(id, payload);
      if (action === "resume") return api.resumeSyncTask(id, payload);
      if (action === "retry") return api.retrySyncTask(id, payload);
      if (action === "cancel") return api.cancelSyncTask(id, payload);
      if (action === "terminate") return api.terminateSyncTask(id, payload);
      if (action === "offline") return api.offlineSyncTask(id, payload);
      if (action === "recycle") return api.recycleSyncTask(id, payload);
      if (action === "hardDelete") return api.hardDeleteSyncTask(id, payload);
      if (action === "replay") return api.replaySyncTask(id, payload as SyncTaskRecoveryPayload);
      return api.backfillSyncTask(id, payload as SyncTaskRecoveryPayload);
    },
    onSuccess: async (_, variables) => {
      message.success(`同步任务${syncTaskActionLabels[variables.action]}已提交`);
      await Promise.all([taskQuery.refetch(), taskGroupQuery.refetch(), taskGroupTreeQuery.refetch(), recycleBinQuery.refetch()]);
      if (selectedTask) {
        await Promise.all([
          executionQuery.refetch(),
          objectExecutionQuery.refetch(),
          errorSampleQuery.refetch(),
          checkpointQuery.refetch(),
          auditQuery.refetch(),
        ]);
      }
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "同步任务操作失败"),
  });

  const taskDefinitionMutation = useMutation({
    mutationFn: async ({
      id,
      action,
      payload,
    }: {
      id: number;
      action: "edit" | "publish" | "group" | "clone";
      payload?: UpdateSyncTaskPayload | PublishSyncTaskPayload | UpdateSyncTaskGroupPayload | CloneSyncTaskPayload;
    }) => {
      if (action === "edit") return api.updateSyncTask(id, payload as UpdateSyncTaskPayload);
      if (action === "publish") return api.publishSyncTask(id, payload as PublishSyncTaskPayload);
      if (action === "group") return api.updateSyncTaskGroup(id, payload as UpdateSyncTaskGroupPayload);
      return api.cloneSyncTask(id, payload as CloneSyncTaskPayload);
    },
    onSuccess: async (result, variables) => {
      const actionText = variables.action === "edit"
        ? "编辑"
        : variables.action === "publish"
          ? "发布"
          : variables.action === "group"
            ? "分组调整"
            : "克隆";
      setPreviewPayload(result.data);
      message.success(`同步任务${actionText}已提交`);
      await Promise.all([taskQuery.refetch(), taskGroupQuery.refetch(), taskGroupTreeQuery.refetch(), recycleBinQuery.refetch()]);
      if (variables.action === "edit" && selectedTask && "id" in result.data) {
        setSelectedTask(result.data as SyncTask);
      }
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "同步任务定义操作失败"),
  });

  const exportMutation = useMutation({
    mutationFn: (format: "CSV" | "XLSX") =>
      api.exportSyncTasks({
        format,
        groupCode: taskGroupFilter,
        currentState: taskStateFilter,
        approvalState: taskApprovalFilter,
        keyword: normalizedTaskKeyword,
        current: 1,
        size: 500,
      }),
    onSuccess: (result, format) => {
      downloadBlob(result.data.blob, result.data.fileName || `datasmart-sync-tasks.${format.toLowerCase()}`);
      message.success("同步任务定义导出已开始下载");
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "同步任务定义导出失败"),
  });

  const batchExportMutation = useMutation({
    mutationFn: (payload: SyncTaskBatchExportPayload) => api.batchExportSyncTasks(payload),
    onSuccess: (result, payload) => {
      const format = payload.format || "CSV";
      downloadBlob(result.data.blob, result.data.fileName || `datasmart-sync-selected-tasks.${format.toLowerCase()}`);
      message.success("已按勾选任务导出定义文件");
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "勾选任务导出失败"),
  });

  const importMutation = useMutation({
    mutationFn: ({ file, values }: { file: File; values: ImportTaskValues }) =>
      api.batchImportSyncTasks(file, values),
    onSuccess: async (result) => {
      setImportResult(result.data);
      setPreviewPayload(result.data);
      message.success(result.data.message || "同步任务定义导入处理完成");
      await Promise.all([taskQuery.refetch(), taskGroupQuery.refetch(), taskGroupTreeQuery.refetch(), recycleBinQuery.refetch()]);
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "同步任务定义导入失败"),
  });

  const batchOperationMutation = useMutation({
    mutationFn: ({
      action,
      payload,
    }: {
      action: "manualDispatch" | "offline" | "recycle" | "hardDelete";
      payload: SyncTaskBatchOperationPayload;
    }) => {
      if (action === "manualDispatch") return api.batchManualDispatchSyncTasks(payload);
      if (action === "offline") return api.batchOfflineSyncTasks(payload);
      if (action === "recycle") return api.batchRecycleSyncTasks(payload);
      return api.batchHardDeleteSyncTasks(payload);
    },
    onSuccess: async (result) => {
      setBatchResult(result.data);
      setSelectedTaskRowKeys([]);
      setSelectedRecycleTaskRowKeys([]);
      message.success(`批量操作完成：成功 ${result.data.successCount}，失败 ${result.data.failedCount}，跳过 ${result.data.skippedCount}`);
      await Promise.all([
        taskQuery.refetch(),
        taskGroupQuery.refetch(),
        taskGroupTreeQuery.refetch(),
        recycleBinQuery.refetch(),
        selectedTask ? executionQuery.refetch() : Promise.resolve(),
      ]);
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "批量操作失败"),
  });

  const objectRetryMutation = useMutation({
    mutationFn: async (payload: SyncObjectRetryPayload) => {
      if (!selectedTask?.id || !selectedExecutionId) {
        throw new Error("请先选择任务和执行记录");
      }
      return api.retrySyncObjectExecutions(selectedTask.id, selectedExecutionId, payload);
    },
    onSuccess: async (result) => {
      setPreviewPayload(result.data);
      message.success("失败对象重试已提交");
      await Promise.all([executionQuery.refetch(), objectExecutionQuery.refetch(), executionLogQuery.refetch(), auditQuery.refetch()]);
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "失败对象重试失败"),
  });

  const dirtyReplayMutation = useMutation({
    mutationFn: async (payload: SyncDirtyRecordReplayPayload) => {
      if (!selectedTask?.id) {
        throw new Error("请先选择任务");
      }
      return api.replaySyncDirtyRecords(selectedTask.id, payload);
    },
    onSuccess: async (result) => {
      setPreviewPayload(result.data);
      message.success("脏数据修复回放已提交");
      await Promise.all([executionQuery.refetch(), executionLogQuery.refetch(), errorSampleQuery.refetch(), auditQuery.refetch()]);
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "脏数据重放失败"),
  });

  const workerLoopMutation = useMutation({
    mutationFn: (payload: SyncWorkerLoopRunPayload) => api.runSyncWorkerLoop(compactPayload(payload)),
    onSuccess: async (result) => {
      setPreviewPayload(result.data);
      message.success("执行器单轮处理已返回");
      await Promise.all([
        taskQuery.refetch(),
        taskGroupTreeQuery.refetch(),
        selectedTask ? executionQuery.refetch() : Promise.resolve(),
        selectedTask && selectedExecutionId ? executionLogQuery.refetch() : Promise.resolve(),
      ]);
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "执行器触发失败"),
  });

  const schedulerMutation = useMutation({
    mutationFn: (payload: SyncTaskScheduleDispatchPayload) => api.dispatchDueSyncTasks(compactPayload(payload)),
    onSuccess: async (result) => {
      setPreviewPayload(result.data);
      message.success("定时任务派发已返回");
      await Promise.all([
        taskQuery.refetch(),
        taskGroupTreeQuery.refetch(),
        selectedTask ? executionQuery.refetch() : Promise.resolve(),
        selectedTask && selectedExecutionId ? executionLogQuery.refetch() : Promise.resolve(),
      ]);
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "定时任务派发失败"),
  });

  const filteredTemplates = templates.filter((record) =>
    [record.name, record.sourceObjectName, record.targetObjectName, record.syncMode, record.syncScopeType]
      .join(" ")
      .toLowerCase()
      .includes(templateKeyword.toLowerCase()),
  );

  const filteredTasks = tasks;
  const filteredRecycledTasks = recycledTasks;

  const groupNodeByTreeKey = useMemo(
    () => new Map(flatGroupNodes.map((group) => [group.uiKey, group])),
    [flatGroupNodes],
  );

  const findGroupNode = (groupCode?: string) =>
    groupCode ? flatGroupNodes.find((group) => group.groupCode === groupCode) : undefined;

  const selectedGroupNode = taskGroupTreeKeyFilter
    ? groupNodeByTreeKey.get(taskGroupTreeKeyFilter)
    : findGroupNode(taskGroupFilter);
  const selectedTreeKey = taskTreeView === "recycle" ? "recycle" : selectedGroupNode?.uiKey ?? "all";

  const groupTreeData = useMemo(() => {
    const nodeTitle = (node: UiSyncTaskGroupTreeNode) => (
      <div className="sync-group-tree-title">
        <span className="sync-group-tree-name">{node.displayName || node.groupName || UNNAMED_SYNC_GROUP}</span>
        <span className="sync-group-tree-count">{syncGroupNormalTaskCount(node)}</span>
      </div>
    );
    const mapNodes = (nodes: UiSyncTaskGroupTreeNode[]): DataNode[] =>
      nodes.map((node) => ({
        key: node.uiKey,
        title: nodeTitle(node),
        children: node.children?.length ? mapNodes(node.children) : undefined,
      }));
    return [
      {
        key: "all",
        title: (
          <div className="sync-group-tree-title">
            <span className="sync-group-tree-name">全部同步任务</span>
            <span className="sync-group-tree-count">{allNormalSyncTaskTotal}</span>
          </div>
        ),
      },
      ...mapNodes(taskGroupTree),
      {
        key: "recycle",
        title: (
          <div className="sync-group-tree-title">
            <span className="sync-group-tree-name">任务回收站</span>
            <span className="sync-group-tree-count">{recycleBinQuery.data?.data.total ?? 0}</span>
          </div>
        ),
      },
    ];
  }, [allNormalSyncTaskTotal, taskGroupTree, recycleBinQuery.data?.data.total]);

  const openCreateGroup = () => {
    createGroupForm.resetFields();
    createGroupForm.setFieldsValue({
      parentGroupCode: selectedGroupNode?.legacyOnly ? undefined : selectedGroupNode?.groupCode,
    });
    setCreateGroupOpen(true);
  };

  const confirmDeleteSelectedGroup = () => {
    if (!selectedGroupNode) {
      message.warning("请先在分组树中选择一个业务分组");
      return;
    }
    if (selectedGroupNode.defaultGroup) {
      message.warning("默认分组不能删除");
      return;
    }
    if (selectedGroupNode.legacyOnly) {
      message.warning("历史兼容分组不是正式分组资源，请先创建同编码分组后再管理");
      return;
    }
    modal.confirm({
      title: "确认删除当前任务分组？",
      content: `分组 ${selectedGroupNode.groupName || "未命名分组"} 会被后端归档，组内任务不会删除，会迁回默认分组。`,
      okText: "删除分组",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: () =>
        deleteGroupMutation.mutate({
          groupCode: selectedGroupNode.groupCode,
          reason: "前端分组菜单删除任务分组",
        }),
    });
  };

  const selectGroupTreeKey = (key?: Key) => {
    const nextKey = String(key || "all");
    if (nextKey === "all") {
      setTaskGroupFilter(undefined);
      setTaskGroupTreeKeyFilter(undefined);
      setTaskTreeView("tasks");
      setActiveTab("tasks");
      return;
    }
    if (nextKey === "recycle") {
      setTaskGroupFilter(undefined);
      setTaskGroupTreeKeyFilter(undefined);
      setTaskTreeView("recycle");
      setActiveTab("tasks");
      return;
    }
    const selectedGroup = groupNodeByTreeKey.get(nextKey);
    if (selectedGroup) {
      setTaskGroupFilter(selectedGroup.groupCode);
      setTaskGroupTreeKeyFilter(selectedGroup.uiKey);
      setTaskTreeView("tasks");
      setActiveTab("tasks");
    }
  };

  const runBatchOperation = (
    action: "manualDispatch" | "offline" | "recycle" | "hardDelete",
    taskIds: number[],
  ) => {
    if (!taskIds.length) {
      message.warning("请先勾选需要批量处理的同步任务");
      return;
    }
    const actionText = action === "manualDispatch"
      ? "立即执行"
      : action === "offline"
        ? "下线"
        : action === "recycle"
          ? "移入回收站"
          : "彻底删除";
    const payload = {
      taskIds,
      reason: `前端批量${actionText}同步任务`,
      continueOnError: true,
    } satisfies SyncTaskBatchOperationPayload;
    const submit = () => batchOperationMutation.mutate({ action, payload });
    if (action === "manualDispatch") {
      submit();
      return;
    }
    modal.confirm({
      title: `确认批量${actionText}？`,
      content: `已勾选 ${taskIds.length} 个同步任务。后端会逐条校验状态和权限，并返回每条任务的处理结果。`,
      okText: `批量${actionText}`,
      cancelText: "取消",
      okButtonProps: { danger: action === "recycle" || action === "hardDelete" },
      onOk: submit,
    });
  };

  const renderBatchToolbar = (taskIds: number[], recycleView = false) => (
    <Space wrap>
      <Tag color={taskIds.length ? "blue" : "default"}>已选 {taskIds.length}</Tag>
      {recycleView ? (
        <Button
          danger
          icon={<DeleteOutlined />}
          disabled={!taskIds.length}
          loading={batchOperationMutation.isPending}
          onClick={() => runBatchOperation("hardDelete", taskIds)}
        >
          批量彻底删除
        </Button>
      ) : (
        <>
          <Button
            icon={<PlayCircleOutlined />}
            disabled={!taskIds.length}
            loading={batchOperationMutation.isPending}
            onClick={() => runBatchOperation("manualDispatch", taskIds)}
          >
            批量立即执行
          </Button>
          <Button
            icon={<InboxOutlined />}
            disabled={!taskIds.length}
            loading={batchOperationMutation.isPending}
            onClick={() => runBatchOperation("offline", taskIds)}
          >
            批量下线
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            disabled={!taskIds.length}
            loading={batchOperationMutation.isPending}
            onClick={() => runBatchOperation("recycle", taskIds)}
          >
            批量移入回收站
          </Button>
        </>
      )}
      <Button
        icon={<DownloadOutlined />}
        disabled={!taskIds.length}
        loading={batchExportMutation.isPending}
        onClick={() => batchExportMutation.mutate({ taskIds, format: "CSV" })}
      >
        导出所选 CSV
      </Button>
      <Button
        disabled={!taskIds.length}
        loading={batchExportMutation.isPending}
        onClick={() => batchExportMutation.mutate({ taskIds, format: "XLSX" })}
      >
        导出所选 Excel
      </Button>
      <Button onClick={() => (recycleView ? setSelectedRecycleTaskRowKeys([]) : setSelectedTaskRowKeys([]))}>
        清空选择
      </Button>
    </Space>
  );

  const metadataFilterMode = (scopeType?: string) => {
    if (scopeType === "DATABASE_FULL") return "ALL";
    if (scopeType === "SCHEMA_FULL") return "SCHEMA_AND_TABLE";
    return "TABLE";
  };

  const buildMetadataPayloadFromValues = (
    values: SyncWizardValues,
    side: "source" | "target",
  ): SyncTaskMetadataDiscoveryPayload | null => {
    const datasourceId = side === "source" ? values.sourceDatasourceId : values.targetDatasourceId;
    if (!datasourceId) {
      return null;
    }
    const connectorType = side === "source" ? values.sourceConnectorType : values.targetConnectorType;
    /*
     * 元数据发现的职责是给向导提供“可选择的候选对象列表”，不是只验证当前已经选择的某一张表。
     * 新增任务和编辑任务必须共享这条规则：
     * - 当前已选的 schema/table 只用于本地筛选、高亮和恢复对象映射；
     * - 不再把 sourceSchemaName/sourceObjectName/targetSchemaName/targetObjectName 带到发现接口里做服务端过滤；
     * - MySQL/MariaDB 这类 catalog 语义的数据源尤其不能把“schema”当成过滤条件，否则编辑恢复时很容易把表列表筛空。
     *
     * 真实存在性校验仍然放在第四步预检查完成。这样用户回到编辑态时能看到完整候选，再由预检查判断
     * “目标 schema 是否存在、目标表是否存在、字段映射是否成立”，符合数据同步产品的配置-校验分层。
     */
    return compactPayload<SyncTaskMetadataDiscoveryPayload>({
      datasourceId,
      side: side === "source" ? "SOURCE" : "TARGET",
      connectorType,
      filterMode: metadataFilterMode(values.syncScopeType),
      includeColumns: true,
      includeViews: true,
      maxTables: METADATA_DISCOVERY_MAX_TABLES,
      maxColumnsPerTable: METADATA_DISCOVERY_MAX_COLUMNS_PER_TABLE,
    });
  };

  const buildMetadataPayload = (side: "source" | "target"): SyncTaskMetadataDiscoveryPayload | null => {
    const payload = buildMetadataPayloadFromValues(wizardForm.getFieldsValue(), side);
    if (!payload) {
      message.error(side === "source" ? "请先选择源端数据源" : "请先选择目标端数据源");
    }
    return payload;
  };

  const openWizard = () => {
    const session = sessionQuery.data?.data;
    const actorId = Number(session?.actorId);
    const projectId = Number(selectedProjectId ?? session?.authorizedProjectIds?.[0]);
    const selectedGroup = findGroupNode(taskGroupFilter);
    wizardForm.resetFields();
    wizardForm.setFieldsValue({
      tenantId: Number(session?.tenantId) || undefined,
      projectId: Number.isFinite(projectId) ? projectId : undefined,
      transferMode: "FULL_TRANSFER",
      objectScopeType: "TABLES",
      syncScopeType: "OBJECT_LIST",
      syncMode: "FULL",
      writeStrategy: "INSERT",
      priority: "MEDIUM",
      runMode: "MANUAL",
      ownerId: Number.isFinite(actorId) ? actorId : undefined,
      groupCode: selectedGroup?.groupCode,
      groupName: selectedGroup?.groupName,
    });
    setSourceDiscovery(null);
    setTargetDiscovery(null);
    setObjectMappings([]);
    setFieldMappings([]);
    setFieldMappingsByObjectKey({});
    setActiveObjectMappingKey(undefined);
    setWizardDraft(null);
    setWizardPrecheckResult(null);
    setBatchWhereCondition("");
    setSourceObjectKeyword("");
    setTargetObjectKeyword("");
    setSourceSchemaFilter(undefined);
    setTargetSchemaFilter(undefined);
    setSourceObjectPageSize(10);
    setTargetObjectPageSize(10);
    setMappingObjectPageSize(10);
    setFieldMappingPageSize(20);
    setActiveObjectEditor("FIELDS");
    setExcludedSourceObjects([]);
    setWizardStep(0);
    setWizardOpen(true);
  };

  const hydrateWizardMetadata = async (values: SyncWizardValues) => {
    const jobs: Array<Promise<void>> = [];
    const sourcePayload = buildMetadataPayloadFromValues(values, "source");
    if (sourcePayload) {
      jobs.push(
        api.discoverSyncTaskMetadata(sourcePayload).then((result) => setSourceDiscovery(result.data)),
      );
    }
    const targetPayload = buildMetadataPayloadFromValues(values, "target");
    if (targetPayload) {
      jobs.push(
        api.discoverSyncTaskMetadata(targetPayload).then((result) => setTargetDiscovery(result.data)),
      );
    }
    const settled = await Promise.allSettled(jobs);
    const failed = settled.filter((item) => item.status === "rejected");
    if (failed.length) {
      message.warning("草稿已恢复，但部分源端/目标端元数据刷新失败；可以继续编辑，第四步预检查会再次校验真实库表结构。");
    }
  };

  const openDraftWizard = async (task: SyncTask) => {
    setWizardSaving(true);
    try {
      const [freshTaskResult, templateResult] = await Promise.all([
        api.getSyncTask(task.id),
        api.getSyncTemplate(task.templateId),
      ]);
      const freshTask = freshTaskResult.data;
      const template = templateResult.data;
      const transferMode = transferModeFromSyncMode(template.syncMode);
      const syncScopeType = (template.syncScopeType || transferModeProfiles[transferMode].syncScopeType) as SyncWizardValues["syncScopeType"];
      const objectScopeType: ObjectScopeType = syncScopeType === "SCHEMA_FULL"
        ? "SCHEMA_FULL"
        : syncScopeType === "DATABASE_FULL"
          ? "DATABASE_FULL"
          : "TABLES";
      const fieldConfig = parseFieldMappingConfig(template.fieldMappingConfig);
      const objectConfigRows = parseObjectMappingsConfig(template.objectMappingConfig);
      const objectRows = fieldConfig.objectRows.length ? fieldConfig.objectRows : objectConfigRows;
      const customSqlText = parseCustomSqlConfig(template.customSqlConfig);
      const sourceConnectorType = template.sourceConnectorType
        || codeFromDataSourceType(dataSources.find((item) => item.id === template.sourceDatasourceId)?.type);
      const targetConnectorType = template.targetConnectorType
        || codeFromDataSourceType(dataSources.find((item) => item.id === template.targetDatasourceId)?.type);
      const wizardValues: SyncWizardValues = compactPayload({
        tenantId: freshTask.tenantId ?? template.tenantId,
        projectId: freshTask.projectId ?? template.projectId,
        transferMode,
        objectScopeType,
        syncScopeType,
        sourceDatasourceId: template.sourceDatasourceId,
        targetDatasourceId: template.targetDatasourceId,
        sourceConnectorType,
        targetConnectorType,
        sourceSchemaName: template.sourceSchemaName,
        sourceObjectName: template.sourceObjectName,
        targetSchemaName: template.targetSchemaName,
        targetObjectName: template.targetObjectName,
        syncMode: template.syncMode,
        writeStrategy: template.writeStrategy === "UPDATE" || template.writeStrategy === "MERGE" || template.writeStrategy === "UPSERT" ? "UPDATE" : "INSERT",
        customSqlText,
        filterConfig: template.filterConfig,
        groupCode: freshTask.groupCode,
        groupName: freshTask.groupName,
        taskName: freshTask.name,
        taskDescription: freshTask.description ?? template.description,
        priority: freshTask.priority || "MEDIUM",
        runMode: freshTask.runMode || transferModeProfiles[transferMode].runMode,
        scheduleConfig: freshTask.scheduleConfig,
        ownerId: freshTask.ownerId,
      });

      /*
       * 草稿续编的关键是“恢复创建向导现场”，而不是打开旧的任务定义编辑弹窗。
       * DRAFT 任务背后已有 SyncTask + SyncTemplate，两者分别承载运营属性和同步配置：
       * - SyncTask：任务名称、分组、负责人、调度配置、当前状态；
       * - SyncTemplate：源/目标数据源、传输模式、对象映射、字段映射、SQL、过滤条件。
       * 这里把两份快照重新组装回 wizardForm 与本地 mapping state，用户关闭页面后再次进入仍能从第二步/第三步继续。
       */
      wizardForm.resetFields();
      wizardForm.setFieldsValue(wizardValues);
      setSourceDiscovery(null);
      setTargetDiscovery(null);
      setObjectMappings(objectRows);
      setFieldMappings(fieldConfig.rows);
      setFieldMappingsByObjectKey(fieldConfig.rowsByObjectKey);
      setActiveObjectMappingKey(objectRows[0]?.key);
      setWizardDraft({ taskId: freshTask.id, templateId: template.id });
      setWizardPrecheckResult(null);
      setBatchWhereCondition("");
      setSourceObjectKeyword("");
      setTargetObjectKeyword("");
      setSourceSchemaFilter(undefined);
      setTargetSchemaFilter(undefined);
      setSourceObjectPageSize(10);
      setTargetObjectPageSize(10);
      setMappingObjectPageSize(10);
      setFieldMappingPageSize(20);
      setActiveObjectEditor("FIELDS");
      setExcludedSourceObjects([]);
      setWizardStep(objectRows.length || customSqlText ? 2 : 1);
      setWizardOpen(true);
      void hydrateWizardMetadata(wizardValues);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "草稿任务恢复失败，请稍后重试。");
    } finally {
      setWizardSaving(false);
    }
  };

  const openEditTask = (task: SyncTask) => {
    /*
     * “编辑任务”和“新建任务”必须进入同一套四步向导。
     * 如果已发布/已配置任务继续使用旧的小弹窗，只能改名称、分组、调度等运营字段，
     * 用户就无法按创建流程重新检查源表、目标表、字段映射、where 条件和预检查结果。
     * 这里统一通过 openDraftWizard 恢复 SyncTask + SyncTemplate 快照：
     * - DRAFT 任务是继续编辑草稿；
     * - CONFIGURED/SCHEDULED/FAILED 等可编辑任务是把既有定义重新带回向导修订；
     * - 保存仍走 create-wizard draft 接口，后端会根据 taskId/templateId 更新原任务与模板。
     */
    void openDraftWizard(task);
  };

  const openPublishTask = (task: SyncTask) => {
    setPublishTask(task);
    publishForm.setFieldsValue({
      enableSchedule: Boolean(task.scheduleConfig),
      reason: "前端发布同步任务定义",
    });
  };

  const openGroupTask = (task: SyncTask) => {
    setGroupTask(task);
    groupForm.setFieldsValue({
      groupCode: task.groupCode,
      groupName: task.groupName,
      reason: "前端调整同步任务分组",
    });
  };

  const openCloneTask = (task: SyncTask) => {
    setCloneTask(task);
    cloneForm.setFieldsValue({
      name: `${task.name}-副本`,
      description: task.description,
      ownerId: task.ownerId,
      groupCode: task.groupCode,
      groupName: task.groupName,
      keepScheduleConfig: false,
      runImmediately: false,
    });
  };

  const applyTransferMode = (value: keyof typeof transferModeProfiles) => {
    const profile = transferModeProfiles[value];
    wizardForm.setFieldsValue({
      transferMode: value,
      syncMode: profile.syncMode,
      syncScopeType: profile.syncScopeType,
      objectScopeType: profile.objectScopeType,
      runMode: profile.runMode,
      scheduleConfig: profile.runMode === "SCHEDULED" ? '{"cron":"0 0 2 * * ?","timezone":"Asia/Shanghai"}' : undefined,
    });
    setFieldMappings([]);
    setObjectMappings([]);
    setFieldMappingsByObjectKey({});
    setActiveObjectMappingKey(undefined);
    setActiveObjectEditor("FIELDS");
    setWizardDraft(null);
    setWizardPrecheckResult(null);
    setExcludedSourceObjects([]);
    setSourceObjectKeyword("");
    setTargetObjectKeyword("");
    setSourceSchemaFilter(undefined);
    setTargetSchemaFilter(undefined);
    setSourceObjectPageSize(10);
    setTargetObjectPageSize(10);
  };

  const applyObjectScopeType = (value: ObjectScopeType) => {
    wizardForm.setFieldsValue({
      objectScopeType: value,
      syncScopeType: value === "SCHEMA_FULL" ? "SCHEMA_FULL" : value === "DATABASE_FULL" ? "DATABASE_FULL" : "OBJECT_LIST",
      sourceObjectName: undefined,
      targetObjectName: undefined,
      sourceTableIndex: undefined,
      targetTableIndex: undefined,
    });
    setFieldMappings([]);
    setObjectMappings([]);
    setFieldMappingsByObjectKey({});
    setActiveObjectMappingKey(undefined);
    setActiveObjectEditor("FIELDS");
    setWizardPrecheckResult(null);
    setExcludedSourceObjects([]);
    setSourceObjectKeyword("");
    setTargetObjectKeyword("");
    setSourceSchemaFilter(undefined);
    setTargetSchemaFilter(undefined);
    setSourceObjectPageSize(10);
    setTargetObjectPageSize(10);
  };
  const selectDatasource = (field: "sourceDatasourceId" | "targetDatasourceId", id: number) => {
    const record = dataSources.find((item) => item.id === id);
    const connectorCode = codeFromDataSourceType(record?.type);
    if (field === "sourceDatasourceId") {
      wizardForm.setFieldsValue({ sourceDatasourceId: id, sourceConnectorType: connectorCode || undefined });
      setSourceDiscovery(null);
      setObjectMappings([]);
      setFieldMappings([]);
      setFieldMappingsByObjectKey({});
      setActiveObjectMappingKey(undefined);
      setActiveObjectEditor("FIELDS");
      setWizardPrecheckResult(null);
      setSourceObjectKeyword("");
      setSourceSchemaFilter(undefined);
      setSourceObjectPageSize(10);
    } else {
      wizardForm.setFieldsValue({ targetDatasourceId: id, targetConnectorType: connectorCode || undefined });
      setTargetDiscovery(null);
      setObjectMappings([]);
      setFieldMappings([]);
      setFieldMappingsByObjectKey({});
      setActiveObjectMappingKey(undefined);
      setActiveObjectEditor("FIELDS");
      setWizardPrecheckResult(null);
      setTargetObjectKeyword("");
      setTargetSchemaFilter(undefined);
      setTargetObjectPageSize(10);
    }
  };

  const discoverMetadataAsync = async (side: "source" | "target") => {
    const payload = buildMetadataPayload(side);
    if (!payload) return undefined;
    if (side === "source") {
      const result = await discoverSourceMutation.mutateAsync(payload);
      return result.data;
    }
    const result = await discoverTargetMutation.mutateAsync(payload);
    return result.data;
  };

  const ensureMetadataDiscovered = async () => {
    const values = wizardForm.getFieldsValue();
    const discoveredSnapshot = {
      sourceDiscovery,
      targetDiscovery,
    };
    const tasks: Array<{ side: "source" | "target"; promise: Promise<unknown> }> = [];
    if (values.sourceDatasourceId && !sourceDiscovery) {
      tasks.push({ side: "source", promise: discoverMetadataAsync("source") });
    }
    if (values.targetDatasourceId && !targetDiscovery) {
      tasks.push({ side: "target", promise: discoverMetadataAsync("target") });
    }
    if (tasks.length) {
      /*
       * 源端和目标端元数据发现仍然并发执行，这样不会因为一个慢数据源拖住另一个数据源。
       * 但错误提示不能再由两个 mutation 各自弹 toast：如果同一个后端上下文错误同时影响源端和目标端，
       * 用户会看到两条完全一样的报错，误以为系统触发了两次保存。
       *
       * 这里使用 allSettled 汇总结果，成功的发现照常写入 state，失败的发现统一由 goNextWizardStep 的 catch
       * 弹出一条“源端/目标端分别失败在哪里”的诊断文本。这样既保留并发效率，又让交互表现像一个原子步骤。
       */
      const settled = await Promise.allSettled(tasks.map((task) => task.promise));
      settled.forEach((result, index) => {
        if (result.status !== "fulfilled") {
          return;
        }
        if (tasks[index].side === "source") {
          discoveredSnapshot.sourceDiscovery = result.value as SyncTaskMetadataDiscoveryResult;
        } else {
          discoveredSnapshot.targetDiscovery = result.value as SyncTaskMetadataDiscoveryResult;
        }
      });
      const failures = settled
        .map((result, index) => {
          if (result.status === "fulfilled") {
            return undefined;
          }
          const sideLabel = tasks[index].side === "source" ? "源端" : "目标端";
          const reason = result.reason instanceof Error ? result.reason.message : String(result.reason || "未知错误");
          return `${sideLabel}: ${reason}`;
        })
        .filter((item): item is string => Boolean(item));
      if (failures.length) {
        throw new Error(`元数据发现失败：${failures.join("；")}`);
      }
    }
    return discoveredSnapshot;
  };

  const buildObjectMappingFromTables = (
    sourceTable: SyncTaskMetadataTable | undefined,
    sourceIndex?: string,
    targetTable?: SyncTaskMetadataTable,
    targetIndex?: string,
  ): ObjectMappingRow | undefined => {
    if (!sourceTable) return undefined;
    /*
     * 对象映射只能在“明确知道目标表是哪一张”时自动写入目标端信息。
     * 之前这里会回退读取 wizardForm 中上一次选择的 targetSchemaName/targetObjectName，
     * 多选源表时就会把“上一次目标端点击过的表”误套到新勾选的源表上，看起来像随机填入。
     *
     * 商用数据同步产品里，自动映射必须可解释、可审计：
     * - 有同名目标表：可以自动预填目标 schema/table，帮助用户少录入；
     * - 没有同名目标表：保持空白，让用户在已选映射列表中手工编辑，第四步预检查再判断是否存在。
     * 因此本函数不再使用表单历史值做兜底，避免把“记忆中的上一次选择”伪装成系统推断。
     */
    return {
      key: tableObjectKey(sourceTable, Number(sourceIndex ?? 0)),
      sourceTableIndex: sourceIndex,
      targetTableIndex: targetIndex,
      sourceSchemaName: sourceTable.schemaName,
      sourceObjectName: sourceTable.tableName,
      targetSchemaName: targetTable?.schemaName,
      targetObjectName: targetTable?.tableName,
      objectType: sourceTable.tableType || "TABLE",
    };
  };

  const findSameNameTargetTable = (sourceTable: SyncTaskMetadataTable | undefined) => {
    if (!sourceTable) {
      return undefined;
    }
    const preferredTargetSchema = (targetSchemaFilter || wizardForm.getFieldValue("targetSchemaName") || "").toLowerCase();
    const sourceSchema = (sourceTable.schemaName || "").toLowerCase();
    const sameNameTargets = (targetDiscovery?.tables ?? [])
      .map((table, index) => ({ table, index: String(index) }))
      .filter(({ table }) => table.tableName.toLowerCase() === sourceTable.tableName.toLowerCase());
    if (!sameNameTargets.length) {
      return undefined;
    }
    /*
     * 同名匹配的优先级：
     * 1. 用户当前在目标端点选的 schema 中存在同名表，优先认为用户希望映射到该命名空间；
     * 2. 目标端存在与源端 schema 同名的 schema，优先保持 schema 语义一致；
     * 3. 仍有同名表但 schema 不同，选择发现结果里的第一张同名表，后续预检查和用户编辑可继续确认。
     * 关键点是：所有分支都必须满足“表名同名”，不能用目标 schema 下第一张表、上一次选中表或源表名强行兜底。
     */
    return sameNameTargets.find(({ table }) => preferredTargetSchema && (table.schemaName || "").toLowerCase() === preferredTargetSchema)
      ?? sameNameTargets.find(({ table }) => sourceSchema && (table.schemaName || "").toLowerCase() === sourceSchema)
      ?? sameNameTargets[0];
  };

  const upsertObjectMapping = (mapping: ObjectMappingRow) => {
    setObjectMappings((rows) => {
      const exists = rows.some((row) => row.key === mapping.key);
      return exists ? rows.map((row) => (row.key === mapping.key ? { ...row, ...mapping } : row)) : [...rows, mapping];
    });
  };

  const removeObjectMapping = (key: string) => {
    setObjectMappings((rows) => rows.filter((row) => row.key !== key));
    setFieldMappingsByObjectKey((rows) => {
      const nextRows = { ...rows };
      delete nextRows[key];
      return nextRows;
    });
  };

  const applySourceTable = (index: string) => {
    const sourceTable = findTable(sourceDiscovery, index);
    const matchedTarget = findSameNameTargetTable(sourceTable);
    const targetTable = matchedTarget?.table;
    wizardForm.setFieldsValue({
      sourceTableIndex: index,
      sourceSchemaName: sourceTable?.schemaName,
      sourceObjectName: sourceTable?.tableName,
      targetTableIndex: matchedTarget?.index,
      targetSchemaName: matchedTarget?.table.schemaName,
      targetObjectName: matchedTarget?.table.tableName,
    });
    const mapping = buildObjectMappingFromTables(sourceTable, index, targetTable, matchedTarget?.index);
    if (mapping) {
      setObjectMappings([mapping]);
      setActiveObjectMappingKey(mapping.key);
      setActiveObjectEditor("FIELDS");
      setFieldMappingsByObjectKey({ [mapping.key]: makeFieldMappings(sortedColumns(sourceTable), sortedColumns(targetTable)) });
    }
    const mappings = makeFieldMappings(sortedColumns(sourceTable), sortedColumns(targetTable));
    setFieldMappings(mappings);
  };

  const applyTargetTable = (index: string) => {
    const sourceTable = findTable(sourceDiscovery, wizardForm.getFieldValue("sourceTableIndex"));
    const targetTable = findTable(targetDiscovery, index);
    wizardForm.setFieldsValue({
      targetTableIndex: index,
      targetSchemaName: targetTable?.schemaName,
      targetObjectName: targetTable?.tableName,
    });
    const mapping = buildObjectMappingFromTables(sourceTable, wizardForm.getFieldValue("sourceTableIndex"), targetTable, index);
    if (mapping) {
      const activeKey = activeObjectMappingKey ?? objectMappings[0]?.key;
      if (activeKey && objectMappings.length > 1) {
        setObjectMappings((rows) => rows.map((row) => row.key === activeKey ? { ...row, ...mapping, key: row.key, sourceTableIndex: row.sourceTableIndex, sourceSchemaName: row.sourceSchemaName, sourceObjectName: row.sourceObjectName } : row));
        setFieldMappingsByObjectKey((rows) => ({
          ...rows,
          [activeKey]: makeFieldMappings(
            sortedColumns(findTable(sourceDiscovery, objectMappings.find((row) => row.key === activeKey)?.sourceTableIndex)),
            sortedColumns(targetTable),
          ),
        }));
      } else {
        setObjectMappings([mapping]);
        setActiveObjectMappingKey(mapping.key);
        setActiveObjectEditor("FIELDS");
      }
    }
    setFieldMappings(makeFieldMappings(sortedColumns(sourceTable), sortedColumns(targetTable)));
  };

  const toggleSourceObjectMapping = (index: string, checked: boolean) => {
    const sourceTable = findTable(sourceDiscovery, index);
    if (!sourceTable) return;
    const key = tableObjectKey(sourceTable, Number(index));
    if (!checked) {
      removeObjectMapping(key);
      return;
    }
    const matchedTarget = findSameNameTargetTable(sourceTable);
    const mapping: ObjectMappingRow = buildObjectMappingFromTables(sourceTable, index, matchedTarget?.table, matchedTarget?.index) ?? {
      key,
      sourceTableIndex: index,
      targetTableIndex: undefined,
      sourceSchemaName: sourceTable.schemaName,
      sourceObjectName: sourceTable.tableName,
      objectType: sourceTable.tableType || "TABLE",
    };
    upsertObjectMapping(mapping);
    setActiveObjectMappingKey(mapping.key);
    setActiveObjectEditor("FIELDS");
    setFieldMappingsByObjectKey((rows) => ({
      ...rows,
      [mapping.key]: rows[mapping.key] ?? makeFieldMappings(sortedColumns(sourceTable), sortedColumns(matchedTarget?.table)),
    }));
    if (!objectMappings.length) {
      wizardForm.setFieldsValue({
        sourceTableIndex: index,
        targetTableIndex: mapping.targetTableIndex,
        sourceSchemaName: mapping.sourceSchemaName,
        sourceObjectName: mapping.sourceObjectName,
        targetSchemaName: mapping.targetSchemaName,
        targetObjectName: mapping.targetObjectName,
      });
      setFieldMappings(makeFieldMappings(sortedColumns(sourceTable), sortedColumns(matchedTarget?.table)));
    }
  };

  const addSourceSchemaTables = (schemaName?: string) => {
    /*
     * “按 Schema 传输”和“按 Schema + 表混合选择”最终都要让用户能看到每一张实际参与同步的表。
     * 因此前端在选择 schema 后会把该 schema 下当前元数据发现到的表展开成多条 ObjectMappingRow：
     * - 用户删除某一行，就等价于从 schema 迁移范围中排除该表；
     * - 用户还可以继续单独勾选另一个 schema 中的表，从而形成“schema 全量 + 零散表”的混合迁移；
     * - 后端收到的仍然是 OBJECT_LIST，不需要新增一个难以审计的新同步模式。
     */
    const sourceTables = (sourceDiscovery?.tables ?? [])
      .map((table, index) => ({ table, index: String(index) }))
      .filter(({ table }) => !schemaName || table.schemaName === schemaName);
    if (!sourceTables.length) {
      message.warning(schemaName ? `当前源端元数据中未发现 Schema ${schemaName} 下的表` : "当前源端元数据中没有可加入的表");
      return;
    }
    const nextMappings = sourceTables.map(({ table, index }) => {
      const matchedTarget = findSameNameTargetTable(table);
      return {
        key: tableObjectKey(table, Number(index)),
        sourceTableIndex: index,
        targetTableIndex: matchedTarget?.index,
        sourceSchemaName: table.schemaName,
        sourceObjectName: table.tableName,
        targetSchemaName: matchedTarget?.table.schemaName,
        targetObjectName: matchedTarget?.table.tableName,
        objectType: table.tableType || "TABLE",
      } satisfies ObjectMappingRow;
    });
    setObjectMappings((rows) => {
      const existing = new Map(rows.map((row) => [row.key, row]));
      nextMappings.forEach((mapping) => existing.set(mapping.key, { ...existing.get(mapping.key), ...mapping }));
      return Array.from(existing.values());
    });
    setFieldMappingsByObjectKey((rows) => {
      const nextRows = { ...rows };
      nextMappings.forEach((mapping) => {
        nextRows[mapping.key] = nextRows[mapping.key] ?? makeFieldMappingsForObject(mapping);
      });
      return nextRows;
    });
    const firstMapping = nextMappings[0];
    if (firstMapping) {
      setActiveObjectMappingKey(firstMapping.key);
      setActiveObjectEditor("FIELDS");
      wizardForm.setFieldsValue({
        sourceSchemaName: firstMapping.sourceSchemaName,
        targetSchemaName: firstMapping.targetSchemaName,
        sourceTableIndex: firstMapping.sourceTableIndex,
        sourceObjectName: firstMapping.sourceObjectName,
        targetTableIndex: firstMapping.targetTableIndex,
        targetObjectName: firstMapping.targetObjectName,
      });
    }
  };

  const selectSourceSchema = (schemaName?: string) => {
    setSourceSchemaFilter(schemaName);
    wizardForm.setFieldsValue({ sourceSchemaName: schemaName, sourceObjectName: undefined, sourceTableIndex: undefined });
    setSourceObjectPageSize(10);
  };

  const selectTargetSchema = (schemaName?: string) => {
    setTargetSchemaFilter(schemaName);
    wizardForm.setFieldsValue({ targetSchemaName: schemaName, targetObjectName: undefined, targetTableIndex: undefined });
    setTargetObjectPageSize(10);
  };

  const applyTargetSchemaToMappings = (schemaName?: string) => {
    if (!schemaName) {
      message.warning("请先选择目标端 Schema");
      return;
    }
    setObjectMappings((rows) => rows.map((row) => ({ ...row, targetSchemaName: schemaName })));
    wizardForm.setFieldsValue({ targetSchemaName: schemaName });
  };

  const clearObjectSelections = () => {
    setObjectMappings([]);
    setFieldMappingsByObjectKey({});
    setActiveObjectMappingKey(undefined);
    setActiveObjectEditor("FIELDS");
    setExcludedSourceObjects([]);
  };

  const checkCustomSql = () => {
    const sql = wizardForm.getFieldValue("customSqlText")?.trim();
    if (!sql) {
      message.error("请先输入只读 SQL");
      return;
    }
    const normalized = sql.toLowerCase();
    if (!normalized.startsWith("select") || /\b(insert|update|delete|drop|truncate|alter|create)\b/i.test(sql)) {
      message.error("SQL 语句模式只允许只读 SELECT");
      return;
    }
    const knownTableNames = new Set((sourceDiscovery?.tables ?? []).map((table) => table.tableName.toLowerCase()));
    const referencedTables: string[] = [];
    const tablePattern = /\b(?:from|join)\s+([\w.]+)/gi;
    let tableMatch: RegExpExecArray | null = tablePattern.exec(sql);
    while (tableMatch) {
      const tableName = tableMatch[1]?.split(".").pop()?.toLowerCase();
      if (tableName) {
        referencedTables.push(tableName);
      }
      tableMatch = tablePattern.exec(sql);
    }
    const missing = referencedTables.filter((table) => !knownTableNames.has(table));
    if (knownTableNames.size && missing.length) {
      message.warning(`语法看起来可用，但源端元数据中未发现表：${Array.from(new Set(missing)).join("、")}`);
      return;
    }
    message.success("SQL 基础语法和表名存在性检查通过；提交后仍会执行后端 SQL 只读校验和权限审计");
  };
  const localPrecheckIssues = () => {
    const values = wizardForm.getFieldsValue();
    const submitScopeType = resolveSubmitSyncScopeType(values);
    const sqlMode = submitScopeType === "CUSTOM_SQL_QUERY";
    const targetRequiresSchema = !isMysqlLikeConnector(values.targetConnectorType);
    const issues: Array<{ level: "error" | "warning" | "success"; text: string }> = [];
    if (!values.sourceDatasourceId || !values.targetDatasourceId) {
      issues.push({ level: "error", text: "必须选择源端和目标端数据源。" });
    }
    if (values.sourceDatasourceId && values.sourceDatasourceId === values.targetDatasourceId) {
      issues.push({ level: "error", text: "源端和目标端数据源不能相同。" });
    }
    if (!sqlMode && values.objectScopeType !== "DATABASE_FULL" && !objectMappings.length) {
      issues.push({ level: "error", text: "请至少选择一张源端表；按 Schema 传输也需要先把 Schema 下的表展开到对象映射清单中。" });
    }
    if (!sqlMode && targetRequiresSchema && objectMappings.some((mapping) => !mapping.targetSchemaName?.trim())) {
      issues.push({ level: "error", text: "目标端为 PostgreSQL/SQL Server 等有 Schema 命名空间的数据源时，每条目标映射都必须填写目标 Schema；MySQL/MariaDB 不需要填写。" });
    }
    if (sqlMode && targetRequiresSchema && !values.targetSchemaName?.trim()) {
      issues.push({ level: "error", text: "SQL 语句模式写入 PostgreSQL/SQL Server 目标表时必须填写目标 Schema。" });
    }
    const allFieldRows = objectMappings.length
      ? objectMappings.flatMap((mapping) => fieldMappingsByObjectKey[mapping.key] ?? [])
      : fieldMappings;
    const enabledMappings = allFieldRows.filter((row) => row.syncEnabled !== false);
    const requiresFieldMapping = submitScopeType === "SINGLE_OBJECT" || sqlMode;
    if (requiresFieldMapping && !enabledMappings.length) {
      issues.push({ level: "warning", text: "字段映射尚未形成可执行的源字段到目标字段关系；服务端预检查会继续判断是否允许目标表默认值/NULL 兜底。" });
    }
    if (requiresFieldMapping && enabledMappings.some((row) => !row.sourceField || !row.targetField)) {
      issues.push({ level: "error", text: "字段映射中存在未填写的源字段或目标字段。" });
    }
    if (enabledMappings.some((row) => row.typeCompatible === false)) {
      issues.push({ level: "warning", text: "字段映射中存在类型不兼容提示，请确认是否需要转换或取消同步。" });
    }
    if (sqlMode && !values.customSqlText?.trim()) {
      issues.push({ level: "error", text: "SQL 语句模式必须填写只读 SQL。" });
    }
    if (sqlMode && !values.targetObjectName?.trim()) {
      issues.push({ level: "error", text: "SQL 语句模式必须声明目标端表/对象名。" });
    }
    if (compatibility && !compatibility.supported) {
      issues.push({ level: "error", text: `连接器兼容性未通过：${compatibility.issueCodes.join(", ") || "未知原因"}` });
    }
    if (!sourceDiscovery) {
      issues.push({ level: "warning", text: "尚未发现源端元数据；可以手工配置，但无法自动辅助字段映射。" });
    }
    if (!targetDiscovery) {
      issues.push({ level: "warning", text: "尚未发现目标端元数据；可以手工配置，但无法校验目标字段是否存在。" });
    }
    if (!issues.some((item) => item.level === "error")) {
      issues.push({ level: "success", text: "前端预检查通过；提交后仍会执行服务端校验、规划预览、执行预检和离线作业计划生成。" });
    }
    return issues;
  };

  const canSubmitWizard = !localPrecheckIssues().some((issue) => issue.level === "error");

  const validateWizardStep = async (step: number) => {
    if (step === 0) {
      const values = await wizardForm.validateFields(["taskName", "transferMode", "sourceDatasourceId", "targetDatasourceId"]);
      if (values.sourceDatasourceId && values.sourceDatasourceId === values.targetDatasourceId) {
        throw new Error("源端和目标端数据源不能相同");
      }
      return;
    }
    const values = wizardForm.getFieldsValue();
    const sqlMode = values.syncMode === "CUSTOM_SQL_QUERY";
    const targetRequiresSchema = !isMysqlLikeConnector(values.targetConnectorType);
    if (step === 1) {
      if (sqlMode) {
        await wizardForm.validateFields(targetRequiresSchema ? ["targetSchemaName", "targetObjectName"] : ["targetObjectName"]);
        return;
      }
      if (values.objectScopeType === "DATABASE_FULL") {
        if (targetRequiresSchema && !values.targetSchemaName?.trim()) {
          throw new Error("目标端为 PostgreSQL/SQL Server 时，全库/全范围传输也必须填写目标 Schema。");
        }
        return;
      }
      if (!objectMappings.length) {
        throw new Error("请至少选择一张源端表；按 Schema 传输请先加入该 Schema 下的表");
      }
      const missingTargetSchema = objectMappings.find((mapping) => !mapping.targetSchemaName?.trim());
      if (targetRequiresSchema && missingTargetSchema) {
        throw new Error(`目标映射 ${missingTargetSchema.targetObjectName || missingTargetSchema.sourceObjectName || "未命名表"} 缺少目标 Schema；PostgreSQL/SQL Server 必填，MySQL/MariaDB 不需要。`);
      }
      return;
    }
    if (step === 2) {
      const submitScopeType = resolveSubmitSyncScopeType(values);
      if (submitScopeType === "CUSTOM_SQL_QUERY") {
        await wizardForm.validateFields(["customSqlText"]);
      }
    }
  };

  const goNextWizardStep = async () => {
    try {
      await validateWizardStep(wizardStep);
      const discoverySnapshot = wizardStep <= 2
        ? await ensureMetadataDiscovered()
        : { sourceDiscovery, targetDiscovery };
      const stepCodes = ["SOURCE_TARGET", "OBJECT_MAPPING", "FIELD_SQL", "PRECHECK"];
      await saveWizardDraft(stepCodes[wizardStep] ?? "SOURCE_TARGET", discoverySnapshot);
      const nextStep = Math.min(stepItems.length - 1, wizardStep + 1);
      setWizardStep(nextStep);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "请先补齐当前步骤必填项");
    }
  };
  const submitWizard = async () => {
    await wizardForm.validateFields();
    const discoverySnapshot = await ensureMetadataDiscovered();
    const draft = await saveWizardDraft("PRECHECK", discoverySnapshot);
    const blockingIssues = localPrecheckIssues().filter((issue) => issue.level === "error");
    if (blockingIssues.length) {
      message.error(blockingIssues[0].text);
      setWizardStep(3);
      return;
    }
    await runWizardAutoPrecheck(draft.templateId);
  };

  const updateMapping = (key: string, patch: Partial<FieldMappingRow>) => {
    if (!sqlTransferMode && activeObjectMapping) {
      setFieldMappingsByObjectKey((rows) => {
        const currentRows = rows[activeObjectMapping.key] ?? makeFieldMappings(sortedColumns(activeSourceTable), sortedColumns(activeTargetTable));
        return {
          ...rows,
          [activeObjectMapping.key]: currentRows.map((row) => (row.key === key ? { ...row, ...patch } : row)),
        };
      });
      return;
    }
    setFieldMappings((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const addMapping = () => {
    if (!sqlTransferMode && activeObjectMapping) {
      setFieldMappingsByObjectKey((rows) => ({
        ...rows,
        [activeObjectMapping.key]: [
          ...(rows[activeObjectMapping.key] ?? makeFieldMappings(sortedColumns(activeSourceTable), sortedColumns(activeTargetTable))),
          { key: `manual-${Date.now()}`, sourceField: "", targetField: "" },
        ],
      }));
      return;
    }
    setFieldMappings((rows) => [
      ...rows,
      { key: `manual-${Date.now()}`, sourceField: "", targetField: "" },
    ]);
  };

  const removeMapping = (key: string) => {
    if (!sqlTransferMode && activeObjectMapping) {
      setFieldMappingsByObjectKey((rows) => ({
        ...rows,
        [activeObjectMapping.key]: (rows[activeObjectMapping.key] ?? []).filter((row) => row.key !== key),
      }));
      return;
    }
    setFieldMappings((rows) => rows.filter((row) => row.key !== key));
  };

  const openRecoveryModal = (task: SyncTask, action: "replay" | "backfill") => {
    setRecoveryTask(task);
    setRecoveryAction(action);
    recoveryForm.setFieldsValue({
      sourceExecutionId: task.lastExecutionId,
      reason: action === "replay" ? "人工发起历史回放" : "人工发起历史补数",
    });
  };

  const refetchAll = () =>
    void Promise.all([
      dataSourceQuery.refetch(),
      capabilityQuery.refetch(),
      templateQuery.refetch(),
      taskQuery.refetch(),
      taskGroupQuery.refetch(),
      taskGroupTreeQuery.refetch(),
      recycleBinQuery.refetch(),
      incidentQuery.refetch(),
      selectedTask ? executionQuery.refetch() : Promise.resolve(),
      selectedTask && selectedExecutionId ? objectExecutionQuery.refetch() : Promise.resolve(),
      selectedTask && selectedExecutionId ? executionLogQuery.refetch() : Promise.resolve(),
      selectedTask ? errorSampleQuery.refetch() : Promise.resolve(),
      selectedTask ? checkpointQuery.refetch() : Promise.resolve(),
      selectedTask ? auditQuery.refetch() : Promise.resolve(),
    ]);

  const currentSession = sessionQuery.data?.data;
  const currentProjectId = selectedProjectId ?? currentSession?.authorizedProjectIds?.[0];
  const currentProject = currentSession?.authorizedProjects?.find((project) => String(project.projectId ?? project.id) === String(currentProjectId));
  const currentProjectLabel = currentProject?.projectName ?? currentProject?.name ?? currentSession?.projectName ?? (currentProjectId == null ? "未选择项目" : `项目 ${currentProjectId}`);
  const scopedProjectId = isNumericScopeValue(selectedProjectId) ? String(selectedProjectId) : undefined;

  const matchCurrentDatasourceScope = (record: (typeof dataSources)[number]) => {
    return !scopedProjectId || record.projectId == null || String(record.projectId) === scopedProjectId;
  };

  const dataSourceOptionLabel = (record: (typeof dataSources)[number]) =>
    `${record.name} · ${record.type} · ${labelOf(record.usageRole || "SOURCE", dataSourceUsageLabels)}`;
  const sourceDataSourceOptions = dataSources
    .filter(matchCurrentDatasourceScope)
    .filter((record) => record.usageRole === "SOURCE")
    .map((record) => ({ value: record.id, label: dataSourceOptionLabel(record) }));
  const targetDataSourceOptions = dataSources
    .filter(matchCurrentDatasourceScope)
    .filter((record) => record.usageRole === "TARGET")
    .map((record) => ({ value: record.id, label: dataSourceOptionLabel(record) }));

  const sourceObjectRows = filterMetadataTables(sourceDiscovery, sourceObjectKeyword, sourceSchemaFilter);
  const targetObjectRows = filterMetadataTables(targetDiscovery, targetObjectKeyword, targetSchemaFilter);
  const sourceSchemaOptions = metadataSchemas(sourceDiscovery);
  const targetSchemaOptions = metadataSchemas(targetDiscovery);
  const currentSyncScopeType = wizardForm.getFieldValue("syncScopeType") as SyncWizardValues["syncScopeType"] | undefined;
  const currentSyncMode = wizardForm.getFieldValue("syncMode") as string | undefined;
  const currentObjectScopeType = (wizardForm.getFieldValue("objectScopeType") || "TABLES") as ObjectScopeType;
  const sqlTransferMode = currentSyncScopeType === "CUSTOM_SQL_QUERY" || currentSyncMode === "CUSTOM_SQL_QUERY";
  const sourceSchemaCapable = !isMysqlLikeConnector(wizardForm.getFieldValue("sourceConnectorType"));
  const targetSchemaCapable = !isMysqlLikeConnector(wizardForm.getFieldValue("targetConnectorType"));
  const availableObjectScopeOptions = sourceSchemaCapable
    ? objectScopeOptions
    : objectScopeOptions.filter((option) => option.value === "TABLES");
  const databaseTransferMode = !sqlTransferMode && currentObjectScopeType === "DATABASE_FULL";
  const schemaObjectSelectionMode = !sqlTransferMode && (currentObjectScopeType === "SCHEMA_FULL" || currentObjectScopeType === "SCHEMA_AND_TABLES");
  const objectListTransferMode = !sqlTransferMode && currentObjectScopeType !== "DATABASE_FULL";
  const fieldMappingTransferMode = sqlTransferMode || currentObjectScopeType !== "DATABASE_FULL";
  const selectedObjectMappingKeys = objectMappings.map((mapping) => mapping.key);
  const activeObjectMapping = objectMappings.find((mapping) => mapping.key === activeObjectMappingKey) ?? objectMappings[0];

  useEffect(() => {
    if (!sqlTransferMode && !sourceSchemaCapable && currentObjectScopeType !== "TABLES") {
      applyObjectScopeType("TABLES");
    }
  }, [currentObjectScopeType, sourceSchemaCapable, sqlTransferMode]);

  const findMetadataTableForMapping = (
    discovery: SyncTaskMetadataDiscoveryResult | null,
    tableIndex?: string,
    schemaName?: string,
    objectName?: string,
  ) => {
    const byIndex = findTable(discovery, tableIndex);
    if (byIndex) return byIndex;
    if (!objectName) return undefined;
    return (discovery?.tables ?? []).find(
      (table) =>
        table.tableName.toLowerCase() === objectName.toLowerCase()
        && (!schemaName || !table.schemaName || table.schemaName.toLowerCase() === schemaName.toLowerCase()),
    );
  };

  const makeFieldMappingsForObject = (
    mapping: ObjectMappingRow,
    sourceDiscoverySnapshot: SyncTaskMetadataDiscoveryResult | null | undefined = sourceDiscovery,
    targetDiscoverySnapshot: SyncTaskMetadataDiscoveryResult | null | undefined = targetDiscovery,
  ) => {
    const sourceTable = findMetadataTableForMapping(
      sourceDiscoverySnapshot ?? null,
      mapping.sourceTableIndex,
      mapping.sourceSchemaName,
      mapping.sourceObjectName,
    );
    const targetTable = findMetadataTableForMapping(
      targetDiscoverySnapshot ?? null,
      mapping.targetTableIndex,
      mapping.targetSchemaName,
      mapping.targetObjectName,
    );
    return makeFieldMappings(sortedColumns(sourceTable), sortedColumns(targetTable));
  };

  const ensureFieldMappingsForObject = (mapping: ObjectMappingRow, forceWhenEmpty = false) => {
    /*
     * 字段映射页的业务主线是“源端字段驱动同步配置”。
     * 早期草稿里可能已经保存了 objectMappings，但每个对象的 mappings 为空数组；
     * 如果页面只读取这个空数组，就会出现用户点击“设置字段映射”后仍然暂无数据的体验。
     * 因此激活某个对象配置字段时，会基于该对象对应的源表元数据生成默认行：
     * - 源字段、源类型、主键、可空性来自源端真实表；
     * - 目标端只在发现同名字段时自动预填；
     * - 目标端不存在同名字段时保持未勾选，后续由用户选择或交给预检查判断。
     */
    setFieldMappingsByObjectKey((rows) => {
      const existingRows = rows[mapping.key];
      if (existingRows && (existingRows.length > 0 || !forceWhenEmpty)) {
        return rows;
      }
      return {
        ...rows,
        [mapping.key]: makeFieldMappingsForObject(mapping),
      };
    });
  };

  const activateObjectMappingEditor = (mapping: ObjectMappingRow, editor: "FIELDS" | "WHERE") => {
    setActiveObjectMappingKey(mapping.key);
    setActiveObjectEditor(editor);
    if (editor === "FIELDS") {
      ensureFieldMappingsForObject(mapping, true);
    }
  };

  const activeSourceTable = activeObjectMapping
    ? findMetadataTableForMapping(sourceDiscovery, activeObjectMapping.sourceTableIndex, activeObjectMapping.sourceSchemaName, activeObjectMapping.sourceObjectName)
    : findMetadataTableForMapping(sourceDiscovery, wizardForm.getFieldValue("sourceTableIndex"), wizardForm.getFieldValue("sourceSchemaName"), wizardForm.getFieldValue("sourceObjectName"));
  const activeTargetTable = activeObjectMapping
    ? findMetadataTableForMapping(targetDiscovery, activeObjectMapping.targetTableIndex, activeObjectMapping.targetSchemaName, activeObjectMapping.targetObjectName)
    : findMetadataTableForMapping(targetDiscovery, wizardForm.getFieldValue("targetTableIndex"), wizardForm.getFieldValue("targetSchemaName"), wizardForm.getFieldValue("targetObjectName"));
  const storedActiveFieldMappings = activeObjectMapping ? fieldMappingsByObjectKey[activeObjectMapping.key] : undefined;
  const activeFieldMappings = !sqlTransferMode && activeObjectMapping
    ? (storedActiveFieldMappings && storedActiveFieldMappings.length > 0
        ? storedActiveFieldMappings
        : makeFieldMappingsForObject(activeObjectMapping))
    : fieldMappings;

  useEffect(() => {
    if (!wizardOpen || sqlTransferMode || !objectMappings.length) {
      return;
    }
    /*
     * 编辑恢复时，objectMappings 会先从模板快照恢复，sourceDiscovery/targetDiscovery 则是异步请求回来。
     * 如果用户在元数据返回前直接进入预检查，字段映射 state 可能仍是空数组，导致后端误判“未形成可执行字段映射”。
     * 这里把“元数据已加载 -> 为缺失对象生成默认字段映射”做成统一补偿逻辑：
     * - 新增流程中，用户选择表后已有字段映射，不会被覆盖；
     * - 编辑流程中，旧草稿缺失字段映射时会按源表字段自动补齐；
     * - 已人工调整过的映射不重建，避免覆盖用户配置。
     */
    setFieldMappingsByObjectKey((rows) => {
      let changed = false;
      const nextRows = { ...rows };
      objectMappings.forEach((mapping) => {
        if (nextRows[mapping.key]?.length) {
          return;
        }
        const generatedRows = makeFieldMappingsForObject(mapping);
        if (generatedRows.length) {
          nextRows[mapping.key] = generatedRows;
          changed = true;
        }
      });
      return changed ? nextRows : rows;
    });
  }, [wizardOpen, sqlTransferMode, objectMappings, sourceDiscovery, targetDiscovery]);

  const buildWizardPrecheckItems = () => {
    const values = wizardForm.getFieldsValue(true);
    const submitScopeType = resolveSubmitSyncScopeType(values);
    const syncMode = String(values.syncMode || "").toUpperCase();
    const writeStrategy = String(values.writeStrategy || "INSERT").toUpperCase();
    const sqlMode = submitScopeType === "CUSTOM_SQL_QUERY";
    const scheduledMode = syncMode === "SCHEDULED_FULL" || syncMode === "SCHEDULED_BATCH";
    const fullLikeMode = syncMode === "FULL" || syncMode === "SCHEDULED_FULL";
    const backendIssueCodes = wizardPrecheckResult?.issueCodes ?? [];
    const backendIssueSet = new Set(backendIssueCodes);
    const backendSuggestions = wizardPrecheckResult?.recommendedActions ?? [];
    const backendSafetyNotes = wizardPrecheckResult?.safetyNotes ?? [];
    const backendPerformanceNotes = wizardPrecheckResult?.performanceNotes ?? [];
    const items: WizardPrecheckItem[] = [];

    const pushItem = (item: WizardPrecheckItem) => {
      const readableDetails = Array.from(new Set((item.details.length ? item.details : [item.summary]).filter(Boolean)));
      items.push({
        ...item,
        details: readableDetails,
      });
    };
    const targetObjectRowsForChecks: ObjectMappingRow[] = sqlMode
      ? [{
          key: "custom-sql-target",
          targetSchemaName: values.targetSchemaName,
          targetObjectName: values.targetObjectName,
        objectType: "TABLE",
      }]
      : objectMappings;
    const targetObjectNamesForChecks = Array.from(new Set(
      targetObjectRowsForChecks
        .map((mapping) => compactObjectName(mapping.targetSchemaName, mapping.targetObjectName))
        .filter((name) => name && name !== "-"),
    ));
    const backendReadableNotes = [...backendSuggestions, ...backendSafetyNotes, ...backendPerformanceNotes]
      .filter((note) => note && !/^issueCode[:：]/i.test(note));
    const findBackendNote = (keywords: string[]) =>
      backendReadableNotes.find((note) => keywords.every((keyword) => note.includes(keyword)));
    const humanizeBackendIssue = (code: string) => {
      /*
       * 服务端 issueCode 适合机器处理、日志检索和前后端联调，但不适合直接展示给业务用户。
       * 这里把高频阻断项翻译成“问题是什么、为什么会拦截、现在怎么改”的自然语言。
       * 原始 issueCode 仍保留在弹窗底部的“排障信息”里，方便开发或运维定位日志。
       */
      if (code === "METADATA_TARGET_NOT_EMPTY_FOR_INSERT_FULL") {
        const rowCountNote = findBackendNote(["目标", "行数"]);
        return [
          "问题：目标表里已经有数据，但当前任务选择的是“全量传输 + INSERT”。",
          rowCountNote ? `检测结果：${rowCountNote.replace(/^安全提示[:：]\s*/, "").replace(/^服务端建议[:：]\s*/, "")}` : undefined,
          targetObjectNamesForChecks.length ? `涉及目标表：${targetObjectNamesForChecks.join("、")}` : undefined,
          "为什么不能继续：INSERT 只负责新增，不会覆盖旧数据；如果目标表已有相同主键，执行时很可能主键冲突；如果没有主键，也可能造成重复数据。",
          "建议处理：如果这是第一次初始化，请先清空目标表或换一个空目标表；如果你想把已有数据更新为源端最新值，请把写入策略改成 update/merge；如果只是选错了目标表，请返回对象映射重新选择或填写目标表。",
        ].filter((item): item is string => Boolean(item));
      }
      if (code === "METADATA_TARGET_ROW_COUNT_PROBE_FAILED") {
        return [
          "问题：系统没能确认目标表是否为空，所以不能安全执行全量 INSERT。",
          "为什么不能继续：全量 INSERT 需要提前确认目标表为空；如果无法确认，直接执行可能产生重复数据或主键冲突。",
          "建议处理：检查目标数据源账号是否有查询目标表的权限，确认目标 schema/table 填写正确，然后重新预检查；也可以改用 update/merge。",
        ];
      }
      if (code === "METADATA_TARGET_PRIMARY_KEY_REQUIRED_FOR_UPDATE" || code === "METADATA_TARGET_PRIMARY_KEY_FIELD_NOT_MAPPED_FOR_UPDATE") {
        return [
          "问题：当前选择 update/merge，但目标表主键或主键字段映射不完整。",
          "为什么不能继续：update/merge 必须知道“按哪一列定位同一行”，否则系统无法判断应该更新哪条目标数据。",
          "建议处理：确认目标表存在主键或唯一键，并在字段映射里把对应字段勾选和映射上；如果目标表没有主键，请先给目标表补主键/唯一键，或改用 INSERT 写入空表。",
        ];
      }
      if (code === "SCHEDULED_BATCH_WINDOW_NOT_DECLARED") {
        return [
          "问题：定期批量任务还没有配置批量窗口。",
          "为什么不能继续：定期批量必须知道每次同步哪一段数据，例如按时间范围、分区或过滤条件同步；否则每次调度都会变成全表扫描。",
          "建议处理：回到配置步骤，为定期批量任务设置 where 条件、时间窗口或分片/分区配置。",
        ];
      }
      if (code === "SCHEDULED_FULL_INSERT_TARGET_REUSE_UNSAFE") {
        return [
          "问题：定期全量任务使用 INSERT 写固定目标表，后续重复调度风险很高。",
          "为什么不能继续：第一次同步后目标表就不再为空，下一次定期全量继续 INSERT 很可能产生重复数据或主键冲突。",
          "建议处理：优先把写入策略改成 update/merge；如果业务确实需要每次生成一份全量快照，请使用新的空目标表或后续设计快照表/分区表策略。",
        ];
      }
      if (code === "REALTIME_WRITE_STRATEGY_MUST_BE_MERGE") {
        return [
          "问题：实时同步不能使用 INSERT 写入策略。",
          "为什么不能继续：实时变更会多次命中同一业务主键，INSERT 无法处理更新和删除事件。",
          "建议处理：实时模式使用默认的 update/merge 写入策略。",
        ];
      }
      return [
        "问题：系统返回了一个暂未翻译的预检查阻断项。",
        "建议处理：先查看上方其他未通过检查项并按提示修复；如果仍无法通过，请把底部排障信息里的 issueCode 发给开发或管理员定位。",
      ];
    };
    const humanizeBackendIssues = (codes: string[]) => {
      const uniqueCodes = Array.from(new Set(codes));
      return uniqueCodes.flatMap((code) => humanizeBackendIssue(code));
    };

    const basicErrors: string[] = [];
    if (!values.sourceDatasourceId) basicErrors.push("未选择源端数据源。");
    if (!values.targetDatasourceId) basicErrors.push("未选择目标端数据源。");
    if (values.sourceDatasourceId && values.sourceDatasourceId === values.targetDatasourceId) {
      basicErrors.push("源端和目标端数据源不能相同。");
    }
    if (!values.syncMode) basicErrors.push("未选择传输模式。");
    /*
     * 第一组检查只看创建向导第一步的基础事实。它不连接数据库，也不解析字段，
     * 目的是在最早阶段排除“没有源/目标/模式”的配置，这类问题没有必要进入后续昂贵的元数据预检。
     */
    pushItem({
      key: "basic",
      category: "基础配置",
      title: "源端、目标端与传输模式",
      status: basicErrors.length ? "BLOCKED" : "PASS",
      summary: basicErrors.length ? "基础配置不完整，不能进入真实预检查。" : "已选择源端、目标端和用户可见传输模式。",
      details: basicErrors.length
        ? basicErrors
        : [
            `源端数据源：${values.sourceDatasourceId}`,
            `目标端数据源：${values.targetDatasourceId}`,
            `传输模式：${labelOf(syncMode, syncModeLabels)}`,
          ],
      step: 0,
      stepName: "源端/目标端",
    });

    if (scheduledMode) {
      pushItem({
        key: "schedule",
        category: "调度",
        title: "定期任务调度配置",
        status: values.scheduleConfig?.trim() ? "PASS" : "BLOCKED",
        summary: values.scheduleConfig?.trim()
          ? "定期全量/定期批量已声明调度规则。"
          : "定期全量/定期批量必须声明调度规则，否则任务无法进入等待调度状态。",
        details: values.scheduleConfig?.trim()
          ? [`调度配置：${values.scheduleConfig.trim()}`]
          : ["请回到第一步填写 cron/timezone 等调度配置。"],
        step: 0,
        stepName: "源端/目标端",
      });
    }

    const connectorIssueCodes = backendIssueCodes.filter((code) =>
      code.startsWith("CONNECTOR_") || code.endsWith("_MODE_UNSUPPORTED") || code.endsWith("_MODE_NOT_SUPPORTED"));
    pushItem({
      key: "connector",
      category: "连接器能力",
      title: "源端读取、目标端写入与模式兼容性",
      status: compatibility && !compatibility.supported || connectorIssueCodes.length ? "BLOCKED" : wizardPrecheckResult ? "PASS" : "PENDING",
      summary: compatibility && !compatibility.supported
        ? "连接器能力矩阵不支持当前源端、目标端和同步模式组合。"
        : wizardPrecheckResult
          ? "连接器事实和能力矩阵已由服务端预检查确认。"
          : "等待服务端预检查确认连接器能力矩阵。",
      details: [
        `源端连接器：${values.sourceConnectorType || "未识别"}`,
        `目标端连接器：${values.targetConnectorType || "未识别"}`,
        ...(compatibility?.issueCodes ?? []).map((code) => `前端兼容性问题：${code}`),
        ...connectorIssueCodes.map((code) => `服务端连接器问题：${code}`),
      ],
      issueCodes: connectorIssueCodes,
      step: 0,
      stepName: "源端/目标端",
    });

    if (sqlMode) {
      const targetTable = findMetadataTableByName(targetDiscovery, values.targetSchemaName, values.targetObjectName);
      const targetMissing = targetDiscovery && values.targetObjectName && !targetTable;
      const objectIssueCodes = backendIssueCodes.filter((code) =>
        code.includes("TARGET_OBJECT") || code.includes("TARGET_SCHEMA") || code.includes("CUSTOM_SQL_TARGET"));
      pushItem({
        key: "object-sql-target",
        category: "对象映射",
        title: "SQL 语句模式目标表存在性",
        status: !values.targetObjectName || targetMissing || objectIssueCodes.length ? "BLOCKED" : targetDiscovery ? "PASS" : "PENDING",
        summary: targetMissing
          ? "目标端元数据中未发现 SQL 结果要写入的目标表。"
          : values.targetObjectName
            ? "SQL 语句模式已声明目标表，目标存在性由元数据和服务端预检查确认。"
            : "SQL 语句模式必须声明目标表。",
        details: [
          `目标对象：${compactObjectName(values.targetSchemaName, values.targetObjectName)}`,
          targetDiscovery ? "目标端元数据已加载。" : "目标端元数据尚未加载，暂不能本地判断目标表是否存在。",
          ...objectIssueCodes.map((code) => `服务端对象问题：${code}`),
          ...backendSuggestions.filter((action) => action.includes("目标") || action.includes("CUSTOM_SQL")),
        ],
        issueCodes: objectIssueCodes,
        step: 1,
        stepName: "对象映射",
      });
    } else if (values.objectScopeType === "DATABASE_FULL") {
      pushItem({
        key: "object-database",
        category: "对象映射",
        title: "全库搬迁范围",
        status: sourceDiscovery && targetDiscovery ? "WARNING" : "PENDING",
        summary: "全库搬迁需要服务端按元数据发现生成对象清单，并检查排除表、目标 schema 和 fan-out 执行计划。",
        details: [
          "前端只保存全库意图和排除清单，不在浏览器内枚举全部对象执行预检。",
          `已排除源端对象数：${excludedSourceObjects.length}`,
          "如果服务端返回 OBJECT_MAPPING 或 DATABASE_FULL 相关 issueCode，请在详情中按建议修复。",
        ],
        step: 1,
        stepName: "对象映射",
      });
    } else if (values.objectScopeType === "SCHEMA_FULL" && !objectMappings.length) {
      const sourceSchemaMissing = Boolean(sourceDiscovery && values.sourceSchemaName && !sourceSchemaOptions.some((item) => item.value === values.sourceSchemaName));
      const targetSchemaMissing = Boolean(targetDiscovery && values.targetSchemaName && !targetSchemaOptions.some((item) => item.value === values.targetSchemaName));
      pushItem({
        key: "object-schema",
        category: "对象映射",
        title: "Schema 级搬迁范围",
        status: !values.sourceSchemaName || !values.targetSchemaName || sourceSchemaMissing || targetSchemaMissing ? "BLOCKED" : sourceDiscovery && targetDiscovery ? "PASS" : "PENDING",
        summary: sourceSchemaMissing || targetSchemaMissing
          ? "源端或目标端元数据中未发现所填 Schema。"
          : "Schema 搬迁已声明源端和目标端 Schema，服务端将继续做对象发现和 fan-out 预检。",
        details: [
          `源端 Schema：${values.sourceSchemaName || "未填写"}`,
          `目标端 Schema：${values.targetSchemaName || "未填写"}`,
          sourceSchemaMissing ? "源端 Schema 不存在或当前账号无权限发现。" : "源端 Schema 检查未发现阻断。",
          targetSchemaMissing ? "目标端 Schema 不存在或当前账号无权限发现。" : "目标端 Schema 检查未发现阻断。",
        ],
        step: 1,
        stepName: "对象映射",
      });
    } else {
      const missingSourceObjects = objectMappings.filter((mapping) =>
        !findMetadataTableForMapping(sourceDiscovery, mapping.sourceTableIndex, mapping.sourceSchemaName, mapping.sourceObjectName));
      const missingTargetObjects = objectMappings.filter((mapping) =>
        !findMetadataTableForMapping(targetDiscovery, mapping.targetTableIndex, mapping.targetSchemaName, mapping.targetObjectName));
      const objectIssueCodes = backendIssueCodes.filter((code) =>
        code.includes("OBJECT_MAPPING")
        || code.includes("METADATA_SOURCE_OBJECT")
        || code.includes("METADATA_TARGET_OBJECT")
        || code.includes("METADATA_SOURCE_SCHEMA")
        || code.includes("METADATA_TARGET_SCHEMA"));
      pushItem({
        key: "object-tables",
        category: "对象映射",
        title: "源表与目标表存在性",
        status: !objectMappings.length || missingSourceObjects.length || missingTargetObjects.length || objectIssueCodes.length ? "BLOCKED" : sourceDiscovery && targetDiscovery ? "PASS" : "PENDING",
        summary: !objectMappings.length
          ? "按表传输至少要选择一张源表并配置目标表。"
          : missingTargetObjects.length
            ? "部分目标表不存在或当前账号无权发现。"
            : missingSourceObjects.length
              ? "部分源表不存在或当前账号无权发现。"
              : "已根据元数据检查源端表和目标端表映射关系。",
        details: [
          ...objectMappings.map((mapping) => `映射：${compactObjectName(mapping.sourceSchemaName, mapping.sourceObjectName)} -> ${compactObjectName(mapping.targetSchemaName, mapping.targetObjectName)}`),
          ...missingSourceObjects.map((mapping) => `源端对象不存在：${compactObjectName(mapping.sourceSchemaName, mapping.sourceObjectName)}`),
          ...missingTargetObjects.map((mapping) => `目标端对象不存在：${compactObjectName(mapping.targetSchemaName, mapping.targetObjectName)}`),
          ...objectIssueCodes.map((code) => `服务端对象问题：${code}`),
        ],
        issueCodes: objectIssueCodes,
        step: 1,
        stepName: "对象映射",
      });
    }

    const rowsByObject = sqlMode
      ? [{ object: undefined as ObjectMappingRow | undefined, rows: fieldMappings, targetTable: findMetadataTableByName(targetDiscovery, values.targetSchemaName, values.targetObjectName) }]
      : objectMappings.map((mapping) => ({
          object: mapping,
          rows: fieldMappingsByObjectKey[mapping.key] ?? makeFieldMappingsForObject(mapping),
          targetTable: findMetadataTableForMapping(targetDiscovery, mapping.targetTableIndex, mapping.targetSchemaName, mapping.targetObjectName),
        }));
    const enabledFieldRows = rowsByObject.flatMap((item) => item.rows.filter((row) => row.syncEnabled !== false));
    const incompleteFieldRows = rowsByObject.flatMap((item) =>
      item.rows
        .filter((row) => row.syncEnabled !== false && (!row.sourceField || !row.targetField))
        .map((row) => `${item.object ? compactObjectName(item.object.sourceSchemaName, item.object.sourceObjectName) : "SQL结果集"}：${row.sourceField || "<未填源字段>"} -> ${row.targetField || "<未填目标字段>"}`));
    const targetFieldMissingRows = rowsByObject.flatMap((item) => {
      const targetFieldNames = new Set((item.targetTable?.fields ?? []).map((field) => field.fieldName.toLowerCase()));
      if (!targetFieldNames.size) {
        return [];
      }
      return item.rows
        .filter((row) => row.syncEnabled !== false && row.targetField && !targetFieldNames.has(row.targetField.toLowerCase()))
        .map((row) => `${item.object ? compactObjectName(item.object.targetSchemaName, item.object.targetObjectName) : compactObjectName(values.targetSchemaName, values.targetObjectName)} 缺少目标字段：${row.targetField}`);
    });
    const typeConflictRows = rowsByObject.flatMap((item) =>
      item.rows
        .filter((row) => row.syncEnabled !== false && row.typeCompatible === false)
        .map((row) => `${item.object ? compactObjectName(item.object.sourceSchemaName, item.object.sourceObjectName) : "SQL结果集"}：${row.sourceField}(${row.sourceType || "-"}) -> ${row.targetField}(${row.targetType || "-"})`));
    const fieldIssueCodes = backendIssueCodes.filter((code) => code.includes("FIELD_MAPPING") || code.includes("METADATA_SOURCE_FIELD") || code.includes("METADATA_TARGET_FIELD"));
    pushItem({
      key: "field-mapping",
      category: "字段映射",
      title: sqlMode ? "SQL 输出字段到目标字段映射" : "源字段到目标字段映射",
      status: !enabledFieldRows.length || incompleteFieldRows.length || targetFieldMissingRows.length || typeConflictRows.length || fieldIssueCodes.length ? "BLOCKED" : "PASS",
      summary: !enabledFieldRows.length
        ? "尚未形成任何可执行字段映射。"
        : incompleteFieldRows.length || targetFieldMissingRows.length
          ? "字段映射中存在未填写或目标端不存在的字段。"
          : typeConflictRows.length
            ? "字段映射存在类型兼容风险。"
            : "字段映射已形成可执行的源字段到目标字段关系。",
      details: [
        `已勾选同步字段数：${enabledFieldRows.length}`,
        ...incompleteFieldRows.map((item) => `未填写完整：${item}`),
        ...targetFieldMissingRows,
        ...typeConflictRows.map((item) => `类型需确认：${item}`),
        ...fieldIssueCodes.map((code) => `服务端字段问题：${code}`),
      ],
      issueCodes: fieldIssueCodes,
      step: 2,
      stepName: "字段/SQL",
    });

    const updateLike = writeStrategy === "UPDATE" || writeStrategy === "UPSERT" || writeStrategy === "MERGE";
    const targetTablesWithoutPk = targetObjectRowsForChecks
      .map((mapping) => ({
        mapping,
        table: findMetadataTableForMapping(targetDiscovery, mapping.targetTableIndex, mapping.targetSchemaName, mapping.targetObjectName),
      }))
      .filter((item) => item.table && !hasPrimaryKey(item.table));
    const writeIssueCodes = backendIssueCodes.filter((code) =>
      code.includes("PRIMARY_KEY")
      || code.includes("WRITE_STRATEGY")
      || code.includes("ROW_COUNT_PROBE")
      || code === "METADATA_TARGET_NOT_EMPTY_FOR_INSERT_FULL"
      || code === "METADATA_TARGET_PRIMARY_KEY_REQUIRED_FOR_UPDATE"
      || code === "DESTRUCTIVE_WRITE_STRATEGY_REQUIRES_APPROVAL");
    pushItem({
      key: "write-strategy",
      category: "写入策略",
      title: writeStrategy === "UPDATE" ? "UPDATE/merge 主键与覆盖风险" : "INSERT 写入风险",
      status: updateLike && (targetTablesWithoutPk.length || writeIssueCodes.length)
        ? "BLOCKED"
        : writeIssueCodes.length
          ? "BLOCKED"
        : writeStrategy === "INSERT" && fullLikeMode && !wizardPrecheckResult
          ? "PENDING"
          : "PASS",
      summary: updateLike
        ? targetTablesWithoutPk.length || writeIssueCodes.length
          ? "UPDATE/merge 需要目标表主键或冲突字段，否则无法安全判断更新哪一行。"
          : "目标表具备主键信息，UPDATE/merge 的幂等更新边界可被识别。"
        : writeIssueCodes.includes("METADATA_TARGET_NOT_EMPTY_FOR_INSERT_FULL")
          ? "目标表已有数据，当前“全量传输 + INSERT”不能直接执行。"
        : writeStrategy === "INSERT" && fullLikeMode && wizardPrecheckResult
          ? "目标表已确认为空，当前“全量传输 + INSERT”可以继续执行。"
        : fullLikeMode
          ? "等待服务端确认目标表是否为空。"
          : "INSERT 写入策略未发现本地阻断项。",
      details: [
        ...targetTablesWithoutPk.flatMap((item) => [
          `问题：目标表 ${compactObjectName(item.mapping.targetSchemaName, item.mapping.targetObjectName)} 没有主键。`,
          "为什么不能继续：update/merge 需要通过主键或唯一键判断应该更新哪一行。",
          "建议处理：给目标表补充主键/唯一键，并确认字段映射中包含该字段；或者改成 INSERT 写入空表。",
        ]),
        ...humanizeBackendIssues(writeIssueCodes),
        ...(!targetTablesWithoutPk.length && !writeIssueCodes.length && writeStrategy === "INSERT" && fullLikeMode && wizardPrecheckResult
          ? ["检查结果：目标表为空，当前全量 INSERT 可以继续执行。"]
          : []),
        ...(!targetTablesWithoutPk.length && !writeIssueCodes.length && writeStrategy === "INSERT" && fullLikeMode && !wizardPrecheckResult
          ? ["等待检查：服务端需要先确认目标表为空，确认通过后这一项会自动变为通过。"]
          : []),
      ],
      issueCodes: writeIssueCodes,
      step: 2,
      stepName: "字段/SQL",
    });

    if (sqlMode) {
      const sql = values.customSqlText?.trim() || "";
      const unsafeSql = Boolean(sql && (!sql.toLowerCase().startsWith("select") || /\b(insert|update|delete|drop|truncate|alter|create)\b/i.test(sql)));
      const sqlIssueCodes = backendIssueCodes.filter((code) => code.includes("CUSTOM_SQL"));
      pushItem({
        key: "custom-sql",
        category: "SQL 安全",
        title: "自定义 SQL 只读性与表存在性",
        status: !sql || unsafeSql || sqlIssueCodes.length ? "BLOCKED" : wizardPrecheckResult ? "PASS" : "PENDING",
        summary: !sql
          ? "SQL 语句模式必须填写只读 SELECT。"
          : unsafeSql
            ? "SQL 中包含非只读关键字，不能作为数据同步读取 SQL。"
            : "SQL 已通过前端只读关键字检查，服务端会继续做 SQL 安全和表存在性审计。",
        details: [
          sql ? "已填写 SQL 文本，详情不在预检查弹窗中回显，避免泄露业务语句。" : "尚未填写 SQL。",
          ...sqlIssueCodes.map((code) => `服务端 SQL 问题：${code}`),
        ],
        issueCodes: sqlIssueCodes,
        step: 2,
        stepName: "字段/SQL",
      });
    }

    const blockingPrecheckItems = items.filter((item) => item.status === "BLOCKED");
    const serverGateBlockedSummary = backendIssueCodes.includes("METADATA_TARGET_NOT_EMPTY_FOR_INSERT_FULL")
      ? "目标表已有数据，当前全量 INSERT 不能执行。请先处理目标表或调整写入策略。"
      : blockingPrecheckItems.length
        ? `还有 ${blockingPrecheckItems.length} 个配置问题未修复，请先处理标红检查项。`
        : "服务端发现当前配置仍不满足执行条件，请按详情建议修复后重新预检查。";
    pushItem({
      key: "server-gate",
      category: "服务端准入",
      title: "服务端最终执行准入",
      status: !wizardPrecheckResult
        ? "PENDING"
        : wizardPrecheckResult.canStartExecution
          ? "PASS"
          : wizardPrecheckResult.precheckStatus === "REQUIRES_APPROVAL"
            ? "WARNING"
            : "BLOCKED",
      summary: !wizardPrecheckResult
        ? "等待服务端自动预检查返回。"
        : wizardPrecheckResult.canStartExecution
          ? "服务端允许当前模板进入执行链路。"
          : serverGateBlockedSummary,
      details: [
        ...(wizardPrecheckResult?.canStartExecution
          ? ["当前配置已经通过预检查，可以继续发布或执行。"]
          : [
              ...blockingPrecheckItems.map((item) => `未通过：${item.title}。${item.summary}`),
              ...humanizeBackendIssues(backendIssueCodes),
              "建议处理：先点击左侧或表格中的具体失败项查看原因，按提示回到对应步骤修复；修复后点击“重新保存并运行预检查”。",
            ]),
      ],
      issueCodes: backendIssueCodes,
      step: wizardPrecheckResult?.canStartExecution ? undefined : 3,
      stepName: "预检查",
    });

    return items;
  };

  const wizardPrecheckItems = buildWizardPrecheckItems();
  const wizardPrecheckWorstStatus: WizardPrecheckStatus = wizardPrecheckItems.some((item) => item.status === "BLOCKED")
    ? "BLOCKED"
    : wizardPrecheckItems.some((item) => item.status === "WARNING")
      ? "WARNING"
      : wizardPrecheckItems.some((item) => item.status === "PENDING")
        ? "PENDING"
        : "PASS";
  const wizardPrecheckStatusMessage: Record<WizardPrecheckStatus, string> = {
    PASS: "预检查通过，当前配置具备发布/执行条件",
    WARNING: "预检查存在需确认项，请查看详情后再决定是否继续",
    BLOCKED: "预检查未通过，请查看失败项并返回对应步骤修复",
    PENDING: "预检查等待服务端或元数据返回",
  };

  useEffect(() => {
    if (!objectMappings.length) {
      setActiveObjectMappingKey(undefined);
      return;
    }
    if (!activeObjectMappingKey || !objectMappings.some((mapping) => mapping.key === activeObjectMappingKey)) {
      setActiveObjectMappingKey(objectMappings[0].key);
    }
  }, [objectMappings, activeObjectMappingKey]);

  const updateObjectMapping = (key: string, patch: Partial<ObjectMappingRow>) => {
    setObjectMappings((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const objectMappingColumns: ColumnsType<ObjectMappingRow> = [
    {
      title: "源端 Schema",
      dataIndex: "sourceSchemaName",
      render: (value, record) => (
        <Input value={value} onChange={(event) => updateObjectMapping(record.key, { sourceSchemaName: event.target.value })} />
      ),
    },
    {
      title: "源端表/对象",
      dataIndex: "sourceObjectName",
      render: (value, record) => (
        <Input value={value} onChange={(event) => updateObjectMapping(record.key, { sourceObjectName: event.target.value })} />
      ),
    },
    {
      title: "目标端 Schema",
      dataIndex: "targetSchemaName",
      render: (value, record) => (
        <Input value={value} onChange={(event) => updateObjectMapping(record.key, { targetSchemaName: event.target.value })} />
      ),
    },
    {
      title: "目标端表/对象",
      dataIndex: "targetObjectName",
      render: (value, record) => (
        <Input value={value} onChange={(event) => updateObjectMapping(record.key, { targetObjectName: event.target.value })} />
      ),
    },
    {
      title: "操作",
      width: 78,
      render: (_, record) => (
        <Button aria-label="移除映射" title="移除映射" icon={<DeleteOutlined />} onClick={() => removeObjectMapping(record.key)} />
      ),
    },
  ];

  const fieldMappingObjectColumns: ColumnsType<ObjectMappingRow> = [
    /*
     * 第三步的主视图必须是“对象映射清单”，而不是一个下拉框。
     * 多表同步时用户真正关心的是每一行 source -> target 的关系是否正确，
     * 以及该对象是否已经配置字段映射和 where 过滤。把对象摊平成表格后，
     * 字段映射、where 编辑、分页数量切换和后续批量操作都能围绕同一个稳定对象 key 展开。
     */
    {
      title: "源端对象",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text className="mono">{compactObjectName(record.sourceSchemaName, record.sourceObjectName)}</Typography.Text>
          {record.objectType ? <Tag>{record.objectType}</Tag> : null}
        </Space>
      ),
    },
    {
      title: "目标对象",
      render: (_, record) => (
        <Typography.Text className="mono">{compactObjectName(record.targetSchemaName, record.targetObjectName)}</Typography.Text>
      ),
    },
    {
      title: "where 过滤",
      render: (_, record) => record.whereCondition
        ? <Typography.Text ellipsis={{ tooltip: record.whereCondition }}>{record.whereCondition}</Typography.Text>
        : <Typography.Text type="secondary">未设置</Typography.Text>,
    },
    {
      title: "操作",
      width: 220,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            type={activeObjectMappingKey === record.key && activeObjectEditor === "FIELDS" ? "primary" : "default"}
            onClick={() => activateObjectMappingEditor(record, "FIELDS")}
          >
            设置字段映射
          </Button>
          <Button
            size="small"
            type={activeObjectMappingKey === record.key && activeObjectEditor === "WHERE" ? "primary" : "default"}
            onClick={() => activateObjectMappingEditor(record, "WHERE")}
          >
            设置 where
          </Button>
        </Space>
      ),
    },
  ];

  const sourceColumnOptions = sortedColumns(activeSourceTable).map((column) => ({
    value: column.fieldName,
    label: `${column.fieldName}${column.primaryKey ? " · PK" : ""}`,
  }));
  const targetColumnOptions = sortedColumns(activeTargetTable).map((column) => ({
    value: column.fieldName,
    label: `${column.fieldName}${column.primaryKey ? " · PK" : ""}`,
  }));

  const templateColumns: ColumnsType<SyncTemplate> = [
    {
      title: "模板",
      dataIndex: "name",
      render: (value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{value}</Typography.Text>
          <Typography.Text className="mono" type="secondary">#{record.id}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "源端 -> 目标端",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text className="mono">{`${record.sourceDatasourceId} -> ${record.targetDatasourceId}`}</Typography.Text>
          <Typography.Text type="secondary">{`${record.sourceObjectName || "-"} -> ${record.targetObjectName || "-"}`}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "模式/范围",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Tag color="blue">{labelOf(record.syncMode, syncModeLabels)}</Tag>
          <Tag>{labelOf(record.syncScopeType || "SINGLE_OBJECT", syncScopeLabels)}</Tag>
        </Space>
      ),
    },
    { title: "写入", dataIndex: "writeStrategy", render: (value) => <Tag>{labelOf(value || "INSERT", writeStrategyLabels)}</Tag> },
    { title: "启用", dataIndex: "enabled", render: (value) => <BooleanTag value={value} /> },
    { title: "更新", dataIndex: "updateTime", render: (value) => formatDateTime(value) },
    {
      title: "操作",
      width: 260,
      render: (_, record) => (
        <Space>
          <Button aria-label="校验模板" title="校验模板" icon={<CheckCircleOutlined />} onClick={() => api.validateSyncTemplate(record.id).then(() => message.success("模板校验已通过")).catch((error) => message.error(error instanceof Error ? error.message : "模板校验失败"))} />
          <Button aria-label="规划预览" title="规划预览" icon={<EyeOutlined />} onClick={() => api.previewSyncTemplate(record.id).then((result) => setPreviewPayload(result.data)).catch((error) => message.error(error instanceof Error ? error.message : "规划预览失败"))} />
          <Button aria-label="执行预检" title="执行预检" icon={<SearchOutlined />} onClick={() => api.precheckSyncTemplate(record.id).then((result) => setPreviewPayload(result.data)).catch((error) => message.error(error instanceof Error ? error.message : "执行预检失败"))} />
          <Button aria-label="离线计划" title="离线计划" icon={<CloudSyncOutlined />} onClick={() => api.buildSyncOfflineJobPlan(record.id).then((result) => setPreviewPayload(result.data)).catch((error) => message.error(error instanceof Error ? error.message : "离线作业计划失败"))} />
        </Space>
      ),
    },
  ];

  const confirmTaskAction = (
    record: SyncTask,
    action: "terminate" | "offline" | "recycle" | "hardDelete" | "cancel",
    title: string,
    reason: string,
  ) => {
    modal.confirm({
      title,
      content: `任务：${record.name}`,
      okText: "确认",
      cancelText: "取消",
      okButtonProps: { danger: action === "hardDelete" || action === "cancel" },
      onOk: () => taskActionMutation.mutate({ id: record.id, action, payload: { reason } }),
    });
  };

  const openTaskDrawer = (record: SyncTask) => {
    setSelectedTask(record);
    setSelectedExecutionId(record.lastExecutionId);
    dirtyReplayForm.setFieldsValue({ executionId: record.lastExecutionId });
  };

  const renderTaskActions = (record: SyncTask, recycleView = false) => (
    <Space wrap>
      <Button aria-label="执行历史" title="执行历史" icon={<EyeOutlined />} onClick={() => openTaskDrawer(record)} />
      <Button
        aria-label="编辑任务"
        title="编辑任务定义"
        icon={<EditOutlined />}
        disabled={!canOperate(record, editAllowedStates)}
        onClick={() => openEditTask(record)}
      />
      <Button
        aria-label="发布任务"
        title="发布任务定义"
        icon={<SendOutlined />}
        disabled={!canOperate(record, publishAllowedStates)}
        loading={taskDefinitionMutation.isPending}
        onClick={() => openPublishTask(record)}
      />
      <Button aria-label="调整分组" title="调整分组" icon={<FolderOutlined />} onClick={() => openGroupTask(record)} />
      <Button aria-label="克隆任务" title="克隆任务" icon={<CopyOutlined />} loading={taskDefinitionMutation.isPending} onClick={() => openCloneTask(record)} />
      {recycleView ? (
        <Button
          danger
          aria-label="彻底删除"
          title="彻底删除"
          icon={<DeleteOutlined />}
          loading={taskActionMutation.isPending}
          disabled={stateOf(record) !== "RECYCLED"}
          onClick={() => confirmTaskAction(record, "hardDelete", "确认彻底删除回收站任务？", "前端确认彻底删除回收站任务")}
        />
      ) : (
        <>
          <Button
            aria-label="立即执行一次"
            title="立即执行一次"
            icon={<PlayCircleOutlined />}
            loading={taskActionMutation.isPending}
            disabled={!canOperate(record, runAllowedStates)}
            onClick={() => taskActionMutation.mutate({ id: record.id, action: "manualDispatch" })}
          />
          <Button
            aria-label="暂停"
            title="暂停"
            icon={<PauseCircleOutlined />}
            loading={taskActionMutation.isPending}
            disabled={!canOperate(record, pauseAllowedStates)}
            onClick={() => taskActionMutation.mutate({ id: record.id, action: "pause", payload: { reason: "前端人工暂停" } })}
          />
          <Button
            aria-label="恢复"
            title="恢复"
            icon={<SyncOutlined />}
            loading={taskActionMutation.isPending}
            disabled={!canOperate(record, resumeAllowedStates)}
            onClick={() => taskActionMutation.mutate({ id: record.id, action: "resume", payload: { reason: "前端人工恢复" } })}
          />
          <Button
            aria-label="重试"
            title="重试"
            icon={<RedoOutlined />}
            loading={taskActionMutation.isPending}
            disabled={!canOperate(record, retryAllowedStates)}
            onClick={() => taskActionMutation.mutate({ id: record.id, action: "retry", payload: { reason: "前端人工重试" } })}
          />
          <Button aria-label="回放" title="回放" icon={<CloudSyncOutlined />} onClick={() => openRecoveryModal(record, "replay")} />
          <Button aria-label="补数" title="补数" icon={<ReloadOutlined />} onClick={() => openRecoveryModal(record, "backfill")} />
          <Button
            danger
            aria-label="手工结束"
            title="手工结束"
            icon={<StopOutlined />}
            loading={taskActionMutation.isPending}
            disabled={!canOperate(record, terminateAllowedStates)}
            onClick={() => confirmTaskAction(record, "terminate", "确认手工结束当前运行？", "前端手工结束同步任务")}
          />
          <Button
            aria-label="下线"
            title="下线任务"
            icon={<InboxOutlined />}
            loading={taskActionMutation.isPending}
            disabled={!canOperate(record, offlineAllowedStates)}
            onClick={() => confirmTaskAction(record, "offline", "确认下线任务？", "前端下线同步任务")}
          />
          <Button
            danger
            aria-label="移入回收站"
            title="移入回收站"
            icon={<DeleteOutlined />}
            loading={taskActionMutation.isPending}
            disabled={stateOf(record) !== "OFFLINE"}
            onClick={() => confirmTaskAction(record, "recycle", "确认移入回收站？", "前端删除同步任务到回收站")}
          />
          <Button
            danger
            aria-label="取消"
            title="取消任务"
            icon={<StopOutlined />}
            loading={taskActionMutation.isPending}
            disabled={!canOperate(record, cancelAllowedStates)}
            onClick={() => confirmTaskAction(record, "cancel", "确认取消任务？", "前端人工取消")}
          />
        </>
      )}
    </Space>
  );

  const makeTaskColumns = (recycleView = false): ColumnsType<SyncTask> => [
    {
      title: "任务",
      dataIndex: "name",
      width: 300,
      render: (value, record) => (
        <Space direction="vertical" size={2} className="task-title-cell">
          <Typography.Text strong>{value}</Typography.Text>
          {record.description ? <Typography.Text type="secondary">{record.description}</Typography.Text> : null}
        </Space>
      ),
    },
    {
      title: "分组",
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{record.groupName || "默认分组"}</Typography.Text>
        </Space>
      ),
    },
    { title: "状态", dataIndex: "currentState", width: 130, render: (value) => statusTag(value, stateColor, syncTaskStateLabels) },
    { title: "审批", dataIndex: "approvalState", width: 110, render: (value) => statusTag(value, approvalColor, approvalLabels) },
    { title: "优先级", dataIndex: "priority", width: 90, render: (value) => <Tag>{labelOf(value, priorityLabels)}</Tag> },
    {
      title: "调度",
      width: 210,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Tag color={record.scheduleEnabled ? "green" : "default"}>{record.scheduleEnabled ? "已启用" : "未启用"}</Tag>
          <Typography.Text type="secondary">{record.nextFireTime ? `下次 ${formatDateTime(record.nextFireTime)}` : "无下次触发"}</Typography.Text>
        </Space>
      ),
    },
    { title: "最近执行", dataIndex: "lastExecutionId", width: 110, render: (value) => value || "-" },
    { title: "更新", dataIndex: "updateTime", width: 170, render: (value) => formatDateTime(value) },
    {
      title: "操作",
      width: recycleView ? 260 : 520,
      render: (_, record) => renderTaskActions(record, recycleView),
    },
  ];

  const taskColumns = makeTaskColumns(false);
  const recycledTaskColumns = makeTaskColumns(true);

  const mappingColumns: ColumnsType<FieldMappingRow> = [
    {
      title: "同步",
      dataIndex: "syncEnabled",
      width: 72,
      render: (value, record) => (
        <Checkbox checked={value !== false} onChange={(event) => updateMapping(record.key, { syncEnabled: event.target.checked })} />
      ),
    },
    {
      title: "源字段",
      dataIndex: "sourceField",
      render: (value, record) => (
        <AutoComplete
          value={value || undefined}
          options={sourceColumnOptions}
          style={{ minWidth: 160 }}
          onChange={(nextValue) => {
            const sourceColumn = sortedColumns(activeSourceTable)
              .find((column) => column.fieldName === nextValue);
            updateMapping(record.key, {
              sourceField: nextValue,
              sourceType: sourceColumn?.dataTypeName,
              nullable: sourceColumn?.nullable,
              primaryKey: sourceColumn?.primaryKey,
            });
          }}
          placeholder="源字段名"
        />
      ),
    },
    { title: "源类型", dataIndex: "sourceType", render: (value, record) => <Tag color={record.primaryKey ? "gold" : "default"}>{value || "-"}</Tag> },
    {
      title: "兼容性",
      dataIndex: "typeCompatible",
      render: (value, record) => (
        <Space direction="vertical" size={0}>
          <Tag color={value === false ? "red" : value === true ? "green" : "default"}>
            {value === false ? "需确认" : value === true ? "兼容" : "未校验"}
          </Tag>
          {record.compatibilityNote ? <Typography.Text type="secondary">{record.compatibilityNote}</Typography.Text> : null}
        </Space>
      ),
    },
    {
      title: "目标字段",
      dataIndex: "targetField",
      render: (value, record) => (
        <AutoComplete
          value={value || undefined}
          options={targetColumnOptions}
          style={{ minWidth: 160 }}
          onChange={(nextValue) => {
            const targetColumn = sortedColumns(activeTargetTable)
              .find((column) => column.fieldName === nextValue);
            updateMapping(record.key, { targetField: nextValue, targetType: targetColumn?.dataTypeName });
          }}
          placeholder="目标字段名"
        />
      ),
    },
    {
      title: "转换",
      dataIndex: "transform",
      render: (value, record) => (
        <Input placeholder="可选，如 trim/lowercase" value={value} onChange={(event) => updateMapping(record.key, { transform: event.target.value })} />
      ),
    },
    {
      title: "操作",
      width: 72,
      render: (_, record) => (
        <Button danger aria-label="删除映射" title="删除映射" icon={<DeleteOutlined />} onClick={() => removeMapping(record.key)} />
      ),
    },
  ];

  const renderWizardPrecheckStatus = (status: WizardPrecheckStatus) => {
    const colorMap: Record<WizardPrecheckStatus, string> = {
      PASS: "success",
      WARNING: "warning",
      BLOCKED: "error",
      PENDING: "processing",
    };
    const labelMap: Record<WizardPrecheckStatus, string> = {
      PASS: "通过",
      WARNING: "需确认",
      BLOCKED: "不通过",
      PENDING: "待检查",
    };
    return <Tag color={colorMap[status]}>{labelMap[status]}</Tag>;
  };

  const wizardPrecheckColumns: ColumnsType<WizardPrecheckItem> = [
    {
      title: "检查项",
      width: 260,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.title}</Typography.Text>
          <Typography.Text type="secondary">{record.category}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (value: WizardPrecheckStatus) => renderWizardPrecheckStatus(value),
    },
    {
      title: "检查结论",
      dataIndex: "summary",
      render: (value) => <Typography.Text>{value}</Typography.Text>,
    },
    {
      title: "操作",
      width: 190,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => setWizardPrecheckDetail(record)}>配置详情</Button>
          {record.step != null && record.step < 3 && record.status !== "PASS" ? (
            <Button size="small" type="link" onClick={() => setWizardStep(record.step!)}>返回配置</Button>
          ) : null}
        </Space>
      ),
    },
  ];

  const executionColumns: ColumnsType<SyncExecution> = [
    { title: "执行记录 ID", dataIndex: "id", render: (value) => <Typography.Text className="mono">{value}</Typography.Text> },
    { title: "序号", dataIndex: "executionNo", render: (value) => value || "-" },
    { title: "状态", dataIndex: "executionState", render: (value) => statusTag(value, stateColor, syncExecutionStateLabels) },
    { title: "触发方式", dataIndex: "triggerType", render: (value) => labelOf(value, triggerTypeLabels) },
    { title: "读取", dataIndex: "recordsRead" },
    { title: "写入", dataIndex: "recordsWritten" },
    { title: "失败", dataIndex: "failedRecordCount" },
    { title: "入队时间", dataIndex: "queuedAt", render: (value) => formatDateTime(value) },
    {
      title: "查看",
      width: 80,
      render: (_, record) => (
        <Button
          icon={<EyeOutlined />}
          aria-label="查看执行详情"
          title="查看执行详情"
          onClick={() => {
            setSelectedExecutionId(record.id);
            dirtyReplayForm.setFieldsValue({ executionId: record.id });
          }}
        />
      ),
    },
  ];

  const executionLogColumns: ColumnsType<SyncExecutionLog> = [
    {
      title: "阶段",
      dataIndex: "logStage",
      width: 130,
      render: (value) => <Tag>{labelOf(value || "UNKNOWN", executionLogStageLabels)}</Tag>,
    },
    {
      title: "结果",
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Tag color={executionLogLevelColor[String(record.logLevel || "INFO").toUpperCase()] ?? "default"}>
            {record.logLevel || "INFO"}
          </Tag>
          <Tag color={stateColor[String(record.eventStatus || "").toUpperCase()] ?? "default"}>
            {labelOf(record.eventStatus || "PROGRESS", executionLogStatusLabels)}
          </Tag>
        </Space>
      ),
      width: 110,
    },
    {
      title: "执行说明",
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{record.message || labelOf(record.eventType || "EXECUTION_EVENT", executionLogStatusLabels)}</Typography.Text>
          {record.detailSummary ? <Typography.Text type="secondary">{record.detailSummary}</Typography.Text> : null}
          <Space wrap size={4}>
            {record.objectOrdinal != null ? <Tag>对象 #{record.objectOrdinal}</Tag> : null}
            {record.shardOrPartition ? <Tag>分片 {record.shardOrPartition}</Tag> : null}
            {record.traceId ? <Tag className="mono">trace {record.traceId}</Tag> : null}
          </Space>
        </Space>
      ),
    },
    {
      title: "读 / 写 / 失败",
      width: 150,
      render: (_, record) => `${record.recordsRead ?? 0} / ${record.recordsWritten ?? 0} / ${record.failedRecordCount ?? 0}`,
    },
    {
      title: "工作单元",
      width: 130,
      render: (_, record) =>
        record.completedWorkUnits != null
          ? `${record.completedWorkUnits ?? 0} 完成，${record.succeededWorkUnits ?? 0} 成功，${record.failedWorkUnits ?? 0} 失败`
          : "-",
    },
    {
      title: "进度 / 速度",
      width: 140,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{record.progressPercent != null ? `${Number(record.progressPercent).toFixed(2)}%` : "-"}</Typography.Text>
          <Typography.Text type="secondary">{Number(record.speedRowsPerSecond ?? 0).toFixed(2)} 行/秒</Typography.Text>
        </Space>
      ),
    },
    { title: "时间", dataIndex: "eventTime", width: 170, render: (value) => formatDateTime(value) },
  ];

  const capabilityColumns: ColumnsType<SyncConnectorCapability> = [
    {
      title: "连接器",
      dataIndex: "displayName",
      render: (value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{value}</Typography.Text>
          <Typography.Text className="mono" type="secondary">{record.connectorType}</Typography.Text>
        </Space>
      ),
    },
    { title: "支持等级", dataIndex: "supportLevel", render: (value) => <Tag color={value === "PRIMARY" ? "green" : "blue"}>{labelOf(value, supportLevelLabels)}</Tag> },
    { title: "读写", render: (_, record) => <Space><Tag color={record.canRead ? "green" : "default"}>读</Tag><Tag color={record.canWrite ? "green" : "default"}>写</Tag></Space> },
    {
      title: "能力",
      render: (_, record) => (
        <Space wrap>
          {record.supportsFullSync ? <Tag>全量</Tag> : null}
          {record.supportsIncrementalSync ? <Tag>增量</Tag> : null}
          {record.supportsStreaming ? <Tag>流式</Tag> : null}
          {record.supportsCheckpointResume ? <Tag>断点</Tag> : null}
          {record.supportsFieldMapping ? <Tag>映射</Tag> : null}
        </Space>
      ),
    },
  ];

  const incidentColumns: ColumnsType<SyncIncident> = [
    { title: "事故", dataIndex: "title" },
    { title: "严重级别", dataIndex: "severity", render: (value) => <Tag color={severityColor[value] ?? "default"}>{value}</Tag> },
    { title: "状态", dataIndex: "incidentStatus", render: (value) => <Tag>{labelOf(value, incidentStatusLabels)}</Tag> },
    { title: "任务", dataIndex: "syncTaskId", render: (value) => value || "-" },
    { title: "更新", dataIndex: "updateTime", render: (value) => formatDateTime(value) },
  ];

  const objectExecutionColumns: ColumnsType<SyncObjectExecution> = [
    { title: "对象", render: (_, record) => <Typography.Text>{compactObjectName(record.sourceSchemaName, record.sourceObjectName)}</Typography.Text> },
    { title: "目标", render: (_, record) => <Typography.Text>{compactObjectName(record.targetSchemaName, record.targetObjectName)}</Typography.Text> },
    { title: "状态", dataIndex: "objectState", render: (value) => statusTag(value, stateColor, syncExecutionStateLabels) },
    { title: "尝试", render: (_, record) => `${record.attemptCount ?? 0}/${record.maxAttemptCount ?? "-"}` },
    { title: "读/写/失败", render: (_, record) => `${record.recordsRead}/${record.recordsWritten}/${record.failedRecordCount}` },
    { title: "分片", dataIndex: "shardOrPartition", render: (value) => value || "-" },
    { title: "错误", dataIndex: "lastErrorMessage", render: (value) => value || "-" },
  ];

  const errorSampleColumns: ColumnsType<SyncErrorSample> = [
    { title: "样本 ID", dataIndex: "id", render: (value) => <Typography.Text className="mono">{value}</Typography.Text> },
    { title: "执行记录", dataIndex: "executionId" },
    { title: "类型", dataIndex: "errorType", render: (value) => <Tag color="volcano">{value || "未知"}</Tag> },
    { title: "可重试", dataIndex: "retryable", render: (value) => <BooleanTag value={value} trueLabel="可重试" falseLabel="不可重试" /> },
    { title: "源定位", dataIndex: "sourceRecordKey", render: (value) => value || "-" },
    { title: "错误摘要", dataIndex: "errorMessage", render: (value) => value || "-" },
  ];

  const checkpointColumns: ColumnsType<SyncCheckpoint> = [
    { title: "断点记录", dataIndex: "id", render: (value) => <Typography.Text className="mono">{value}</Typography.Text> },
    { title: "执行记录", dataIndex: "executionId", render: (value) => value || "-" },
    { title: "类型", dataIndex: "checkpointType", render: (value) => <Tag>{value || "未知"}</Tag> },
    { title: "分片", dataIndex: "shardOrPartition", render: (value) => value || "-" },
    { title: "读/写", render: (_, record) => `${record.recordsRead ?? 0}/${record.recordsWritten ?? 0}` },
    { title: "时间", dataIndex: "checkpointTime", render: (value) => formatDateTime(value) },
  ];

  const auditColumns: ColumnsType<SyncAuditRecord> = [
    { title: "动作", dataIndex: "actionType", render: (value) => <Tag>{labelOf(value || "UNKNOWN", auditActionLabels)}</Tag> },
    { title: "操作者", render: (_, record) => [labelOf(record.actorRole, actorRoleLabels), record.actorId].filter(Boolean).join(" / ") || "-" },
    { title: "结果", dataIndex: "result", render: (value) => value || "-" },
    { title: "链路追踪", dataIndex: "traceId", render: (value) => value ? <Typography.Text className="mono">{value}</Typography.Text> : "-" },
    { title: "时间", dataIndex: "createTime", render: (value) => formatDateTime(value) },
  ];

  const importRowColumns: ColumnsType<SyncTaskImportRowResult> = [
    { title: "文件行号", dataIndex: "rowNumber" },
    { title: "任务名称", dataIndex: "name", render: (value) => value || "-" },
    { title: "新任务 ID", dataIndex: "taskId", render: (value) => value || "-" },
    { title: "行状态", dataIndex: "status", render: (value) => <Tag>{labelOf(value, importStatusLabels)}</Tag> },
    { title: "任务状态", dataIndex: "currentState", render: (value) => value ? statusTag(value, stateColor, syncTaskStateLabels) : "-" },
    { title: "说明", dataIndex: "message", render: (value) => value || "-" },
  ];

  const batchItemColumns: ColumnsType<SyncTaskBatchItemResult> = [
    { title: "任务 ID", dataIndex: "taskId", render: (value) => value || "-" },
    { title: "结果任务", dataIndex: "resultTaskId", render: (value) => value || "-" },
    { title: "结果", dataIndex: "success", render: (value) => <Tag color={value ? "green" : "red"}>{value ? "成功" : "失败/跳过"}</Tag> },
    { title: "结果码", dataIndex: "code", render: (value) => <Tag>{value || "UNKNOWN"}</Tag> },
    { title: "任务状态", dataIndex: "state", render: (value) => value ? statusTag(value, stateColor, syncTaskStateLabels) : "-" },
    { title: "说明", dataIndex: "message", render: (value) => value || "-" },
  ];

  const stepItems = [
    { title: "源端/目标端" },
    { title: "对象映射" },
    { title: "字段/SQL" },
    { title: "预检查" },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="数据同步与离线传输"
        subtitle="真实源端数据库到目标端数据库的离线传输闭环、预检、执行、恢复和调度观测"
        actions={
          <>
            <DataSourceIndicator meta={templateQuery.data?.meta ?? dataSourceQuery.data?.meta} />
            <Button aria-label="刷新同步数据" title="刷新同步数据" icon={<ReloadOutlined />} onClick={refetchAll} />
            <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>导入任务定义</Button>
            <Button icon={<DownloadOutlined />} loading={exportMutation.isPending} onClick={() => exportMutation.mutate("CSV")}>导出任务定义</Button>
            <Button type="primary" icon={<CloudSyncOutlined />} onClick={openWizard}>新建同步任务</Button>
          </>
        }
      />

      <Alert
        showIcon
        type="success"
        message="当前页面按真实多服务端到端链路组织"
        description="覆盖建数据源后的模板创建、连接器兼容性、字段/对象映射、服务端校验、规划预览、执行预检、离线作业计划、任务发布、手工调度、执行器处理、定时派发、任务分组、回收站、任务定义 CSV/XLSX 导入导出、对象级失败重试、脏数据修复回放、断点记录和低敏审计。任务定义导入导出只处理控制面配置，不导出连接串、密码、完整 SQL 或客户业务数据。"
      />

      <div className="grid grid-three">
        <Card className="compact-card">
          <div className="split-row"><Typography.Text type="secondary">数据源</Typography.Text><CloudSyncOutlined style={{ color: "#2563eb" }} /></div>
          <div className="metric-value">{dataSourceQuery.data?.data.total ?? 0}</div>
          <div className="metric-delta">按源端/目标端用途区分的数据源</div>
        </Card>
        <Card className="compact-card">
          <div className="split-row"><Typography.Text type="secondary">同步模板</Typography.Text><CheckCircleOutlined style={{ color: "#0f9f6e" }} /></div>
          <div className="metric-value">{templateQuery.data?.data.total ?? 0}</div>
          <div className="metric-delta">来自真实后端的模板记录</div>
        </Card>
        <Card className="compact-card">
          <div className="split-row"><Typography.Text type="secondary">同步任务</Typography.Text><SyncOutlined style={{ color: "#d97706" }} /></div>
          <div className="metric-value">{allSyncTaskTotal}</div>
          <div className="metric-delta">{flatGroupNodes.length} 个任务分组，{recycleBinQuery.data?.data.total ?? 0} 个回收站任务</div>
        </Card>
      </div>

      <div className="sync-workbench">
        <aside className="sync-group-panel">
          <div className="sync-group-panel-header">
            <Space direction="vertical" size={0}>
              <Typography.Text strong>任务分组</Typography.Text>
              <Typography.Text type="secondary">按业务域管理同步任务</Typography.Text>
            </Space>
            <Space>
              <Button aria-label="新增分组" title="新增分组" icon={<PlusOutlined />} onClick={openCreateGroup} />
              <Button
                danger
                aria-label="删除分组"
                title="删除当前分组"
                icon={<DeleteOutlined />}
                disabled={!selectedGroupNode || selectedGroupNode.defaultGroup || selectedGroupNode.legacyOnly}
                loading={deleteGroupMutation.isPending}
                onClick={confirmDeleteSelectedGroup}
              />
            </Space>
          </div>
          <Tree
            selectedKeys={[selectedTreeKey]}
            defaultExpandAll
            treeData={groupTreeData}
            onSelect={(keys) => selectGroupTreeKey(keys[0])}
          />
          {selectedGroupNode ? (
            <div className="sync-group-panel-meta">
              <Typography.Text strong>{selectedGroupNode.displayName || selectedGroupNode.groupName || UNNAMED_SYNC_GROUP}</Typography.Text>
              <Space wrap>
                <Tag>列表 {syncGroupNormalTaskCount(selectedGroupNode)}</Tag>
                <Tag color="green">活跃 {syncGroupVisibleCount(selectedGroupNode, "subtreeActiveTaskCount", "activeTaskCount")}</Tag>
                <Tag color="blue">调度 {syncGroupVisibleCount(selectedGroupNode, "subtreeScheduledTaskCount", "scheduledTaskCount")}</Tag>
                <Tag color="red">失败 {syncGroupVisibleCount(selectedGroupNode, "subtreeFailedTaskCount", "failedTaskCount")}</Tag>
                <Tag>回收站 {syncGroupRecycledTaskCount(selectedGroupNode)}</Tag>
              </Space>
              {selectedGroupNode.displayPath ? <Typography.Text type="secondary">{selectedGroupNode.displayPath}</Typography.Text> : null}
              {selectedGroupNode.description ? <Typography.Text type="secondary">{selectedGroupNode.description}</Typography.Text> : null}
              {selectedGroupNode.legacyOnly ? <Alert showIcon type="warning" message="历史兼容分组" description="该编码来自历史任务聚合，尚不是正式分组资源。" /> : null}
            </div>
          ) : null}
        </aside>
        <section className="sync-content-panel">
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={[
          {
            key: "tasks",
            label: "同步任务运营",
            children: taskTreeView === "recycle" ? (
              <div className="page-stack">
                <Alert
                  showIcon
                  type="info"
                  message="回收站只展示已移入回收站的同步任务"
                  description="回收站任务不能直接运行或调度，但可以查看历史、克隆为新的编辑中任务，或在权限允许时彻底删除。任务进入回收站前必须先下线。"
                />
                <Card className="compact-card">
                  {renderBatchToolbar(selectedRecycleTaskRowKeys, true)}
                </Card>
                <Card className="table-card">
                  {recycleBinQuery.isError ? (
                    <Alert
                      showIcon
                      type="error"
                      message="回收站任务接口请求失败"
                      description={
                        recycleBinQuery.error instanceof Error
                          ? recycleBinQuery.error.message
                          : "请确认当前账号拥有该项目下同步任务回收站的查看权限。"
                      }
                      style={{ marginBottom: 12 }}
                    />
                  ) : null}
                  <Table
                    rowKey="id"
                    rowSelection={{
                      selectedRowKeys: selectedRecycleTaskRowKeys,
                      onChange: (keys) => setSelectedRecycleTaskRowKeys(keys.map((key) => Number(key)).filter(Number.isFinite)),
                    }}
                    columns={recycledTaskColumns}
                    dataSource={filteredRecycledTasks}
                    loading={recycleBinQuery.isLoading}
                    scroll={{ x: 1200 }}
                    locale={{ emptyText: <RealEmpty meta={recycleBinQuery.data?.meta} description="暂无回收站任务" /> }}
                    pagination={{
                      current: recycleTaskPage,
                      pageSize: SYNC_TASK_TABLE_PAGE_SIZE,
                      total: recycleBinQuery.data?.data.total ?? 0,
                      showSizeChanger: false,
                      onChange: (page) => setRecycleTaskPage(page),
                    }}
                  />
                </Card>
              </div>
            ) : (
              <div className="page-stack">
                <Card className="compact-card">
                  <div className="toolbar" style={{ gap: 12, flexWrap: "wrap" }}>
                    <Input allowClear prefix={<SearchOutlined />} placeholder="搜索任务、分组、状态" value={taskKeyword} onChange={(event) => setTaskKeyword(event.target.value)} style={{ width: 300 }} />
                    <Select
                      allowClear
                      placeholder="按分组筛选"
                      value={taskGroupFilter}
                      onChange={(value) => {
                        setTaskGroupFilter(value);
                        const selectedGroup = findGroupNode(value);
                        setTaskGroupTreeKeyFilter(selectedGroup?.uiKey);
                        setTaskTreeView("tasks");
                      }}
                      options={groupOptions}
                      style={{ width: 240 }}
                    />
                    <Select
                      allowClear
                      placeholder="按任务状态筛选"
                      value={taskStateFilter}
                      onChange={setTaskStateFilter}
                      options={optionsOf(taskStateOptions, syncTaskStateLabels)}
                      style={{ width: 180 }}
                    />
                    <Select
                      allowClear
                      placeholder="按审批状态筛选"
                      value={taskApprovalFilter}
                      onChange={setTaskApprovalFilter}
                      options={optionsOf(["NOT_REQUIRED", "PENDING", "APPROVED", "REJECTED"], approvalLabels)}
                      style={{ width: 180 }}
                    />
                    <Button onClick={() => {
                      setTaskGroupFilter(undefined);
                      setTaskGroupTreeKeyFilter(undefined);
                      setTaskTreeView("tasks");
                      setTaskStateFilter(undefined);
                      setTaskApprovalFilter(undefined);
                    }}>
                      清空筛选
                    </Button>
                    <Button icon={<DownloadOutlined />} loading={exportMutation.isPending} onClick={() => exportMutation.mutate("XLSX")}>
                      导出 Excel
                    </Button>
                  </div>
                </Card>
                <Card className="compact-card">
                  {renderBatchToolbar(selectedTaskRowKeys, false)}
                </Card>
                <Card className="table-card">
                  {taskQuery.isError ? (
                    <Alert
                      showIcon
                      type="error"
                      message="同步任务列表接口请求失败"
                      description={
                        taskQuery.error instanceof Error
                          ? taskQuery.error.message
                          : "请确认已经登录，并且当前账号拥有该项目下同步任务的查看权限。"
                      }
                      style={{ marginBottom: 12 }}
                    />
                  ) : null}
                  <Table
                    rowKey="id"
                    rowSelection={{
                      selectedRowKeys: selectedTaskRowKeys,
                      onChange: (keys) => setSelectedTaskRowKeys(keys.map((key) => Number(key)).filter(Number.isFinite)),
                    }}
                    columns={taskColumns}
                    dataSource={filteredTasks}
                    loading={taskQuery.isLoading}
                    scroll={{ x: 1520 }}
                    locale={{ emptyText: <RealEmpty meta={taskQuery.data?.meta} description="暂无同步任务记录" /> }}
                    pagination={{
                      current: taskPage,
                      pageSize: SYNC_TASK_TABLE_PAGE_SIZE,
                      total: taskQuery.data?.data.total ?? 0,
                      showSizeChanger: false,
                      onChange: (page) => setTaskPage(page),
                    }}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: "templates",
            label: "同步模板",
            children: (
              <div className="page-stack">
                <Card className="compact-card">
                  <div className="toolbar">
                    <Input allowClear prefix={<SearchOutlined />} placeholder="搜索模板、对象、模式" value={templateKeyword} onChange={(event) => setTemplateKeyword(event.target.value)} style={{ width: 300 }} />
                  </div>
                </Card>
                <Card className="table-card">
                  <Table rowKey="id" columns={templateColumns} dataSource={filteredTemplates} loading={templateQuery.isLoading} locale={{ emptyText: <RealEmpty meta={templateQuery.data?.meta} description="暂无同步模板记录" /> }} pagination={{ pageSize: 8, showSizeChanger: false }} />
                </Card>
              </div>
            ),
          },
          {
            key: "capabilities",
            label: "连接器能力",
            children: <Card className="table-card"><Table rowKey="connectorType" columns={capabilityColumns} dataSource={capabilities} loading={capabilityQuery.isLoading} pagination={{ pageSize: 8, showSizeChanger: false }} /></Card>,
          },
          {
            key: "incidents",
            label: "事故",
            children: <Card className="table-card"><Table rowKey="id" columns={incidentColumns} dataSource={incidents} loading={incidentQuery.isLoading} locale={{ emptyText: <RealEmpty meta={incidentQuery.data?.meta} description="暂无同步事故记录" /> }} pagination={{ pageSize: 8, showSizeChanger: false }} /></Card>,
          },
          {
            key: "runtime",
            label: "调度与执行器",
            children: (
              <div className="page-stack">
                <Alert
                  showIcon
                  type="warning"
                  message="受控执行入口"
                  description="定时派发器会把到期任务生成执行记录；同步执行器会认领排队中的执行记录，并可能触发真实源端读取和目标端写入。当前网关策略下，内部机器协议只应由服务账号调用，人类角色可能返回 403，并落权限中心拒绝审计。"
                />
                <div className="grid grid-two">
                  <Card className="compact-card" title="定时派发器">
                    <Form<SyncTaskScheduleDispatchPayload>
                      form={schedulerForm}
                      layout="vertical"
                      initialValues={{ dryRun: true, limit: 10 }}
                      onFinish={(values) => schedulerMutation.mutate(values)}
                    >
                      <div className="grid grid-two-form">
                        <Form.Item name="tenantId" label="租户过滤">
                          <InputNumber min={1} style={{ width: "100%" }} />
                        </Form.Item>
                        <Form.Item name="limit" label="扫描上限">
                          <InputNumber min={1} max={100} style={{ width: "100%" }} />
                        </Form.Item>
                      </div>
                      <Form.Item name="dryRun" valuePropName="checked">
                        <Checkbox>仅预览，不创建执行记录</Checkbox>
                      </Form.Item>
                      <Button type="primary" icon={<PlayCircleOutlined />} loading={schedulerMutation.isPending} onClick={() => schedulerForm.submit()}>
                        触发定时派发
                      </Button>
                    </Form>
                  </Card>
                  <Card className="compact-card" title="同步执行器">
                    <Form<SyncWorkerLoopRunPayload>
                      form={workerForm}
                      layout="vertical"
                      initialValues={{ executorId: "frontend-ops-console", maxExecutions: 1, leaseSeconds: 300 }}
                      onFinish={(values) => workerLoopMutation.mutate(values)}
                    >
                      <div className="grid grid-two-form">
                        <Form.Item name="executorId" label="执行器标识">
                          <Input />
                        </Form.Item>
                        <Form.Item name="tenantId" label="租户过滤">
                          <InputNumber min={1} style={{ width: "100%" }} />
                        </Form.Item>
                      </div>
                      <div className="grid grid-two-form">
                        <Form.Item name="maxExecutions" label="最多处理">
                          <InputNumber min={1} max={50} style={{ width: "100%" }} />
                        </Form.Item>
                        <Form.Item name="leaseSeconds" label="租约秒数">
                          <InputNumber min={30} max={1800} style={{ width: "100%" }} />
                        </Form.Item>
                      </div>
                      <Button type="primary" icon={<SyncOutlined />} loading={workerLoopMutation.isPending} onClick={() => workerForm.submit()}>
                        触发执行器单轮处理
                      </Button>
                    </Form>
                  </Card>
                </div>
              </div>
            ),
          },
          {
            key: "etl",
            label: "数据加工状态",
            children: (
              <div className="grid grid-three">
                <div className="timeline-item"><Typography.Text strong>已闭环</Typography.Text><div className="metric-delta">全量传输、定期全量、定期批量、SQL 语句结果集、按 Schema/全库发现拆分、对象级失败重试、脏数据修复回放。</div></div>
                <div className="timeline-item"><Typography.Text strong>边界</Typography.Text><div className="metric-delta">全库迁移 v1 不自动建目标表，不做复杂建表语句兼容转换；目标表结构与命名策略仍需客户或运维确认。</div></div>
                <div className="timeline-item"><Typography.Text strong>执行证据</Typography.Text><div className="metric-delta">执行历史、对象级账本、错误样本、断点记录、同步审计和权限中心授权审计共同构成闭环证据。</div></div>
              </div>
            ),
          },
        ]}
      />
        </section>
      </div>

      <Modal
        title="新增任务分组"
        open={createGroupOpen}
        onCancel={() => {
          setCreateGroupOpen(false);
          createGroupForm.resetFields();
        }}
        onOk={() => createGroupForm.submit()}
        okText="创建分组"
        confirmLoading={createGroupMutation.isPending}
        destroyOnHidden
        forceRender
      >
        <Form<CreateSyncTaskGroupPayload>
          form={createGroupForm}
          layout="vertical"
          onFinish={(values) =>
            createGroupMutation.mutate(
              compactPayload({
                ...values,
                groupCode: generateResourceCode("GROUP"),
                displayOrder: 100,
              }),
            )
          }
        >
          <Alert
            showIcon
            type="info"
            message="分组是同步任务的运营资源"
            description="创建后会出现在中间分组树中，可用于新建任务、编辑任务、导入导出和后续批量运营。你只需要维护业务名称，系统会处理内部唯一标识。"
            style={{ marginBottom: 16 }}
          />
          <Form.Item name="parentGroupCode" label="父分组">
            <Select allowClear showSearch options={groupOptions} placeholder="留空表示一级分组" />
          </Form.Item>
          <Form.Item name="groupName" label="分组名称" rules={[{ required: true, message: "请输入分组名称" }]}>
            <Input placeholder="订单域同步" />
          </Form.Item>
          <Form.Item name="description" label="分组说明">
            <Input.TextArea rows={3} placeholder="例如：订单域离线同步任务、客户迁移第三批" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新建同步任务"
        open={wizardOpen}
        onCancel={() => setWizardOpen(false)}
        width={1180}
        footer={
          <Space>
            <Button onClick={() => setWizardOpen(false)}>取消</Button>
            <Button disabled={wizardStep === 0} onClick={() => setWizardStep((step) => Math.max(0, step - 1))}>上一步</Button>
            {wizardStep < stepItems.length - 1 ? (
              <Button type="primary" loading={wizardSaving || discoverSourceMutation.isPending || discoverTargetMutation.isPending} onClick={goNextWizardStep}>
                {wizardStep === 0 ? "保存并进入对象映射" : "保存并进入下一步"}
              </Button>
            ) : (
              <Button type="primary" loading={wizardSaving || wizardPrecheckLoading} disabled={!canSubmitWizard || !wizardDraft?.templateId} onClick={submitWizard}>重新保存并运行预检查</Button>
            )}
          </Space>
        }
        destroyOnHidden
        forceRender
      >
        <div className="page-stack">
          <Steps current={wizardStep} items={stepItems} />
          <Form<SyncWizardValues> form={wizardForm} layout="vertical" onValuesChange={() => setWizardVersion((value) => value + 1)}>
            <div style={{ display: wizardStep === 0 ? "block" : "none" }}>
              <Alert showIcon type="info" message="选择传输模式和源端/目标端" description="任务会自动归属到当前项目；源端只展示可作为源端的数据源，目标端只展示可作为目标端的数据源。进入下一步时会自动拉取两端元数据。" />
              <div className="scope-summary" style={{ marginTop: 16 }}>
                <Typography.Text strong>当前上下文</Typography.Text>
                <Typography.Text type="secondary">{currentProjectLabel}</Typography.Text>
              </div>
              <div className="grid grid-two-form" style={{ marginTop: 16 }}>
                <Form.Item name="taskName" label="任务名称" rules={[{ required: true, message: "请输入任务名称" }]}>
                  <Input placeholder="例如：会员数据全量同步到 PostgreSQL" />
                </Form.Item>
                <Form.Item name="groupCode" label="任务分组">
                  <Select
                    allowClear
                    showSearch
                    options={groupOptions}
                    placeholder="默认进入默认分组"
                    onChange={(value) => {
                      const group = findGroupNode(value);
                      wizardForm.setFieldsValue({ groupName: group?.groupName });
                    }}
                  />
                </Form.Item>
              </div>
              <Form.Item name="groupName" hidden><Input /></Form.Item>
              <Form.Item name="taskDescription" label="任务说明">
                <Input.TextArea rows={2} placeholder="可选，说明本任务的业务目的、数据范围或负责人约定" />
              </Form.Item>
              <Form.Item name="transferMode" label="传输模式" rules={[{ required: true, message: "请选择传输模式" }]} style={{ marginTop: 16 }}>
                <Select options={transferModeOptions} onChange={applyTransferMode} />
              </Form.Item>
              <div className="grid grid-two-form">
                <Form.Item name="sourceDatasourceId" label="源端数据源" rules={[{ required: true, message: "请选择源端数据源" }]}>
                  <Select showSearch options={sourceDataSourceOptions} placeholder="只显示源端可用数据源" onChange={(value) => selectDatasource("sourceDatasourceId", value)} />
                </Form.Item>
                <Form.Item name="targetDatasourceId" label="目标端数据源" rules={[{ required: true, message: "请选择目标端数据源" }]}>
                  <Select showSearch options={targetDataSourceOptions} placeholder="只显示目标端可用数据源" onChange={(value) => selectDatasource("targetDatasourceId", value)} />
                </Form.Item>
              </div>
              <Form.Item name="sourceConnectorType" hidden><Input /></Form.Item>
              <Form.Item name="targetConnectorType" hidden><Input /></Form.Item>
              {["SCHEDULED_FULL", "SCHEDULED_BATCH"].includes(String(wizardForm.getFieldValue("syncMode") || "").toUpperCase()) ? (
                <Form.Item name="scheduleConfig" label="定时配置" rules={[{ required: true, message: "定期全量/定期批量必须配置调度规则" }]}>
                  <Input.TextArea rows={2} placeholder='{"cron":"0 0 2 * * ?","timezone":"Asia/Shanghai"}' />
                </Form.Item>
              ) : null}
            </div>

            <div style={{ display: wizardStep === 1 ? "block" : "none" }}>
              <Alert showIcon type="info" message="对象映射" description="通过搜索和选择配置源端对象与目标端对象；源端 Schema、表名和目标端 Schema、表名都可以在下方修改映射名称。" />
              {!sqlTransferMode ? (
                <Form.Item name="objectScopeType" label="传输对象范围" style={{ marginTop: 16 }}>
                  <Radio.Group optionType="button" buttonStyle="solid" options={availableObjectScopeOptions} onChange={(event) => applyObjectScopeType(event.target.value)} />
                </Form.Item>
              ) : null}
              <div className="grid grid-two-form">
                {!sqlTransferMode ? (
                  <div className="object-browser">
                    <Space direction="vertical" style={{ width: "100%" }}>
                      <Typography.Text strong>源端对象</Typography.Text>
                      <Input allowClear prefix={<SearchOutlined />} placeholder="搜索源端 Schema 或表名" value={sourceObjectKeyword} onChange={(event) => setSourceObjectKeyword(event.target.value)} />
                      {sourceSchemaCapable && sourceSchemaOptions.length ? (
                        <Space wrap>
                          <Button size="small" type={!sourceSchemaFilter ? "primary" : "default"} onClick={() => selectSourceSchema(undefined)}>全部 Schema</Button>
                          {sourceSchemaOptions.slice(0, 12).map((schema) => (
                            <Button
                              key={schema.value}
                              size="small"
                              type={sourceSchemaFilter === schema.value ? "primary" : "default"}
                              onClick={() => selectSourceSchema(schema.value)}
                            >
                              {schema.label}
                            </Button>
                          ))}
                        </Space>
                      ) : null}
                      {objectListTransferMode ? (
                        <Space wrap>
                          <Button size="small" onClick={() => sourceObjectRows.forEach((row) => toggleSourceObjectMapping(row.index, true))}>批量加入当前列表</Button>
                          {schemaObjectSelectionMode ? <Button size="small" type="primary" onClick={() => addSourceSchemaTables(sourceSchemaFilter)}>加入当前 Schema 全部表</Button> : null}
                          <Button size="small" onClick={clearObjectSelections}>清空已选</Button>
                        </Space>
                      ) : null}
                      <Table
                        rowKey="key"
                        size="small"
                        tableLayout="fixed"
                        scroll={{ x: 560 }}
                        columns={[
                          { title: "Schema", dataIndex: "schemaName", width: 140, ellipsis: true, render: (value) => value || "默认" },
                          {
                            title: "表/对象",
                            dataIndex: "tableName",
                            width: 250,
                            render: (value) => <Typography.Text ellipsis={{ tooltip: value }}>{value}</Typography.Text>,
                          },
                          { title: "字段", dataIndex: "fieldCount", width: 72, align: "center" },
                          {
                            title: databaseTransferMode ? "排除" : objectListTransferMode ? "加入" : "选择",
                            width: 90,
                            align: "center",
                            render: (_, record) => databaseTransferMode
                              ? <Checkbox checked={excludedSourceObjects.includes(record.key)} onChange={(event) => setExcludedSourceObjects((keys) => event.target.checked ? [...keys, record.key] : keys.filter((key) => key !== record.key))} />
                              : objectListTransferMode
                                ? <Checkbox checked={selectedObjectMappingKeys.includes(record.key)} onChange={(event) => toggleSourceObjectMapping(record.index, event.target.checked)} />
                                : <Button size="small" onClick={() => applySourceTable(record.index)}>选择</Button>,
                          },
                        ]}
                        dataSource={sourceObjectRows}
                        pagination={{ pageSize: sourceObjectPageSize, showSizeChanger: true, pageSizeOptions: [5, 10, 20, 50], onShowSizeChange: (_, size) => setSourceObjectPageSize(size), onChange: (_, size) => size && setSourceObjectPageSize(size) }}
                      />
                    </Space>
                  </div>
                ) : <Alert showIcon type="info" message="SQL 语句模式" description="源端结果集由下一步的只读 SQL 决定，这里只需要选择或填写目标表。" />}
                <div className="object-browser">
                  <Space direction="vertical" style={{ width: "100%" }}>
                    <Typography.Text strong>目标端对象</Typography.Text>
                    <Input allowClear prefix={<SearchOutlined />} placeholder="搜索目标端 Schema 或表名" value={targetObjectKeyword} onChange={(event) => setTargetObjectKeyword(event.target.value)} />
                    {targetSchemaOptions.length ? (
                      <Space wrap>
                        <Button size="small" type={!targetSchemaFilter ? "primary" : "default"} onClick={() => selectTargetSchema(undefined)}>全部 Schema</Button>
                        {targetSchemaOptions.slice(0, 12).map((schema) => (
                          <Button
                            key={schema.value}
                            size="small"
                            type={targetSchemaFilter === schema.value ? "primary" : "default"}
                            onClick={() => selectTargetSchema(schema.value)}
                          >
                            {schema.label}
                          </Button>
                        ))}
                        {targetSchemaFilter ? <Button size="small" onClick={() => applyTargetSchemaToMappings(targetSchemaFilter)}>批量设为目标 Schema</Button> : null}
                      </Space>
                    ) : null}
                    <Table
                      rowKey="key"
                      size="small"
                      tableLayout="fixed"
                      scroll={{ x: 560 }}
                      columns={[
                        { title: "Schema", dataIndex: "schemaName", width: 140, ellipsis: true, render: (value) => value || "默认" },
                        {
                          title: "表/对象",
                          dataIndex: "tableName",
                          width: 250,
                          render: (value) => <Typography.Text ellipsis={{ tooltip: value }}>{value}</Typography.Text>,
                        },
                        { title: "字段", dataIndex: "fieldCount", width: 72, align: "center" },
                        {
                          title: sqlTransferMode ? "选择" : "设为目标",
                          width: 90,
                          align: "center",
                          render: (_, record) => sqlTransferMode
                            ? <Button size="small" onClick={() => applyTargetTable(record.index)}>选择</Button>
                            : <Button size="small" disabled={!activeObjectMapping} onClick={() => applyTargetTable(record.index)}>套用</Button>,
                        },
                      ]}
                      dataSource={targetObjectRows}
                      pagination={{ pageSize: targetObjectPageSize, showSizeChanger: true, pageSizeOptions: [5, 10, 20, 50], onShowSizeChange: (_, size) => setTargetObjectPageSize(size), onChange: (_, size) => size && setTargetObjectPageSize(size) }}
                    />
                  </Space>
                </div>
              </div>
              {!sqlTransferMode && databaseTransferMode ? (
                <div className="grid grid-two-form" style={{ marginTop: 16 }}>
                  <Form.Item name="sourceSchemaName" label="源端 Schema"><Input placeholder="可选，留空表示由服务端发现全库范围" /></Form.Item>
                  <Form.Item
                    name="targetSchemaName"
                    label="目标端 Schema"
                    rules={targetSchemaCapable ? [{ required: true, message: "PostgreSQL/SQL Server 目标端必须填写 Schema；MySQL/MariaDB 不需要" }] : undefined}
                  >
                    <Input placeholder={targetSchemaCapable ? "例如 public / dwd" : "MySQL/MariaDB 无需填写 Schema"} />
                  </Form.Item>
                </div>
              ) : null}
              {sqlTransferMode ? (
                <div className="grid grid-two-form" style={{ marginTop: 16 }}>
                  <Form.Item
                    name="targetSchemaName"
                    label="目标端 Schema"
                    rules={targetSchemaCapable ? [{ required: true, message: "PostgreSQL/SQL Server 目标端必须填写 Schema；MySQL/MariaDB 不需要" }] : undefined}
                  >
                    <Input placeholder={targetSchemaCapable ? "例如 public / dwd" : "MySQL/MariaDB 无需填写 Schema"} />
                  </Form.Item>
                  <Form.Item name="targetObjectName" label="目标端表/对象名" rules={[{ required: true, message: "请选择或填写目标端表/对象" }]}><Input placeholder="dwd_customer_member" /></Form.Item>
                </div>
              ) : null}
              {!sqlTransferMode && !databaseTransferMode ? (
                <Card className="compact-card" title="已选对象映射" style={{ marginTop: 16 }}>
                  <Table
                    rowKey="key"
                    size="small"
                    columns={objectMappingColumns}
                    dataSource={objectMappings}
                    pagination={{
                      pageSize: mappingObjectPageSize,
                      showSizeChanger: true,
                      pageSizeOptions: [5, 10, 20, 50],
                      onShowSizeChange: (_, size) => setMappingObjectPageSize(size),
                      onChange: (_, size) => size && setMappingObjectPageSize(size),
                    }}
                    locale={{ emptyText: "请从源端对象列表中选择需要传输的表；按 Schema 传输请先点击 Schema 后批量加入当前列表" }}
                  />
                </Card>
              ) : null}
              {databaseTransferMode && excludedSourceObjects.length ? (
                <Alert showIcon type="warning" message={`已排除 ${excludedSourceObjects.length} 个源端对象`} style={{ marginTop: 16 }} />
              ) : null}
            </div>

            <div style={{ display: wizardStep === 2 ? "block" : "none" }}>
              {sqlTransferMode ? <div className="page-stack"><Form.Item name="customSqlText" label="只读 SQL" rules={[{ required: true, message: "请输入只读 SQL" }]}><Input.TextArea rows={6} placeholder="select id, name as member_name, updated_at from public.customer_member where updated_at >= :start" /></Form.Item><Button icon={<CheckCircleOutlined />} onClick={checkCustomSql}>检查 SQL 语法和表存在性</Button><Alert showIcon type="info" message="字段映射使用 SQL 结果字段" description="如果 SQL 中使用别名，源字段请填写别名；目标字段从目标表元数据中选择或手工输入。目标字段仍以目标表真实元数据为准，不会直接照搬源字段。" /></div> : null}
              {fieldMappingTransferMode ? (
                <>
                  {!sqlTransferMode ? (
                    <Card className="compact-card" title="逐对象字段映射" style={{ marginBottom: 12 }}>
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <Table
                          rowKey="key"
                          size="small"
                          columns={fieldMappingObjectColumns}
                          dataSource={objectMappings}
                          rowClassName={(record) => record.key === activeObjectMapping?.key ? "table-row-selected" : ""}
                          pagination={{
                            pageSize: mappingObjectPageSize,
                            showSizeChanger: true,
                            pageSizeOptions: [5, 10, 20, 50],
                            onShowSizeChange: (_, size) => setMappingObjectPageSize(size),
                            onChange: (_, size) => size && setMappingObjectPageSize(size),
                          }}
                          locale={{ emptyText: "请先在对象映射步骤选择源端表，并填写目标端 schema/table" }}
                        />
                        {activeObjectMapping ? (
                          <div className="page-stack">
                            <Alert
                              showIcon
                              type="info"
                              message={`当前配置对象：${compactObjectName(activeObjectMapping.sourceSchemaName, activeObjectMapping.sourceObjectName)} -> ${compactObjectName(activeObjectMapping.targetSchemaName, activeObjectMapping.targetObjectName)}`}
                              description={activeObjectEditor === "WHERE"
                                ? "当前正在编辑该对象自己的 where 条件。该条件会随对象映射一起保存，执行时只作用于这一张源表或对象。"
                                : "当前正在编辑该对象的字段映射。默认以源表字段为主生成，目标端同名字段会自动预填，未匹配字段可手工选择目标字段。"}
                            />
                            {activeObjectEditor === "WHERE" ? (
                              /*
                               * where 条件改为对象级配置。
                               * 全局过滤 JSON 已经移除，因为它和“逐对象 where + 批量套用 where”表达的是同一类过滤能力。
                               * 对象级 where 更符合多表同步：不同表可以有不同过滤条件，批量套用只是快速填写，不会破坏逐对象可编辑性。
                               */
                              <div className="page-stack">
                                <Input.TextArea
                                  rows={3}
                                  value={activeObjectMapping.whereCondition}
                                  placeholder="当前对象 where 条件，例如 status = 1；为空表示不过滤"
                                  onChange={(event) => updateObjectMapping(activeObjectMapping.key, { whereCondition: event.target.value })}
                                />
                                <Space.Compact>
                                  <Input
                                    value={batchWhereCondition}
                                    placeholder="批量 where 条件"
                                    onChange={(event) => setBatchWhereCondition(event.target.value)}
                                  />
                                  <Button onClick={() => setObjectMappings((rows) => rows.map((row) => ({ ...row, whereCondition: batchWhereCondition })))}>批量套用</Button>
                                </Space.Compact>
                              </div>
                            ) : (
                              <Alert
                                showIcon
                                type="success"
                                message={`已按源表字段生成 ${activeFieldMappings.length} 条候选字段映射`}
                                description="没有目标端同名字段的源字段默认不勾选，避免把不存在的目标字段强行写入；如目标表字段名称不同，可以在目标字段列手工填写或选择。"
                              />
                            )}
                          </div>
                        ) : null}
                      </Space>
                    </Card>
                  ) : null}
                  {sqlTransferMode || activeObjectEditor === "FIELDS" ? (
                    <>
                      <div className="toolbar" style={{ marginBottom: 12 }}>
                        <Button icon={<PlusOutlined />} onClick={addMapping}>添加字段映射</Button>
                        {!sqlTransferMode ? (
                          <Button
                            icon={<SyncOutlined />}
                            disabled={!activeObjectMapping}
                            onClick={() => {
                              if (!activeObjectMapping) return;
                              setFieldMappingsByObjectKey((rows) => ({
                                ...rows,
                                [activeObjectMapping.key]: makeFieldMappingsForObject(activeObjectMapping),
                              }));
                            }}
                          >
                            按同名字段自动映射
                          </Button>
                        ) : null}
                      </div>
                      <Table
                        rowKey="key"
                        columns={mappingColumns}
                        dataSource={activeFieldMappings}
                        pagination={{
                          pageSize: fieldMappingPageSize,
                          showSizeChanger: true,
                          pageSizeOptions: [5, 10, 20, 50, 100],
                          onShowSizeChange: (_, size) => setFieldMappingPageSize(size),
                          onChange: (_, size) => size && setFieldMappingPageSize(size),
                        }}
                      />
                    </>
                  ) : null}
                </>
              ) : <Alert showIcon type="info" message="Schema/全库模式字段映射由服务端逐对象预检查" description="前端维护对象选择、表名映射和排除清单；目标表主键、字段数量、外键、类型兼容等由服务端预检返回。" />}
              <div className="grid grid-two-form" style={{ marginTop: 16 }}><Form.Item name="writeStrategy" label="写入策略"><Select options={optionsOf(writeStrategies, syncWriteStrategyLabels)} /></Form.Item><Form.Item name="priority" label="任务优先级"><Select options={optionsOf(["LOW", "MEDIUM", "HIGH", "URGENT"], priorityLabels)} /></Form.Item></div>
            </div>

            <div style={{ display: wizardStep === 3 ? "block" : "none" }}>
              <Alert
                showIcon
                type={wizardPrecheckLoading
                  ? "info"
                  : wizardPrecheckWorstStatus === "BLOCKED"
                    ? "error"
                    : wizardPrecheckWorstStatus === "WARNING"
                      ? "warning"
                      : wizardPrecheckWorstStatus === "PASS"
                        ? "success"
                        : "info"}
                message={wizardPrecheckLoading ? "正在自动运行服务端预检查" : wizardPrecheckStatusMessage[wizardPrecheckWorstStatus]}
                description="预检查会按传输模式、写入策略、对象映射、字段映射、SQL 安全、连接器能力和当前执行器边界逐项判断。通过项表示当前配置满足该规则；不通过项需要返回对应步骤修复；需确认项表示当前系统缺少行数估算、容量评估等更深度探测，不能伪装成已通过。"
                style={{ marginBottom: 12 }}
              />
              <Table
                rowKey="key"
                size="small"
                columns={wizardPrecheckColumns}
                dataSource={wizardPrecheckItems}
                pagination={false}
                loading={wizardPrecheckLoading}
                style={{ marginTop: 12 }}
              />
              {wizardDraft ? (
                <Descriptions size="small" column={2} style={{ marginTop: 16 }}>
                  <Descriptions.Item label="草稿任务 ID">{wizardDraft.taskId}</Descriptions.Item>
                  <Descriptions.Item label="草稿模板 ID">{wizardDraft.templateId}</Descriptions.Item>
                  <Descriptions.Item label="任务状态">编辑中 / DRAFT</Descriptions.Item>
                  <Descriptions.Item label="服务端状态">{wizardPrecheckResult?.precheckStatus || "未返回"}</Descriptions.Item>
                  <Descriptions.Item label="可执行">{wizardPrecheckResult?.canStartExecution ? "是" : "否"}</Descriptions.Item>
                </Descriptions>
              ) : null}
            </div>
          </Form>
        </div>
      </Modal>
      <Modal
        title={wizardPrecheckDetail ? `配置详情：${wizardPrecheckDetail.title}` : "配置详情"}
        open={Boolean(wizardPrecheckDetail)}
        onCancel={() => setWizardPrecheckDetail(null)}
        footer={(
          <Space>
            {wizardPrecheckDetail?.step != null && wizardPrecheckDetail.step < 3 && wizardPrecheckDetail.status !== "PASS" ? (
              <Button
                type="primary"
                onClick={() => {
                  setWizardStep(wizardPrecheckDetail.step!);
                  setWizardPrecheckDetail(null);
                }}
              >
                返回{wizardPrecheckDetail.stepName || "对应步骤"}配置
              </Button>
            ) : null}
            <Button onClick={() => setWizardPrecheckDetail(null)}>关闭</Button>
          </Space>
        )}
        destroyOnHidden
      >
        {wizardPrecheckDetail ? (
          <div className="page-stack">
            <Descriptions size="small" column={1}>
              <Descriptions.Item label="检查分类">{wizardPrecheckDetail.category}</Descriptions.Item>
              <Descriptions.Item label="检查状态">{renderWizardPrecheckStatus(wizardPrecheckDetail.status)}</Descriptions.Item>
              <Descriptions.Item label="对应步骤">{wizardPrecheckDetail.stepName || "预检查"}</Descriptions.Item>
            </Descriptions>
            <Alert
              showIcon
              type={wizardPrecheckDetail.status === "BLOCKED" ? "error" : wizardPrecheckDetail.status === "WARNING" ? "warning" : "info"}
              message={wizardPrecheckDetail.summary}
            />
            <div>
              <Typography.Text strong>问题和解决方法</Typography.Text>
              <div className="page-stack" style={{ marginTop: 8 }}>
                {wizardPrecheckDetail.details.map((detail, index) => (
                  <Typography.Paragraph key={`${wizardPrecheckDetail.key}-detail-${index}`} style={{ marginBottom: 4 }}>
                    {detail}
                  </Typography.Paragraph>
                ))}
              </div>
            </div>
            {wizardPrecheckDetail.issueCodes?.length ? (
              <div>
                <Typography.Text strong>排障信息（可选）</Typography.Text>
                <div style={{ marginTop: 8 }}>
                  <Space wrap>
                    {wizardPrecheckDetail.issueCodes.map((code) => <Tag key={code}>{code}</Tag>)}
                  </Space>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
      <Modal
        title="编辑同步任务定义"
        open={Boolean(editTask)}
        onCancel={() => {
          setEditTask(null);
          editTaskForm.resetFields();
        }}
        onOk={() => editTaskForm.submit()}
        confirmLoading={taskDefinitionMutation.isPending}
        destroyOnHidden
        forceRender
      >
        <Form<UpdateSyncTaskPayload>
          form={editTaskForm}
          layout="vertical"
          onFinish={(values) => {
            if (!editTask) return;
            taskDefinitionMutation.mutate({ id: editTask.id, action: "edit", payload: compactPayload(values) });
            setEditTask(null);
            editTaskForm.resetFields();
          }}
        >
          <Alert showIcon type="info" message="只编辑任务定义，不触发真实同步" description="修改调度配置或清空调度配置后，后端会把任务退回编辑中，必须重新发布后才会进入可执行或等待调度状态。" style={{ marginBottom: 16 }} />
          <Form.Item name="name" label="任务名称" rules={[{ required: true, message: "请输入任务名称" }]}>
            <Input />
          </Form.Item>
          <div className="grid grid-two-form">
            <Form.Item name="priority" label="优先级">
              <Select options={optionsOf(["LOW", "MEDIUM", "HIGH", "URGENT"], priorityLabels)} />
            </Form.Item>
            <Form.Item name="ownerId" label="负责人 ID">
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>
          </div>
          <div className="grid grid-two-form">
            <Form.Item name="groupCode" label="任务分组">
              <Select
                allowClear
                showSearch
                options={groupOptions}
                placeholder="选择任务分组"
                onChange={(value) => {
                  const group = findGroupNode(value);
                  editTaskForm.setFieldsValue({ groupName: group?.groupName });
                }}
              />
            </Form.Item>
            <Form.Item name="groupName" hidden>
              <Input />
            </Form.Item>
          </div>
          <Form.Item name="clearGroup" valuePropName="checked">
            <Checkbox>移出当前分组</Checkbox>
          </Form.Item>
          <Form.Item name="scheduleConfig" label="调度配置 JSON">
            <Input.TextArea rows={3} placeholder='{"cron":"0 0 2 * * ?","timezone":"Asia/Shanghai"}' />
          </Form.Item>
          <Form.Item name="clearScheduleConfig" valuePropName="checked">
            <Checkbox>清空调度配置并关闭自动调度</Checkbox>
          </Form.Item>
          <Form.Item name="description" label="任务说明">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="reason" label="编辑原因">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="发布同步任务定义"
        open={Boolean(publishTask)}
        onCancel={() => {
          setPublishTask(null);
          publishForm.resetFields();
        }}
        onOk={() => publishForm.submit()}
        confirmLoading={taskDefinitionMutation.isPending}
        destroyOnHidden
        forceRender
      >
        <Form<PublishSyncTaskPayload>
          form={publishForm}
          layout="vertical"
          onFinish={(values) => {
            if (!publishTask) return;
            taskDefinitionMutation.mutate({ id: publishTask.id, action: "publish", payload: compactPayload(values) });
            setPublishTask(null);
            publishForm.resetFields();
          }}
        >
          <Alert showIcon type="warning" message="发布不会立即搬运数据" description="发布会重新执行服务端预检和调度配置解析，然后进入已配置或等待调度。需要立即执行时，请发布后点击“立即执行一次”。" style={{ marginBottom: 16 }} />
          <Form.Item name="enableSchedule" valuePropName="checked">
            <Checkbox>发布后启用周期调度</Checkbox>
          </Form.Item>
          <Form.Item name="reason" label="发布原因">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="调整同步任务分组"
        open={Boolean(groupTask)}
        onCancel={() => {
          setGroupTask(null);
          groupForm.resetFields();
        }}
        onOk={() => groupForm.submit()}
        confirmLoading={taskDefinitionMutation.isPending}
        destroyOnHidden
        forceRender
      >
        <Form<UpdateSyncTaskGroupPayload>
          form={groupForm}
          layout="vertical"
          onFinish={(values) => {
            if (!groupTask) return;
            taskDefinitionMutation.mutate({ id: groupTask.id, action: "group", payload: compactPayload(values) });
            setGroupTask(null);
            groupForm.resetFields();
          }}
        >
          <Alert showIcon type="info" message="分组只改变运营归类" description="移组不会触发执行，不会修改模板，也不会改写历史执行记录。" style={{ marginBottom: 16 }} />
          <Form.Item name="groupCode" label="目标分组">
            <Select
              allowClear
              showSearch
              options={groupOptions}
              placeholder="选择目标分组，留空表示移出分组"
              onChange={(value) => {
                const group = findGroupNode(value);
                groupForm.setFieldsValue({ groupName: group?.groupName });
              }}
            />
          </Form.Item>
          <Form.Item name="groupName" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="reason" label="调整原因">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="克隆同步任务"
        open={Boolean(cloneTask)}
        onCancel={() => {
          setCloneTask(null);
          cloneForm.resetFields();
        }}
        onOk={() => cloneForm.submit()}
        confirmLoading={taskDefinitionMutation.isPending}
        destroyOnHidden
        forceRender
      >
        <Form<CloneSyncTaskPayload>
          form={cloneForm}
          layout="vertical"
          onFinish={(values) => {
            if (!cloneTask) return;
            taskDefinitionMutation.mutate({ id: cloneTask.id, action: "clone", payload: compactPayload(values) });
            setCloneTask(null);
            cloneForm.resetFields();
          }}
        >
          <Alert showIcon type="info" message="克隆只复制任务定义" description="克隆不会复制执行历史、断点或错误样本。默认生成编辑中任务，勾选立即执行时后端会先做预检再创建一次手工执行记录。" style={{ marginBottom: 16 }} />
          <Form.Item name="name" label="新任务名称">
            <Input />
          </Form.Item>
          <Form.Item name="description" label="新任务说明">
            <Input.TextArea rows={2} />
          </Form.Item>
          <div className="grid grid-two-form">
            <Form.Item name="ownerId" label="负责人 ID">
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="groupCode" label="任务分组">
              <Select
                allowClear
                showSearch
                options={groupOptions}
                onChange={(value) => {
                  const group = findGroupNode(value);
                  cloneForm.setFieldsValue({ groupName: group?.groupName });
                }}
              />
            </Form.Item>
          </div>
          <Form.Item name="groupName" hidden>
            <Input />
          </Form.Item>
          <div className="grid grid-two-form">
            <Form.Item name="keepScheduleConfig" valuePropName="checked">
              <Checkbox>保留来源调度配置</Checkbox>
            </Form.Item>
            <Form.Item name="runImmediately" valuePropName="checked">
              <Checkbox>克隆后立即执行一次</Checkbox>
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal
        title="导入同步任务定义"
        open={importOpen}
        onCancel={() => {
          setImportOpen(false);
          setImportFile(null);
          setImportResult(null);
          importForm.resetFields();
        }}
        onOk={() => importForm.submit()}
        okText="开始导入"
        confirmLoading={importMutation.isPending}
        width={880}
        destroyOnHidden
        forceRender
      >
        <div className="page-stack">
          <Alert showIcon type="warning" message="导入的是任务定义，不是业务数据" description="导入文件只允许创建新的同步任务定义。文件里的任务状态、审批状态和触发方式只作为上下文，最终状态由后端状态机决定；如有命名冲突或校验失败，后端会返回行级诊断并拒绝整批写入。" />
          <Form<ImportTaskValues>
            form={importForm}
            layout="vertical"
            initialValues={{ format: "CSV", dryRun: true, runImmediately: false }}
            onFinish={(values) => {
              if (!importFile) {
                message.error("请先选择 CSV 或 XLSX 文件");
                return;
              }
              importMutation.mutate({ file: importFile, values });
            }}
          >
            <Form.Item label="任务定义文件">
              <Upload
                accept=".csv,.xlsx"
                maxCount={1}
                beforeUpload={(file) => {
                  setImportFile(file);
                  return false;
                }}
                onRemove={() => {
                  setImportFile(null);
                }}
              >
                <Button icon={<UploadOutlined />}>选择 CSV / Excel 文件</Button>
              </Upload>
            </Form.Item>
            <div className="grid grid-three">
              <Form.Item name="format" label="文件格式">
                <Select options={[{ value: "CSV", label: "CSV" }, { value: "XLSX", label: "Excel" }]} />
              </Form.Item>
              <Form.Item name="dryRun" valuePropName="checked">
                <Checkbox>只校验，不写入</Checkbox>
              </Form.Item>
              <Form.Item name="runImmediately" valuePropName="checked">
                <Checkbox>导入后立即执行</Checkbox>
              </Form.Item>
            </div>
          </Form>
          {importResult ? (
            <Card className="compact-card" title="导入诊断">
              <Space wrap style={{ marginBottom: 12 }}>
                <Tag>{labelOf(importResult.status, importStatusLabels)}</Tag>
                <Tag>总行数 {importResult.totalRows}</Tag>
                <Tag color="green">通过 {importResult.validRows}</Tag>
                <Tag color="blue">创建 {importResult.createdCount}</Tag>
                <Tag color="gold">冲突 {importResult.conflictCount}</Tag>
                <Tag color="red">失败 {importResult.failedCount}</Tag>
              </Space>
              <Typography.Paragraph type="secondary">{importResult.message}</Typography.Paragraph>
              <Table rowKey={(record) => `${record.rowNumber}-${record.name || "-"}`} columns={importRowColumns} dataSource={importResult.rows} pagination={{ pageSize: 6, showSizeChanger: false }} />
            </Card>
          ) : null}
        </div>
      </Modal>

      <Modal
        title={recoveryAction === "replay" ? "发起回放" : "发起补数"}
        open={Boolean(recoveryAction && recoveryTask)}
        onCancel={() => {
          setRecoveryAction(null);
          setRecoveryTask(null);
          recoveryForm.resetFields();
        }}
        onOk={() => recoveryForm.submit()}
        confirmLoading={taskActionMutation.isPending}
        destroyOnHidden
        forceRender
      >
        <Form<SyncTaskRecoveryPayload>
          form={recoveryForm}
          layout="vertical"
          onFinish={(values) => {
            if (!recoveryTask || !recoveryAction) return;
            taskActionMutation.mutate({ id: recoveryTask.id, action: recoveryAction, payload: compactPayload(values) });
            setRecoveryAction(null);
            setRecoveryTask(null);
            recoveryForm.resetFields();
          }}
        >
          <div className="grid grid-two-form">
            <Form.Item name="sourceExecutionId" label="来源执行记录 ID"><InputNumber min={1} style={{ width: "100%" }} /></Form.Item>
            <Form.Item name="sourceCheckpointId" label="来源断点 ID"><InputNumber min={1} style={{ width: "100%" }} /></Form.Item>
          </div>
          <div className="grid grid-two-form">
            <Form.Item name="windowStart" label="窗口开始"><Input placeholder="2026-07-01T00:00:00+08:00" /></Form.Item>
            <Form.Item name="windowEnd" label="窗口结束"><Input placeholder="2026-07-02T00:00:00+08:00" /></Form.Item>
          </div>
          <Form.Item name="shardOrPartition" label="分区/分片"><Input placeholder="dt=2026-07-01" /></Form.Item>
          <Form.Item name="reason" label="原因"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>

      <Drawer
        width={1080}
        title={selectedTask?.name}
        open={Boolean(selectedTask)}
        onClose={() => {
          setSelectedTask(null);
          setSelectedExecutionId(undefined);
        }}
        destroyOnHidden
      >
        {selectedTask ? (
          <div className="page-stack">
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="任务 ID">{selectedTask.id}</Descriptions.Item>
              <Descriptions.Item label="模板 ID">{selectedTask.templateId}</Descriptions.Item>
              <Descriptions.Item label="任务分组">{selectedTask.groupName || "默认分组"}</Descriptions.Item>
              <Descriptions.Item label="状态">{statusTag(selectedTask.currentState, stateColor, syncTaskStateLabels)}</Descriptions.Item>
              <Descriptions.Item label="审批">{statusTag(selectedTask.approvalState, approvalColor, approvalLabels)}</Descriptions.Item>
              <Descriptions.Item label="最近执行">{selectedTask.lastExecutionId || "-"}</Descriptions.Item>
              <Descriptions.Item label="负责人">{selectedTask.ownerId || "-"}</Descriptions.Item>
              <Descriptions.Item label="自动调度">{selectedTask.scheduleEnabled ? "已启用" : "未启用"}</Descriptions.Item>
              <Descriptions.Item label="下次触发">{formatDateTime(selectedTask.nextFireTime)}</Descriptions.Item>
            </Descriptions>
            <Tabs
              items={[
                {
                  key: "executions",
                  label: "执行历史",
                  children: (
                    <Table
                      rowKey="id"
                      columns={executionColumns}
                      dataSource={executions}
                      loading={executionQuery.isLoading}
                      locale={{ emptyText: <RealEmpty meta={executionQuery.data?.meta} description="暂无执行历史记录" /> }}
                      pagination={{ pageSize: 8, showSizeChanger: false }}
                    />
                  ),
                },
                {
                  key: "logs",
                  label: "运行日志",
                  children: (
                    <div className="page-stack">
                      <Alert
                        showIcon
                        type={selectedExecutionIsLive ? "success" : "info"}
                        message={
                          selectedExecutionId
                            ? `当前执行记录 #${selectedExecutionId}${selectedExecutionIsLive ? " 正在运行，日志会自动刷新" : ""}`
                            : "请先在执行历史中选择执行记录"
                        }
                        description="运行日志记录任务入队、执行器认领、预检查/计划、通道创建、对象或分片同步、批次回执、断点与最终完成等关键阶段。日志只展示低敏进度事实，不展示 SQL、连接串、密码、where 原文或样本行。"
                      />
                      <Table
                        rowKey="id"
                        columns={executionLogColumns}
                        dataSource={executionLogs}
                        loading={executionLogQuery.isLoading || executionLogQuery.isFetching}
                        locale={{ emptyText: <RealEmpty meta={executionLogQuery.data?.meta} description="暂无运行日志" /> }}
                        pagination={{ pageSize: 10, showSizeChanger: false }}
                      />
                    </div>
                  ),
                },
                {
                  key: "objects",
                  label: "对象/分片",
                  children: (
                    <div className="page-stack">
                      <Alert showIcon type="info" message={selectedExecutionId ? `当前执行记录 #${selectedExecutionId}` : "请先在执行历史中选择执行记录"} />
                      <Table
                        rowKey="id"
                        columns={objectExecutionColumns}
                        dataSource={objectExecutions}
                        loading={objectExecutionQuery.isLoading}
                        locale={{ emptyText: <RealEmpty meta={objectExecutionQuery.data?.meta} description="暂无对象级执行账本" /> }}
                        pagination={{ pageSize: 8, showSizeChanger: false }}
                      />
                      <Card className="compact-card" title="失败对象选择性重试">
                        <Form<SyncObjectRetryPayload>
                          form={objectRetryForm}
                          layout="vertical"
                          initialValues={{ retryAttemptBudget: 3, resetAttemptCount: true, reason: "前端人工重试失败对象" }}
                          onFinish={(values) => objectRetryMutation.mutate(compactPayload(values))}
                        >
                          <div className="grid grid-two-form">
                            <Form.Item name="retryAttemptBudget" label="重试预算">
                              <InputNumber min={1} max={10} style={{ width: "100%" }} />
                            </Form.Item>
                            <Form.Item name="resetAttemptCount" valuePropName="checked">
                              <Checkbox>重置失败对象尝试次数</Checkbox>
                            </Form.Item>
                          </div>
                          <Form.Item name="reason" label="重试原因">
                            <Input.TextArea rows={2} />
                          </Form.Item>
                          <Button type="primary" icon={<RedoOutlined />} loading={objectRetryMutation.isPending} disabled={!selectedExecutionId} onClick={() => objectRetryForm.submit()}>
                            重试当前执行记录中的失败对象
                          </Button>
                        </Form>
                      </Card>
                    </div>
                  ),
                },
                {
                  key: "errors",
                  label: "错误样本 / 脏数据回放",
                  children: (
                    <div className="page-stack">
                      <Table
                        rowKey="id"
                        columns={errorSampleColumns}
                        dataSource={errorSamples}
                        loading={errorSampleQuery.isLoading}
                        locale={{ emptyText: <RealEmpty meta={errorSampleQuery.data?.meta} description="暂无错误样本" /> }}
                        pagination={{ pageSize: 8, showSizeChanger: false }}
                      />
                      <Card className="compact-card" title="脏数据修复后回放">
                        <Form<SyncDirtyRecordReplayPayload>
                          form={dirtyReplayForm}
                          layout="vertical"
                          initialValues={{
                            executionId: selectedExecutionId,
                            replayAllRetryableInExecution: true,
                            repairConfirmed: true,
                            repairStrategy: "MANUAL_FIXED_AND_REPLAY",
                            maxSampleCount: 100,
                            reason: "已完成脏数据根因修复，发起可重试样本重放",
                          }}
                          onFinish={(values) => dirtyReplayMutation.mutate(compactPayload(values) as SyncDirtyRecordReplayPayload)}
                        >
                          <div className="grid grid-two-form">
                            <Form.Item name="executionId" label="来源执行记录" rules={[{ required: true, message: "请输入来源执行记录" }]}>
                              <InputNumber min={1} style={{ width: "100%" }} />
                            </Form.Item>
                            <Form.Item name="maxSampleCount" label="最大样本数">
                              <InputNumber min={1} max={10000} style={{ width: "100%" }} />
                            </Form.Item>
                          </div>
                          <div className="grid grid-two-form">
                            <Form.Item name="replayAllRetryableInExecution" valuePropName="checked">
                              <Checkbox>重放该执行记录下全部可重试样本</Checkbox>
                            </Form.Item>
                            <Form.Item name="repairConfirmed" valuePropName="checked">
                              <Checkbox>确认已完成字段/数据/约束修复</Checkbox>
                            </Form.Item>
                          </div>
                          <Form.Item name="repairStrategy" label="修复策略">
                            <Input />
                          </Form.Item>
                          <Form.Item name="reason" label="重放原因">
                            <Input.TextArea rows={2} />
                          </Form.Item>
                          <Button type="primary" icon={<CloudSyncOutlined />} loading={dirtyReplayMutation.isPending} onClick={() => dirtyReplayForm.submit()}>
                            提交脏数据回放
                          </Button>
                        </Form>
                      </Card>
                    </div>
                  ),
                },
                {
                  key: "checkpoints",
                  label: "断点记录",
                  children: (
                    <Table
                      rowKey="id"
                      columns={checkpointColumns}
                      dataSource={checkpoints}
                      loading={checkpointQuery.isLoading}
                      locale={{ emptyText: <RealEmpty meta={checkpointQuery.data?.meta} description="暂无断点记录" /> }}
                      pagination={{ pageSize: 8, showSizeChanger: false }}
                    />
                  ),
                },
                {
                  key: "audit",
                  label: "审计",
                  children: (
                    <Table
                      rowKey="id"
                      columns={auditColumns}
                      dataSource={auditRecords}
                      loading={auditQuery.isLoading}
                      locale={{ emptyText: <RealEmpty meta={auditQuery.data?.meta} description="暂无同步审计记录" /> }}
                      pagination={{ pageSize: 8, showSizeChanger: false }}
                    />
                  ),
                },
              ]}
            />
          </div>
        ) : null}
      </Drawer>

      <Drawer width={680} title="模板规划预览" open={previewPayload != null} onClose={() => setPreviewPayload(null)} destroyOnHidden>
        <pre className="mono" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(previewPayload, null, 2)}</pre>
      </Drawer>

      <Drawer width={840} title="批量操作结果" open={batchResult != null} onClose={() => setBatchResult(null)} destroyOnHidden>
        {batchResult ? (
          <div className="page-stack">
            <Space wrap>
              <Tag>{batchResult.operationType}</Tag>
              <Tag color={batchResult.status === "COMPLETED" ? "green" : batchResult.status === "FAILED" ? "red" : "gold"}>{batchResult.status}</Tag>
              <Tag>总数 {batchResult.totalCount}</Tag>
              <Tag color="green">成功 {batchResult.successCount}</Tag>
              <Tag color="red">失败 {batchResult.failedCount}</Tag>
              <Tag color="default">跳过 {batchResult.skippedCount}</Tag>
            </Space>
            <Table
              rowKey={(record) => `${record.taskId || "-"}-${record.code}-${record.message || ""}`}
              columns={batchItemColumns}
              dataSource={batchResult.items}
              pagination={{ pageSize: 8, showSizeChanger: false }}
            />
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
