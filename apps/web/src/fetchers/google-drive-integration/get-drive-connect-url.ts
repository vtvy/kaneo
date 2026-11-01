import { client } from "@kaneo/libs";

async function getDriveConnectUrl(projectId: string) {
  const response = await client["google-drive-integration"].project[
    ":projectId"
  ].connect.$post({ param: { projectId } });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default getDriveConnectUrl;
