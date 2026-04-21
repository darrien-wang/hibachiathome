import { NextResponse } from "next/server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"
import {
  LIVECHAT_VISITOR_COOKIE_NAME,
  createLivechatVisitorKey,
  fetchSessionPayload,
  findLatestVisitorSession,
} from "@/lib/livechat-public"

function buildCookieOptions(request: Request) {
  const isSecure = request.url.startsWith("https://")
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isSecure,
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  }
}

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 })
  }

  const requestUrl = new URL(request.url)
  const sessionId = requestUrl.searchParams.get("sessionId")
  const cookieHeader = request.headers.get("cookie") || ""
  const visitorKey = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LIVECHAT_VISITOR_COOKIE_NAME}=`))
    ?.slice(LIVECHAT_VISITOR_COOKIE_NAME.length + 1)

  if (!visitorKey) {
    return NextResponse.json({ ok: true, session: null, messages: [] }, { headers: { "Cache-Control": "no-store" } })
  }

  try {
    const resolvedSession = sessionId
      ? await fetchSessionPayload(supabase, sessionId, visitorKey)
      : await (async () => {
          const latest = await findLatestVisitorSession(supabase, visitorKey)
          if (!latest) return null
          return fetchSessionPayload(supabase, latest.id, visitorKey)
        })()

    return NextResponse.json(
      { ok: true, session: resolvedSession?.session ?? null, messages: resolvedSession?.messages ?? [] },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load livechat session." },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null)
  const restartRequested = payload?.restart === true

  const existingCookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LIVECHAT_VISITOR_COOKIE_NAME}=`))
    ?.slice(LIVECHAT_VISITOR_COOKIE_NAME.length + 1)
  const visitorKey = restartRequested ? createLivechatVisitorKey() : existingCookie || createLivechatVisitorKey()

  const response = NextResponse.json({ ok: true, visitorKey })
  response.cookies.set(LIVECHAT_VISITOR_COOKIE_NAME, visitorKey, buildCookieOptions(request))
  return response
}
