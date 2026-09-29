import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const STORAGE_KEY = "kaneo-recent-visits";

type RecentVisitsState = {
  lastWorkspaceId: string | null;
  lastProjectByWorkspace: Record<string, string>;
  projectLastVisitedAt: Record<string, number>;
  pinnedProjectIds: string[];
};

type RecentVisitsStore = RecentVisitsState & {
  visitWorkspace: (workspaceId: string) => void;
  visitProject: (workspaceId: string, projectId: string) => void;
  togglePinProject: (projectId: string) => void;
  isPinned: (projectId: string) => boolean;
};

const emptyState: RecentVisitsState = {
  lastWorkspaceId: null,
  lastProjectByWorkspace: {},
  projectLastVisitedAt: {},
  pinnedProjectIds: [],
};

export const useRecentVisitsStore = create<RecentVisitsStore>()(
  persist(
    (set, get) => ({
      ...emptyState,

      visitWorkspace: (workspaceId) => set({ lastWorkspaceId: workspaceId }),

      visitProject: (workspaceId, projectId) =>
        set((state) => ({
          lastWorkspaceId: workspaceId,
          lastProjectByWorkspace: {
            ...state.lastProjectByWorkspace,
            [workspaceId]: projectId,
          },
          projectLastVisitedAt: {
            ...state.projectLastVisitedAt,
            [projectId]: Date.now(),
          },
        })),

      togglePinProject: (projectId) =>
        set((state) => {
          const pinned = state.pinnedProjectIds.includes(projectId)
            ? state.pinnedProjectIds.filter((id) => id !== projectId)
            : [...state.pinnedProjectIds, projectId];
          return { pinnedProjectIds: pinned };
        }),

      isPinned: (projectId) => get().pinnedProjectIds.includes(projectId),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/** Sync read for route `beforeLoad` (avoids waiting on zustand hydration). */
export function readRecentVisits(): RecentVisitsState {
  if (typeof window === "undefined") {
    return emptyState;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return emptyState;
    }

    const parsed = JSON.parse(raw) as {
      state?: Partial<RecentVisitsState>;
    } & Partial<RecentVisitsState>;

    const state = parsed.state ?? parsed;

    return {
      lastWorkspaceId: state.lastWorkspaceId ?? null,
      lastProjectByWorkspace: state.lastProjectByWorkspace ?? {},
      projectLastVisitedAt: state.projectLastVisitedAt ?? {},
      pinnedProjectIds: state.pinnedProjectIds ?? [],
    };
  } catch {
    return emptyState;
  }
}

export function getLastProjectIdForWorkspace(
  workspaceId: string,
): string | undefined {
  return readRecentVisits().lastProjectByWorkspace[workspaceId];
}

/** Drop a stale remembered project (deleted or no longer visible). */
export function clearLastProjectForWorkspace(workspaceId: string) {
  useRecentVisitsStore.setState((state) => {
    if (!(workspaceId in state.lastProjectByWorkspace)) {
      return state;
    }
    const { [workspaceId]: _removed, ...rest } = state.lastProjectByWorkspace;
    return { lastProjectByWorkspace: rest };
  });

  if (typeof window === "undefined") return;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as {
      state?: RecentVisitsState;
      version?: number;
    };
    if (!parsed.state?.lastProjectByWorkspace) return;
    const { [workspaceId]: _removed, ...rest } =
      parsed.state.lastProjectByWorkspace;
    parsed.state = { ...parsed.state, lastProjectByWorkspace: rest };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore storage failures
  }
}
