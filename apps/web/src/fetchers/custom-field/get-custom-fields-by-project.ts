import { client } from "@kaneo/libs";

async function getCustomFieldsByProject({ projectId }: { projectId: string }) {
  const response = await client["custom-field"].project[":projectId"].$get({
    param: { projectId },
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

export default getCustomFieldsByProject;
