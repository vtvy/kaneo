import { client } from "@kaneo/libs";

export type DirectoryUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

async function searchProjectUserDirectory(
  projectId: string,
  query = "",
): Promise<DirectoryUser[]> {
  const response = await client["project-rbac"][":projectId"][
    "user-directory"
  ].$get({
    param: { projectId },
    query: query.trim() ? { q: query.trim() } : {},
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to search users");
  }

  return response.json();
}

export default searchProjectUserDirectory;
