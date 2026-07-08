import {
  ArrowDownOutlined,
  ArrowRightOutlined,
  ArrowUpOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Card, Typography } from "antd";
import type { DashboardKpi } from "@/types/domain";

const iconMap = {
  blue: <ThunderboltOutlined />,
  green: <DatabaseOutlined />,
  amber: <WarningOutlined />,
  red: <WarningOutlined />,
  violet: <ExperimentOutlined />,
};

const trendIcon = {
  up: <ArrowUpOutlined />,
  down: <ArrowDownOutlined />,
  flat: <ArrowRightOutlined />,
};

export function MetricCard({ item }: { item: DashboardKpi }) {
  return (
    <Card className="metric-card compact-card">
      <div className="metric-top">
        <Typography.Text type="secondary">{item.title}</Typography.Text>
        <span className={`metric-icon ${item.tone}`}>{iconMap[item.tone]}</span>
      </div>
      <div className="metric-value">
        {item.value}
        {item.suffix ? <span className="muted"> {item.suffix}</span> : null}
      </div>
      <div className="metric-delta">
        {trendIcon[item.trend]} {item.delta}
      </div>
    </Card>
  );
}
