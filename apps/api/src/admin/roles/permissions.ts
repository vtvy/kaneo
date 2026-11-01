export const INSTANCE_PERMISSIONS = [
  "users:read",
  "users:create",
  "users:manage",
  "sessions:manage",
  "api_keys:manage",
  "workspaces:read",
  "workspaces:manage",
  "instance:read",
  "instance:settings",
  "audit:read",
  "roles:manage",
] as const;
export type InstancePermission = (typeof INSTANCE_PERMISSIONS)[number];
// Assigning roles can grant any permission and therefore remains admin-only.
export const CUSTOM_ROLE_PERMISSIONS = INSTANCE_PERMISSIONS.filter(
  (permission) => permission !== "roles:manage",
);

/** Management screens need the corresponding read permission to be reachable. */
export function normalizeInstancePermissions(permissions: readonly string[]) {
  const selected = new Set(permissions);
  if (
    ["users:create", "users:manage", "sessions:manage", "api_keys:manage"].some(
      (permission) => selected.has(permission),
    )
  )
    selected.add("users:read");
  if (selected.has("workspaces:manage")) selected.add("workspaces:read");
  return CUSTOM_ROLE_PERMISSIONS.filter((permission) =>
    selected.has(permission),
  );
}
