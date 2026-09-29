import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import * as v from "valibot";
import { workspaceDashboardSchema } from "../schemas";
import { workspaceAccess } from "../utils/workspace-access-middleware";
import getWorkspaceDashboard from "./controllers/get-workspace-dashboard";

const dashboard = new Hono<{
  Variables: {
    userId: string;
    workspaceId: string;
  };
}>().get(
  "/:workspaceId",
  describeRoute({
    operationId: "getWorkspaceDashboard",
    tags: ["Dashboard"],
    description:
      "Aggregated dashboard for a workspace: task stats, per-member breakdown, active sprints, and per-project counts",
    responses: {
      200: {
        description: "Workspace dashboard aggregation",
        content: {
          "application/json": { schema: resolver(workspaceDashboardSchema) },
        },
      },
    },
  }),
  validator("param", v.object({ workspaceId: v.string() })),
  workspaceAccess.fromParam("workspaceId"),
  async (c) => {
    const { workspaceId } = c.req.valid("param");
    const result = await getWorkspaceDashboard(workspaceId);
    return c.json(result);
  },
);

export default dashboard;
