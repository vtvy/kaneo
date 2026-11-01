/** Escape `%`, `_` and `\` so user input matches literally in LIKE. */
export function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
