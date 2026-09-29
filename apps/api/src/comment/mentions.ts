/**
 * Normalizes a list of mentioned user IDs from a comment.
 *
 * Trims whitespace, drops empty strings, removes duplicates (order-stable,
 * first occurrence wins), and excludes the commenter's own ID so authors are
 * never notified about mentioning themselves.
 */
export function dedupeMentions(
  mentions: string[] | undefined,
  commenterId: string,
): string[] {
  if (!mentions) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of mentions) {
    const id = typeof raw === "string" ? raw.trim() : "";
    if (!id || id === commenterId || seen.has(id)) {
      continue;
    }
    seen.add(id);
    result.push(id);
  }

  return result;
}
