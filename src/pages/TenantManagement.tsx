import {
  ApartmentOutlined,
  EditOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  StopOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  api,
  type TenantOpenPayload,
  type TenantUpdatePayload,
} from "@/api/endpoints";
import { DataSourceIndicator } from "@/components/DataSourceIndicator";
import { PageHeader } from "@/components/PageHeader";
import { RealEmpty } from "@/components/RealEmpty";
import { useAuthStore } from "@/store/authStore";
import type { PermissionTenantRecord } from "@/types/domain";
import { formatDateTime } from "@/utils/format";
import { controlledTablePagination } from "@/utils/table";

const statusColors: Record<string, string> = {
  ACTIVE: "green",
  SUSPENDED: "gold",
  CLOSED: "red",
};

const statusLabels: Record<string, string> = {
  ACTIVE: "正常",
  SUSPENDED: "已暂停",
  CLOSED: "已关闭",
};

type TenantLifecycleAction = "activate" | "suspend" | "close";

interface LifecycleTarget {
  action: TenantLifecycleAction;
  tenant: PermissionTenantRecord;
}

function normalizeRole(value?: string) {
  return String(value || "").trim().toUpperCase();
}

/**
 * 平台租户管理页。
 *
 * 开租建立“公司租户 -> FlashSync 应用”，并供应首个租户管理员，不创建工作空间或默认项目。
 * 项目仍由租户用户提交创建申请，并通过审批中心生成，避免开租和业务项目生命周期耦合。
 */
export function TenantManagement() {
  const { message } = App.useApp();
  const authUser = useAuthStore((state) => state.user);
  const [openForm] = Form.useForm<TenantOpenPayload>();
  const [editForm] = Form.useForm<TenantUpdatePayload>();
  const [lifecycleForm] = Form.useForm<{ reason: string }>();
  const [page, setPage] = useState({ current: 1, size: 20 });
  const [tenantCode, setTenantCode] = useState<string>();
  const [tenantName, setTenantName] = useState<string>();
  const [tenantType, setTenantType] = useState<string>();
  const [status, setStatus] = useState<string>();
  const [openVisible, setOpenVisible] = useState(false);
  const [editing, setEditing] = useState<PermissionTenantRecord | null>(null);
  const [lifecycleTarget, setLifecycleTarget] = useState<LifecycleTarget | null>(null);

  const sessionQuery = useQuery({
    queryKey: ["tenant-management-session"],
    queryFn: api.getSession,
  });
  const actorRole = normalizeRole(sessionQuery.data?.data.actorRole ?? authUser?.actorRole);
  const platformAdministrator = actorRole === "PLATFORM_ADMINISTRATOR";

  const tenantQuery = useQuery({
    queryKey: ["platform-tenants", page.current, page.size, tenantCode, tenantName, tenantType, status],
    queryFn: () => api.listTenants({
      current: page.current,
      size: page.size,
      tenantCode,
      tenantName,
      tenantType,
      status,
    }),
    enabled: platformAdministrator,
  });

  const openMutation = useMutation({
    mutationFn: api.openTenant,
    onSuccess: async (result) => {
      message.success(`租户 ${result.data.tenantName}、FlashSync 应用和管理员 ${result.data.administratorUsername} 已开通`);
      setOpenVisible(false);
      openForm.resetFields();
      await tenantQuery.refetch();
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "开租失败"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ tenantId, payload }: { tenantId: number; payload: TenantUpdatePayload }) =>
      api.updateTenant(tenantId, payload),
    onSuccess: async () => {
      message.success("租户资料已更新");
      setEditing(null);
      editForm.resetFields();
      await tenantQuery.refetch();
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "租户资料更新失败"),
  });

  const lifecycleMutation = useMutation({
    mutationFn: ({ action, tenantId, reason }: { action: TenantLifecycleAction; tenantId: number; reason: string }) => {
      if (action === "activate") return api.activateTenant(tenantId, reason);
      if (action === "suspend") return api.suspendTenant(tenantId, reason);
      return api.closeTenant(tenantId, reason);
    },
    onSuccess: async (result) => {
      message.success(`租户状态已更新为 ${statusLabels[result.data.status] || result.data.status}`);
      setLifecycleTarget(null);
      lifecycleForm.resetFields();
      await tenantQuery.refetch();
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "租户状态更新失败"),
  });

  const openEdit = (tenant: PermissionTenantRecord) => {
    setEditing(tenant);
    editForm.setFieldsValue({
      tenantName: tenant.tenantName,
      tenantType: tenant.tenantType,
      planCode: tenant.planCode,
      description: tenant.description,
      reason: "平台管理员维护租户资料",
    });
  };

  const openLifecycle = (action: TenantLifecycleAction, tenant: PermissionTenantRecord) => {
    setLifecycleTarget({ action, tenant });
    lifecycleForm.setFieldsValue({
      reason: action === "activate" ? "恢复租户业务访问" : action === "suspend" ? "暂停租户业务访问" : "关闭租户服务",
    });
  };

  const columns: ColumnsType<PermissionTenantRecord> = [
    {
      title: "租户 ID",
      dataIndex: "tenantId",
      width: 100,
      render: (value) => <Typography.Text className="mono">{value}</Typography.Text>,
    },
    {
      title: "租户",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.tenantName}</Typography.Text>
          <Typography.Text type="secondary" className="mono">{record.tenantCode}</Typography.Text>
        </Space>
      ),
    },
    { title: "类型", dataIndex: "tenantType", width: 110, render: (value) => <Tag>{value}</Tag> },
    { title: "套餐", dataIndex: "planCode", width: 130, render: (value) => <Tag color="blue">{value}</Tag> },
    {
      title: "FlashSync 应用",
      width: 190,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{record.applicationName || "尚未初始化"}</Typography.Text>
          <Typography.Text type="secondary" className="mono">
            {record.applicationId ? `ID ${record.applicationId} · ${record.applicationCode}` : "-"}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (value) => <Tag color={statusColors[value] || "default"}>{statusLabels[value] || value}</Tag>,
    },
    {
      title: "管理账号",
      width: 190,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{record.administratorUsername || "尚未绑定管理账号"}</Typography.Text>
          <Typography.Text type="secondary" className="mono">
            {record.administratorActorId ? `Actor ${record.administratorActorId}` : "-"}
          </Typography.Text>
        </Space>
      ),
    },
    { title: "开租时间", dataIndex: "openedAt", width: 170, render: formatDateTime },
    {
      title: "操作",
      width: 220,
      fixed: "right",
      render: (_, record) => (
        <Space wrap>
          <Button
            size="small"
            icon={<EditOutlined />}
            disabled={record.status === "CLOSED"}
            onClick={() => openEdit(record)}
          >
            编辑
          </Button>
          {record.status === "ACTIVE" ? (
            <Button size="small" icon={<PauseCircleOutlined />} onClick={() => openLifecycle("suspend", record)}>
              暂停
            </Button>
          ) : null}
          {record.status === "SUSPENDED" ? (
            <Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={() => openLifecycle("activate", record)}>
              恢复
            </Button>
          ) : null}
          {record.status !== "CLOSED" ? (
            <Button danger size="small" icon={<StopOutlined />} onClick={() => openLifecycle("close", record)}>
              关闭
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  if (!platformAdministrator && !sessionQuery.isLoading) {
    return (
      <div className="page-stack">
        <PageHeader title="租户管理" subtitle="平台开租与租户生命周期管理" />
        <Alert
          showIcon
          type="error"
          message="当前账号不是平台超级管理员"
          description="租户管理员、项目 OWNER 和普通用户不能查看租户名录或执行开租；直接调用接口也会被后端拒绝。"
        />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="租户管理"
        subtitle="平台超级管理员开通公司租户、FlashSync 应用和首个租户管理员，并管理租户生命周期"
        actions={(
          <>
            <DataSourceIndicator meta={tenantQuery.data?.meta} />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpenVisible(true)}>开通租户</Button>
          </>
        )}
      />

      <Alert
        showIcon
        type="info"
        message="开租层级：租户 → FlashSync 应用 → 首个租户管理员"
        description="管理员账号创建在 Keycloak/企业 IdP，DataSmart 只保存低敏影子身份；密码不会进入业务数据库。开租不创建工作空间或默认项目，管理员后续审批租户用户的项目创建申请。"
      />

      <Card className="compact-card">
        <Space wrap>
          <Input allowClear placeholder="租户编码" value={tenantCode} onChange={(event) => { setTenantCode(event.target.value || undefined); setPage((value) => ({ ...value, current: 1 })); }} />
          <Input allowClear placeholder="租户名称" value={tenantName} onChange={(event) => { setTenantName(event.target.value || undefined); setPage((value) => ({ ...value, current: 1 })); }} />
          <Select allowClear placeholder="租户类型" value={tenantType} onChange={(value) => { setTenantType(value); setPage((pageValue) => ({ ...pageValue, current: 1 })); }} options={["BUSINESS", "INTERNAL", "PLATFORM"].map((value) => ({ value, label: value }))} style={{ width: 150 }} />
          <Select allowClear placeholder="租户状态" value={status} onChange={(value) => { setStatus(value); setPage((pageValue) => ({ ...pageValue, current: 1 })); }} options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))} style={{ width: 150 }} />
        </Space>
      </Card>

      <Card className="table-card">
        <Table
          rowKey="tenantId"
          columns={columns}
          dataSource={tenantQuery.data?.data.records ?? []}
          loading={tenantQuery.isLoading}
          scroll={{ x: 1250 }}
          locale={{ emptyText: <RealEmpty meta={tenantQuery.data?.meta} description="暂无租户记录" /> }}
          pagination={controlledTablePagination({
            current: page.current,
            pageSize: page.size,
            total: tenantQuery.data?.data.total,
            onChange: (current, size) => setPage({ current, size }),
          })}
        />
      </Card>

      <Modal
        title={<Space><ApartmentOutlined />开通租户</Space>}
        width={720}
        open={openVisible}
        onCancel={() => setOpenVisible(false)}
        onOk={() => openForm.submit()}
        confirmLoading={openMutation.isPending}
        okText="确认开租"
        destroyOnHidden
        forceRender
      >
        <Form<TenantOpenPayload>
          form={openForm}
          layout="vertical"
          initialValues={{ tenantType: "BUSINESS", planCode: "STANDARD", applicationCode: "FLASHSYNC", applicationName: "FlashSync", administratorTemporaryPassword: true, reason: "平台管理员开通新租户" }}
          onFinish={(values) => openMutation.mutate(values)}
        >
          <div className="grid grid-two-form">
            <Form.Item name="tenantCode" label="租户编码" rules={[{ required: true, message: "请输入稳定租户编码" }]}><Input placeholder="例如 ACME，创建后不可修改" /></Form.Item>
            <Form.Item name="tenantName" label="租户名称" rules={[{ required: true, message: "请输入公司或组织名称" }]}><Input placeholder="例如 Acme 制造有限公司" /></Form.Item>
            <Form.Item name="tenantType" label="租户类型" rules={[{ required: true }]}><Select options={["BUSINESS", "INTERNAL", "PLATFORM"].map((value) => ({ value, label: value }))} /></Form.Item>
            <Form.Item name="planCode" label="套餐编码" rules={[{ required: true }]}><Input placeholder="STANDARD / PROFESSIONAL / ENTERPRISE" /></Form.Item>
            <Form.Item name="applicationName" label="应用名称" rules={[{ required: true }]}><Input disabled /></Form.Item>
            <Form.Item name="administratorUsername" label="首个租户管理员用户名" rules={[{ required: true, message: "请输入租户管理员用户名" }]}><Input autoComplete="off" placeholder="例如 acme-admin" /></Form.Item>
            <Form.Item name="administratorEmail" label="租户管理员邮箱" rules={[{ type: "email", message: "请输入有效邮箱" }]}><Input placeholder="admin@example.com" /></Form.Item>
            <Form.Item name="administratorFirstName" label="管理员名"><Input placeholder="可选" /></Form.Item>
            <Form.Item name="administratorLastName" label="管理员姓"><Input placeholder="可选" /></Form.Item>
            <Form.Item name="administratorInitialPassword" label="初始密码" rules={[{ required: true, min: 8, message: "初始密码至少 8 位" }]}><Input.Password autoComplete="new-password" /></Form.Item>
            <Form.Item name="administratorTemporaryPassword" valuePropName="checked"><Checkbox>首次登录必须修改密码</Checkbox></Form.Item>
          </div>
          <Form.Item name="applicationCode" hidden><Input /></Form.Item>
          <Form.Item name="description" label="租户说明"><Input.TextArea rows={3} placeholder="客户行业、交付范围、数据区域或合同说明，不要填写密码和连接串" /></Form.Item>
          <Form.Item name="reason" label="开租原因" rules={[{ required: true, message: "请填写开租审计原因" }]}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`编辑租户：${editing?.tenantName || ""}`}
        open={Boolean(editing)}
        onCancel={() => setEditing(null)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
        destroyOnHidden
        forceRender
      >
        <Form<TenantUpdatePayload>
          form={editForm}
          layout="vertical"
          onFinish={(values) => editing && updateMutation.mutate({ tenantId: editing.tenantId, payload: values })}
        >
          <Form.Item name="tenantName" label="租户名称" rules={[{ required: true }]}><Input /></Form.Item>
          <div className="grid grid-two-form">
            <Form.Item name="tenantType" label="租户类型"><Select options={["BUSINESS", "INTERNAL", "PLATFORM"].map((value) => ({ value, label: value }))} /></Form.Item>
            <Form.Item name="planCode" label="套餐编码"><Input /></Form.Item>
          </div>
          <Form.Item name="description" label="租户说明"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="reason" label="修改原因" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title={lifecycleTarget?.action === "activate" ? "恢复租户" : lifecycleTarget?.action === "suspend" ? "暂停租户" : "关闭租户"}
        open={Boolean(lifecycleTarget)}
        onCancel={() => setLifecycleTarget(null)}
        onOk={() => lifecycleForm.submit()}
        okButtonProps={{ danger: lifecycleTarget?.action === "close" }}
        confirmLoading={lifecycleMutation.isPending}
        destroyOnHidden
        forceRender
      >
        {lifecycleTarget?.action === "close" ? <Alert showIcon type="warning" message="关闭是不可通过普通恢复接口撤销的终态，租户历史和审计仍会保留。" style={{ marginBottom: 16 }} /> : null}
        <Form<{ reason: string }>
          form={lifecycleForm}
          layout="vertical"
          onFinish={(values) => lifecycleTarget && lifecycleMutation.mutate({
            action: lifecycleTarget.action,
            tenantId: lifecycleTarget.tenant.tenantId,
            reason: values.reason,
          })}
        >
          <Form.Item name="reason" label="操作原因" rules={[{ required: true, message: "请填写状态变更原因" }]}><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
