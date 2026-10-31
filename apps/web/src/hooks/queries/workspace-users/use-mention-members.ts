import { useMemo } from "react";
import useProjectMembers from "@/hooks/queries/project-rbac/use-project-members";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { getMentionableMembers } from "@/lib/mention-members";

/** Users that can be @mentioned in comments on a task of `projectId`. */
export function useMentionMembers(projectId?: string) {
  const { data: workspace } = useActiveWorkspace();
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(
    workspace?.id ?? "",
  );
  const { data: projectMembers } = useProjectMembers(projectId);

  return useMemo(
    () =>
      getMentionableMembers(
        workspaceUsers?.members ?? [],
        projectMembers?.map((member) => member.userId),
      ),
    [workspaceUsers, projectMembers],
  );
}
