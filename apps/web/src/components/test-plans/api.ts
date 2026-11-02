import { testPlansClient } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono/client";

const api = testPlansClient["test-plans"][":projectId"];
export type Overview = InferResponseType<typeof api.$get>;
export type Plan = Overview["plans"][number];
export type TestCase = Overview["cases"][number];
export type RunDetail = InferResponseType<(typeof api.runs)[":runId"]["$get"]>;
export type TestResult = RunDetail["results"][number];
export type PlanInput = InferRequestType<typeof api.plans.$post>["json"];
export type CaseInput = InferRequestType<typeof api.cases.$post>["json"];
export type StartInput = InferRequestType<
  (typeof api.plans)[":planId"]["runs"]["$post"]
>["json"];
export type ResultInput = InferRequestType<
  (typeof api.runs)[":runId"]["results"][":resultId"]["$put"]
>["json"];
export type RunState = InferRequestType<
  (typeof api.runs)[":runId"]["$patch"]
>["json"]["state"];
async function read<T>(
  response: Response & { json: () => Promise<T> },
): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    try {
      const parsed: { message?: string } = JSON.parse(text);
      throw new Error(parsed.message || text);
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error(text);
      throw error;
    }
  }
  return response.json();
}
export const testPlanApi = {
  overview: async (projectId: string) =>
    read(await api.$get({ param: { projectId } })),
  savePlan: async (projectId: string, input: PlanInput, id?: string) =>
    id
      ? read(
          await api.plans[":planId"].$put({
            param: { projectId, planId: id },
            json: input,
          }),
        )
      : read(await api.plans.$post({ param: { projectId }, json: input })),
  saveSuite: async (
    projectId: string,
    planId: string,
    title: string,
    suiteId?: string,
  ) =>
    suiteId
      ? read(
          await api.plans[":planId"].suites[":suiteId"].$put({
            param: { projectId, planId, suiteId },
            json: { title },
          }),
        )
      : read(
          await api.plans[":planId"].suites.$post({
            param: { projectId, planId },
            json: { title },
          }),
        ),
  saveCase: async (projectId: string, input: CaseInput, existing?: TestCase) =>
    existing
      ? read(
          await api.cases[":caseId"].$put({
            param: { projectId, caseId: existing.id },
            json: { ...input, revision: existing.revision },
          }),
        )
      : read(await api.cases.$post({ param: { projectId }, json: input })),
  membership: async (
    projectId: string,
    suiteId: string,
    caseId: string,
    remove: boolean,
  ) => {
    const endpoint = api.suites[":suiteId"].cases[":caseId"];
    return remove
      ? read(await endpoint.$delete({ param: { projectId, suiteId, caseId } }))
      : read(await endpoint.$post({ param: { projectId, suiteId, caseId } }));
  },
  start: async (projectId: string, planId: string, input: StartInput) =>
    read(
      await api.plans[":planId"].runs.$post({
        param: { projectId, planId },
        json: input,
      }),
    ),
  detail: async (projectId: string, runId: string) =>
    read(await api.runs[":runId"].$get({ param: { projectId, runId } })),
  saveResult: async (
    projectId: string,
    runId: string,
    resultId: string,
    input: ResultInput,
  ) =>
    read(
      await api.runs[":runId"].results[":resultId"].$put({
        param: { projectId, runId, resultId },
        json: input,
      }),
    ),
  transition: async (
    projectId: string,
    runId: string,
    version: number,
    state: RunState,
  ) =>
    read(
      await api.runs[":runId"].$patch({
        param: { projectId, runId },
        json: { version, state },
      }),
    ),
};
