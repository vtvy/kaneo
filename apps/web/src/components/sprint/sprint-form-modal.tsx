import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import useCreateSprint from "@/hooks/mutations/sprint/use-create-sprint";
import useUpdateSprint from "@/hooks/mutations/sprint/use-update-sprint";
import useGetSprintsByProject from "@/hooks/queries/sprint/use-get-sprints-by-project";
import { toast } from "@/lib/toast";
import type { Sprint } from "@/types/sprint";

const DEFAULT_SPRINT_CYCLE_WEEKS = 2;

type SprintFormModalProps = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectSlug?: string;
  // When provided the modal edits an existing sprint, otherwise it creates one.
  sprint?: Sprint;
  // Project's configured sprint length; used to suggest new-sprint dates.
  sprintCycleWeeks?: number;
};

function toDateInputValue(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatLocalDateInput(date);
}

function formatLocalDateInput(date: Date) {
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function endDateFromStartValue(startValue: string, cycleWeeks: number) {
  if (!startValue) return "";
  const [year, month, day] = startValue.split("-").map(Number);
  if (!year || !month || !day) return "";
  const start = new Date(year, month - 1, day);
  // Inclusive span: 2 weeks = start..start+13 (e.g. 3/8 → 16/8, not 17/8).
  return formatLocalDateInput(addDays(start, cycleWeeks * 7 - 1));
}

function SprintFormModal({
  open,
  onClose,
  projectId,
  projectSlug,
  sprint,
  sprintCycleWeeks,
}: SprintFormModalProps) {
  const { t } = useTranslation();
  const isEditing = Boolean(sprint);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { mutateAsync: createSprint, isPending: isCreating } =
    useCreateSprint();
  const { mutateAsync: updateSprint, isPending: isUpdating } =
    useUpdateSprint();

  // Used to suggest dates for a new sprint (start = latest end + 1 day).
  const { data: sprints } = useGetSprintsByProject(projectId);

  const cycleWeeks =
    typeof sprintCycleWeeks === "number" && sprintCycleWeeks > 0
      ? sprintCycleWeeks
      : DEFAULT_SPRINT_CYCLE_WEEKS;

  useEffect(() => {
    if (!open) return;

    if (isEditing) {
      setName(sprint?.name ?? "");
      setGoal(sprint?.goal ?? "");
      setStartDate(toDateInputValue(sprint?.startDate));
      setEndDate(toDateInputValue(sprint?.endDate));
      return;
    }

    // Creating a new sprint: prefill editable date suggestions.
    setName("");
    setGoal("");

    const latestEnd = (sprints ?? []).reduce<Date | null>((latest, current) => {
      if (!current.endDate) return latest;
      const candidate = new Date(current.endDate);
      if (Number.isNaN(candidate.getTime())) return latest;
      if (!latest || candidate.getTime() > latest.getTime()) return candidate;
      return latest;
    }, null);

    const suggestedStart = latestEnd ? addDays(latestEnd, 1) : new Date();
    // Inclusive span: N weeks = start through start+(N*7-1).
    const suggestedEnd = addDays(suggestedStart, cycleWeeks * 7 - 1);

    setStartDate(formatLocalDateInput(suggestedStart));
    setEndDate(formatLocalDateInput(suggestedEnd));
  }, [open, sprint, isEditing, sprints, cycleWeeks]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(t("common:modals.sprint.nameRequired"));
      return;
    }

    try {
      if (isEditing && sprint) {
        await updateSprint({
          id: sprint.id,
          name: name.trim(),
          goal: goal.trim() ? goal.trim() : null,
          startDate: startDate ? new Date(startDate).toISOString() : null,
          endDate: endDate ? new Date(endDate).toISOString() : null,
        });
        toast.success(t("common:modals.sprint.updatedToast"));
      } else {
        await createSprint({
          projectId,
          name: name.trim(),
          goal: goal.trim() ? goal.trim() : undefined,
          startDate: startDate ? new Date(startDate).toISOString() : undefined,
          endDate: endDate ? new Date(endDate).toISOString() : undefined,
        });
        toast.success(t("common:modals.sprint.createdToast"));
      }
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("common:modals.sprint.saveError"),
      );
    }
  };

  const isPending = isCreating || isUpdating;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle asChild>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="font-semibold text-muted-foreground text-sm tracking-wider">
                  {projectSlug?.toUpperCase() ??
                    t("common:modals.sprint.breadcrumbProjectFallback")}
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem className="font-medium text-foreground text-sm">
                  {isEditing
                    ? t("common:modals.sprint.editTitle")
                    : t("common:modals.sprint.createTitle")}
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </DialogTitle>
          <DialogDescription>
            {t("common:modals.sprint.description")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4 px-6">
            <div className="space-y-1.5">
              <Label htmlFor="sprint-name">
                {t("common:modals.sprint.nameLabel")}
              </Label>
              <Input
                id="sprint-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("common:modals.sprint.namePlaceholder")}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sprint-goal">
                {t("common:modals.sprint.goalLabel")}
              </Label>
              <textarea
                id="sprint-goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder={t("common:modals.sprint.goalPlaceholder")}
                rows={3}
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-foreground text-sm shadow-xs/5 outline-none transition-shadow placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/24"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sprint-start">
                  {t("common:modals.sprint.startDateLabel")}
                </Label>
                <Input
                  id="sprint-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const nextStart = e.target.value;
                    setStartDate(nextStart);
                    // On create, keep end = start + sprint cycle when start changes.
                    if (!isEditing) {
                      setEndDate(endDateFromStartValue(nextStart, cycleWeeks));
                    }
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sprint-end">
                  {t("common:modals.sprint.endDateLabel")}
                </Label>
                <Input
                  id="sprint-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isPending}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isEditing
                ? t("common:modals.sprint.saveButton")
                : t("common:modals.sprint.createButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default SprintFormModal;
