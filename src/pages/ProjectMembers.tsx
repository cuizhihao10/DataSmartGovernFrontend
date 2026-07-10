import {
  EditOutlined,
  ReloadOutlined,
  StopOutlined,
  TeamOutlined,
  UnlockOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api, type ProjectMembershipUpdatePayload } from "@/api/endpoints";
import { DataSourceIndicator } from "@/components/DataSourceIndicator";
import { PageHeader } from "@/components/PageHeader";
import { RealEmpty } from "@/components/RealEmpty";
import { useUiStore } from "@/store/uiStore";
import type { GatewaySession, ProjectMembershipRecord } from "@/types/domain";
import { formatDateTime } from "@/utils/format";
import { controlledTablePagination } from "@/utils/table";

const projectRoleColors: Record<string, string> = {
  OWNER: "red",
  MANAGER: "blue",
  READER: "default",
  SERVICE: "purple",
};

const projectRoleLabels: Record<string, string> = {
  OWNER: "OWNER 项目负责人",
  MANAGER: "MANAGER 项目管理者",
  READER: "READER 只读成员",
  SERVICE: "SERVICE 服务账号",
};

function normalizeRole(value?: string) {
  return String(value || "").trim().toUpperCase();
}

function currentProjectRole(session: GatewaySession | undefined, projectId: number | undefined) {
  return normalizeRole(session?.authorizedProjects?.find((project) =>
    Number(project.projectId ?? project.id) === projectId)?.projectRole);
}

export function ProjectMembers() {
  const { message } = App.useApp();
  const selectedProjectId = useUiStore((state) => state.selectedProjectId);
  const projectOptions = useUiStore((state) => state.projectOptions);
  const [page, setPage] = useState({ current: 1, size: 20 });
  const [keyword, setKeyword] = useState("");
  const [projectRole, setProjectRole] = useState<string>();
  const [enabled, setEnabled] = useState<boolean>();
  const [editing, setEditing] = useState<ProjectMembershipRecord>();
  const [editForm] = Form.useForm<ProjectMembershipUpdatePayload>();

  const sessionQuery = useQuery({
    queryKey: ["project-members-session"],
    queryFn: api.getSession,
  });
  const session = sessionQuery.data?.data;
  const selectedProjectNumber = Number(selectedProjectId ?? session?.authorizedProjectIds?.[0]);
  const currentProjectId = Number.isFinite(selectedProjectNumber) ? selectedProjectNumber : undefined;
  const projectName = projectOptions.find((project) => project.value === String(currentProjectId))?.label
    ?? session?.authorizedProjects?.find((project) => Number(project.projectId ?? project.id) === currentProjectId)?.projectName
    ?? (currentProjectId == null ? "未选择项目" : `未找到项目名称（ID ${currentProjectId}）`);
  const globalRole = normalizeRole(session?.actorRole);
  const projectRoleOfCurrentActor = currentProjectRole(session, currentProjectId);
  const globalAdministrator = ["TENANT_ADMINISTRATOR", "PLATFORM_ADMINISTRATOR"].includes(globalRole);
  const canManage = globalAdministrator || projectRoleOfCurrentActor === "OWNER";

  const membershipQuery = useQuery({
    queryKey: ["project-members", currentProjectId, projectRole, enabled, page.current, page.size],
    queryFn: () => api.listProjectMemberships({
      projectId: currentProjectId,
      projectRole,
      enabled,
      current: page.current,
      size: page.size,
    }),
    enabled: currentProjectId != null,
  });
  const records = membershipQuery.data?.data.records ?? [];
  const filteredRecords = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) return records;
    return records.filter((record) => [
      record.membershipId,
      record.actorId,
      record.username,
      record.email,
      record.projectName,
      record.projectCode,
      record.projectRole,
      record.actorRole,
    ].join(" ").toLowerCase().includes(normalized));
  }, [keyword, records]);

  const updateMutation = useMutation({
    mutationFn: ({ membershipId, payload }: { membershipId: number; payload: ProjectMembershipUpdatePayload }) =>
      api.updateProjectMembership(membershipId, payload),
    onSuccess: async () => {
      message.success("项目成员角色已更新");
      setEditing(undefined);
      editForm.resetFields();
      await Promise.all([membershipQuery.refetch(), sessionQuery.refetch()]);
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "项目成员角色更新失败"),
  });
  const stateMutation = useMutation({
    mutationFn: ({ record, nextEnabled }: { record: ProjectMembershipRecord; nextEnabled: boolean }) => (
      nextEnabled
        ? api.enableProjectMembership(record.membershipId, "项目成员页面启用成员关系")
        : api.disableProjectMembership(record.membershipId, "项目成员页面禁用成员关系")
    ),
    onSuccess: async (_, variables) => {
      message.success(variables.nextEnabled ? "项目成员已启用" : "项目成员已禁用");
      await Promise.all([membershipQuery.refetch(), sessionQuery.refetch()]);
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "项目成员状态更新失败"),
  });

  const openEdit = (record: ProjectMembershipRecord) => {
    setEditing(record);
    editForm.setFieldsValue({
      projectRole: record.projectRole,
      grantSource: record.grantSource,
      reason: "项目成员页面调整项目角色",
    });
  };

  const columns: ColumnsType<ProjectMembershipRecord> = [
    {
      title: "成员关系 ID",
      dataIndex: "membershipId",
      width: 120,
      render: (value) => <Typography.Text className="mono">{value}</Typography.Text>,
    },
    {
      title: "用户",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.username || `Actor ${record.actorId}`}</Typography.Text>
          <Typography.Text type="secondary">{record.email || "未登记邮箱"}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "用户标识",
      width: 150,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text className="mono">Actor {record.actorId}</Typography.Text>
          <Typography.Text type="secondary" className="mono">Identity {record.identityUserId ?? "-"}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "所属项目",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{record.projectName || projectName}</Typography.Text>
          <Typography.Text type="secondary" className="mono">{record.projectCode || `ID ${record.projectId}`}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "项目角色",
      dataIndex: "projectRole",
      width: 190,
      render: (value) => <Tag color={projectRoleColors[value] || "default"}>{projectRoleLabels[value] || value}</Tag>,
    },
    {
      title: "平台身份",
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Tag>{record.actorRole || "未标注"}</Tag>
          <Typography.Text type="secondary">{record.actorType || "USER"}</Typography.Text>
        </Space>
      ),
    },
    {
      title: "状态",
      width: 120,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Tag color={record.enabled ? "green" : "default"}>{record.enabled ? "成员有效" : "成员已禁用"}</Tag>
          <Typography.Text type="secondary">账号 {record.userStatus || "UNKNOWN"}</Typography.Text>
        </Space>
      ),
    },
    { title: "授权来源", dataIndex: "grantSource", width: 150, render: (value) => value || "-" },
    { title: "更新时间", dataIndex: "updateTime", width: 170, render: (value) => formatDateTime(value) },
    {
      title: "操作",
      fixed: "right",
      width: 190,
      render: (_, record) => {
        const ownerProtected = record.projectRole === "OWNER" && !globalAdministrator;
        const serviceProtected = record.projectRole === "SERVICE" && !globalAdministrator;
        return (
          <Space>
            <Button
              size="small"
              icon={<EditOutlined />}
              disabled={!canManage || ownerProtected || serviceProtected}
              onClick={() => openEdit(record)}
            >
              角色
            </Button>
            <Popconfirm
              title={record.enabled ? "确认禁用该项目成员？" : "确认重新启用该项目成员？"}
              description="禁用后该用户将不再获得项目数据范围；历史授权和审计记录仍会保留。"
              onConfirm={() => stateMutation.mutate({ record, nextEnabled: !record.enabled })}
            >
              <Button
                size="small"
                danger={record.enabled}
                icon={record.enabled ? <StopOutlined /> : <UnlockOutlined />}
                disabled={!canManage || ownerProtected || serviceProtected}
                loading={stateMutation.isPending}
              >
                {record.enabled ? "禁用" : "启用"}
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="项目成员"
        subtitle="查看当前项目有哪些用户、每个用户的项目角色、平台身份与授权状态"
        actions={(
          <Space>
            <DataSourceIndicator meta={membershipQuery.data?.meta ?? sessionQuery.data?.meta} />
            <Button icon={<ReloadOutlined />} onClick={() => membershipQuery.refetch()}>刷新</Button>
          </Space>
        )}
      />

      <div className="grid grid-three">
        <Card><Statistic title="当前项目" value={projectName} prefix={<TeamOutlined />} /></Card>
        <Card><Statistic title="成员总数" value={membershipQuery.data?.data.total ?? 0} /></Card>
        <Card><Statistic title="我的项目角色" value={projectRoleLabels[projectRoleOfCurrentActor] || projectRoleOfCurrentActor || "管理员范围"} /></Card>
      </div>

      {!canManage ? (
        <Alert
          showIcon
          type="info"
          message="当前账号为只读成员视角"
          description="你可以查看当前项目成员及角色；只有项目 OWNER、租户管理员或平台管理员可以调整角色和启停成员关系。"
        />
      ) : null}

      <Card className="table-card">
        <Space wrap style={{ marginBottom: 12 }}>
          <Input.Search
            allowClear
            placeholder="搜索用户名、邮箱、Actor ID 或角色"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            style={{ width: 320 }}
          />
          <Select
            allowClear
            placeholder="全部项目角色"
            value={projectRole}
            onChange={(value) => { setProjectRole(value); setPage((current) => ({ ...current, current: 1 })); }}
            style={{ width: 190 }}
            options={["OWNER", "MANAGER", "READER", "SERVICE"].map((value) => ({ value, label: projectRoleLabels[value] }))}
          />
          <Select
            allowClear
            placeholder="全部成员状态"
            value={enabled}
            onChange={(value) => { setEnabled(value); setPage((current) => ({ ...current, current: 1 })); }}
            style={{ width: 160 }}
            options={[{ value: true, label: "成员有效" }, { value: false, label: "成员已禁用" }]}
          />
        </Space>
        <Table
          rowKey="membershipId"
          columns={columns}
          dataSource={filteredRecords}
          loading={membershipQuery.isLoading}
          scroll={{ x: 1550 }}
          locale={{ emptyText: <RealEmpty meta={membershipQuery.data?.meta} description="当前项目暂无可见成员记录" /> }}
          pagination={controlledTablePagination({
            current: page.current,
            pageSize: page.size,
            total: membershipQuery.data?.data.total,
            onChange: (current, size) => setPage({ current, size }),
          })}
        />
      </Card>

      <Modal
        title={`调整项目角色：${editing?.username || `Actor ${editing?.actorId ?? "-"}`}`}
        open={Boolean(editing)}
        confirmLoading={updateMutation.isPending}
        onCancel={() => { setEditing(undefined); editForm.resetFields(); }}
        onOk={() => editForm.submit()}
      >
        <Alert
          showIcon
          type="warning"
          message="项目 OWNER 不能由普通项目 OWNER 自行授予"
          description="普通项目 OWNER 只能在 MANAGER 与 READER 之间调整；OWNER 与 SERVICE 角色由租户管理员或平台管理员维护。"
          style={{ marginBottom: 16 }}
        />
        <Form<ProjectMembershipUpdatePayload>
          form={editForm}
          layout="vertical"
          onFinish={(values) => editing && updateMutation.mutate({ membershipId: editing.membershipId, payload: values })}
        >
          <Form.Item name="projectRole" label="项目角色" rules={[{ required: true, message: "请选择项目角色" }]}>
            <Select options={[
              { value: "MANAGER", label: projectRoleLabels.MANAGER },
              { value: "READER", label: projectRoleLabels.READER },
              ...(globalAdministrator ? [
                { value: "OWNER", label: projectRoleLabels.OWNER },
                { value: "SERVICE", label: projectRoleLabels.SERVICE },
              ] : []),
            ]} />
          </Form.Item>
          <Form.Item name="grantSource" label="授权来源">
            <Input disabled placeholder="保留原授权来源" />
          </Form.Item>
          <Form.Item name="reason" label="调整原因" rules={[{ required: true, message: "请填写调整原因" }]}>
            <Input.TextArea rows={3} placeholder="用于权限变更审计" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

