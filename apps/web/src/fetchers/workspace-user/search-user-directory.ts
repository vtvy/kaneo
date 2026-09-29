import { client } from "@kaneo/libs";

export type DirectoryUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

async function searchUserDirectory(
  workspaceId: string,
  query = "",
): Promise<DirectoryUser[]> {
  const response = await client.workspace[":workspaceId"][
    "user-directory"
  ].$get({
    param: { workspaceId },
    query: query.trim() ? { q: query.trim() } : {},
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to search users");
  }

  return response.json();
}

export default searchUserDirectory;
