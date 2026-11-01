export function resolveFeedbackRecipient(
  raw = process.env.FEEDBACK_EMAIL,
): string | null {
  const value = raw?.trim();
  return value && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(value)
    ? value
    : null;
}
