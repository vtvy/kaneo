import { client } from "@kaneo/libs";

async function getDriveStatus(projectId: string) {
  const response = await client["google-drive-integration"].project[
    ":projectId"
  ].$get({ param: { projectId } });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default getDriveStatus;
