import { Alert, Card, List, Progress, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/endpoints";
import { agentSnapshots, dashboardKpis, queueSnapshots } from "@/api/mockData";
import { DataSourceIndicator } from "@/components/DataSourceIndicator";
import { RealEmpty } from "@/components/RealEmpty";
import { HealthTag, RiskTag } from "@/components/StatusTag";
import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import type { QueueSnapshot, ServiceHealth } from "@/types/domain";
import { formatDateTime, formatDuration, percent } from "@/utils/format";
import { labelOf } from "@/utils/labels";
import { defaultListPagination, defaultTablePagination } from "@/utils/table";

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
  { title: "端口", dataIndex: "port", render: (value) => <span className="mono">{value}</span> },
  { title: "P95", dataIndex: "p95LatencyMs", render: (value) => `${value} ms` },
  { title: "错误率", dataIndex: "errorRate", render: (value) => percent(value) },
  { title: "更新时间", dataIndex: "updatedAt", render: (value) => formatDateTime(value) },
];

const queueColumns: ColumnsType<QueueSnapshot> = [
  { title: "队列", dataIndex: "name" },
  { title: "待处理", dataIndex: "pending" },
  { title: "运行中", dataIndex: "running" },
  { title: "失败", dataIndex: "failed", render: (value) => <Tag color={value > 0 ? "red" : "green"}>{value}</Tag> },
  { title: "最大延迟", dataIndex: "maxLagSeconds", render: (value) => formatDuration(value) },
];

export function Dashboard() {
  const serviceQuery = useQuery({
    queryKey: ["service-health"],
    queryFn: api.listServiceHealth,
  });

  const services = serviceQuery.data?.data ?? [];

  return (
    <div className="page-stack">
      <PageHeader
        title="总览"
        subtitle="任务、数据源、质量、智能体和运行时状态"
        actions={<DataSourceIndicator meta={serviceQuery.data?.meta} />}
      />

      <div className="grid grid-kpi">
        {dashboardKpis.map((item) => (
          <MetricCard key={item.key} item={item} />
        ))}
      </div>

      <div className="grid grid-two">
        <Card className="table-card" title="服务健康">
          <Table
            rowKey="key"
            size="middle"
            columns={serviceColumns}
            dataSource={services}
            pagination={defaultTablePagination(8)}
            loading={serviceQuery.isLoading}
            locale={{ emptyText: <RealEmpty meta={serviceQuery.data?.meta} description="暂无服务健康记录" /> }}
          />
        </Card>

        <Card className="compact-card" title="智能体运行">
          <List
            itemLayout="horizontal"
            dataSource={agentSnapshots}
            pagination={defaultListPagination(8)}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space>
                      <Typography.Text strong>{item.name}</Typography.Text>
                      <HealthTag value={item.status} />
                    </Space>
                  }
                  description={
                    <Space wrap>
                      <span>{item.role}</span>
                      <RiskTag value={item.risk} />
                      <Tag>{item.activeRuns} 个运行中任务</Tag>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      </div>

      <div className="grid grid-two">
        <Card className="table-card" title="队列水位">
          <Table rowKey="key" size="middle" columns={queueColumns} dataSource={queueSnapshots} pagination={defaultTablePagination(8)} />
        </Card>

        <Card className="compact-card" title="闭环进度">
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <div>
              <div className="split-row">
                <Typography.Text>Java 异步指令到 Python 知识检索执行器</Typography.Text>
                <Typography.Text strong>82%</Typography.Text>
              </div>
              <Progress percent={82} strokeColor="#2563eb" />
            </div>
            <div>
              <div className="split-row">
                <Typography.Text>产物授权与读取链路</Typography.Text>
                <Typography.Text strong>58%</Typography.Text>
              </div>
              <Progress percent={58} strokeColor="#0f9f6e" />
            </div>
            <Alert
              type="warning"
              showIcon
              message="Python 智能运行时当前为降级状态"
              description="知识检索产物本地写入已闭环，对象存储适配器与全平台端到端验收仍需继续联调。"
            />
          </Space>
        </Card>
      </div>
    </div>
  );
}
