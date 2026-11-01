import { useTranslation } from "react-i18next";
import { Progress } from "@/components/ui/progress";
import { formatDateMedium } from "@/lib/format";
import {
  getSnapshotCompletionReport,
  type SprintCompletionReport,
} from "@/lib/sprint";
import type { SprintReport, SprintSnapshotTask } from "@/types/sprint";

type SprintReportContentProps = {
  report: SprintCompletionReport;
  // Task lists from the stored snapshot; capped server-side, so they can be
  // shorter than the counts in `report`.
  doneTasks?: SprintSnapshotTask[];
  carriedOverTasks?: SprintSnapshotTask[];
};

function SnapshotTaskList({
  heading,
  tasks,
  total,
}: {
  heading: string;
  tasks: SprintSnapshotTask[];
  total: number;
}) {
  const { t } = useTranslation();

  if (tasks.length === 0) return null;

  return (
    <section className="space-y-1">
      <h3 className="font-medium text-foreground text-xs">{heading}</h3>
      <ul className="max-h-40 space-y-0.5 overflow-y-auto">
        {tasks.map((task) => (
          <li key={task.id} className="truncate text-muted-foreground text-xs">
            {task.number != null && (
              <span className="mr-1.5 tabular-nums">#{task.number}</span>
            )}
            {task.title}
          </li>
        ))}
      </ul>
      {tasks.length < total && (
        <p className="text-muted-foreground text-xs italic">
          {t("common:modals.sprintReport.listTruncated", {
            shown: tasks.length,
            total,
          })}
        </p>
      )}
    </section>
  );
}

function SprintReportContent({
  report,
  doneTasks = [],
  carriedOverTasks = [],
}: SprintReportContentProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Progress value={report.percentDone} className="flex-1" />
        <span className="text-muted-foreground text-xs tabular-nums">
          {report.percentDone}%
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-sm">
        {[
          {
            label: t("common:modals.sprintReport.done"),
            tasks: report.doneTasks,
            points: report.donePoints,
          },
          {
            label: t("common:modals.sprintReport.carriedOver"),
            tasks: report.carriedOverTasks,
            points: report.carriedOverPoints,
          },
          {
            label: t("common:modals.sprintReport.total"),
            tasks: report.totalTasks,
            points: report.totalPoints,
          },
        ].map((row) => (
          <div
            key={row.label}
            className="rounded-lg border border-border px-3 py-2"
          >
            <dt className="text-muted-foreground text-xs">{row.label}</dt>
            <dd className="font-medium text-foreground tabular-nums">
              {t("common:modals.sprintReport.tasks", {
                count: row.tasks,
              })}
            </dd>
            <dd className="text-muted-foreground text-xs tabular-nums">
              {t("common:modals.sprintReport.points", {
                count: row.points,
              })}
            </dd>
          </div>
        ))}
      </dl>
      <SnapshotTaskList
        heading={t("common:modals.sprintReport.doneTasksHeading")}
        tasks={doneTasks}
        total={report.doneTasks}
      />
      <SnapshotTaskList
        heading={t("common:modals.sprintReport.carriedOverTasksHeading")}
        tasks={carriedOverTasks}
        total={report.carriedOverTasks}
      />
    </div>
  );
}

export function SprintReportBody({
  report,
  isLoading,
  isError,
}: {
  report: SprintReport | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <p className="py-4 text-center text-muted-foreground text-sm">
        {t("common:sprints.loading")}
      </p>
    );
  }

  if (isError) {
    return (
      <p className="py-4 text-center text-muted-foreground text-sm">
        {t("common:modals.sprintReport.loadError")}
      </p>
    );
  }

  const snapshot = report?.snapshot;

  // Sprints completed before snapshots were stored have no report.
  if (!snapshot) {
    return (
      <div className="space-y-1 py-4 text-center">
        <p className="font-medium text-foreground text-sm">
          {t("common:modals.sprintReport.noReport")}
        </p>
        <p className="text-muted-foreground text-xs">
          {t("common:modals.sprintReport.noReportDescription")}
        </p>
      </div>
    );
  }

  const completedOn = formatDateMedium(snapshot.completedAt);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        {report.completedByName
          ? t("common:modals.sprintReport.completedOnBy", {
              date: completedOn,
              name: report.completedByName,
            })
          : t("common:modals.sprintReport.completedOn", { date: completedOn })}
      </p>
      <SprintReportContent
        report={getSnapshotCompletionReport(snapshot)}
        doneTasks={snapshot.doneTasks}
        carriedOverTasks={snapshot.carriedOverTasks}
      />
    </div>
  );
}

export default SprintReportContent;
