import { listProjectDriveFiles } from "../providers";

// Lists files + folders in the project's connected Drive (for the "Add from
// Drive" picker). Defaults to the project's configured root folder.
async function listDriveFiles(projectId: string, folderId?: string) {
  return listProjectDriveFiles(projectId, folderId);
}

export default listDriveFiles;
