import { client } from "@kaneo/libs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import updateTaskStatus from "@/fetchers/task/update-task-status";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import useGetSprintsByProject from "@/hooks/queries/sprint/use-get-sprints-by-project";
import { useProjectPermission } from "@/hooks/use-project-permission";
import { getCurrentSprint } from "@/lib/sprint";
import { toast } from "@/lib/toast";

export const itemTypes = [
  "epic",
  "feature",
  "backlog_item",
  "task",
  "bug",
] as const;
const labels: Record<string, string> = {
  epic: "Epic",
  feature: "Feature",
  backlog_item: "Backlog Item",
  task: "Task",
  bug: "Bug",
};
const colors: Record<string, string> = {
  epic: "text-purple-600",
  feature: "text-indigo-600",
  backlog_item: "text-green-600",
  task: "text-yellow-700",
  bug: "text-red-600",
};
function accepts(parent: string, child: string) {
  return (
    (parent === "epic" && child === "feature") ||
    (parent === "feature" && (child === "backlog_item" || child === "bug")) ||
    ((parent === "backlog_item" || parent === "bug") && child === "task")
  );
}
export function WorkItemBadge({ type = "task" }: { type?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${colors[type] ?? colors.task}`}
    >
      <span aria-hidden="true">■</span>
      {labels[type] ?? "Task"}
    </span>
  );
}

export default function WorkItems({
  projectId,
  workspaceId,
  mode,
}: {
  projectId: string;
  workspaceId: string;
  mode: "items" | "tree" | "sprint";
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { can } = useProjectPermission(projectId);
  const {
    data: items = [],
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["work-items", projectId],
    queryFn: async () => {
      const res = await client["work-items"][":projectId"].$get({
        param: { projectId },
      });
      if (!res.ok) throw Error(await res.text());
      return res.json();
    },
    refetchOnMount: "always",
  });
  const { data: columns = [] } = useGetColumns(projectId);
  const { data: sprints = [] } = useGetSprintsByProject(projectId);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [personFilter, setPersonFilter] = useState("all");
  const [sprint, setSprint] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<(typeof itemTypes)[number]>("backlog_item");
  const [parentId, setParentId] = useState("");
  const activeSprint =
    sprint ?? getCurrentSprint(sprints)?.id ?? sprints[0]?.id ?? "";
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["work-items", projectId] }),
      qc.invalidateQueries({ queryKey: ["tasks", projectId] }),
      qc.invalidateQueries({ queryKey: ["all-project-tasks", projectId] }),
      qc.invalidateQueries({ queryKey: ["sprint-tasks"] }),
      qc.invalidateQueries({ queryKey: ["sprints"] }),
      qc.invalidateQueries({ queryKey: ["task"] }),
    ]);
  };
  const mutation = useMutation({
    mutationFn: async (action: () => Promise<unknown>) => action(),
    onSuccess: refresh,
    onError: (error) => toast.error(error.message),
  });
  type Item = (typeof items)[number];
  const patch = (
    id: string,
    json: {
      type?: (typeof itemTypes)[number];
      parentId?: string | null;
      sprintId?: string | null;
      position?: number;
      move?: "up" | "down";
    },
  ) =>
    mutation.mutate(async () => {
      const res = await client["work-items"][":projectId"][":id"].$patch({
        param: { projectId, id },
        json,
      });
      if (!res.ok) throw Error(await res.text());
    });
  const open = (id: string) =>
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
      params: { workspaceId, projectId },
      search: { taskId: id },
    });
  const children = (id: string) => items.filter((item) => item.parentId === id);
  const isDone = (item: Item) =>
    columns.some((column) => column.isFinal && column.slug === item.status);
  const progress = (item: Item) => {
    const tasks = children(item.id);
    return tasks.length ? `${tasks.filter(isDone).length}/${tasks.length}` : "";
  };
  const selectClass =
    "h-8 rounded-md border bg-background px-2 text-xs max-w-full";
  const add = (item?: Item) => {
    setParentId(item?.id ?? "");
    setType(
      item
        ? item.type === "epic"
          ? "feature"
          : item.type === "feature"
            ? "backlog_item"
            : "task"
        : "backlog_item",
    );
    setCreating(true);
  };
  const matches = (item: Item) =>
    (filter === "all" || item.type === filter) &&
    (stateFilter === "all" || (item.status ?? "") === stateFilter) &&
    (personFilter === "all" || (item.userId ?? "") === personFilter) &&
    `${item.number} ${item.title}`.toLowerCase().includes(search.toLowerCase());
  const filtered = items.filter(matches);
  const visibleIds = new Set(filtered.map((item) => item.id));
  // Preserve ancestors when filtering so a matching task stays in context.
  for (const item of filtered) {
    let next = item.parentId;
    const visited = new Set<string>();
    while (next && !visited.has(next)) {
      visited.add(next);
      visibleIds.add(next);
      next = items.find((candidate) => candidate.id === next)?.parentId ?? null;
    }
  }
  const row = (item: Item, depth: number, tree: boolean): React.ReactNode => {
    const childItems = children(item.id);
    if (tree && !visibleIds.has(item.id)) return null;
    return (
      <div key={item.id}>
        <fieldset
          aria-label={`Work item ${item.number}: ${item.title}`}
          draggable={tree && can("item", "update")}
          onDragStart={(event) =>
            event.dataTransfer.setData("text/work-item", item.id)
          }
          className="flex min-w-[680px] items-center gap-3 border-b px-3 py-2 hover:bg-muted/40"
        >
          <div
            className="flex min-w-0 flex-1 items-center gap-2"
            style={{ paddingLeft: tree ? depth * 22 : 0 }}
          >
            {tree && (
              <button
                type="button"
                aria-label={`${collapsed.has(item.id) ? "Expand" : "Collapse"} ${item.title}`}
                aria-expanded={!collapsed.has(item.id)}
                disabled={!childItems.length}
                className="size-5 shrink-0"
                onClick={() =>
                  setCollapsed((old) => {
                    const next = new Set(old);
                    if (next.has(item.id)) next.delete(item.id);
                    else next.add(item.id);
                    return next;
                  })
                }
              >
                {childItems.length ? (
                  collapsed.has(item.id) ? (
                    <ChevronRight className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )
                ) : null}
              </button>
            )}
            <span className="w-10 shrink-0 text-xs text-muted-foreground">
              {item.number}
            </span>
            <WorkItemBadge type={item.type} />
            <button
              type="button"
              className="truncate text-left text-sm hover:underline"
              onClick={() => open(item.id)}
            >
              {item.title}
            </button>
            <span className="text-xs text-muted-foreground">
              {progress(item)}
            </span>
          </div>
          <select
            aria-label={`Type for ${item.title}`}
            className={`${selectClass} w-32`}
            disabled={!can("item", "update") || mutation.isPending}
            value={item.type}
            onChange={(event) =>
              patch(item.id, {
                type: event.target.value as (typeof itemTypes)[number],
              })
            }
          >
            {itemTypes.map((value) => (
              <option key={value} value={value}>
                {labels[value]}
              </option>
            ))}
          </select>
          <select
            aria-label={`Parent for ${item.title}`}
            className={`${selectClass} w-36`}
            disabled={!can("item", "update") || mutation.isPending}
            value={item.parentId ?? ""}
            onChange={(event) =>
              patch(item.id, { parentId: event.target.value || null })
            }
          >
            <option value="">No parent</option>
            {items
              .filter((p) => p.id !== item.id && accepts(p.type, item.type))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.number} {p.title}
                </option>
              ))}
          </select>
          <select
            aria-label={`Sprint for ${item.title}`}
            className={`${selectClass} w-32`}
            disabled={!can("item", "update") || mutation.isPending}
            value={item.sprintId ?? ""}
            onChange={(event) =>
              patch(item.id, { sprintId: event.target.value || null })
            }
          >
            <option value="">Unplanned</option>
            {sprints
              .filter((s) => s.state !== "completed" || s.id === item.sprintId)
              .map((s) => (
                <option
                  disabled={s.state === "completed"}
                  key={s.id}
                  value={s.id}
                >
                  {s.name}
                </option>
              ))}
          </select>
          <span className="w-24 truncate text-xs text-muted-foreground">
            {item.assigneeName || "Unassigned"}
          </span>
          <span className="w-24 truncate text-xs">
            {item.status || "No status"}
          </span>
          {tree && can("item", "update") && (
            <>
              <Button
                size="xs"
                variant="ghost"
                aria-label={`Move ${item.title} up`}
                disabled={mutation.isPending}
                onClick={() => patch(item.id, { move: "up" })}
              >
                ↑
              </Button>
              <Button
                size="xs"
                variant="ghost"
                aria-label={`Move ${item.title} down`}
                disabled={mutation.isPending}
                onClick={() => patch(item.id, { move: "down" })}
              >
                ↓
              </Button>
            </>
          )}
          {can("item", "create") && item.type !== "task" && (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => add(item)}
              aria-label={`Add child to ${item.title}`}
            >
              <Plus className="size-3" />
            </Button>
          )}
        </fieldset>
        {tree &&
          !collapsed.has(item.id) &&
          childItems.map((child) => row(child, depth + 1, true))}
      </div>
    );
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      {mode === "tree" && (
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <span className="text-xs font-medium">
            Planning — drag work into a sprint:
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!can("item", "update") || mutation.isPending}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const id = event.dataTransfer.getData("text/work-item");
              if (items.some((item) => item.id === id) && can("item", "update"))
                patch(id, { sprintId: null });
            }}
          >
            Unplanned
          </Button>
          {sprints
            .filter((s) => s.state !== "completed")
            .map((s) => (
              <Button
                key={s.id}
                variant="outline"
                size="sm"
                disabled={!can("item", "update") || mutation.isPending}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const id = event.dataTransfer.getData("text/work-item");
                  if (
                    items.some((item) => item.id === id) &&
                    can("item", "update")
                  )
                    patch(id, { sprintId: s.id });
                }}
              >
                {s.name} ·{" "}
                {items.filter((item) => item.sprintId === s.id).length}
              </Button>
            ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <Input
          aria-label="Search work items"
          placeholder="Search work items"
          className="w-56"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className={selectClass}
          aria-label="Work item type"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">All types</option>
          {itemTypes.map((value) => (
            <option key={value} value={value}>
              {labels[value]}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter status"
          className={selectClass}
          value={stateFilter}
          onChange={(event) => setStateFilter(event.target.value)}
        >
          <option value="all">All states</option>
          <option value="">No status</option>
          {columns.map((column) => (
            <option key={column.id} value={column.slug}>
              {column.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter assignee"
          className={selectClass}
          value={personFilter}
          onChange={(event) => setPersonFilter(event.target.value)}
        >
          <option value="all">All people</option>
          <option value="">Unassigned</option>
          {Array.from(
            new Map(
              items
                .filter((item) => item.userId)
                .map((item) => [item.userId, item.assigneeName]),
            ).entries(),
          ).map(([id, name]) => (
            <option key={id} value={id ?? ""}>
              {name || id}
            </option>
          ))}
        </select>
        {mode === "sprint" && (
          <select
            className={selectClass}
            aria-label="Sprint"
            value={activeSprint}
            onChange={(event) => setSprint(event.target.value)}
          >
            <option value="" disabled>
              Select sprint
            </option>
            {sprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        {mode === "tree" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(new Set())}
          >
            Expand all
          </Button>
        )}
        {can("item", "create") && (
          <Button size="sm" onClick={() => add()}>
            <Plus className="size-4" />
            New Work Item
          </Button>
        )}
      </div>
      {creating && (
        <form
          className="flex flex-wrap items-center gap-2 border-b bg-muted/30 p-3"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate(async () => {
              const res = await client["work-items"][":projectId"].$post({
                param: { projectId },
                json: {
                  title,
                  type,
                  parentId: parentId || null,
                  ...(mode === "sprint" && activeSprint
                    ? { sprintId: activeSprint }
                    : {}),
                },
              });
              if (!res.ok) throw Error(await res.text());
              setTitle("");
              setCreating(false);
            });
          }}
        >
          <Input
            aria-label="Work item title"
            placeholder="Title"
            required
            maxLength={1000}
            className="w-64"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <select
            className={selectClass}
            aria-label="New work item type"
            value={type}
            onChange={(event) => {
              setType(event.target.value as typeof type);
              setParentId("");
            }}
          >
            {itemTypes.map((value) => (
              <option key={value} value={value}>
                {labels[value]}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            aria-label="New work item parent"
            value={parentId}
            onChange={(event) => setParentId(event.target.value)}
          >
            <option value="">No parent</option>
            {items
              .filter((item) => accepts(item.type, type))
              .map((item) => (
                <option key={item.id} value={item.id}>
                  #{item.number} {item.title}
                </option>
              ))}
          </select>
          <Button
            type="submit"
            size="sm"
            disabled={mutation.isPending || !title.trim()}
          >
            Create
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setCreating(false)}
          >
            Cancel
          </Button>
        </form>
      )}
      <div className="min-h-0 flex-1 overflow-auto">
        {isPending ? (
          <p className="p-5 text-sm">Loading work items…</p>
        ) : isError ? (
          <Button onClick={() => refetch()}>Retry loading work items</Button>
        ) : mode !== "sprint" ? (
          <>
            {mode === "tree"
              ? items
                  .filter(
                    (item) =>
                      !item.parentId ||
                      !items.some((parent) => parent.id === item.parentId),
                  )
                  .map((item) => row(item, 0, true))
              : filtered.map((item) => row(item, 0, false))}
            {filtered.length === 0 && (
              <p className="p-5 text-sm text-muted-foreground">
                No matching work items.
              </p>
            )}
          </>
        ) : (
          <>
            {!activeSprint && (
              <p className="p-5 text-sm text-muted-foreground">
                Create a sprint using Sprint management, then assign work from
                Backlogs.
              </p>
            )}
            {activeSprint && (
              <div className="min-w-[720px] p-3">
                <div
                  className="grid gap-2 border-b pb-2"
                  style={{
                    gridTemplateColumns: `240px repeat(${Math.max(columns.length, 1)}, minmax(180px, 1fr))`,
                  }}
                >
                  <strong className="text-sm">Backlog Item / Bug</strong>
                  {columns.map((column) => (
                    <strong className="text-sm" key={column.id}>
                      {column.name}
                    </strong>
                  ))}
                </div>
                {items
                  .filter(
                    (item) =>
                      (item.sprintId === activeSprint ||
                        children(item.id).some(
                          (child) => child.sprintId === activeSprint,
                        )) &&
                      (item.type === "backlog_item" || item.type === "bug"),
                  )
                  .map((parent) => (
                    <div
                      key={parent.id}
                      className="grid gap-2 border-b py-3"
                      style={{
                        gridTemplateColumns: `240px repeat(${Math.max(columns.length, 1)}, minmax(180px, 1fr))`,
                      }}
                    >
                      <div>
                        <Button
                          size="xs"
                          variant="ghost"
                          aria-label={`Toggle ${parent.title}`}
                          onClick={() =>
                            setCollapsed((old) => {
                              const next = new Set(old);
                              if (next.has(parent.id)) next.delete(parent.id);
                              else next.add(parent.id);
                              return next;
                            })
                          }
                        >
                          {collapsed.has(parent.id) ? (
                            <ChevronRight className="size-4" />
                          ) : (
                            <ChevronDown className="size-4" />
                          )}
                        </Button>
                        <WorkItemBadge type={parent.type} />
                        <button
                          type="button"
                          className="my-2 block text-left text-sm hover:underline"
                          onClick={() => open(parent.id)}
                        >
                          #{parent.number} {parent.title}
                        </button>
                        <span className="text-xs text-muted-foreground">
                          {progress(parent)}
                        </span>
                        {can("item", "create") && (
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() => add(parent)}
                          >
                            + Task
                          </Button>
                        )}
                      </div>
                      {columns.map((column, index) => (
                        <fieldset
                          aria-label={`${parent.title}: ${column.name}`}
                          key={column.id}
                          onDragOver={(event) => {
                            if (can("item", "transition"))
                              event.preventDefault();
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            const id =
                              event.dataTransfer.getData("text/work-item");
                            const child = children(parent.id).find(
                              (item) => item.id === id,
                            );
                            if (child && can("item", "transition"))
                              mutation.mutate(() =>
                                updateTaskStatus(child.id, {
                                  status: column.slug,
                                }),
                              );
                          }}
                          className="min-h-24 space-y-2 bg-muted/30 p-2"
                        >
                          {children(parent.id)
                            .filter(
                              (child) =>
                                !collapsed.has(parent.id) &&
                                child.sprintId === activeSprint &&
                                matches(child) &&
                                (child.status === column.slug ||
                                  (!columns.some(
                                    (c) => c.slug === child.status,
                                  ) &&
                                    index === 0)),
                            )
                            .map((task) => (
                              <fieldset
                                aria-label={task.title}
                                draggable={can("item", "transition")}
                                onDragStart={(event) =>
                                  event.dataTransfer.setData(
                                    "text/work-item",
                                    task.id,
                                  )
                                }
                                className="rounded border border-l-4 border-l-yellow-700 bg-card p-2"
                                key={task.id}
                              >
                                <WorkItemBadge type={task.type} />
                                <button
                                  type="button"
                                  onClick={() => open(task.id)}
                                  className="my-2 block text-left text-sm hover:underline"
                                >
                                  #{task.number} {task.title}
                                </button>
                                <select
                                  className={selectClass}
                                  aria-label={`Status for ${task.title}`}
                                  disabled={
                                    !can("item", "transition") ||
                                    mutation.isPending
                                  }
                                  value={task.status ?? ""}
                                  onChange={(event) =>
                                    mutation.mutate(() =>
                                      updateTaskStatus(task.id, {
                                        status: event.target.value,
                                      }),
                                    )
                                  }
                                >
                                  <option value="">No status</option>
                                  {columns.map((c) => (
                                    <option key={c.id} value={c.slug}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
                              </fieldset>
                            ))}
                        </fieldset>
                      ))}
                    </div>
                  ))}
                <div className="py-4">
                  <h3 className="mb-2 text-sm font-medium">Unparented work</h3>
                  {filtered
                    .filter(
                      (item) =>
                        item.sprintId === activeSprint &&
                        item.type === "task" &&
                        !item.parentId,
                    )
                    .map((item) => row(item, 0, false))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
