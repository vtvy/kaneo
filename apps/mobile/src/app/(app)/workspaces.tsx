import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, Text } from "react-native";
import { Loading, Notice, Row, Screen } from "@/components/ui";
import { listWorkspaces } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { Workspace } from "@/lib/types";

export default function WorkspacesScreen() {
  const { session, signOut } = useSession();
  const [items, setItems] = useState<Workspace[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    listWorkspaces()
      .then((value) => {
        setItems(value);
        setError(null);
      })
      .catch((reason: unknown) => setError(errorMessage(reason)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen
      right={
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void signOut();
          }}
        >
          <Text>Đăng xuất</Text>
        </Pressable>
      }
      title="Không gian"
    >
      <Notice>{session?.user.email ?? ""}</Notice>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/notifications")}
      >
        <Text style={{ color: "#1d4e89", marginBottom: 12 }}>Thông báo</Text>
      </Pressable>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Notice>Bạn chưa thuộc không gian nào.</Notice>}
          onRefresh={load}
          refreshing={loading}
          renderItem={({ item }) => (
            <Row
              onPress={() =>
                router.push({
                  pathname: "/projects/[workspaceId]",
                  params: { workspaceId: item.id, workspaceName: item.name },
                })
              }
              subtitle={item.role}
              title={item.name}
            />
          )}
        />
      )}
    </Screen>
  );
}
