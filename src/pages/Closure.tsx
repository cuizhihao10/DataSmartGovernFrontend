import {
  CheckCircleOutlined,
  CloudServerOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Descriptions, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/endpoints";
import { DataSourceIndicator } from "@/components/DataSourceIndicator";
import { HealthTag } from "@/components/StatusTag";
import { PageHeader } from "@/components/PageHeader";
import { useAuthStore } from "@/store/authStore";
import type { EndpointProbe, ServiceHealth } from "@/types/domain";
import { formatDateTime } from "@/utils/format";
import { actorRoleLabels, labelOf } from "@/utils/labels";
import { defaultTablePagination } from "@/utils/table";

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

const probeColumns: ColumnsType<EndpointProbe> = [
  {
    title: "探针",
    dataIndex: "name",
    render: (value, record) => (
      <Space direction="vertical" size={0}>
        <Typography.Text strong>{value}</Typography.Text>
        <Typography.Text className="mono" type="secondary">
          {record.path}
        </Typography.Text>
      </Space>
    ),
  },
  { title: "状态", dataIndex: "status", render: (value) => <HealthTag value={value} /> },
  { title: "耗时", dataIndex: "latencyMs", render: (value) => `${value} ms` },
  {
    title: "链路追踪",
    dataIndex: "traceId",
    render: (value) => (value ? <Typography.Text className="mono">{value}</Typography.Text> : "-"),
  },
  { title: "返回", dataIndex: "message", render: (value) => value || "-" },
];

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
  { title: "端口", dataIndex: "port", render: (value) => <span className="mono">{value || "-"}</span> },
  { title: "探测耗时", dataIndex: "p95LatencyMs", render: (value) => `${value} ms` },
  { title: "更新时间", dataIndex: "updatedAt", render: (value) => formatDateTime(value) },
];

export function Closure() {
  const authUser = useAuthStore((state) => state.user);
  const sessionQuery = useQuery({
    queryKey: ["gateway-session"],
    queryFn: api.getSession,
  });
  const serviceQuery = useQuery({
    queryKey: ["closure-service-health"],
    queryFn: api.listServiceHealth,
  });
  const probeQuery = useQuery({
    queryKey: ["closure-probes"],
    queryFn: api.runClosureProbes,
  });

  const session = sessionQuery.data?.data;
  const services = serviceQuery.data?.data ?? [];
  const probes = probeQuery.data ?? [];
  const healthyServiceCount = services.filter((item) => item.status === "UP").length;
  const allProbesUp = probes.length > 0 && probes.every((item) => item.status === "UP");

  const refetchAll = () =>
    void Promise.all([sessionQuery.refetch(), serviceQuery.refetch(), probeQuery.refetch()]);

  return (
    <div className="page-stack">
      <PageHeader
        title="闭环验收"
        subtitle="真实登录、网关会话、服务健康和关键接口探针"
        actions={
          <>
            <DataSourceIndicator meta={sessionQuery.data?.meta ?? serviceQuery.data?.meta} />
            <Button aria-label="刷新闭环验收" title="刷新闭环验收" icon={<ReloadOutlined />} onClick={refetchAll} />
          </>
        }
      />

      <Alert
        showIcon
        type={allProbesUp ? "success" : "warning"}
        message={allProbesUp ? "本地真实链路已连通" : "仍有接口探针未通过"}
        description={
          allProbesUp
            ? "Keycloak 登录、网关会话解析、核心只读接口与服务健康探针已形成闭环。"
            : "请先查看下方失败探针；统一认证模式不会使用演示数据遮盖真实接口错误。"
        }
      />

      <div className="grid grid-three">
        <Card className="compact-card">
          <div className="split-row">
            <Typography.Text type="secondary">认证模式</Typography.Text>
            <SafetyCertificateOutlined style={{ color: "#2563eb" }} />
          </div>
          <div className="metric-value">{session?.authenticationType ?? "OIDC"}</div>
          <div className="metric-delta">{session?.authenticated ? "网关会话已认证" : "等待会话确认"}</div>
        </Card>
        <Card className="compact-card">
          <div className="split-row">
            <Typography.Text type="secondary">核心服务</Typography.Text>
            <CloudServerOutlined style={{ color: "#0f9f6e" }} />
          </div>
          <div className="metric-value">
            {healthyServiceCount}/{services.length || "-"}
          </div>
          <div className="metric-delta">个服务健康</div>
        </Card>
        <Card className="compact-card">
          <div className="split-row">
            <Typography.Text type="secondary">接口探针</Typography.Text>
            <CheckCircleOutlined style={{ color: allProbesUp ? "#0f9f6e" : "#d97706" }} />
          </div>
          <div className="metric-value">{probes.filter((item) => item.status === "UP").length}</div>
          <div className="metric-delta">个探针通过</div>
        </Card>
      </div>

      <div className="grid grid-two">
        <Card className="compact-card" title="前端 OIDC 用户">
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="账号">{authUser?.username ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="显示名">{authUser?.displayName ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{authUser?.email ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="身份角色">
              <Tag color="blue">{labelOf(authUser?.actorRole, actorRoleLabels)}</Tag>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card className="compact-card" title="网关会话">
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="租户">{session?.tenantId ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="操作者">{session?.actorId ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="角色">
              <Tag color="green">{labelOf(session?.actorRole, actorRoleLabels)}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="类型">{session?.actorType ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="解析结果">{session?.issueCodes?.join(", ") || "-"}</Descriptions.Item>
          </Descriptions>
        </Card>
      </div>

      <Card className="table-card" title="关键接口探针">
        <Table
          rowKey="key"
          columns={probeColumns}
          dataSource={probes}
          loading={probeQuery.isLoading}
          pagination={defaultTablePagination(8)}
        />
      </Card>

      <Card className="table-card" title="服务健康快照">
        <Table
          rowKey="key"
          columns={serviceColumns}
          dataSource={services}
          loading={serviceQuery.isLoading}
          pagination={defaultTablePagination(8)}
        />
      </Card>
    </div>
  );
}
