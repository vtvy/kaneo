import { create } from "zustand";
import type { ProjectWithTasks } from "@/types/project";

const useProjectStore = create<{
  project: ProjectWithTasks | undefined;
  boardSyncLocked: boolean;
  setProject: (updatedProject: ProjectWithTasks | undefined) => void;
  setBoardSyncLocked: (locked: boolean) => void;
}>((set) => ({
  project: undefined,
  boardSyncLocked: false,
  setProject: (updatedProject) => set(() => ({ project: updatedProject })),
  setBoardSyncLocked: (locked) => set(() => ({ boardSyncLocked: locked })),
}));

export default useProjectStore;
