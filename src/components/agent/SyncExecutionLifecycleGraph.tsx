import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  MinusCircleOutlined,
} from "@ant-design/icons";
import { Alert, Space, Steps, Tag, Typography } from "antd";
import type { StepProps } from "antd";
import { useMemo } from "react";
import type {
  SyncExecutionLifecycleEvidence,
  SyncExecutionLifecycleEdge,
  SyncExecutionLifecycleGraph as LifecycleGraph,
  SyncExecutionLifecycleNode,
} from "@/types/domain";
import { formatDateTime } from "@/utils/format";
import "./SyncExecutionLifecycleGraph.css";

const completedStates = new Set([
  "ACCEPTED", "RECORDED", "BRIDGED", "DELIVERED", "PUBLISHED", "CONSUMED", "SUCCEEDED", "RECOVERED", "VERIFIED",
  "COMPLETED",
]);
const failedStates = new Set([
  "FAILED", "ATTENTION_REQUIRED", "BLOCKED", "UNAVAILABLE", "NOT_FOUND", "DEAD_LETTER",
]);
const waitingStates = new Set([
  "WAITING", "QUEUED", "RUNNING", "RETRYING", "PENDING", "DISPATCHING", "TRIGGERED", "RECOVERY_STARTED",
]);

const stateLabels: Record<string, string> = {
  ACCEPTED: "已接受",
  RECORDED: "已记录",
  BRIDGED: "已桥接",
  DELIVERED: "已投递",
  PUBLISHED: "已发布",
  CONSUMED: "已消费",
  SUCCEEDED: "成功",
  RECOVERED: "已恢复",
  VERIFIED: "已验证",
  COMPLETED: "已推进",
  WAITING: "等待中",
  QUEUED: "排队中",
  RUNNING: "执行中",
  RETRYING: "重试中",
  PENDING: "待处理",
  DISPATCHING: "投递中",
  TRIGGERED: "已触发",
  RECOVERY_STARTED: "恢复已启动",
  FAILED: "失败",
  ATTENTION_REQUIRED: "需要人工关注",
  BLOCKED: "已阻断",
  UNAVAILABLE: "来源不可用",
  NOT_FOUND: "未找到",
  DEAD_LETTER: "已进入死信",
  NOT_RECORDED: "尚无事实",
  NOT_APPLICABLE: "不适用",
  NOT_LINKED: "未关联",
  LINKED: "已关联",
  UNKNOWN: "未知",
};

const confidenceLabels: Record<string, string> = {
  AUTHORITATIVE: "权威事实",
  PARTIAL: "部分事实",
  UNAVAILABLE: "不可验证",
};

/** 把后端有限状态映射为 Ant Design Steps 的视觉语义，不改变原始状态值。 */
function stepStatus(state: string): StepProps["status"] {
  const normalized = state.toUpperCase();
  if (failedStates.has(normalized)) return "error";
  if (completedStates.has(normalized) || normalized === "LINKED") return "finish";
  if (waitingStates.has(normalized)) return "process";
  return "wait";
}

function stepIcon(state: string) {
  const normalized = state.toUpperCase();
  if (failedStates.has(normalized)) return <CloseCircleOutlined />;
  if (completedStates.has(normalized) || normalized === "LINKED") return <CheckCircleOutlined />;
  if (waitingStates.has(normalized)) return <ClockCircleOutlined />;
  if (normalized === "NOT_RECORDED" || normalized === "NOT_APPLICABLE" || normalized === "NOT_LINKED") {
    return <MinusCircleOutlined />;
  }
  return <ExclamationCircleOutlined />;
}

function confidenceColor(confidence?: string) {
  if (confidence === "AUTHORITATIVE") return "green";
  if (confidence === "PARTIAL") return "gold";
  return "default";
}

/** 单个节点的证据摘要：来源、时间、可信度和低敏引用保持在同一视觉行。 */
function NodeDescription({ node, evidence, incomingEdge }: {
  node: SyncExecutionLifecycleNode;
  evidence?: SyncExecutionLifecycleEvidence;
  incomingEdge?: SyncExecutionLifecycleEdge;
}) {
  return (
    <div className="sync-lifecycle-node-description">
      <Space size={[4, 4]} wrap>
        <Tag>{node.source}</Tag>
        {evidence ? (
          <Tag color={confidenceColor(evidence.confidence)}>
            {confidenceLabels[evidence.confidence] ?? evidence.confidence}
          </Tag>
        ) : null}
        <Typography.Text type="secondary">{formatDateTime(node.occurredAt ?? evidence?.occurredAt)}</Typography.Text>
      </Space>
      {evidence?.reference ? (
        <Typography.Text type="secondary" className="sync-lifecycle-reference">
          证据：{evidence.reference}
        </Typography.Text>
      ) : null}
      {incomingEdge ? (
        <Typography.Text type="secondary" className="sync-lifecycle-edge">
          上游关系：{incomingEdge.relation} · {stateLabels[incomingEdge.state] ?? incomingEdge.state}
        </Typography.Text>
      ) : null}
      {node.reasonCode ? <Typography.Text code>{node.reasonCode}</Typography.Text> : null}
    </div>
  );
}

/**
 * 渲染服务端统一生命周期图。
 *
 * 组件只按服务端节点顺序展示，不根据日志文本重算状态。来源缺失时保留 PARTIAL/NOT_LINKED，
 * 让运维人员能区分“业务失败”和“观察来源暂不可用”。
 */
export function SyncExecutionLifecycleGraph({ graph }: { graph: LifecycleGraph }) {
  const evidenceById = useMemo(
    () => new Map(graph.evidence.map((item) => [item.evidenceId, item])),
    [graph.evidence],
  );
  const incomingEdgeByNodeId = useMemo(
    () => new Map(graph.edges.map((edge) => [edge.toNodeId, edge])),
    [graph.edges],
  );
  const items = graph.nodes.map((node) => {
    const evidence = node.evidenceId ? evidenceById.get(node.evidenceId) : undefined;
    return {
      title: (
        <Space size={8} wrap>
          <Typography.Text strong>{node.title}</Typography.Text>
          {node.role ? <Tag>{node.role}</Tag> : null}
          <Tag color={failedStates.has(node.state) ? "red" : completedStates.has(node.state) ? "green" : "default"}>
            {stateLabels[node.state] ?? node.state}
          </Tag>
        </Space>
      ),
      description: (
        <NodeDescription
          node={node}
          evidence={evidence}
          incomingEdge={incomingEdgeByNodeId.get(node.nodeId)}
        />
      ),
      status: stepStatus(node.state),
      icon: stepIcon(node.state),
    } satisfies StepProps;
  });

  return (
    <div className="sync-lifecycle-graph">
      <Space size={[8, 8]} wrap className="sync-lifecycle-summary">
        <Tag color={graph.sourceStatus === "COMPLETE" ? "green" : graph.sourceStatus === "PARTIAL" ? "gold" : "default"}>
          来源完整度：{graph.sourceStatus}
        </Tag>
        <Tag>总体状态：{stateLabels[graph.overallState] ?? graph.overallState}</Tag>
        <Tag>根执行 #{graph.rootExecutionId}</Tag>
        <Tag>当前执行 #{graph.currentExecutionId}</Tag>
      </Space>
      {graph.missingReason ? (
        <Alert showIcon type="warning" message="链路证据不完整" description={graph.missingReason} />
      ) : null}
      <Steps direction="vertical" size="small" items={items} />
    </div>
  );
}
