import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import db, { schema } from "../../database";
import { LogoutTokenRejected } from "../errors";
import {
  CLOCK_SKEW_SECONDS,
  type LogoutTokenClaims,
  MAX_LOGOUT_TOKEN_AGE_SECONDS,
} from "../verify-logout-token";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Records the token's jti in the verification table so a replay is refused
// on every API instance, until the token would be too old anyway.
async function claimLogoutToken(
  tx: Transaction,
  { iss, jti, iat }: LogoutTokenClaims,
) {
  const identifier = `backchannel-logout:${iss}:${jti}`;
  const [claimed] = await tx
    .insert(schema.verificationTable)
    .values({
      id: createHash("sha256").update(identifier).digest("base64url"),
      identifier,
      value: "used",
      expiresAt: new Date(
        (iat + MAX_LOGOUT_TOKEN_AGE_SECONDS + CLOCK_SKEW_SECONDS) * 1000,
      ),
    })
    .onConflictDoNothing({ target: schema.verificationTable.id })
    .returning({ id: schema.verificationTable.id });
  return Boolean(claimed);
}

// Only users linked to the custom provider through this exact subject; the
// email address is never consulted.
async function findCustomAccountUsers(tx: Transaction, accountId: string) {
  const accounts = await tx
    .select({ userId: schema.accountTable.userId })
    .from(schema.accountTable)
    .where(
      and(
        eq(schema.accountTable.providerId, "custom"),
        eq(schema.accountTable.accountId, accountId),
      ),
    );
  return [...new Set(accounts.map((account) => account.userId))];
}

export type EndedSession = { id: string; userId: string };

export async function endProviderSessions(
  claims: LogoutTokenClaims,
): Promise<EndedSession[]> {
  const { sid, sub } = claims;
  if (sid === undefined && sub === undefined) {
    throw new Error("A logout needs a session ID or a subject");
  }

  return db.transaction(async (tx) => {
    if (!(await claimLogoutToken(tx, claims))) {
      throw new LogoutTokenRejected("the logout token was used before");
    }
    const userIds =
      sub === undefined ? undefined : await findCustomAccountUsers(tx, sub);
    if (userIds?.length === 0) return [];
    return tx
      .delete(schema.sessionTable)
      .where(
        and(
          sid === undefined ? undefined : eq(schema.sessionTable.oidcSid, sid),
          userIds === undefined
            ? undefined
            : inArray(schema.sessionTable.userId, userIds),
        ),
      )
      .returning({
        id: schema.sessionTable.id,
        userId: schema.sessionTable.userId,
      });
  });
}
