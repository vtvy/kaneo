import { eventContext, subscribeToEvent } from "../../events";
import { createNextOccurrence } from "./create-next-occurrence";

async function continueSeries(data: {
  taskId?: string;
  userId?: string | null;
}) {
  const { taskId } = data;
  if (!taskId) return;
  // Leave the completing request's context so task.created reaches its own
  // window too: that client may have refetched the board before this insert.
  await eventContext.exit(() =>
    createNextOccurrence(taskId, data.userId).catch((error) => {
      console.error(
        `Failed to create the next occurrence of task ${taskId}`,
        error,
      );
    }),
  );
}

// Every completion path (status route, full update, bulk, project move,
// Git integrations) announces one of these; the rule handoff is idempotent.
for (const eventType of ["task.status_changed", "task.moved", "task.updated"]) {
  subscribeToEvent(eventType, continueSeries);
}
