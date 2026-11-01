import { create } from "zustand";

type InstanceNameState = {
  instanceName: string;
  setInstanceName: (instanceName: string) => void;
};

// Filled from /api/config by InstanceNameSync; page titles read it.
export const useInstanceNameStore = create<InstanceNameState>((set) => ({
  instanceName: "Kaneo",
  setInstanceName: (instanceName) => set({ instanceName }),
}));
