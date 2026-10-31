import { Editor } from "@tiptap/core";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";
import { afterEach, describe, expect, it } from "vitest";
import { createKaneoMention, serializeMention } from "./kaneo-mention";

let editor: Editor | null = null;

function createEditor(content: string) {
  editor = new Editor({
    extensions: [
      StarterKit,
      Markdown,
      createKaneoMention({ getMembers: () => undefined }),
    ],
    content,
    contentType: "markdown",
  });
  return editor;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("serializeMention", () => {
  it("writes a kaneo-mention tag with escaped attributes", () => {
    expect(serializeMention("user-1", 'A "B" <C>')).toBe(
      '<kaneo-mention id="user-1" label="A &quot;B&quot; &lt;C&gt;"></kaneo-mention>',
    );
  });

  it("degrades to plain text without an id", () => {
    expect(serializeMention("", "Ann")).toBe("@Ann");
  });
});

describe("KaneoMention markdown round-trip", () => {
  it("parses a stored mention into a mention node and serializes it back", () => {
    const markdown = `Hi ${serializeMention("user-1", "Ann Lee")} there`;
    const instance = createEditor(markdown);

    const mentions: Array<Record<string, unknown>> = [];
    instance.state.doc.descendants((node) => {
      if (node.type.name === "mention") mentions.push(node.attrs);
    });
    expect(mentions).toHaveLength(1);
    expect(mentions[0]).toMatchObject({ id: "user-1", label: "Ann Lee" });
    expect(instance.getText()).toContain("@Ann Lee");
    expect(instance.getMarkdown()).toContain(
      '<kaneo-mention id="user-1" label="Ann Lee"></kaneo-mention>',
    );
  });

  it("does not turn typed shortcode text into a mention", () => {
    const instance = createEditor('[@ id="user-1" label="Ann"]');
    let found = false;
    instance.state.doc.descendants((node) => {
      if (node.type.name === "mention") found = true;
    });
    expect(found).toBe(false);
  });
});
