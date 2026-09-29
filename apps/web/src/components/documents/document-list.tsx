import {
  Download,
  Eye,
  File as FileIcon,
  FileImage,
  FileText,
  Folder,
  MoreHorizontal,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { cn } from "@/lib/cn";
import { formatDate as formatLocaleDate } from "@/lib/format";
import type { DocumentFolder, DocumentItem } from "./types";

type DocumentListProps = {
  folders: DocumentFolder[];
  documents: DocumentItem[];
  isLoading: boolean;
  canManage: boolean;
  selectable: boolean;
  selectedFolderIds: Set<string>;
  selectedDocIds: Set<string>;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  onToggleFolder: (id: string) => void;
  onToggleDoc: (id: string) => void;
  onOpenFolder: (folderId: string) => void;
  onRenameFolder: (folder: DocumentFolder) => void;
  onDeleteFolder: (folder: DocumentFolder) => void;
  onPreview: (doc: DocumentItem) => void;
  onDownload: (doc: DocumentItem) => void;
  onRename: (doc: DocumentItem) => void;
  onMove: (doc: DocumentItem) => void;
  onDelete: (doc: DocumentItem) => void;
};

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

export default function DocumentList({
  folders,
  documents,
  isLoading,
  canManage,
  selectable,
  selectedFolderIds,
  selectedDocIds,
  allSelected,
  someSelected,
  onToggleAll,
  onToggleFolder,
  onToggleDoc,
  onOpenFolder,
  onRenameFolder,
  onDeleteFolder,
  onPreview,
  onDownload,
  onRename,
  onMove,
  onDelete,
}: DocumentListProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {["a", "b", "c"].map((key) => (
          <div
            key={key}
            className="h-10 w-full animate-pulse rounded-md bg-muted"
          />
        ))}
      </div>
    );
  }

  if (folders.length === 0 && documents.length === 0) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileIcon className="size-6" />
          </EmptyMedia>
          <EmptyTitle>{t("documents:list.emptyTitle")}</EmptyTitle>
          <EmptyDescription>
            {t("documents:list.emptyDescription")}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 border-border/60 border-b px-3 py-2 text-muted-foreground text-xs">
        {selectable && (
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected && !allSelected}
            onCheckedChange={() => onToggleAll()}
            aria-label={t("documents:selection.selectAll")}
          />
        )}
        <span className="flex-1">{t("documents:columns.name")}</span>
        <span className="hidden w-40 sm:block">
          {t("documents:columns.uploadedBy")}
        </span>
        <span className="hidden w-24 sm:block">
          {t("documents:columns.date")}
        </span>
        <span className="w-7" />
      </div>

      {/* Subfolders of the current folder */}
      {folders.map((folder) => (
        <div
          key={folder.id}
          className={cn(
            "group/folder flex items-center gap-3 border-border/40 border-b px-3 py-2.5 hover:bg-accent/40",
            selectedFolderIds.has(folder.id) && "bg-accent/40",
          )}
        >
          {selectable && (
            <Checkbox
              checked={selectedFolderIds.has(folder.id)}
              onCheckedChange={() => onToggleFolder(folder.id)}
              aria-label={folder.name}
            />
          )}
          <button
            type="button"
            onDoubleClick={() => onOpenFolder(folder.id)}
            onClick={() => onOpenFolder(folder.id)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            title={t("documents:actions.open")}
          >
            <Folder className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm">{folder.name}</span>
            <span className="shrink-0 text-muted-foreground text-xs">
              {t("documents:list.folderLabel")}
            </span>
          </button>

          <span className="hidden w-40 sm:block" />
          <span className="hidden w-24 text-muted-foreground text-xs sm:block">
            {formatDate(folder.createdAt)}
          </span>

          {canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground group-hover/folder:opacity-100 data-[state=open]:opacity-100"
                    aria-label={t("documents:actions.more")}
                  />
                }
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => onOpenFolder(folder.id)}>
                  {t("documents:actions.open")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onRenameFolder(folder)}>
                  {t("documents:actions.rename")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDeleteFolder(folder)}
                >
                  {t("documents:actions.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="w-7" />
          )}
        </div>
      ))}

      {/* Documents in the current folder */}
      {documents.map((doc) => (
        <div
          key={doc.id}
          className={cn(
            "group/doc flex items-center gap-3 border-border/40 border-b px-3 py-2.5 hover:bg-accent/40",
            selectedDocIds.has(doc.id) && "bg-accent/40",
          )}
        >
          {selectable && (
            <Checkbox
              checked={selectedDocIds.has(doc.id)}
              onCheckedChange={() => onToggleDoc(doc.id)}
              aria-label={doc.name}
            />
          )}
          <button
            type="button"
            onClick={() => onPreview(doc)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            title={t("documents:actions.preview")}
          >
            <FileTypeIcon contentType={doc.contentType} />
            <span className="truncate text-sm">{doc.name}</span>
            <span className="shrink-0 text-muted-foreground text-xs">
              {formatSize(doc.size)}
            </span>
          </button>

          <span className="hidden w-40 truncate text-muted-foreground text-xs sm:block">
            {doc.createdByName || doc.createdByEmail || "—"}
          </span>
          <span className="hidden w-24 text-muted-foreground text-xs sm:block">
            {formatDate(doc.createdAt)}
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground group-hover/doc:opacity-100 data-[state=open]:opacity-100"
                  aria-label={t("documents:actions.more")}
                />
              }
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => onPreview(doc)}>
                <Eye className="size-3.5" />
                {t("documents:actions.preview")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDownload(doc)}>
                <Download className="size-3.5" />
                {t("documents:actions.download")}
              </DropdownMenuItem>
              {canManage && (
                <>
                  <DropdownMenuItem onClick={() => onRename(doc)}>
                    {t("documents:actions.rename")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onMove(doc)}>
                    {t("documents:actions.move")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => onDelete(doc)}
                  >
                    {t("documents:actions.delete")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
    </div>
  );
}
