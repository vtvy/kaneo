import { act, renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  backlogFiltersStorageKey,
  backlogSavedViewsStorageKey,
  useBacklogFilters,
} from "./use-backlog-filters";

describe("useBacklogFilters", () => {
  const projectId = "project-1";
  const filtersKey = backlogFiltersStorageKey(projectId);
  const viewsKey = backlogSavedViewsStorageKey(projectId);

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("restores sticky filters, title query, and sort from storage", async () => {
    window.localStorage.setItem(
      filtersKey,
      JSON.stringify({
        filters: { assignee: ["Alice"], status: ["Todo"] },
        titleQuery: "login",
        sort: { column: "priority", direction: "desc" },
      }),
    );

    const { result } = renderHook(() => useBacklogFilters(projectId));

    await waitFor(() => {
      expect(result.current.hydrated).toBe(true);
    });

    expect(result.current.filters).toEqual({
      assignee: ["Alice"],
      status: ["Todo"],
    });
    expect(result.current.titleQuery).toBe("login");
    expect(result.current.sort).toEqual({
      column: "priority",
      direction: "desc",
    });
  });

  it("persists filter changes and clears them", async () => {
    const { result } = renderHook(() => useBacklogFilters(projectId));

    await waitFor(() => {
      expect(result.current.hydrated).toBe(true);
    });

    act(() => {
      result.current.setFilters({ sprint: ["Sprint 1"] });
      result.current.setTitleQuery("bug");
      result.current.setSort({ column: "title", direction: "asc" });
    });

    await waitFor(() => {
      const stored = JSON.parse(
        window.localStorage.getItem(filtersKey) ?? "{}",
      ) as {
        filters: Record<string, string[]>;
        titleQuery: string;
        sort: { column: string; direction: string } | null;
      };
      expect(stored.filters).toEqual({ sprint: ["Sprint 1"] });
      expect(stored.titleQuery).toBe("bug");
      expect(stored.sort).toEqual({ column: "title", direction: "asc" });
    });

    act(() => {
      result.current.clearAll();
    });

    await waitFor(() => {
      const stored = JSON.parse(
        window.localStorage.getItem(filtersKey) ?? "{}",
      ) as {
        filters: Record<string, string[]>;
        titleQuery: string;
        sort: unknown;
      };
      expect(stored.filters).toEqual({});
      expect(stored.titleQuery).toBe("");
      expect(stored.sort).toBeNull();
    });
  });

  it("falls back safely when storage JSON is corrupt", async () => {
    window.localStorage.setItem(filtersKey, "{not-json");

    const { result } = renderHook(() => useBacklogFilters(projectId));

    await waitFor(() => {
      expect(result.current.hydrated).toBe(true);
    });

    expect(result.current.filters).toEqual({});
    expect(result.current.titleQuery).toBe("");
    expect(result.current.sort).toBeNull();
  });

  it("saves, applies, renames, deletes, and defaults named views", async () => {
    const { result } = renderHook(() => useBacklogFilters(projectId));

    await waitFor(() => {
      expect(result.current.hydrated).toBe(true);
    });

    act(() => {
      result.current.setFilters({ priority: ["High"] });
      result.current.setTitleQuery("qc");
    });

    let savedId = "";
    act(() => {
      const view = result.current.saveView("QC — my bugs", {
        isDefault: true,
      });
      savedId = view?.id ?? "";
    });

    expect(savedId).toBeTruthy();
    expect(result.current.savedViews).toHaveLength(1);
    expect(result.current.savedViews[0]?.name).toBe("QC — my bugs");
    expect(result.current.savedViews[0]?.isDefault).toBe(true);

    act(() => {
      result.current.clearAll();
    });
    expect(result.current.filters).toEqual({});
    expect(result.current.titleQuery).toBe("");

    act(() => {
      const view = result.current.savedViews[0];
      if (view) result.current.applyView(view);
    });
    expect(result.current.filters).toEqual({ priority: ["High"] });
    expect(result.current.titleQuery).toBe("qc");

    act(() => {
      result.current.renameView(savedId, "QC bugs");
      result.current.setDefaultView(savedId);
    });
    expect(result.current.savedViews[0]?.name).toBe("QC bugs");
    expect(result.current.savedViews[0]?.isDefault).toBe(true);

    await waitFor(() => {
      const stored = JSON.parse(
        window.localStorage.getItem(viewsKey) ?? "[]",
      ) as Array<{ id: string; isDefault?: boolean }>;
      expect(stored).toHaveLength(1);
      expect(stored[0]?.isDefault).toBe(true);
    });

    act(() => {
      result.current.deleteView(savedId);
    });
    expect(result.current.savedViews).toHaveLength(0);
  });

  it("applies default view when sticky state is empty on hydrate", async () => {
    window.localStorage.setItem(
      viewsKey,
      JSON.stringify([
        {
          id: "view-1",
          name: "Default QC",
          filters: { assignee: ["Bob"] },
          titleQuery: "regression",
          sort: null,
          isDefault: true,
          createdAt: "2026-10-14T00:00:00.000Z",
        },
      ]),
    );

    const { result } = renderHook(() => useBacklogFilters(projectId));

    await waitFor(() => {
      expect(result.current.hydrated).toBe(true);
    });

    expect(result.current.filters).toEqual({ assignee: ["Bob"] });
    expect(result.current.titleQuery).toBe("regression");
  });

  it("keeps project storage keys isolated", () => {
    expect(backlogFiltersStorageKey("a")).not.toBe(
      backlogFiltersStorageKey("b"),
    );
    expect(backlogSavedViewsStorageKey("a")).not.toBe(
      backlogSavedViewsStorageKey("b"),
    );
  });
});

describe("backlog filter persistence lifecycle", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("clear filters resets search and sort and remains empty after remount", () => {
    const first = renderHook(() => useBacklogFilters("a"));
    act(() => {
      first.result.current.setFilters({ status: ["Todo"] });
      first.result.current.setTitleQuery("bug");
      first.result.current.setSort({ column: "title", direction: "asc" });
    });
    act(() => first.result.current.clearFilters());
    expect(first.result.current.sort).toBeNull();
    first.unmount();
    const second = renderHook(() => useBacklogFilters("a"));
    expect(second.result.current.currentSnapshot).toEqual({
      filters: {},
      createdAtFilters: [],
      titleQuery: "",
      sort: null,
    });
  });

  it("never writes project A filters or views under project B keys", () => {
    window.localStorage.setItem(
      backlogFiltersStorageKey("b"),
      JSON.stringify({
        filters: { status: ["Done"] },
        titleQuery: "b",
        sort: null,
      }),
    );
    window.localStorage.setItem(
      backlogSavedViewsStorageKey("b"),
      JSON.stringify([
        {
          id: "b-view",
          name: "B",
          filters: {},
          titleQuery: "",
          sort: null,
          createdAt: "2026-10-14",
        },
      ]),
    );
    const { result, rerender } = renderHook(({ id }) => useBacklogFilters(id), {
      initialProps: { id: "a" },
      wrapper: StrictMode,
    });
    act(() => result.current.setTitleQuery("a"));
    act(() => result.current.saveView("A"));
    const writes = vi.spyOn(window.localStorage, "setItem");
    rerender({ id: "b" });
    expect(result.current.titleQuery).toBe("b");
    expect(result.current.savedViews[0]?.name).toBe("B");
    for (const [key, value] of writes.mock.calls) {
      if (key === backlogFiltersStorageKey("b"))
        expect(JSON.parse(value).titleQuery).toBe("b");
      if (key === backlogSavedViewsStorageKey("b"))
        expect(JSON.parse(value)[0].name).toBe("B");
    }
  });
});
