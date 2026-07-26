import type {
  SyncTaskMetadataDiscoveryResult,
  SyncTaskMetadataField,
  SyncTaskMetadataTable,
} from "@/types/domain";

/**
 * User-facing synchronization modes shared by the manual wizard and Agent.
 *
 * Runtime recovery operations such as replay/backfill are deliberately absent:
 * they are actions on an existing execution, not task creation modes.
 */
export type UserSyncMode =
  | "FULL"
  | "SCHEDULED_BATCH"
  | "SCHEDULED_FULL"
  | "CUSTOM_SQL_QUERY"
  | "CDC_STREAMING";

export const userSyncModeOptions: Array<{ value: UserSyncMode; label: string }> = [
  { value: "FULL", label: "全量传输" },
  { value: "SCHEDULED_BATCH", label: "定期批量" },
  { value: "SCHEDULED_FULL", label: "定期全量" },
  { value: "CUSTOM_SQL_QUERY", label: "SQL 语句" },
  { value: "CDC_STREAMING", label: "实时同步" },
];

export interface SyncFieldMappingRow {
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

export function normalizeUserSyncMode(value?: string): UserSyncMode {
  const normalized = (value || "").trim().toUpperCase();
  // The early Agent contract used REAL_TIME while data-sync persists the
  // product mode as CDC_STREAMING. Normalize at the shared UI boundary.
  if (normalized === "REAL_TIME") return "CDC_STREAMING";
  return userSyncModeOptions.some((option) => option.value === normalized)
    ? normalized as UserSyncMode
    : "FULL";
}

export function isScheduledSyncMode(mode?: string) {
  const normalized = normalizeUserSyncMode(mode);
  return normalized === "SCHEDULED_BATCH" || normalized === "SCHEDULED_FULL";
}

export function isSqlSyncMode(mode?: string) {
  return normalizeUserSyncMode(mode) === "CUSTOM_SQL_QUERY";
}

export function isRealtimeSyncMode(mode?: string) {
  return normalizeUserSyncMode(mode) === "CDC_STREAMING";
}

export function isMysqlLikeConnector(connectorType?: string) {
  const normalized = (connectorType || "").toUpperCase();
  return normalized.includes("MYSQL") || normalized.includes("MARIADB");
}

export function tableObjectKey(table: SyncTaskMetadataTable, index: number) {
  return `${table.schemaName || "默认Schema"}.${table.tableName}#${index}`;
}

export function metadataTableOptions(discovery?: SyncTaskMetadataDiscoveryResult | null) {
  return (discovery?.tables ?? []).map((table, index) => ({
    value: tableObjectKey(table, index),
    label: table.schemaName ? `${table.schemaName}.${table.tableName}` : table.tableName,
    table,
  }));
}

export function findMetadataTableByKey(
  discovery: SyncTaskMetadataDiscoveryResult | null | undefined,
  key?: string,
) {
  if (!key) return undefined;
  return (discovery?.tables ?? []).find((table, index) => tableObjectKey(table, index) === key);
}

export function findMetadataTableByName(
  discovery: SyncTaskMetadataDiscoveryResult | null | undefined,
  schemaName?: string,
  objectName?: string,
) {
  if (!objectName) return undefined;
  const normalizedObjectName = objectName.toLowerCase();
  const normalizedSchemaName = schemaName?.toLowerCase();
  return (discovery?.tables ?? []).find((table) => {
    const sameObject = table.tableName.toLowerCase() === normalizedObjectName;
    const sameSchema = !normalizedSchemaName
      || !table.schemaName
      || table.schemaName.toLowerCase() === normalizedSchemaName;
    return sameObject && sameSchema;
  });
}

export function findSameNameTargetTable(
  sourceTable: SyncTaskMetadataTable | undefined,
  targetDiscovery: SyncTaskMetadataDiscoveryResult | null | undefined,
) {
  if (!sourceTable) return undefined;
  const sameName = (targetDiscovery?.tables ?? []).filter(
    (table) => table.tableName.toLowerCase() === sourceTable.tableName.toLowerCase(),
  );
  if (sameName.length <= 1) return sameName[0];
  const sourceSchema = sourceTable.schemaName?.toLowerCase();
  if (!sourceSchema) return undefined;
  return sameName.find((table) => table.schemaName?.toLowerCase() === sourceSchema);
}

export function sortedColumns(table?: SyncTaskMetadataTable) {
  return [...(table?.fields ?? [])]
    .sort((left, right) => (left.ordinalPosition ?? 0) - (right.ordinalPosition ?? 0));
}

/**
 * Build mappings from source columns only.
 *
 * Target-only fields are intentionally not rendered because the synchronization
 * Reader can never produce values for them. Same-name target fields are selected
 * automatically; unmatched source fields remain visible but disabled until the
 * user explicitly maps them.
 */
export function makeFieldMappings(
  sourceColumns: SyncTaskMetadataField[],
  targetColumns: SyncTaskMetadataField[],
): SyncFieldMappingRow[] {
  const targetByName = new Map(targetColumns.map((column) => [column.fieldName.toLowerCase(), column]));
  return sourceColumns.map((column, index) => {
    const target = targetByName.get(column.fieldName.toLowerCase());
    return {
      key: `source-${column.fieldName}-${column.ordinalPosition ?? index}`,
      sourceField: column.fieldName,
      sourceType: column.dataTypeName,
      targetField: target?.fieldName ?? "",
      targetType: target?.dataTypeName,
      nullable: column.nullable,
      primaryKey: column.primaryKey,
      syncEnabled: Boolean(target) && (column.syncEnabled ?? true),
      typeCompatible: target ? true : undefined,
      compatibilityNote: target
        ? undefined
        : "目标端未发现同名字段；该源字段默认不传输，可手工选择目标字段后启用",
    };
  });
}
