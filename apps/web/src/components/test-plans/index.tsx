import { client } from "@kaneo/libs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import useGetSprintsByProject from "@/hooks/queries/sprint/use-get-sprints-by-project";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { useProjectPermission } from "@/hooks/use-project-permission";
import { toast } from "@/lib/toast";
import {
  type Plan,
  type PlanInput,
  type StartInput,
  type TestCase,
  testPlanApi,
} from "./api";
import CaseEditor from "./case-editor";
import { newTestRequestKey } from "./new-request-key";
import ResultEditor, { outcomeLabel } from "./result-editor";

function PlanEditor({
  plan,
  sprints,
  pending,
  save,
  cancel,
}: {
  plan?: Plan;
  sprints: { id: string; name: string }[];
  pending: boolean;
  save: (input: PlanInput) => void;
  cancel: () => void;
}) {
  const [title, setTitle] = useState(plan?.title ?? "");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [sprintId, setSprintId] = useState(plan?.sprintId ?? "");
  const [release, setRelease] = useState(plan?.release ?? "");
  return (
    <form
      className="space-y-3 rounded-lg border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save({
          title,
          description,
          sprintId: sprintId || null,
          release,
          state: plan?.state === "archived" ? "archived" : "active",
        });
      }}
    >
      <h3 className="font-medium">
        {plan ? "Edit test plan" : "New test plan"}
      </h3>
      <Input
        type="text"
        aria-label="Plan title"
        placeholder="Plan title"
        required
        maxLength={500}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Textarea
        aria-label="Plan description"
        placeholder="Description and testing scope"
        maxLength={20000}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <select
          className="rounded border bg-background p-2 text-sm"
          aria-label="Plan sprint"
          value={sprintId}
          onChange={(e) => setSprintId(e.target.value)}
        >
          <option value="">No sprint</option>
          {sprints.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Input
          type="text"
          aria-label="Release"
          placeholder="Release (optional)"
          maxLength={500}
          className="w-56"
          value={release}
          onChange={(e) => setRelease(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          Save plan
        </Button>
        <Button type="button" variant="ghost" onClick={cancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default function TestPlans({
  projectId,
  workspaceId,
}: {
  projectId: string;
  workspaceId: string;
}) {
  const { can, isCheckingPermissions } = useProjectPermission(projectId);
  const { user } = useAuth();
  const qc = useQueryClient();
  const canRead = can("test", "read");
  const manage = can("test", "manage");
  const design = can("test", "design");
  const execute = can("test", "execute");
  const overview = useQuery({
    queryKey: ["test-plans", projectId],
    queryFn: () => testPlanApi.overview(projectId),
    enabled: canRead,
    refetchOnMount: "always",
  });
  const { data: sprints = [] } = useGetSprintsByProject(projectId);
  const { data: directory } = useGetActiveWorkspaceUsers(workspaceId);
  const members = directory && "members" in directory ? directory.members : [];
  const workItems = useQuery({
    queryKey: ["work-items", projectId],
    enabled: canRead && can("item", "read"),
    queryFn: async () => {
      const response = await client["work-items"][":projectId"].$get({
        param: { projectId },
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
  });
  const [planId, setPlanId] = useState("");
  const [suiteId, setSuiteId] = useState("");
  const [tab, setTab] = useState<"define" | "execute" | "runs" | "reports">(
    "define",
  );
  const [library, setLibrary] = useState(false);
  const [planEditor, setPlanEditor] = useState<Plan | null | undefined>();
  const [caseEditor, setCaseEditor] = useState<TestCase | null | undefined>();
  const [suiteTitle, setSuiteTitle] = useState("");
  const [renameSuite, setRenameSuite] = useState(false);
  const [runId, setRunId] = useState("");
  const [resultId, setResultId] = useState("");
  const [testerId, setTesterId] = useState("");
  const [environment, setEnvironment] = useState("");
  const [build, setBuild] = useState("");
  const [dirty, setDirty] = useState(false);
  const [editorEpoch, setEditorEpoch] = useState(0);
  const data = overview.data;
  const activePlanId = planId || data?.plans[0]?.id || "";
  const plan = data?.plans.find((entry) => entry.id === activePlanId);
  const planSuites =
    data?.suites.filter((entry) => entry.planId === activePlanId) ?? [];
  const activeSuiteId = planSuites.some((entry) => entry.id === suiteId)
    ? suiteId
    : "";
  const suite = planSuites.find((entry) => entry.id === activeSuiteId);
  const caseIds = new Set(
    (data?.links ?? [])
      .filter((entry) =>
        activeSuiteId
          ? entry.suiteId === activeSuiteId
          : planSuites.some((s) => s.id === entry.suiteId),
      )
      .map((entry) => entry.caseId),
  );
  const visibleCases =
    data?.cases.filter((entry) => library || caseIds.has(entry.id)) ?? [];
  const runQuery = useQuery({
    queryKey: ["test-run", projectId, runId],
    queryFn: () => testPlanApi.detail(projectId, runId),
    enabled: canRead && Boolean(runId),
    refetchOnMount: "always",
  });
  const detail = runQuery.data;
  const selectedResult =
    detail?.results.find((entry) => entry.id === resultId) ??
    detail?.results[0];
  const editable =
    execute &&
    detail?.run.state === "in_progress" &&
    (manage || detail.run.testerId === user?.id);
  const runner = execute && (manage || detail?.run.testerId === user?.id);
  const mutation = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["test-plans", projectId] }),
        qc.invalidateQueries({ queryKey: ["test-run", projectId] }),
      ]);
    },
    onError: (error) => toast.error(error.message),
  });
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);
  const openRun = (id: string) => {
    setDirty(false);
    setRunId(id);
    setResultId("");
    setTab("execute");
  };
  const start = (
    caseIds?: string[],
    originalPlanId = activePlanId,
    originalSuiteId: string | null = activeSuiteId || null,
  ) =>
    mutation.mutate(async () => {
      const input: StartInput = {
        title: `${plan?.title ?? "Manual"} · ${caseIds ? "Retest" : "Run"}`,
        suiteId: originalSuiteId,
        testerId: testerId || user?.id || "",
        environment,
        build,
        clientKey: newTestRequestKey(),
        ...(caseIds ? { caseIds } : {}),
      };
      const run = await testPlanApi.start(projectId, originalPlanId, input);
      if (run) openRun(run.id);
    });
  const selectPlan = (id: string) => {
    setRunId("");
    setResultId("");
    setPlanId(id);
    setSuiteId("");
    setLibrary(false);
    setPlanEditor(undefined);
    setCaseEditor(undefined);
    setRenameSuite(false);
  };
  const archive = () => {
    if (!plan) return;
    mutation.mutate(() =>
      testPlanApi.savePlan(
        projectId,
        {
          title: plan.title,
          description: plan.description,
          release: plan.release,
          sprintId: plan.sprintId,
          state: plan.state === "active" ? "archived" : "active",
        },
        plan.id,
      ),
    );
  };
  if (isCheckingPermissions)
    return <p className="p-5 text-sm">Loading permissions…</p>;
  if (!canRead)
    return (
      <p className="p-5 text-sm text-muted-foreground">
        You do not have permission to view Test Plans in this project.
      </p>
    );
  if (overview.isPending)
    return <p className="p-5 text-sm">Loading Test Plans…</p>;
  if (overview.isError)
    return (
      <div className="p-5">
        <p>{overview.error.message}</p>
        <Button onClick={() => overview.refetch()}>Retry</Button>
      </div>
    );
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <h1 className="mr-3 text-base font-semibold">Test Plans</h1>
        <select
          aria-label="Test plan"
          className="max-w-64 rounded border bg-background p-2 text-sm"
          disabled={dirty}
          value={activePlanId}
          onChange={(e) => selectPlan(e.target.value)}
        >
          <option value="">Select plan</option>
          {data?.plans.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.title}
              {entry.state === "archived" ? " (Archived)" : ""}
            </option>
          ))}
        </select>
        {manage && (
          <Button
            size="sm"
            disabled={dirty}
            onClick={() => {
              setPlanEditor(null);
              setTab("define");
            }}
          >
            New plan
          </Button>
        )}
        {plan && manage && (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={dirty || mutation.isPending}
              onClick={() => {
                setPlanEditor(plan);
                setTab("define");
              }}
            >
              Edit plan
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={dirty || mutation.isPending}
              onClick={archive}
            >
              {plan.state === "active" ? "Archive" : "Reopen"}
            </Button>
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-1 border-b px-3 py-2">
        {(["define", "execute", "runs", "reports"] as const).map((entry) => (
          <Button
            key={entry}
            size="sm"
            variant={tab === entry ? "secondary" : "ghost"}
            disabled={dirty}
            onClick={() => setTab(entry)}
          >
            {entry[0]?.toUpperCase()}
            {entry.slice(1)}
          </Button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {tab === "define" && (
          <div className="space-y-4">
            {planEditor !== undefined && (
              <PlanEditor
                key={planEditor?.id ?? "new"}
                plan={planEditor ?? undefined}
                sprints={sprints}
                pending={mutation.isPending}
                cancel={() => setPlanEditor(undefined)}
                save={(input) =>
                  mutation.mutate(async () => {
                    const saved = await testPlanApi.savePlan(
                      projectId,
                      input,
                      planEditor?.id,
                    );
                    setPlanEditor(undefined);
                    if (saved) selectPlan(saved.id);
                  })
                }
              />
            )}
            {plan && (
              <div className="space-y-2">
                <h2 className="font-medium">{plan.title}</h2>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {plan.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  {plan.release && `Release: ${plan.release} · `}
                  {sprints.find((s) => s.id === plan.sprintId)?.name ??
                    "No sprint"}{" "}
                  · {plan.state}
                </p>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Test suite"
                className="rounded border bg-background p-2 text-sm"
                value={activeSuiteId}
                onChange={(e) => {
                  setSuiteId(e.target.value);
                  setRenameSuite(false);
                }}
              >
                <option value="">All plan suites</option>
                {planSuites.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant={library ? "secondary" : "outline"}
                onClick={() => setLibrary(!library)}
              >
                {library ? "Show plan cases" : "Case library / Add existing"}
              </Button>
              {design && (
                <Button size="sm" onClick={() => setCaseEditor(null)}>
                  New case
                </Button>
              )}
            </div>
            {manage && plan?.state === "active" && (
              <form
                className="flex flex-wrap gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  mutation.mutate(async () => {
                    const savedSuite = await testPlanApi.saveSuite(
                      projectId,
                      activePlanId,
                      suiteTitle,
                      renameSuite ? activeSuiteId : undefined,
                    );
                    if (savedSuite) setSuiteId(savedSuite.id);
                    setSuiteTitle("");
                    setRenameSuite(false);
                  });
                }}
              >
                <Input
                  type="text"
                  className="w-64"
                  aria-label="Suite title"
                  placeholder={renameSuite ? "Rename suite" : "New suite title"}
                  required
                  maxLength={500}
                  value={suiteTitle}
                  onChange={(e) => setSuiteTitle(e.target.value)}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="outline"
                  disabled={mutation.isPending || !suiteTitle.trim()}
                >
                  {renameSuite ? "Save suite" : "Add suite"}
                </Button>
                {suite && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRenameSuite(true);
                      setSuiteTitle(suite.title);
                    }}
                  >
                    Rename selected suite
                  </Button>
                )}
              </form>
            )}
            {caseEditor !== undefined && design && (
              <CaseEditor
                key={caseEditor?.id ?? "new"}
                existing={caseEditor ?? undefined}
                items={workItems.data ?? []}
                pending={mutation.isPending}
                cancel={() => setCaseEditor(undefined)}
                save={(input) =>
                  mutation.mutate(async () => {
                    const saved = await testPlanApi.saveCase(
                      projectId,
                      input,
                      caseEditor ?? undefined,
                    );
                    setCaseEditor(undefined);
                    setLibrary(true);
                    if (
                      saved &&
                      !caseEditor &&
                      activeSuiteId &&
                      manage &&
                      plan?.state === "active"
                    )
                      await testPlanApi.membership(
                        projectId,
                        activeSuiteId,
                        saved.id,
                        false,
                      );
                  })
                }
              />
            )}
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-2">In suite</th>
                    <th className="p-2">Manual test case</th>
                    <th className="p-2">State</th>
                    <th className="p-2">Revision</th>
                    <th className="p-2">Requirement</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCases.map((entry) => (
                    <tr key={entry.id} className="border-b">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          aria-label={`Include ${entry.title} in suite`}
                          checked={
                            activeSuiteId
                              ? data?.links.some(
                                  (link) =>
                                    link.suiteId === activeSuiteId &&
                                    link.caseId === entry.id,
                                )
                              : caseIds.has(entry.id)
                          }
                          disabled={
                            !activeSuiteId ||
                            !manage ||
                            mutation.isPending ||
                            plan?.state !== "active"
                          }
                          onChange={(e) =>
                            mutation.mutate(() =>
                              testPlanApi.membership(
                                projectId,
                                activeSuiteId,
                                entry.id,
                                !e.target.checked,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="p-2">
                        {entry.title}
                        <p className="text-xs text-muted-foreground">
                          {entry.steps.length} steps
                        </p>
                      </td>
                      <td className="p-2">{entry.state}</td>
                      <td className="p-2">{entry.revision}</td>
                      <td className="p-2">
                        {entry.requirementId ? (
                          <Link
                            className="text-primary underline"
                            to="/dashboard/workspace/$workspaceId/project/$projectId/board"
                            params={{ projectId, workspaceId }}
                            search={{ taskId: entry.requirementId }}
                          >
                            Open work item
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-2">
                        {design && (
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => setCaseEditor(entry)}
                          >
                            Edit case
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!visibleCases.length && (
              <p className="text-sm text-muted-foreground">
                {library
                  ? "Create a manual test case to start your library."
                  : "Create a suite, then add cases from the library. Only Ready cases are included in new runs."}
              </p>
            )}
          </div>
        )}
        {tab === "execute" && (
          <div className="space-y-4">
            {execute && plan?.state === "active" && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
                <select
                  className="max-w-56 rounded border bg-background p-2 text-sm"
                  aria-label="Run suite"
                  disabled={dirty}
                  value={activeSuiteId}
                  onChange={(e) => setSuiteId(e.target.value)}
                >
                  <option value="">All plan suites</option>
                  {planSuites.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.title}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Assigned tester"
                  className="rounded border bg-background p-2 text-sm"
                  disabled={dirty}
                  value={testerId || user?.id || ""}
                  onChange={(e) => setTesterId(e.target.value)}
                >
                  <option value={user?.id ?? ""}>Me</option>
                  {members
                    .filter((entry) => manage && entry.userId !== user?.id)
                    .map((entry) => (
                      <option key={entry.userId} value={entry.userId}>
                        {entry.user.name}
                      </option>
                    ))}
                </select>
                <Input
                  type="text"
                  aria-label="Run environment"
                  placeholder="Environment"
                  maxLength={1000}
                  className="w-44"
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                />
                <Input
                  type="text"
                  aria-label="Run build"
                  placeholder="Build / commit (optional)"
                  maxLength={1000}
                  className="w-56"
                  value={build}
                  onChange={(e) => setBuild(e.target.value)}
                />
                <Button
                  disabled={dirty || mutation.isPending}
                  onClick={() => start()}
                >
                  Start manual run
                </Button>
              </div>
            )}
            {runQuery.isPending && runId && <p>Loading run…</p>}
            {runQuery.isError && (
              <Button onClick={() => runQuery.refetch()}>
                Retry loading run
              </Button>
            )}
            {detail && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-medium">{detail.run.title}</h2>
                  <span className="text-xs text-muted-foreground">
                    Assigned to{" "}
                    {members.find(
                      (member) => member.userId === detail.run.testerId,
                    )?.user.name ??
                      detail.run.testerId ??
                      "Removed tester"}{" "}
                    · {detail.run.state} ·{" "}
                    {detail.run.environment || "No environment"} ·{" "}
                    {detail.run.build || "No build"}
                  </span>
                  {runner &&
                    !["completed", "aborted"].includes(detail.run.state) &&
                    [
                      detail.run.state === "paused" ? "in_progress" : "paused",
                      "completed",
                      "aborted",
                    ].map((state) => (
                      <Button
                        key={state}
                        size="sm"
                        variant="outline"
                        disabled={dirty || mutation.isPending}
                        onClick={() =>
                          mutation.mutate(() =>
                            testPlanApi.transition(
                              projectId,
                              runId,
                              detail.run.version,
                              state as
                                | "in_progress"
                                | "paused"
                                | "completed"
                                | "aborted",
                            ),
                          )
                        }
                      >
                        {state === "in_progress"
                          ? "Resume"
                          : state === "paused"
                            ? "Pause"
                            : state === "completed"
                              ? "Complete run"
                              : "Abort run"}
                      </Button>
                    ))}
                  {execute && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={
                        dirty ||
                        mutation.isPending ||
                        !detail.results.some(
                          (entry) => entry.outcome === "failed" && entry.caseId,
                        )
                      }
                      onClick={() =>
                        start(
                          detail.results
                            .filter(
                              (entry) =>
                                entry.outcome === "failed" && entry.caseId,
                            )
                            .map((entry) => entry.caseId ?? ""),
                          detail.run.planId,
                          detail.run.suiteId,
                        )
                      }
                    >
                      Retest failed · latest case revisions
                    </Button>
                  )}
                </div>
                <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
                  <aside className="space-y-1">
                    {detail.results.map((entry) => (
                      <Button
                        key={entry.id}
                        variant={
                          selectedResult?.id === entry.id
                            ? "secondary"
                            : "ghost"
                        }
                        className="h-auto w-full justify-start whitespace-normal py-2 text-left"
                        disabled={dirty}
                        onClick={() => setResultId(entry.id)}
                      >
                        {outcomeLabel(entry.outcome)} · {entry.snapshot.title}
                      </Button>
                    ))}
                  </aside>
                  <div className="min-w-0">
                    {selectedResult && (
                      <ResultEditor
                        key={`${selectedResult.id}:${selectedResult.version}:${editorEpoch}`}
                        result={selectedResult}
                        editable={Boolean(editable)}
                        pending={mutation.isPending}
                        bugs={(workItems.data ?? []).filter(
                          (entry) => entry.type === "bug",
                        )}
                        onDirty={() => setDirty(true)}
                        createBug={
                          can("item", "create")
                            ? async (input) => {
                                const description = [
                                  `Manual test failure: ${selectedResult.snapshot.title}`,
                                  `Run: ${runId}`,
                                  `Result: ${selectedResult.id}`,
                                  `Build: ${detail.run.build}`,
                                  `Environment: ${detail.run.environment}`,
                                  `Preconditions: ${selectedResult.snapshot.preconditions}`,
                                  ...selectedResult.snapshot.steps.map(
                                    (step, index) =>
                                      `${index + 1}. ${step.action}\nExpected: ${step.expected}\nActual: ${input.steps[index]?.actual ?? ""}`,
                                  ),
                                  `Actual result: ${input.actual}`,
                                  ...input.evidence,
                                ].join("\n\n");
                                const response = await client.task[
                                  ":projectId"
                                ].$post({
                                  param: { projectId },
                                  json: {
                                    title:
                                      `Bug: ${selectedResult.snapshot.title}`.slice(
                                        0,
                                        500,
                                      ),
                                    description,
                                    priority: "medium",
                                    workItemType: "bug",
                                  },
                                });
                                if (!response.ok)
                                  throw new Error(await response.text());
                                const bug = await response.json();
                                await Promise.all([
                                  qc.invalidateQueries({
                                    queryKey: ["work-items", projectId],
                                  }),
                                  qc.invalidateQueries({
                                    queryKey: ["tasks", projectId],
                                  }),
                                ]);
                                return bug.id;
                              }
                            : undefined
                        }
                        save={(input) =>
                          mutation.mutate(async () => {
                            await testPlanApi.saveResult(
                              projectId,
                              runId,
                              selectedResult.id,
                              input,
                            );
                            setDirty(false);
                          })
                        }
                      />
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {dirty && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await runQuery.refetch();
                            setEditorEpoch((epoch) => epoch + 1);
                            setDirty(false);
                          }}
                        >
                          Discard unsaved changes
                        </Button>
                      )}
                      <Link
                        className="text-xs text-primary underline"
                        onClick={(event) => {
                          if (dirty) {
                            event.preventDefault();
                            toast.error(
                              "Save or discard the result before opening Work items.",
                            );
                          }
                        }}
                        to="/dashboard/workspace/$workspaceId/project/$projectId/work-items"
                        params={{ projectId, workspaceId }}
                      >
                        Create or view Bugs in Work items
                      </Link>
                    </div>
                  </div>
                </div>
              </>
            )}
            {!runId && (
              <p className="text-sm text-muted-foreground">
                Start a run or open an existing run from Runs. Saved results can
                be resumed here.
              </p>
            )}
          </div>
        )}
        {tab === "runs" && (
          <div className="space-y-3">
            <h2 className="font-medium">
              Run history · latest 100 project runs
            </h2>
            <p className="text-xs text-muted-foreground">
              Showing the selected plan. Retests create new runs; closed runs
              keep their results.
            </p>
            {data?.runs
              .filter((run) => run.planId === activePlanId)
              .map((run) => (
                <div
                  className="flex flex-wrap items-center gap-3 border-b py-3"
                  key={run.id}
                >
                  <Button variant="ghost" onClick={() => openRun(run.id)}>
                    {run.title}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {run.state} · {new Date(run.createdAt).toLocaleString()} ·{" "}
                    {run.environment} · {run.build}
                  </span>
                </div>
              ))}
          </div>
        )}
        {tab === "reports" && (
          <div className="space-y-4">
            <h2 className="font-medium">Execution report</h2>
            <select
              aria-label="Report run"
              className="max-w-full rounded border bg-background p-2 text-sm"
              value={runId}
              onChange={(e) => setRunId(e.target.value)}
            >
              <option value="">Select run</option>
              {data?.runs
                .filter((run) => run.planId === activePlanId)
                .map((run) => (
                  <option key={run.id} value={run.id}>
                    {run.title} · {new Date(run.createdAt).toLocaleString()}
                  </option>
                ))}
            </select>
            {detail && (
              <>
                <p className="text-sm">
                  {detail.run.title} · {detail.run.build || "No build"} ·{" "}
                  {detail.run.environment || "No environment"}
                </p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {(
                    [
                      "passed",
                      "failed",
                      "blocked",
                      "not_run",
                      "not_applicable",
                    ] as const
                  ).map((key) => (
                    <div className="border-b py-3" key={key}>
                      <p className="text-xs text-muted-foreground">
                        {outcomeLabel(key)}
                      </p>
                      <p className="text-xl font-semibold">
                        {detail.summary[key]}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-sm">
                  Executed: {detail.summary.executed}/
                  {detail.summary.total - detail.summary.not_applicable}{" "}
                  applicable cases. Pass rate:{" "}
                  {detail.summary.passRate === null
                    ? "—"
                    : `${Math.round(detail.summary.passRate * 100)}%`}
                  .
                </p>
                <p className="text-xs text-muted-foreground">
                  Executed includes Passed, Failed and Blocked. Pass rate is
                  Passed / (Passed + Failed). Not run, Blocked and Not
                  applicable remain visible separately. This report describes
                  the selected run, not code coverage.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
