// Mirrors toSlug in column/controllers/create-column.ts: tasks reference a
// column by this slug, so imported columns must derive it the same way.
export function toColumnSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
