import { client } from "@kaneo/libs";

async function disconnectDrive(projectId: string) {
  const response = await client["google-drive-integration"].project[
    ":projectId"
  ].$delete({ param: { projectId } });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default disconnectDrive;
