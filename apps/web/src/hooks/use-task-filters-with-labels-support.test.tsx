import { act, renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTaskFiltersWithLabelsSupport } from "./use-task-filters-with-labels-support";

describe("useTaskFiltersWithLabelsSupport", () => {
  const storageKey = "kaneo:board-filters:project-1";

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("restores persisted label filters from storage and matches tasks from project data", async () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ labels: ["label-bug"] }),
    );

    const project = {
      id: "project-1",
      name: "Project",
      slug: "PROJ",
      icon: null,
      description: null,
      isPublic: false,
      createdAt: "2026-04-16T00:00:00.000Z",
      updatedAt: "2026-04-16T00:00:00.000Z",
      workspaceId: "workspace-1",
      columns: [
        {
          id: "todo",
          slug: "todo",
          name: "Todo",
          icon: null,
          isFinal: false,
          tasks: [
            {
              id: "task-1",
              title: "Bug task",
              number: 1,
              description: null,
              status: "todo",
              priority: null,
              startDate: null,
              dueDate: null,
              position: 0,
              createdAt: "2026-04-16T00:00:00.000Z",
              updatedAt: "2026-04-16T00:00:00.000Z",
              userId: null,
              assigneeId: null,
              assigneeName: null,
              assigneeImage: null,
              projectId: "project-1",
              labels: [
                {
                  id: "label-bug",
                  name: "bug",
                  color: "red",
                },
              ],
              externalLinks: [],
            },
            {
              id: "task-2",
              title: "Other task",
              number: 2,
              description: null,
              status: "todo",
              priority: null,
              startDate: null,
              dueDate: null,
              position: 1,
              createdAt: "2026-04-16T00:00:00.000Z",
              updatedAt: "2026-04-16T00:00:00.000Z",
              userId: null,
              assigneeId: null,
              assigneeName: null,
              assigneeImage: null,
              projectId: "project-1",
              labels: [],
              externalLinks: [],
            },
          ],
        },
      ],
      plannedTasks: [],
      archivedTasks: [],
    };

    const { result } = renderHook(() =>
      useTaskFiltersWithLabelsSupport(project, "project-1"),
    );

    await waitFor(() => {
      expect(result.current.filters.labels).toEqual(["label-bug"]);
    });

    expect(result.current.filteredProject?.columns[0]?.tasks).toHaveLength(1);
    expect(result.current.filteredProject?.columns[0]?.tasks[0]?.id).toBe(
      "task-1",
    );
  });
});

describe("board filter persistence lifecycle", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("restores priority under StrictMode and keeps it after remount", () => {
    const key = "kaneo:board-filters:a";
    window.localStorage.setItem(key, JSON.stringify({ priority: ["high"] }));
    const first = renderHook(() => useTaskFiltersWithLabelsSupport(null, "a"), {
      wrapper: StrictMode,
    });
    expect(first.result.current.filters.priority).toEqual(["high"]);
    first.unmount();
    const second = renderHook(
      () => useTaskFiltersWithLabelsSupport(null, "a"),
      { wrapper: StrictMode },
    );
    expect(second.result.current.filters.priority).toEqual(["high"]);
  });

  it("never writes the previous project's filters into the next project's storage", () => {
    const key = "kaneo:board-filters:b";
    window.localStorage.setItem(key, JSON.stringify({ priority: ["low"] }));
    const { result, rerender } = renderHook(
      ({ id }) => useTaskFiltersWithLabelsSupport(null, id),
      { initialProps: { id: "a" } },
    );
    act(() => result.current.updateFilter("priority", ["high"]));
    const writes = vi.spyOn(window.localStorage, "setItem");
    rerender({ id: "b" });
    expect(result.current.filters.priority).toEqual(["low"]);
    expect(
      writes.mock.calls
        .filter(([storedKey]) => storedKey === key)
        .every(([, value]) => JSON.parse(value).priority[0] === "low"),
    ).toBe(true);
  });
});
