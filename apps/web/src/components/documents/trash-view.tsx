import {
  ArrowLeft,
  File as FileIcon,
  FileImage,
  FileText,
  Folder,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import useEmptyTrash from "@/hooks/mutations/document/use-empty-trash";
import usePurgeDocument from "@/hooks/mutations/document/use-purge-document";
import usePurgeFolder from "@/hooks/mutations/document/use-purge-folder";
import useRestoreDocument from "@/hooks/mutations/document/use-restore-document";
import useRestoreFolder from "@/hooks/mutations/document/use-restore-folder";
import useTrash from "@/hooks/queries/document/use-trash";
import { formatDate as formatLocaleDate } from "@/lib/format";
import { toast } from "@/lib/toast";

type TrashFolderItem = {
  id: string;
  name: string;
  deletedAt: string;
  deletedByName: string | null;
  deletedByEmail: string | null;
};

type TrashDocumentItem = {
  id: string;
  name: string;
  size: number;
  contentType: string;
  deletedAt: string;
  deletedByName: string | null;
  deletedByEmail: string | null;
};

type PurgeTarget =
  | { type: "folder"; id: string; name: string }
  | { type: "document"; id: string; name: string };

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatLocaleDate(date, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function FileTypeIcon({ contentType }: { contentType: string }) {
  if (contentType.startsWith("image/")) {
    return <FileImage className="size-4 shrink-0 text-muted-foreground" />;
  }
  if (
    contentType.includes("pdf") ||
    contentType.includes("word") ||
    contentType.includes("text")
  ) {
    return <FileText className="size-4 shrink-0 text-muted-foreground" />;
  }
  return <FileIcon className="size-4 shrink-0 text-muted-foreground" />;
}

export default function TrashView({
  projectId,
  canPurge,
  onBack,
}: {
  projectId: string;
  canPurge: boolean;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading, isFetching } = useTrash(projectId);
  const folders = (data?.folders ?? []) as unknown as TrashFolderItem[];
  const documents = (data?.documents ?? []) as unknown as TrashDocumentItem[];
  const isEmpty = folders.length + documents.length === 0;
  // Show the skeleton on the initial load and while a forced refetch is still
  // resolving an empty cache, so freshly trashed items don't flash "empty".
  const showLoading = isLoading || (isFetching && isEmpty);

  const restoreFolder = useRestoreFolder(projectId);
  const restoreDocument = useRestoreDocument(projectId);
  const purgeFolder = usePurgeFolder(projectId);
  const purgeDocument = usePurgeDocument(projectId);
  const emptyTrash = useEmptyTrash(projectId);

  const busy =
    restoreFolder.isPending ||
    restoreDocument.isPending ||
    purgeFolder.isPending ||
    purgeDocument.isPending ||
    emptyTrash.isPending;

  const [purgeTarget, setPurgeTarget] = useState<PurgeTarget | null>(null);
  const [emptyOpen, setEmptyOpen] = useState(false);

  const handleRestore = async (target: PurgeTarget) => {
    try {
      if (target.type === "folder") {
        await restoreFolder.mutateAsync(target.id);
      } else {
        await restoreDocument.mutateAsync(target.id);
      }
      toast.success(t("documents:trash.toast.restored"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("documents:trash.toast.restoreError"),
      );
    }
  };

  const handlePurge = async () => {
    if (!purgeTarget) return;
    try {
      if (purgeTarget.type === "folder") {
        await purgeFolder.mutateAsync(purgeTarget.id);
      } else {
        await purgeDocument.mutateAsync(purgeTarget.id);
      }
      toast.success(t("documents:trash.toast.purged"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("documents:trash.toast.purgeError"),
      );
    } finally {
      setPurgeTarget(null);
    }
  };

  const handleEmpty = async () => {
    try {
      await emptyTrash.mutateAsync();
      toast.success(t("documents:trash.toast.emptied"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("documents:trash.toast.emptyError"),
      );
    } finally {
      setEmptyOpen(false);
    }
  };

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-border/60 border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-6 shrink-0"
            title={t("documents:trash.back")}
            onClick={onBack}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <span className="font-medium text-sm">
            {t("documents:trash.title")}
          </span>
        </div>
        {canPurge && !isEmpty && (
          <Button
            variant="outline"
            size="xs"
            className="text-destructive hover:text-destructive"
            disabled={busy}
            onClick={() => setEmptyOpen(true)}
          >
            <Trash2 className="size-3.5" />
            {t("documents:trash.empty")}
          </Button>
        )}
      </div>

      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {showLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {["a", "b", "c"].map((key) => (
              <div
                key={key}
                className="h-10 w-full animate-pulse rounded-md bg-muted"
              />
            ))}
          </div>
        ) : isEmpty ? (
          <Empty className="py-16">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Trash2 className="size-6" />
              </EmptyMedia>
              <EmptyTitle>{t("documents:trash.emptyStateTitle")}</EmptyTitle>
              <EmptyDescription>
                {t("documents:trash.emptyStateDescription")}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col">
            <div className="flex items-center gap-3 border-border/60 border-b px-3 py-2 text-muted-foreground text-xs">
              <span className="flex-1">{t("documents:columns.name")}</span>
              <span className="hidden w-40 sm:block">
                {t("documents:trash.deletedBy")}
              </span>
              <span className="hidden w-24 sm:block">
                {t("documents:trash.deletedAt")}
              </span>
              <span className="w-[4.5rem]" />
            </div>

            {folders.map((folder) => (
              <div
                key={folder.id}
                className="flex items-center gap-3 border-border/40 border-b px-3 py-2.5 hover:bg-accent/40"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Folder className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm">{folder.name}</span>
                  <span className="shrink-0 text-muted-foreground text-xs">
                    {t("documents:list.folderLabel")}
                  </span>
                </div>
                <span className="hidden w-40 truncate text-muted-foreground text-xs sm:block">
                  {folder.deletedByName || folder.deletedByEmail || "—"}
                </span>
                <span className="hidden w-24 text-muted-foreground text-xs sm:block">
                  {formatDate(folder.deletedAt)}
                </span>
                <div className="flex w-[4.5rem] shrink-0 items-center justify-end gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7"
                    title={t("documents:trash.restore")}
                    disabled={busy}
                    onClick={() =>
                      handleRestore({
                        type: "folder",
                        id: folder.id,
                        name: folder.name,
                      })
                    }
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                  {canPurge && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-7 text-destructive hover:text-destructive"
                      title={t("documents:trash.deleteForever")}
                      disabled={busy}
                      onClick={() =>
                        setPurgeTarget({
                          type: "folder",
                          id: folder.id,
                          name: folder.name,
                        })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 border-border/40 border-b px-3 py-2.5 hover:bg-accent/40"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <FileTypeIcon contentType={doc.contentType} />
                  <span className="truncate text-sm">{doc.name}</span>
                  <span className="shrink-0 text-muted-foreground text-xs">
                    {formatSize(doc.size)}
                  </span>
                </div>
                <span className="hidden w-40 truncate text-muted-foreground text-xs sm:block">
                  {doc.deletedByName || doc.deletedByEmail || "—"}
                </span>
                <span className="hidden w-24 text-muted-foreground text-xs sm:block">
                  {formatDate(doc.deletedAt)}
                </span>
                <div className="flex w-[4.5rem] shrink-0 items-center justify-end gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7"
                    title={t("documents:trash.restore")}
                    disabled={busy}
                    onClick={() =>
                      handleRestore({
                        type: "document",
                        id: doc.id,
                        name: doc.name,
                      })
                    }
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                  {canPurge && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-7 text-destructive hover:text-destructive"
                      title={t("documents:trash.deleteForever")}
                      disabled={busy}
                      onClick={() =>
                        setPurgeTarget({
                          type: "document",
                          id: doc.id,
                          name: doc.name,
                        })
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm: delete forever (single item) */}
      <AlertDialog
        open={purgeTarget !== null}
        onOpenChange={(open) => !open && setPurgeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("documents:trash.confirmPurgeTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("documents:trash.confirmPurgeDescription", {
                name: purgeTarget?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose>
              <Button variant="outline" size="sm">
                {t("common:actions.cancel")}
              </Button>
            </AlertDialogClose>
            <AlertDialogClose onClick={handlePurge}>
              <Button variant="destructive" size="sm" disabled={busy}>
                {t("documents:trash.deleteForever")}
              </Button>
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm: empty trash */}
      <AlertDialog
        open={emptyOpen}
        onOpenChange={(open) => !open && setEmptyOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("documents:trash.confirmEmptyTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("documents:trash.confirmEmptyDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose>
              <Button variant="outline" size="sm">
                {t("common:actions.cancel")}
              </Button>
            </AlertDialogClose>
            <AlertDialogClose onClick={handleEmpty}>
              <Button variant="destructive" size="sm" disabled={busy}>
                {t("documents:trash.empty")}
              </Button>
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
