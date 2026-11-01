import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList } from "react-native";
import { Loading, Notice, Row, Screen } from "@/components/ui";
import { listSprints } from "@/lib/api";
import { errorMessage, routeParam, sprintStateLabel } from "@/lib/format";
import type { Sprint } from "@/lib/types";
import { useProjectAccess } from "@/lib/use-project-access";

export default function SprintsScreen() {
  const params = useLocalSearchParams<{
    projectId: string;
    projectName?: string;
  }>();
  const projectId = routeParam(params.projectId);
  const projectName = routeParam(params.projectName);
  const access = useProjectAccess(projectId);
  const [items, setItems] = useState<Sprint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const canRead = access.allowed("item", "read");

  const load = useCallback(() => {
    if (!canRead) return;
    setLoading(true);
    listSprints(projectId)
      .then((value) => {
        setItems(value);
        setError(null);
      })
      .catch((reason: unknown) => setError(errorMessage(reason)))
      .finally(() => setLoading(false));
  }, [canRead, projectId]);

  useEffect(() => {
    if (access.loading) return;
    load();
  }, [access.loading, load]);

  return (
    <Screen back title={projectName ? `Sprint · ${projectName}` : "Sprint"}>
      {access.error ? <Notice tone="error">{access.error}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      {!access.loading && !canRead ? (
        <Notice>Bạn không có quyền xem sprint.</Notice>
      ) : null}
      {loading || access.loading ? (
        <Loading />
      ) : (
        <FlatList
          data={canRead ? items : []}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={canRead ? <Notice>Chưa có sprint.</Notice> : null}
          onRefresh={load}
          refreshing={loading}
          renderItem={({ item }) => (
            <Row
              onPress={() =>
                router.push({
                  pathname: "/sprints/[projectId]/[sprintId]",
                  params: {
                    projectId,
                    sprintId: item.id,
                    sprintName: item.name,
                  },
                })
              }
              subtitle={`${sprintStateLabel(item.state)} · ${item.completedTasks ?? 0}/${item.totalTasks ?? 0} việc`}
              title={item.name}
            />
          )}
        />
      )}
    </Screen>
  );
}
