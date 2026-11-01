export function errorMessage(reason: unknown): string {
  if (reason instanceof Error && reason.message.trim()) return reason.message;
  return "Đã có lỗi.";
}

export function formatWhen(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

const PRIORITY_LABELS: Record<string, string> = {
  "no-priority": "Không ưu tiên",
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
  urgent: "Khẩn",
};

export function priorityLabel(priority: string | null | undefined): string {
  if (!priority) return "Không ưu tiên";
  return PRIORITY_LABELS[priority] ?? priority;
}

export function sprintStateLabel(state: string): string {
  if (state === "active") return "Đang chạy";
  if (state === "completed") return "Đã xong";
  if (state === "future") return "Sắp tới";
  return state;
}

export function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
