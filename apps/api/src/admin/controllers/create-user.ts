import { APIError } from "better-auth/api";
import { HTTPException } from "hono/http-exception";
import { auth } from "../../auth";
import getSettings from "../../utils/get-settings";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { getInstanceAccess } from "../roles/get-instance-access";

export type CreateUserInput = {
  name: string;
  email: string;
  password?: string;
  role: "admin" | "user";
  sendSetupEmail: boolean;
};

// Typed locally: consumers that typecheck this file without the admin
// plugin's inferred endpoints (the web app via AppType) still compile.
type AdminCreateUser = (input: {
  body: { email: string; name: string; password?: string; role: string };
}) => Promise<{ user: { id: string; email: string; name: string } }>;

const adminCreateUser = (input: Parameters<AdminCreateUser>[0]) =>
  (auth.api as unknown as { createUser: AdminCreateUser }).createUser(input);

const clientUrl = (
  process.env.KANEO_CLIENT_URL || "http://localhost:5173"
).replace(/\/$/, "");

/**
 * Creates the account through the Better Auth admin plugin (server-side call,
 * so the password is hashed the same way as sign-up). Without a password the
 * user signs in with SSO or a magic link, or, when SMTP is configured, is
 * emailed a password reset link that doubles as account setup.
 */
export async function createUser(
  request: AdminAuditRequest,
  input: CreateUserInput,
) {
  if (
    input.role === "admin" &&
    !(await getInstanceAccess(request.actorUserId)).isAdmin
  ) {
    throw new HTTPException(403, {
      message: "Only built-in administrators can create administrators",
    });
  }
  const email = input.email.trim().toLowerCase();
  let created: { id: string; email: string; name: string };
  try {
    const result = await adminCreateUser({
      body: {
        email,
        name: input.name.trim(),
        password: input.password || undefined,
        role: input.role,
      },
    });
    created = result.user;
  } catch (error) {
    if (error instanceof APIError) {
      const status = error.message.toLowerCase().includes("already exists")
        ? 409
        : 400;
      throw new HTTPException(status, { message: error.message });
    }
    throw error;
  }

  const setupEmailSent =
    !input.password && input.sendSetupEmail && getSettings().hasSmtp;
  if (setupEmailSent) {
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: `${clientUrl}/auth/reset-password` },
    });
  }

  const signInMethod = input.password
    ? "password"
    : setupEmailSent
      ? "setup_email"
      : "external";

  await recordAdminAction(request, {
    action: "user.created",
    targetType: "user",
    targetId: created.id,
    targetLabel: created.email,
    metadata: { name: created.name, role: input.role, signInMethod },
  });

  return {
    id: created.id,
    name: created.name,
    email: created.email,
    role: input.role,
    setupEmailSent,
  };
}

export default createUser;
