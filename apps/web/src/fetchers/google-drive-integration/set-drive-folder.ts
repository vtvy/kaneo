import { client } from "@kaneo/libs";

async function setDriveFolder(
  projectId: string,
  rootFolderId: string,
  rootFolderName: string,
) {
  const response = await client["google-drive-integration"].project[
    ":projectId"
  ].$put({
    param: { projectId },
    json: { rootFolderId, rootFolderName },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default setDriveFolder;
