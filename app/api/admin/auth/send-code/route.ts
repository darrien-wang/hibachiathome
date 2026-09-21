import { type NextRequest, NextResponse } from "next/server"
import { requestMeta } from "@/lib/admin-auth"
import { findActiveMember, issueLoginCode, loginCodeSms, normalizeLoginPhone } from "@/lib/workbench-login"
import { sendSms } from "@/lib/sms-thread"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// POST { phone } -> texts a six-digit code to a registered, active member.
// Unknown numbers get a plain "not registered": this is an internal tool for
// a handful of people, so telling them beats leaving them waiting for a text.
export async function POST(request: NextRequest) {
  let body: { phone?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 })
  }
  const phone = normalizeLoginPhone(body.phone)
  if (!phone) return NextResponse.json({ ok: false, error: "手机号不对，输 10 位美国号码" }, { status: 400 })
  const member = await findActiveMember(phone)
  if (!member) return NextResponse.json({ ok: false, error: "这个号码没有登记为工作台成员，找管理员加一下" }, { status: 404 })

  const { ip } = requestMeta(request)
  const issued = await issueLoginCode(phone, ip)
  if (!issued.ok) return NextResponse.json({ ok: false, error: issued.error }, { status: issued.status })

  // Local dev has no reason to text a real phone: echo the code instead.
  if (process.env.NODE_ENV === "development") {
    return NextResponse.json({ ok: true, sent: false, devCode: issued.code, name: member.name })
  }
  const sms = await sendSms(phone, loginCodeSms(issued.code))
  if (!sms.ok) return NextResponse.json({ ok: false, error: `短信没发出去：${sms.error}` }, { status: 502 })
  return NextResponse.json({ ok: true, sent: true, name: member.name })
}
