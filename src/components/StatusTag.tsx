import { Tag } from "antd";
import type { LifecycleStatus, PlatformHealth, RiskLevel } from "@/types/domain";
import { riskLabels, statusLabels } from "@/utils/labels";

const healthMap: Record<PlatformHealth, { color: string; label: string }> = {
  UP: { color: "success", label: statusLabels.UP },
  DEGRADED: { color: "warning", label: statusLabels.DEGRADED },
  DOWN: { color: "error", label: statusLabels.DOWN },
  UNKNOWN: { color: "default", label: statusLabels.UNKNOWN },
};

const lifecycleMap: Record<LifecycleStatus, { color: string; label: string }> = {
  DRAFT: { color: "default", label: statusLabels.DRAFT },
  PENDING: { color: "gold", label: statusLabels.PENDING },
  PENDING_REVIEW: { color: "gold", label: statusLabels.PENDING_REVIEW },
  SCHEDULED: { color: "processing", label: statusLabels.SCHEDULED },
  RUNNING: { color: "blue", label: statusLabels.RUNNING },
  PAUSED: { color: "orange", label: statusLabels.PAUSED },
  DEFERRED: { color: "warning", label: statusLabels.DEFERRED },
  SUCCEEDED: { color: "success", label: statusLabels.SUCCEEDED },
  PARTIAL_SUCCEEDED: { color: "cyan", label: statusLabels.PARTIAL_SUCCEEDED },
  FAILED: { color: "error", label: statusLabels.FAILED },
  DEAD_LETTER: { color: "error", label: statusLabels.DEAD_LETTER },
  CANCELLED: { color: "default", label: statusLabels.CANCELLED },
  ARCHIVED: { color: "default", label: statusLabels.ARCHIVED },
};

const riskMap: Record<RiskLevel, { color: string; label: string }> = {
  LOW: { color: "green", label: riskLabels.LOW },
  MEDIUM: { color: "blue", label: riskLabels.MEDIUM },
  HIGH: { color: "orange", label: riskLabels.HIGH },
  CRITICAL: { color: "red", label: riskLabels.CRITICAL },
};

export function HealthTag({ value }: { value: PlatformHealth }) {
  const item = healthMap[value] ?? healthMap.UNKNOWN;
  return <Tag color={item.color}>{item.label}</Tag>;
}

export function LifecycleTag({ value }: { value: LifecycleStatus }) {
  const item = lifecycleMap[value] ?? lifecycleMap.DRAFT;
  return <Tag color={item.color}>{item.label}</Tag>;
}

export function RiskTag({ value }: { value: RiskLevel }) {
  const item = riskMap[value] ?? riskMap.LOW;
  return <Tag color={item.color}>{item.label}</Tag>;
}

export function BooleanTag({
  value,
  trueLabel = "启用",
  falseLabel = "停用",
}: {
  value: boolean;
  trueLabel?: string;
  falseLabel?: string;
}) {
  return <Tag color={value ? "success" : "default"}>{value ? trueLabel : falseLabel}</Tag>;
}
