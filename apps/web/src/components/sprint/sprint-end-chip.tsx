import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { getSprintEndChip } from "@/lib/sprint";
import type { Sprint } from "@/types/sprint";

type SprintEndChipProps = {
  sprint: Pick<Sprint, "state" | "endDate">;
};

// "Overdue" once an open sprint's end date has passed, or "Ends today" /
// "Ends in N days" when it ends within three days.
function SprintEndChip({ sprint }: SprintEndChipProps) {
  const { t } = useTranslation();
  const chip = getSprintEndChip(sprint);

  if (!chip) return null;

  if (chip.kind === "overdue") {
    return (
      <Badge variant="error" size="sm" className="shrink-0">
        {t("common:sprints.overdue")}
      </Badge>
    );
  }

  return (
    <Badge variant="warning" size="sm" className="shrink-0">
      {chip.kind === "endsToday"
        ? t("common:sprints.endsToday")
        : t("common:sprints.endsInDays", { count: chip.days })}
    </Badge>
  );
}

export default SprintEndChip;
