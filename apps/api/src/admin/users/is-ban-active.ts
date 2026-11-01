type BanState = {
  banned: boolean | null;
  banExpires: Date | null;
};

/** A ban with a past expiry no longer applies. */
export function isBanActive(user: BanState, now = new Date()): boolean {
  if (!user.banned) return false;
  return !user.banExpires || user.banExpires.getTime() > now.getTime();
}
