import { client } from "@kaneo/libs";

async function deleteNotification(id: string) {
  const response = await client.notification[":id"].$delete({
    param: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default deleteNotification;
