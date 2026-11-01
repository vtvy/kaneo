import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono";

const importApi = client.import;

export type ImportConnection = InferRequestType<
  (typeof importApi)["projects"]["$post"]
>["json"]["connection"];

export type StartImportRunRequest = InferRequestType<
  (typeof importApi)["runs"]["$post"]
>["json"];

export type ImportRun = InferResponseType<
  (typeof importApi)["runs"][":workspaceId"][":runId"]["$get"],
  200
>["run"];

export type ImportRunProject = ImportRun["projects"][number];

async function ensureOk(response: Response) {
  if (!response.ok) throw new Error(await response.text());
}

export async function listImportSourceProjects(data: {
  workspaceId: string;
  connection: ImportConnection;
}) {
  const response = await importApi.projects.$post({ json: data });
  await ensureOk(response);
  return response.json();
}

export async function startImportRun(data: StartImportRunRequest) {
  const response = await importApi.runs.$post({ json: data });
  await ensureOk(response);
  return response.json();
}

export async function getImportRuns(workspaceId: string) {
  const response = await importApi.runs[":workspaceId"].$get({
    param: { workspaceId },
  });
  await ensureOk(response);
  return response.json();
}

export async function getImportRun(workspaceId: string, runId: string) {
  const response = await importApi.runs[":workspaceId"][":runId"].$get({
    param: { workspaceId, runId },
  });
  await ensureOk(response);
  return response.json();
}
