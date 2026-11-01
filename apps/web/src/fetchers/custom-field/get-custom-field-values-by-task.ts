import { client } from "@kaneo/libs";

async function getCustomFieldValuesByTask({ taskId }: { taskId: string }) {
  const response = await client["custom-field"].task[":taskId"].$get({
    param: { taskId },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default getCustomFieldValuesByTask;
