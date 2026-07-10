import {
  ApiOutlined,
  CloudSyncOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Alert, App, Button, Card, Checkbox, Descriptions, Drawer, Form, Input, Modal, Select, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  api,
  type CreateDataSourcePayload,
  type GrantDataSourceAuthorizationPayload,
  type MetadataDiscoveryPayload,
  type UpdateDataSourcePayload,
} from "@/api/endpoints";
import { DataSourceIndicator } from "@/components/DataSourceIndicator";
import { RealEmpty } from "@/components/RealEmpty";
import { HealthTag, RiskTag } from "@/components/StatusTag";
import { PageHeader } from "@/components/PageHeader";
import { useUiStore } from "@/store/uiStore";
import type {
  AuthorizationSubjectCandidate,
  DataSourceAuthorizationRecord,
  DataSourceConnectionTestResult,
  DataSourceRecord,
} from "@/types/domain";
import { formatDateTime } from "@/utils/format";
import { connectorLabels, labelOf, statusLabels } from "@/utils/labels";
import { controlledTablePagination, defaultTablePagination, sortByIdDesc } from "@/utils/table";

const statusColor: Record<DataSourceRecord["status"], string> = {
  ENABLED: "green",
  DISABLED: "default",
  TESTING: "blue",
  ERROR: "red",
};

const environmentLabels: Record<string, string> = {
  DEV: "开发",
  TEST: "测试",
  PROD: "生产",
};

const usageRoleLabels: Record<string, string> = {
  SOURCE: "仅源端",
  TARGET: "仅目标端",
};

function isNumericScopeValue(value?: string | number) {
  if (value == null || value === "") {
    return false;
  }
  return Number.isFinite(Number(value));
}

type DataSourceAuthorizationFormValues = GrantDataSourceAuthorizationPayload & {
  subjectKey?: string;
};

function connectionTestAlertType(result: DataSourceConnectionTestResult) {
  if (String(result.testStatus).toUpperCase() !== "SUCCESS") {
    return "error";
  }
  return result.metadataDiscoverable === false ? "warning" : "success";
}

function hasChangedConnectionField(changedValues: Record<string, unknown>) {
  return ["type", "jdbcUrl", "username", "password"].some((field) =>
    Object.prototype.hasOwnProperty.call(changedValues, field),
  );
}

function normalizeProjectRole(value?: string) {
  const role = String(value || "").trim().toUpperCase();
  if (["OWNER", "PROJECT_OWNER"].includes(role)) return "OWNER";
  if (["MANAGER", "OPERATOR", "TENANT_ADMINISTRATOR", "PLATFORM_ADMINISTRATOR"].includes(role)) return "MANAGER";
  if (["READER", "AUDITOR"].includes(role)) return "READER";
  return role;
}

function hasDatasourceAction(record: DataSourceRecord, action: string) {
  const actions = record.effectiveActions?.map((item) => item.toUpperCase()) ?? [];
  return actions.includes(action.toUpperCase());
}

function ConnectionTestInlineResult({ result }: { result: DataSourceConnectionTestResult | null }) {
  if (!result) {
    return null;
  }
  const database = [result.productName, result.productVersion].filter(Boolean).join(" ") || "-";
  return (
    <Alert
      showIcon
      type={connectionTestAlertType(result)}
      message={result.message || "连接测试已完成"}
      description={
        <Space direction="vertical" size={4}>
          <Typography.Text type="secondary">状态：{result.testStatus || "-"}</Typography.Text>
          <Typography.Text type="secondary">数据库：{database}</Typography.Text>
          <Typography.Text type="secondary">
            Catalog / Schema：{result.currentCatalog || "-"} / {result.currentSchema || "-"}
          </Typography.Text>
          <Typography.Text type="secondary">发现表数量：{result.discoveredTableCount ?? "-"}</Typography.Text>
          {result.warnings?.map((warning) => (
            <Typography.Text key={warning} type="warning">
              {warning}
            </Typography.Text>
          ))}
        </Space>
      }
      style={{ marginBottom: 12 }}
    />
  );
}

export function DataSources() {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<CreateDataSourcePayload>();
  const [editForm] = Form.useForm<UpdateDataSourcePayload>();
  const [authorizationForm] = Form.useForm<DataSourceAuthorizationFormValues>();
  const [keyword, setKeyword] = useState("");
  const [type, setType] = useState<string>("ALL");
  const [dataSourcePage, setDataSourcePage] = useState(1);
  const [dataSourcePageSize, setDataSourcePageSize] = useState(10);
  const [selected, setSelected] = useState<DataSourceRecord | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<DataSourceRecord | null>(null);
  const [authorizationOpen, setAuthorizationOpen] = useState(false);
  const [authorizationTarget, setAuthorizationTarget] = useState<DataSourceRecord | null>(null);
  const [authorizationSubjectType, setAuthorizationSubjectType] = useState<"USER" | "ROLE">("USER");
  const [authorizationKeyword, setAuthorizationKeyword] = useState("");
  const [connectionTestResult, setConnectionTestResult] = useState<DataSourceConnectionTestResult | null>(null);
  const [createConnectionTestResult, setCreateConnectionTestResult] = useState<DataSourceConnectionTestResult | null>(null);
  const [editConnectionTestResult, setEditConnectionTestResult] = useState<DataSourceConnectionTestResult | null>(null);
  const selectedProjectId = useUiStore((state) => state.selectedProjectId);
  const projectOptions = useUiStore((state) => state.projectOptions);
  const selectedProjectScopeId = isNumericScopeValue(selectedProjectId) ? Number(selectedProjectId) : undefined;
  const sessionQuery = useQuery({
    queryKey: ["datasource-gateway-session"],
    queryFn: api.getSession,
  });
  const dataSourceQuery = useQuery({
    queryKey: ["datasources", selectedProjectScopeId, keyword, type, dataSourcePage, dataSourcePageSize],
    queryFn: () => api.listDataSources({
      projectId: selectedProjectScopeId,
      keyword: keyword.trim() || undefined,
      type: type === "ALL" ? undefined : type,
      current: dataSourcePage,
      size: dataSourcePageSize,
    }),
  });
  const notifyConnectionTestResult = (data: DataSourceConnectionTestResult) => {
    if (String(data.testStatus).toUpperCase() !== "SUCCESS") {
      message.error(data.message || "连接测试失败");
    } else if (data.metadataDiscoverable === false) {
      message.warning(data.message || "连接已打通，但元数据不可发现");
    } else {
      message.success(data.message || "连接测试已完成");
    }
  };
  const showConnectionTestResult = (data: DataSourceConnectionTestResult) => {
    setConnectionTestResult(data);
    notifyConnectionTestResult(data);
  };
  const createMutation = useMutation({
    mutationFn: api.createDataSource,
    onSuccess: async () => {
      message.success("数据源已创建");
      setCreateOpen(false);
      setCreateConnectionTestResult(null);
      form.resetFields();
      await dataSourceQuery.refetch();
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "数据源创建失败"),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateDataSourcePayload }) => api.updateDataSource(id, payload),
    onSuccess: async () => {
      message.success("数据源已更新");
      setEditOpen(false);
      setEditing(null);
      setEditConnectionTestResult(null);
      editForm.resetFields();
      await dataSourceQuery.refetch();
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "数据源更新失败"),
  });
  const deleteMutation = useMutation({
    mutationFn: api.deleteDataSource,
    onSuccess: async () => {
      message.success("数据源已删除");
      await dataSourceQuery.refetch();
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "数据源删除失败"),
  });
  const testMutation = useMutation({
    mutationFn: api.testDataSource,
    onSuccess: async (result) => {
      showConnectionTestResult(result.data);
      await dataSourceQuery.refetch();
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "连接测试失败"),
  });
  const draftTestMutation = useMutation({
    mutationFn: api.testDataSourceConnection,
    onSuccess: (result) => {
      setCreateConnectionTestResult(result.data);
      notifyConnectionTestResult(result.data);
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "连接测试失败"),
  });
  const editDraftTestMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { jdbcUrl: string; username: string; password?: string } }) =>
      api.testExistingDataSourceConnection(id, payload),
    onSuccess: (result) => {
      setEditConnectionTestResult(result.data);
      notifyConnectionTestResult(result.data);
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "连接测试失败"),
  });
  const metadataMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: MetadataDiscoveryPayload }) =>
      api.discoverDataSourceMetadata(id, payload),
    onSuccess: () => message.success("元数据采集已完成"),
    onError: (error) => message.error(error instanceof Error ? error.message : "元数据采集失败"),
  });

  const records = useMemo(() => (dataSourceQuery.data?.data.records ?? []).map((record) => ({
    ...record,
    projectName: projectOptions.find((project) => project.value === String(record.projectId))?.label
      ?? record.projectName
      ?? (record.projectId == null ? "未归属项目" : `未找到项目名称（ID ${record.projectId}）`),
    ownerName: record.ownerName ?? (record.ownerId == null ? "未标注所有者" : `Actor ${record.ownerId}`),
  })), [dataSourceQuery.data?.data.records, projectOptions]);
  const session = sessionQuery.data?.data;
  const currentProjectId = selectedProjectId ?? session?.authorizedProjectIds?.[0];
  const currentProject = session?.authorizedProjects?.find((project) => String(project.projectId ?? project.id) === String(currentProjectId));
  const currentProjectLabel = projectOptions.find((project) => project.value === String(currentProjectId))?.label
    ?? currentProject?.projectName
    ?? currentProject?.name
    ?? session?.projectName
    ?? (currentProjectId == null ? "未选择项目" : "未找到项目名称");
  const actorId = Number(session?.actorId);
  const currentProjectRole = normalizeProjectRole(currentProject?.projectRole ?? currentProject?.role ?? session?.actorRole);
  const canManageCurrentProject = currentProjectRole === "OWNER" || currentProjectRole === "MANAGER";
  const scopedProjectId = selectedProjectScopeId == null ? undefined : String(selectedProjectScopeId);
  const authorizationQuery = useQuery({
    queryKey: ["datasource-authorizations", authorizationTarget?.id],
    queryFn: () => api.listDataSourceAuthorizations(authorizationTarget!.id, { size: 50 }),
    enabled: authorizationOpen && Boolean(authorizationTarget?.id),
  });
  const authorizationSubjectQuery = useQuery({
    queryKey: [
      "authorization-subject-candidates",
      authorizationOpen,
      authorizationTarget?.tenantId,
      authorizationTarget?.projectId,
      authorizationSubjectType,
      authorizationKeyword,
    ],
    queryFn: () =>
      api.listAuthorizationSubjectCandidates({
        tenantId: authorizationTarget?.tenantId,
        projectId: authorizationTarget?.projectId,
        subjectType: authorizationSubjectType,
        keyword: authorizationKeyword || undefined,
        activeOnly: true,
        projectMembersOnly: authorizationSubjectType === "USER",
        size: 30,
      }),
    enabled: authorizationOpen && Boolean(authorizationTarget?.id),
  });
  const grantAuthorizationMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: GrantDataSourceAuthorizationPayload }) =>
      api.grantDataSourceAuthorization(id, payload),
    onSuccess: async () => {
      message.success("数据源授权已保存");
      authorizationForm.resetFields();
      authorizationForm.setFieldsValue({ subjectType: authorizationSubjectType, authorizedActions: ["VIEW", "USE", "MANAGE"] });
      await authorizationQuery.refetch();
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "数据源授权失败"),
  });
  const revokeAuthorizationMutation = useMutation({
    mutationFn: ({ datasourceId, authorizationId }: { datasourceId: number; authorizationId: number }) =>
      api.revokeDataSourceAuthorization(datasourceId, authorizationId, "前端手动撤销数据源授权"),
    onSuccess: async () => {
      message.success("授权已撤销");
      await authorizationQuery.refetch();
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "撤销授权失败"),
  });
  const matchCurrentScope = (record: DataSourceRecord) => {
    return !scopedProjectId || record.projectId == null || String(record.projectId) === scopedProjectId;
  };
  const filtered = records.filter((record) => matchCurrentScope(record));

  useEffect(() => {
    setDataSourcePage(1);
  }, [selectedProjectScopeId, keyword, type]);

  const openCreateModal = () => {
    form.resetFields();
    setCreateConnectionTestResult(null);
    form.setFieldsValue({
      type: "MYSQL",
      usageRole: "SOURCE",
    });
    setCreateOpen(true);
  };

  const closeCreateModal = () => {
    setCreateOpen(false);
    setCreateConnectionTestResult(null);
    form.resetFields();
  };

  const testCreateConnection = () => {
    void form
      .validateFields(["type", "jdbcUrl", "username", "password"])
      .then((values) => {
        setCreateConnectionTestResult(null);
        draftTestMutation.mutate({
          type: values.type,
          jdbcUrl: values.jdbcUrl,
          username: values.username,
          password: values.password,
        });
      })
      .catch(() => undefined);
  };

  const submitCreate = (values: CreateDataSourcePayload) => {
    const session = sessionQuery.data?.data;
    const tenantId = Number(session?.tenantId);
    const projectId = Number(selectedProjectId ?? session?.authorizedProjectIds?.[0]);
    if (!Number.isFinite(tenantId) || !Number.isFinite(projectId)) {
      message.error("当前租户或项目上下文尚未就绪，无法创建数据源");
      return;
    }
    const payload = {
      ...values,
      tenantId,
      projectId,
      description: values.description || undefined,
    };
    createMutation.mutate(payload);
  };

  const openEditModal = (record: DataSourceRecord) => {
    setEditing(record);
    setEditConnectionTestResult(null);
    editForm.resetFields();
    editForm.setFieldsValue({
      name: record.name,
      usageRole: record.usageRole || "SOURCE",
      jdbcUrl: record.jdbcUrl || "",
      username: record.username || "",
      description: record.description || undefined,
    });
    setEditOpen(true);
  };

  const testEditConnection = () => {
    if (!editing) {
      return;
    }
    void editForm
      .validateFields(["jdbcUrl", "username", "password"])
      .then((values) => {
        setEditConnectionTestResult(null);
        editDraftTestMutation.mutate({
          id: editing.id,
          payload: {
            jdbcUrl: values.jdbcUrl,
            username: values.username,
            password: values.password || undefined,
          },
        });
      })
      .catch(() => undefined);
  };

  const submitEdit = (values: UpdateDataSourcePayload) => {
    if (!editing) {
      return;
    }
    updateMutation.mutate({
      id: editing.id,
      payload: {
        ...values,
        password: values.password || undefined,
        description: values.description || undefined,
      },
    });
  };

  const confirmDelete = (record: DataSourceRecord) => {
    modal.confirm({
      title: "删除数据源",
      content: `将逻辑删除数据源“${record.name}”。删除后新任务不能继续选择它，历史任务和审计记录仍会保留。`,
      okText: "确认删除",
      okType: "danger",
      cancelText: "取消",
      onOk: () => deleteMutation.mutateAsync(record.id),
    });
  };

  const isDatasourceOwner = (record: DataSourceRecord) => (
    Number.isFinite(actorId) && record.ownerId != null && Number(record.ownerId) === actorId
  );
  const canEditDatasource = (record: DataSourceRecord) => (
    canManageCurrentProject || isDatasourceOwner(record) || hasDatasourceAction(record, "MANAGE")
  );
  const canUseDatasource = (record: DataSourceRecord) => (
    canManageCurrentProject || isDatasourceOwner(record) || hasDatasourceAction(record, "USE") || hasDatasourceAction(record, "MANAGE")
  );
  const canDeleteDatasource = (record: DataSourceRecord) => canManageCurrentProject || isDatasourceOwner(record);
  const canGrantDatasource = (record: DataSourceRecord) => canManageCurrentProject || isDatasourceOwner(record);

  const openAuthorizationModal = (record: DataSourceRecord) => {
    setAuthorizationTarget(record);
    setAuthorizationOpen(true);
    setAuthorizationSubjectType("USER");
    setAuthorizationKeyword("");
    authorizationForm.resetFields();
    authorizationForm.setFieldsValue({
      subjectType: "USER",
      authorizedActions: ["VIEW", "USE", "MANAGE"],
      grantReason: "项目内数据同步协作授权",
    });
  };

  const subjectCandidates = authorizationSubjectQuery.data?.data.records ?? [];
  const findCandidateByKey = (key?: string) =>
    subjectCandidates.find((candidate) => `${candidate.subjectType}:${candidate.subjectId}` === key);

  const submitAuthorization = (values: DataSourceAuthorizationFormValues) => {
    if (!authorizationTarget) {
      return;
    }
    const candidate = findCandidateByKey(values.subjectKey);
    if (!candidate) {
      message.error("请选择要授权的用户或角色");
      return;
    }
    grantAuthorizationMutation.mutate({
      id: authorizationTarget.id,
      payload: {
        subjectType: candidate.subjectType,
        subjectId: candidate.subjectId,
        subjectName: candidate.subjectName,
        subjectRole: candidate.subjectRole,
        authorizedActions: values.authorizedActions,
        grantReason: values.grantReason,
      },
    });
  };

  const buildMetadataPayload = (): MetadataDiscoveryPayload | null => {
    const session = sessionQuery.data?.data;
    const actorId = Number(session?.actorId);
    const actorTenantId = Number(session?.tenantId);
    if (!Number.isFinite(actorId) || !Number.isFinite(actorTenantId) || !session?.actorRole) {
      message.error("网关会话尚未就绪，无法提交元数据采集");
      return null;
    }
    return {
      actorId,
      actorTenantId,
      actorRole: session.actorRole,
      maxTables: 20,
      maxColumnsPerTable: 80,
      includeColumns: true,
      includeViews: true,
      includePrimaryKeys: true,
      includeIndexes: false,
      includeSampleRows: false,
    };
  };

  const authorizationColumns: ColumnsType<DataSourceAuthorizationRecord> = [
    {
      title: "ID",
      dataIndex: "id",
      width: 82,
      render: (value) => <Typography.Text className="mono">{value}</Typography.Text>,
    },
    {
      title: "授权主体",
      dataIndex: "subjectName",
      render: (value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{value || record.subjectId}</Typography.Text>
          <Typography.Text type="secondary">
            {record.subjectType} / {record.subjectRole || "-"} / {record.subjectId}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "动作",
      dataIndex: "authorizedActions",
      render: (value) => String(value || "").split(",").filter(Boolean).map((action) => <Tag key={action}>{action}</Tag>),
    },
    { title: "状态", dataIndex: "status", render: (value) => <Tag color={value === "ACTIVE" ? "green" : "default"}>{value || "-"}</Tag> },
    { title: "授权时间", dataIndex: "grantedTime", render: (value) => formatDateTime(value) },
    {
      title: "操作",
      width: 96,
      render: (_, record) => (
        <Button
          danger
          size="small"
          loading={revokeAuthorizationMutation.isPending}
          disabled={!authorizationTarget || record.status === "REVOKED"}
          onClick={() => authorizationTarget && revokeAuthorizationMutation.mutate({
            datasourceId: authorizationTarget.id,
            authorizationId: record.id,
          })}
        >
          撤销
        </Button>
      ),
    },
  ];

  const columns: ColumnsType<DataSourceRecord> = [
    {
      title: "ID",
      dataIndex: "id",
      width: 82,
      render: (value) => <Typography.Text className="mono">{value}</Typography.Text>,
    },
    {
      title: "数据源",
      dataIndex: "name",
      render: (value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{value}</Typography.Text>
          <Typography.Text type="secondary">
            {labelOf(record.environment, environmentLabels)}环境 / {record.projectName}
          </Typography.Text>
        </Space>
      ),
    },
    { title: "类型", dataIndex: "type", render: (value) => <Tag icon={<DatabaseOutlined />}>{labelOf(value, connectorLabels)}</Tag> },
    { title: "用途", dataIndex: "usageRole", render: (value) => <Tag color={value === "TARGET" ? "green" : "blue"}>{labelOf(value || "SOURCE", usageRoleLabels)}</Tag> },
    { title: "连接", dataIndex: "connectionHealth", render: (value) => <HealthTag value={value} /> },
    {
      title: "状态",
      dataIndex: "status",
      render: (value: DataSourceRecord["status"]) => <Tag color={statusColor[value]}>{labelOf(value, statusLabels)}</Tag>,
    },
    { title: "敏感级别", dataIndex: "sensitivity", render: (value) => <RiskTag value={value} /> },
    { title: "表数", dataIndex: "tableCount" },
    { title: "最近同步", dataIndex: "lastSyncAt", render: (value) => formatDateTime(value) },
    {
      title: "操作",
      width: 320,
      render: (_, record) => (
        <Space>
          <Button aria-label="查看详情" title="查看详情" icon={<EyeOutlined />} onClick={() => setSelected(record)} />
          <Button
            aria-label="编辑"
            title={canEditDatasource(record) ? "编辑" : "需要项目管理角色、数据源所有者或数据源 MANAGE 授权"}
            icon={<EditOutlined />}
            disabled={!canEditDatasource(record)}
            onClick={() => openEditModal(record)}
          />
          <Button
            aria-label="测试连接"
            title="测试连接"
            icon={<ApiOutlined />}
            loading={testMutation.isPending}
            disabled={!canUseDatasource(record)}
            onClick={() => testMutation.mutate(record.id)}
          />
          <Button
            aria-label="采集元数据"
            title="采集元数据"
            icon={<CloudSyncOutlined />}
            loading={metadataMutation.isPending}
            disabled={!canUseDatasource(record)}
            onClick={() => {
              const payload = buildMetadataPayload();
              if (payload) {
                metadataMutation.mutate({ id: record.id, payload });
              }
            }}
          />
          <Button
            aria-label="授权"
            title={canGrantDatasource(record) ? "授权" : "只有项目管理者或数据源所有者可以授权"}
            icon={<TeamOutlined />}
            disabled={!canGrantDatasource(record)}
            onClick={() => openAuthorizationModal(record)}
          />
          <Button
            danger
            aria-label="删除"
            title={canDeleteDatasource(record) ? "删除" : "只有项目管理者或数据源所有者可以删除"}
            icon={<DeleteOutlined />}
            loading={deleteMutation.isPending}
            disabled={!canDeleteDatasource(record)}
            onClick={() => confirmDelete(record)}
          />
        </Space>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="数据源"
        subtitle="连接、权限、元数据采集和只读 SQL 审计"
        actions={
          <>
            <DataSourceIndicator meta={dataSourceQuery.data?.meta} />
            <Button
              type="primary"
              icon={<DatabaseOutlined />}
              disabled={!canManageCurrentProject}
              title={canManageCurrentProject ? "新建数据源" : "需要当前项目 MANAGER 或 OWNER 权限"}
              onClick={openCreateModal}
            >
              新建数据源
            </Button>
          </>
        }
      />

      <Card className="compact-card">
        <div className="toolbar">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索名称、负责人、类型"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            style={{ width: 280 }}
          />
          <Select
            value={type}
            onChange={setType}
            style={{ width: 180 }}
            options={[
              { value: "ALL", label: "全部类型" },
              { value: "MySQL", label: "MySQL" },
              { value: "PostgreSQL", label: "PostgreSQL" },
              { value: "Kafka", label: "Kafka" },
              { value: "MongoDB", label: "MongoDB" },
              { value: "MinIO", label: "MinIO" },
              { value: "API", label: "API 接口" },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => dataSourceQuery.refetch()} />
        </div>
      </Card>

      <Card className="table-card">
        {dataSourceQuery.isError ? (
          <Alert
            showIcon
            type="error"
            message="数据源接口请求失败"
            description={
              dataSourceQuery.error instanceof Error
                ? dataSourceQuery.error.message
                : "请确认已经登录，并且当前账号拥有数据源查看权限。"
            }
            style={{ marginBottom: 12 }}
          />
        ) : null}
        <Table
          rowKey="id"
          columns={columns}
          dataSource={sortByIdDesc(filtered)}
          loading={dataSourceQuery.isLoading}
          locale={{ emptyText: <RealEmpty meta={dataSourceQuery.data?.meta} description="暂无数据源记录" /> }}
          pagination={controlledTablePagination({
            current: dataSourcePage,
            pageSize: dataSourcePageSize,
            total: dataSourceQuery.data?.data.total,
            onChange: (page, pageSize) => {
              setDataSourcePage(pageSize !== dataSourcePageSize ? 1 : page);
              setDataSourcePageSize(pageSize);
            },
          })}
        />
      </Card>

      <Drawer
        width={520}
        title={selected?.name}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        destroyOnClose
      >
        {selected ? (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="数据源 ID">{selected.id}</Descriptions.Item>
            <Descriptions.Item label="类型">{labelOf(selected.type, connectorLabels)}</Descriptions.Item>
            <Descriptions.Item label="环境">{labelOf(selected.environment, environmentLabels)}</Descriptions.Item>
            <Descriptions.Item label="所属项目">{selected.projectName || "-"}</Descriptions.Item>
            <Descriptions.Item label="所有者">{selected.ownerName || selected.owner}</Descriptions.Item>
            <Descriptions.Item label="用途">{labelOf(selected.usageRole || "SOURCE", usageRoleLabels)}</Descriptions.Item>
            <Descriptions.Item label="JDBC URL">{selected.jdbcUrl || "-"}</Descriptions.Item>
            <Descriptions.Item label="用户名">{selected.username || "-"}</Descriptions.Item>
            <Descriptions.Item label="连接状态">
              <HealthTag value={selected.connectionHealth} />
            </Descriptions.Item>
            <Descriptions.Item label="敏感级别">
              <RiskTag value={selected.sensitivity} />
            </Descriptions.Item>
            <Descriptions.Item label="表数量">{selected.tableCount}</Descriptions.Item>
            <Descriptions.Item label="最近同步">{formatDateTime(selected.lastSyncAt)}</Descriptions.Item>
            <Descriptions.Item label="描述">{selected.description || "-"}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>

      <Modal
        title="新建数据源"
        open={createOpen}
        onCancel={closeCreateModal}
        footer={
          <Space>
            <Button onClick={closeCreateModal} disabled={createMutation.isPending || draftTestMutation.isPending}>
              取消
            </Button>
            <Button
              icon={<ApiOutlined />}
              onClick={testCreateConnection}
              loading={draftTestMutation.isPending}
              disabled={createMutation.isPending || draftTestMutation.isPending}
            >
              测试连接
            </Button>
            <Button
              type="primary"
              onClick={() => form.submit()}
              loading={createMutation.isPending}
              disabled={createMutation.isPending || draftTestMutation.isPending}
            >
              保存
            </Button>
          </Space>
        }
        destroyOnClose
      >
        <Form<CreateDataSourcePayload>
          form={form}
          layout="vertical"
          onFinish={submitCreate}
          onValuesChange={(changedValues) => {
            if (hasChangedConnectionField(changedValues as Record<string, unknown>)) {
              setCreateConnectionTestResult(null);
            }
          }}
        >
          <div className="scope-summary">
            <Typography.Text strong>创建到当前项目</Typography.Text>
            <Typography.Text type="secondary">{currentProjectLabel}</Typography.Text>
          </div>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入数据源名称" }]}>
            <Input placeholder="crm-member-mysql" />
          </Form.Item>
          <Form.Item name="usageRole" label="用途" rules={[{ required: true, message: "请选择数据源用途" }]}>
            <Select
              options={[
                { value: "SOURCE", label: "仅作为源端" },
                { value: "TARGET", label: "仅作为目标端" },
              ]}
            />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true, message: "请选择数据源类型" }]}>
            <Select
              options={[
                { value: "MYSQL", label: "MySQL" },
                { value: "POSTGRESQL", label: "PostgreSQL" },
                { value: "SQLSERVER", label: "SQL Server" },
                { value: "ORACLE", label: "Oracle" },
              ]}
            />
          </Form.Item>
          <Form.Item name="jdbcUrl" label="JDBC URL" rules={[{ required: true, message: "请输入 JDBC URL" }]}>
            <Input placeholder="jdbc:mysql://localhost:3306/example" />
          </Form.Item>
          <div className="grid grid-two-form">
            <Form.Item name="username" label="用户名" rules={[{ required: true, message: "请输入用户名" }]}>
              <Input autoComplete="off" />
            </Form.Item>
            <Form.Item name="password" label="连接密码" rules={[{ required: true, message: "请输入数据库连接密码" }]}>
              <Input.Password autoComplete="current-password" placeholder="数据库用户密码" />
            </Form.Item>
          </div>
          <ConnectionTestInlineResult result={createConnectionTestResult} />
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑数据源"
        open={editOpen}
        onCancel={() => {
          setEditOpen(false);
          setEditing(null);
          setEditConnectionTestResult(null);
        }}
        footer={
          <Space>
            <Button
              onClick={() => {
                setEditOpen(false);
                setEditing(null);
                setEditConnectionTestResult(null);
              }}
              disabled={updateMutation.isPending || editDraftTestMutation.isPending}
            >
              取消
            </Button>
            <Button
              icon={<ApiOutlined />}
              onClick={testEditConnection}
              loading={editDraftTestMutation.isPending}
              disabled={updateMutation.isPending || editDraftTestMutation.isPending}
            >
              测试连接
            </Button>
            <Button
              type="primary"
              onClick={() => editForm.submit()}
              loading={updateMutation.isPending}
              disabled={updateMutation.isPending || editDraftTestMutation.isPending}
            >
              保存
            </Button>
          </Space>
        }
        destroyOnClose
      >
        <Form<UpdateDataSourcePayload>
          form={editForm}
          layout="vertical"
          onFinish={submitEdit}
          onValuesChange={(changedValues) => {
            if (hasChangedConnectionField(changedValues as Record<string, unknown>)) {
              setEditConnectionTestResult(null);
            }
          }}
        >
          <Alert
            showIcon
            type="info"
            message="留空则保留当前连接密码"
            description="这里填写的是数据库账号的连接密码。编辑名称、用途、URL、用户名或描述时，可以留空，不会覆盖已保存的连接密码；只有需要替换连接凭据时才填写。"
            style={{ marginBottom: 12 }}
          />
          <Form.Item name="name" label="名称" rules={[{ required: true, message: "请输入数据源名称" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="usageRole" label="用途" rules={[{ required: true, message: "请选择数据源用途" }]}>
            <Select
              options={[
                { value: "SOURCE", label: "仅作为源端" },
                { value: "TARGET", label: "仅作为目标端" },
              ]}
            />
          </Form.Item>
          <Form.Item name="jdbcUrl" label="JDBC URL" rules={[{ required: true, message: "请输入 JDBC URL" }]}>
            <Input />
          </Form.Item>
          <div className="grid grid-two-form">
            <Form.Item name="username" label="用户名" rules={[{ required: true, message: "请输入用户名" }]}>
              <Input autoComplete="off" />
            </Form.Item>
            <Form.Item name="password" label="连接密码">
              <Input.Password autoComplete="current-password" placeholder="留空则保留当前连接密码" />
            </Form.Item>
          </div>
          <ConnectionTestInlineResult result={editConnectionTestResult} />
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        width={920}
        title={authorizationTarget ? `数据源授权：${authorizationTarget.name}` : "数据源授权"}
        open={authorizationOpen}
        onCancel={() => setAuthorizationOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Alert
          showIcon
          type="info"
          message="授权只写入数据源实例 ACL，不会修改用户账号或项目成员关系"
          description="被授权用户仍必须先加入该数据源所在项目。VIEW 表示可查看低敏信息，USE 表示可在任务配置/元数据发现中使用，MANAGE 表示可编辑和维护连接配置，但不能删除，也不能自动转授权给其他人。"
          style={{ marginBottom: 12 }}
        />
        <Form<DataSourceAuthorizationFormValues> form={authorizationForm} layout="vertical" onFinish={submitAuthorization}>
          <div className="grid grid-two-form">
            <Form.Item name="subjectType" label="主体类型" rules={[{ required: true, message: "请选择主体类型" }]}>
              <Select
                onChange={(value: "USER" | "ROLE") => {
                  setAuthorizationSubjectType(value);
                  authorizationForm.setFieldsValue({ subjectKey: undefined });
                }}
                options={[
                  { value: "USER", label: "用户" },
                  { value: "ROLE", label: "角色" },
                ]}
              />
            </Form.Item>
            <Form.Item label="搜索候选">
              <Input.Search
                allowClear
                placeholder="搜索用户名、姓名、角色编码"
                onSearch={setAuthorizationKeyword}
                onChange={(event) => {
                  if (!event.target.value) setAuthorizationKeyword("");
                }}
              />
            </Form.Item>
          </div>
          <Form.Item name="subjectKey" label="授权对象" rules={[{ required: true, message: "请选择授权对象" }]}>
            <Select
              showSearch
              loading={authorizationSubjectQuery.isFetching}
              optionFilterProp="label"
              placeholder="选择用户或角色"
              options={subjectCandidates.map((candidate: AuthorizationSubjectCandidate) => ({
                value: `${candidate.subjectType}:${candidate.subjectId}`,
                label: `${candidate.subjectName || candidate.subjectId} · ${candidate.subjectType}${candidate.subjectRole ? ` · ${candidate.subjectRole}` : ""}`,
                disabled: candidate.selectable === false,
              }))}
              onChange={(value) => {
                const candidate = findCandidateByKey(value);
                authorizationForm.setFieldsValue({
                  subjectType: candidate?.subjectType,
                });
              }}
            />
          </Form.Item>
          <Form.Item name="authorizedActions" label="授权动作" rules={[{ required: true, message: "请选择授权动作" }]}>
            <Checkbox.Group
              options={[
                { value: "VIEW", label: "VIEW 查看" },
                { value: "USE", label: "USE 使用" },
                { value: "MANAGE", label: "MANAGE 编辑维护" },
              ]}
            />
          </Form.Item>
          <Form.Item name="grantReason" label="授权原因">
            <Input.TextArea rows={2} placeholder="例如：项目成员需要配置 MySQL -> PostgreSQL 同步任务" />
          </Form.Item>
          <Space style={{ marginBottom: 16 }}>
            <Button type="primary" loading={grantAuthorizationMutation.isPending} onClick={() => authorizationForm.submit()}>
              保存授权
            </Button>
            <Button onClick={() => authorizationQuery.refetch()}>刷新授权清单</Button>
          </Space>
        </Form>
        <Table
          rowKey="id"
          size="small"
          columns={authorizationColumns}
          dataSource={sortByIdDesc(authorizationQuery.data?.data.records)}
          loading={authorizationQuery.isLoading}
          pagination={defaultTablePagination(6)}
        />
      </Modal>

      <Modal
        title="连接测试诊断"
        open={Boolean(connectionTestResult)}
        onCancel={() => setConnectionTestResult(null)}
        footer={<Button type="primary" onClick={() => setConnectionTestResult(null)}>知道了</Button>}
      >
        {connectionTestResult ? (
          <Space direction="vertical" size="middle" style={{ width: "100%" }}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="测试状态">{connectionTestResult.testStatus}</Descriptions.Item>
              <Descriptions.Item label="说明">{connectionTestResult.message || "-"}</Descriptions.Item>
              <Descriptions.Item label="数据库">{[connectionTestResult.productName, connectionTestResult.productVersion].filter(Boolean).join(" ") || "-"}</Descriptions.Item>
              <Descriptions.Item label="JDBC 驱动">{connectionTestResult.driverName || "-"}</Descriptions.Item>
              <Descriptions.Item label="当前 Catalog">{connectionTestResult.currentCatalog || "-"}</Descriptions.Item>
              <Descriptions.Item label="当前 Schema">{connectionTestResult.currentSchema || "-"}</Descriptions.Item>
              <Descriptions.Item label="元数据可发现">
                {connectionTestResult.metadataDiscoverable == null ? (
                  "-"
                ) : (
                  <Tag color={connectionTestResult.metadataDiscoverable ? "green" : "orange"}>
                    {connectionTestResult.metadataDiscoverable ? "可发现" : "未发现用户表"}
                  </Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="发现表数量">{connectionTestResult.discoveredTableCount ?? "-"}</Descriptions.Item>
            </Descriptions>
            {connectionTestResult.warnings?.length ? (
              <Alert
                showIcon
                type="warning"
                message="诊断提示"
                description={
                  <Space direction="vertical" size={4}>
                    {connectionTestResult.warnings.map((warning) => (
                      <Typography.Text key={warning}>{warning}</Typography.Text>
                    ))}
                  </Space>
                }
              />
            ) : null}
          </Space>
        ) : null}
      </Modal>
    </div>
  );
}
