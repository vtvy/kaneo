import { client } from "@kaneo/libs";

async function linkDriveDocument(
  projectId: string,
  driveFileId: string,
  folderId: string | null,
) {
  const response = await client.document.drive[":projectId"].link.$post({
    param: { projectId },
    json: { driveFileId, folderId },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default linkDriveDocument;
