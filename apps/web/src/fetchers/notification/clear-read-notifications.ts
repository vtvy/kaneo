import { client } from "@kaneo/libs";

async function clearReadNotifications() {
  const response = await client.notification["clear-read"].$delete();

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default clearReadNotifications;
