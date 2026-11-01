import { Archive } from "lucide-react";
import { useTranslation } from "react-i18next";
import useWorkspaceArchiveStatus from "@/hooks/queries/workspace/use-workspace-archive-status";

/** Read-only notice shown across an archived workspace. */
export function WorkspaceArchivedBanner({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const { t } = useTranslation();
  const { data } = useWorkspaceArchiveStatus(workspaceId);

  if (!data?.archived) return null;

  return (
    <div
      role="status"
      className="flex shrink-0 items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-300"
    >
      <Archive className="h-3.5 w-3.5 shrink-0" />
      <span>{t("workspace:archived.banner")}</span>
    </div>
  );
}
