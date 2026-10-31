import Mention from "@tiptap/extension-mention";
import { ReactRenderer } from "@tiptap/react";
import { filterMentionMembers } from "@/lib/mention-members";
import MentionList, {
  type MentionListRef,
  type MentionMember,
} from "./mention-list";

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Markdown form of an @mention. The API parses mentioned user ids from this
 * tag (apps/api/src/utils/parse-mentions.ts) to send notifications.
 */
export function serializeMention(id: string, label: string) {
  if (!id) return `@${label}`;
  return `<kaneo-mention id="${escapeAttribute(id)}" label="${escapeAttribute(label)}"></kaneo-mention>`;
}

type KaneoMentionOptions = {
  /** Members to suggest; `undefined` disables the @ suggestion popup. */
  getMembers: () => MentionMember[] | undefined;
  /** Called when the suggestion popup opens or closes. */
  onActiveChange?: (active: boolean) => void;
};

/**
 * Inline @mention chip built on @tiptap/extension-mention. It round-trips
 * through Markdown as `<kaneo-mention id label></kaneo-mention>` (parsed back
 * via parseHTML), so mentions survive storage and render as chips when the
 * comment is displayed.
 */
export function createKaneoMention({
  getMembers,
  onActiveChange,
}: KaneoMentionOptions) {
  return Mention.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        id: {
          default: null,
          parseHTML: (element) =>
            element.getAttribute("data-id") || element.getAttribute("id"),
          renderHTML: (attributes) =>
            attributes.id ? { "data-id": attributes.id } : {},
        },
        label: {
          default: null,
          parseHTML: (element) =>
            element.getAttribute("data-label") || element.getAttribute("label"),
          renderHTML: (attributes) =>
            attributes.label ? { "data-label": attributes.label } : {},
        },
      };
    },

    parseHTML() {
      return [{ tag: "kaneo-mention[id]" }, ...(this.parent?.() ?? [])];
    },

    // Disable the default `[@ id="…"]` shortcode syntax so typed text is never
    // turned into a mention; mentions are stored as <kaneo-mention> HTML.
    markdownTokenizer: {
      name: "mention",
      level: "inline",
      start: () => -1,
      tokenize: () => undefined,
    },

    renderMarkdown(node) {
      const id = String(node.attrs?.id ?? "");
      const label = String(node.attrs?.label ?? "");
      return serializeMention(id, label);
    },
  }).configure({
    HTMLAttributes: { class: "kaneo-mention" },
    suggestion: {
      char: "@",
      allow: ({ state, range }) => {
        if (!getMembers()) return false;
        const type = state.schema.nodes.mention;
        if (!type) return false;
        const $from = state.doc.resolve(range.from);
        return Boolean($from.parent.type.contentMatch.matchType(type));
      },
      items: ({ query }) => filterMentionMembers(getMembers() ?? [], query),
      floatingUi: { strategy: "fixed" },
      render: () => {
        let component: ReactRenderer<MentionListRef> | null = null;
        let unmount: (() => void) | null = null;

        const listProps = (props: {
          items: unknown[];
          loading?: boolean;
          command: (attrs: { id: string; label: string }) => void;
        }) => ({
          items: props.items as MentionMember[],
          loading: props.loading,
          command: (item: MentionMember) =>
            props.command({ id: item.id, label: item.label }),
        });

        return {
          onStart: (props) => {
            onActiveChange?.(true);
            component = new ReactRenderer(MentionList, {
              props: listProps(props),
              editor: props.editor,
            });
            const popup = document.createElement("div");
            popup.className = "kaneo-mention-popup";
            popup.appendChild(component.element);
            unmount = props.mount(popup);
          },
          onUpdate: (props) => {
            component?.updateProps(listProps(props));
          },
          onKeyDown: (props) => {
            // Escape is handled by the suggestion plugin (it exits the popup).
            if (props.event.key === "Escape") return true;
            return component?.ref?.onKeyDown(props) ?? false;
          },
          onExit: () => {
            onActiveChange?.(false);
            unmount?.();
            unmount = null;
            component?.destroy();
            component = null;
          },
        };
      },
    },
  });
}
