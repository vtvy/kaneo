import { beforeEach, describe, expect, it, vi } from "vitest";

const publicFetch = vi.fn();

vi.mock("../../../../apps/api/src/utils/public-fetch", () => ({
  publicFetch: (...args: unknown[]) => publicFetch(...args),
}));

vi.mock("../../../../apps/api/src/utils/assert-public-destination", () => ({
  assertPublicDestination: vi.fn(async () => {}),
}));

const { postToGenericWebhook } = await import(
  "../../../../apps/api/src/plugins/generic-webhook/client"
);

describe("postToGenericWebhook", () => {
  beforeEach(() => {
    publicFetch.mockReset();
  });

  it("reports the status without echoing the receiver's response body", async () => {
    publicFetch.mockResolvedValue(
      new Response("internal stack trace and secrets", { status: 500 }),
    );

    await expect(
      postToGenericWebhook("https://hooks.example/x", { event: "test" }),
    ).rejects.toThrow(/^Generic webhook request failed \(500\)$/);
  });
});
