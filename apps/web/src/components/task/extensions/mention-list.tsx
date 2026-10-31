import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

export type MentionMember = {
  id: string;
  label: string;
  image?: string | null;
};

export type MentionListRef = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
};

type MentionListProps = {
  items: MentionMember[];
  loading?: boolean;
  command: (item: MentionMember) => void;
};

const MentionList = forwardRef<MentionListRef, MentionListProps>(
  ({ items, loading = false, command }, ref) => {
    const { t } = useTranslation();
    const [selected, setSelected] = useState(0);

    // biome-ignore lint/correctness/useExhaustiveDependencies: reset selection when the result list changes
    useEffect(() => setSelected(0), [items]);

    const select = (index: number) => {
      const item = items[index];
      if (item) command(item);
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (items.length === 0) return false;
        if (event.key === "ArrowUp") {
          setSelected((s) => (s + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelected((s) => (s + 1) % items.length);
          return true;
        }
        if (event.key === "Enter" || event.key === "Tab") {
          select(selected);
          return true;
        }
        return false;
      },
    }));

    if (loading && items.length === 0) return null;

    return (
      <div className="kaneo-mention-list" role="listbox">
        {items.length === 0 ? (
          <div className="kaneo-tiptap-slash-empty">
            {t("activity:comment.editor.mentionEmpty")}
          </div>
        ) : (
          items.map((item, index) => (
            <button
              type="button"
              role="option"
              aria-selected={index === selected}
              key={item.id}
              className={cn(
                "kaneo-mention-item",
                index === selected && "is-active",
              )}
              onMouseDown={(event) => {
                event.preventDefault();
                select(index);
              }}
              onMouseEnter={() => setSelected(index)}
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={item.image ?? ""} alt={item.label} />
                <AvatarFallback className="text-[9px] font-medium">
                  {item.label.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{item.label}</span>
            </button>
          ))
        )}
      </div>
    );
  },
);

MentionList.displayName = "MentionList";

export default MentionList;
