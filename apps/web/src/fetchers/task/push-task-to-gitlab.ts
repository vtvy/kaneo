import { client } from "@kaneo/libs";

async function pushTaskToGitlab(taskId: string) {
  const response = await client.task[":id"]["push-to-gitlab"].$post({
    param: { id: taskId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to push task to GitLab");
  }

  return response.json();
}

export default pushTaskToGitlab;
