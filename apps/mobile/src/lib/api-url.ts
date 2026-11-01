export function normalizeServerOrigin(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Nhập địa chỉ máy chủ.");
  }

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error("Địa chỉ máy chủ không hợp lệ.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Chỉ hỗ trợ http hoặc https.");
  }
  if (url.username || url.password) {
    throw new Error("Địa chỉ máy chủ không được kèm tài khoản.");
  }

  const path = url.pathname.replace(/\/+$/, "");
  if (path !== "" && path !== "/api") {
    throw new Error("Chỉ nhập gốc máy chủ, không kèm đường dẫn khác.");
  }

  return url.origin;
}

export function buildApiUrl(
  origin: string,
  path: string,
  query?: Record<string, string | number | boolean | null | undefined>,
): string {
  const base = normalizeServerOrigin(origin);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalizedPath, `${base}/`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}
