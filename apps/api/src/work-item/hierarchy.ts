export const WORK_ITEM_TYPES = [
  "epic",
  "feature",
  "backlog_item",
  "task",
  "bug",
] as const;
export type WorkItemType = (typeof WORK_ITEM_TYPES)[number];
export type HierarchyItem = {
  id: string;
  type: string;
  parentId: string | null;
};

export function acceptsChild(parent: string, child: string) {
  return (
    (parent === "epic" && child === "feature") ||
    (parent === "feature" && (child === "backlog_item" || child === "bug")) ||
    ((parent === "backlog_item" || parent === "bug") && child === "task")
  );
}

export function validateHierarchy(items: HierarchyItem[], item: HierarchyItem) {
  if (!WORK_ITEM_TYPES.includes(item.type as WorkItemType))
    return "Invalid work item type";
  const parent = items.find((candidate) => candidate.id === item.parentId);
  if (item.parentId && (!parent || !acceptsChild(parent.type, item.type)))
    return "Parent must belong to this project and accept this work item type";
  const visited = new Set([item.id]);
  let ancestor = parent;
  while (ancestor) {
    if (visited.has(ancestor.id))
      return "Work item hierarchy cannot contain cycles";
    visited.add(ancestor.id);
    ancestor = items.find((candidate) => candidate.id === ancestor?.parentId);
  }
  if (
    items.some(
      (child) =>
        child.parentId === item.id && !acceptsChild(item.type, child.type),
    )
  )
    return "Move child work items before changing this type";
  return null;
}
