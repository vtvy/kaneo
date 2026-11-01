import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ImportPage } from "@/components/import/import-page";
import PageTitle from "@/components/page-title";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/import",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const {
    workspace,
    canManageWorkspace,
    canCreateProjects,
    isCheckingPermissions,
  } = useWorkspacePermission();
  const allowed = canManageWorkspace() && canCreateProjects();

  return (
    <>
      <PageTitle title={t("settings:workspaceImport.pageTitle")} />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {t("settings:workspaceImport.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:workspaceImport.subtitle")}
          </p>
        </div>
        {isCheckingPermissions || !workspace ? null : allowed ? (
          <ImportPage workspaceId={workspace.id} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("settings:workspaceImport.notAllowed")}
          </p>
        )}
      </div>
    </>
  );
}
