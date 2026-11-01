const KNOWN_ACTIONS = new Set([
  "user.created",
  "user.role_changed",
  "user.banned",
  "user.unbanned",
  "user.deleted",
  "user.session_revoked",
  "user.sessions_revoked",
  "user.api_key_revoked",
  "user.api_keys_revoked",
  "instance.settings_updated",
  "email.smtp_verified",
  "email.test_sent",
  "email.test_failed",
  "workspace.archived",
  "workspace.restored",
  "workspace.deleted",
]);

/**
 * i18n key for an audit action (`user.role_changed` →
 * `settings:adminPanel.auditLog.actions.user_role_changed`), or null for an
 * action this client does not know yet.
 */
export function getAuditActionKey(action: string): string | null {
  if (!KNOWN_ACTIONS.has(action)) return null;
  return `settings:adminPanel.auditLog.actions.${action.replace(".", "_")}`;
}

/** A short, human-readable summary of an entry's metadata. */
export function getAuditEntryDetail(
  metadata: Record<string, unknown> | null,
): string {
  if (!metadata) return "";
  const parts: string[] = [];
  if (typeof metadata.from === "string" && typeof metadata.to === "string") {
    parts.push(`${metadata.from} → ${metadata.to}`);
  }
  if (typeof metadata.reason === "string" && metadata.reason) {
    parts.push(metadata.reason);
  }
  if (typeof metadata.keyName === "string" && metadata.keyName) {
    parts.push(metadata.keyName);
  }
  if (typeof metadata.keyStart === "string" && metadata.keyStart) {
    parts.push(`${metadata.keyStart}…`);
  }
  if (Array.isArray(metadata.changes)) {
    for (const change of metadata.changes) {
      const item = change as { setting?: unknown; to?: unknown };
      if (typeof item.setting === "string") {
        parts.push(`${item.setting}: ${JSON.stringify(item.to)}`);
      }
    }
  }
  if (typeof metadata.status === "string") {
    parts.push(metadata.status);
  }
  if (typeof metadata.code === "string") {
    parts.push(metadata.code);
  }
  if (typeof metadata.count === "number") {
    parts.push(`×${metadata.count}`);
  }
  if (typeof metadata.role === "string" && !("from" in metadata)) {
    parts.push(metadata.role);
  }
  return parts.join(" · ");
}
