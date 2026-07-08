export const statusLabels: Record<string, string> = {
  UP: "健康",
  DEGRADED: "降级",
  DOWN: "中断",
  UNKNOWN: "未知",
  DRAFT: "编辑中",
  CONFIGURED: "已配置/待手工执行",
  PENDING: "待执行",
  PENDING_REVIEW: "待审核",
  PENDING_APPROVAL: "待审批",
  SCHEDULED: "等待调度",
  QUEUED: "排队中",
  RUNNING: "执行中",
  PAUSED: "已暂停",
  DEFERRED: "已退避",
  RETRYING: "重试中",
  SUCCEEDED: "成功",
  SKIPPED: "跳过",
  PARTIAL_SUCCEEDED: "部分成功",
  PARTIALLY_SUCCEEDED: "部分成功",
  FAILED: "失败",
  DEAD_LETTER: "死信",
  AWAITING_OPERATOR_ACTION: "等待人工处理",
  MANUALLY_TERMINATED: "手工结束",
  OFFLINE: "已下线",
  RECYCLED: "回收站",
  CANCELLED: "已取消",
  ARCHIVED: "已归档",
  DELETED: "已彻底删除",
  ENABLED: "启用",
  DISABLED: "停用",
  TESTING: "测试中",
  ERROR: "异常",
  PASSED: "通过",
  WARNING: "预警",
  PLANNING: "规划中",
  WAITING_HUMAN: "等待人工确认",
  WAITING_APPROVAL: "等待审批",
};

export const syncTaskStateLabels: Record<string, string> = {
  DRAFT: "编辑中",
  PENDING_APPROVAL: "待审批",
  CONFIGURED: "已配置/待手工执行",
  SCHEDULED: "等待调度",
  QUEUED: "排队中",
  RUNNING: "执行中",
  PAUSED: "已暂停",
  RETRYING: "重试中",
  PARTIALLY_SUCCEEDED: "部分成功",
  SUCCEEDED: "成功",
  FAILED: "失败",
  AWAITING_OPERATOR_ACTION: "等待人工处理",
  MANUALLY_TERMINATED: "手工结束",
  OFFLINE: "已下线",
  RECYCLED: "回收站",
  DELETED: "已彻底删除",
  CANCELLED: "已取消",
  ARCHIVED: "已归档",
};

export const syncExecutionStateLabels: Record<string, string> = {
  QUEUED: "排队中",
  RUNNING: "执行中",
  PAUSED: "已暂停",
  RETRYING: "重试中",
  PARTIALLY_SUCCEEDED: "部分成功",
  SUCCEEDED: "成功",
  FAILED: "失败",
  CANCELLED: "已取消",
  MANUALLY_TERMINATED: "手工结束",
  SKIPPED: "跳过",
};

export const approvalLabels: Record<string, string> = {
  NOT_REQUIRED: "无需审批",
  PENDING: "待审批",
  APPROVED: "已审批",
  REJECTED: "已驳回",
};

export const riskLabels: Record<string, string> = {
  LOW: "低风险",
  MEDIUM: "中风险",
  HIGH: "高风险",
  CRITICAL: "关键风险",
};

export const priorityLabels: Record<string, string> = {
  LOW: "低",
  MEDIUM: "中",
  NORMAL: "普通",
  HIGH: "高",
  URGENT: "紧急",
};

export const taskTypeLabels: Record<string, string> = {
  DATA_SYNC: "数据同步",
  QUALITY_SCAN: "质量检测",
  METADATA_DISCOVERY: "元数据发现",
  AGENT_TOOL: "智能体工具",
};

export const syncModeLabels: Record<string, string> = {
  FULL: "全量传输",
  SCHEDULED_BATCH: "定期批量",
  SCHEDULED_FULL: "定期全量",
  CUSTOM_SQL_QUERY: "SQL 语句",
  ONE_TIME_MIGRATION: "一次性迁移",
  INCREMENTAL_TIME: "按时间增量",
  INCREMENTAL_ID: "按主键增量",
  CDC_STREAMING: "实时",
  REPLAY: "失败回放",
  BACKFILL: "历史补数",
  OFFLINE_IMPORT: "离线导入",
  OFFLINE_EXPORT: "离线导出",
};

export const syncScopeLabels: Record<string, string> = {
  SINGLE_OBJECT: "单表/单对象",
  OBJECT_LIST: "多表对象清单",
  SCHEMA_FULL: "按 Schema 传输",
  DATABASE_FULL: "全库传输",
  CUSTOM_SQL_QUERY: "只读 SQL 结果集",
};

export const writeStrategyLabels: Record<string, string> = {
  INSERT: "insert（仅插入）",
  MERGE: "update / merge（更新或合并）",
  APPEND: "insert（兼容旧追加写入）",
  UPSERT: "update / merge（兼容旧更新或插入）",
  INSERT_IGNORE: "insert（兼容旧重复跳过）",
  REPLACE: "update / merge（兼容旧替换写入）",
  OVERWRITE: "update / merge（兼容旧覆盖写入）",
};

export const runModeLabels: Record<string, string> = {
  TEMPLATE: "按模板运行",
  MANUAL: "手动运行",
  SCHEDULED: "定时运行",
  BACKFILL: "补数运行",
  REPLAY: "回放运行",
  CLONED_DRAFT: "克隆草稿",
  IMPORTED_DRAFT: "导入草稿",
};

export const importStatusLabels: Record<string, string> = {
  VALIDATED: "校验通过",
  IMPORTED: "导入完成",
  BLOCKED_BY_CONFLICT: "存在命名冲突",
  BLOCKED_BY_VALIDATION: "校验未通过",
  CREATED_DRAFT: "已创建编辑中任务",
  QUEUED: "已立即入队",
  CONFLICT: "命名冲突",
  FAILED: "失败",
};

export const qualityRuleTypeLabels: Record<string, string> = {
  NULL_CHECK: "空值检查",
  UNIQUE_CHECK: "唯一性检查",
  RANGE_CHECK: "范围检查",
  REFERENTIAL_CHECK: "引用完整性检查",
  CUSTOM_SQL: "自定义 SQL 检查",
};

export const targetTypeLabels: Record<string, string> = {
  GENERIC: "通用对象",
  RELATIONAL_TABLE: "关系型表",
  RELATIONAL_FIELD: "关系型字段",
};

export const comparisonLabels: Record<string, string> = {
  GTE: "大于等于",
  GT: "大于",
  EQ: "等于",
  LTE: "小于等于",
  LT: "小于",
};

export const scopeLabels: Record<string, string> = {
  PLATFORM: "平台级",
  TENANT: "租户级",
  PROJECT: "项目级",
};

export const agentWorkloadLabels: Record<string, string> = {
  AGENT_REASONING: "智能体推理",
  GOVERNANCE_QA: "治理问答",
  CODE_GENERATION: "代码生成",
  EMBEDDING: "向量化",
  RERANK: "重排序",
};

export const agentToolTypeLabels: Record<string, string> = {
  DATASOURCE_METADATA: "数据源元数据",
  DATA_QUALITY: "数据质量",
  DATA_SYNC: "数据同步",
  TASK_MANAGEMENT: "任务管理",
  KNOWLEDGE_RETRIEVAL: "知识检索",
  READONLY_ANALYTICS: "只读分析",
};

export const executionModeLabels: Record<string, string> = {
  SYNC: "同步执行",
  DIRECT: "同步执行",
  ASYNC: "异步执行",
  ASYNC_COMMAND: "异步命令",
  HUMAN_APPROVAL: "人工审批",
  APPROVAL_REQUIRED: "需要审批",
  DRAFT_ONLY: "仅生成草案",
};

export const actorRoleLabels: Record<string, string> = {
  PROJECT_OWNER: "项目负责人",
  OPERATOR: "运维人员",
  AUDITOR: "审计员",
  PLATFORM_ADMIN: "平台管理员",
  TENANT_ADMIN: "租户管理员",
  SERVICE_ACCOUNT: "服务账号",
  ORDINARY_USER: "普通用户",
};

export const connectorLabels: Record<string, string> = {
  MYSQL: "MySQL",
  POSTGRESQL: "PostgreSQL",
  POSTGRES: "PostgreSQL",
  SQLSERVER: "SQL Server",
  ORACLE: "Oracle",
  KAFKA: "Kafka",
  MONGODB: "MongoDB",
  MINIO: "MinIO 对象存储",
  OBJECT_STORAGE: "对象存储",
  API: "API 接口",
};

export function labelOf(value?: string | number | null, labels: Record<string, string> = {}) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }
  const key = String(value);
  return labels[key] ?? key;
}

export function optionOf(value: string, labels: Record<string, string>) {
  return { value, label: labelOf(value, labels) };
}

export function optionsOf(values: string[], labels: Record<string, string>) {
  return values.map((value) => optionOf(value, labels));
}

export function codeWithLabel(value?: string | number | null, labels: Record<string, string> = {}) {
  const key = value === undefined || value === null || value === "" ? "-" : String(value);
  const label = labelOf(key, labels);
  return label === key ? label : `${label}（${key}）`;
}
