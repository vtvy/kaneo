import { client } from "@kaneo/libs";

/** Revokes one session when `sessionId` is given, otherwise all of them. */
async function revokeAdminUserSessions(userId: string, sessionId?: string) {
  const response = sessionId
    ? await client.admin.users[":userId"].sessions[":sessionId"].$delete({
        param: { userId, sessionId },
      })
    : await client.admin.users[":userId"].sessions.$delete({
        param: { userId },
      });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default revokeAdminUserSessions;
