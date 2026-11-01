import { useNavigate } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowDownAZ,
  ArrowUp,
  ArrowUpAZ,
  Bookmark,
  Check,
  ChevronDown,
  ExternalLink,
  Filter,
  Pencil,
  Search,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ActiveFilterChip from "@/components/common/active-filter-chip";
import TaskSprintPopover from "@/components/sprint/task-sprint-popover";
import TaskAssigneePopover from "@/components/task/task-assignee-popover";
import TaskPriorityPopover from "@/components/task/task-priority-popover";
import TaskStatusPopover from "@/components/task/task-status-popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAllProjectTasks } from "@/hooks/queries/task/use-all-project-tasks";
import {
  type BacklogFilterableColumn,
  type BacklogSortableColumn,
  useBacklogFilters,
} from "@/hooks/use-backlog-filters";
import {
  matchesCustomFieldFilters,
  toggleCustomFieldFilter,
} from "@/lib/backlog-custom-field-filters";
import { cn } from "@/lib/cn";
import { getColumnColorValue } from "@/lib/column";
import {
  CREATED_DATE_FILTER_OPTIONS,
  type CreatedDateFilterValue,
  matchesAnyCreatedDateFilter,
} from "@/lib/created-date-filter";
import { formatDateShort } from "@/lib/format";
import { getPriorityLabel, getStatusDisplayLabel } from "@/lib/i18n/domain";
import { getPriorityBadgeColor, getPriorityIcon } from "@/lib/priority";
import { toast } from "@/lib/toast";
import useBacklogBulkSelectionStore from "@/store/backlog-bulk-selection";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type Task from "@/types/task";
import {
  CustomFieldCell,
  CustomFieldColumnsMenu,
  CustomFieldFilterChips,
  CustomFieldFilterSubmenus,
  useBacklogCustomFields,
} from "./custom-field-columns";

export type BacklogTask = {
  id: string;
  title: string;
  number: number | null;
  status: string | null;
  priority: string | null;
  points: number | null;
  sprintId: string | null;
  sprintName: string | null;
  columnId: string | null;
  columnName: string | null;
  columnColor: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  reporterId: string | null;
  reporterName: string | null;
  reporterImage: string | null;
  dueDate: string | null;
  createdAt: string | null;
  position: number | null;
};

// Build a minimal Task-compatible object from a backlog row so the shared
// task popovers (status/priority/assignee/sprint) can drive inline edits. The
// popovers only read the fields below and submit the whole object to the
// mutation hooks (which key off id/projectId), so unmodeled fields are safe to
// default.
function backlogTaskToTask(task: BacklogTask, projectId: string): Task {
  return {
    id: task.id,
    title: task.title,
    number: task.number,
    description: null,
    status: task.status ?? "",
    priority: task.priority,
    points: task.points,
    startDate: null,
    dueDate: task.dueDate,
    position: task.position,
    createdAt: task.createdAt ?? "",
    userId: task.assigneeId,
    assigneeId: task.assigneeId,
    assigneeName: task.assigneeName,
    reporterId: task.reporterId,
    reporterName: task.reporterName,
    reporterImage: task.reporterImage,
    projectId,
    columnId: task.columnId,
    sprintId: task.sprintId,
  };
}

type SortableColumn = BacklogSortableColumn;
type FilterableColumn = BacklogFilterableColumn;

type BacklogTableProps = {
  projectId: string;
  workspaceId: string;
  projectSlug?: string;
};

const FILTERABLE_COLUMNS: FilterableColumn[] = [
  "status",
  "priority",
  "sprint",
  "assignee",
  "creator",
];

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
  "no-priority": 0,
};

function compareText(a: string, b: string) {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function CheckSlot({ checked }: { checked: boolean }) {
  return (
    <span
      className={`inline-flex size-4 shrink-0 items-center justify-center rounded-lg border ${
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background"
      }`}
    >
      {checked ? "✓" : null}
    </span>
  );
}

function BacklogTable({
  projectId,
  workspaceId,
  projectSlug,
}: BacklogTableProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useAllProjectTasks(projectId);
  const [saveName, setSaveName] = useState("");
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [editingView, setEditingView] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);

  const {
    filters,
    setFilters,
    createdAtFilters,
    setCreatedAtFilters,
    customFieldFilters,
    setCustomFieldFilters,
    customFieldColumns,
    setCustomFieldColumns,
    titleQuery,
    setTitleQuery,
    sort,
    setSort,
    clearFilters,
    hasColumnFilters,
    hasActiveQuery,
    savedViews,
    applyView,
    saveView,
    renameView,
    deleteView,
    setDefaultView,
  } = useBacklogFilters(projectId);

  const hasCustomFieldFilters = Object.keys(customFieldFilters).length > 0;
  const {
    fields: customFields,
    valuesByTask,
    valuesLoaded,
  } = useBacklogCustomFields(
    projectId,
    customFieldColumns.length > 0 || hasCustomFieldFilters,
  );
  const visibleCustomFields = customFields.filter((field) =>
    customFieldColumns.includes(field.id),
  );

  const tasks = useMemo<BacklogTask[]>(
    () => (Array.isArray(data) ? (data as BacklogTask[]) : []),
    [data],
  );

  // Display-value helpers — keep filtering/sorting consistent with rendering.
  const statusValue = useCallback(
    (task: BacklogTask) =>
      task.status
        ? getStatusDisplayLabel(task.status, task.columnName ?? undefined)
        : t("backlog:noStatus"),
    [t],
  );
  const priorityValue = useCallback(
    (task: BacklogTask) =>
      task.priority
        ? getPriorityLabel(task.priority)
        : getPriorityLabel("no-priority"),
    [],
  );
  const sprintValue = useCallback(
    (task: BacklogTask) => task.sprintName ?? t("backlog:none"),
    [t],
  );
  const assigneeValue = useCallback(
    (task: BacklogTask) => task.assigneeName ?? t("tasks:assignee.unassigned"),
    [t],
  );
  const creatorValue = useCallback(
    (task: BacklogTask) => task.reporterName ?? t("backlog:unknownCreator"),
    [t],
  );

  const filterValue = useCallback(
    (task: BacklogTask, column: SortableColumn): string => {
      switch (column) {
        case "createdAt":
          return task.createdAt ?? "";
        case "number":
          return task.number != null ? String(task.number) : "";
        case "title":
          return task.title ?? "";
        case "status":
          return statusValue(task) ?? "";
        case "priority":
          return priorityValue(task) ?? "";
        case "sprint":
          return sprintValue(task) ?? "";
        case "assignee":
          return assigneeValue(task) ?? "";
        case "creator":
          return creatorValue(task) ?? "";
      }
    },
    [statusValue, priorityValue, sprintValue, assigneeValue, creatorValue],
  );

  // Distinct values per filterable column, for the "Filter by value" submenu.
  const distinctValues = useMemo(() => {
    const map: Record<FilterableColumn, Set<string>> = {
      status: new Set(),
      priority: new Set(),
      sprint: new Set(),
      assignee: new Set(),
      creator: new Set(),
    };
    for (const task of tasks) {
      map.status.add(filterValue(task, "status"));
      map.priority.add(filterValue(task, "priority"));
      map.sprint.add(filterValue(task, "sprint"));
      map.assignee.add(filterValue(task, "assignee"));
      map.creator.add(filterValue(task, "creator"));
    }
    return map;
  }, [tasks, filterValue]);

  const processedTasks = useMemo(() => {
    let result = tasks;

    const normalizedTitleQuery = titleQuery.trim().toLowerCase();
    if (normalizedTitleQuery) {
      result = result.filter((task) =>
        (task.title ?? "").toLowerCase().includes(normalizedTitleQuery),
      );
    }

    for (const key of FILTERABLE_COLUMNS) {
      const wanted = filters[key];
      if (!wanted || wanted.length === 0) continue;
      result = result.filter((task) => wanted.includes(filterValue(task, key)));
    }

    if (hasCustomFieldFilters && valuesLoaded) {
      result = result.filter((task) =>
        matchesCustomFieldFilters(
          valuesByTask.get(task.id),
          customFieldFilters,
          customFields,
        ),
      );
    }

    if (createdAtFilters.length > 0) {
      result = result.filter((task) =>
        matchesAnyCreatedDateFilter(
          task.createdAt,
          createdAtFilters,
          weekStartsOn,
        ),
      );
    }

    if (sort) {
      const dir = sort.direction === "asc" ? 1 : -1;
      result = [...result].sort((a, b) => {
        if (sort.column === "number") {
          return ((a.number ?? 0) - (b.number ?? 0)) * dir;
        }
        if (sort.column === "priority") {
          const pa = PRIORITY_ORDER[a.priority ?? "no-priority"] ?? 0;
          const pb = PRIORITY_ORDER[b.priority ?? "no-priority"] ?? 0;
          return (pa - pb) * dir;
        }
        if (sort.column === "createdAt") {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return (ta - tb) * dir;
        }
        return (
          compareText(
            filterValue(a, sort.column),
            filterValue(b, sort.column),
          ) * dir
        );
      });
    }

    return result;
  }, [
    tasks,
    filters,
    createdAtFilters,
    sort,
    filterValue,
    titleQuery,
    weekStartsOn,
    hasCustomFieldFilters,
    valuesLoaded,
    valuesByTask,
    customFieldFilters,
    customFields,
  ]);

  const setAvailableTasks = useBacklogBulkSelectionStore(
    (state) => state.setAvailableTasks,
  );
  const selectRange = useBacklogBulkSelectionStore(
    (state) => state.selectRange,
  );
  const setSelectionAnchor = useBacklogBulkSelectionStore(
    (state) => state.setSelectionAnchor,
  );
  const toggleSelection = useBacklogBulkSelectionStore(
    (state) => state.toggleSelection,
  );
  const selectedTaskIds = useBacklogBulkSelectionStore(
    (state) => state.selectedTaskIds,
  );
  const visibleTaskIds = useMemo(
    () => processedTasks.map((task) => task.id),
    [processedTasks],
  );

  useEffect(() => {
    // The first render has no rows yet. Publishing that empty list would drop
    // the shift-click anchor before the tasks arrive.
    if (visibleTaskIds.length === 0) return;
    setAvailableTasks(visibleTaskIds);
  }, [setAvailableTasks, visibleTaskIds]);

  const handleOpenTask = (taskId: string) => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
      params: { workspaceId, projectId, taskId },
    });
  };

  const toggleColumnFilter = (column: FilterableColumn, value: string) => {
    setFilters((prev) => {
      const current = prev[column] ?? [];
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      const copy = { ...prev };
      if (next.length === 0) {
        delete copy[column];
      } else {
        copy[column] = next;
      }
      return copy;
    });
  };

  const clearColumnFilter = (column: FilterableColumn) => {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[column];
      return next;
    });
  };

  const clearCustomFieldFilter = (fieldId: string) => {
    setCustomFieldFilters((prev) => {
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  };

  const toggleCreatedAtFilter = (value: CreatedDateFilterValue) => {
    setCreatedAtFilters((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value],
    );
  };

  const handleSaveView = () => {
    const view = saveView(saveName, { isDefault: saveAsDefault });
    if (!view) {
      toast.error(t("backlog:savedViews.nameRequired"));
      return;
    }
    setSaveName("");
    setSaveAsDefault(false);
    toast.success(t("backlog:savedViews.saved", { name: view.name }));
  };

  const handleRenameView = () => {
    if (!editingView?.name.trim()) return;
    renameView(editingView.id, editingView.name);
    setEditingView(null);
  };

  const columns: Array<{
    key: SortableColumn;
    label: string;
    filterable: boolean;
    className?: string;
  }> = [
    {
      key: "number",
      label: t("backlog:columns.id"),
      filterable: false,
      className: "w-20",
    },
    { key: "title", label: t("backlog:columns.title"), filterable: false },
    {
      key: "status",
      label: t("backlog:columns.status"),
      filterable: true,
      className: "w-40",
    },
    {
      key: "priority",
      label: t("backlog:columns.priority"),
      filterable: true,
      className: "w-36",
    },
    {
      key: "sprint",
      label: t("backlog:columns.sprint"),
      filterable: true,
      className: "w-40",
    },
    {
      key: "assignee",
      label: t("backlog:columns.assignee"),
      filterable: true,
      className: "w-44",
    },
    {
      key: "creator",
      label: t("backlog:columns.creator"),
      filterable: true,
      className: "w-44",
    },
    {
      key: "createdAt",
      label: t("backlog:columns.createdAt"),
      filterable: false,
      className: "w-28",
    },
  ];

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="w-full max-w-3xl space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
              key={i}
              className="h-9 w-full animate-pulse rounded-md bg-muted"
            />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">{t("backlog:error")}</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          {t("common:actions.reset")}
        </Button>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm font-medium text-foreground">
          {t("backlog:empty.title")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("backlog:empty.description")}
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-border/80 border-b bg-card/80 backdrop-blur supports-backdrop-filter:bg-card/70">
          <div className="flex min-h-10 items-center px-2 py-1.5 md:px-3">
            <div className="flex w-full flex-wrap items-center gap-1.5">
              <div className="relative w-55 max-w-full">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={titleQuery}
                  onChange={(event) => setTitleQuery(event.target.value)}
                  placeholder={t("backlog:searchTitle")}
                  className="h-7 **:data-[slot=input]:h-7 **:data-[slot=input]:leading-7 **:data-[slot=input]:pl-8 **:data-[slot=input]:text-xs **:data-[slot=input]:placeholder:text-xs"
                  aria-label={t("backlog:searchTitle")}
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className={cn(
                        "inline-flex h-7 items-center gap-1.5 rounded-md border bg-background px-2.5 text-xs font-medium outline-none ring-0 hover:bg-accent/60",
                        hasColumnFilters
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border text-foreground",
                      )}
                    />
                  }
                >
                  <Filter className="h-3 w-3" />
                  {t("common:actions.filter")}
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="start">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
                      {t("tasks:boardFilters.filterBy")}
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  {FILTERABLE_COLUMNS.map((columnKey) => {
                    const selected = filters[columnKey] ?? [];
                    const options = [...distinctValues[columnKey]].sort(
                      compareText,
                    );
                    const subjectLabel = t(`backlog:columns.${columnKey}`);
                    const allLabel =
                      columnKey === "status"
                        ? t("tasks:boardFilters.allStatuses")
                        : columnKey === "priority"
                          ? t("tasks:boardFilters.allPriorities")
                          : columnKey === "assignee"
                            ? t("tasks:boardFilters.allAssignees")
                            : columnKey === "creator"
                              ? t("tasks:boardFilters.allCreators")
                              : t("backlog:filter.allValues");
                    return (
                      <DropdownMenuSub key={columnKey}>
                        <DropdownMenuSubTrigger className="h-8 rounded-md text-sm">
                          {subjectLabel}
                          {selected.length > 0 ? (
                            <span className="ml-auto me-1 text-[10px] text-muted-foreground">
                              {selected.length}
                            </span>
                          ) : null}
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-64">
                          <div className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto p-1">
                            <button
                              type="button"
                              className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-xs ${
                                selected.length === 0
                                  ? "bg-accent text-accent-foreground"
                                  : "text-foreground/90 hover:bg-accent/60 hover:text-foreground"
                              }`}
                              onClick={() => clearColumnFilter(columnKey)}
                            >
                              <CheckSlot checked={selected.length === 0} />
                              {allLabel}
                            </button>
                            {options.map((value) => {
                              const checked = selected.includes(value);
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-xs ${
                                    checked
                                      ? "bg-accent text-accent-foreground"
                                      : "text-foreground/90 hover:bg-accent/60 hover:text-foreground"
                                  }`}
                                  onClick={() =>
                                    toggleColumnFilter(columnKey, value)
                                  }
                                >
                                  <CheckSlot checked={checked} />
                                  <span className="truncate">{value}</span>
                                </button>
                              );
                            })}
                          </div>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    );
                  })}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="h-8 rounded-md text-sm">
                      {t("backlog:columns.createdAt")}
                      {createdAtFilters.length > 0 ? (
                        <span className="ml-auto me-1 text-[10px] text-muted-foreground">
                          {createdAtFilters.length}
                        </span>
                      ) : null}
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-64">
                      <div className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto p-1">
                        <button
                          type="button"
                          className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-xs ${
                            createdAtFilters.length === 0
                              ? "bg-accent text-accent-foreground"
                              : "text-foreground/90 hover:bg-accent/60 hover:text-foreground"
                          }`}
                          onClick={() => setCreatedAtFilters([])}
                        >
                          <CheckSlot checked={createdAtFilters.length === 0} />
                          {t("tasks:boardFilters.allCreatedDates")}
                        </button>
                        {CREATED_DATE_FILTER_OPTIONS.map((value) => {
                          const checked = createdAtFilters.includes(value);
                          return (
                            <button
                              key={value}
                              type="button"
                              className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-left text-xs ${
                                checked
                                  ? "bg-accent text-accent-foreground"
                                  : "text-foreground/90 hover:bg-accent/60 hover:text-foreground"
                              }`}
                              onClick={() => toggleCreatedAtFilter(value)}
                            >
                              <CheckSlot checked={checked} />
                              <span className="truncate">
                                {t(`tasks:boardFilters.createdDate.${value}`)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <CustomFieldFilterSubmenus
                    fields={customFields}
                    filters={customFieldFilters}
                    onToggle={(fieldId, value) =>
                      setCustomFieldFilters((prev) =>
                        toggleCustomFieldFilter(prev, fieldId, value),
                      )
                    }
                    onClear={clearCustomFieldFilter}
                  />
                  {hasActiveQuery ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => clearFilters()}
                        className="h-8 rounded-md text-sm text-muted-foreground"
                      >
                        {t("common:actions.clearAllFilters")}
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu
                onOpenChange={(open) => {
                  if (!open) setEditingView(null);
                }}
              >
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className={cn(
                        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium outline-none ring-0",
                        savedViews.length > 0
                          ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                          : "border-border bg-background text-foreground hover:bg-accent/60",
                      )}
                    />
                  }
                >
                  <Bookmark className="h-3 w-3" />
                  {t("backlog:savedViews.label")}
                  {savedViews.length > 0 ? (
                    <span className="text-[10px] text-muted-foreground">
                      {savedViews.length}
                    </span>
                  ) : null}
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-72" align="start">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
                      {t("backlog:savedViews.label")}
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  {savedViews.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-muted-foreground">
                      {t("backlog:savedViews.empty")}
                    </div>
                  ) : (
                    savedViews.map((view) => (
                      <div
                        key={view.id}
                        className="flex items-center gap-1 px-1 py-0.5"
                      >
                        {editingView?.id === view.id ? (
                          <>
                            <Input
                              autoFocus
                              aria-label={t("backlog:savedViews.nameLabel")}
                              value={editingView.name}
                              onChange={(event) =>
                                setEditingView({
                                  id: view.id,
                                  name: event.target.value,
                                })
                              }
                              onKeyDown={(event) => {
                                event.stopPropagation();
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  handleRenameView();
                                }
                                if (event.key === "Escape")
                                  setEditingView(null);
                              }}
                              className="min-w-0 flex-1"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              aria-label={t("backlog:savedViews.saveName")}
                              disabled={!editingView.name.trim()}
                              onClick={handleRenameView}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              aria-label={t("common:actions.cancel")}
                              onClick={() => setEditingView(null)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent/60"
                              onClick={() => applyView(view)}
                            >
                              <span className="inline-flex items-center gap-1.5">
                                {view.isDefault ? (
                                  <Star className="h-3 w-3 fill-current text-primary" />
                                ) : null}
                                <span className="truncate">{view.name}</span>
                              </span>
                            </button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              title={t("backlog:savedViews.rename")}
                              aria-label={t("backlog:savedViews.rename")}
                              onClick={() =>
                                setEditingView({ id: view.id, name: view.name })
                              }
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              title={t("backlog:savedViews.setDefault")}
                              onClick={() =>
                                setDefaultView(view.isDefault ? null : view.id)
                              }
                            >
                              <Star
                                className={cn(
                                  "h-3.5 w-3.5",
                                  view.isDefault && "fill-current text-primary",
                                )}
                              />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                              title={t("backlog:savedViews.delete")}
                              onClick={() => deleteView(view.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    ))
                  )}
                  <DropdownMenuSeparator />
                  <div className="flex flex-col gap-1.5 px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={saveName}
                        onChange={(event) => setSaveName(event.target.value)}
                        placeholder={t("backlog:savedViews.namePlaceholder")}
                        className="h-7 **:data-[slot=input]:h-7 **:data-[slot=input]:text-xs"
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            handleSaveView();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 shrink-0"
                        disabled={!saveName.trim()}
                        onClick={handleSaveView}
                      >
                        {t("backlog:savedViews.save")}
                      </Button>
                    </div>
                    <label className="flex items-center gap-2 px-0.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={saveAsDefault}
                        onChange={(event) =>
                          setSaveAsDefault(event.target.checked)
                        }
                        className="rounded border-border"
                      />
                      {t("backlog:savedViews.saveAsDefault")}
                    </label>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu
                onOpenChange={(open) => {
                  if (!open) setEditingView(null);
                }}
              >
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      className={cn(
                        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium outline-none ring-0",
                        sort
                          ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15"
                          : "border-border bg-background text-foreground hover:bg-accent/60",
                      )}
                    />
                  }
                >
                  {sort?.direction === "desc" ? (
                    <ArrowDownAZ className="h-3 w-3" />
                  ) : (
                    <ArrowUpAZ className="h-3 w-3" />
                  )}
                  {sort
                    ? columns.find((column) => column.key === sort.column)
                        ?.label
                    : t("tasks:sort.label")}
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-52" align="start">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
                      {t("tasks:sort.by")}
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setSort(null)}
                    className="h-8 rounded-md text-sm"
                  >
                    <CheckSlot checked={!sort} />
                    {t("common:actions.reset")}
                  </DropdownMenuItem>
                  {columns.map((column) => (
                    <DropdownMenuItem
                      key={column.key}
                      onClick={() =>
                        setSort({
                          column: column.key,
                          direction: column.key === "priority" ? "desc" : "asc",
                        })
                      }
                      className="h-8 rounded-md text-sm"
                    >
                      <CheckSlot checked={sort?.column === column.key} />
                      {column.label}
                    </DropdownMenuItem>
                  ))}
                  {sort ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
                          {t("tasks:sort.direction")}
                        </DropdownMenuLabel>
                      </DropdownMenuGroup>
                      <DropdownMenuItem
                        onClick={() => setSort({ ...sort, direction: "asc" })}
                        className="h-8 rounded-md text-sm"
                      >
                        <CheckSlot checked={sort.direction === "asc"} />
                        {t("tasks:sort.ascending")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setSort({ ...sort, direction: "desc" })}
                        className="h-8 rounded-md text-sm"
                      >
                        <CheckSlot checked={sort.direction === "desc"} />
                        {t("tasks:sort.descending")}
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>

              {sort ? (
                <button
                  type="button"
                  onClick={() =>
                    setSort({
                      ...sort,
                      direction: sort.direction === "asc" ? "desc" : "asc",
                    })
                  }
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-accent/60"
                  title={
                    sort.direction === "asc"
                      ? t("tasks:sort.ascending")
                      : t("tasks:sort.descending")
                  }
                >
                  {sort.direction === "asc" ? (
                    <ArrowUpAZ className="h-3 w-3" />
                  ) : (
                    <ArrowDownAZ className="h-3 w-3" />
                  )}
                </button>
              ) : null}

              <CustomFieldColumnsMenu
                fields={customFields}
                visible={customFieldColumns}
                onChange={setCustomFieldColumns}
              />

              {FILTERABLE_COLUMNS.map((columnKey) => {
                const selected = filters[columnKey] ?? [];
                if (selected.length === 0) return null;
                return (
                  <ActiveFilterChip
                    key={columnKey}
                    subject={t(`backlog:columns.${columnKey}`)}
                    operator={t("tasks:boardFilters.operators.isAnyOf")}
                    value={
                      selected.length === 1
                        ? selected[0]
                        : t("tasks:boardFilters.selectedCount", {
                            count: selected.length,
                          })
                    }
                    onClear={() => clearColumnFilter(columnKey)}
                  />
                );
              })}
              {createdAtFilters.length > 0 ? (
                <ActiveFilterChip
                  subject={t("backlog:columns.createdAt")}
                  operator={t("tasks:boardFilters.operators.isAnyOf")}
                  value={
                    createdAtFilters.length === 1
                      ? t(
                          `tasks:boardFilters.createdDate.${createdAtFilters[0]}`,
                        )
                      : t("tasks:boardFilters.selectedCount", {
                          count: createdAtFilters.length,
                        })
                  }
                  onClear={() => setCreatedAtFilters([])}
                />
              ) : null}
              <CustomFieldFilterChips
                fields={customFields}
                filters={customFieldFilters}
                onClear={clearCustomFieldFilter}
              />
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="hover:bg-transparent">
                {columns.map((column) => {
                  const isSorted = sort?.column === column.key;
                  const filterKey = column.filterable
                    ? (column.key as FilterableColumn)
                    : null;
                  const isFiltered =
                    filterKey != null && (filters[filterKey]?.length ?? 0) > 0;
                  const filterOptions = filterKey
                    ? [...distinctValues[filterKey]].sort(compareText)
                    : [];
                  return (
                    <TableHead
                      key={column.key}
                      className={cn("select-none", column.className)}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <button
                              type="button"
                              className={cn(
                                "group/header -mx-1 flex h-7 items-center gap-1 rounded px-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground",
                                (isSorted || isFiltered) && "text-foreground",
                              )}
                            />
                          }
                        >
                          <span>{column.label}</span>
                          {isSorted ? (
                            sort?.direction === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )
                          ) : null}
                          {isFiltered && (
                            <Filter className="h-3 w-3 text-primary" />
                          )}
                          <ChevronDown className="h-3 w-3 opacity-0 transition-opacity group-hover/header:opacity-60" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                          <DropdownMenuItem
                            onClick={() =>
                              setSort({
                                column: column.key,
                                direction: "asc",
                              })
                            }
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                            {t("backlog:sort.asc")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setSort({
                                column: column.key,
                                direction: "desc",
                              })
                            }
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                            {t("backlog:sort.desc")}
                          </DropdownMenuItem>
                          {isSorted && (
                            <DropdownMenuItem onClick={() => setSort(null)}>
                              {t("backlog:sort.clear")}
                            </DropdownMenuItem>
                          )}

                          {filterKey && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuGroup>
                                <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
                                  {t("backlog:filter.byValue")}
                                </DropdownMenuLabel>
                              </DropdownMenuGroup>
                              <div className="max-h-56 overflow-y-auto p-1">
                                {filterOptions.map((value) => {
                                  const checked =
                                    filters[filterKey]?.includes(value) ??
                                    false;
                                  return (
                                    <button
                                      key={value}
                                      type="button"
                                      className={cn(
                                        "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                                        checked && "bg-accent/60",
                                      )}
                                      onClick={() =>
                                        toggleColumnFilter(filterKey, value)
                                      }
                                    >
                                      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                                        {checked ? (
                                          <Check className="h-3.5 w-3.5" />
                                        ) : null}
                                      </span>
                                      <span className="truncate">{value}</span>
                                    </button>
                                  );
                                })}
                              </div>
                              {isFiltered && (
                                <DropdownMenuItem
                                  onClick={() => clearColumnFilter(filterKey)}
                                  className="text-muted-foreground"
                                >
                                  {t("backlog:filter.clear")}
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableHead>
                  );
                })}
                {visibleCustomFields.map((field) => (
                  <TableHead
                    key={field.id}
                    className="w-40 select-none text-xs font-medium text-muted-foreground"
                  >
                    <span className="block truncate" title={field.name}>
                      {field.name}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedTasks.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={columns.length + visibleCustomFields.length}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    {t("backlog:noMatch")}
                  </TableCell>
                </TableRow>
              ) : (
                processedTasks.map((task) => {
                  const editableTask = backlogTaskToTask(task, projectId);
                  return (
                    <TableRow
                      key={task.id}
                      data-selected={selectedTaskIds.has(task.id) || undefined}
                      className={cn(
                        "group cursor-pointer",
                        selectedTaskIds.has(task.id) && "bg-accent/60",
                      )}
                      onClick={(event) => {
                        if (event.shiftKey) {
                          event.preventDefault();
                          selectRange(task.id);
                          return;
                        }
                        if (event.metaKey || event.ctrlKey) {
                          event.preventDefault();
                          toggleSelection(task.id);
                          return;
                        }
                        setSelectionAnchor(task.id);
                        handleOpenTask(task.id);
                      }}
                    >
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {projectSlug && task.number != null
                          ? `${projectSlug.toUpperCase()}-${task.number}`
                          : task.number != null
                            ? `#${task.number}`
                            : "—"}
                      </TableCell>
                      <TableCell className="max-w-md">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-foreground">
                            {task.title}
                          </span>
                          {task.points != null && (
                            <span className="inline-flex shrink-0 items-center rounded border border-border/70 bg-muted/55 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {t("tasks:points.unit", { n: task.points })}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <TaskStatusPopover task={editableTask}>
                          <button
                            type="button"
                            className="max-w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {task.status ? (
                              <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/70 bg-muted/55 px-2 py-0.5 text-xs font-medium text-foreground transition-colors hover:bg-muted">
                                <span
                                  className="h-2 w-2 shrink-0 rounded-full border border-border/40"
                                  style={{
                                    backgroundColor: getColumnColorValue(
                                      task.columnColor,
                                    ),
                                  }}
                                  aria-hidden="true"
                                />
                                <span className="truncate">
                                  {getStatusDisplayLabel(
                                    task.status,
                                    task.columnName ?? undefined,
                                  )}
                                </span>
                              </span>
                            ) : (
                              <span className="italic text-muted-foreground/70 hover:text-muted-foreground">
                                {t("backlog:noStatus")}
                              </span>
                            )}
                          </button>
                        </TaskStatusPopover>
                      </TableCell>
                      <TableCell>
                        <TaskPriorityPopover task={editableTask}>
                          <button
                            type="button"
                            className="max-w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80",
                                getPriorityBadgeColor(
                                  task.priority ?? "no-priority",
                                ),
                              )}
                            >
                              {getPriorityIcon(task.priority ?? "no-priority")}
                              <span className="truncate">
                                {priorityValue(task)}
                              </span>
                            </span>
                          </button>
                        </TaskPriorityPopover>
                      </TableCell>
                      <TableCell>
                        <TaskSprintPopover task={editableTask}>
                          <button
                            type="button"
                            className="max-w-full rounded-md px-1.5 py-0.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {task.sprintName ? (
                              <span className="truncate text-foreground">
                                {task.sprintName}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">
                                {t("backlog:none")}
                              </span>
                            )}
                          </button>
                        </TaskSprintPopover>
                      </TableCell>
                      <TableCell>
                        <TaskAssigneePopover
                          task={editableTask}
                          workspaceId={workspaceId}
                        >
                          <button
                            type="button"
                            className="flex min-w-0 items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {task.assigneeId ? (
                              <>
                                <Avatar className="h-6 w-6 shrink-0">
                                  <AvatarImage
                                    src=""
                                    alt={task.assigneeName ?? ""}
                                  />
                                  <AvatarFallback className="border border-border/30 text-xs font-medium">
                                    {task.assigneeName
                                      ?.charAt(0)
                                      .toUpperCase() ?? "?"}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="truncate text-foreground">
                                  {task.assigneeName}
                                </span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">
                                {t("tasks:assignee.unassigned")}
                              </span>
                            )}
                          </button>
                        </TaskAssigneePopover>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-between gap-2">
                          {task.reporterId ? (
                            <div className="flex min-w-0 items-center gap-2 px-1 py-0.5">
                              <Avatar className="h-6 w-6 shrink-0">
                                <AvatarImage
                                  src={task.reporterImage ?? ""}
                                  alt={task.reporterName ?? ""}
                                />
                                <AvatarFallback className="border border-border/30 text-xs font-medium">
                                  {task.reporterName?.charAt(0).toUpperCase() ??
                                    "?"}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate text-foreground">
                                {task.reporterName ??
                                  t("backlog:unknownCreator")}
                              </span>
                            </div>
                          ) : (
                            <span className="px-1 text-muted-foreground">
                              {t("backlog:unknownCreator")}
                            </span>
                          )}
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenTask(task.id);
                                  }}
                                />
                              }
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </TooltipTrigger>
                            <TooltipContent>{t("backlog:open")}</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {task.createdAt ? formatDateShort(task.createdAt) : "—"}
                      </TableCell>
                      {visibleCustomFields.map((field) => (
                        <TableCell key={field.id} className="max-w-40">
                          <CustomFieldCell
                            field={field}
                            value={valuesByTask.get(task.id)?.get(field.id)}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default BacklogTable;
