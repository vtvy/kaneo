import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import useGetConfig from "@/hooks/queries/config/use-get-config";

export function useCanCreateWorkspace() {
  const { user } = useAuth();
  const { data: config } = useGetConfig();
  return Boolean(
    config && (!config.workspaceCreationRestricted || user?.role === "admin"),
  );
}
