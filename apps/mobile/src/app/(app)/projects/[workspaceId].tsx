import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList } from "react-native";
import { Loading, Notice, Row, Screen } from "@/components/ui";
import { listProjects } from "@/lib/api";
import { errorMessage, routeParam } from "@/lib/format";
import type { Project } from "@/lib/types";

export default function ProjectsScreen() {
  const params = useLocalSearchParams<{
    workspaceId: string;
    workspaceName?: string;
  }>();
  const workspaceId = routeParam(params.workspaceId);
  const workspaceName = routeParam(params.workspaceName);
  const [items, setItems] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!workspaceId) return;
    setLoading(true);
    listProjects(workspaceId)
      .then((value) => {
        setItems(value);
        setError(null);
      })
      .catch((reason: unknown) => setError(errorMessage(reason)))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen back title={workspaceName || "Dự án"}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Notice>Không có dự án nào bạn được xem.</Notice>}
          onRefresh={load}
          refreshing={loading}
          renderItem={({ item }) => (
            <Row
              onPress={() =>
                router.push({
                  pathname: "/project/[projectId]",
                  params: {
                    projectId: item.id,
                    workspaceId,
                    projectName: item.name,
                  },
                })
              }
              subtitle={
                item.statistics?.totalTasks !== undefined
                  ? `${item.statistics.totalTasks} việc`
                  : item.slug
              }
              title={item.name}
            />
          )}
        />
      )}
    </Screen>
  );
}
