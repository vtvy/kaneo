import { beforeEach, describe, expect, it, vi } from "vitest";

const publicFetch = vi.fn();

vi.mock("../../../../apps/api/src/utils/public-fetch", () => ({
  publicFetch: (...args: unknown[]) => publicFetch(...args),
}));

vi.mock("../../../../apps/api/src/utils/assert-public-destination", () => ({
  assertPublicDestination: vi.fn(async () => {}),
}));

const { GiteaApiError, giteaFetch } = await import(
  "../../../../apps/api/src/plugins/gitea/utils/gitea-api"
);

describe("giteaFetch errors", () => {
  beforeEach(() => {
    publicFetch.mockReset();
  });

  it("keeps the message generic and caps the upstream body", async () => {
    const upstreamBody = `<html>${"secret internal detail ".repeat(100)}</html>`;
    publicFetch.mockResolvedValue(new Response(upstreamBody, { status: 502 }));

    const error = await giteaFetch(
      "https://gitea.example",
      "token",
      "/user",
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(GiteaApiError);
    const giteaError = error as InstanceType<typeof GiteaApiError>;
    expect(giteaError.status).toBe(502);
    expect(giteaError.message).toBe("Gitea API error 502");
    expect(giteaError.message).not.toContain("secret");
    expect(giteaError.body?.length).toBeLessThanOrEqual(201);
  });

  it("caps the body on directly constructed errors", () => {
    const error = new GiteaApiError(
      "Gitea API error 500",
      500,
      "x".repeat(5000),
    );
    expect(error.body?.length).toBeLessThanOrEqual(201);
    expect(new GiteaApiError("nope", 500).body).toBeUndefined();
  });
});
