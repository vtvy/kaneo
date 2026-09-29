import { client } from "@kaneo/libs";

export type WorkspaceDashboardStats = {
  total: number;
  open: number;
  completed: number;
  overdue: number;
};

export type WorkspaceDashboardMember = {
  userId: string;
  name: string;
  open: number;
  overdue: number;
  completed: number;
  total: number;
};

export type WorkspaceDashboardSprint = {
  id: string;
  name: string;
  endDate: string | null;
  totalTasks: number;
  completedTasks: number;
  totalPoints: number;
  completedPoints: number;
};

export type WorkspaceDashboardProject = {
  id: string;
  name: string;
  slug: string;
  totalTasks: number;
  completedTasks: number;
};

export type WorkspaceDashboard = {
  stats: WorkspaceDashboardStats;
  members: WorkspaceDashboardMember[];
  activeSprints: WorkspaceDashboardSprint[];
  projects: WorkspaceDashboardProject[];
};

async function getWorkspaceDashboard(
  workspaceId: string,
): Promise<WorkspaceDashboard> {
  const response = await client.dashboard[":workspaceId"].$get({
    param: { workspaceId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return (await response.json()) as WorkspaceDashboard;
}

export default getWorkspaceDashboard;
