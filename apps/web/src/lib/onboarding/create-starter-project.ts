import createProject from "@/fetchers/project/create-project";
import importTasks, { type TaskToImport } from "@/fetchers/task/import-tasks";
import generateProjectSlug from "@/lib/generate-project-id";

const FALLBACK_SLUG = "PRJ";

function slugForAttempt(base: string, attempt: number) {
  if (attempt === 0) return base;
  return `${base}${attempt + 1}`.slice(0, 10);
}

export async function createStarterProject({
  workspaceId,
  name,
  tasks,
}: {
  workspaceId: string;
  name: string;
  tasks: TaskToImport[];
}) {
  const base = generateProjectSlug(name) || FALLBACK_SLUG;
  let lastError: unknown;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const project = await createProject({
        name,
        slug: slugForAttempt(base, attempt),
        workspaceId,
        icon: "Layout",
      });
      await importTasks(project.id, tasks).catch(() => undefined);
      return project.id;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to create starter project");
}
