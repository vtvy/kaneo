import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { Button, Field, Loading, Notice, Screen } from "@/components/ui";
import {
  assignLabel,
  createComment,
  createLabel,
  deleteComment,
  deleteTask,
  detachLabel,
  getBoard,
  getProject,
  getTask,
  listComments,
  listMembers,
  listProjectFields,
  listTaskFields,
  listTaskLabels,
  listWorkspaceLabels,
  setTaskFieldValue,
  updateComment,
  updateLabel,
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
  CustomFieldDefinition,
  Member,
  TaskDetail,
  TaskFieldValue,
  TaskLabel,
} from "@/lib/types";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import { useProjectAccess } from "@/lib/use-project-access";

const LABEL_COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"];

const PRIORITIES = ["no-priority", "low", "medium", "high", "urgent"] as const;

export default function TaskScreen() {
  const params = useLocalSearchParams<{ taskId: string; projectId?: string }>();
  const taskId = routeParam(params.taskId);
  const { session } = useSession();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [labels, setLabels] = useState<TaskLabel[]>([]);
  const [workspaceLabels, setWorkspaceLabels] = useState<TaskLabel[]>([]);
  const [fields, setFields] = useState<TaskFieldValue[]>([]);
  const [fieldDefinitions, setFieldDefinitions] = useState<
    CustomFieldDefinition[]
  >([]);
  const [labelName, setLabelName] = useState("");
  const [labelColor, setLabelColor] = useState(LABEL_COLORS[3]);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, string>>({});
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

  const load = useCallback(
    (silent = false) => {
      if (!taskId) return;
      if (!silent) setLoading(true);
      Promise.all([
        getTask(taskId),
        listComments(taskId),
        listTaskLabels(taskId),
        listTaskFields(taskId),
      ])
        .then(([nextTask, nextComments, nextLabels, nextFields]) => {
          setTask(nextTask);
          if (!silent) {
            setTitle(nextTask.title);
            setDescription(nextTask.description ?? "");
          }
          setComments(nextComments);
          setLabels(nextLabels);
          setFields(nextFields);
          setError(null);
        })
        .catch((reason: unknown) => setError(errorMessage(reason)))
        .finally(() => {
          if (!silent) setLoading(false);
        });
    },
    [taskId],
  );

  useLiveRefresh((silent) => load(silent), Boolean(taskId));

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

  useEffect(() => {
    if (!projectId || access.loading || !canUpdate) return;
    let cancelled = false;
    Promise.all([getProject(projectId), listProjectFields(projectId)])
      .then(async ([project, nextFields]) => {
        const nextLabels = await listWorkspaceLabels(project.workspaceId);
        if (!cancelled) {
          setWorkspaceLabels(nextLabels);
          setFieldDefinitions(nextFields);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspaceLabels([]);
          setFieldDefinitions([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, access.loading, canUpdate]);

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
            <Notice>Nhãn</Notice>
            {labels.length === 0 ? <Notice>Chưa có nhãn.</Notice> : null}
            {labels.map((label) =>
              editingLabelId === label.id ? (
                <View key={label.id}>
                  <Field
                    label="Tên nhãn"
                    onChangeText={setLabelDraft}
                    value={labelDraft}
                  />
                  <Button
                    disabled={busy || !labelDraft.trim()}
                    label="Lưu nhãn"
                    onPress={() => {
                      void run(async () => {
                        await updateLabel(
                          label.id,
                          labelDraft.trim(),
                          label.color,
                        );
                        setEditingLabelId(null);
                        setLabelDraft("");
                      });
                    }}
                  />
                </View>
              ) : (
                <View key={label.id}>
                  <Notice>{label.name}</Notice>
                  {canUpdate ? (
                    <>
                      <Button
                        disabled={busy}
                        label="Sửa nhãn"
                        onPress={() => {
                          setEditingLabelId(label.id);
                          setLabelDraft(label.name);
                        }}
                      />
                      <Button
                        disabled={busy}
                        label="Gỡ nhãn"
                        onPress={() => {
                          void run(() => detachLabel(label.id));
                        }}
                      />
                    </>
                  ) : null}
                </View>
              ),
            )}
            {canUpdate
              ? workspaceLabels
                  .filter(
                    (label) =>
                      !labels.some((current) => current.id === label.id),
                  )
                  .map((label) => (
                    <Button
                      disabled={busy}
                      key={label.id}
                      label={`Gắn ${label.name}`}
                      onPress={() => {
                        void run(() => assignLabel(label.id, taskId));
                      }}
                    />
                  ))
              : null}
            {canUpdate ? (
              <>
                <Field
                  label="Nhãn mới"
                  onChangeText={setLabelName}
                  value={labelName}
                />
                <View>
                  {LABEL_COLORS.map((color) => (
                    <Button
                      disabled={busy}
                      key={color}
                      label={labelColor === color ? `Màu ${color}` : color}
                      onPress={() => setLabelColor(color)}
                    />
                  ))}
                </View>
                <Button
                  disabled={busy || !labelName.trim()}
                  label="Tạo nhãn"
                  onPress={() => {
                    void run(async () => {
                      const project = await getProject(projectId);
                      await createLabel({
                        name: labelName.trim(),
                        color: labelColor,
                        workspaceId: project.workspaceId,
                        taskId,
                      });
                      setLabelName("");
                    });
                  }}
                />
              </>
            ) : null}
            <Notice>Trường tùy chỉnh</Notice>
            {(fieldDefinitions.length > 0
              ? fieldDefinitions.map((definition) => ({
                  id: definition.id,
                  name: definition.name,
                  value:
                    fields.find((field) => field.fieldId === definition.id)
                      ?.value ?? "",
                }))
              : fields.map((field) => ({
                  id: field.fieldId,
                  name: field.fieldName,
                  value: field.value ?? "",
                }))
            ).map((field) =>
              canUpdate ? (
                <View key={field.id}>
                  <Field
                    label={field.name}
                    onChangeText={(value) =>
                      setFieldDrafts((current) => ({
                        ...current,
                        [field.id]: value,
                      }))
                    }
                    value={fieldDrafts[field.id] ?? field.value}
                  />
                  <Button
                    disabled={busy}
                    label={`Lưu ${field.name}`}
                    onPress={() => {
                      void run(() =>
                        setTaskFieldValue(
                          taskId,
                          field.id,
                          fieldDrafts[field.id] ?? field.value,
                        ),
                      );
                    }}
                  />
                </View>
              ) : (
                <Notice key={field.id}>
                  {`${field.name}: ${field.value || "—"}`}
                </Notice>
              ),
            )}
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
