import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { Button, Field, Loading, Notice, Screen } from "@/components/ui";
import {
  createComment,
  deleteComment,
  deleteTask,
  getBoard,
  getProject,
  getTask,
  listComments,
  listMembers,
  listTaskFields,
  listTaskLabels,
  updateComment,
  updateTaskAssignee,
  updateTaskDescription,
  updateTaskPriority,
  updateTaskStatus,
  updateTaskTitle,
} from "@/lib/api";
import { errorMessage, priorityLabel, routeParam } from "@/lib/format";
import { canAssignTask, canEditOwnComment } from "@/lib/permissions";
import { useSession } from "@/lib/session";
import type {
  BoardColumn,
  Comment,
  Member,
  TaskDetail,
  TaskFieldValue,
  TaskLabel,
} from "@/lib/types";
import { useProjectAccess } from "@/lib/use-project-access";

const PRIORITIES = ["no-priority", "low", "medium", "high", "urgent"] as const;

export default function TaskScreen() {
  const params = useLocalSearchParams<{ taskId: string; projectId?: string }>();
  const taskId = routeParam(params.taskId);
  const { session } = useSession();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [labels, setLabels] = useState<TaskLabel[]>([]);
  const [fields, setFields] = useState<TaskFieldValue[]>([]);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const projectId = task?.projectId ?? routeParam(params.projectId);
  const access = useProjectAccess(projectId);
  const canUpdate = access.allowed("item", "update");
  const canTransition = access.allowed("item", "transition");
  const canDelete = access.allowed("item", "delete");
  const showAssign = canAssignTask(
    access.access,
    task?.reporterId,
    session?.user.id,
  );

  const load = useCallback(() => {
    if (!taskId) return;
    setLoading(true);
    Promise.all([
      getTask(taskId),
      listComments(taskId),
      listTaskLabels(taskId),
      listTaskFields(taskId),
    ])
      .then(([nextTask, nextComments, nextLabels, nextFields]) => {
        setTask(nextTask);
        setTitle(nextTask.title);
        setDescription(nextTask.description ?? "");
        setComments(nextComments);
        setLabels(nextLabels);
        setFields(nextFields);
        setError(null);
      })
      .catch((reason: unknown) => setError(errorMessage(reason)))
      .finally(() => setLoading(false));
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!projectId || access.loading || !canTransition) return;
    let cancelled = false;
    getBoard(projectId)
      .then((board) => {
        if (!cancelled) setColumns(board.data.columns);
      })
      .catch(() => {
        if (!cancelled) setColumns([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, access.loading, canTransition]);

  useEffect(() => {
    if (!projectId || access.loading || !showAssign) return;
    let cancelled = false;
    getProject(projectId)
      .then((project) => listMembers(project.workspaceId))
      .then((value) => {
        if (!cancelled) setMembers(value);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, access.loading, showAssign]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      load();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  function confirmDeleteComment(commentId: string) {
    Alert.alert("Xóa bình luận?", "Bình luận này sẽ bị xóa.", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: () => {
          void run(async () => {
            await deleteComment(commentId);
            if (editingCommentId === commentId) {
              setEditingCommentId(null);
              setCommentDraft("");
            }
          });
        },
      },
    ]);
  }
  function confirmDelete() {
    Alert.alert("Xóa việc?", "Việc này sẽ bị xóa.", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: () => {
          setBusy(true);
          setError(null);
          deleteTask(taskId)
            .then(() => router.back())
            .catch((reason: unknown) => setError(errorMessage(reason)))
            .finally(() => setBusy(false));
        },
      },
    ]);
  }

  return (
    <Screen back title={task?.number ? `#${task.number}` : "Việc"}>
      <ScrollView keyboardShouldPersistTaps="handled">
        {error ? <Notice tone="error">{error}</Notice> : null}
        {access.error ? <Notice tone="error">{access.error}</Notice> : null}
        {loading ? <Loading /> : null}
        {task ? (
          <>
            {canUpdate ? (
              <>
                <Field label="Tiêu đề" onChangeText={setTitle} value={title} />
                <Button
                  disabled={busy || title.trim() === task.title}
                  label="Lưu tiêu đề"
                  onPress={() => {
                    void run(() => updateTaskTitle(taskId, title.trim()));
                  }}
                />
                <Field
                  label="Mô tả"
                  onChangeText={setDescription}
                  value={description}
                />
                <Button
                  disabled={busy || description === (task.description ?? "")}
                  label="Lưu mô tả"
                  onPress={() => {
                    void run(() => updateTaskDescription(taskId, description));
                  }}
                />
                <Notice>Ưu tiên</Notice>
                {PRIORITIES.map((item) => (
                  <Button
                    disabled={busy || task.priority === item}
                    key={item}
                    label={priorityLabel(item)}
                    onPress={() => {
                      void run(() => updateTaskPriority(taskId, item));
                    }}
                  />
                ))}
              </>
            ) : (
              <>
                <Notice>{task.title}</Notice>
                <Notice>{task.description || "Chưa có mô tả."}</Notice>
                <Notice>{`Ưu tiên: ${priorityLabel(task.priority)}`}</Notice>
              </>
            )}
            <Notice>
              {`Trạng thái: ${task.status ?? "Không trạng thái"}${task.assigneeName ? ` · ${task.assigneeName}` : ""}`}
            </Notice>
            {canTransition && columns.length > 0 ? (
              <>
                <Notice>Chuyển trạng thái</Notice>
                {columns.map((column) => (
                  <Button
                    disabled={busy || task.status === column.slug}
                    key={column.slug}
                    label={column.name}
                    onPress={() => {
                      void run(() => updateTaskStatus(taskId, column.slug));
                    }}
                  />
                ))}
              </>
            ) : null}
            {showAssign && members.length > 0 ? (
              <>
                <Notice>Gán cho</Notice>
                {task.userId ? (
                  <Button
                    disabled={busy}
                    label="Bỏ gán"
                    onPress={() => {
                      void run(() => updateTaskAssignee(taskId, ""));
                    }}
                  />
                ) : null}
                {members.map((member) => (
                  <Button
                    disabled={busy || task.userId === member.id}
                    key={member.id}
                    label={member.name || member.email}
                    onPress={() => {
                      void run(() => updateTaskAssignee(taskId, member.id));
                    }}
                  />
                ))}
              </>
            ) : null}
            {labels.length > 0 ? (
              <Notice>
                {`Nhãn: ${labels.map((label) => label.name).join(", ")}`}
              </Notice>
            ) : null}
            {fields.length > 0 ? (
              <>
                <Notice>Trường tùy chỉnh</Notice>
                {fields.map((field) => (
                  <Notice key={field.id}>
                    {`${field.fieldName}: ${field.value || "—"}`}
                  </Notice>
                ))}
              </>
            ) : null}
            <Notice>Bình luận</Notice>
            {comments.map((item) => {
              const own = canEditOwnComment(item.userId, session?.user.id);
              const editing = editingCommentId === item.id;
              return (
                <View key={item.id}>
                  {editing ? (
                    <Field
                      label="Sửa bình luận"
                      onChangeText={setCommentDraft}
                      value={commentDraft}
                    />
                  ) : (
                    <Notice>
                      {`${item.user?.name || "Ẩn danh"}: ${item.content}`}
                    </Notice>
                  )}
                  {own && editing ? (
                    <Button
                      disabled={busy || !commentDraft.trim()}
                      label="Lưu bình luận"
                      onPress={() => {
                        void run(async () => {
                          await updateComment(item.id, commentDraft.trim());
                          setEditingCommentId(null);
                          setCommentDraft("");
                        });
                      }}
                    />
                  ) : null}
                  {own && !editing ? (
                    <Button
                      disabled={busy}
                      label="Sửa bình luận"
                      onPress={() => {
                        setEditingCommentId(item.id);
                        setCommentDraft(item.content);
                      }}
                    />
                  ) : null}
                  {own ? (
                    <Button
                      disabled={busy}
                      label="Xóa bình luận"
                      onPress={() => confirmDeleteComment(item.id)}
                    />
                  ) : null}
                </View>
              );
            })}
            {comments.length === 0 ? <Notice>Chưa có bình luận.</Notice> : null}
            {canUpdate ? (
              <>
                <Field
                  label="Bình luận mới"
                  onChangeText={setComment}
                  value={comment}
                />
                <Button
                  disabled={busy || !comment.trim()}
                  label="Gửi bình luận"
                  onPress={() => {
                    void run(async () => {
                      await createComment(taskId, comment.trim());
                      setComment("");
                    });
                  }}
                />
              </>
            ) : null}
            {canDelete ? (
              <Button
                disabled={busy}
                label="Xóa việc"
                onPress={confirmDelete}
              />
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
