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

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  let body: { to?: string; subject?: string; text?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  const to = String(body.to ?? "").trim()
  const subject = String(body.subject ?? "").trim().slice(0, 200)
  const text = String(body.text ?? "").trim().slice(0, 5000)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || !subject || !text) {
    return NextResponse.json({ error: "to, subject and text required" }, { status: 400 })
  }
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "email not configured" }, { status: 500 })
  }
  try {
    const resend = new Resend(apiKey)
    const from = process.env.EMAIL_FROM
      ? `Real Hibachi <${process.env.EMAIL_FROM}>`
      : "Real Hibachi <support@realhibachi.com>"
    const result = await resend.emails.send({
      from,
      to,
      replyTo: process.env.EMAIL_FROM || "support@realhibachi.com",
      subject,
      text,
    })
    if (result.error) throw new Error(result.error.message)
    return NextResponse.json({ ok: true, id: result.data?.id ?? null })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
