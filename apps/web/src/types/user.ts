import type { User as BetterAuthUser } from "better-auth/types";

export type User = BetterAuthUser & {
  role?: string | null;
  locale?: string | null;
};
