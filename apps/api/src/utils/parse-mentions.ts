const MENTION_TAG = /<kaneo-mention\b([^>]*)>/gi;
const ID_ATTRIBUTE = /(?:^|\s)id\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const FENCED_CODE =
  /(^|\n)[ \t]*(```|~~~)[^\n]*\n[\s\S]*?(?:\n[ \t]*\2[^\n]*(?=\n|$)|$)/g;
const INLINE_CODE = /(`+)[\s\S]*?\1/g;

function decodeEntities(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * Extract unique mentioned user ids from a comment body. The comment editor
 * serializes an @mention to Markdown as
 * `<kaneo-mention id="<userId>" label="<name>"></kaneo-mention>`; mentions
 * that sit inside code spans or fenced code blocks are literal text and are
 * ignored. Order is first-occurrence.
 */
export function parseMentionIds(content: string | null | undefined): string[] {
  if (!content) return [];

  const text = content.replace(FENCED_CODE, "$1").replace(INLINE_CODE, "");
  const ids = new Set<string>();
  for (const match of text.matchAll(MENTION_TAG)) {
    const attrs = match[1] ?? "";
    const idMatch = attrs.match(ID_ATTRIBUTE);
    const id = decodeEntities(idMatch?.[1] ?? idMatch?.[2] ?? "").trim();
    if (id) ids.add(id);
  }
  return [...ids];
}
