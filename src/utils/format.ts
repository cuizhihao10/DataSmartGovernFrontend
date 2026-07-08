import dayjs from "dayjs";

export function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }
  return dayjs(value).format("YYYY-MM-DD HH:mm");
}

export function formatDuration(seconds: number) {
  if (seconds < 60) {
    return `${seconds} 秒`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分`;
}

export function percent(value: number) {
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
}
