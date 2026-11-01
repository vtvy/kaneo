export type FilterLabel = {
  id: string;
  name: string;
  color: string;
};

export function labelGroupKey(label: { name: string; color: string }) {
  return `${label.name}\0${label.color.toLowerCase()}`;
}

// A saved filter stores label ids. A later label with the same name and color
// should match too, without rewriting the saved selection.
export function expandLabelFilter(
  labels: readonly FilterLabel[],
  selected: string[] | null,
): string[] | null {
  if (!selected?.length) return selected;

  const selectedIds = new Set(selected);
  const selectedGroups = new Set(
    labels.filter((label) => selectedIds.has(label.id)).map(labelGroupKey),
  );
  for (const label of labels) {
    if (selectedGroups.has(labelGroupKey(label))) selectedIds.add(label.id);
  }
  return [...selectedIds];
}
