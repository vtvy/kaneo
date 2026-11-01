import { eq, sql } from "drizzle-orm";
import db from "../../database";
import { projectTable } from "../../database/schema";
import {
  addProjectMemberWithRole,
  seedProjectRoles,
} from "../../project-rbac/seed-default-project-roles";
import { createWithUniqueKey } from "./create-with-unique-key";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type CreatedProject = typeof projectTable.$inferSelect;

export type ImportProjectInput = {
  workspaceId: string;
  name: string;
  userId: string;
  preferredKey?: string;
};

/**
 * Creates the project and everything in it in one transaction, so a failed
 * import leaves nothing behind. The importer becomes the project's Owner
 * before any content is written.
 */
export async function createImportProject<T>(
  { workspaceId, name, userId, preferredKey }: ImportProjectInput,
  fill: (tx: Transaction, project: CreatedProject) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // Serialize imports into the same workspace so two projects never pick
    // the same key.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext('import-project-key'), hashtext(${workspaceId}))`,
    );
    const existing = await tx
      .select({ slug: projectTable.slug })
      .from(projectTable)
      .where(eq(projectTable.workspaceId, workspaceId));

    return createWithUniqueKey(
      name,
      existing.map((row) => row.slug),
      async (slug) => {
        const [project] = await tx
          .insert(projectTable)
          .values({ workspaceId, name, icon: "Layout", slug })
          .returning();
        if (!project) throw new Error("Failed to create the imported project");
        await seedProjectRoles(tx, project.id);
        await addProjectMemberWithRole(tx, project.id, userId, "Owner");
        return fill(tx, project);
      },
      { preferredKey },
    );
  });
}
