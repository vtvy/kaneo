import { client } from "@kaneo/libs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import { useProjectPermission } from "@/hooks/use-project-permission";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";
import { WorkItemBadge } from ".";

export default function CardChildren({
  task,
  workspaceId,
}: {
  task: Task;
  workspaceId: string;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { can } = useProjectPermission(task.projectId);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const { data: columns = [] } = useGetColumns(task.projectId);
  const { data: items = [] } = useQuery({
    queryKey: ["work-items", task.projectId],
    queryFn: async () => {
      const res = await client["work-items"][":projectId"].$get({
        param: { projectId: task.projectId },
      });
      if (!res.ok) throw Error(await res.text());
      return res.json();
    },
  });
  const children = items.filter((item) => item.parentId === task.id);
  const mutation = useMutation({
    mutationFn: async () => {
      const type =
        task.type === "epic"
          ? "feature"
          : task.type === "feature"
            ? "backlog_item"
            : "task";
      const res = await client["work-items"][":projectId"].$post({
        param: { projectId: task.projectId },
        json: { title, type, parentId: task.id },
      });
      if (!res.ok) throw Error(await res.text());
    },
    onSuccess: () => {
      setAdding(false);
      setTitle("");
      qc.invalidateQueries({ queryKey: ["work-items", task.projectId] });
      qc.invalidateQueries({ queryKey: ["tasks", task.projectId] });
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <fieldset
      aria-label="Child work items"
      className="space-y-1"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {children.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {
            children.filter((item) =>
              columns.some(
                (column) => column.isFinal && column.slug === item.status,
              ),
            ).length
          }
          /{children.length}
        </p>
      )}
      {children.map((item) => (
        <button
          key={item.id}
          type="button"
          className="flex w-full items-center gap-2 truncate text-left text-xs hover:underline"
          onClick={() =>
            navigate({
              to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
              params: { projectId: task.projectId, workspaceId },
              search: { taskId: item.id },
            })
          }
        >
          <WorkItemBadge type={item.type} />
          {item.title}
        </button>
      ))}
      {can("item", "create") && !adding && (
        <Button size="xs" variant="ghost" onClick={() => setAdding(true)}>
          +{" "}
          {task.type === "epic"
            ? "Feature"
            : task.type === "feature"
              ? "Backlog Item"
              : "Task"}
        </Button>
      )}
      {adding && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
          className="space-y-1"
        >
          <Input
            aria-label="Child work item title"
            value={title}
            required
            maxLength={1000}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Button
            type="submit"
            size="xs"
            disabled={mutation.isPending || !title.trim()}
          >
            Add
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => setAdding(false)}
          >
            Cancel
          </Button>
        </form>
      )}
    </fieldset>
  );
}
