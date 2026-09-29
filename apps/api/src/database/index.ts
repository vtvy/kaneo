import { config } from "dotenv-mono";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  accountTableRelations,
  activityTableRelations,
  apikeyTableRelations,
  assetTableRelations,
  columnTableRelations,
  commentTableRelations,
  documentTableRelations,
  externalLinkTableRelations,
  folderTableRelations,
  githubIntegrationTableRelations,
  integrationTableRelations,
  invitationTableRelations,
  labelTableRelations,
  notificationTableRelations,
  projectMemberRoleTableRelations,
  projectMemberTableRelations,
  projectRolePermissionTableRelations,
  projectRoleTableRelations,
  projectTableRelations,
  sessionTableRelations,
  sprintTableRelations,
  taskInvolvementTableRelations,
  taskRelationTableRelations,
  taskTableRelations,
  teamMemberTableRelations,
  teamTableRelations,
  timeEntryTableRelations,
  userNotificationPreferenceTableRelations,
  userNotificationWorkspaceProjectTableRelations,
  userNotificationWorkspaceRuleTableRelations,
  userTableRelations,
  verificationTableRelations,
  workflowRuleTableRelations,
  workspaceRoleTableRelations,
  workspaceTableRelations,
  workspaceUserTableRelations,
} from "./relations";
import { resolveDatabaseConnectionString } from "./resolve-database-url";
import {
  accountTable,
  activityTable,
  apikeyTable,
  assetTable,
  columnTable,
  commentTable,
  deviceCodeTable,
  documentTable,
  externalLinkTable,
  folderTable,
  githubIntegrationTable,
  integrationTable,
  invitationTable,
  labelTable,
  notificationTable,
  projectMemberRoleTable,
  projectMemberTable,
  projectRolePermissionTable,
  projectRoleTable,
  projectTable,
  sessionTable,
  sprintTable,
  taskDeletionTable,
  taskInvolvementTable,
  taskRelationTable,
  taskReminderSentTable,
  taskTable,
  teamMemberTable,
  teamTable,
  timeEntryTable,
  userNotificationPreferenceTable,
  userNotificationWorkspaceProjectTable,
  userNotificationWorkspaceRuleTable,
  userTable,
  verificationTable,
  workflowRuleTable,
  workspaceRoleTable,
  workspaceTable,
  workspaceUserTable,
} from "./schema";

config();

export const schema = {
  accountTable,
  assetTable,
  activityTable,
  apikeyTable,
  columnTable,
  commentTable,
  deviceCodeTable,
  documentTable,
  externalLinkTable,
  folderTable,
  githubIntegrationTable,
  integrationTable,
  invitationTable,
  labelTable,
  notificationTable,
  projectMemberRoleTable,
  projectMemberTable,
  projectRolePermissionTable,
  projectRoleTable,
  projectTable,
  sessionTable,
  sprintTable,
  taskDeletionTable,
  taskInvolvementTable,
  taskRelationTable,
  taskReminderSentTable,
  taskTable,
  teamMemberTable,
  teamTable,
  timeEntryTable,
  userTable,
  userNotificationPreferenceTable,
  userNotificationWorkspaceProjectTable,
  userNotificationWorkspaceRuleTable,
  verificationTable,
  workflowRuleTable,
  workspaceRoleTable,
  workspaceTable,
  workspaceUserTable,
  accountTableRelations,
  assetTableRelations,
  activityTableRelations,
  apikeyTableRelations,
  columnTableRelations,
  commentTableRelations,
  documentTableRelations,
  externalLinkTableRelations,
  folderTableRelations,
  githubIntegrationTableRelations,
  integrationTableRelations,
  invitationTableRelations,
  labelTableRelations,
  notificationTableRelations,
  projectMemberRoleTableRelations,
  projectMemberTableRelations,
  projectRolePermissionTableRelations,
  projectRoleTableRelations,
  projectTableRelations,
  sessionTableRelations,
  sprintTableRelations,
  taskInvolvementTableRelations,
  taskRelationTableRelations,
  taskTableRelations,
  teamMemberTableRelations,
  teamTableRelations,
  timeEntryTableRelations,
  userTableRelations,
  userNotificationPreferenceTableRelations,
  userNotificationWorkspaceProjectTableRelations,
  userNotificationWorkspaceRuleTableRelations,
  verificationTableRelations,
  workflowRuleTableRelations,
  workspaceRoleTableRelations,
  workspaceTableRelations,
  workspaceUserTableRelations,
};

type DatabaseInstance = ReturnType<typeof drizzle<typeof schema>>;

let pool: Pool | undefined;
let dbInstance: DatabaseInstance | undefined;

export function getDatabasePool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: resolveDatabaseConnectionString(),
      // Naive timestamp columns rely on a single timezone everywhere (Postgres
      // now(), node-pg reads, and JSON ISO). UTC matches Docker defaults.
      options: "-c timezone=UTC",
    });
  }

  return pool;
}

export function getDatabase(): DatabaseInstance {
  if (!dbInstance) {
    dbInstance = drizzle(getDatabasePool(), {
      schema,
    });
  }

  return dbInstance;
}

const db = new Proxy({} as DatabaseInstance, {
  get(_target, property, receiver) {
    const value = Reflect.get(getDatabase(), property, receiver);

    if (typeof value === "function") {
      return value.bind(getDatabase());
    }

    return value;
  },
});

export default db;
