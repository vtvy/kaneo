import { timingSafeEqual } from "node:crypto";

/**
 * GitLab sends the shared secret back in the X-GitLab-Token header instead of
 * signing the body, so the check is a timing-safe comparison of the token.
 */
export function verifyGitlabWebhookToken(
  secret: string,
  tokenHeader: string | undefined,
): boolean {
  if (!tokenHeader || !secret) {
    return false;
  }

  const provided = Buffer.from(tokenHeader.trim(), "utf8");
  const expected = Buffer.from(secret.trim(), "utf8");

  if (provided.length === 0 || provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
}
