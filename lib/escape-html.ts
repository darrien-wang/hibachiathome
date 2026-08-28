/**
 * Escape a string for safe interpolation into HTML (e.g. notification email
 * bodies). Prevents HTML/attribute injection when user-supplied values like
 * customer name, location, or free-text are placed inside `<p>...</p>` markup.
 *
 * Non-string input is coerced to string first. Undefined/null become "".
 */
export function escapeHtml(value: unknown): string {
  if (value === undefined || value === null) {
    return ""
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
