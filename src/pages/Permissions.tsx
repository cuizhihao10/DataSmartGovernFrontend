import {
  AuditOutlined,
  CheckOutlined,
  CloseOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import { Alert, App, Button, Card, Form, Input, Select, Space, Table, Tabs, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  api,
  type ProjectCreationRequestApplyPayload,
  type ProjectCreationRequestReviewPayload,
  type ProjectCreatePayload,
  type ProjectJoinRequestApplyPayload,
  type ProjectJoinRequestReviewPayload,
} from "@/api/endpoints";
import { DataSourceIndicator } from "@/components/DataSourceIndicator";
import { RealEmpty } from "@/components/RealEmpty";
import { BooleanTag } from "@/components/StatusTag";
import { PageHeader } from "@/components/PageHeader";
import { useUiStore } from "@/store/uiStore";
import type {
  PermissionRole,
  ProjectCreationRequestRecord,
  ProjectJoinRequestRecord,
  ProjectRecord,
  RoutePolicy,
} from "@/types/domain";
import { formatDateTime } from "@/utils/format";
import { labelOf, scopeLabels } from "@/utils/labels";
import { defaultTablePagination, sortByIdDesc } from "@/utils/table";

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
  PROJECT_JOIN_REQUEST: "项目加入申请",
  PROJECT_CREATION_REQUEST: "项目创建申请",
};

const actionLabels: Record<string, string> = {
  VIEW: "查看",
  CREATE: "创建",
  UPDATE: "修改",
  DELETE: "删除",
  EXECUTE: "执行",
  APPROVE: "审批",
  APPLY: "申请",
  REVIEW: "审核",
  VIEW_EVENTS: "查看事件",
};

const joinStatusColor: Record<string, string> = {
  PENDING: "gold",
  APPROVED: "green",
  REJECTED: "red",
  CANCELLED: "default",
};

function normalizeRole(value?: string) {
  return String(value || "").trim().toUpperCase();
}

function canReviewProjectJoinRequests(actorRole?: string) {
  return ["PROJECT_OWNER", "TENANT_ADMINISTRATOR", "PLATFORM_ADMINISTRATOR", "OWNER"].includes(normalizeRole(actorRole));
}

function canDirectCreateProject(actorRole?: string) {
  return ["TENANT_ADMINISTRATOR", "PLATFORM_ADMINISTRATOR"].includes(normalizeRole(actorRole));
}

function canApplyProjectCreation(actorRole?: string) {
  return ["ORDINARY_USER", "PROJECT_OWNER", "OPERATOR", "OWNER"].includes(normalizeRole(actorRole));
}

function canApplyProjectJoin(actorRole?: string) {
  return ["ORDINARY_USER", "PROJECT_OWNER", "OPERATOR", "OWNER"].includes(normalizeRole(actorRole));
}

function canUseProjectCreationEntry(actorRole?: string) {
  return canDirectCreateProject(actorRole) || canApplyProjectCreation(actorRole);
}

function canReviewProjectCreationRequests(actorRole?: string) {
  return ["TENANT_ADMINISTRATOR", "PLATFORM_ADMINISTRATOR"].includes(normalizeRole(actorRole));
}

type ProjectFormPayload = ProjectCreatePayload & ProjectCreationRequestApplyPayload;

export function Permissions() {
  const { message } = App.useApp();
  const [keyword, setKeyword] = useState("");
  const [projectForm] = Form.useForm<ProjectFormPayload>();
  const [joinForm] = Form.useForm<ProjectJoinRequestApplyPayload>();
  const [reviewForm] = Form.useForm<ProjectJoinRequestReviewPayload>();
  const selectedProjectId = useUiStore((state) => state.selectedProjectId);
  const setSelectedProjectId = useUiStore((state) => state.setSelectedProjectId);
  const projectOptions = useUiStore((state) => state.projectOptions);
  const setProjectOptions = useUiStore((state) => state.setProjectOptions);
  const [joinProjectKeyword, setJoinProjectKeyword] = useState("");
  const deferredJoinProjectKeyword = useDeferredValue(joinProjectKeyword);

  const sessionQuery = useQuery({
    queryKey: ["permission-gateway-session"],
    queryFn: api.getSession,
  });
  const session = sessionQuery.data?.data;
  const actorRole = session?.actorRole;
  const administratorScope = ["TENANT_ADMINISTRATOR", "PLATFORM_ADMINISTRATOR"].includes(normalizeRole(actorRole));
  const selectedProjectNumber = Number(selectedProjectId ?? session?.authorizedProjectIds?.[0]);
  const currentProjectId = Number.isFinite(selectedProjectNumber) ? selectedProjectNumber : undefined;
  const currentProjectLabel = useMemo(() => {
    const project = projectOptions.find((item) => item.value === String(currentProjectId));
    return project?.label ?? (currentProjectId == null ? "未选择项目" : "未找到项目名称");
  }, [currentProjectId, projectOptions]);

  const roleQuery = useQuery({
    queryKey: ["permission-roles"],
    queryFn: api.listRoles,
  });
  const routePolicyQuery = useQuery({
    queryKey: ["permission-route-policies"],
    queryFn: api.listRoutePolicies,
  });
  const projectQuery = useQuery({
    queryKey: ["permission-projects", session?.tenantId, actorRole],
    queryFn: () => api.listProjects({ current: 1, size: 100, onlyMine: !administratorScope }),
  });
  const joinCandidateQuery = useQuery({
    queryKey: ["permission-project-join-candidates", session?.tenantId, deferredJoinProjectKeyword],
    queryFn: () => api.listProjectJoinCandidates({
      keyword: deferredJoinProjectKeyword || undefined,
      current: 1,
      size: 100,
    }),
    enabled: canApplyProjectJoin(actorRole) && Boolean(session?.authenticated),
  });
  const joinProjectOptions = useMemo(() => (
    joinCandidateQuery.data?.data.records ?? []
  ).map((project) => ({
    value: project.projectId,
    label: project.projectCode
      ? `${project.projectName}（${project.projectCode}）`
      : project.projectName,
  })), [joinCandidateQuery.data?.data.records]);
  const myJoinQuery = useQuery({
    queryKey: ["permission-project-join-my", currentProjectId],
    queryFn: () => api.listMyProjectJoinRequests({ projectId: currentProjectId, size: 100 }),
    enabled: canApplyProjectJoin(actorRole),
  });
  const approvalQuery = useQuery({
    queryKey: ["permission-project-join-approvals", currentProjectId],
    queryFn: () => api.listProjectJoinApprovals({ projectId: currentProjectId, status: "PENDING", size: 100 }),
    enabled: canReviewProjectJoinRequests(actorRole),
  });
  const myCreationQuery = useQuery({
    queryKey: ["permission-project-creation-my"],
    queryFn: () => api.listMyProjectCreationRequests({ size: 100 }),
    enabled: canApplyProjectCreation(actorRole),
  });
  const creationApprovalQuery = useQuery({
    queryKey: ["permission-project-creation-approvals"],
    queryFn: () => api.listProjectCreationApprovals({ status: "PENDING", size: 100 }),
    enabled: canReviewProjectCreationRequests(actorRole),
  });

  useEffect(() => {
    const projects = projectQuery.data?.data.records ?? [];
    if (!projects.length) {
      return;
    }
    setProjectOptions(projects.map((project) => ({
      value: String(project.projectId),
      label: project.projectName,
    })));
  }, [projectQuery.data?.data.records, setProjectOptions]);

  useEffect(() => {
    joinForm.setFieldsValue({ requestedProjectRole: "READER" });
  }, [joinForm]);

  const createProjectMutation = useMutation({
    mutationFn: api.createProject,
    onSuccess: async (result) => {
      message.success(result.data.projectName ? `项目已创建：${result.data.projectName}` : "项目已创建");
      if (result.data.projectId) {
        setSelectedProjectId(String(result.data.projectId));
      }
      projectForm.resetFields();
      await projectQuery.refetch();
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "项目创建失败"),
  });

  const applyCreationMutation = useMutation({
    mutationFn: api.applyProjectCreationRequest,
    onSuccess: async () => {
      message.success("项目创建申请已提交，等待管理员审批");
      projectForm.resetFields();
      await myCreationQuery.refetch();
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "项目创建申请提交失败"),
  });

  const approveCreationMutation = useMutation({
    mutationFn: ({ requestId, payload }: { requestId: number; payload: ProjectCreationRequestReviewPayload }) =>
      api.approveProjectCreationRequest(requestId, payload),
    onSuccess: async () => {
      message.success("项目创建申请已审批通过，项目已创建");
      await Promise.all([creationApprovalQuery.refetch(), projectQuery.refetch(), sessionQuery.refetch()]);
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "项目创建审批通过失败"),
  });

  const rejectCreationMutation = useMutation({
    mutationFn: ({ requestId, payload }: { requestId: number; payload: ProjectCreationRequestReviewPayload }) =>
      api.rejectProjectCreationRequest(requestId, payload),
    onSuccess: async () => {
      message.success("项目创建申请已拒绝");
      await creationApprovalQuery.refetch();
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "项目创建申请拒绝失败"),
  });

  const cancelCreationMutation = useMutation({
    mutationFn: api.cancelProjectCreationRequest,
    onSuccess: async () => {
      message.success("项目创建申请已撤销");
      await myCreationQuery.refetch();
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "项目创建申请撤销失败"),
  });

  const applyJoinMutation = useMutation({
    mutationFn: api.applyProjectJoinRequest,
    onSuccess: async () => {
      message.success("项目加入申请已提交");
      joinForm.setFieldsValue({ requestReason: undefined, requestedProjectRole: "READER" });
      await myJoinQuery.refetch();
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "项目加入申请提交失败"),
  });

  const approveMutation = useMutation({
    mutationFn: ({ requestId, payload }: { requestId: number; payload: ProjectJoinRequestReviewPayload }) =>
      api.approveProjectJoinRequest(requestId, payload),
    onSuccess: async () => {
      message.success("已审批通过并授予项目角色");
      reviewForm.resetFields();
      await Promise.all([approvalQuery.refetch(), myJoinQuery.refetch(), sessionQuery.refetch()]);
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "审批通过失败"),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ requestId, payload }: { requestId: number; payload: ProjectJoinRequestReviewPayload }) =>
      api.rejectProjectJoinRequest(requestId, payload),
    onSuccess: async () => {
      message.success("已拒绝申请");
      reviewForm.resetFields();
      await approvalQuery.refetch();
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "拒绝申请失败"),
  });

  const cancelMutation = useMutation({
    mutationFn: api.cancelProjectJoinRequest,
    onSuccess: async () => {
      message.success("已撤销申请");
      await myJoinQuery.refetch();
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "撤销申请失败"),
  });

  const roles = roleQuery.data?.data ?? [];
  const routePolicies = routePolicyQuery.data?.data ?? [];
  const projects = projectQuery.data?.data.records ?? [];
  const myCreationRequests = myCreationQuery.data?.data.records ?? [];
  const creationApprovalRequests = creationApprovalQuery.data?.data.records ?? [];
  const myRequests = myJoinQuery.data?.data.records ?? [];
  const approvalRequests = approvalQuery.data?.data.records ?? [];

  const filteredRoles = roles.filter((role) =>
    [role.name, role.code, role.scope].join(" ").toLowerCase().includes(keyword.toLowerCase()),
  );
  const filteredPolicies = routePolicies.filter((policy) =>
    [policy.pathPattern, policy.resourceType, policy.defaultAction]
      .join(" ")
      .toLowerCase()
      .includes(keyword.toLowerCase()),
  );

  const submitCreateProject = (values: ProjectFormPayload) => {
    const payload = {
      ...values,
      projectType: values.projectType || "DATA_GOVERNANCE",
    };
    if (canDirectCreateProject(actorRole)) {
      createProjectMutation.mutate({
        ...payload,
        reason: values.reason || "前端项目管理页创建",
      });
      return;
    }
    if (canApplyProjectCreation(actorRole)) {
      applyCreationMutation.mutate({
        ...payload,
        requestReason: values.requestReason || values.reason || "申请创建项目",
      });
      return;
    }
    message.error("当前角色没有项目创建或申请权限");
  };

  const submitJoinRequest = (values: ProjectJoinRequestApplyPayload) => {
    const projectId = Number(values.projectId ?? currentProjectId);
    if (!Number.isFinite(projectId)) {
      message.error("请先选择要加入的项目");
      return;
    }
    applyJoinMutation.mutate({
      ...values,
      projectId,
      requestedProjectRole: values.requestedProjectRole || "READER",
    });
  };

  const roleColumns: ColumnsType<PermissionRole> = [
    {
      title: "ID",
      dataIndex: "id",
      width: 120,
      render: (value) => <Typography.Text className="mono">{value}</Typography.Text>,
    },
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
    {
      title: "ID",
      dataIndex: "id",
      width: 120,
      render: (value) => <Typography.Text className="mono">{value}</Typography.Text>,
    },
    { title: "路径", dataIndex: "pathPattern", render: (value) => <span className="mono">{value}</span> },
    { title: "资源", dataIndex: "resourceType", render: (value) => <Tag>{labelOf(value, resourceTypeLabels)}</Tag> },
    { title: "动作", dataIndex: "defaultAction", render: (value) => <Tag color="blue">{labelOf(value, actionLabels)}</Tag> },
    { title: "状态", dataIndex: "enabled", render: (value) => <BooleanTag value={value} /> },
  ];

  const projectColumns: ColumnsType<ProjectRecord> = [
    { title: "项目 ID", dataIndex: "projectId", width: 100, render: (value) => <Typography.Text className="mono">{value}</Typography.Text> },
    { title: "项目名称", dataIndex: "projectName", render: (value, record) => (
      <Space direction="vertical" size={0}>
        <Typography.Text strong>{value}</Typography.Text>
        <Typography.Text type="secondary" className="mono">{record.projectCode || "-"}</Typography.Text>
      </Space>
    ) },
    { title: "租户", dataIndex: "tenantId", width: 90 },
    { title: "类型", dataIndex: "projectType", render: (value) => <Tag>{value || "DATA_GOVERNANCE"}</Tag> },
    { title: "状态", dataIndex: "status", render: (value) => <Tag color={value === "ACTIVE" ? "green" : "default"}>{value || "-"}</Tag> },
    { title: "负责人", dataIndex: "ownerUsername", render: (value) => value || "用户已删除或未同步" },
    { title: "更新时间", dataIndex: "updateTime", render: (value) => formatDateTime(value) },
  ];

  const joinColumns: ColumnsType<ProjectJoinRequestRecord> = [
    { title: "申请 ID", dataIndex: "id", width: 100, render: (value) => <Typography.Text className="mono">{value}</Typography.Text> },
    {
      title: "项目",
      dataIndex: "projectName",
      render: (value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{value || "未找到项目名称"}</Typography.Text>
          <Typography.Text type="secondary" className="mono">
            {record.projectCode || `ID ${record.projectId}`}
          </Typography.Text>
        </Space>
      ),
    },
    { title: "申请人", dataIndex: "applicantUsername", render: (value, record) => value || record.applicantName || "用户已删除或未同步" },
    { title: "申请角色", dataIndex: "requestedProjectRole", render: (value) => <Tag color={value === "MANAGER" ? "blue" : "default"}>{value}</Tag> },
    { title: "状态", dataIndex: "status", render: (value) => <Tag color={joinStatusColor[value] || "default"}>{value}</Tag> },
    { title: "审批人", dataIndex: "reviewerUsername", render: (value, record) => value || (record.reviewerActorId ? "用户已删除或未同步" : "待审批") },
    { title: "更新时间", dataIndex: "updateTime", render: (value) => formatDateTime(value) },
    {
      title: "操作",
      width: 110,
      render: (_, record) => (
        <Button
          size="small"
          danger
          disabled={record.status !== "PENDING"}
          loading={cancelMutation.isPending}
          onClick={() => cancelMutation.mutate(record.id)}
        >
          撤销
        </Button>
      ),
    },
  ];

  const approvalColumns: ColumnsType<ProjectJoinRequestRecord> = [
    ...joinColumns.filter((column) => column.title !== "操作"),
    {
      title: "审批操作",
      width: 220,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            type="primary"
            icon={<CheckOutlined />}
            loading={approveMutation.isPending}
            onClick={() => approveMutation.mutate({
              requestId: record.id,
              payload: { approvedProjectRole: record.requestedProjectRole, reviewComment: "同意加入项目" },
            })}
          >
            通过
          </Button>
          <Button
            size="small"
            danger
            icon={<CloseOutlined />}
            loading={rejectMutation.isPending}
            onClick={() => rejectMutation.mutate({
              requestId: record.id,
              payload: { reviewComment: "暂不满足项目加入条件" },
            })}
          >
            拒绝
          </Button>
        </Space>
      ),
    },
  ];

  const creationColumns: ColumnsType<ProjectCreationRequestRecord> = [
    { title: "申请 ID", dataIndex: "id", width: 100, render: (value) => <Typography.Text className="mono">{value}</Typography.Text> },
    {
      title: "项目",
      dataIndex: "projectName",
      render: (value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{value}</Typography.Text>
          <Typography.Text type="secondary" className="mono">{record.projectCode || "-"}</Typography.Text>
        </Space>
      ),
    },
    { title: "申请人", dataIndex: "applicantUsername", render: (value, record) => value || record.applicantName || "用户已删除或未同步" },
    { title: "负责人", dataIndex: "ownerUsername", render: (value) => value || "用户已删除或未同步" },
    { title: "状态", dataIndex: "status", render: (value) => <Tag color={joinStatusColor[value] || "default"}>{value}</Tag> },
    { title: "创建项目", dataIndex: "createdProjectId", render: (value) => value == null ? "-" : <Typography.Text className="mono">{value}</Typography.Text> },
    { title: "更新时间", dataIndex: "updateTime", render: (value) => formatDateTime(value) },
    {
      title: "操作",
      width: 110,
      render: (_, record) => (
        <Button
          size="small"
          danger
          disabled={record.status !== "PENDING"}
          loading={cancelCreationMutation.isPending}
          onClick={() => cancelCreationMutation.mutate(record.id)}
        >
          撤销
        </Button>
      ),
    },
  ];

  const creationApprovalColumns: ColumnsType<ProjectCreationRequestRecord> = [
    ...creationColumns.filter((column) => column.title !== "操作"),
    {
      title: "审批操作",
      width: 220,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            type="primary"
            icon={<CheckOutlined />}
            loading={approveCreationMutation.isPending}
            onClick={() => approveCreationMutation.mutate({
              requestId: record.id,
              payload: { reviewComment: "同意创建项目" },
            })}
          >
            通过并创建
          </Button>
          <Button
            size="small"
            danger
            icon={<CloseOutlined />}
            loading={rejectCreationMutation.isPending}
            onClick={() => rejectCreationMutation.mutate({
              requestId: record.id,
              payload: { reviewComment: "暂不满足项目创建条件" },
            })}
          >
            拒绝
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="权限"
        subtitle="角色、项目、项目加入审批、菜单、路由策略、数据范围和智能体工具准入"
        actions={
          <>
            <DataSourceIndicator meta={roleQuery.data?.meta ?? routePolicyQuery.data?.meta ?? projectQuery.data?.meta} />
            <Button type="primary" icon={<SafetyCertificateOutlined />} disabled>
              策略编辑由后端权限中心控制
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
          <Tag color="blue">当前项目：{currentProjectLabel}</Tag>
        </div>
      </Card>

      <Tabs
        items={[
          {
            key: "projects",
            label: "项目管理",
            children: (
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                <Card className="compact-card" title={canDirectCreateProject(actorRole) ? "创建项目" : "申请创建项目"}>
                  {!canUseProjectCreationEntry(actorRole) ? (
                    <Alert
                      showIcon
                      type="info"
                      message="当前角色没有项目创建入口"
                      description="项目创建由后端权限策略最终判定。普通用户可以申请创建项目或申请加入已有项目，直接调接口也会由后端再次校验。"
                      style={{ marginBottom: 12 }}
                    />
                  ) : null}
                  <Form<ProjectFormPayload> form={projectForm} layout="vertical" onFinish={submitCreateProject} disabled={!canUseProjectCreationEntry(actorRole)}>
                    <div className="grid grid-two-form">
                      <Form.Item name="projectName" label="项目名称" rules={[{ required: true, message: "请输入项目名称" }]}>
                        <Input placeholder="客户同步项目 / 财务数据迁移项目" />
                      </Form.Item>
                      <Form.Item name="projectCode" label="项目编码">
                        <Input placeholder="CUSTOMER_SYNC" />
                      </Form.Item>
                    </div>
                    <Form.Item name="description" label="项目描述">
                      <Input.TextArea rows={2} placeholder="说明业务域、维护人、数据同步目标，禁止填写密码、Token、连接串等敏感信息" />
                    </Form.Item>
                    {!canDirectCreateProject(actorRole) ? (
                      <Form.Item name="requestReason" label="申请原因">
                        <Input.TextArea rows={2} placeholder="说明为什么需要创建该项目，审批通过后你会成为项目 OWNER" />
                      </Form.Item>
                    ) : null}
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      htmlType="submit"
                      loading={createProjectMutation.isPending || applyCreationMutation.isPending}
                    >
                      {canDirectCreateProject(actorRole) ? "创建项目" : "提交创建申请"}
                    </Button>
                  </Form>
                </Card>
                {canApplyProjectCreation(actorRole) ? (
                  <Card className="table-card" title="我的创建申请">
                    <Table
                      rowKey="id"
                      columns={creationColumns}
                      dataSource={sortByIdDesc(myCreationRequests)}
                      loading={myCreationQuery.isLoading}
                      locale={{ emptyText: <RealEmpty meta={myCreationQuery.data?.meta} description="暂无项目创建申请" /> }}
                      pagination={defaultTablePagination(10)}
                    />
                  </Card>
                ) : null}
                <Card className="table-card" title="可见项目">
                  <Table
                    rowKey="projectId"
                    columns={projectColumns}
                    dataSource={sortByIdDesc(projects)}
                    loading={projectQuery.isLoading}
                    locale={{ emptyText: <RealEmpty meta={projectQuery.data?.meta} description="暂无项目记录" /> }}
                    pagination={defaultTablePagination(10)}
                  />
                </Card>
              </Space>
            ),
          },
          {
            key: "join",
            label: "加入申请",
            children: (
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                {canApplyProjectJoin(actorRole) ? (
                  <>
                    <Card className="compact-card" title="申请加入项目">
                      <Alert
                        showIcon
                        type="info"
                        message="申请不会直接产生项目数据范围"
                        description="候选目录开放本租户全部启用项目；审批通过后才会写入项目成员关系并获得访问权限。"
                        style={{ marginBottom: 12 }}
                      />
                      <Form<ProjectJoinRequestApplyPayload> form={joinForm} layout="vertical" onFinish={submitJoinRequest}>
                        <div className="grid grid-two-form">
                          <Form.Item name="projectId" label="目标项目" rules={[{ required: true, message: "请选择目标项目" }]}>
                            <Select
                              showSearch
                              filterOption={false}
                              options={joinProjectOptions}
                              loading={joinCandidateQuery.isLoading || joinCandidateQuery.isFetching}
                              onSearch={setJoinProjectKeyword}
                              placeholder="按项目名称或编码搜索"
                              notFoundContent="本租户暂无可申请加入的启用项目"
                            />
                          </Form.Item>
                          <Form.Item name="requestedProjectRole" label="申请角色" rules={[{ required: true, message: "请选择申请角色" }]}>
                            <Select options={[
                              { value: "READER", label: "READER 只读" },
                              { value: "MANAGER", label: "MANAGER 管理" },
                            ]} />
                          </Form.Item>
                        </div>
                        <Form.Item name="requestReason" label="申请原因">
                          <Input.TextArea rows={2} placeholder="说明为什么需要加入该项目，例如需要使用某条被授权的数据源创建同步任务" />
                        </Form.Item>
                        <Button type="primary" icon={<UserAddOutlined />} htmlType="submit" loading={applyJoinMutation.isPending}>
                          提交加入申请
                        </Button>
                      </Form>
                    </Card>
                    <Card className="table-card" title="我的申请">
                      <Table
                        rowKey="id"
                        columns={joinColumns}
                        dataSource={sortByIdDesc(myRequests)}
                        loading={myJoinQuery.isLoading}
                        locale={{ emptyText: <RealEmpty meta={myJoinQuery.data?.meta} description="暂无项目加入申请" /> }}
                        pagination={defaultTablePagination(10)}
                      />
                    </Card>
                  </>
                ) : (
                  <Alert
                    showIcon
                    type="success"
                    message={normalizeRole(actorRole) === "PLATFORM_ADMINISTRATOR" ? "平台管理员天然拥有全平台项目权限" : "租户管理员天然拥有本租户全部项目权限"}
                    description="管理员不需要通过项目成员申请扩权。请直接使用顶部项目切换器进入管理范围内的项目；加入申请仅面向普通项目成员。"
                  />
                )}
              </Space>
            ),
          },
          {
            key: "approvals",
            label: "加入审批",
            children: (
              <Card className="table-card">
                {!canReviewProjectJoinRequests(actorRole) ? (
                  <Alert
                    showIcon
                    type="info"
                    message="当前账号不是项目 Owner / 租户管理员 / 平台管理员"
                    description="前端隐藏审批能力只是体验优化；直接调接口仍会由后端按租户和项目边界拒绝越权审批。"
                    style={{ marginBottom: 12 }}
                  />
                ) : null}
                <Table
                  rowKey="id"
                  columns={approvalColumns}
                  dataSource={sortByIdDesc(approvalRequests)}
                  loading={approvalQuery.isLoading}
                  locale={{ emptyText: <RealEmpty meta={approvalQuery.data?.meta} description="暂无待审批项目加入申请" /> }}
                  pagination={defaultTablePagination(10)}
                />
              </Card>
            ),
          },
          {
            key: "creation-approvals",
            label: "创建审批",
            children: (
              <Card className="table-card">
                {!canReviewProjectCreationRequests(actorRole) ? (
                  <Alert
                    showIcon
                    type="info"
                    message="当前账号不是租户管理员 / 平台管理员"
                    description="项目创建会新开项目隔离单元并授予申请人 OWNER，因此必须由租户或平台管理员审批；后端会重复校验，前端按钮隐藏不能绕过权限。"
                    style={{ marginBottom: 12 }}
                  />
                ) : null}
                <Table
                  rowKey="id"
                  columns={creationApprovalColumns}
                  dataSource={sortByIdDesc(creationApprovalRequests)}
                  loading={creationApprovalQuery.isLoading}
                  locale={{ emptyText: <RealEmpty meta={creationApprovalQuery.data?.meta} description="暂无待审批项目创建申请" /> }}
                  pagination={defaultTablePagination(10)}
                />
              </Card>
            ),
          },
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
                  pagination={defaultTablePagination(8)}
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
                  pagination={defaultTablePagination(8)}
                />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
