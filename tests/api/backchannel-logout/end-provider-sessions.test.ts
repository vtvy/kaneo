import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const rows = {
    claimed: [] as Array<{ id: string }>,
    accounts: [] as Array<{ userId: string }>,
    ended: [] as Array<{ id: string; userId: string }>,
  };
  const tx = {
    insert: vi.fn(() => ({
      values: () => ({
        onConflictDoNothing: () => ({ returning: async () => rows.claimed }),
      }),
    })),
    select: vi.fn(() => ({
      from: () => ({ where: async () => rows.accounts }),
    })),
    delete: vi.fn(() => ({
      where: () => ({ returning: async () => rows.ended }),
    })),
  };
  const db = {
    transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  return { rows, tx, db };
});

vi.mock("../../../apps/api/src/database", async () => ({
  default: mocks.db,
  schema: await import("../../../apps/api/src/database/schema"),
}));

import { endProviderSessions } from "../../../apps/api/src/backchannel-logout/controllers/end-provider-sessions";
import { LogoutTokenRejected } from "../../../apps/api/src/backchannel-logout/errors";

const TOKEN = {
  iss: "https://idp.example.com/realms/kaneo",
  jti: "logout-1",
  iat: 1_792_315_200,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rows.claimed = [{ id: "claim" }];
  mocks.rows.accounts = [{ userId: "user-1" }];
  mocks.rows.ended = [{ id: "session-1", userId: "user-1" }];
});

describe("endProviderSessions", () => {
  it("refuses a logout without a session ID or subject", async () => {
    await expect(endProviderSessions(TOKEN)).rejects.toThrow(
      "A logout needs a session ID or a subject",
    );
    expect(mocks.db.transaction).not.toHaveBeenCalled();
  });

  it("returns the sessions it ended", async () => {
    await expect(
      endProviderSessions({ ...TOKEN, sid: "kc-session-1" }),
    ).resolves.toEqual([{ id: "session-1", userId: "user-1" }]);
  });

  it("rejects a replayed jti and ends nothing", async () => {
    mocks.rows.claimed = [];

    await expect(
      endProviderSessions({ ...TOKEN, sid: "kc-session-1" }),
    ).rejects.toBeInstanceOf(LogoutTokenRejected);
    expect(mocks.tx.delete).not.toHaveBeenCalled();
  });

  it("ends nothing for a subject without a custom provider account", async () => {
    mocks.rows.accounts = [];

    await expect(
      endProviderSessions({ ...TOKEN, sub: "kc-user-9" }),
    ).resolves.toEqual([]);
    expect(mocks.tx.delete).not.toHaveBeenCalled();
  });
});
