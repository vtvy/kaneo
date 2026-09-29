import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import useCompleteSprint from "@/hooks/mutations/sprint/use-complete-sprint";
import { toast } from "@/lib/toast";
import type { Sprint } from "@/types/sprint";

type CompleteSprintModalProps = {
  open: boolean;
  onClose: () => void;
  sprint: Sprint;
  // Future sprints the leftover tasks can be carried over to.
  futureSprints: Sprint[];
};

const BACKLOG_VALUE = "__backlog__";

function CompleteSprintModal({
  open,
  onClose,
  sprint,
  futureSprints,
}: CompleteSprintModalProps) {
  const { t } = useTranslation();
  const [target, setTarget] = useState<string>(BACKLOG_VALUE);
  const { mutateAsync: completeSprint, isPending } = useCompleteSprint();

  useEffect(() => {
    if (open) setTarget(BACKLOG_VALUE);
  }, [open]);

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await completeSprint({
        id: sprint.id,
        targetSprintId: target === BACKLOG_VALUE ? null : target,
      });
      toast.success(t("common:modals.completeSprint.completedToast"));
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("common:modals.completeSprint.completeError"),
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("common:modals.completeSprint.title", { name: sprint.name })}
          </DialogTitle>
          <DialogDescription>
            {t("common:modals.completeSprint.description")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleComplete} className="space-y-6">
          <div className="space-y-2 px-6">
            <Label htmlFor="carry-over-target">
              {t("common:modals.completeSprint.carryOverLabel")}
            </Label>
            <select
              id="carry-over-target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="h-8.5 w-full rounded-lg border border-input bg-background px-3 text-foreground text-sm shadow-xs/5 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/24 sm:h-7.5"
            >
              <option value={BACKLOG_VALUE}>
                {t("common:modals.completeSprint.backlogOption")}
              </option>
              {futureSprints.map((futureSprint) => (
                <option key={futureSprint.id} value={futureSprint.id}>
                  {futureSprint.name}
                </option>
              ))}
            </select>
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
              {t("common:modals.completeSprint.completeButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CompleteSprintModal;
