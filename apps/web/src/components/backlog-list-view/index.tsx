import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  type UniqueIdentifier,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useNavigate } from "@tanstack/react-router";
import { produce } from "immer";
import { Archive, ChevronRight, Clock, Flag, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { priorityColorsTaskCard } from "@/constants/priority-colors";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { cn } from "@/lib/cn";
import useBacklogBulkSelectionStore from "@/store/backlog-bulk-selection";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import BacklogBulkToolbar from "../bulk-selection/backlog-bulk-toolbar";
import CreateTaskModal from "../shared/modals/create-task-modal";
import BacklogTaskRow from "./backlog-task-row";

type BacklogListViewProps = {
  project?: ProjectWithTasks;
  disableDragDrop?: boolean;
};

function isSectionExpanded(
  expandedSections: Record<string, boolean>,
  sectionId: string,
) {
  return expandedSections[sectionId] !== false;
}

function BacklogListView({
  project,
  disableDragDrop = false,
}: BacklogListViewProps) {
  const { t } = useTranslation();
  const { mutate: updateTask } = useUpdateTask();
  const { setProject } = useProjectStore();
  const {
    setAvailableTasks,
    focusNext,
    focusPrevious,
    focusedTaskId,
    clearFocus,
  } = useBacklogBulkSelectionStore();
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({});
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [activeColumn, setActiveColumn] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;

    // GET /task/tasks/:projectId only returns board columns. Planned and
    // archived lists are not on that payload, so visible rows are column tasks.
    const visibleTaskIds = project.columns.flatMap((column) =>
      isSectionExpanded(expandedSections, column.id)
        ? column.tasks.map((task) => task.id)
        : [],
    );
    setAvailableTasks(visibleTaskIds);
  }, [project, expandedSections, setAvailableTasks]);

  useEffect(() => {
    clearFocus();
  }, [clearFocus]);

  useRegisterShortcuts({
    shortcuts: {
      j: () => {
        focusNext();
        const state = useBacklogBulkSelectionStore.getState();
        if (state.focusedTaskId) {
          navigate({ to: ".", search: { taskId: state.focusedTaskId } });
        }
      },
      k: () => {
        focusPrevious();
        const state = useBacklogBulkSelectionStore.getState();
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
        delay: disableDragDrop ? 999999 : 200,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over || !activeId || !project) {
      setOverColumnId(null);
      return;
    }

    const overId = over.id.toString();
    const column = project.columns.find(
      (item) =>
        item.id === overId || item.tasks.some((task) => task.id === overId),
    );
    setOverColumnId(column?.id ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverColumnId(null);

    if (!over || !project) return;

    const activeTaskId = active.id.toString();
    const overId = over.id.toString();

    const sourceColumn = project.columns.find((column) =>
      column.tasks.some((task) => task.id === activeTaskId),
    );
    if (!sourceColumn) return;

    const targetColumn =
      project.columns.find((column) => column.id === overId) ??
      project.columns.find((column) =>
        column.tasks.some((task) => task.id === overId),
      );
    if (!targetColumn) return;

    const updatedProject = produce(project, (draft) => {
      const draftSource = draft.columns.find(
        (column) => column.id === sourceColumn.id,
      );
      const draftTarget = draft.columns.find(
        (column) => column.id === targetColumn.id,
      );
      if (!draftSource || !draftTarget) return;

      const sourceTaskIndex = draftSource.tasks.findIndex(
        (task) => task.id === activeTaskId,
      );
      const task = draftSource.tasks[sourceTaskIndex];
      if (!task) return;

      draftSource.tasks = draftSource.tasks.filter(
        (item) => item.id !== activeTaskId,
      );

      if (sourceColumn.id === targetColumn.id) {
        let destinationIndex = draftTarget.tasks.findIndex(
          (item) => item.id === overId,
        );
        if (destinationIndex < 0) {
          destinationIndex = draftTarget.tasks.length;
        }
        if (sourceTaskIndex <= destinationIndex) {
          destinationIndex += 1;
        }
        draftTarget.tasks.splice(destinationIndex, 0, task);
        draftTarget.tasks.forEach((item, index) => {
          updateTask({
            ...item,
            position: index,
          });
        });
        return;
      }

      task.status = draftTarget.slug;
      let destinationIndex = draftTarget.tasks.findIndex(
        (item) => item.id === overId,
      );
      if (destinationIndex < 0) {
        destinationIndex = draftTarget.tasks.length;
      }
      draftTarget.tasks.splice(destinationIndex, 0, task);

      draftTarget.tasks.forEach((item, index) => {
        updateTask({
          ...item,
          status: draftTarget.slug,
          position: index,
        });
      });
      draftSource.tasks.forEach((item, index) => {
        updateTask({
          ...item,
          position: index,
        });
      });
    });

    setProject(updatedProject);
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: prev[sectionId] === false,
    }));
  };

  function BacklogSection({
    sectionId,
    title,
    icon: IconComponent,
    tasks,
    showAddButton = false,
  }: {
    sectionId: string;
    title: string;
    icon: typeof Clock;
    tasks: Task[];
    showAddButton?: boolean;
  }) {
    const { setNodeRef } = useDroppable({
      id: sectionId,
      data: {
        type: "column",
        column: { id: sectionId, name: title },
      },
    });

    const showDropIndicator = activeId && overColumnId === sectionId;
    const expanded = isSectionExpanded(expandedSections, sectionId);

    return (
      <div
        className={cn(
          "border-b border-border/50 transition-all duration-200 overflow-auto",
          showDropIndicator && "border-l-4 border-l-ring bg-accent/35",
        )}
      >
        <div className="flex items-center justify-between py-2 px-4 bg-muted/60 border-b border-border/50">
          <button
            type="button"
            onClick={() => toggleSection(sectionId)}
            className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight
              className={cn(
                "w-3 h-3 transition-transform",
                expanded && "rotate-90",
              )}
            />
            <div className="flex items-center gap-2 h-4">
              <IconComponent className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              <div className="flex items-center gap-1">
                <span className="mt-1 mr-1">{title}</span>
                <span className="text-xs text-muted-foreground mt-0.5">
                  {tasks.length}
                </span>
              </div>
            </div>
          </button>

          <div className="flex items-center gap-1">
            {showAddButton && (
              <button
                type="button"
                onClick={() => {
                  setIsTaskModalOpen(true);
                  setActiveColumn(sectionId);
                }}
                className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground transition-colors"
                title={t("tasks:backlog.addTask")}
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {expanded && (
          <div ref={setNodeRef} className="bg-card">
            <SortableContext
              items={tasks}
              strategy={verticalListSortingStrategy}
            >
              {tasks.map((task) => (
                <BacklogTaskRow key={task.id} task={task} />
              ))}
            </SortableContext>

            {tasks.length === 0 && (
              <div className="py-6 px-4 text-center text-xs text-muted-foreground">
                {t("tasks:backlog.noTasksInSection", {
                  section: title.toLowerCase(),
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const activeTask = project.columns
    .flatMap((column) => column.tasks)
    .find((task) => task.id === activeId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      modifiers={[snapCenterToCursor]}
    >
      <div className="w-full h-full overflow-auto bg-muted/20">
        <div className="divide-y divide-border/50">
          {project.columns.map((column) => (
            <BacklogSection
              key={column.id}
              sectionId={column.id}
              title={column.name}
              icon={column.isFinal ? Archive : Clock}
              tasks={column.tasks}
              showAddButton={!column.isFinal}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeTask && (
          <div className="bg-card border border-border rounded-lg shadow-lg p-2 max-w-[200px] cursor-grabbing">
            <div className="flex items-center gap-2">
              <div className="flex-shrink-0">
                <Flag
                  className={cn(
                    "w-3 h-3",
                    priorityColorsTaskCard[
                      activeTask.priority as keyof typeof priorityColorsTaskCard
                    ],
                  )}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {project?.slug}-{activeTask.number}
                  </span>
                  <span className="text-xs text-foreground truncate">
                    {activeTask.title}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </DragOverlay>

      <CreateTaskModal
        open={isTaskModalOpen}
        projectId={project?.id}
        onClose={() => setIsTaskModalOpen(false)}
        status={activeColumn ?? project.columns[0]?.slug ?? ""}
      />

      <BacklogBulkToolbar />
    </DndContext>
  );
}

export default BacklogListView;
