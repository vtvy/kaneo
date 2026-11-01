import { afterEach, describe, expect, it } from "vitest";
import { publicFetch } from "../../../apps/api/src/utils/public-fetch";

describe("publicFetch", () => {
  const original = process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS;
    } else {
      process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS = original;
    }
  });

  it("refuses to connect when the hostname resolves to a private address", async () => {
    delete process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS;

    await expect(publicFetch("http://localhost:8999/")).rejects.toThrow();
  });

  it("checks the address at connect time, not just before the request", async () => {
    delete process.env.KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS;

    const error = await publicFetch("http://localhost:8999/").catch(
      (caught: unknown) => caught,
    );
    const cause = (error as { cause?: Error }).cause;
    expect(cause?.message).toContain("non-routable");
  });
});
