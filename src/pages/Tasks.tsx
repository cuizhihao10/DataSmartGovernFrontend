import {
  PauseCircleOutlined,
  PlayCircleOutlined,
  RedoOutlined,
  SearchOutlined,
  StopOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { App, Button, Card, Form, Input, InputNumber, Modal, Progress, Select, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, type CreateTaskPayload } from "@/api/endpoints";
import { DataSourceIndicator } from "@/components/DataSourceIndicator";
import { RealEmpty } from "@/components/RealEmpty";
import { LifecycleTag } from "@/components/StatusTag";
import { PageHeader } from "@/components/PageHeader";
import { useUiStore } from "@/store/uiStore";
import type { GovernanceTask, LifecycleStatus } from "@/types/domain";
import { formatDateTime } from "@/utils/format";
import { labelOf, optionsOf, priorityLabels, taskTypeLabels } from "@/utils/labels";

const priorityColor: Record<GovernanceTask["priority"], string> = {
  LOW: "default",
  MEDIUM: "blue",
  NORMAL: "blue",
  HIGH: "orange",
  URGENT: "red",
};

const taskActionLabels: Record<"start" | "pause" | "retry" | "cancel", string> = {
  start: "启动",
  pause: "暂停",
  retry: "重试",
  cancel: "取消",
};

const statusOptions: Array<{ value: "ALL" | LifecycleStatus; label: string }> = [
  { value: "ALL", label: "全部状态" },
  { value: "RUNNING", label: "运行中" },
  { value: "PAUSED", label: "已暂停" },
  { value: "PENDING_REVIEW", label: "待审核" },
  { value: "FAILED", label: "失败" },
  { value: "SUCCEEDED", label: "成功" },
];

export function Tasks() {
  const { message } = App.useApp();
  const [form] = Form.useForm<CreateTaskPayload>();
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<"ALL" | LifecycleStatus>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const selectedProjectId = useUiStore((state) => state.selectedProjectId);
  const sessionQuery = useQuery({
    queryKey: ["task-gateway-session"],
    queryFn: api.getSession,
  });
  const taskQuery = useQuery({
    queryKey: ["governance-tasks"],
    queryFn: api.listGovernanceTasks,
  });
  const createMutation = useMutation({
    mutationFn: api.createGovernanceTask,
    onSuccess: async () => {
      message.success("任务已创建");
      setCreateOpen(false);
      form.resetFields();
      await taskQuery.refetch();
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "任务创建失败"),
  });
  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "start" | "pause" | "retry" | "cancel" }) => {
      const actions = {
        start: api.startGovernanceTask,
        pause: api.pauseGovernanceTask,
        retry: api.retryGovernanceTask,
        cancel: api.cancelGovernanceTask,
      };
      return actions[action](id);
    },
    onSuccess: async (_, variables) => {
      message.success(`任务${taskActionLabels[variables.action]}已提交`);
      await taskQuery.refetch();
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "任务操作失败"),
  });

  const records = taskQuery.data?.data.records ?? [];
  const filtered = records.filter((record) => {
    const matchKeyword = [record.taskCode, record.name, record.owner, record.type]
      .join(" ")
      .toLowerCase()
      .includes(keyword.toLowerCase());
    const matchStatus = status === "ALL" || record.status === status;
    return matchKeyword && matchStatus;
  });

  const openCreateModal = () => {
    const session = sessionQuery.data?.data;
    const actorId = Number(session?.actorId);
    form.setFieldsValue({
      ownerId: Number.isFinite(actorId) ? actorId : undefined,
      type: "DATA_SYNC",
      priority: "MEDIUM",
      maxRetryCount: 3,
      maxDeferCount: 3,
      idempotencyKey: `ui:${Date.now()}`,
      params: "{}",
    });
    setCreateOpen(true);
  };

  const submitCreate = (values: CreateTaskPayload) => {
    const session = sessionQuery.data?.data;
    const tenantId = Number(session?.tenantId);
    const projectId = Number(selectedProjectId ?? session?.authorizedProjectIds?.[0]);
    if (!Number.isFinite(tenantId) || !Number.isFinite(projectId)) {
      message.error("当前租户或项目上下文尚未就绪，无法创建任务");
      return;
    }
    createMutation.mutate({
      ...values,
      description: values.description || undefined,
      idempotencyKey: values.idempotencyKey || undefined,
      params: values.params || undefined,
      tenantId,
      ownerId: values.ownerId || undefined,
      projectId,
    });
  };

  const columns: ColumnsType<GovernanceTask> = [
    {
      title: "ID",
      dataIndex: "id",
      width: 82,
      render: (value) => <Typography.Text className="mono">{value}</Typography.Text>,
    },
    {
      title: "任务",
      dataIndex: "name",
      render: (value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{value}</Typography.Text>
          <Typography.Text className="mono" type="secondary">
            {record.taskCode}
          </Typography.Text>
        </Space>
      ),
    },
    { title: "类型", dataIndex: "type", render: (value) => <Tag>{labelOf(value, taskTypeLabels)}</Tag> },
    { title: "状态", dataIndex: "status", render: (value) => <LifecycleTag value={value} /> },
    {
      title: "优先级",
      dataIndex: "priority",
      render: (value: GovernanceTask["priority"]) => <Tag color={priorityColor[value]}>{labelOf(value, priorityLabels)}</Tag>,
    },
    {
      title: "进度",
      dataIndex: "progress",
      width: 180,
      render: (value, record) => (
        <Progress
          percent={value}
          size="small"
          status={record.status === "FAILED" ? "exception" : record.status === "SUCCEEDED" ? "success" : "active"}
        />
      ),
    },
    { title: "重试", dataIndex: "retryCount" },
    { title: "负责人", dataIndex: "owner" },
    { title: "更新时间", dataIndex: "updatedAt", render: (value) => formatDateTime(value) },
    {
      title: "操作",
      width: 230,
      render: (_, record) => (
        <Space>
          <Button
            aria-label="启动任务"
            title="启动任务"
            icon={<PlayCircleOutlined />}
            loading={actionMutation.isPending}
            onClick={() => actionMutation.mutate({ id: record.id, action: "start" })}
          />
          <Button
            aria-label="暂停任务"
            title="暂停任务"
            icon={<PauseCircleOutlined />}
            loading={actionMutation.isPending}
            onClick={() => actionMutation.mutate({ id: record.id, action: "pause" })}
          />
          <Button
            aria-label="重试任务"
            title="重试任务"
            icon={<RedoOutlined />}
            loading={actionMutation.isPending}
            onClick={() => actionMutation.mutate({ id: record.id, action: "retry" })}
          />
          <Button
            danger
            aria-label="取消任务"
            title="取消任务"
            icon={<StopOutlined />}
            loading={actionMutation.isPending}
            onClick={() => actionMutation.mutate({ id: record.id, action: "cancel" })}
          />
        </Space>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="任务"
        subtitle="任务生命周期、队列、重试、回放和人工审核"
        actions={
          <>
            <DataSourceIndicator meta={taskQuery.data?.meta} />
            <Button type="primary" icon={<SyncOutlined />} onClick={openCreateModal}>
              创建任务
            </Button>
          </>
        }
      />

      <Card className="compact-card">
        <div className="toolbar">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索任务编码、名称、负责人"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            style={{ width: 320 }}
          />
          <Select value={status} onChange={setStatus} style={{ width: 160 }} options={statusOptions} />
          <Button icon={<SyncOutlined />} onClick={() => taskQuery.refetch()} />
        </div>
      </Card>

      <Card className="table-card">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={taskQuery.isLoading}
          locale={{ emptyText: <RealEmpty meta={taskQuery.data?.meta} description="暂无治理任务记录" /> }}
          pagination={{ pageSize: 8, showSizeChanger: false }}
        />
      </Card>

      <Modal
        title="创建任务"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        destroyOnClose
      >
        <Form<CreateTaskPayload> form={form} layout="vertical" onFinish={submitCreate}>
          <div className="scope-summary">
            <Typography.Text strong>创建到当前项目</Typography.Text>
            <Typography.Text type="secondary">
              {selectedProjectId ? `项目 ${selectedProjectId}` : "未选择项目"}
            </Typography.Text>
          </div>
          <Form.Item name="name" label="任务名称" rules={[{ required: true, message: "请输入任务名称" }]}>
            <Input placeholder="订单域增量同步" />
          </Form.Item>
          <Form.Item name="description" label="任务说明">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="ownerId" label="负责人 Actor ID">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <div className="grid grid-two-form">
            <Form.Item name="type" label="任务类型" rules={[{ required: true, message: "请选择任务类型" }]}>
              <Select
                options={optionsOf(["DATA_SYNC", "QUALITY_SCAN", "METADATA_DISCOVERY", "AGENT_TOOL"], taskTypeLabels)}
              />
            </Form.Item>
            <Form.Item name="priority" label="优先级">
              <Select
                options={optionsOf(["LOW", "MEDIUM", "HIGH", "URGENT"], priorityLabels)}
              />
            </Form.Item>
          </div>
          <div className="grid grid-two-form">
            <Form.Item name="maxRetryCount" label="最大重试">
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="maxDeferCount" label="最大退避">
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
          </div>
          <Form.Item name="idempotencyKey" label="幂等键">
            <Input />
          </Form.Item>
          <Form.Item name="params" label="参数 JSON">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
