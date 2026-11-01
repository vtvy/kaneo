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
import useGetSprintReport from "@/hooks/queries/sprint/use-get-sprint-report";
import type { Sprint } from "@/types/sprint";
import { SprintReportBody } from "./sprint-report-content";

type SprintReportModalProps = {
  open: boolean;
  onClose: () => void;
  sprint: Pick<Sprint, "id" | "name">;
};

// Report of an already-completed sprint, rendered from the snapshot the API
// stored when the sprint was completed.
function SprintReportModal({ open, onClose, sprint }: SprintReportModalProps) {
  const { t } = useTranslation();
  const {
    data: report,
    isLoading,
    isError,
  } = useGetSprintReport(open ? sprint.id : "");

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t("common:modals.sprintReport.title", { name: sprint.name })}
          </DialogTitle>
          <DialogDescription>
            {t("common:modals.sprintReport.historyDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-6">
          <SprintReportBody
            report={report}
            isLoading={isLoading}
            isError={isError}
          />
        </div>

        <DialogFooter>
          <Button type="button" size="sm" onClick={onClose}>
            {t("common:actions.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SprintReportModal;
