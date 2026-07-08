import { AuditOutlined, SafetyCertificateOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Card, Input, Space, Table, Tabs, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/api/endpoints";
import { DataSourceIndicator } from "@/components/DataSourceIndicator";
import { RealEmpty } from "@/components/RealEmpty";
import { BooleanTag } from "@/components/StatusTag";
import { PageHeader } from "@/components/PageHeader";
import type { PermissionRole, RoutePolicy } from "@/types/domain";
import { labelOf, scopeLabels } from "@/utils/labels";

const scopeColor: Record<PermissionRole["scope"], string> = {
  PLATFORM: "red",
  TENANT: "orange",
  PROJECT: "blue",
};

const resourceTypeLabels: Record<string, string> = {
  DATASOURCE: "数据源",
  SYNC_TASK: "同步任务",
  SYNC_TEMPLATE: "同步模板",
  SYNC_EXECUTION: "同步执行",
  SYSTEM_SETTING: "系统设置",
  AI_RUNTIME: "智能体运行时",
  TASK: "治理任务",
  QUALITY_RULE: "质量规则",
};

const actionLabels: Record<string, string> = {
  VIEW: "查看",
  CREATE: "创建",
  UPDATE: "修改",
  DELETE: "删除",
  EXECUTE: "执行",
  APPROVE: "审批",
  VIEW_EVENTS: "查看事件",
};

export function Permissions() {
  const [keyword, setKeyword] = useState("");
  const roleQuery = useQuery({
    queryKey: ["permission-roles"],
    queryFn: api.listRoles,
  });
  const routePolicyQuery = useQuery({
    queryKey: ["permission-route-policies"],
    queryFn: api.listRoutePolicies,
  });

  const roles = roleQuery.data?.data ?? [];
  const routePolicies = routePolicyQuery.data?.data ?? [];
  const filteredRoles = roles.filter((role) =>
    [role.name, role.code, role.scope].join(" ").toLowerCase().includes(keyword.toLowerCase()),
  );
  const filteredPolicies = routePolicies.filter((policy) =>
    [policy.pathPattern, policy.resourceType, policy.defaultAction]
      .join(" ")
      .toLowerCase()
      .includes(keyword.toLowerCase()),
  );

  const roleColumns: ColumnsType<PermissionRole> = [
    {
      title: "角色",
      dataIndex: "name",
      render: (value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{value}</Typography.Text>
          <Typography.Text className="mono" type="secondary">
            {record.code}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "范围",
      dataIndex: "scope",
      render: (value: PermissionRole["scope"]) => <Tag color={scopeColor[value]}>{labelOf(value, scopeLabels)}</Tag>,
    },
    { title: "成员", dataIndex: "members" },
    { title: "策略", dataIndex: "policyCount" },
    { title: "状态", dataIndex: "enabled", render: (value) => <BooleanTag value={value} /> },
  ];

  const policyColumns: ColumnsType<RoutePolicy> = [
    { title: "路径", dataIndex: "pathPattern", render: (value) => <span className="mono">{value}</span> },
    { title: "资源", dataIndex: "resourceType", render: (value) => <Tag>{labelOf(value, resourceTypeLabels)}</Tag> },
    { title: "动作", dataIndex: "defaultAction", render: (value) => <Tag color="blue">{labelOf(value, actionLabels)}</Tag> },
    { title: "状态", dataIndex: "enabled", render: (value) => <BooleanTag value={value} /> },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="权限"
        subtitle="角色、菜单、路由策略、数据范围和智能体工具准入"
        actions={
          <>
            <DataSourceIndicator meta={roleQuery.data?.meta ?? routePolicyQuery.data?.meta} />
            <Button type="primary" icon={<SafetyCertificateOutlined />}>
              新建策略
            </Button>
          </>
        }
      />

      <Card className="compact-card">
        <div className="toolbar">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索角色、路径、动作"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            style={{ width: 300 }}
          />
          <Button icon={<AuditOutlined />}>审计记录</Button>
        </div>
      </Card>

      <Tabs
        items={[
          {
            key: "roles",
            label: "角色",
            children: (
              <Card className="table-card">
                <Table
                  rowKey="id"
                  columns={roleColumns}
                  dataSource={filteredRoles}
                  loading={roleQuery.isLoading}
                  locale={{ emptyText: <RealEmpty meta={roleQuery.data?.meta} description="暂无角色记录" /> }}
                  pagination={false}
                />
              </Card>
            ),
          },
          {
            key: "routes",
            label: "路由策略",
            children: (
              <Card className="table-card">
                <Table
                  rowKey="id"
                  columns={policyColumns}
                  dataSource={filteredPolicies}
                  loading={routePolicyQuery.isLoading}
                  locale={{ emptyText: <RealEmpty meta={routePolicyQuery.data?.meta} description="暂无路由策略记录" /> }}
                  pagination={false}
                />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
