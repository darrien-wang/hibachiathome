import { NextResponse } from "next/server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"
import {
  LIVECHAT_VISITOR_COOKIE_NAME,
  createLivechatVisitorKey,
  ensureLivechatFirstReplyTimeoutMessage,
  fetchSessionPayload,
  findAuthorizedSession,
  findLatestVisitorSession,
  normalizeChatText,
} from "@/lib/livechat-public"

function readCookie(request: Request, key: string) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${key}=`))
    ?.slice(key.length + 1)
}

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

export async function POST(request: Request) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 })
  }

  const payload = await request.json().catch(() => null)
  const messageBody = normalizeChatText(payload?.message)
  const visitorName = normalizeChatText(payload?.visitorName)
  const visitorEmail = normalizeChatText(payload?.visitorEmail) || null
  const visitorPhone = normalizeChatText(payload?.visitorPhone) || null
  const initialPageUrl = normalizeChatText(payload?.initialPageUrl) || null
  const requestedSessionId = normalizeChatText(payload?.sessionId) || null
  const source = normalizeChatText(payload?.source) || "marketing_page"
  const contextMetadata =
    payload?.contextMetadata && typeof payload.contextMetadata === "object" && !Array.isArray(payload.contextMetadata)
      ? payload.contextMetadata
      : null

  if (!messageBody) {
    return NextResponse.json({ ok: false, error: "Message is required." }, { status: 400 })
  }

  if (!visitorName) {
    return NextResponse.json({ ok: false, error: "Visitor name is required." }, { status: 400 })
  }

  const visitorKey = readCookie(request, LIVECHAT_VISITOR_COOKIE_NAME) || createLivechatVisitorKey()

  try {
    let session = await findAuthorizedSession(supabase, requestedSessionId, visitorKey)

    if (!session && !requestedSessionId) {
      session = await findLatestVisitorSession(supabase, visitorKey)
    }

    if (!session) {
      const { data: createdSession, error: createSessionError } = await supabase
        .from("chat_sessions")
        .insert({
          visitor_key: visitorKey,
          source,
          status: "waiting_admin",
          priority: "normal",
          visitor_name: visitorName,
          visitor_email: visitorEmail,
          visitor_phone: visitorPhone,
          initial_page_url: initialPageUrl,
          source_metadata: {
            initial_page_url: initialPageUrl,
            entry_surface: source,
            ...(contextMetadata ? { marketing_context: contextMetadata } : {}),
          },
        })
        .select("id")
        .single<{ id: string }>()

      if (createSessionError || !createdSession) {
        throw new Error(createSessionError?.message || "Failed to create livechat session.")
      }

      session = await findAuthorizedSession(supabase, createdSession.id, visitorKey)
      if (!session) {
        throw new Error("Created livechat session could not be reloaded.")
      }
    } else {
      const sessionUpdate: Record<string, unknown> = {}
      if (visitorName && visitorName !== session.visitor_name) sessionUpdate.visitor_name = visitorName
      if (visitorEmail !== session.visitor_email) sessionUpdate.visitor_email = visitorEmail
      if (visitorPhone !== session.visitor_phone) sessionUpdate.visitor_phone = visitorPhone
      if (initialPageUrl && initialPageUrl !== session.initial_page_url) sessionUpdate.initial_page_url = initialPageUrl
      if (contextMetadata) {
        sessionUpdate.source_metadata = {
          initial_page_url: initialPageUrl ?? session.initial_page_url,
          entry_surface: source,
          marketing_context: contextMetadata,
        }
      }

      if (Object.keys(sessionUpdate).length > 0) {
        const { error: updateError } = await supabase.from("chat_sessions").update(sessionUpdate).eq("id", session.id)
        if (updateError) {
          throw new Error(`Failed to update livechat session: ${updateError.message}`)
        }
      }
    }

    const { error: messageError } = await supabase.from("chat_messages").insert({
      session_id: session.id,
      sender_role: "visitor",
      sender_name: visitorName,
      body: messageBody,
      content_type: "text",
      delivery_status: "sent",
      metadata: {
        source,
        ...(contextMetadata ? { marketing_context: contextMetadata } : {}),
      },
    })

    if (messageError) {
      throw new Error(`Failed to send livechat message: ${messageError.message}`)
    }

    await ensureLivechatFirstReplyTimeoutMessage(supabase, session)

    const result = await fetchSessionPayload(supabase, session.id, visitorKey)
    if (!result) {
      throw new Error("Livechat session could not be reloaded after message send.")
    }

    const response = NextResponse.json({ ok: true, session: result.session, messages: result.messages })
    response.cookies.set(LIVECHAT_VISITOR_COOKIE_NAME, visitorKey, buildCookieOptions(request))
    return response
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to send livechat message." },
      { status: 500 },
    )
  }
}
