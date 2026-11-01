import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import type { ImportRun, ImportRunProject } from "@/fetchers/import/import";

const STATUS_VARIANTS = {
  pending: "outline",
  running: "info",
  completed: "success",
  failed: "error",
} as const;

const COUNT_KEYS = ["tasks", "columns", "labels", "comments"] as const;

function ProjectRow({
  project,
  workspaceId,
}: {
  project: ImportRunProject;
  workspaceId: string;
}) {
  const { t } = useTranslation();
  const counts = COUNT_KEYS.filter((key) => project.counts[key] > 0).map(
    (key) =>
      t(`settings:workspaceImport.counts.${key}`, {
        count: project.counts[key],
      }),
  );

  return (
    <li className="space-y-1 py-2">
      <div className="flex items-center justify-between gap-3">
        {project.status === "completed" && project.projectId ? (
          <Link
            to="/dashboard/workspace/$workspaceId/project/$projectId/board"
            params={{ workspaceId, projectId: project.projectId }}
            className="text-sm font-medium hover:underline"
          >
            {project.name}
          </Link>
        ) : (
          <span className="text-sm font-medium">{project.name}</span>
        )}
        <Badge variant={STATUS_VARIANTS[project.status]}>
          {t(`settings:workspaceImport.status.${project.status}`)}
        </Badge>
      </div>
      {counts.length > 0 ? (
        <p className="text-xs text-muted-foreground">{counts.join(" · ")}</p>
      ) : null}
      {project.error ? (
        <p className="text-xs text-destructive">{project.error}</p>
      ) : null}
      {project.warnings.length > 0 ? (
        <ul className="list-disc pl-4 text-xs text-muted-foreground">
          {project.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function ImportRunCard({ run }: { run: ImportRun }) {
  const { t, i18n } = useTranslation();
  const done = run.projects.filter(
    (project) => project.status === "completed" || project.status === "failed",
  ).length;

  return (
    <div className="space-y-3 border border-border rounded-md p-4 bg-sidebar">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">
            {t("settings:workspaceImport.run.title", {
              source: run.source === "jira" ? "Jira" : "PLANKA",
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(run.createdAt).toLocaleString(i18n.language)}
          </p>
        </div>
        <Badge variant={STATUS_VARIANTS[run.status]}>
          {t(`settings:workspaceImport.status.${run.status}`)}
        </Badge>
      </div>

      {run.status === "running" ? (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {t("settings:workspaceImport.run.progress", {
            done,
            total: run.projects.length,
          })}
          {run.message ? ` · ${run.message}` : ""}
        </p>
      ) : null}
      {run.error ? (
        <p className="text-xs text-destructive">{run.error}</p>
      ) : null}

      <ul className="divide-y divide-border">
        {run.projects.map((project) => (
          <ProjectRow
            key={project.sourceId}
            project={project}
            workspaceId={run.workspaceId}
          />
        ))}
      </ul>
    </div>
  );
}
