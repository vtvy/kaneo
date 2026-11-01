import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { authClient } from "@/lib/auth-client";

// `useWorkspacePermission` only answers for the active workspace. This asks
// the same server endpoint about a set of other workspaces, e.g. the targets
// a project could be moved to.
//
// Pass a module-level constant for `permissions` so its identity is stable.
export function useWorkspacesWithPermission(
  workspaceIds: string[],
  permissions: Record<string, string[]>,
) {
  const ids = useMemo(() => [...workspaceIds].sort(), [workspaceIds]);
  const permissionKey = useMemo(
    () => JSON.stringify(permissions),
    [permissions],
  );

  const { data, isPending, isError } = useQuery({
    queryKey: ["workspace-capabilities", "by-permission", permissionKey, ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Not caught per workspace: a failed check must not read as a denial.
      const results = await Promise.all(
        ids.map(async (organizationId) => {
          const res = await authClient.organization.hasPermission({
            organizationId,
            permissions,
          });
          if (res.error) throw new Error(res.error.message);
          return res.data?.success === true ? organizationId : null;
        }),
      );
      return results.filter((id): id is string => id !== null);
    },
  });

  const allowed = useMemo(() => new Set(data ?? []), [data]);

  return {
    allowed,
    isPending: ids.length > 0 && isPending,
    isError,
  };
}
