import type { InstancePermission } from "./permissions";

/** Unknown admin routes fail closed to the built-in administrator. */
export function adminRoutePermission(
  method: string,
  path: string,
): InstancePermission {
  const relative = path.replace(/^.*\/admin(?=\/|$)/, "");
  if (
    relative.startsWith("/roles") ||
    relative.endsWith("/role") ||
    relative.endsWith("/instance-role")
  )
    return "roles:manage";
  if (relative.includes("/sessions")) return "sessions:manage";
  if (relative.includes("/api-keys")) return "api_keys:manage";
  if (relative === "/users" && method === "GET") return "users:read";
  if (relative === "/users" && method === "POST") return "users:create";
  if (relative.startsWith("/users/")) return "users:manage";
  if (relative.startsWith("/workspaces"))
    return method === "GET" ? "workspaces:read" : "workspaces:manage";
  if (relative === "/system" && method === "GET") return "instance:read";
  if (
    relative.startsWith("/settings") ||
    relative.startsWith("/system/") ||
    relative.startsWith("/webhooks")
  )
    return "instance:settings";
  if (relative === "/audit-log") return "audit:read";
  return "roles:manage";
}
