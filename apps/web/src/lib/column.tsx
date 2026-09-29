import { CheckCircle2, Circle } from "lucide-react";
import columnIcons, {
  DEFAULT_COLUMN_ICON_NAMES,
} from "@/constants/column-icons";
import labelColors from "@/constants/label-colors";

// Neutral fallback when a column has no color set.
export const COLUMN_FALLBACK_COLOR = "var(--color-neutral-400)";

function isValidHtmlColor(color: string): boolean {
  const s = new Option().style;
  s.color = color;
  return s.color !== "";
}

/**
 * Resolve a column/status color (a label-palette `value` such as "red", or a
 * raw CSS color) into a concrete CSS color string. Mirrors the label chip
 * resolution so columns reuse the same palette. Falls back to a neutral color
 * when the value is null/unknown.
 */
export function getColumnColorValue(color: string | null | undefined): string {
  if (!color) return COLUMN_FALLBACK_COLOR;

  const mapped = labelColors.find((c) => c.value === color)?.color;
  if (mapped) return mapped;

  if (isValidHtmlColor(color)) return color;

  return COLUMN_FALLBACK_COLOR;
}

export const getColumnIcon = (
  columnId: string,
  isFinal?: boolean,
  iconName?: string | null,
) => {
  const resolvedIconName =
    iconName ||
    DEFAULT_COLUMN_ICON_NAMES[
      columnId as keyof typeof DEFAULT_COLUMN_ICON_NAMES
    ];
  const Icon =
    resolvedIconName &&
    columnIcons[resolvedIconName as keyof typeof columnIcons];

  if (Icon) {
    return <Icon className="w-4 h-4 text-muted-foreground" />;
  }

  return isFinal ? (
    <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
  ) : (
    <Circle className="w-4 h-4 text-muted-foreground" />
  );
};
