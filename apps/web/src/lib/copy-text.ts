/**
 * Copy text to the clipboard. Uses the Clipboard API in secure contexts
 * (HTTPS / localhost) and falls back to a hidden textarea + execCommand on
 * plain-HTTP origins such as LAN deploys, where `navigator.clipboard` is
 * unavailable.
 */
export async function copyText(text: string): Promise<void> {
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard?.writeText &&
    typeof window !== "undefined" &&
    window.isSecureContext
  ) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  try {
    if (!document.execCommand("copy")) {
      throw new Error("Copy command was rejected");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}
