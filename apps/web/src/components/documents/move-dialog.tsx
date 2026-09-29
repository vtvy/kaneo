import { Folder, FolderOpen } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import type { DocumentFolder } from "./types";

type MoveDialogProps = {
  open: boolean;
  folders: DocumentFolder[];
  currentFolderId: string | null;
  // Folders that cannot be a destination (e.g. the folders being moved).
  excludeFolderIds?: Set<string>;
  pending?: boolean;
  onConfirm: (folderId: string | null) => void;
  onClose: () => void;
};

export default function MoveDialog({
  open,
  folders,
  currentFolderId,
  excludeFolderIds,
  pending = false,
  onConfirm,
  onClose,
}: MoveDialogProps) {
  const { t } = useTranslation();
  const [target, setTarget] = useState<string | null>(currentFolderId);

  const targetFolders = excludeFolderIds
    ? folders.filter((f) => !excludeFolderIds.has(f.id))
    : folders;

  // Indent each folder by its depth so the hierarchy reads at a glance.
  const depthOf = (folder: DocumentFolder) => {
    let depth = 0;
    let parentId = folder.parentId;
    const byId = new Map(folders.map((f) => [f.id, f]));
    while (parentId) {
      depth += 1;
      parentId = byId.get(parentId)?.parentId ?? null;
    }
    return depth;
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("documents:move.title")}</DialogTitle>
        </DialogHeader>

        <DialogPanel>
          <div className="max-h-72 overflow-y-auto rounded-md border border-border/60 p-1">
            <button
              type="button"
              onClick={() => setTarget(null)}
              className={cn(
                "flex h-8 w-full items-center gap-2 rounded px-2 text-sm",
                target === null
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50",
              )}
            >
              <FolderOpen className="size-4 shrink-0" />
              <span className="truncate">{t("documents:move.root")}</span>
            </button>
            {targetFolders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => setTarget(folder.id)}
                className={cn(
                  "flex h-8 w-full items-center gap-2 rounded px-2 text-sm",
                  target === folder.id
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50",
                )}
                style={{ paddingLeft: `${depthOf(folder) * 12 + 8}px` }}
              >
                <Folder className="size-4 shrink-0" />
                <span className="truncate">{folder.name}</span>
              </button>
            ))}
          </div>
        </DialogPanel>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => onConfirm(target)}
          >
            {t("documents:actions.move")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
