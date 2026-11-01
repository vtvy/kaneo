import { client } from "@kaneo/libs";

async function getTaskByTicketId({
  ticketId,
  workspaceSlug,
}: {
  ticketId: string;
  workspaceSlug: string;
}) {
  const response = await client.task.ticket[":ticketId"].$get({
    param: { ticketId },
    query: { workspaceSlug },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default getTaskByTicketId;
