import type { Editor, JSONContent } from "@tiptap/core";
import type { EditorView } from "@tiptap/pm/view";

type EditorElement = HTMLElement & { editor?: Editor };

function hasFormatting(nodes: JSONContent[] | undefined): boolean {
  return (nodes ?? []).some(
    (node) =>
      (node.type !== "paragraph" && node.type !== "text") ||
      Boolean(node.marks?.length) ||
      hasFormatting(node.content),
  );
}

export function pasteMarkdown(
  view: EditorView,
  event: ClipboardEvent,
): boolean {
  // useEditor callbacks can retain a destroyed instance after recreation.
  const editor = (view.dom as EditorElement).editor;
  const clipboard = event.clipboardData;
  if (
    !editor ||
    !editor.isEditable ||
    !clipboard ||
    clipboard.getData("text/html") ||
    editor.isActive("codeBlock") ||
    editor.isActive("code")
  ) {
    return false;
  }
  const text = clipboard.getData("text/plain");
  if (!text || !editor.markdown) return false;
  // Leave single URLs to the issue-link and video-embed paste handlers.
  if (/^https?:\/\/\S+$/i.test(text.trim())) return false;
  const document = editor.markdown.parse(text);
  const soleParagraph =
    document.content?.length === 1 && document.content[0].type === "paragraph"
      ? document.content[0]
      : undefined;
  const soleInline =
    soleParagraph?.content?.length === 1 ? soleParagraph.content[0] : undefined;
  // GFM autolinks such as www.youtube.com must reach specialized URL handlers.
  if (
    soleInline?.text === text.trim() &&
    soleInline.marks?.some((mark) => mark.type === "link")
  ) {
    return false;
  }
  if (!hasFormatting(document.content)) return false;
  event.preventDefault();
  editor.commands.insertContent(
    soleParagraph?.content ?? document.content ?? [],
  );
  return true;
}
