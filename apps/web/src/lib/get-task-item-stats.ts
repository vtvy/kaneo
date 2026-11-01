type TaskItemsStats = {
  total: number;
  completed: number;
};

const TASK_ITEM_PATTERN =
  /^\s*(?:>\s*)*(?:[-+*]|\d{1,9}[.)])\s+\[([ xX])\](?:\s|$)/;
const FENCE_PATTERN = /^\s*(`{3,}|~{3,})/;

export function getTaskItemStats(
  description: string | null | undefined,
): TaskItemsStats {
  if (!description) return { total: 0, completed: 0 };

  let total = 0;
  let completed = 0;
  let fenceChar: string | null = null;
  let fenceLen = 0;

  for (const line of description.split(/\r\n|\n/)) {
    const fenceMatch = FENCE_PATTERN.exec(line);

    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!fenceChar) {
        fenceChar = marker[0];
        fenceLen = marker.length;
      } else if (marker[0] === fenceChar && marker.length >= fenceLen) {
        fenceChar = null;
      }
      continue;
    }

    if (fenceChar) continue;

    const taskMatch = TASK_ITEM_PATTERN.exec(line);
    if (!taskMatch) continue;

    total += 1;
    if (taskMatch[1].toLowerCase() === "x") completed += 1;
  }

  return { total, completed };
}
