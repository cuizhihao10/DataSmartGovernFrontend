import type { TablePaginationConfig } from "antd/es/table";
import type { PaginationConfig } from "antd/es/pagination";

/**
 * 前端表格的统一分页选项。
 *
 * 产品要求所有列表都能切换每页展示数量，但最大不能超过 100 条。
 * 这里集中维护选项，避免不同页面出现 80、200、500 这类不一致的用户入口。
 */
export const TABLE_PAGE_SIZE_OPTIONS = ["5", "10", "20", "50", "100"];

export const DEFAULT_TABLE_PAGE_SIZE = 10;

export const MAX_TABLE_PAGE_SIZE = 100;

/**
 * 将任意页面传入的 pageSize 规整到安全范围。
 *
 * 前端分页只是展示层控制，真正大数据列表仍应依赖后端分页；限制最大 100 可以避免用户一次性渲染过多行，
 * 也能让前后端分页语义保持一致。
 */
export function normalizeTablePageSize(value?: number, fallback = DEFAULT_TABLE_PAGE_SIZE) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.min(Math.max(Math.trunc(value), 1), MAX_TABLE_PAGE_SIZE);
}

/**
 * 纯前端数组表格使用的默认分页配置。
 *
 * 使用 defaultPageSize 而不是 pageSize，是为了让 Ant Design 在本地管理分页大小；
 * 否则 pageSize 会变成受控属性，用户切换“每页条数”后页面不会真正变化。
 */
export function defaultTablePagination(defaultPageSize = DEFAULT_TABLE_PAGE_SIZE): TablePaginationConfig {
  return {
    defaultPageSize: normalizeTablePageSize(defaultPageSize),
    showSizeChanger: true,
    pageSizeOptions: TABLE_PAGE_SIZE_OPTIONS,
    showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条 / 共 ${total} 条`,
  };
}

/**
 * Ant Design 的 List 与 Table 虽然都叫 pagination，但类型并不是同一个。
 *
 * TablePaginationConfig 允许 position 使用数组，而 List 内部使用的是 PaginationConfig；
 * 如果直接复用表格配置，TypeScript 会认为 position 类型不兼容。这里单独提供 List 版本，
 * 让“所有列表都能切换每页数量”的产品要求继续复用同一组选项，同时避免类型层面的隐性耦合。
 */
export function defaultListPagination(defaultPageSize = DEFAULT_TABLE_PAGE_SIZE): PaginationConfig {
  return {
    defaultPageSize: normalizeTablePageSize(defaultPageSize),
    showSizeChanger: true,
    pageSizeOptions: TABLE_PAGE_SIZE_OPTIONS,
    showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条 / 共 ${total} 条`,
  };
}

/**
 * 服务端分页表格使用的受控分页配置。
 *
 * 任务列表、回收站列表等表格需要把 current/pageSize 传给后端查询接口。
 * 因此这里保留 current、pageSize、total 和 onChange，并统一补齐 showSizeChanger 与最大 100 条限制。
 */
export function controlledTablePagination(options: {
  current: number;
  pageSize: number;
  total?: number;
  onChange: (page: number, pageSize: number) => void;
}): TablePaginationConfig {
  const pageSize = normalizeTablePageSize(options.pageSize);
  return {
    current: options.current,
    pageSize,
    total: options.total,
    showSizeChanger: true,
    pageSizeOptions: TABLE_PAGE_SIZE_OPTIONS,
    showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条 / 共 ${total} 条`,
    onChange: (page, nextPageSize) => options.onChange(page, normalizeTablePageSize(nextPageSize, pageSize)),
    onShowSizeChange: (page, nextPageSize) => options.onChange(page, normalizeTablePageSize(nextPageSize, pageSize)),
  };
}

function sortableIdOf(record: unknown) {
  if (!record || typeof record !== "object") {
    return undefined;
  }
  const source = record as Record<string, unknown>;
  /*
   * 大多数 Java 业务实体使用 id；Agent 与批处理结果则常用 sessionId/runId/auditId/taskId 等显式业务主键。
   * 这些字段仍然属于“ID 语义”，纳入统一倒序规则后，用户在各模块看到的都是最新记录优先。
   */
  const candidateKeys = [
    "id",
    "taskId",
    "executionId",
    "auditId",
    "runId",
    "sessionId",
    "bindingId",
    "toolCode",
    "rowNumber",
  ];
  const candidateKey = candidateKeys.find((key) => source[key] != null && String(source[key]).trim());
  if (!candidateKey) {
    return undefined;
  }
  const value = source[candidateKey];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value.trim();
  }
  return undefined;
}

/**
 * 默认按 id 倒序展示列表数据。
 *
 * 后端分页接口后续也应支持 sort=id,desc；在前端闭环阶段，这里先保证所有本地列表、mock fallback 和接口返回数组
 * 都能按“最新 ID 在前”的商业系统常见习惯展示。没有 id 的指标型列表保持原顺序，避免破坏服务健康、队列快照等固定展示。
 */
export function sortByIdDesc<T>(records: readonly T[] | undefined | null): T[] {
  const values = [...(records ?? [])];
  return values
    .map((record, index) => ({ record, index, id: sortableIdOf(record) }))
    .sort((left, right) => {
      if (left.id == null && right.id == null) {
        return left.index - right.index;
      }
      if (left.id == null) {
        return 1;
      }
      if (right.id == null) {
        return -1;
      }
      if (typeof left.id === "number" && typeof right.id === "number") {
        return right.id - left.id;
      }
      return String(right.id).localeCompare(String(left.id), undefined, { numeric: true, sensitivity: "base" });
    })
    .map((item) => item.record);
}
