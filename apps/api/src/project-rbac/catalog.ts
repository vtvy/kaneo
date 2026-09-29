export const PROJECT_PERMISSION_CATALOG = {
  item: ["create", "read", "update", "delete", "transition", "assign"],
  sprint: ["create", "start", "complete", "manage"],
  backlog: ["read", "manage"],
  doc: ["view", "upload", "manage", "empty_trash"],
  role: ["manage"],
  member: ["manage"],
} as const satisfies Record<string, readonly string[]>;

export type ProjectResource = keyof typeof PROJECT_PERMISSION_CATALOG;
export type ProjectPermissionMap = Record<string, string[]>;

export const PROJECT_SYSTEM_OWNER = "Owner";
export const DEFAULT_PROJECT_ROLE_NAMES = [
  "Owner",
  "Member",
  "Viewer",
] as const;
export type DefaultProjectRoleName =
  (typeof DEFAULT_PROJECT_ROLE_NAMES)[number];

const allOf = (r: ProjectResource): string[] => [
  ...PROJECT_PERMISSION_CATALOG[r],
];

export const DEFAULT_PROJECT_ROLE_PAYLOADS: Record<
  DefaultProjectRoleName,
  ProjectPermissionMap
> = {
  Owner: {
    item: allOf("item"),
    sprint: allOf("sprint"),
    backlog: allOf("backlog"),
    doc: allOf("doc"),
    role: allOf("role"),
    member: allOf("member"),
  },
  Member: {
    item: ["create", "read", "update", "transition", "assign"],
    sprint: ["create", "start", "complete", "manage"],
    backlog: ["read", "manage"],
    doc: ["view", "upload", "manage"],
  },
  Viewer: {
    item: ["read"],
    backlog: ["read"],
    doc: ["view"],
  },
};
