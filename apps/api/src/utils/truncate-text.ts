/**
 * Bounds untrusted upstream text (e.g. an error response body from a remote
 * service) before it is kept on an error or written to logs.
 */
export function truncateText(text: string, maxLength = 200): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}
