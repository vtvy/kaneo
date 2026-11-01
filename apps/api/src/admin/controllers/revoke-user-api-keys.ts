import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { closeSocketsForApiKey } from "../../ws";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { findTargetUser } from "../users/find-target-user";

const apikey = schema.apikeyTable;

/** Deletes one API key (when `keyId` is set) or every key of a user. */
export async function revokeUserApiKeys(
  request: AdminAuditRequest,
  userId: string,
  keyId?: string,
) {
  const result = await db.transaction(async (tx) => {
    const target = await findTargetUser(userId, tx);
    const revoked = await tx
      .delete(apikey)
      .where(
        keyId
          ? and(eq(apikey.referenceId, target.id), eq(apikey.id, keyId))
          : eq(apikey.referenceId, target.id),
      )
      .returning({ id: apikey.id, name: apikey.name, start: apikey.start });

    if (keyId && revoked.length === 0) {
      throw new HTTPException(404, { message: "API key not found" });
    }

    // Metadata keys avoid "key"/"apiKey" names, which the sanitizer drops.
    const [single] = revoked;
    await recordAdminAction(
      request,
      {
        action: keyId ? "user.api_key_revoked" : "user.api_keys_revoked",
        targetType: "user",
        targetId: target.id,
        targetLabel: target.email,
        metadata:
          keyId && single
            ? { keyId: single.id, keyName: single.name, keyStart: single.start }
            : { count: revoked.length },
      },
      tx,
    );

    return { revoked: revoked.length, keyIds: revoked.map((r) => r.id) };
  });
  await closeSocketsForApiKey(result.keyIds);
  return { revoked: result.revoked };
}

export default revokeUserApiKeys;
