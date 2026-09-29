import { X } from "lucide-react";
import type { ReactNode } from "react";

type ActiveFilterChipProps = {
  subject: string;
  operator?: string;
  value?: ReactNode;
  onClear: () => void;
};

export default function ActiveFilterChip({
  subject,
  operator,
  value,
  onClear,
}: ActiveFilterChipProps) {
  const hasOperator = Boolean(operator);
  const hasValue = value !== undefined && value !== null && value !== "";

  return (
    <div className="inline-flex h-7 items-center rounded-md border border-border bg-background text-xs shadow-xs">
      <span className="px-2 font-medium text-foreground">{subject}</span>
      {hasOperator ? (
        <>
          <span className="h-full w-px bg-border" />
          <span className="px-2 text-foreground/80">{operator}</span>
        </>
      ) : null}
      {hasValue ? (
        <>
          <span className="h-full w-px bg-border" />
          <span className="flex px-2 text-foreground">{value}</span>
        </>
      ) : null}
      <span className="h-full w-px bg-border" />
      <button
        className="inline-flex h-full w-7 items-center justify-center rounded-r-md text-foreground/70 hover:bg-accent/70 hover:text-foreground"
        onClick={onClear}
        type="button"
        aria-label={`Clear ${subject} filter`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
