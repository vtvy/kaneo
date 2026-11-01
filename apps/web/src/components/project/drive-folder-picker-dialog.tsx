import { ChevronRight, Folder, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
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
import listDriveFolders from "@/fetchers/google-drive-integration/list-drive-folders";

type DriveFolder = { id: string; name: string };
type Crumb = { id: string; name: string };

type Props = {
  open: boolean;
  projectId: string;
  pending?: boolean;
  onSelect: (folderId: string, folderName: string) => void;
  onClose: () => void;
};

export default function DriveFolderPickerDialog({
  open,
  projectId,
  pending = false,
  onSelect,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [crumbs, setCrumbs] = useState<Crumb[]>([
    { id: "root", name: "My Drive" },
  ]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const current = crumbs[crumbs.length - 1];

  useEffect(() => {
    if (open) setCrumbs([{ id: "root", name: "My Drive" }]);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    listDriveFolders(projectId, current.id)
      .then((data) => {
        if (!cancelled) setFolders((data as DriveFolder[]) ?? []);
      })
      .catch(() => {
        if (!cancelled) setFolders([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, current.id, projectId]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settings:googleDrive.pickFolderTitle")}</DialogTitle>
        </DialogHeader>
        <DialogPanel>
          {/* Breadcrumbs */}
          <div className="flex flex-wrap items-center gap-1 pb-2 text-xs">
            {crumbs.map((crumb, idx) => (
              <span key={crumb.id} className="flex items-center gap-1">
                {idx > 0 && (
                  <ChevronRight className="size-3 text-muted-foreground" />
                )}
                <button
                  type="button"
                  onClick={() => setCrumbs((prev) => prev.slice(0, idx + 1))}
                  className="rounded px-1 py-0.5 hover:bg-accent"
                >
                  {crumb.name}
                </button>
              </span>
            ))}
          </div>

          <div className="max-h-72 min-h-40 overflow-y-auto rounded-md border border-border/60 p-1">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : folders.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-xs">
                {t("settings:googleDrive.noSubfolders")}
              </div>
            ) : (
              folders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() =>
                    setCrumbs((prev) => [
                      ...prev,
                      { id: folder.id, name: folder.name },
                    ])
                  }
                  className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                >
                  <Folder className="size-4 shrink-0" />
                  <span className="flex-1 truncate">{folder.name}</span>
                  <ChevronRight className="size-3.5 shrink-0" />
                </button>
              ))
            )}
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
            onClick={() => onSelect(current.id, current.name)}
          >
            {t("settings:googleDrive.useFolder", { name: current.name })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
