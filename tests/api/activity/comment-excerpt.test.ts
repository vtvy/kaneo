import { describe, expect, it } from "vitest";
import { commentExcerpt } from "../../../apps/api/src/activity/comment-excerpt";

describe("commentExcerpt", () => {
  it("keeps short plain text as it is", () => {
    expect(commentExcerpt("Looks good to me")).toBe("Looks good to me");
  });

  it("drops editor tags and keeps the text inside them", () => {
    expect(
      commentExcerpt(
        'Thanks <kaneo-mention id="user-1">@Mira</kaneo-mention>,\n\nshipping today',
      ),
    ).toBe("Thanks @Mira , shipping today");
  });

  it("removes images and keeps link text", () => {
    expect(
      commentExcerpt(
        "See ![shot](https://x.test/a.png) and [the docs](https://x.test)",
      ),
    ).toBe("See and the docs");
  });

  it("truncates long comments", () => {
    const excerpt = commentExcerpt("a".repeat(500));
    expect(excerpt).toHaveLength(241);
    expect(excerpt?.endsWith("…")).toBe(true);
  });

  it("returns null when nothing readable is left", () => {
    expect(commentExcerpt(null)).toBeNull();
    expect(commentExcerpt("![only](https://x.test/a.png)")).toBeNull();
  });
});
