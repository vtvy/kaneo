import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, Mail, MailOpen, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import {
  filterNotifications,
  getNotificationLink,
  groupNotifications,
  type InboxFilter,
} from "@/components/inbox/inbox-helpers";
import {
  getNotificationContent,
  getNotificationTitle,
} from "@/components/notification/notification-dropdown";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useClearReadNotifications from "@/hooks/mutations/notification/use-clear-read-notifications";
import useDeleteNotification from "@/hooks/mutations/notification/use-delete-notification";
import useMarkAllNotificationsAsRead from "@/hooks/mutations/notification/use-mark-all-notifications-as-read";
import useMarkNotificationAsRead from "@/hooks/mutations/notification/use-mark-notification-as-read";
import useMarkNotificationAsUnread from "@/hooks/mutations/notification/use-mark-notification-as-unread";
import useGetNotifications from "@/hooks/queries/notification/use-get-notifications";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import type { Notification } from "@/types/notification";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/inbox",
)({
  component: RouteComponent,
});

const FILTERS: InboxFilter[] = ["all", "unread", "mentions"];

function RouteComponent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isPending, isError } = useGetNotifications();
  const { mutate: markAsRead } = useMarkNotificationAsRead();
  const { mutate: markAsUnread } = useMarkNotificationAsUnread();
  const { mutate: deleteNotification } = useDeleteNotification();
  const { mutate: markAllAsRead } = useMarkAllNotificationsAsRead();
  const { mutate: clearRead } = useClearReadNotifications();
  const [filter, setFilter] = useState<InboxFilter>("all");

  const notifications = data ?? [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const readCount = notifications.length - unreadCount;
  const groups = useMemo(
    () => groupNotifications(filterNotifications(data ?? [], filter)),
    [data, filter],
  );

  const handleOpen = (notification: Notification) => {
    if (!notification.isRead) markAsRead(notification.id);
    const link = getNotificationLink(notification);
    if (link) navigate(link);
  };

  const renderItem = (notification: Notification) => {
    const content = getNotificationContent(notification, t);
    return (
      <li
        key={notification.id}
        className={cn(
          "group flex items-start gap-3 border-border/50 border-b px-4 py-3 transition-colors hover:bg-accent/40",
          !notification.isRead && "bg-accent/20",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "mt-1.5 size-2 shrink-0 rounded-full",
            notification.isRead ? "bg-transparent" : "bg-primary",
          )}
        />
        <button
          type="button"
          onClick={() => handleOpen(notification)}
          className="flex min-w-0 flex-1 flex-col gap-0.5 text-left outline-none focus-visible:underline"
        >
          <span
            className={cn(
              "truncate text-sm text-foreground",
              !notification.isRead && "font-medium",
            )}
          >
            {getNotificationTitle(notification, t)}
          </span>
          {content && (
            <span className="line-clamp-2 text-muted-foreground text-xs">
              {content}
            </span>
          )}
          <time
            dateTime={notification.createdAt}
            title={formatDateTime(notification.createdAt)}
            className="text-muted-foreground text-xs"
          >
            {formatRelativeTime(notification.createdAt)}
          </time>
        </button>
        <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            aria-label={
              notification.isRead
                ? t("notifications:inbox.markUnread")
                : t("notifications:inbox.markRead")
            }
            title={
              notification.isRead
                ? t("notifications:inbox.markUnread")
                : t("notifications:inbox.markRead")
            }
            onClick={() =>
              notification.isRead
                ? markAsUnread(notification.id)
                : markAsRead(notification.id)
            }
          >
            {notification.isRead ? (
              <Mail className="h-3.5 w-3.5" />
            ) : (
              <MailOpen className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            aria-label={t("notifications:inbox.delete")}
            title={t("notifications:inbox.delete")}
            onClick={() => deleteNotification(notification.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </li>
    );
  };

  const renderGroup = (label: string, items: Notification[]) =>
    items.length > 0 && (
      <section key={label}>
        <h2 className="sticky top-0 z-10 border-border/80 border-b bg-card/95 px-4 py-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide backdrop-blur">
          {label}
        </h2>
        <ul>{items.map(renderItem)}</ul>
      </section>
    );

  const isEmpty = groups.today.length === 0 && groups.earlier.length === 0;

  return (
    <>
      <PageTitle title={t("notifications:inbox.pageTitle")} />
      <WorkspaceLayout
        title={t("notifications:inbox.pageTitle")}
        headerActions={
          <div className="flex items-center gap-2">
            <Tabs value={filter} className="w-fit">
              <TabsList variant="underline" className="h-8">
                {FILTERS.map((value) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setFilter(value)}
                  >
                    {t(`notifications:inbox.filters.${value}`)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={unreadCount === 0}
              onClick={() => markAllAsRead()}
            >
              {t("common:actions.markAllRead")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={readCount === 0}
              onClick={() => clearRead()}
            >
              {t("notifications:inbox.clearRead")}
            </Button>
          </div>
        }
      >
        <div className="flex h-full flex-col overflow-y-auto bg-card">
          {isPending ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            </div>
          ) : isError && !data ? (
            <p role="alert" className="p-8 text-center text-sm">
              {t("notifications:inbox.loadError")}
            </p>
          ) : isEmpty ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/50" />
              <p className="font-medium text-foreground text-sm">
                {filter === "all"
                  ? t("notifications:emptyTitle")
                  : t("notifications:inbox.emptyFiltered")}
              </p>
              {filter === "all" && (
                <p className="text-muted-foreground text-xs">
                  {t("notifications:emptySubtitle")}
                </p>
              )}
            </div>
          ) : (
            <>
              {renderGroup(t("notifications:inbox.today"), groups.today)}
              {renderGroup(t("notifications:inbox.earlier"), groups.earlier)}
            </>
          )}
        </div>
      </WorkspaceLayout>
    </>
  );
}
