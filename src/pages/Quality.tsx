import { DownloadOutlined, ExperimentOutlined, PlayCircleOutlined, SearchOutlined } from "@ant-design/icons";
import { App, Button, Card, Form, Input, InputNumber, Modal, Progress, Segmented, Select, Space, Table, Tabs, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, type CreateQualityRulePayload, type RunQualityCheckPayload } from "@/api/endpoints";
import { DataSourceIndicator } from "@/components/DataSourceIndicator";
import { RealEmpty } from "@/components/RealEmpty";
import { RiskTag } from "@/components/StatusTag";
import { PageHeader } from "@/components/PageHeader";
import { useUiStore } from "@/store/uiStore";
import type { QualityReport, QualityRule } from "@/types/domain";
import { formatDateTime } from "@/utils/format";
import { defaultTablePagination, sortByIdDesc } from "@/utils/table";
import {
  comparisonLabels,
  labelOf,
  optionsOf,
  qualityRuleTypeLabels,
  riskLabels,
  statusLabels,
  targetTypeLabels,
} from "@/utils/labels";

const ruleStatusColor: Record<QualityRule["status"], string> = {
  ENABLED: "green",
  DISABLED: "default",
  ARCHIVED: "default",
};

const reportStatusColor: Record<QualityReport["status"], string> = {
  PASSED: "green",
  WARNING: "orange",
  FAILED: "red",
};

export function Quality() {
  const { message } = App.useApp();
  const [createForm] = Form.useForm<CreateQualityRulePayload>();
  const [runForm] = Form.useForm<RunQualityCheckPayload>();
  const [keyword, setKeyword] = useState("");
  const [scope, setScope] = useState<string | number>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [runningRule, setRunningRule] = useState<QualityRule | null>(null);
  const selectedProjectId = useUiStore((state) => state.selectedProjectId);
  const projectOptions = useUiStore((state) => state.projectOptions);
  const sessionQuery = useQuery({
    queryKey: ["quality-gateway-session"],
    queryFn: api.getSession,
  });
  const ruleQuery = useQuery({
    queryKey: ["quality-rules"],
    queryFn: api.listQualityRules,
  });
  const reportQuery = useQuery({
    queryKey: ["quality-reports"],
    queryFn: api.listQualityReports,
  });
  const createMutation = useMutation({
    mutationFn: api.createQualityRule,
    onSuccess: async () => {
      message.success("质量规则已创建");
      setCreateOpen(false);
      createForm.resetFields();
      await ruleQuery.refetch();
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "质量规则创建失败"),
  });
  const runMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: RunQualityCheckPayload }) =>
      api.runQualityCheck(id, payload),
    onSuccess: async () => {
      message.success("质量检测已完成");
      setRunningRule(null);
      runForm.resetFields();
      await Promise.all([ruleQuery.refetch(), reportQuery.refetch()]);
    },
    onError: (error) => message.error(error instanceof Error ? error.message : "质量检测失败"),
  });

  const rules = ruleQuery.data?.data.records ?? [];
  const reports = reportQuery.data?.data.records ?? [];
  const filteredRules = rules.filter((record) => {
    const matchKeyword = [record.name, record.datasourceName, record.targetTable]
      .join(" ")
      .toLowerCase()
      .includes(keyword.toLowerCase());
    const matchScope =
      scope === "all" ||
      (scope === "enabled" && record.status === "ENABLED") ||
      (scope === "risk" && ["HIGH", "CRITICAL"].includes(record.severity));
    return matchKeyword && matchScope;
  });

  const openCreateModal = () => {
    createForm.setFieldsValue({
      ruleType: "CUSTOM_SQL",
      targetType: "GENERIC",
      comparisonOperator: "GTE",
      expectedValue: 0,
      severity: "MEDIUM",
    });
    setCreateOpen(true);
  };

  const submitCreate = (values: CreateQualityRulePayload) => {
    const session = sessionQuery.data?.data;
    const tenantId = Number(session?.tenantId);
    const projectId = Number(selectedProjectId ?? session?.authorizedProjectIds?.[0]);
    if (!Number.isFinite(tenantId) || !Number.isFinite(projectId)) {
      message.error("当前租户或项目上下文尚未就绪，无法创建质量规则");
      return;
    }
    createMutation.mutate({
      ...values,
      tenantId,
      projectId,
      dataSourceId: values.dataSourceId || undefined,
      databaseName: values.databaseName || undefined,
      schemaName: values.schemaName || undefined,
      tableName: values.tableName || undefined,
      fieldName: values.fieldName || undefined,
      description: values.description || undefined,
    });
  };

  const openRunModal = (rule: QualityRule) => {
    setRunningRule(rule);
    runForm.setFieldsValue({
      measuredValue: rule.passRate || 100,
      sampleSize: 100,
      exceptionCount: rule.anomalyCount || 0,
    });
  };

  const submitRun = (values: RunQualityCheckPayload) => {
    if (!runningRule) {
      return;
    }
    runMutation.mutate({ id: runningRule.id, payload: values });
  };

  const ruleColumns: ColumnsType<QualityRule> = [
    {
      title: "ID",
      dataIndex: "id",
      width: 82,
      render: (value) => <Typography.Text className="mono">{value}</Typography.Text>,
    },
    {
      title: "规则",
      dataIndex: "name",
      render: (value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{value}</Typography.Text>
          <Typography.Text type="secondary">
            {record.datasourceName} / {record.targetTable}
          </Typography.Text>
        </Space>
      ),
    },
    { title: "类型", dataIndex: "ruleType", render: (value) => <Tag>{labelOf(value, qualityRuleTypeLabels)}</Tag> },
    {
      title: "状态",
      dataIndex: "status",
      render: (value: QualityRule["status"]) => <Tag color={ruleStatusColor[value]}>{labelOf(value, statusLabels)}</Tag>,
    },
    { title: "严重级别", dataIndex: "severity", render: (value) => <RiskTag value={value} /> },
    {
      title: "通过率",
      dataIndex: "passRate",
      width: 180,
      render: (value) => <Progress percent={value} size="small" status={value < 98 ? "exception" : "success"} />,
    },
    { title: "异常数", dataIndex: "anomalyCount", render: (value) => <Tag color={value > 100 ? "red" : "orange"}>{value}</Tag> },
    { title: "最近执行", dataIndex: "lastRunAt", render: (value) => formatDateTime(value) },
    {
      title: "操作",
      width: 150,
      render: (_, record) => (
        <Space>
          <Button aria-label="执行检测" title="执行检测" icon={<PlayCircleOutlined />} onClick={() => openRunModal(record)} />
          <Button aria-label="生成规则建议" title="生成规则建议" icon={<ExperimentOutlined />} onClick={() => message.info("规则建议需要绑定数据源元数据上下文")} />
        </Space>
      ),
    },
  ];

  const reportColumns: ColumnsType<QualityReport> = [
    { title: "ID", dataIndex: "id", render: (value) => <span className="mono">{value}</span> },
    { title: "规则", dataIndex: "ruleName" },
    { title: "分数", dataIndex: "score", render: (value) => <Progress percent={value} size="small" /> },
    {
      title: "状态",
      dataIndex: "status",
      render: (value: QualityReport["status"]) => <Tag color={reportStatusColor[value]}>{labelOf(value, statusLabels)}</Tag>,
    },
    { title: "异常", dataIndex: "anomalies" },
    { title: "生成时间", dataIndex: "generatedAt", render: (value) => formatDateTime(value) },
    { title: "操作", render: () => <Button aria-label="下载报告" title="下载报告" icon={<DownloadOutlined />} /> },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="数据质量"
        subtitle="规则、扫描、报告、异常聚合和修复任务"
        actions={<DataSourceIndicator meta={ruleQuery.data?.meta ?? reportQuery.data?.meta} />}
      />

      <Card className="compact-card">
        <div className="toolbar">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索规则、数据源、表"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            style={{ width: 300 }}
          />
          <Segmented
            value={scope}
            onChange={setScope}
            options={[
              { label: "全部", value: "all" },
              { label: "启用", value: "enabled" },
              { label: "高风险", value: "risk" },
            ]}
          />
          <Button type="primary" icon={<ExperimentOutlined />} onClick={openCreateModal}>
            新建规则
          </Button>
        </div>
      </Card>

      <Tabs
        items={[
          {
            key: "rules",
            label: "规则",
            children: (
              <Card className="table-card">
                <Table
                  rowKey="id"
                  columns={ruleColumns}
                  dataSource={sortByIdDesc(filteredRules)}
                  loading={ruleQuery.isLoading}
                  locale={{ emptyText: <RealEmpty meta={ruleQuery.data?.meta} description="暂无质量规则记录" /> }}
                  pagination={defaultTablePagination(8)}
                />
              </Card>
            ),
          },
          {
            key: "reports",
            label: "报告",
            children: (
              <Card className="table-card">
                <Table
                  rowKey="id"
                  columns={reportColumns}
                  dataSource={sortByIdDesc(reports)}
                  loading={reportQuery.isLoading}
                  locale={{ emptyText: <RealEmpty meta={reportQuery.data?.meta} description="暂无质量报告记录" /> }}
                  pagination={defaultTablePagination(8)}
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title="新建质量规则"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
        destroyOnClose
      >
        <Form<CreateQualityRulePayload> form={createForm} layout="vertical" onFinish={submitCreate}>
          <div className="scope-summary">
            <Typography.Text strong>创建到当前项目</Typography.Text>
            <Typography.Text type="secondary">
              {selectedProjectId
                ? projectOptions.find((project) => project.value === selectedProjectId)?.label ?? "未找到项目名称"
                : "未选择项目"}
            </Typography.Text>
          </div>
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: "请输入规则名称" }]}>
            <Input placeholder="会员手机号唯一性" />
          </Form.Item>
          <div className="grid grid-two-form">
            <Form.Item name="ruleType" label="规则类型" rules={[{ required: true, message: "请选择规则类型" }]}>
              <Select
                options={optionsOf(["NULL_CHECK", "UNIQUE_CHECK", "RANGE_CHECK", "CUSTOM_SQL"], qualityRuleTypeLabels)}
              />
            </Form.Item>
            <Form.Item name="severity" label="严重级别">
              <Select
                options={optionsOf(["LOW", "MEDIUM", "HIGH", "CRITICAL"], riskLabels)}
              />
            </Form.Item>
          </div>
          <Form.Item name="targetObject" label="检测目标" rules={[{ required: true, message: "请输入检测目标" }]}>
            <Input placeholder="dim_member.phone" />
          </Form.Item>
          <div className="grid grid-two-form">
            <Form.Item name="targetType" label="目标类型">
              <Select
                options={optionsOf(["GENERIC", "RELATIONAL_TABLE", "RELATIONAL_FIELD"], targetTypeLabels)}
              />
            </Form.Item>
            <Form.Item name="dataSourceId" label="数据源 ID">
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
          </div>
          <div className="grid grid-two-form">
            <Form.Item name="tableName" label="表名">
              <Input />
            </Form.Item>
            <Form.Item name="fieldName" label="字段名">
              <Input />
            </Form.Item>
          </div>
          <div className="grid grid-two-form">
            <Form.Item name="comparisonOperator" label="比较符" rules={[{ required: true, message: "请选择比较符" }]}>
              <Select
                options={optionsOf(["GTE", "GT", "EQ", "LTE", "LT"], comparisonLabels)}
              />
            </Form.Item>
            <Form.Item name="expectedValue" label="期望值" rules={[{ required: true, message: "请输入期望值" }]}>
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
          </div>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={runningRule ? `执行检测：${runningRule.name}` : "执行检测"}
        open={Boolean(runningRule)}
        onCancel={() => setRunningRule(null)}
        onOk={() => runForm.submit()}
        confirmLoading={runMutation.isPending}
        destroyOnClose
      >
        <Form<RunQualityCheckPayload> form={runForm} layout="vertical" onFinish={submitRun}>
          <Form.Item name="measuredValue" label="观测值" rules={[{ required: true, message: "请输入观测值" }]}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <div className="grid grid-two-form">
            <Form.Item name="sampleSize" label="样本量" rules={[{ required: true, message: "请输入样本量" }]}>
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="exceptionCount" label="异常数" rules={[{ required: true, message: "请输入异常数" }]}>
              <InputNumber min={0} style={{ width: "100%" }} />
            </Form.Item>
          </div>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
