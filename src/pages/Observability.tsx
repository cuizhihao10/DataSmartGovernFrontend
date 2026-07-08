import { AlertOutlined, ApiOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Card, Progress, Space, Table, Tag, Timeline, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/endpoints";
import { queueSnapshots } from "@/api/mockData";
import { DataSourceIndicator } from "@/components/DataSourceIndicator";
import { RealEmpty } from "@/components/RealEmpty";
import { HealthTag } from "@/components/StatusTag";
import { PageHeader } from "@/components/PageHeader";
import type { QueueSnapshot, RuntimeEvent, ServiceHealth } from "@/types/domain";
import { formatDateTime, formatDuration, percent } from "@/utils/format";
import { labelOf } from "@/utils/labels";

const serviceDomainLabels: Record<string, string> = {
  gateway: "网关入口",
  task: "任务中心",
  datasource: "数据源管理",
  quality: "数据质量",
  observability: "运行监控",
  agent: "智能体运行时",
  sync: "数据同步",
  permission: "权限中心",
};

const runtimeDomainLabels: Record<string, string> = {
  gateway: "网关入口",
  "agent-runtime": "智能体运行时",
  "python-runtime": "Python 智能运行时",
  "task-management": "任务管理",
  "data-sync": "数据同步",
};

const serviceColumns: ColumnsType<ServiceHealth> = [
  {
    title: "服务",
    dataIndex: "serviceName",
    render: (value, record) => (
      <Space direction="vertical" size={0}>
        <Typography.Text strong>{value}</Typography.Text>
        <Typography.Text type="secondary">{labelOf(record.domain, serviceDomainLabels)}</Typography.Text>
      </Space>
    ),
  },
  { title: "状态", dataIndex: "status", render: (value) => <HealthTag value={value} /> },
  { title: "P95", dataIndex: "p95LatencyMs", render: (value) => `${value} ms` },
  { title: "错误率", dataIndex: "errorRate", render: (value) => percent(value) },
  { title: "更新时间", dataIndex: "updatedAt", render: (value) => formatDateTime(value) },
];

const queueColumns: ColumnsType<QueueSnapshot> = [
  { title: "队列", dataIndex: "name" },
  { title: "待处理", dataIndex: "pending" },
  { title: "运行中", dataIndex: "running" },
  { title: "失败", dataIndex: "failed", render: (value) => <Tag color={value ? "red" : "green"}>{value}</Tag> },
  { title: "最大积压", dataIndex: "maxLagSeconds", render: (value) => formatDuration(value) },
];

const eventColor: Record<RuntimeEvent["level"], string> = {
  INFO: "blue",
  WARN: "orange",
  ERROR: "red",
};

export function Observability() {
  const serviceQuery = useQuery({
    queryKey: ["observability-service-health"],
    queryFn: api.listServiceHealth,
  });
  const eventQuery = useQuery({
    queryKey: ["observability-runtime-events"],
    queryFn: api.listRuntimeEvents,
  });

  const services = serviceQuery.data?.data ?? [];
  const events = eventQuery.data?.data.records ?? [];

  return (
    <div className="page-stack">
      <PageHeader
        title="可观测"
        subtitle="服务健康、队列积压、运行事件和告警覆盖"
        actions={
          <>
            <DataSourceIndicator meta={serviceQuery.data?.meta ?? eventQuery.data?.meta} />
            <Button aria-label="刷新监控数据" title="刷新监控数据" icon={<ReloadOutlined />} onClick={() => void Promise.all([serviceQuery.refetch(), eventQuery.refetch()])} />
          </>
        }
      />

      <div className="grid grid-three">
        <Card className="compact-card">
          <div className="split-row">
            <Typography.Text type="secondary">告警覆盖</Typography.Text>
            <AlertOutlined style={{ color: "#d97706" }} />
          </div>
          <div className="metric-value">87%</div>
          <Progress percent={87} strokeColor="#d97706" />
        </Card>
        <Card className="compact-card">
          <div className="split-row">
            <Typography.Text type="secondary">Prometheus 采集</Typography.Text>
            <ApiOutlined style={{ color: "#2563eb" }} />
          </div>
          <div className="metric-value">6</div>
          <div className="metric-delta">个采集目标在线</div>
        </Card>
        <Card className="compact-card">
          <div className="split-row">
            <Typography.Text type="secondary">待恢复事件</Typography.Text>
            <AlertOutlined style={{ color: "#dc2626" }} />
          </div>
          <div className="metric-value">4</div>
          <div className="metric-delta">2 个高风险 / 2 个中风险</div>
        </Card>
      </div>

      <div className="grid grid-two">
        <Card className="table-card" title="服务快照">
          <Table
            rowKey="key"
            columns={serviceColumns}
            dataSource={services}
            loading={serviceQuery.isLoading}
            locale={{ emptyText: <RealEmpty meta={serviceQuery.data?.meta} description="暂无服务快照记录" /> }}
            pagination={false}
          />
        </Card>
        <Card className="table-card" title="队列快照">
          <Table rowKey="key" columns={queueColumns} dataSource={queueSnapshots} pagination={false} />
        </Card>
      </div>

      <Card className="compact-card" title="事件流">
        {events.length ? (
          <Timeline
            items={events.map((event) => ({
              color: eventColor[event.level],
              children: (
                <Space direction="vertical" size={2}>
                  <Space>
                    <Typography.Text strong>{event.title}</Typography.Text>
                    <Tag>{labelOf(event.domain, runtimeDomainLabels)}</Tag>
                  </Space>
                  <Typography.Text type="secondary">{event.detail}</Typography.Text>
                  <Typography.Text type="secondary">{formatDateTime(event.time)}</Typography.Text>
                </Space>
              ),
            }))}
          />
        ) : (
          <RealEmpty meta={eventQuery.data?.meta} description="暂无运行事件记录" />
        )}
      </Card>
    </div>
  );
}
