import { type NextRequest, NextResponse } from "next/server"
import { sendSms, toE164 } from "@/lib/sms-thread"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// The party planner's own texts (决策日志 D-0917-01): four milestones to a host
// ("your first guest joined", "half are in", "everyone picked", "3 days out and
// some haven't") and one reminder to any friend who asked for it.
//
// Server-to-server only, same shared admin token as /api/planner-unlock. The
// planner app decides WHETHER to text - who the verified host is, which
// milestone, the once-only stamps, the per-number daily cap - and writes the
// words. This route only sends, through the threaded sender, so the text comes
// from the business line and sits in the workbench conversation when the
// person replies to it.
const KINDS = new Set(["host_first", "host_half", "host_all", "host_nudge", "guest_reminder"])

export async function POST(request: NextRequest) {
  const expected = process.env.INVOICE_UPDATE_ADMIN_TOKEN?.trim()
  const provided = request.headers.get("x-admin-token")?.trim()
  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
  }

  let body: { phone?: string; body?: string; kind?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const phone = toE164(String(body.phone ?? "").trim())
  const text = String(body.body ?? "").trim()
  const kind = String(body.kind ?? "")
  if (!phone) return NextResponse.json({ ok: false, error: "phone_invalid" }, { status: 400 })
  if (!KINDS.has(kind)) return NextResponse.json({ ok: false, error: "kind_invalid" }, { status: 400 })
  if (text.length < 10 || text.length > 600) return NextResponse.json({ ok: false, error: "body_invalid" }, { status: 400 })
  // every planner text is ours and says so; refuse anything that does not
  if (!text.startsWith("Real Hibachi:")) return NextResponse.json({ ok: false, error: "body_unsigned" }, { status: 400 })

  const sms = await sendSms(phone, text)
  if (!sms.ok) console.error("[planner-notify] sms failed", { kind, error: sms.error })
  return NextResponse.json({ ok: true, delivered: sms.ok, error: sms.ok ? undefined : sms.error })
}
