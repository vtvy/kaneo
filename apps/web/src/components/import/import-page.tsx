import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useListImportSourceProjects } from "@/hooks/mutations/import/use-list-import-source-projects";
import { useStartImportRun } from "@/hooks/mutations/import/use-start-import-run";
import { useImportRun } from "@/hooks/queries/import/use-import-run";
import { useImportRuns } from "@/hooks/queries/import/use-import-runs";
import { toast } from "@/lib/toast";
import {
  buildConnection,
  EMPTY_CONNECT_VALUES,
  type ImportConnectValues,
  type ImportSourceId,
} from "./build-connection";
import { ImportConnectForm } from "./import-connect-form";
import { ImportProjectPicker } from "./import-project-picker";
import { ImportRunCard } from "./import-run-card";

type SourceProject = { id: string; name: string; detail?: string };

export function ImportPage({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [source, setSource] = useState<ImportSourceId>("planka");
  // Credentials live only in this component's state and are cleared as soon
  // as an import starts.
  const [values, setValues] =
    useState<ImportConnectValues>(EMPTY_CONNECT_VALUES);
  const [projects, setProjects] = useState<SourceProject[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [includeComments, setIncludeComments] = useState(true);
  const [runId, setRunId] = useState<string | null>(null);

  const listProjects = useListImportSourceProjects();
  const startRun = useStartImportRun();
  const { data: run } = useImportRun(workspaceId, runId);
  const { data: runs } = useImportRuns(workspaceId);

  const connection = buildConnection(source, values);

  const finishedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!run || run.status === "running" || finishedRef.current === run.id) {
      return;
    }
    finishedRef.current = run.id;
    queryClient.invalidateQueries({ queryKey: ["import-runs", workspaceId] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  }, [run, queryClient, workspaceId]);

  function reset() {
    setValues(EMPTY_CONNECT_VALUES);
    setProjects(null);
    setSelected([]);
  }

  async function connect() {
    if (!connection) return;
    try {
      const result = await listProjects.mutateAsync({
        workspaceId,
        connection,
      });
      setProjects(result.projects);
      setSelected([]);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings:workspaceImport.errors.connect"),
      );
    }
  }

  async function start() {
    if (!connection || selected.length === 0) return;
    try {
      const result = await startRun.mutateAsync({
        workspaceId,
        connection,
        projectIds: selected,
        includeComments,
      });
      reset();
      setRunId(result.run.id);
      toast.success(t("settings:workspaceImport.toastStarted"));
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings:workspaceImport.errors.start"),
      );
    }
  }

  const history = (runs ?? []).filter((item) => item.id !== run?.id);

  return (
    <div className="space-y-8">
      {run ? (
        <div className="space-y-3">
          <ImportRunCard run={run} />
          {run.status !== "running" ? (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRunId(null)}
              >
                {t("settings:workspaceImport.actions.importMore")}
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-md font-medium">
              {projects
                ? t("settings:workspaceImport.projects.title")
                : t("settings:workspaceImport.connect.title")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {projects
                ? t("settings:workspaceImport.projects.subtitle")
                : t("settings:workspaceImport.connect.subtitle")}
            </p>
          </div>
          {projects ? (
            <ImportProjectPicker
              projects={projects}
              selected={selected}
              includeComments={includeComments}
              isStarting={startRun.isPending}
              onSelectedChange={setSelected}
              onIncludeCommentsChange={setIncludeComments}
              onBack={() => setProjects(null)}
              onStart={start}
            />
          ) : (
            <ImportConnectForm
              source={source}
              values={values}
              canConnect={Boolean(connection)}
              isConnecting={listProjects.isPending}
              onSourceChange={(next) => {
                setSource(next);
                setValues(EMPTY_CONNECT_VALUES);
              }}
              onChange={setValues}
              onConnect={connect}
            />
          )}
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-md font-medium">
            {t("settings:workspaceImport.history.title")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("settings:workspaceImport.history.subtitle")}
          </p>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("settings:workspaceImport.history.empty")}
          </p>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <ImportRunCard key={item.id} run={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
