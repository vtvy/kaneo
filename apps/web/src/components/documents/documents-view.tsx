import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  FolderInput,
  FolderPlus,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import deleteDocumentRequest from "@/fetchers/document/delete-document";
import deleteFolderRequest from "@/fetchers/document/delete-folder";
import downloadDocument from "@/fetchers/document/download-document";
import updateDocumentRequest from "@/fetchers/document/update-document";
import updateFolderRequest from "@/fetchers/document/update-folder";
import uploadDocument from "@/fetchers/document/upload-document";
import useCreateFolder from "@/hooks/mutations/document/use-create-folder";
import useDeleteDocument from "@/hooks/mutations/document/use-delete-document";
import useDeleteFolder from "@/hooks/mutations/document/use-delete-folder";
import useUpdateDocument from "@/hooks/mutations/document/use-update-document";
import useUpdateFolder from "@/hooks/mutations/document/use-update-folder";
import useDocuments from "@/hooks/queries/document/use-documents";
import useFolders from "@/hooks/queries/document/use-folders";
import { useProjectPermission } from "@/hooks/use-project-permission";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";
import DocumentList from "./document-list";
import DocumentPreview from "./document-preview";
import FolderTree from "./folder-tree";
import MoveDialog from "./move-dialog";
import NameDialog from "./name-dialog";
import TrashView from "./trash-view";
import type { DocumentFolder, DocumentItem } from "./types";
import UploadProgress, { type UploadItem } from "./upload-progress";

type FolderDialogState =
  | { mode: "create"; parentId: string | null }
  | { mode: "rename"; folder: DocumentFolder };

export default function DocumentsView({
  projectId,
  workspaceId,
}: {
  projectId: string;
  workspaceId: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { can } = useProjectPermission(projectId);
  const canUpload = can("doc", "upload");
  const canManage = can("doc", "manage");
  const canPurge = can("doc", "empty_trash");

  const [viewMode, setViewMode] = useState<"documents" | "trash">("documents");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isFolderPanelOpen, setIsFolderPanelOpen] = useState(true);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [folderDialog, setFolderDialog] = useState<FolderDialogState | null>(
    null,
  );
  const [renameDocTarget, setRenameDocTarget] = useState<DocumentItem | null>(
    null,
  );
  const [moveTarget, setMoveTarget] = useState<DocumentItem | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] =
    useState<DocumentFolder | null>(null);
  const [deleteDocTarget, setDeleteDocTarget] = useState<DocumentItem | null>(
    null,
  );
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: foldersData } = useFolders(projectId);
  const folders = (foldersData ?? []) as unknown as DocumentFolder[];

  const { data: documentsData, isLoading: documentsLoading } = useDocuments(
    projectId,
    selectedFolderId,
  );
  const documents = (documentsData ?? []) as unknown as DocumentItem[];

  const createFolder = useCreateFolder(projectId);
  const updateFolder = useUpdateFolder(projectId);
  const deleteFolder = useDeleteFolder(projectId);
  const updateDocument = useUpdateDocument(projectId);
  const deleteDocument = useDeleteDocument(projectId);

  // Subfolders of the folder currently shown in the right pane.
  const childFolders = useMemo(
    () => folders.filter((f) => (f.parentId ?? null) === selectedFolderId),
    [folders, selectedFolderId],
  );

  const breadcrumbs = useMemo(() => {
    const byId = new Map(folders.map((f) => [f.id, f]));
    const trail: DocumentFolder[] = [];
    let current = selectedFolderId ? byId.get(selectedFolderId) : undefined;
    while (current) {
      trail.unshift(current);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return trail;
  }, [folders, selectedFolderId]);

  // ── Selection (bulk move/delete) ──────────────────────────────────────────
  const selectionCount = selectedFolderIds.size + selectedDocIds.size;
  const allSelected =
    childFolders.length + documents.length > 0 &&
    childFolders.every((f) => selectedFolderIds.has(f.id)) &&
    documents.every((d) => selectedDocIds.has(d.id));

  const clearSelection = () => {
    setSelectedFolderIds(new Set());
    setSelectedDocIds(new Set());
  };

  const toggleFolderSelection = (id: string) =>
    setSelectedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleDocSelection = (id: string) =>
    setSelectedDocIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelectAll = () => {
    if (allSelected) {
      clearSelection();
    } else {
      setSelectedFolderIds(new Set(childFolders.map((f) => f.id)));
      setSelectedDocIds(new Set(documents.map((d) => d.id)));
    }
  };

  // Reset the selection whenever the viewed folder changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedFolderId is the intended trigger
  useEffect(() => {
    setSelectedFolderIds(new Set());
    setSelectedDocIds(new Set());
  }, [selectedFolderId]);

  const handleBulkMove = async (targetFolderId: string | null) => {
    const folderIds = [...selectedFolderIds];
    const docIds = [...selectedDocIds];
    setBulkPending(true);
    const results = await Promise.allSettled([
      ...folderIds.map((id) =>
        updateFolderRequest(id, { parentId: targetFolderId }),
      ),
      ...docIds.map((id) =>
        updateDocumentRequest(id, { folderId: targetFolderId }),
      ),
    ]);
    setBulkPending(false);
    await queryClient.invalidateQueries({ queryKey: ["folders", projectId] });
    await queryClient.invalidateQueries({ queryKey: ["documents", projectId] });
    setBulkMoveOpen(false);
    clearSelection();
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      toast.error(t("documents:toast.bulkError", { count: failed }));
    } else {
      toast.success(
        t("documents:toast.bulkMoved", {
          count: folderIds.length + docIds.length,
        }),
      );
    }
  };

  const handleBulkDelete = async () => {
    const folderIds = [...selectedFolderIds];
    const docIds = [...selectedDocIds];
    setBulkPending(true);
    const results = await Promise.allSettled([
      ...folderIds.map((id) => deleteFolderRequest(id)),
      ...docIds.map((id) => deleteDocumentRequest(id)),
    ]);
    setBulkPending(false);
    await queryClient.invalidateQueries({ queryKey: ["folders", projectId] });
    await queryClient.invalidateQueries({ queryKey: ["documents", projectId] });
    await queryClient.invalidateQueries({
      queryKey: ["document-trash", projectId],
    });
    setBulkDeleteOpen(false);
    clearSelection();
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      toast.error(t("documents:toast.bulkError", { count: failed }));
    } else {
      toast.success(
        t("documents:toast.bulkDeleted", {
          count: folderIds.length + docIds.length,
        }),
      );
    }
  };

  // Auto-hide the uploads panel once every item has finished or failed.
  useEffect(() => {
    const hasActive = uploads.some((u) => u.status === "uploading");
    const hasTerminal = uploads.some(
      (u) => u.status === "done" || u.status === "error",
    );
    if (hasActive || !hasTerminal) return;

    const timer = window.setTimeout(() => {
      setUploads((prev) => prev.filter((u) => u.status === "uploading"));
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [uploads]);

  // Fire-and-forget background uploads: each file uploads concurrently with its
  // own progress, so large files never block the UI and the user can keep
  // navigating. Uploads target the folder selected at the time they start.
  const handleUploadFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    const targetFolderId = selectedFolderId;

    for (const file of list) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setUploads((prev) => [
        ...prev,
        { id, name: file.name, progress: 0, status: "uploading" },
      ]);

      uploadDocument(projectId, file, targetFolderId, workspaceId, (percent) =>
        setUploads((prev) =>
          prev.map((u) => (u.id === id ? { ...u, progress: percent } : u)),
        ),
      )
        .then(() => {
          setUploads((prev) =>
            prev.map((u) =>
              u.id === id ? { ...u, progress: 100, status: "done" } : u,
            ),
          );
          void queryClient.invalidateQueries({
            queryKey: ["documents", projectId],
          });
        })
        .catch((error) => {
          setUploads((prev) =>
            prev.map((u) => (u.id === id ? { ...u, status: "error" } : u)),
          );
          toast.error(
            error instanceof Error
              ? error.message
              : t("documents:toast.uploadError"),
          );
        });
    }
  };

  const handleDownload = async (doc: DocumentItem) => {
    try {
      await downloadDocument(doc.id, doc.name);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("documents:toast.downloadError"),
      );
    }
  };

  const handleFolderDialogConfirm = async (value: string) => {
    if (!folderDialog) return;
    try {
      if (folderDialog.mode === "create") {
        await createFolder.mutateAsync({
          name: value,
          parentId: folderDialog.parentId,
        });
        toast.success(t("documents:toast.folderCreated"));
      } else {
        await updateFolder.mutateAsync({
          id: folderDialog.folder.id,
          name: value,
        });
        toast.success(t("documents:toast.folderRenamed"));
      }
      setFolderDialog(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    }
  };

  const handleRenameDoc = async (value: string) => {
    if (!renameDocTarget) return;
    try {
      await updateDocument.mutateAsync({ id: renameDocTarget.id, name: value });
      toast.success(t("documents:toast.renamed"));
      setRenameDocTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    }
  };

  const handleMoveDoc = async (folderId: string | null) => {
    if (!moveTarget) return;
    try {
      await updateDocument.mutateAsync({ id: moveTarget.id, folderId });
      toast.success(t("documents:toast.moved"));
      setMoveTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    }
  };

  const handleDeleteFolder = async () => {
    if (!deleteFolderTarget) return;
    try {
      await deleteFolder.mutateAsync(deleteFolderTarget.id);
      if (selectedFolderId === deleteFolderTarget.id) setSelectedFolderId(null);
      toast.success(t("documents:toast.folderDeleted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    } finally {
      setDeleteFolderTarget(null);
    }
  };

  const handleDeleteDoc = async () => {
    if (!deleteDocTarget) return;
    try {
      await deleteDocument.mutateAsync(deleteDocTarget.id);
      toast.success(t("documents:toast.deleted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    } finally {
      setDeleteDocTarget(null);
    }
  };

  return (
    <div className="flex h-full min-h-0">
      {viewMode === "trash" ? (
        <TrashView
          projectId={projectId}
          canPurge={canPurge}
          onBack={() => setViewMode("documents")}
        />
      ) : (
        <>
          {/* Folder tree */}
          {isFolderPanelOpen && (
            <aside className="flex w-64 shrink-0 flex-col border-border/60 border-r">
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-6"
                    title={t("documents:folders.hidePanel")}
                    onClick={() => setIsFolderPanelOpen(false)}
                  >
                    <PanelLeftClose className="size-4" />
                  </Button>
                  <span className="font-medium text-sm">
                    {t("documents:folders.title")}
                  </span>
                </div>
                {canUpload && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-6"
                    title={t("documents:folders.new")}
                    onClick={() =>
                      setFolderDialog({ mode: "create", parentId: null })
                    }
                  >
                    <FolderPlus className="size-4" />
                  </Button>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                <FolderTree
                  folders={folders}
                  selectedFolderId={selectedFolderId}
                  onSelect={setSelectedFolderId}
                  canManage={canManage}
                  onNewSubfolder={(parentId) =>
                    setFolderDialog({ mode: "create", parentId })
                  }
                  onRename={(folder) =>
                    setFolderDialog({ mode: "rename", folder })
                  }
                  onDelete={(folder) => setDeleteFolderTarget(folder)}
                />
              </div>
            </aside>
          )}

          {/* Document pane */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: drag-and-drop upload zone; the file picker button provides the keyboard-accessible path */}
          <section
            className={cn(
              "flex min-w-0 flex-1 flex-col",
              isDragging && "bg-accent/30 ring-2 ring-primary/40 ring-inset",
            )}
            onDragOver={(e) => {
              if (!canUpload) return;
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (!canUpload) return;
              if (e.dataTransfer.files?.length) {
                handleUploadFiles(e.dataTransfer.files);
              }
            }}
          >
            {/* Toolbar / breadcrumbs */}
            <div className="flex items-center justify-between gap-2 border-border/60 border-b px-3 py-2">
              <div className="flex min-w-0 items-center gap-1 text-sm">
                {!isFolderPanelOpen && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-6 shrink-0"
                    title={t("documents:folders.showPanel")}
                    onClick={() => setIsFolderPanelOpen(true)}
                  >
                    <PanelLeftOpen className="size-4" />
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedFolderId(null)}
                  className={cn(
                    "truncate rounded px-1.5 py-0.5 hover:bg-accent",
                    selectedFolderId === null
                      ? "text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {t("documents:breadcrumb.root")}
                </button>
                {breadcrumbs.map((folder) => (
                  <span
                    key={folder.id}
                    className="flex min-w-0 items-center gap-1"
                  >
                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                    <button
                      type="button"
                      onClick={() => setSelectedFolderId(folder.id)}
                      className={cn(
                        "truncate rounded px-1.5 py-0.5 hover:bg-accent",
                        selectedFolderId === folder.id
                          ? "text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {folder.name}
                    </button>
                  </span>
                ))}
              </div>

              {(canUpload || canManage) && (
                <div className="flex shrink-0 items-center gap-1.5">
                  {canManage && selectionCount > 0 && (
                    <>
                      <span className="text-muted-foreground text-xs">
                        {t("documents:selection.count", {
                          count: selectionCount,
                        })}
                      </span>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => setBulkMoveOpen(true)}
                      >
                        <FolderInput className="size-3.5" />
                        {t("documents:actions.move")}
                      </Button>
                      <Button
                        variant="outline"
                        size="xs"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setBulkDeleteOpen(true)}
                      >
                        <Trash2 className="size-3.5" />
                        {t("documents:actions.delete")}
                      </Button>
                      {canUpload && <div className="h-4 w-px bg-border/80" />}
                    </>
                  )}
                  {canUpload && (
                    <>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() =>
                          setFolderDialog({
                            mode: "create",
                            parentId: selectedFolderId,
                          })
                        }
                      >
                        <FolderPlus className="size-3.5" />
                        {t("documents:actions.newFolder")}
                      </Button>
                      <Button
                        size="xs"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="size-3.5" />
                        {t("documents:actions.upload")}
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.length) {
                            handleUploadFiles(e.target.files);
                          }
                          e.target.value = "";
                        }}
                      />
                    </>
                  )}
                  {canManage && (
                    <>
                      {(canUpload || selectionCount > 0) && (
                        <div className="h-4 w-px bg-border/80" />
                      )}
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => setViewMode("trash")}
                      >
                        <Trash2 className="size-3.5" />
                        {t("documents:trash.title")}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <DocumentList
                folders={childFolders}
                documents={documents}
                isLoading={documentsLoading}
                canManage={canManage}
                selectable={canManage}
                selectedFolderIds={selectedFolderIds}
                selectedDocIds={selectedDocIds}
                allSelected={allSelected}
                someSelected={selectionCount > 0}
                onToggleAll={toggleSelectAll}
                onToggleFolder={toggleFolderSelection}
                onToggleDoc={toggleDocSelection}
                onOpenFolder={setSelectedFolderId}
                onRenameFolder={(folder) =>
                  setFolderDialog({ mode: "rename", folder })
                }
                onDeleteFolder={(folder) => setDeleteFolderTarget(folder)}
                onPreview={(doc) => setPreviewDoc(doc)}
                onDownload={handleDownload}
                onRename={(doc) => setRenameDocTarget(doc)}
                onMove={(doc) => setMoveTarget(doc)}
                onDelete={(doc) => setDeleteDocTarget(doc)}
              />
            </div>
          </section>
        </>
      )}

      {/* Create / rename folder */}
      <NameDialog
        open={folderDialog !== null}
        title={
          folderDialog?.mode === "rename"
            ? t("documents:folders.rename")
            : t("documents:folders.new")
        }
        initialValue={
          folderDialog?.mode === "rename" ? folderDialog.folder.name : ""
        }
        confirmLabel={
          folderDialog?.mode === "rename"
            ? t("documents:actions.save")
            : t("documents:actions.create")
        }
        placeholder={t("documents:folders.namePlaceholder")}
        pending={createFolder.isPending || updateFolder.isPending}
        onConfirm={handleFolderDialogConfirm}
        onClose={() => setFolderDialog(null)}
      />

      {/* Rename document */}
      <NameDialog
        open={renameDocTarget !== null}
        title={t("documents:rename.title")}
        initialValue={renameDocTarget?.name ?? ""}
        confirmLabel={t("documents:actions.save")}
        placeholder={t("documents:rename.placeholder")}
        pending={updateDocument.isPending}
        onConfirm={handleRenameDoc}
        onClose={() => setRenameDocTarget(null)}
      />

      {/* Move document */}
      <MoveDialog
        open={moveTarget !== null}
        folders={folders}
        currentFolderId={moveTarget?.folderId ?? null}
        pending={updateDocument.isPending}
        onConfirm={handleMoveDoc}
        onClose={() => setMoveTarget(null)}
      />

      {/* Preview document */}
      <DocumentPreview
        doc={previewDoc}
        onClose={() => setPreviewDoc(null)}
        onDownload={handleDownload}
      />

      {/* Delete folder */}
      <AlertDialog
        open={deleteFolderTarget !== null}
        onOpenChange={(open) => !open && setDeleteFolderTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("documents:folders.deleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("documents:folders.deleteDescription", {
                name: deleteFolderTarget?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose>
              <Button variant="outline" size="sm">
                {t("common:actions.cancel")}
              </Button>
            </AlertDialogClose>
            <AlertDialogClose onClick={handleDeleteFolder}>
              <Button variant="destructive" size="sm">
                {t("documents:actions.delete")}
              </Button>
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete document */}
      <AlertDialog
        open={deleteDocTarget !== null}
        onOpenChange={(open) => !open && setDeleteDocTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("documents:delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("documents:delete.description", {
                name: deleteDocTarget?.name ?? "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose>
              <Button variant="outline" size="sm">
                {t("common:actions.cancel")}
              </Button>
            </AlertDialogClose>
            <AlertDialogClose onClick={handleDeleteDoc}>
              <Button variant="destructive" size="sm">
                {t("documents:actions.delete")}
              </Button>
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk move */}
      <MoveDialog
        open={bulkMoveOpen}
        folders={folders}
        currentFolderId={selectedFolderId}
        excludeFolderIds={selectedFolderIds}
        pending={bulkPending}
        onConfirm={handleBulkMove}
        onClose={() => setBulkMoveOpen(false)}
      />

      {/* Bulk delete */}
      <AlertDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => !open && setBulkDeleteOpen(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("documents:bulkDelete.title", { count: selectionCount })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("documents:bulkDelete.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose>
              <Button variant="outline" size="sm">
                {t("common:actions.cancel")}
              </Button>
            </AlertDialogClose>
            <AlertDialogClose onClick={handleBulkDelete}>
              <Button variant="destructive" size="sm" disabled={bulkPending}>
                {t("documents:actions.delete")}
              </Button>
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Background upload progress */}
      <UploadProgress
        uploads={uploads}
        onDismiss={() =>
          setUploads((prev) => prev.filter((u) => u.status === "uploading"))
        }
      />
    </div>
  );
}
