import { Empty, Space, Typography } from "antd";
import type { RequestMeta } from "@/types/domain";

export function RealEmpty({ meta, description }: { meta?: RequestMeta; description: string }) {
  /*
   * 空状态组件会被运行日志、执行历史、数据源、任务列表等多个页面复用。
   * 之前在 meta 为空时直接展示“本地模拟数据未命中记录”，容易造成误判：
   * - 查询还没有触发、还在等待用户选择执行记录时，meta 也可能为空；
   * - React Query 刚开始加载或被 enabled=false 禁用时，meta 同样为空；
   * - 运行日志这类生产执行证据已经禁止 mock fallback，更不能默认说成“本地模拟数据”。
   *
   * 因此这里按 meta.source 明确区分：
   * 1. api：真实后端已返回，只是结果为 0 条；
   * 2. mock：当前确实在使用本地模拟兜底；
   * 3. undefined：数据尚未加载、查询未触发，或当前筛选条件下暂时没有可展示结果。
   */
  const detail =
    meta?.source === "api"
      ? "真实后端已返回，当前查询结果为 0 条。"
      : meta?.source === "mock"
        ? meta.message || "本地模拟数据未命中记录。"
        : "数据尚未加载、查询尚未触发，或当前筛选条件下暂无可展示记录。";

  return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <Space direction="vertical" size={2}>
          <Typography.Text>{description}</Typography.Text>
          <Typography.Text type="secondary">{detail}</Typography.Text>
        </Space>
      }
    />
  );
}
