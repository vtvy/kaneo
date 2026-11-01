import { cn } from "@/lib/cn";

const MARKS = [3, 7, 11];

const LEVELS: Record<string, { filled: number; tone: string }> = {
  low: { filled: 1, tone: "fill-sky-500 stroke-sky-500" },
  medium: { filled: 2, tone: "fill-amber-500 stroke-amber-500" },
  high: { filled: 3, tone: "fill-orange-500 stroke-orange-500" },
  urgent: { filled: 3, tone: "fill-red-500 stroke-red-500" },
};

type PriorityMarksProps = {
  priority: string | null | undefined;
  className?: string;
};

export function PriorityMarks({ priority, className }: PriorityMarksProps) {
  const { filled, tone } = LEVELS[priority ?? ""] ?? { filled: 0, tone: "" };

  return (
    <svg
      viewBox="0 0 14 14"
      aria-hidden="true"
      className={cn("size-3.5 shrink-0", className)}
    >
      {MARKS.map((x, index) => (
        <path
          key={x}
          d={`M${x} 2.5v5.5`}
          fill="none"
          strokeWidth="1.7"
          strokeLinecap="round"
          className={
            index < filled
              ? tone
              : "fill-muted-foreground/30 stroke-muted-foreground/30"
          }
        />
      ))}
      {MARKS.map((x, index) => (
        <circle
          key={`${x}-dot`}
          cx={x}
          cy="11"
          r="1"
          stroke="none"
          className={
            index < filled ? tone : "fill-muted-foreground/30 stroke-none"
          }
        />
      ))}
    </svg>
  );
}
