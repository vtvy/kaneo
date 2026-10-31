import { describe, expect, it } from "vitest";
import { parseMentionIds } from "../../../apps/api/src/utils/parse-mentions";

describe("parseMentionIds", () => {
  it("returns an empty array for empty input", () => {
    expect(parseMentionIds(undefined)).toEqual([]);
    expect(parseMentionIds(null)).toEqual([]);
    expect(parseMentionIds("")).toEqual([]);
    expect(parseMentionIds("no mentions here")).toEqual([]);
  });

  it("extracts ids from serialized mention nodes", () => {
    const content =
      'Hey <kaneo-mention id="user-a" label="Alice"></kaneo-mention> and <kaneo-mention id="user-b" label="Bob"></kaneo-mention>!';
    expect(parseMentionIds(content)).toEqual(["user-a", "user-b"]);
  });

  it("dedupes ids and keeps first-occurrence order", () => {
    const content = [
      '<kaneo-mention id="c" label="C"></kaneo-mention>',
      '<kaneo-mention id="a" label="A"></kaneo-mention>',
      '<kaneo-mention id="c" label="C"></kaneo-mention>',
    ].join(" ");
    expect(parseMentionIds(content)).toEqual(["c", "a"]);
  });

  it("accepts attributes in any order and single quotes", () => {
    expect(
      parseMentionIds("<kaneo-mention label='Al' id='user-a'></kaneo-mention>"),
    ).toEqual(["user-a"]);
  });

  it("does not treat data-id or other attributes as the id", () => {
    expect(
      parseMentionIds(
        '<kaneo-mention data-id="evil" label="x"></kaneo-mention>',
      ),
    ).toEqual([]);
  });

  it("decodes escaped attribute values", () => {
    expect(
      parseMentionIds(
        '<kaneo-mention id="a&amp;b" label="&quot;Q&quot;"></kaneo-mention>',
      ),
    ).toEqual(["a&b"]);
  });

  it("ignores plain @name text and other tags", () => {
    expect(
      parseMentionIds('@alice <span id="user-a">x</span> <kaneo-mentioned>'),
    ).toEqual([]);
  });

  it("ignores mentions inside inline code and fenced code blocks", () => {
    const content = [
      'Inline `<kaneo-mention id="in-code" label="x"></kaneo-mention>` text',
      "```",
      '<kaneo-mention id="in-fence" label="y"></kaneo-mention>',
      "```",
      '<kaneo-mention id="real" label="z"></kaneo-mention>',
    ].join("\n");
    expect(parseMentionIds(content)).toEqual(["real"]);
  });
});
