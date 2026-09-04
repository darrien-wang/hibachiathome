import { type NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"

export const dynamic = "force-dynamic"

// Staff-only: send a follow-up email FROM support@realhibachi.com (the
// verified sender), so outreach never leaks a personal mailbox.
function isAuthorized(request: NextRequest): boolean {
  const provided = request.headers.get("x-admin-key") ?? ""
  if (!provided) return false
  const owner = process.env.ADMIN_DASH_KEY
  if (owner && provided === owner) return true
  for (const entry of (process.env.AGENT_DASH_KEYS ?? "").split(",")) {
    const [alias, key] = entry.split(":").map((s) => s?.trim())
    if (alias && key && provided === key) return true
  }
  return false
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_CC = 5

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  let body: { to?: string; cc?: string | string[]; subject?: string; text?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  const to = String(body.to ?? "").trim()
  const subject = String(body.subject ?? "").trim().slice(0, 200)
  const text = String(body.text ?? "").trim().slice(0, 5000)
  if (!EMAIL_RE.test(to) || !subject || !text) {
    return NextResponse.json({ error: "to, subject and text required" }, { status: 400 })
  }

  // An inquiry often arrives with the customer's co-deciders on copy (spouse,
  // parents, the colleague holding the budget). Dropping them turns a group
  // conversation into a private one and the reply reads as if it went missing.
  const ccRaw = Array.isArray(body.cc) ? body.cc : String(body.cc ?? "").split(/[,;]/)
  const cc: string[] = []
  for (const entry of ccRaw) {
    const address = String(entry ?? "").trim()
    if (!address) continue
    if (!EMAIL_RE.test(address)) {
      return NextResponse.json({ error: `invalid cc address: ${address}` }, { status: 400 })
    }
    const lower = address.toLowerCase()
    if (lower === to.toLowerCase() || cc.some((existing) => existing.toLowerCase() === lower)) continue
    cc.push(address)
  }
  if (cc.length > MAX_CC) {
    return NextResponse.json({ error: `at most ${MAX_CC} cc addresses` }, { status: 400 })
  }
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "email not configured" }, { status: 500 })
  }
  try {
    const resend = new Resend(apiKey)
    // Customer mail must come from, and reply into, the mailbox staff actually
    // watch. EMAIL_FROM is the ops notification identity (notify@) and is
    // deliberately not used here: a customer hitting Reply on it lands in an
    // unmonitored inbox, which loses the lead silently.
    const inbox = process.env.EMAIL_TO || "support@realhibachi.com"
    const result = await resend.emails.send({
      from: `Real Hibachi <${inbox}>`,
      to,
      ...(cc.length > 0 ? { cc } : {}),
      replyTo: inbox,
      subject,
      text,
    })
    if (result.error) throw new Error(result.error.message)
    return NextResponse.json({ ok: true, id: result.data?.id ?? null, cc })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
