import { Check, Copy, RefreshCw, Rss, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getCalendarFeedUrl } from "@/fetchers/calendar-feed/calendar-feeds";
import {
  useCreateCalendarFeed,
  useRegenerateCalendarFeed,
  useRevokeCalendarFeed,
} from "@/hooks/mutations/calendar-feed/use-calendar-feed-mutations";
import useGetCalendarFeeds from "@/hooks/queries/calendar-feed/use-get-calendar-feeds";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import { cn } from "@/lib/cn";
import { copyText } from "@/lib/copy-text";
import { formatDateShort } from "@/lib/format";
import { toast } from "@/lib/toast";

type SubscribeCalendarDialogProps = {
  projectId: string;
  workspaceId: string;
};

function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export default function SubscribeCalendarDialog({
  projectId,
  workspaceId,
}: SubscribeCalendarDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  // The secret link is only known right after create/regenerate.
  const [revealedUrl, setRevealedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: feeds = [], isLoading } = useGetCalendarFeeds(projectId, open);
  const { data: labels = [] } = useGetLabelsByWorkspace(
    open ? workspaceId : "",
  );
  const createFeed = useCreateCalendarFeed(projectId);
  const regenerateFeed = useRegenerateCalendarFeed(projectId);
  const revokeFeed = useRevokeCalendarFeed(projectId);

  const labelNames = useMemo(
    () =>
      [...new Set(labels.map((label) => label.name))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [labels],
  );

  const reveal = (token: string) => {
    setRevealedUrl(getCalendarFeedUrl(token));
    setCopied(false);
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setRevealedUrl(null);
      setSelectedLabels([]);
      setCopied(false);
    }
  };

  const toggleLabel = (name: string) => {
    setSelectedLabels((current) =>
      current.includes(name)
        ? current.filter((value) => value !== name)
        : [...current, name],
    );
  };

  const handleCreate = async () => {
    try {
      const feed = await createFeed.mutateAsync({
        projectId,
        labelNames: selectedLabels,
        timeZone: browserTimeZone(),
      });
      reveal(feed.token);
      setSelectedLabels([]);
      toast.success(t("tasks:calendar.feeds.created"));
    } catch {
      toast.error(t("tasks:calendar.feeds.createError"));
    }
  };

  const handleRegenerate = async (id: string) => {
    try {
      const feed = await regenerateFeed.mutateAsync({ projectId, id });
      reveal(feed.token);
      toast.success(t("tasks:calendar.feeds.regenerated"));
    } catch {
      toast.error(t("tasks:calendar.feeds.regenerateError"));
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokeFeed.mutateAsync({ projectId, id });
      setRevealedUrl(null);
      toast.success(t("tasks:calendar.feeds.revoked"));
    } catch {
      toast.error(t("tasks:calendar.feeds.revokeError"));
    }
  };

  const handleCopy = async () => {
    if (!revealedUrl) return;
    try {
      await copyText(revealedUrl);
      setCopied(true);
      toast.success(t("tasks:calendar.feeds.copied"));
    } catch {
      toast.error(t("tasks:calendar.feeds.copyError"));
    }
  };

  const isMutating =
    createFeed.isPending || regenerateFeed.isPending || revokeFeed.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" className="h-7 gap-1.5" />}
      >
        <Rss className="size-3.5" />
        {t("tasks:calendar.feeds.subscribe")}
      </DialogTrigger>
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle>{t("tasks:calendar.feeds.title")}</DialogTitle>
          <DialogDescription>
            {t("tasks:calendar.feeds.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          {revealedUrl ? (
            <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
              <p className="text-xs font-medium text-foreground">
                {t("tasks:calendar.feeds.linkReady")}
              </p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={revealedUrl}
                  aria-label={t("tasks:calendar.feeds.linkLabel")}
                  onFocus={(event) => event.currentTarget.select()}
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="shrink-0 gap-1.5"
                >
                  {copied ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copied
                    ? t("tasks:calendar.feeds.copiedLabel")
                    : t("tasks:calendar.feeds.copy")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("tasks:calendar.feeds.linkOnce")}
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">
              {t("tasks:calendar.feeds.labels")}
            </p>
            {labelNames.length ? (
              <div className="flex flex-wrap gap-1.5">
                {labelNames.map((name) => {
                  const selected = selectedLabels.includes(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleLabel(name)}
                      className={cn(
                        "rounded-md border px-2 py-0.5 text-xs transition-colors",
                        selected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:bg-accent",
                      )}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("tasks:calendar.feeds.noLabels")}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {t("tasks:calendar.feeds.labelsHint")}
            </p>
            <Button size="sm" onClick={handleCreate} disabled={isMutating}>
              {createFeed.isPending
                ? t("tasks:calendar.feeds.creating")
                : t("tasks:calendar.feeds.create")}
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">
              {t("tasks:calendar.feeds.activeFeeds")}
            </p>
            {isLoading ? (
              <p className="text-xs text-muted-foreground">
                {t("common:empty.loading")}
              </p>
            ) : feeds.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("tasks:calendar.feeds.empty")}
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {feeds.map((feed) => (
                  <li
                    key={feed.id}
                    className="flex items-center justify-between gap-2 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">
                        {feed.labelNames.length
                          ? feed.labelNames.join(", ")
                          : t("tasks:calendar.feeds.allScheduledTasks")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("tasks:calendar.feeds.createdOn", {
                          date: formatDateShort(feed.createdAt),
                          timeZone: feed.timeZone,
                        })}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        disabled={isMutating}
                        onClick={() => handleRegenerate(feed.id)}
                        aria-label={t("tasks:calendar.feeds.regenerate")}
                        title={t("tasks:calendar.feeds.regenerate")}
                      >
                        <RefreshCw className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        disabled={isMutating}
                        onClick={() => handleRevoke(feed.id)}
                        aria-label={t("tasks:calendar.feeds.revoke")}
                        title={t("tasks:calendar.feeds.revoke")}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
