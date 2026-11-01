import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  type DropAnimation,
  defaultDropAnimationSideEffects,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import updateTask from "@/fetchers/task/update-task";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useProjectBackground } from "@/hooks/use-project-background";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import { useBackgroundStore } from "@/store/background";
import useBulkSelectionStore from "@/store/bulk-selection";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
import BulkToolbar from "../bulk-selection/bulk-toolbar";
import { applyBoardMove } from "./apply-board-move";
import Column from "./column";
import { previewBoardMoves } from "./preview-board-moves";
import TaskCard from "./task-card";
import { useBoardMoveQueue } from "./use-board-move-queue";

type KanbanBoardProps = {
  project: ProjectWithTasks;
  disableDragDrop?: boolean;
};

function KanbanBoard({ project, disableDragDrop = false }: KanbanBoardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { setProject, setBoardSyncLocked } = useProjectStore();
  const saveEpoch = useRef(0);
  const savedMove = useRef(false);
  const {
    setAvailableTasks,
    focusNext,
    focusPrevious,
    focusedTaskId,
    clearFocus,
  } = useBulkSelectionStore();
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const navigate = useNavigate();
  const background = useProjectBackground({
    backgroundVersion: project.backgroundVersion,
    projectId: project.id,
    viewMode: "board",
  });
  const setBackground = useBackgroundStore((state) => state.setBackground);

  useEffect(() => {
    setBackground(background);
    return () => setBackground(null);
  }, [background, setBackground]);

  const refreshBoard = () => {
    const token = saveEpoch.current;
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tasks", project.id] }),
      queryClient.invalidateQueries({
        queryKey: ["projects", project.workspaceId],
      }),
    ]).finally(() => {
      if (saveEpoch.current === token) setBoardSyncLocked(false);
    });
  };

  const { queueMove, pendingMoves } = useBoardMoveQueue({
    projectId: project.id,
    disabled: disableDragDrop,
    onMove: (move, onSettled) => {
      const current = useProjectStore.getState().project ?? project;
      const applied = applyBoardMove(current, move.activeId, move.overId);
      if (!applied) {
        onSettled(false);
        return;
      }
      savedMove.current = true;
      saveEpoch.current += 1;
      setBoardSyncLocked(true);
      setProject(applied.project);
      void Promise.all(applied.changed.map((task) => updateTask(task.id, task)))
        .then(() => onSettled(false))
        .catch(() => onSettled(true));
    },
    onDrained: () => {
      if (!savedMove.current) return;
      savedMove.current = false;
      refreshBoard();
    },
    onFailed: () => {
      savedMove.current = false;
      toast.error(t("tasks:kanban.reorderFailed"));
      refreshBoard();
    },
  });

  useEffect(() => {
    return () => {
      setBoardSyncLocked(false);
    };
  }, [setBoardSyncLocked]);

  useEffect(() => {
    if (project?.columns) {
      const allTaskIds = project.columns.flatMap((column) =>
        column.tasks.map((task) => task.id),
      );
      setAvailableTasks(allTaskIds);
    }
  }, [project, setAvailableTasks]);

  useEffect(() => {
    clearFocus();
  }, [clearFocus]);

  useRegisterShortcuts({
    shortcuts: {
      j: () => {
        focusNext();
        const state = useBulkSelectionStore.getState();
        if (state.focusedTaskId) {
          navigate({ to: ".", search: { taskId: state.focusedTaskId } });
        }
      },
      k: () => {
        focusPrevious();
        const state = useBulkSelectionStore.getState();
        if (state.focusedTaskId) {
          navigate({ to: ".", search: { taskId: state.focusedTaskId } });
        }
      },
      Enter: () => {
        if (focusedTaskId && project) {
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
            params: {
              workspaceId: project.workspaceId,
              projectId: project.id,
              taskId: focusedTaskId,
            },
          });
        }
      },
    },
  });

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: disableDragDrop ? 999999 : 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: disableDragDrop ? 999999 : 250,
        tolerance: 10,
      },
    }),
    useSensor(KeyboardSensor),
  );

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: "0.8",
        },
      },
    }),
    duration: 300,
    easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || disableDragDrop) return;
    queueMove({
      activeId: active.id.toString(),
      overId: over.id.toString(),
    });
  };

  if (!project || !project?.columns) {
    return (
      <div className="flex h-full w-full flex-col bg-linear-to-b from-muted/25 to-background">
        <header className="mb-6 mt-6 space-y-6 shrink-0 px-6">
          <div className="flex items-center justify-between">
            <div className="w-48 h-8 bg-muted/50 rounded-md animate-pulse" />
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          <div className="flex h-full flex-1 gap-4 overflow-x-auto px-4 pb-4 md:px-5">
            {[...Array(4)].map((_, i) => (
              <div
                key={`kanban-column-skeleton-${
                  // biome-ignore lint/suspicious/noArrayIndexKey: It's a skeleton
                  i
                }`}
                className="h-full min-w-[min(20rem,calc(100vw-4.5rem))] w-full flex-1 rounded-xl border border-border/70 bg-card"
              >
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="w-24 h-5 bg-muted/50 rounded animate-pulse" />
                  <div className="w-8 h-5 bg-muted/50 rounded animate-pulse" />
                </div>

                <div className="px-2 pb-4 flex flex-col gap-3 flex-1">
                  {[...Array(3)].map((_, j) => (
                    <div
                      key={`kanban-task-skeleton-${
                        // biome-ignore lint/suspicious/noArrayIndexKey: It's a skeleton
                        j
                      }`}
                      className="p-4 bg-card rounded-lg border border-border/50 animate-pulse"
                    >
                      <div className="space-y-3">
                        <div className="w-2/3 h-4 bg-muted/70 rounded" />
                        <div className="w-1/2 h-3 bg-muted/70 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const displayed = previewBoardMoves(project, pendingMoves);

  const activeTask = activeId
    ? displayed.columns
        .flatMap((col) => col.tasks)
        .find((task) => task.id === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className={cn("flex h-full w-full flex-col", {
          "bg-linear-to-b from-muted/20 to-background": !background,
        })}
      >
        <div
          className={`min-h-0 flex-1 scroll-px-4 overflow-x-auto [-webkit-overflow-scrolling:touch] ${
            activeId === null ? "snap-x snap-mandatory sm:snap-none" : ""
          }`}
        >
          <div className="flex h-full min-w-max gap-4 px-4 py-4 transition-all duration-200 ease-out md:px-5">
            {displayed.columns?.map((column) => (
              <div
                key={column.id}
                className="h-full max-w-96 min-w-[min(20rem,calc(100vw-4.5rem))] shrink-0 flex-1 snap-start"
              >
                <Column column={column} />
              </div>
            ))}
          </div>
        </div>
      </div>
      <DragOverlay dropAnimation={dropAnimation}>
        {activeTask ? (
          <div className="transform rotate-1 scale-[1.03] shadow-lg">
            <div className="ring-2 ring-ring/35 rounded-lg">
              <TaskCard task={activeTask} />
            </div>
          </div>
        ) : null}
      </DragOverlay>

      <BulkToolbar />
    </DndContext>
  );
}

export default KanbanBoard;
