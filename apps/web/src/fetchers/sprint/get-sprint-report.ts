import { client } from "@kaneo/libs";

async function getSprintReport({ id }: { id: string }) {
  const response = await client.sprint[":id"].report.$get({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return await response.json();
}

export default getSprintReport;
