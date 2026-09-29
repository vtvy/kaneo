import { create } from "zustand";

// Shared state for surfacing the active sprint on the board: which tasks
// belong to it (so cards can show a sprint badge) and its display name.
// Set by the board route, read by task cards. Keyed by projectId so a stale
// value from another project never leaks a badge onto the wrong board.
type ActiveSprintStore = {
  projectId: string | null;
  sprintName: string | null;
  taskIds: Set<string>;
  setActiveSprint: (
    value: {
      projectId: string;
      sprintName: string;
      taskIds: Set<string>;
    } | null,
  ) => void;
};

const useActiveSprintStore = create<ActiveSprintStore>((set) => ({
  projectId: null,
  sprintName: null,
  taskIds: new Set<string>(),
  setActiveSprint: (value) =>
    set(() =>
      value
        ? {
            projectId: value.projectId,
            sprintName: value.sprintName,
            taskIds: value.taskIds,
          }
        : { projectId: null, sprintName: null, taskIds: new Set<string>() },
    ),
}));

export default useActiveSprintStore;
