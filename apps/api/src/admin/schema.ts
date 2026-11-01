import * as v from "valibot";

const page = v.optional(
  v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1)),
  "1",
);
const limit = v.optional(
  v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(1), v.maxValue(100)),
  "25",
);

export const userIdParam = v.object({
  userId: v.pipe(v.string(), v.minLength(1)),
});

export const listUsersQuery = v.object({
  search: v.optional(v.pipe(v.string(), v.maxLength(200))),
  role: v.optional(v.picklist(["admin", "user"])),
  status: v.optional(v.picklist(["active", "banned"])),
  includeGuests: v.optional(v.picklist(["true", "false"])),
  page,
  limit,
});

export const createUserBody = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100)),
  email: v.pipe(v.string(), v.trim(), v.email(), v.maxLength(254)),
  password: v.optional(v.pipe(v.string(), v.minLength(8), v.maxLength(128))),
  role: v.optional(v.picklist(["admin", "user"]), "user"),
  sendSetupEmail: v.optional(v.boolean(), true),
});

export const setRoleBody = v.object({
  role: v.picklist(["admin", "user"]),
});

export const banUserBody = v.object({
  reason: v.optional(v.pipe(v.string(), v.maxLength(500))),
  expiresAt: v.optional(v.pipe(v.string(), v.isoTimestamp())),
});

export const listAuditLogQuery = v.object({
  action: v.optional(v.pipe(v.string(), v.maxLength(100))),
  actorId: v.optional(v.pipe(v.string(), v.maxLength(100))),
  targetType: v.optional(v.pipe(v.string(), v.maxLength(50))),
  targetId: v.optional(v.pipe(v.string(), v.maxLength(100))),
  page,
  limit,
});

export const adminUserSchema = v.object({
  id: v.string(),
  name: v.string(),
  email: v.string(),
  emailVerified: v.boolean(),
  image: v.nullable(v.string()),
  role: v.picklist(["admin", "user"]),
  banned: v.boolean(),
  banReason: v.nullable(v.string()),
  banExpires: v.nullable(v.string()),
  isAnonymous: v.boolean(),
  createdAt: v.string(),
  lastActiveAt: v.nullable(v.string()),
});

export const adminSessionSchema = v.object({
  id: v.string(),
  createdAt: v.string(),
  lastActiveAt: v.string(),
  expiresAt: v.string(),
  ipAddress: v.nullable(v.string()),
  userAgent: v.nullable(v.string()),
  impersonated: v.boolean(),
  current: v.boolean(),
});

export const adminApiKeySchema = v.object({
  id: v.string(),
  name: v.nullable(v.string()),
  start: v.nullable(v.string()),
  prefix: v.nullable(v.string()),
  enabled: v.boolean(),
  expiresAt: v.nullable(v.string()),
  lastUsedAt: v.nullable(v.string()),
  createdAt: v.string(),
});

export const auditEntrySchema = v.object({
  id: v.string(),
  createdAt: v.string(),
  action: v.string(),
  actor: v.object({
    id: v.nullable(v.string()),
    name: v.nullable(v.string()),
    email: v.nullable(v.string()),
  }),
  targetType: v.string(),
  targetId: v.nullable(v.string()),
  targetLabel: v.nullable(v.string()),
  metadata: v.nullable(v.record(v.string(), v.unknown())),
  ipAddress: v.nullable(v.string()),
  userAgent: v.nullable(v.string()),
});
