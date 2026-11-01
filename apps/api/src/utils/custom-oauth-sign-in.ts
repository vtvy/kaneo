import { getCurrentAuthContext } from "@better-auth/core/context";
import type { GenericEndpointContext } from "better-auth";
import { and, eq } from "drizzle-orm";
import db, { schema } from "../database";
import {
  parseManagedProfileFields,
  planManagedProfileUpdate,
  readCustomOAuthAccountId,
} from "./custom-oauth-profile";

// Claims of the custom provider sign-in in progress, keyed by request context.
const signInProfiles = new WeakMap<object, Record<string, unknown>>();

export async function rememberCustomOAuthProfile(
  profile: Record<string, unknown>,
) {
  const ctx = await getCurrentAuthContext().catch(() => null);
  if (ctx) signInProfiles.set(ctx.context, profile);
}

export function takeCustomOAuthProfile(
  ctx: GenericEndpointContext | null | undefined,
) {
  if (!ctx) return undefined;
  const profile = signInProfiles.get(ctx.context);
  signInProfiles.delete(ctx.context);
  return profile;
}

/**
 * Copies the managed profile fields onto the user signing in, but only when
 * that user owns the custom provider account for these claims. A user found
 * through the email address alone is never updated.
 */
export async function refreshManagedProfile(
  userId: string,
  profile: Record<string, unknown>,
) {
  const fields = parseManagedProfileFields();
  if (fields.length === 0) return;
  const accountId = readCustomOAuthAccountId(profile);
  if (!accountId) return;

  const [stored] = await db
    .select({
      name: schema.userTable.name,
      image: schema.userTable.image,
    })
    .from(schema.userTable)
    .innerJoin(
      schema.accountTable,
      eq(schema.accountTable.userId, schema.userTable.id),
    )
    .where(
      and(
        eq(schema.userTable.id, userId),
        eq(schema.accountTable.providerId, "custom"),
        eq(schema.accountTable.accountId, accountId),
      ),
    )
    .limit(1);
  if (!stored) return;

  const update = planManagedProfileUpdate(profile, stored, fields);
  if (Object.keys(update).length > 0) {
    await db
      .update(schema.userTable)
      .set(update)
      .where(eq(schema.userTable.id, userId));
  }
}
