import { Empty, Space, Typography } from "antd";
import type { RequestMeta } from "@/types/domain";

export function RealEmpty({ meta, description }: { meta?: RequestMeta; description: string }) {
  const detail =
    meta?.source === "api"
      ? "真实后端已返回，当前查询结果为 0 条。"
      : meta?.message || "本地模拟数据未命中记录。";

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
