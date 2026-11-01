import { ChevronRight, File as FileIcon, Folder, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@/components/ui/dialog";
import listDriveFiles from "@/fetchers/document/list-drive-files";
import { cn } from "@/lib/cn";

const FOLDER_MIME = "application/vnd.google-apps.folder";

type DriveFile = { id: string; name: string; mimeType: string };
type Crumb = { id: string | undefined; name: string };

type Props = {
  open: boolean;
  projectId: string;
  pending?: boolean;
  onConfirm: (fileIds: string[]) => void;
  onClose: () => void;
};

export default function DriveFilePickerDialog({
  open,
  projectId,
  pending = false,
  onConfirm,
  onClose,
}: Props) {
  const { t } = useTranslation();
  // crumb[0].id === undefined → the project's configured Drive root folder.
  const [crumbs, setCrumbs] = useState<Crumb[]>([
    { id: undefined, name: t("documents:drive.rootFolder") },
  ]);
  const [items, setItems] = useState<DriveFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const current = crumbs[crumbs.length - 1];

  useEffect(() => {
    if (open) {
      setCrumbs([{ id: undefined, name: t("documents:drive.rootFolder") }]);
      setSelected(new Set());
    }
  }, [open, t]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    listDriveFiles(projectId, current.id)
      .then((data) => {
        if (!cancelled) setItems((data as DriveFile[]) ?? []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, current.id, projectId]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("documents:drive.pickTitle")}</DialogTitle>
        </DialogHeader>
        <DialogPanel>
          <div className="flex flex-wrap items-center gap-1 pb-2 text-xs">
            {crumbs.map((crumb, idx) => (
              <span
                key={crumb.id ?? "root"}
                className="flex items-center gap-1"
              >
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
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-xs">
                {t("documents:drive.empty")}
              </div>
            ) : (
              items.map((item) => {
                const isFolder = item.mimeType === FOLDER_MIME;
                if (isFolder) {
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setCrumbs((prev) => [
                          ...prev,
                          { id: item.id, name: item.name },
                        ])
                      }
                      className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-muted-foreground text-sm hover:bg-accent/50 hover:text-foreground"
                    >
                      <Folder className="size-4 shrink-0" />
                      <span className="flex-1 truncate">{item.name}</span>
                      <ChevronRight className="size-3.5 shrink-0" />
                    </button>
                  );
                }
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex h-8 w-full items-center gap-2 rounded px-2 text-sm hover:bg-accent/50",
                      selected.has(item.id) && "bg-accent/50",
                    )}
                  >
                    <Checkbox
                      aria-label={item.name}
                      checked={selected.has(item.id)}
                      onCheckedChange={() => toggle(item.id)}
                    />
                    <button
                      type="button"
                      onClick={() => toggle(item.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{item.name}</span>
                    </button>
                  </div>
                );
              })
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
            disabled={pending || selected.size === 0}
            onClick={() => onConfirm([...selected])}
          >
            {t("documents:drive.linkSelected", { count: selected.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
