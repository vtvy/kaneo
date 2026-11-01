import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, View } from "react-native";
import { Button, Field, Loading, Notice, Row, Screen } from "@/components/ui";
import { createTask, getBoard } from "@/lib/api";
import { errorMessage, priorityLabel, routeParam } from "@/lib/format";
import type { BoardResponse } from "@/lib/types";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import { useProjectAccess } from "@/lib/use-project-access";

const PRIORITIES = ["no-priority", "low", "medium", "high", "urgent"] as const;

export default function BoardScreen() {
  const params = useLocalSearchParams<{
    projectId: string;
    projectName?: string;
  }>();
  const projectId = routeParam(params.projectId);
  const projectName = routeParam(params.projectName);
  const access = useProjectAccess(projectId);
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] =
    useState<(typeof PRIORITIES)[number]>("medium");
  const [creating, setCreating] = useState(false);

  const canRead = access.allowed("item", "read");
  const canCreate = access.allowed("item", "create");

  const load = useCallback(
    (silent = false) => {
      if (!canRead) return;
      if (!silent) setLoading(true);
      getBoard(projectId)
        .then((value) => {
          setBoard(value);
          setError(null);
        })
        .catch((reason: unknown) => setError(errorMessage(reason)))
        .finally(() => {
          if (!silent) setLoading(false);
        });
    },
    [canRead, projectId],
  );

  useLiveRefresh((silent) => load(silent), !access.loading);

  async function submit() {
    if (!title.trim()) {
      setError("Nhập tên việc.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await createTask(projectId, {
        title: title.trim(),
        description,
        priority,
      });
      setTitle("");
      setDescription("");
      load();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Screen back title={board?.data.name || projectName || "Bảng"}>
      <ScrollView>
        {access.error ? <Notice tone="error">{access.error}</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        {!access.loading && !canRead ? (
          <Notice>Bạn không có quyền xem bảng này.</Notice>
        ) : null}
        {canCreate ? (
          <>
            <Field label="Việc mới" onChangeText={setTitle} value={title} />
            <Field
              label="Mô tả"
              onChangeText={setDescription}
              value={description}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {PRIORITIES.map((item) => (
                <Button
                  key={item}
                  label={priorityLabel(item)}
                  onPress={() => setPriority(item)}
                />
              ))}
            </ScrollView>
            <Button
              disabled={creating}
              label={creating ? "Đang tạo…" : "Tạo việc"}
              onPress={() => {
                void submit();
              }}
            />
          </>
        ) : null}
        {loading || access.loading ? <Loading /> : null}
        {board?.data.columns.map((column) => (
          <View key={column.slug || column.id}>
            <Notice>{`${column.name} (${column.tasks.length})`}</Notice>
            {column.tasks.map((task) => (
              <Row
                key={task.id}
                onPress={() =>
                  router.push({
                    pathname: "/task/[taskId]",
                    params: { taskId: task.id, projectId },
                  })
                }
                subtitle={priorityLabel(task.priority)}
                title={
                  task.number ? `#${task.number} ${task.title}` : task.title
                }
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}
