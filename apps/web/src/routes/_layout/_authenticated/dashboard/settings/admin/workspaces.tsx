import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Frame, FramePanel } from "@/components/ui/frame";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminWorkspace } from "@/fetchers/admin/list-admin-workspaces";
import useDeleteAdminWorkspace from "@/hooks/mutations/admin/use-delete-admin-workspace";
import useSetAdminWorkspaceArchived from "@/hooks/mutations/admin/use-set-admin-workspace-archived";
import useAdminWorkspaces from "@/hooks/queries/admin/use-admin-workspaces";
import { toast } from "@/lib/toast";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/admin/workspaces",
)({
  component: RouteComponent,
});

const PAGE_SIZE = 50;
const STATUSES = ["all", "active", "archived"] as const;
type Status = (typeof STATUSES)[number];

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function RouteComponent() {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [page, setPage] = useState(1);
  const [archiveTarget, setArchiveTarget] = useState<AdminWorkspace | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<AdminWorkspace | null>(null);
  const [confirmName, setConfirmName] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading } = useAdminWorkspaces({
    search: search || undefined,
    status,
    page: String(page),
    limit: String(PAGE_SIZE),
  });
  const setArchived = useSetAdminWorkspaceArchived();
  const remove = useDeleteAdminWorkspace();
  const workspaces = data?.workspaces ?? [];
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  const run = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:adminPanel.manage.failed"),
      );
      return false;
    }
  };

  const archiving = archiveTarget && !archiveTarget.archivedAt;

  return (
    <>
      <PageTitle title={t("settings:adminPanel.workspaces.title")} />
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">
            {t("settings:adminPanel.workspaces.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:adminPanel.workspaces.subtitle")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative w-72">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              value={searchInput}
              placeholder={t(
                "settings:adminPanel.workspaces.searchPlaceholder",
              )}
              onChange={(event) => setSearchInput(event.target.value)}
            />
          </div>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as Status);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue>
                {t(`settings:adminPanel.workspaces.status.${status}`)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`settings:adminPanel.workspaces.status.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading || workspaces.length === 0 ? (
          <Frame>
            <FramePanel className="p-8">
              <p className="text-sm text-muted-foreground text-center">
                {isLoading
                  ? t("settings:adminPanel.loading")
                  : t("settings:adminPanel.workspaces.empty")}
              </p>
            </FramePanel>
          </Frame>
        ) : (
          <Frame>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {t("settings:adminPanel.workspaces.columns.name")}
                  </TableHead>
                  <TableHead>
                    {t("settings:adminPanel.workspaces.columns.members")}
                  </TableHead>
                  <TableHead>
                    {t("settings:adminPanel.workspaces.columns.projects")}
                  </TableHead>
                  <TableHead>
                    {t("settings:adminPanel.workspaces.columns.created")}
                  </TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspaces.map((workspace) => (
                  <TableRow key={workspace.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{workspace.name}</span>
                        {workspace.archivedAt && (
                          <Badge variant="warning">
                            {t("settings:adminPanel.workspaces.archivedBadge")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {workspace.slug}
                      </p>
                    </TableCell>
                    <TableCell>{workspace.memberCount}</TableCell>
                    <TableCell>{workspace.projectCount}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(workspace.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setArchiveTarget(workspace)}
                        >
                          {workspace.archivedAt
                            ? t("settings:adminPanel.workspaces.unarchive")
                            : t("settings:adminPanel.workspaces.archive")}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setConfirmName("");
                            setDeleteTarget(workspace);
                          }}
                        >
                          {t("settings:adminPanel.workspaces.delete")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Frame>
        )}

        {pageCount > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {t("settings:adminPanel.pageOf", { page, count: pageCount })}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                {t("settings:adminPanel.previous")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= pageCount}
                onClick={() => setPage((value) => value + 1)}
              >
                {t("settings:adminPanel.next")}
              </Button>
            </div>
          </div>
        )}
      </div>

      <AlertDialog
        open={archiveTarget !== null}
        onOpenChange={(next) => !next && setArchiveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiving
                ? t("settings:adminPanel.workspaces.archiveConfirmTitle")
                : t("settings:adminPanel.workspaces.unarchiveConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiving
                ? t(
                    "settings:adminPanel.workspaces.archiveConfirmDescription",
                    {
                      name: archiveTarget?.name,
                    },
                  )
                : t(
                    "settings:adminPanel.workspaces.unarchiveConfirmDescription",
                    { name: archiveTarget?.name },
                  )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>
              {t("common:actions.cancel")}
            </AlertDialogClose>
            <Button
              disabled={setArchived.isPending}
              onClick={() => {
                if (!archiveTarget) return;
                const archived = !archiveTarget.archivedAt;
                run(
                  () =>
                    setArchived.mutateAsync({
                      workspaceId: archiveTarget.id,
                      archived,
                    }),
                  archived
                    ? t("settings:adminPanel.workspaces.archived")
                    : t("settings:adminPanel.workspaces.unarchived"),
                ).then(() => setArchiveTarget(null));
              }}
            >
              {archiving
                ? t("settings:adminPanel.workspaces.archive")
                : t("settings:adminPanel.workspaces.unarchive")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings:adminPanel.workspaces.deleteConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings:adminPanel.workspaces.deleteConfirmDescription", {
                name: deleteTarget?.name,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6">
            <Input
              value={confirmName}
              aria-label={t("settings:adminPanel.workspaces.confirmNameLabel")}
              placeholder={deleteTarget?.name}
              onChange={(event) => setConfirmName(event.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="outline" />}>
              {t("common:actions.cancel")}
            </AlertDialogClose>
            <Button
              variant="destructive"
              disabled={
                remove.isPending ||
                !deleteTarget ||
                confirmName.trim() !== deleteTarget.name.trim()
              }
              onClick={() => {
                if (!deleteTarget) return;
                run(
                  () =>
                    remove.mutateAsync({
                      workspaceId: deleteTarget.id,
                      confirmName,
                    }),
                  t("settings:adminPanel.workspaces.deleted"),
                ).then((done) => {
                  if (done) setDeleteTarget(null);
                });
              }}
            >
              {t("settings:adminPanel.workspaces.delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
