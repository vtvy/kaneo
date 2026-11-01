import { Effect, Result } from "effect";
import { describe, expect, it } from "vitest";
import { createExternalLink, deleteExternalLink } from "./external-links.js";

describe("external link writes", () => {
  it("refuses to attach a link this server cannot store", async () => {
    const result = await Effect.runPromise(
      Effect.result(
        createExternalLink("t1", { url: "https://example.com/spec" }),
      ),
    );
    expect(Result.isFailure(result) && result.failure).toMatchObject({
      _tag: "InvalidArgument",
      message: "This server cannot attach a link to a task.",
    });
  });

  it("refuses to remove a link this server cannot delete", async () => {
    const result = await Effect.runPromise(
      Effect.result(deleteExternalLink("t1", "link1")),
    );
    expect(Result.isFailure(result) && result.failure).toMatchObject({
      _tag: "InvalidArgument",
      message: "This server cannot remove a task link.",
    });
  });
});
