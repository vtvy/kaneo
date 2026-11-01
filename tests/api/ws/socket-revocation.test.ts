import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../apps/api/src/events", () => ({
  subscribeToEvent: vi.fn(),
  publishEvent: vi.fn(),
}));

import { InMemoryBroadcastAdapter } from "../../../apps/api/src/ws/in-memory-broadcast-adapter";
import {
  addConnection,
  closeSocketsForApiKey,
  closeSocketsForSession,
  closeSocketsForUser,
  initializeWebSocketAdapter,
  removeConnection,
  shutdownWebSocketAdapter,
} from "../../../apps/api/src/ws/index";
import {
  applyRevocation,
  REVOKED_CLOSE_CODE,
  type RevocableConnection,
  revocationMatches,
} from "../../../apps/api/src/ws/socket-revocation";

function fakeWs() {
  return {
    send: vi.fn(),
    close: vi.fn(),
  } as unknown as RevocableConnection["ws"] & {
    close: ReturnType<typeof vi.fn>;
  };
}

function conn(
  partial: Partial<RevocableConnection> & { userId: string },
): RevocableConnection {
  return { ws: fakeWs(), ...partial };
}

describe("revocationMatches", () => {
  const cookie = conn({ userId: "u1", sessionId: "s1" });
  const keyed = conn({ userId: "u1", apiKeyId: "k1" });
  // Better Auth x-api-key sessions carry the key id as the session id.
  const keySession = conn({ userId: "u1", sessionId: "k2" });

  it("targets only the revoked session", () => {
    const r = { kind: "sessions", sessionIds: ["s1"] } as const;
    expect(revocationMatches(cookie, r)).toBe(true);
    expect(revocationMatches(keyed, r)).toBe(false);
    expect(revocationMatches(conn({ userId: "u1", sessionId: "s9" }), r)).toBe(
      false,
    );
  });

  it("targets API key sockets by key id or key-backed session id", () => {
    expect(
      revocationMatches(keyed, { kind: "apiKeys", apiKeyIds: ["k1"] }),
    ).toBe(true);
    expect(
      revocationMatches(keySession, { kind: "apiKeys", apiKeyIds: ["k2"] }),
    ).toBe(true);
    expect(
      revocationMatches(cookie, { kind: "apiKeys", apiKeyIds: ["k1"] }),
    ).toBe(false);
  });

  it("targets every socket of a user", () => {
    const r = { kind: "user", userId: "u1" } as const;
    expect(revocationMatches(cookie, r)).toBe(true);
    expect(revocationMatches(keyed, r)).toBe(true);
    expect(revocationMatches(conn({ userId: "u2" }), r)).toBe(false);
  });
});

describe("applyRevocation", () => {
  it("closes and unregisters only matching sockets", async () => {
    const a = conn({ userId: "u1", sessionId: "s1" });
    const b = conn({ userId: "u1", sessionId: "s2" });
    const c = conn({ userId: "u2", sessionId: "s3" });
    const map = new Map([
      ["p1", new Set([a, b])],
      ["p2", new Set([a, c])],
    ]);

    const closed = await applyRevocation(map, {
      kind: "sessions",
      sessionIds: ["s1"],
    });

    expect(closed).toBe(2);
    expect(a.ws.close).toHaveBeenCalledWith(
      REVOKED_CLOSE_CODE,
      "Session revoked",
    );
    expect(b.ws.close).not.toHaveBeenCalled();
    expect(c.ws.close).not.toHaveBeenCalled();
    expect([...(map.get("p1") ?? [])]).toEqual([b]);
    expect([...(map.get("p2") ?? [])]).toEqual([c]);
  });

  it("drops empty project entries", async () => {
    const a = conn({ userId: "u1" });
    const map = new Map([["p1", new Set([a])]]);
    await applyRevocation(map, { kind: "user", userId: "u1" });
    expect(map.has("p1")).toBe(false);
  });

  it("re-checks access only within the requested scope", async () => {
    const inWs = conn({ userId: "u1", workspaceId: "w1" });
    const otherWs = conn({ userId: "u1", workspaceId: "w2" });
    const otherUser = conn({ userId: "u2", workspaceId: "w1" });
    const map = new Map([
      ["p1", new Set([inWs, otherUser])],
      ["p2", new Set([otherWs])],
    ]);
    const stillAllowed = vi.fn(async () => false);

    const closed = await applyRevocation(
      map,
      { kind: "access", userId: "u1", workspaceId: "w1" },
      stillAllowed,
    );

    expect(closed).toBe(1);
    expect(stillAllowed).toHaveBeenCalledTimes(1);
    expect(stillAllowed).toHaveBeenCalledWith(inWs, "p1");
    expect(inWs.ws.close).toHaveBeenCalled();
    expect(otherWs.ws.close).not.toHaveBeenCalled();
    expect(otherUser.ws.close).not.toHaveBeenCalled();
  });

  it("keeps sockets that still have access", async () => {
    const a = conn({ userId: "u1" });
    const map = new Map([["p1", new Set([a])]]);
    const closed = await applyRevocation(
      map,
      { kind: "access", userId: "u1", projectId: "p1" },
      async () => true,
    );
    expect(closed).toBe(0);
    expect(a.ws.close).not.toHaveBeenCalled();
  });
});

describe("close helpers", () => {
  beforeEach(async () => {
    delete process.env.REDIS_URL;
    await initializeWebSocketAdapter();
  });
  afterEach(async () => {
    await shutdownWebSocketAdapter();
  });

  it("close the registered sockets of a session, API key, or user", async () => {
    const ws1 = fakeWs();
    const ws2 = fakeWs();
    const ws3 = fakeWs();
    const c1 = addConnection("proj-r", ws1, "u1", "u1", { sessionId: "s1" });
    const c2 = addConnection("proj-r", ws2, "u1", "u1:w", { apiKeyId: "k1" });
    const c3 = addConnection("proj-r", ws3, "u2", "u2", { sessionId: "s3" });

    await closeSocketsForSession("s1");
    expect(ws1.close).toHaveBeenCalledWith(1008, "Session revoked");
    expect(ws2.close).not.toHaveBeenCalled();

    await closeSocketsForApiKey(["k1"]);
    expect(ws2.close).toHaveBeenCalledWith(1008, "API key revoked");

    await closeSocketsForUser("u2");
    expect(ws3.close).toHaveBeenCalledWith(1008, "Access revoked");

    for (const c of [c1, c2, c3]) removeConnection("proj-r", c);
  });

  it("publish the revocation so other instances close their sockets", async () => {
    const publish = vi.spyOn(
      InMemoryBroadcastAdapter.prototype,
      "publishRevocation",
    );
    await closeSocketsForSession(["s7", "s8"]);
    expect(publish).toHaveBeenCalledWith({
      kind: "sessions",
      sessionIds: ["s7", "s8"],
    });
    await closeSocketsForSession([]);
    expect(publish).toHaveBeenCalledTimes(1);
    publish.mockRestore();
  });

  it("apply revocations received from another instance", async () => {
    await shutdownWebSocketAdapter();
    const subscribe = vi.spyOn(
      InMemoryBroadcastAdapter.prototype,
      "subscribeRevocation",
    );
    await initializeWebSocketAdapter();
    const handler = subscribe.mock.calls[0]?.[0];
    expect(handler).toBeTypeOf("function");

    const ws = fakeWs();
    addConnection("proj-x", ws, "u9", "u9", { sessionId: "s9" });
    handler?.({ kind: "sessions", sessionIds: ["s9"] });
    await vi.waitFor(() =>
      expect(ws.close).toHaveBeenCalledWith(1008, "Session revoked"),
    );
    subscribe.mockRestore();
  });
});
