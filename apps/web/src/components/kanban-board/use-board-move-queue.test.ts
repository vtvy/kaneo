import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useBoardMoveQueue } from "./use-board-move-queue";

describe("useBoardMoveQueue", () => {
  it("drops later moves when a save fails", () => {
    const onFailed = vi.fn();
    const onDrained = vi.fn();
    let finish: ((failed?: boolean) => void) | undefined;
    const onMove = vi.fn((_move, onSettled: (failed?: boolean) => void) => {
      finish = onSettled;
    });

    const { result } = renderHook(() =>
      useBoardMoveQueue({
        projectId: "project",
        disabled: false,
        onMove,
        onDrained,
        onFailed,
      }),
    );

    act(() => result.current.queueMove({ activeId: "a", overId: "done" }));
    act(() => result.current.queueMove({ activeId: "b", overId: "done" }));
    act(() => finish?.(true));

    expect(onFailed).toHaveBeenCalledOnce();
    expect(onDrained).not.toHaveBeenCalled();
    expect(result.current.pendingMoves).toEqual([]);
    expect(onMove).toHaveBeenCalledOnce();
  });

  it("runs the next queued move after a save succeeds", () => {
    const onFailed = vi.fn();
    const onDrained = vi.fn();
    const finishes: Array<(failed?: boolean) => void> = [];
    const onMove = vi.fn((_move, onSettled: (failed?: boolean) => void) => {
      finishes.push(onSettled);
    });

    const { result } = renderHook(() =>
      useBoardMoveQueue({
        projectId: "project",
        disabled: false,
        onMove,
        onDrained,
        onFailed,
      }),
    );

    act(() => result.current.queueMove({ activeId: "a", overId: "done" }));
    act(() => result.current.queueMove({ activeId: "b", overId: "todo" }));
    act(() => finishes[0]?.(false));

    expect(onMove).toHaveBeenCalledTimes(2);
    expect(onDrained).not.toHaveBeenCalled();
    expect(result.current.pendingMoves).toEqual([]);

    act(() => finishes[1]?.(false));
    expect(onDrained).toHaveBeenCalledOnce();
    expect(onFailed).not.toHaveBeenCalled();
  });
});
