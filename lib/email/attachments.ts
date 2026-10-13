// Files on a customer email (2026-10-13): a company booking asked for our W-9
// and certificate of insurance, and the desk could only send text. Checked
// here so the route stays a pass-through.

export type EmailAttachment = { filename: string; content: string } // content: base64

const NAME = /^[\w .()&,'-]{1,120}\.(pdf|png|jpe?g)$/i
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/
export const MAX_ATTACHMENTS = 3
// Vercel takes a 4.5 MB request body; base64 is 4/3 of the file.
export const MAX_ATTACHMENT_BASE64 = 4_000_000

/** The attachments a request asked for, or an error a person can act on. */
export function parseAttachments(raw: unknown): { ok: true; attachments: EmailAttachment[] } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, attachments: [] }
  if (!Array.isArray(raw)) return { ok: false, error: "attachments must be a list" }
  if (raw.length > MAX_ATTACHMENTS) return { ok: false, error: `at most ${MAX_ATTACHMENTS} attachments` }
  const out: EmailAttachment[] = []
  let total = 0
  for (const item of raw) {
    const filename = String((item as { filename?: unknown })?.filename ?? "").trim()
    const content = String((item as { content?: unknown })?.content ?? "").replace(/\s+/g, "")
    if (!NAME.test(filename)) return { ok: false, error: `attachment name not allowed: ${filename || "(empty)"} - pdf, png or jpg` }
    if (!content || !BASE64.test(content)) return { ok: false, error: `attachment ${filename} is not base64` }
    total += content.length
    out.push({ filename, content })
  }
  if (total > MAX_ATTACHMENT_BASE64) return { ok: false, error: "attachments too large (about 3 MB of files at most)" }
  return { ok: true, attachments: out }
}
