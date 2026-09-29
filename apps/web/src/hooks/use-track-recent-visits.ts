import { useEffect } from "react";
import { useRecentVisitsStore } from "@/store/recent-visits";

/** Record workspace + project visits so login/switch can reopen the last place. */
export function useTrackRecentVisits(
  workspaceId: string | undefined,
  projectId?: string,
  /** Skip recording until the target is confirmed to exist (avoids poisoning memory). */
  enabled = true,
) {
  const visitWorkspace = useRecentVisitsStore((s) => s.visitWorkspace);
  const visitProject = useRecentVisitsStore((s) => s.visitProject);

  useEffect(() => {
    if (!enabled || !workspaceId) return;

    if (projectId) {
      visitProject(workspaceId, projectId);
    } else {
      visitWorkspace(workspaceId);
    }
  }, [enabled, workspaceId, projectId, visitWorkspace, visitProject]);
}
