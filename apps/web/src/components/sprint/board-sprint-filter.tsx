import { Target } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Sprint } from "@/types/sprint";

export const ALL_SPRINTS_VALUE = "all";

type BoardSprintFilterProps = {
  sprints: Sprint[];
  // The current sprint id (derived by date), highlighted with a "Current" tag.
  currentSprintId: string | null;
  // Currently selected sprint id, or ALL_SPRINTS_VALUE for "All sprints".
  value: string;
  onValueChange: (value: string) => void;
};

function BoardSprintFilter({
  sprints,
  currentSprintId,
  value,
  onValueChange,
}: BoardSprintFilterProps) {
  const { t } = useTranslation();

  const selectedSprint = sprints.find((sprint) => sprint.id === value);
  const triggerLabel =
    value === ALL_SPRINTS_VALUE || !selectedSprint
      ? t("common:sprints.allSprints")
      : selectedSprint.name;

  return (
    <Select
      value={value}
      onValueChange={(next) => onValueChange(next ?? ALL_SPRINTS_VALUE)}
    >
      <SelectTrigger
        size="sm"
        className="h-7.5 w-auto min-w-40"
        title={t("common:sprints.filterBySprint")}
      >
        <Target className="size-3.5 text-muted-foreground" />
        <SelectValue>{triggerLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_SPRINTS_VALUE}>
          {t("common:sprints.allSprints")}
        </SelectItem>
        {sprints.map((sprint) => (
          <SelectItem key={sprint.id} value={sprint.id}>
            <span className="inline-flex items-center gap-1.5">
              <span className="truncate">{sprint.name}</span>
              {sprint.id === currentSprintId && (
                <Badge variant="success" size="sm">
                  {t("common:sprints.current")}
                </Badge>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default BoardSprintFilter;
