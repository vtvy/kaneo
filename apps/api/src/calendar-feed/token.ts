import { createHash, randomBytes } from "node:crypto";

// 256 bits of randomness, hex encoded. Only the SHA-256 digest is persisted,
// so a database leak does not expose working feed links.
export const CALENDAR_FEED_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export function generateCalendarFeedToken() {
  return randomBytes(32).toString("hex");
}

export function hashCalendarFeedToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
