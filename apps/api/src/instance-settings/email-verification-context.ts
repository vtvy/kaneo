import { count, eq } from "drizzle-orm";
import db from "../database";
import { userTable } from "../database/schema";
import { getInstanceSettings } from "./get-instance-settings";

type AuthRequest = { path: string; body?: { email?: unknown } | null };

async function signInNeedsVerification(email: unknown) {
  if (typeof email !== "string") return false;
  const [user] = await db
    .select({ verified: userTable.emailVerified })
    .from(userTable)
    .where(eq(userTable.email, email.trim().toLowerCase()))
    .limit(1);
  return Boolean(user && !user.verified);
}

async function hasUsers() {
  const [row] = await db.select({ value: count() }).from(userTable);
  return (row?.value ?? 0) > 0;
}

/**
 * Better Auth reads `emailAndPassword.requireEmailVerification` once at
 * startup, so the database toggle is applied per request instead: a `before`
 * hook returning this context turns verification on for this sign-up or
 * sign-in only (the emailOTP plugin already supplies the code email). The
 * first account sets the instance up and is never held back.
 */
export async function emailVerificationContext(ctx: AuthRequest) {
  if (ctx.path !== "/sign-up/email" && ctx.path !== "/sign-in/email") {
    return undefined;
  }
  if (!(await getInstanceSettings()).requireEmailVerification) {
    return undefined;
  }
  const required =
    ctx.path === "/sign-up/email"
      ? await hasUsers()
      : await signInNeedsVerification(ctx.body?.email);
  if (!required) return undefined;
  return {
    context: {
      context: {
        options: {
          emailAndPassword: { requireEmailVerification: true },
          emailVerification: { sendOnSignUp: true, sendOnSignIn: true },
        },
      },
    },
  };
}
