import { CheckCircle2, Loader2, X, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";

export type UploadItem = {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "done" | "error";
};

type UploadProgressProps = {
  uploads: UploadItem[];
  onDismiss: () => void;
};

export default function UploadProgress({
  uploads,
  onDismiss,
}: UploadProgressProps) {
  const { t } = useTranslation();
  if (uploads.length === 0) return null;

  const active = uploads.filter((u) => u.status === "uploading").length;

  return (
    <div className="fixed right-4 bottom-4 z-50 w-80 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
      <div className="flex items-center justify-between border-border/60 border-b px-3 py-2">
        <span className="font-medium text-sm">
          {active > 0
            ? t("documents:upload.uploading", { count: active })
            : t("documents:upload.title")}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={t("documents:actions.close")}
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="max-h-64 space-y-2 overflow-y-auto p-3">
        {uploads.map((upload) => (
          <div key={upload.id} className="space-y-1">
            <div className="flex items-center gap-2">
              {upload.status === "uploading" && (
                <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
              )}
              {upload.status === "done" && (
                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
              )}
              {upload.status === "error" && (
                <XCircle className="size-3.5 shrink-0 text-destructive" />
              )}
              <span className="min-w-0 flex-1 truncate text-xs">
                {upload.name}
              </span>
              <span className="shrink-0 text-muted-foreground text-xs">
                {upload.status === "error"
                  ? t("documents:upload.failed")
                  : `${upload.progress}%`}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded bg-muted">
              <div
                className={cn(
                  "h-full transition-all",
                  upload.status === "error" ? "bg-destructive" : "bg-primary",
                )}
                style={{ width: `${upload.progress}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
