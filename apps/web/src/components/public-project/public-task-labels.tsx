import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import labelColors from "@/constants/label-colors";
import { localeCompareSort } from "@/lib/format";

type PublicTaskLabelsProps = {
  labels: Array<{ id: string; name: string; color: string }>;
};

export function PublicTaskLabels({ labels }: PublicTaskLabelsProps) {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language;
  if (!labels || labels.length === 0) return null;

  const sortedLabels = [...labels].sort((a, b) =>
    localeCompareSort(a.name, b.name, locale),
  );

  return (
    <div className="flex flex-wrap gap-1">
      {sortedLabels.map((label) => (
        <Badge
          key={label.id}
          variant="outline"
          className="px-2 py-0.5 text-[10px] flex items-center"
        >
          <span
            className="inline-block w-1.5 h-1.5 mr-1 rounded-full"
            style={{
              backgroundColor:
                labelColors.find((c) => c.value === label.color)?.color ||
                "var(--color-neutral-400)",
            }}
          />
          <span className="max-w-20 truncate">{label.name}</span>
        </Badge>
      ))}
    </div>
  );
}
