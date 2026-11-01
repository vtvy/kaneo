import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList } from "react-native";
import { Loading, Notice, Row, Screen } from "@/components/ui";
import { listSprintTasks } from "@/lib/api";
import { errorMessage, priorityLabel, routeParam } from "@/lib/format";
import type { SprintTask } from "@/lib/types";

export default function SprintTasksScreen() {
  const params = useLocalSearchParams<{
    projectId: string;
    sprintId: string;
    sprintName?: string;
  }>();
  const projectId = routeParam(params.projectId);
  const sprintId = routeParam(params.sprintId);
  const sprintName = routeParam(params.sprintName);
  const [items, setItems] = useState<SprintTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    listSprintTasks(sprintId)
      .then((value) => {
        setItems(value);
        setError(null);
      })
      .catch((reason: unknown) => setError(errorMessage(reason)))
      .finally(() => setLoading(false));
  }, [sprintId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen back title={sprintName || "Việc trong sprint"}>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {loading ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Notice>Sprint này chưa có việc.</Notice>}
          onRefresh={load}
          refreshing={loading}
          renderItem={({ item }) => (
            <Row
              onPress={() =>
                router.push({
                  pathname: "/task/[taskId]",
                  params: { taskId: item.id, projectId },
                })
              }
              subtitle={`${item.status ?? "Không trạng thái"} · ${priorityLabel(item.priority)}`}
              title={item.number ? `#${item.number} ${item.title}` : item.title}
            />
          )}
        />
      )}
    </Screen>
  );
}
