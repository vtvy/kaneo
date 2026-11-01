import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useBoardSprintFilter } from "./use-board-sprint-filter";

const a = [{ id: "a-current" }, { id: "a-old" }];
const b = [{ id: "b-current" }, { id: "b-old" }];
beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

it("restores a non-current sprint after remount under StrictMode", () => {
  window.localStorage.setItem("kaneo:board-sprint-filter:a", "a-old");
  const first = renderHook(() => useBoardSprintFilter("a", a, "a-current"), {
    wrapper: StrictMode,
  });
  expect(first.result.current.selectedSprintId).toBe("a-old");
  first.unmount();
  const second = renderHook(() => useBoardSprintFilter("a", a, "a-current"), {
    wrapper: StrictMode,
  });
  expect(second.result.current.selectedSprintId).toBe("a-old");
});

it("restores each project's sprint without overwriting the other project's storage", () => {
  window.localStorage.setItem("kaneo:board-sprint-filter:a", "a-old");
  window.localStorage.setItem("kaneo:board-sprint-filter:b", "b-old");
  const { result, rerender } = renderHook(
    ({ id, sprints, current }) => useBoardSprintFilter(id, sprints, current),
    {
      initialProps: { id: "a", sprints: a, current: "a-current" },
      wrapper: StrictMode,
    },
  );
  const writes = vi.spyOn(window.localStorage, "setItem");
  rerender({ id: "b", sprints: b, current: "b-current" });
  expect(result.current.selectedSprintId).toBe("b-old");
  expect(
    writes.mock.calls
      .filter(([key]) => key === "kaneo:board-sprint-filter:b")
      .every(([, value]) => value === "b-old"),
  ).toBe(true);
  rerender({ id: "a", sprints: a, current: "a-current" });
  expect(result.current.selectedSprintId).toBe("a-old");
});

it("waits for the new project's sprints before hydrating or writing", () => {
  window.localStorage.setItem("kaneo:board-sprint-filter:b", "b-old");
  const { result, rerender } = renderHook(
    ({ id, sprints }: { id: string; sprints: { id: string }[] | undefined }) =>
      useBoardSprintFilter(id, sprints, undefined),
    { initialProps: { id: "a", sprints: a as { id: string }[] | undefined } },
  );
  act(() => result.current.setSelectedSprintId("a-old"));
  rerender({ id: "b", sprints: undefined });
  expect(window.localStorage.getItem("kaneo:board-sprint-filter:b")).toBe(
    "b-old",
  );
  rerender({ id: "b", sprints: b });
  expect(result.current.selectedSprintId).toBe("b-old");
});

it("falls back to current for an invalid stored sprint and to all when a selected sprint is deleted", () => {
  window.localStorage.setItem("kaneo:board-sprint-filter:a", "missing");
  const { result, rerender } = renderHook(
    ({ sprints }) => useBoardSprintFilter("a", sprints, "a-current"),
    { initialProps: { sprints: a } },
  );
  expect(result.current.selectedSprintId).toBe("a-current");
  act(() => result.current.setSelectedSprintId("a-old"));
  rerender({ sprints: [{ id: "a-current" }] });
  expect(result.current.selectedSprintId).toBe("all");
  expect(window.localStorage.getItem("kaneo:board-sprint-filter:a")).toBe(
    "all",
  );
});
