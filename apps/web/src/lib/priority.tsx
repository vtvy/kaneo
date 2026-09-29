import {
  ChevronDown,
  ChevronsUp,
  ChevronUp,
  CircleAlert,
  Minus,
} from "lucide-react";

export function getPriorityIcon(priority: string) {
  switch (priority) {
    case "urgent":
      return (
        <CircleAlert className="h-[12px] w-[12px] text-destructive-foreground" />
      );
    case "high":
      return (
        <ChevronsUp className="h-[12px] w-[12px] text-warning-foreground" />
      );
    case "medium":
      return (
        <ChevronUp className="h-[12px] w-[12px] text-warning-foreground/80" />
      );
    case "low":
      return (
        <ChevronDown className="h-[12px] w-[12px] text-info-foreground/85" />
      );
    case "no-priority":
      return <Minus className="h-[12px] w-[12px] text-muted-foreground" />;
    default:
      return <Minus className="h-[12px] w-[12px] text-muted-foreground" />;
  }
}

/**
 * Tailwind classes for a tinted priority badge (background + readable text +
 * border). Fixed map: Urgent=red, High=orange, Medium=amber, Low=blue,
 * No priority=gray. Use alongside {@link getPriorityIcon} for the icon.
 */
export function getPriorityBadgeColor(priority: string): string {
  switch (priority) {
    case "urgent":
      return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
    case "high":
      return "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300";
    case "medium":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "low":
      return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
    default:
      return "border-border/70 bg-muted/55 text-muted-foreground";
  }
}
