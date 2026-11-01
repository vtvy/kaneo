import { useCallback, useState } from "react";
import { FlatList } from "react-native";
import { Button, Loading, Notice, Row, Screen } from "@/components/ui";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api";
import { errorMessage, formatWhen } from "@/lib/format";
import type { NotificationItem } from "@/lib/types";
import { useLiveRefresh } from "@/lib/use-live-refresh";

export default function NotificationsScreen() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    listNotifications()
      .then((value) => {
        setItems(value);
        setError(null);
      })
      .catch((reason: unknown) => setError(errorMessage(reason)))
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, []);

  useLiveRefresh((silent) => load(silent));

  const unread = items.some((item) => !item.isRead);

  async function markOne(id: string) {
    setBusy(true);
    try {
      await markNotificationRead(id);
      load();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function markAll() {
    setBusy(true);
    try {
      await markAllNotificationsRead();
      load();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen back title="Thông báo">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {unread ? (
        <Button
          disabled={busy}
          label="Đánh dấu tất cả đã đọc"
          onPress={() => {
            void markAll();
          }}
        />
      ) : null}
      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Notice>Không có thông báo.</Notice>}
          onRefresh={load}
          refreshing={loading}
          renderItem={({ item }) => (
            <Row
              onPress={
                item.isRead
                  ? undefined
                  : () => {
                      void markOne(item.id);
                    }
              }
              subtitle={`${item.isRead ? "Đã đọc" : "Chưa đọc"} · ${formatWhen(item.createdAt)}${item.content ? ` · ${item.content}` : ""}`}
              title={item.title || item.type}
            />
          )}
        />
      )}
    </Screen>
  );
}
