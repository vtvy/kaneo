import { client } from "@kaneo/libs";

async function saveDriveCredentials(
  projectId: string,
  clientId: string,
  clientSecret: string,
) {
  const response = await client["google-drive-integration"].project[
    ":projectId"
  ].credentials.$put({
    param: { projectId },
    json: { clientId, clientSecret },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default saveDriveCredentials;
