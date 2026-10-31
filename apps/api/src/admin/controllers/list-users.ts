import {
  and,
  count,
  desc,
  eq,
  gt,
  ilike,
  isNull,
  lte,
  max,
  or,
  type SQL,
} from "drizzle-orm";
import db, { schema } from "../../database";
import { escapeLikePattern } from "../users/escape-like";
import { isBanActive } from "../users/is-ban-active";

export type ListUsersInput = {
  search?: string;
  role?: "admin" | "user";
  status?: "active" | "banned";
  includeGuests?: boolean;
  page: number;
  limit: number;
};

const user = schema.userTable;

function activeBan() {
  return and(
    eq(user.banned, true),
    or(isNull(user.banExpires), gt(user.banExpires, new Date())),
  );
}

function notBanned() {
  return or(
    isNull(user.banned),
    eq(user.banned, false),
    lte(user.banExpires, new Date()),
  );
}

export async function listUsers(input: ListUsersInput) {
  const search = input.search?.trim();
  const pattern = search ? `%${escapeLikePattern(search)}%` : null;
  const filters: (SQL | undefined)[] = [
    pattern
      ? or(ilike(user.name, pattern), ilike(user.email, pattern))
      : undefined,
    input.role === "admin" ? eq(user.role, "admin") : undefined,
    input.role === "user"
      ? or(isNull(user.role), eq(user.role, "user"))
      : undefined,
    input.status === "banned" ? activeBan() : undefined,
    input.status === "active" ? notBanned() : undefined,
    input.includeGuests
      ? undefined
      : or(isNull(user.isAnonymous), eq(user.isAnonymous, false)),
  ];
  const where = and(...filters);

  const lastActive = db
    .select({
      userId: schema.sessionTable.userId,
      lastActiveAt: max(schema.sessionTable.updatedAt).as("last_active_at"),
    })
    .from(schema.sessionTable)
    .groupBy(schema.sessionTable.userId)
    .as("last_active");

  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
        role: user.role,
        banned: user.banned,
        banReason: user.banReason,
        banExpires: user.banExpires,
        isAnonymous: user.isAnonymous,
        createdAt: user.createdAt,
        lastActiveAt: lastActive.lastActiveAt,
      })
      .from(user)
      .leftJoin(lastActive, eq(lastActive.userId, user.id))
      .where(where)
      .orderBy(desc(user.createdAt), desc(user.id))
      .limit(input.limit)
      .offset((input.page - 1) * input.limit),
    db.select({ value: count() }).from(user).where(where),
  ]);

  return {
    users: rows.map((row) => {
      const banned = isBanActive(row);
      return {
        id: row.id,
        name: row.name,
        email: row.email,
        emailVerified: row.emailVerified,
        image: row.image,
        role: row.role === "admin" ? ("admin" as const) : ("user" as const),
        banned,
        banReason: banned ? row.banReason : null,
        banExpires: banned ? (row.banExpires?.toISOString() ?? null) : null,
        isAnonymous: Boolean(row.isAnonymous),
        createdAt: row.createdAt.toISOString(),
        lastActiveAt: row.lastActiveAt
          ? new Date(row.lastActiveAt).toISOString()
          : null,
      };
    }),
    total: totalRow?.value ?? 0,
  };
}

export default listUsers;
