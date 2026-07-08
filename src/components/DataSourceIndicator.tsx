import { Tag, Tooltip } from "antd";
import type { RequestMeta } from "@/types/domain";

export function DataSourceIndicator({ meta }: { meta?: RequestMeta }) {
  if (!meta) {
    return null;
  }

  const isMock = meta.source === "mock";
  return (
    <Tooltip title={isMock ? meta.message || "当前展示的是本地演示数据" : meta.traceId || "已连接真实后端接口"}>
      <Tag color={isMock ? "gold" : "success"}>{isMock ? "演示数据" : "真实接口"}</Tag>
    </Tooltip>
  );
}
