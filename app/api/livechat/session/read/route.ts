import { NextResponse } from "next/server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"
import {
  LIVECHAT_VISITOR_COOKIE_NAME,
  fetchSessionPayload,
  findAuthorizedSession,
} from "@/lib/livechat-public"

function readCookie(request: Request, key: string) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${key}=`))
    ?.slice(key.length + 1)
}

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 })
  }

  const payload = await request.json().catch(() => null)
  const sessionId = typeof payload?.sessionId === "string" ? payload.sessionId.trim() : ""
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Session id is required." }, { status: 400 })
  }

  const visitorKey = readCookie(request, LIVECHAT_VISITOR_COOKIE_NAME)
  if (!visitorKey) {
    return NextResponse.json({ ok: false, error: "Visitor session is missing." }, { status: 401 })
  }

  try {
    const session = await findAuthorizedSession(supabase, sessionId, visitorKey)
    if (!session) {
      return NextResponse.json({ ok: false, error: "Livechat session was not found." }, { status: 404 })
    }

    if (session.unread_for_visitor_count > 0) {
      const { error: updateError } = await supabase
        .from("chat_sessions")
        .update({
          unread_for_visitor_count: 0,
        })
        .eq("id", session.id)

      if (updateError) {
        throw new Error(`Failed to acknowledge visitor messages: ${updateError.message}`)
      }
    }

    const result = await fetchSessionPayload(supabase, session.id, visitorKey)
    if (!result) {
      throw new Error("Livechat session could not be reloaded after acknowledgement.")
    }

    return NextResponse.json({ ok: true, session: result.session, messages: result.messages })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to acknowledge unread messages." },
      { status: 500 },
    )
  }
}
