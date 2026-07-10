import {
  AuditOutlined,
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  FileAddOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import {
  Alert,
  App,
  Badge,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useDeferredValue, useMemo, useState } from "react";
import {
  api,
  type ApprovalCenterReviewPayload,
  type ProjectCreationRequestApplyPayload,
  type ProjectJoinRequestApplyPayload,
} from "@/api/endpoints";
import { DataSourceIndicator } from "@/components/DataSourceIndicator";
import { PageHeader } from "@/components/PageHeader";
import { RealEmpty } from "@/components/RealEmpty";
import { useAuthStore } from "@/store/authStore";
import type { ApprovalCenterRecord, GatewaySession } from "@/types/domain";
import { formatDateTime } from "@/utils/format";
import { controlledTablePagination } from "@/utils/table";

const requestTypeLabels: Record<string, string> = {
  PROJECT_CREATION: "创建项目",
  PROJECT_JOIN: "加入项目",
};

const requestTypeColors: Record<string, string> = {
  PROJECT_CREATION: "blue",
  PROJECT_JOIN: "cyan",
};

const statusColors: Record<string, string> = {
  PENDING: "gold",
  APPROVED: "green",
  REJECTED: "red",
  CANCELLED: "default",
};

function normalizeRole(role?: string) {
  return String(role || "").trim().toUpperCase();
}

function isAdministratorReviewer(role?: string) {
  return ["TENANT_ADMINISTRATOR", "PLATFORM_ADMINISTRATOR"].includes(normalizeRole(role));
}

function ownsAnyProject(session?: GatewaySession) {
  return Boolean(session?.authorizedProjects?.some((project) =>
    normalizeRole(project.projectRole ?? project.role) === "OWNER"));
}

function canApplyForProjects(role?: string) {
  return ["ORDINARY_USER", "PROJECT_OWNER", "OPERATOR", "OWNER"].includes(normalizeRole(role));
}

function hasAction(record: ApprovalCenterRecord, action: string) {
  return record.availableActions.some((item) => item.toUpperCase() === action.toUpperCase());
}

export function ApprovalCenter() {
  const { message } = App.useApp();
  const authUser = useAuthStore((state) => state.user);
  const [creationForm] = Form.useForm<ProjectCreationRequestApplyPayload>();
  const [joinForm] = Form.useForm<ProjectJoinRequestApplyPayload>();
  const [selected, setSelected] = useState<ApprovalCenterRecord | null>(null);
  const [myPage, setMyPage] = useState({ current: 1, size: 20 });
  const [pendingPage, setPendingPage] = useState({ current: 1, size: 20 });
  const [myType, setMyType] = useState<string | undefined>();
  const [myStatus, setMyStatus] = useState<string | undefined>();
  const [pendingType, setPendingType] = useState<string | undefined>();
  const [joinProjectKeyword, setJoinProjectKeyword] = useState("");
  const deferredJoinProjectKeyword = useDeferredValue(joinProjectKeyword);

  const sessionQuery = useQuery({
    queryKey: ["approval-center-session"],
    queryFn: api.getSession,
  });
  const session = sessionQuery.data?.data;
  const actorRole = session?.actorRole ?? authUser?.actorRole;
  const administratorReviewer = isAdministratorReviewer(actorRole);
  const projectOwnerReviewer = ownsAnyProject(session);
  const reviewer = administratorReviewer || projectOwnerReviewer;
  const applicant = canApplyForProjects(actorRole);
  const joinCandidateQuery = useQuery({
    queryKey: ["approval-center-project-join-candidates", session?.tenantId, deferredJoinProjectKeyword],
    queryFn: () => api.listProjectJoinCandidates({
      keyword: deferredJoinProjectKeyword || undefined,
      current: 1,
      size: 100,
    }),
    enabled: applicant && Boolean(session?.authenticated),
  });
  const joinProjectOptions = useMemo(() => (
    joinCandidateQuery.data?.data.records ?? []
  ).map((project) => ({
    value: project.projectId,
    label: project.projectCode
      ? `${project.projectName}（${project.projectCode}）`
      : project.projectName,
  })), [joinCandidateQuery.data?.data.records]);

  const myQuery = useQuery({
    queryKey: ["approval-center-my", myPage.current, myPage.size, myType, myStatus],
    queryFn: () => api.listMyApprovalRequests({
      current: myPage.current,
      size: myPage.size,
      requestType: myType,
      status: myStatus,
    }),
  });
  const pendingQuery = useQuery({
    queryKey: ["approval-center-pending", pendingPage.current, pendingPage.size, pendingType],
    queryFn: () => api.listPendingApprovalRequests({
      current: pendingPage.current,
      size: pendingPage.size,
      requestType: administratorReviewer ? pendingType : "PROJECT_JOIN",
      status: "PENDING",
    }),
    enabled: reviewer,
  });

  const applyCreationMutation = useMutation({
    mutationFn: api.applyProjectCreationRequest,
    onSuccess: async () => {
      message.success("项目创建申请已提交");
      creationForm.resetFields();
      await myQuery.refetch();
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "项目创建申请提交失败"),
  });
  const applyJoinMutation = useMutation({
    mutationFn: api.applyProjectJoinRequest,
    onSuccess: async () => {
      message.success("项目加入申请已提交");
      joinForm.resetFields();
      await myQuery.refetch();
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "项目加入申请提交失败"),
  });
  const approveMutation = useMutation({
    mutationFn: ({ record, payload }: { record: ApprovalCenterRecord; payload: ApprovalCenterReviewPayload }) =>
      api.approveApprovalRequest(record.requestType, record.requestId, payload),
    onSuccess: async () => {
      message.success("审批已通过");
      await Promise.all([pendingQuery.refetch(), myQuery.refetch(), sessionQuery.refetch()]);
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "审批通过失败"),
  });
  const rejectMutation = useMutation({
    mutationFn: ({ record, payload }: { record: ApprovalCenterRecord; payload: ApprovalCenterReviewPayload }) =>
      api.rejectApprovalRequest(record.requestType, record.requestId, payload),
    onSuccess: async () => {
      message.success("申请已拒绝");
      await Promise.all([pendingQuery.refetch(), myQuery.refetch()]);
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "拒绝申请失败"),
  });
  const cancelMutation = useMutation({
    mutationFn: (record: ApprovalCenterRecord) => api.cancelApprovalRequest(record.requestType, record.requestId),
    onSuccess: async () => {
      message.success("申请已撤销");
      await myQuery.refetch();
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "撤销申请失败"),
  });

  const submitCreation = (values: ProjectCreationRequestApplyPayload) => {
    applyCreationMutation.mutate({
      ...values,
      applicantName: values.applicantName || authUser?.displayName,
      projectType: values.projectType || "DATA_GOVERNANCE",
    });
  };

  const submitJoin = (values: ProjectJoinRequestApplyPayload) => {
    applyJoinMutation.mutate({
      ...values,
      projectId: Number(values.projectId),
      applicantName: values.applicantName || authUser?.displayName,
      requestedProjectRole: values.requestedProjectRole || "READER",
    });
  };

  const baseColumns = useMemo<ColumnsType<ApprovalCenterRecord>>(() => [
    {
      title: "申请 ID",
      dataIndex: "requestId",
      width: 100,
      render: (value) => <Typography.Text className="mono">{value}</Typography.Text>,
    },
    {
      title: "申请类型",
      dataIndex: "requestType",
      width: 120,
      render: (value) => <Tag color={requestTypeColors[value] || "default"}>{requestTypeLabels[value] || value}</Tag>,
    },
    {
      title: "项目",
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.projectName || (record.projectId ? "未找到项目名称" : "待创建")}</Typography.Text>
          <Typography.Text type="secondary" className="mono">
            {record.projectCode || (record.projectId ? `ID ${record.projectId}` : "-")}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: "申请人",
      dataIndex: "applicantUsername",
      render: (value, record) => value || record.applicantName || "用户已删除或未同步",
    },
    {
      title: "申请角色",
      dataIndex: "requestedProjectRole",
      width: 100,
      render: (value) => value ? <Tag>{value}</Tag> : "-",
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (value) => <Tag color={statusColors[value] || "default"}>{value}</Tag>,
    },
    {
      title: "更新时间",
      dataIndex: "updateTime",
      width: 170,
      render: (value) => formatDateTime(value),
    },
    {
      title: "详情",
      width: 80,
      render: (_, record) => <Button icon={<EyeOutlined />} onClick={() => setSelected(record)} />,
    },
  ], []);

  const myColumns: ColumnsType<ApprovalCenterRecord> = [
    ...baseColumns,
    {
      title: "操作",
      width: 100,
      render: (_, record) => (
        <Button
          danger
          size="small"
          disabled={!hasAction(record, "CANCEL")}
          loading={cancelMutation.isPending}
          onClick={() => cancelMutation.mutate(record)}
        >
          撤销
        </Button>
      ),
    },
  ];

  const pendingColumns: ColumnsType<ApprovalCenterRecord> = [
    ...baseColumns,
    {
      title: "审批操作",
      width: 220,
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            disabled={!hasAction(record, "APPROVE")}
            loading={approveMutation.isPending}
            onClick={() => approveMutation.mutate({
              record,
              payload: {
                approvedProjectRole: record.requestType === "PROJECT_JOIN" ? record.requestedProjectRole : undefined,
                reviewComment: "审批通过",
              },
            })}
          >
            通过
          </Button>
          <Button
            danger
            size="small"
            icon={<CloseOutlined />}
            disabled={!hasAction(record, "REJECT")}
            loading={rejectMutation.isPending}
            onClick={() => rejectMutation.mutate({ record, payload: { reviewComment: "审批拒绝" } })}
          >
            拒绝
          </Button>
        </Space>
      ),
    },
  ];

  const filterBar = (
    type: string | undefined,
    setType: (value: string | undefined) => void,
    status?: string,
    setStatus?: (value: string | undefined) => void,
    allowedTypes: string[] = Object.keys(requestTypeLabels),
  ) => (
    <Space wrap style={{ marginBottom: 12 }}>
      <Select
        allowClear
        placeholder="全部申请类型"
        value={type}
        onChange={setType}
        style={{ width: 160 }}
        options={allowedTypes.map((value) => ({ value, label: requestTypeLabels[value] || value }))}
      />
      {setStatus ? (
        <Select
          allowClear
          placeholder="全部状态"
          value={status}
          onChange={setStatus}
          style={{ width: 140 }}
          options={["PENDING", "APPROVED", "REJECTED", "CANCELLED"].map((value) => ({ value, label: value }))}
        />
      ) : null}
    </Space>
  );

  return (
    <div className="page-stack">
      <PageHeader
        title="申请与审批"
        subtitle="统一查看项目创建、项目加入申请；项目 OWNER 审批本项目加入，租户/平台管理员按管理范围处理待办"
        actions={<DataSourceIndicator meta={myQuery.data?.meta ?? pendingQuery.data?.meta} />}
      />

      {applicant ? (
        <div className="grid grid-two">
          <Card title={<Space><FileAddOutlined />申请创建项目</Space>}>
            <Form<ProjectCreationRequestApplyPayload> form={creationForm} layout="vertical" onFinish={submitCreation}>
              <Form.Item name="projectName" label="项目名称" rules={[{ required: true, message: "请输入项目名称" }]}>
                <Input placeholder="例如：客户数据同步项目" />
              </Form.Item>
              <Form.Item name="projectCode" label="项目编码">
                <Input placeholder="例如：CUSTOMER_SYNC" />
              </Form.Item>
              <Form.Item name="description" label="项目描述">
                <Input.TextArea rows={2} placeholder="说明业务目标和数据范围，不要填写密码、Token 或连接串" />
              </Form.Item>
              <Form.Item name="requestReason" label="申请原因">
                <Input.TextArea rows={2} placeholder="审批通过后，申请人将成为项目 OWNER" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={applyCreationMutation.isPending}>提交创建申请</Button>
            </Form>
          </Card>

          <Card title={<Space><UserAddOutlined />申请加入项目</Space>}>
            <Form<ProjectJoinRequestApplyPayload> form={joinForm} layout="vertical" onFinish={submitJoin} initialValues={{ requestedProjectRole: "READER" }}>
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
              <Form.Item name="requestedProjectRole" label="申请项目角色" rules={[{ required: true }]}>
                <Select options={[
                  { value: "READER", label: "READER 只读" },
                  { value: "MANAGER", label: "MANAGER 管理" },
                ]} />
              </Form.Item>
              <Form.Item name="requestReason" label="申请原因">
                <Input.TextArea rows={2} placeholder="说明需要访问该项目中的哪些数据源或同步任务" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={applyJoinMutation.isPending}>提交加入申请</Button>
            </Form>
          </Card>
        </div>
      ) : null}

      <Tabs
        items={[
          {
            key: "my",
            label: "我的申请",
            children: (
              <Card className="table-card">
                {filterBar(myType, (value) => { setMyType(value); setMyPage((page) => ({ ...page, current: 1 })); }, myStatus,
                  (value) => { setMyStatus(value); setMyPage((page) => ({ ...page, current: 1 })); })}
                <Table
                  rowKey={(record) => `${record.requestType}:${record.requestId}`}
                  columns={myColumns}
                  dataSource={myQuery.data?.data.records ?? []}
                  loading={myQuery.isLoading}
                  locale={{ emptyText: <RealEmpty meta={myQuery.data?.meta} description="暂无本人申请记录" /> }}
                  pagination={controlledTablePagination({
                    current: myPage.current,
                    pageSize: myPage.size,
                    total: myQuery.data?.data.total,
                    onChange: (current, size) => setMyPage({ current, size }),
                  })}
                />
              </Card>
            ),
          },
          ...(reviewer ? [{
            key: "pending",
            label: <Space>待办审批<Badge count={pendingQuery.data?.data.total ?? 0} /></Space>,
            children: (
              <Card className="table-card">
                {filterBar(
                  administratorReviewer ? pendingType : "PROJECT_JOIN",
                  (value) => { setPendingType(value); setPendingPage((page) => ({ ...page, current: 1 })); },
                  undefined,
                  undefined,
                  administratorReviewer ? Object.keys(requestTypeLabels) : ["PROJECT_JOIN"],
                )}
                <Table
                  rowKey={(record: ApprovalCenterRecord) => `${record.requestType}:${record.requestId}`}
                  columns={pendingColumns}
                  dataSource={pendingQuery.data?.data.records ?? []}
                  loading={pendingQuery.isLoading}
                  locale={{ emptyText: <RealEmpty meta={pendingQuery.data?.meta} description="暂无待办审批" /> }}
                  pagination={controlledTablePagination({
                    current: pendingPage.current,
                    pageSize: pendingPage.size,
                    total: pendingQuery.data?.data.total,
                    onChange: (current, size) => setPendingPage({ current, size }),
                  })}
                />
              </Card>
            ),
          }] : []),
        ]}
      />

      {!reviewer ? (
        <Alert
          showIcon
          type="info"
          message="当前账号仅显示本人申请进度"
          description="拥有项目 OWNER 成员关系后可审批本人负责项目的加入申请；租户管理员处理本租户加入与创建申请，平台管理员处理全平台待办。"
        />
      ) : null}

      <Drawer title="申请详情" width={560} open={Boolean(selected)} onClose={() => setSelected(null)}>
        {selected ? (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="申请类型">{requestTypeLabels[selected.requestType] || selected.requestType}</Descriptions.Item>
            <Descriptions.Item label="申请 ID">{selected.requestId}</Descriptions.Item>
            <Descriptions.Item label="租户 ID">{selected.tenantId ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="项目">{selected.projectName || (selected.projectId ? "未找到项目名称" : "待创建")}</Descriptions.Item>
            <Descriptions.Item label="项目编码">{selected.projectCode || "-"}</Descriptions.Item>
            <Descriptions.Item label="申请人">{selected.applicantUsername || selected.applicantName || "用户已删除或未同步"}</Descriptions.Item>
            {selected.requestType === "PROJECT_CREATION" ? (
              <Descriptions.Item label="负责人">{selected.ownerUsername || "用户已删除或未同步"}</Descriptions.Item>
            ) : null}
            <Descriptions.Item label="申请角色">{selected.requestedProjectRole || "-"}</Descriptions.Item>
            <Descriptions.Item label="申请原因">{selected.requestReason || "未填写"}</Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={statusColors[selected.status]}>{selected.status}</Tag></Descriptions.Item>
            <Descriptions.Item label="审批人">{selected.reviewerUsername || (selected.reviewerActorId ? "用户已删除或未同步" : "待审批")}</Descriptions.Item>
            <Descriptions.Item label="审批意见">{selected.reviewComment || "-"}</Descriptions.Item>
            <Descriptions.Item label="申请时间">{formatDateTime(selected.createTime)}</Descriptions.Item>
            <Descriptions.Item label="审批时间">{formatDateTime(selected.reviewTime)}</Descriptions.Item>
            <Descriptions.Item label="结果资源 ID">{selected.resultResourceId ?? "-"}</Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>
    </div>
  );
}
