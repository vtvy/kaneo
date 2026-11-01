export class ApiError extends Error {
  status: number | null;

  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function messageFromBody(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message;
    }
    const error = record.error;
    if (error && typeof error === "object") {
      const nested = (error as Record<string, unknown>).message;
      if (typeof nested === "string" && nested.trim()) return nested;
    }
    if (typeof error === "string" && error.trim()) return error;
  }
  if (status === 401) return "Phiên đăng nhập không còn hiệu lực.";
  if (status === 403) return "Bạn không có quyền thực hiện việc này.";
  if (status === 404) return "Không tìm thấy.";
  return `Yêu cầu thất bại (${status}).`;
}
