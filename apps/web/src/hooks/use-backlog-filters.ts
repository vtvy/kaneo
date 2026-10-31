import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CREATED_DATE_FILTER_OPTIONS,
  type CreatedDateFilterValue,
} from "@/lib/created-date-filter";

export type BacklogFilterableColumn =
  | "status"
  | "priority"
  | "sprint"
  | "assignee"
  | "creator";

export type BacklogSortableColumn =
  | "number"
  | "title"
  | "status"
  | "priority"
  | "sprint"
  | "assignee"
  | "creator"
  | "createdAt";

export type BacklogFilterState = Partial<
  Record<BacklogFilterableColumn, string[]>
>;

export type BacklogSortState = {
  column: BacklogSortableColumn;
  direction: "asc" | "desc";
} | null;

export type BacklogSavedView = {
  id: string;
  name: string;
  filters: BacklogFilterState;
  createdAtFilters: CreatedDateFilterValue[];
  titleQuery: string;
  sort: BacklogSortState;
  isDefault?: boolean;
  createdAt: string;
};

type PersistedBacklogState = {
  filters: BacklogFilterState;
  createdAtFilters: CreatedDateFilterValue[];
  titleQuery: string;
  sort: BacklogSortState;
};

const FILTERABLE: BacklogFilterableColumn[] = [
  "status",
  "priority",
  "sprint",
  "assignee",
  "creator",
];

const SORTABLE: BacklogSortableColumn[] = [
  "number",
  "title",
  "status",
  "priority",
  "sprint",
  "assignee",
  "creator",
  "createdAt",
];

const CREATED_AT_FILTER_SET = new Set<string>(CREATED_DATE_FILTER_OPTIONS);

export function backlogFiltersStorageKey(projectId: string) {
  return `kaneo:backlog-filters:${projectId}`;
}

export function backlogSavedViewsStorageKey(projectId: string) {
  return `kaneo:backlog-saved-views:${projectId}`;
}

function normalizeFilters(raw: unknown): BacklogFilterState {
  if (!raw || typeof raw !== "object") return {};
  const candidate = raw as Record<string, unknown>;
  const next: BacklogFilterState = {};
  for (const key of FILTERABLE) {
    const value = candidate[key];
    if (!Array.isArray(value)) continue;
    const values = value.filter(
      (item): item is string => typeof item === "string",
    );
    if (values.length > 0) next[key] = values;
  }
  return next;
}

function normalizeCreatedAtFilters(raw: unknown): CreatedDateFilterValue[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is CreatedDateFilterValue =>
      typeof item === "string" && CREATED_AT_FILTER_SET.has(item),
  );
}

function normalizeSort(raw: unknown): BacklogSortState {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as { column?: unknown; direction?: unknown };
  if (
    typeof candidate.column !== "string" ||
    !SORTABLE.includes(candidate.column as BacklogSortableColumn)
  ) {
    return null;
  }
  if (candidate.direction !== "asc" && candidate.direction !== "desc") {
    return null;
  }
  return {
    column: candidate.column as BacklogSortableColumn,
    direction: candidate.direction,
  };
}

function normalizePersistedState(raw: unknown): PersistedBacklogState {
  if (!raw || typeof raw !== "object") {
    return { filters: {}, createdAtFilters: [], titleQuery: "", sort: null };
  }
  const candidate = raw as Partial<PersistedBacklogState>;
  return {
    filters: normalizeFilters(candidate.filters),
    createdAtFilters: normalizeCreatedAtFilters(candidate.createdAtFilters),
    titleQuery:
      typeof candidate.titleQuery === "string" ? candidate.titleQuery : "",
    sort: normalizeSort(candidate.sort),
  };
}

function normalizeSavedViews(raw: unknown): BacklogSavedView[] {
  if (!Array.isArray(raw)) return [];
  const views: BacklogSavedView[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Partial<BacklogSavedView>;
    if (
      typeof candidate.id !== "string" ||
      typeof candidate.name !== "string"
    ) {
      continue;
    }
    const name = candidate.name.trim();
    if (!name) continue;
    views.push({
      id: candidate.id,
      name,
      filters: normalizeFilters(candidate.filters),
      createdAtFilters: normalizeCreatedAtFilters(candidate.createdAtFilters),
      titleQuery:
        typeof candidate.titleQuery === "string" ? candidate.titleQuery : "",
      sort: normalizeSort(candidate.sort),
      isDefault: candidate.isDefault === true,
      createdAt:
        typeof candidate.createdAt === "string"
          ? candidate.createdAt
          : new Date().toISOString(),
    });
  }
  let sawDefault = false;
  return views.map((view) => {
    if (!view.isDefault) return view;
    if (sawDefault) return { ...view, isDefault: false };
    sawDefault = true;
    return view;
  });
}

function readJson(key: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return null;
    return JSON.parse(stored) as unknown;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / private mode
  }
}

function createViewId() {
  // crypto.randomUUID is unavailable outside secure contexts (plain HTTP).
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function isEmptyPersisted(state: PersistedBacklogState) {
  return (
    Object.keys(state.filters).length === 0 &&
    state.createdAtFilters.length === 0 &&
    !state.titleQuery &&
    !state.sort
  );
}

export function useBacklogFilters(projectId: string) {
  const filtersKey = backlogFiltersStorageKey(projectId);
  const viewsKey = backlogSavedViewsStorageKey(projectId);

  const [filters, setFilters] = useState<BacklogFilterState>({});
  const [createdAtFilters, setCreatedAtFilters] = useState<
    CreatedDateFilterValue[]
  >([]);
  const [titleQuery, setTitleQuery] = useState("");
  const [sort, setSort] = useState<BacklogSortState>(null);
  const [savedViews, setSavedViews] = useState<BacklogSavedView[]>([]);
  const [hydratedProjectId, setHydratedProjectId] = useState<string | null>(
    null,
  );
  const hydrated = hydratedProjectId === projectId;

  useEffect(() => {
    const persisted = normalizePersistedState(readJson(filtersKey));
    setFilters(persisted.filters);
    setCreatedAtFilters(persisted.createdAtFilters);
    setTitleQuery(persisted.titleQuery);
    setSort(persisted.sort);

    const views = normalizeSavedViews(readJson(viewsKey));
    setSavedViews(views);

    const defaultView = views.find((view) => view.isDefault);
    if (defaultView && isEmptyPersisted(persisted)) {
      setFilters(defaultView.filters);
      setCreatedAtFilters(defaultView.createdAtFilters);
      setTitleQuery(defaultView.titleQuery);
      setSort(defaultView.sort);
    }

    setHydratedProjectId(projectId);
  }, [filtersKey, viewsKey, projectId]);

  useEffect(() => {
    if (!hydrated) return;
    writeJson(filtersKey, {
      filters,
      createdAtFilters,
      titleQuery,
      sort,
    } satisfies PersistedBacklogState);
  }, [filters, createdAtFilters, titleQuery, sort, filtersKey, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeJson(viewsKey, savedViews);
  }, [savedViews, viewsKey, hydrated]);

  const clearFilters = useCallback(() => {
    setFilters({});
    setCreatedAtFilters([]);
    setTitleQuery("");
    setSort(null);
  }, []);

  const clearAll = clearFilters;

  const hasColumnFilters =
    Object.keys(filters).length > 0 || createdAtFilters.length > 0;
  const hasActiveQuery =
    hasColumnFilters || titleQuery.trim().length > 0 || sort !== null;

  const applyView = useCallback((view: BacklogSavedView) => {
    setFilters(view.filters);
    setCreatedAtFilters(view.createdAtFilters);
    setTitleQuery(view.titleQuery);
    setSort(view.sort);
  }, []);

  const saveView = useCallback(
    (name: string, options?: { isDefault?: boolean }) => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const view: BacklogSavedView = {
        id: createViewId(),
        name: trimmed,
        filters,
        createdAtFilters,
        titleQuery,
        sort,
        isDefault: options?.isDefault === true,
        createdAt: new Date().toISOString(),
      };
      setSavedViews((prev) => {
        const next = options?.isDefault
          ? prev.map((item) => ({ ...item, isDefault: false }))
          : prev;
        return [...next, view];
      });
      return view;
    },
    [filters, createdAtFilters, titleQuery, sort],
  );

  const renameView = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSavedViews((prev) =>
      prev.map((view) => (view.id === id ? { ...view, name: trimmed } : view)),
    );
  }, []);

  const deleteView = useCallback((id: string) => {
    setSavedViews((prev) => prev.filter((view) => view.id !== id));
  }, []);

  const setDefaultView = useCallback((id: string | null) => {
    setSavedViews((prev) =>
      prev.map((view) => ({
        ...view,
        isDefault: id != null && view.id === id,
      })),
    );
  }, []);

  const currentSnapshot = useMemo(
    () => ({ filters, createdAtFilters, titleQuery, sort }),
    [filters, createdAtFilters, titleQuery, sort],
  );

  return {
    filters,
    setFilters,
    createdAtFilters,
    setCreatedAtFilters,
    titleQuery,
    setTitleQuery,
    sort,
    setSort,
    clearFilters,
    clearAll,
    hasColumnFilters,
    hasActiveQuery,
    savedViews,
    applyView,
    saveView,
    renameView,
    deleteView,
    setDefaultView,
    currentSnapshot,
    hydrated,
  };
}
