import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

export type WorkspaceRole = {
  id: string;
  workspaceId: string;
  role: string;
  permission: Record<string, string[]>;
  createdAt: Date | string;
  updatedAt?: Date | string | null;
};

function parsePermission(raw: unknown): Record<string, string[]> {
  if (raw && typeof raw === "object") {
    return raw as Record<string, string[]>;
  }
  if (typeof raw !== "string") {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, string[]>;
    }
    return {};
  } catch {
    return {};
  }
}

function useWorkspaceRoles(workspaceId: string | undefined) {
  return useQuery<WorkspaceRole[]>({
    queryKey: ["workspace-roles", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      if (!workspaceId) return [];
      const result = await authClient.organization.listRoles({
        query: { organizationId: workspaceId },
      });
      if (result.error) throw new Error(result.error.message);

      return (result.data ?? []).map((role) => ({
        id: role.id,
        workspaceId: role.organizationId,
        role: role.role,
        permission: parsePermission(role.permission),
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
      }));
    },
  });
}

export default useWorkspaceRoles;
