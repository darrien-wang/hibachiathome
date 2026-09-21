import { type NextRequest, NextResponse } from "next/server"
import { SESSION_COOKIE, clearedSessionCookie, revokeSessionToken } from "@/lib/admin-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// POST -> revokes this browser's session and clears the cookie.
export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value ?? ""
  if (token) await revokeSessionToken(token)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(clearedSessionCookie())
  return res
}
