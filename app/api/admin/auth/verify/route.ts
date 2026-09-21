import { type NextRequest, NextResponse } from "next/server"
import { createSession, memberActor, publicActor, requestMeta, sessionCookie } from "@/lib/admin-auth"
import { consumeLoginCode, findActiveMember, normalizeLoginPhone } from "@/lib/workbench-login"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// POST { phone, code } -> sets the session cookie (30 days) and returns the viewer.
export async function POST(request: NextRequest) {
  let body: { phone?: unknown; code?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 })
  }
  const phone = normalizeLoginPhone(body.phone)
  const code = typeof body.code === "string" ? body.code : ""
  if (!phone || !code) return NextResponse.json({ ok: false, error: "手机号和验证码都要填" }, { status: 400 })
  const member = await findActiveMember(phone)
  if (!member) return NextResponse.json({ ok: false, error: "这个号码没有登记为工作台成员" }, { status: 404 })
  const check = await consumeLoginCode(phone, code)
  if (!check.ok) return NextResponse.json({ ok: false, error: check.error }, { status: 401 })

  const meta = requestMeta(request)
  const session = await createSession(member.id, { via: "sms", ...meta })
  if (!session) return NextResponse.json({ ok: false, error: "session not created" }, { status: 500 })
  const res = NextResponse.json({ ok: true, viewer: publicActor(memberActor(member)) })
  res.cookies.set(sessionCookie(session.token, session.expiresAt))
  return res
}
