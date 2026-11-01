import { client } from "@kaneo/libs";

export type MoveProjectRequest = {
  id: string;
  workspaceId: string;
};

async function moveProject({ id, workspaceId }: MoveProjectRequest) {
  const response = await client.project[":id"].move.$put({
    param: { id },
    json: { workspaceId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export default moveProject;
