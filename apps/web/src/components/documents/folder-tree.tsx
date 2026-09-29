import { ChevronRight, Folder, FolderOpen, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { cn } from "@/lib/cn";
import type { DocumentFolder } from "./types";

type FolderTreeProps = {
  folders: DocumentFolder[];
  selectedFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  canManage: boolean;
  onNewSubfolder: (parentId: string | null) => void;
  onRename: (folder: DocumentFolder) => void;
  onDelete: (folder: DocumentFolder) => void;
};

function buildChildrenMap(folders: DocumentFolder[]) {
  const map = new Map<string | null, DocumentFolder[]>();
  for (const folder of folders) {
    const key = folder.parentId ?? null;
    const list = map.get(key) ?? [];
    list.push(folder);
    map.set(key, list);
  }
  return map;
}

export default function FolderTree({
  folders,
  selectedFolderId,
  onSelect,
  canManage,
  onNewSubfolder,
  onRename,
  onDelete,
}: FolderTreeProps) {
  const { t } = useTranslation();
  const childrenMap = buildChildrenMap(folders);

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cn(
          "flex h-8 items-center gap-2 rounded-md px-2 text-sm",
          selectedFolderId === null
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        )}
      >
        <FolderOpen className="size-4 shrink-0" />
        <span className="truncate">{t("documents:folders.root")}</span>
      </button>

      <FolderBranch
        parentId={null}
        depth={0}
        childrenMap={childrenMap}
        selectedFolderId={selectedFolderId}
        onSelect={onSelect}
        canManage={canManage}
        onNewSubfolder={onNewSubfolder}
        onRename={onRename}
        onDelete={onDelete}
      />
    </div>
  );
}

type FolderBranchProps = Omit<FolderTreeProps, "folders"> & {
  parentId: string | null;
  depth: number;
  childrenMap: Map<string | null, DocumentFolder[]>;
};

function FolderBranch({
  parentId,
  depth,
  childrenMap,
  selectedFolderId,
  onSelect,
  canManage,
  onNewSubfolder,
  onRename,
  onDelete,
}: FolderBranchProps) {
  const children = childrenMap.get(parentId) ?? [];
  if (children.length === 0) return null;

  return (
    <>
      {children.map((folder) => (
        <FolderRow
          key={folder.id}
          folder={folder}
          depth={depth}
          childrenMap={childrenMap}
          selectedFolderId={selectedFolderId}
          onSelect={onSelect}
          canManage={canManage}
          onNewSubfolder={onNewSubfolder}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}

type FolderRowProps = Omit<FolderBranchProps, "parentId"> & {
  folder: DocumentFolder;
};

function FolderRow({
  folder,
  depth,
  childrenMap,
  selectedFolderId,
  onSelect,
  canManage,
  onNewSubfolder,
  onRename,
  onDelete,
}: FolderRowProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const hasChildren = (childrenMap.get(folder.id) ?? []).length > 0;
  const isSelected = selectedFolderId === folder.id;

  return (
    <div>
      <div
        className={cn(
          "group/folder flex h-8 items-center gap-1 rounded-md pr-1",
          isSelected
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded",
            !hasChildren && "invisible",
          )}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          <ChevronRight
            className={cn(
              "size-3.5 transition-transform",
              expanded && "rotate-90",
            )}
          />
        </button>
        <button
          type="button"
          onClick={() => onSelect(folder.id)}
          className="flex min-w-0 flex-1 items-center gap-2 text-sm"
        >
          <Folder className="size-4 shrink-0" />
          <span className="truncate">{folder.name}</span>
        </button>

        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="flex size-5 shrink-0 items-center justify-center rounded opacity-0 hover:bg-accent group-hover/folder:opacity-100 data-[state=open]:opacity-100"
                  aria-label={t("documents:folders.actions")}
                />
              }
            >
              <MoreHorizontal className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onNewSubfolder(folder.id)}>
                {t("documents:folders.newSubfolder")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRename(folder)}>
                {t("documents:actions.rename")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onDelete(folder)}
              >
                {t("documents:actions.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {expanded && (
        <FolderBranch
          parentId={folder.id}
          depth={depth + 1}
          childrenMap={childrenMap}
          selectedFolderId={selectedFolderId}
          onSelect={onSelect}
          canManage={canManage}
          onNewSubfolder={onNewSubfolder}
          onRename={onRename}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}
