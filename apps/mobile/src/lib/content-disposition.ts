export function filenameFromContentDisposition(
  header: string | null,
): string | null {
  if (!header) return null;

  const encoded = /filename\*\s*=\s*([^']*)''([^;]+)/i.exec(header);
  if (encoded?.[2]) {
    const value = encoded[2].trim().replace(/["]/g, "");
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  const quoted = /filename\s*=\s*"([^"]+)"/i.exec(header);
  if (quoted?.[1]) return quoted[1];

  const plain = /filename\s*=\s*([^;]+)/i.exec(header);
  if (plain?.[1]) return plain[1].trim();
  return null;
}

export function safeDownloadName(name: string): string {
  let cleaned = "";
  for (const char of name) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 32) continue;
    cleaned += char === "/" || char === "\\" ? "-" : char;
  }
  const trimmed = cleaned.trim();
  return trimmed || "file";
}
