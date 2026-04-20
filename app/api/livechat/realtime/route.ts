import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"

import { getSupabaseAdmin } from "@/lib/supabase-admin"
import {
  LIVECHAT_VISITOR_COOKIE_NAME,
  findAuthorizedSession,
  findLatestVisitorSession,
} from "@/lib/livechat-public"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function readCookie(request: Request, key: string) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${key}=`))
    ?.slice(key.length + 1)
}

function encodeSseEvent(data: Record<string, unknown>) {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
}

export async function GET(request: Request) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 500 })
  }

  const visitorKey = readCookie(request, LIVECHAT_VISITOR_COOKIE_NAME)
  if (!visitorKey) {
    return new Response("Unauthorized", { status: 401 })
  }

  const requestUrl = new URL(request.url)
  const requestedSessionId = requestUrl.searchParams.get("sessionId")

  const resolvedSession = requestedSessionId
    ? await findAuthorizedSession(supabase, requestedSessionId, visitorKey)
    : await findLatestVisitorSession(supabase, visitorKey)

  if (!resolvedSession) {
    return new Response("Not found", { status: 404 })
  }

  const sessionId = resolvedSession.id
  const channelName = `visitor-livechat-${sessionId}-${randomUUID()}`
  let cleanup = () => {}

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let isClosed = false

      const send = (payload: Record<string, unknown>) => {
        if (isClosed) {
          return
        }

        controller.enqueue(encodeSseEvent(payload))
      }

      const channel = supabase.channel(channelName)

      cleanup = () => {
        if (isClosed) {
          return
        }

        isClosed = true
        clearInterval(heartbeatTimer)
        void supabase.removeChannel(channel)
        controller.close()
      }

      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          send({
            type: "change",
            table: "chat_sessions",
            event: payload.eventType,
            sessionId,
          })
        },
      )

      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          send({
            type: "change",
            table: "chat_messages",
            event: payload.eventType,
            sessionId,
          })
        },
      )

      void channel.subscribe((status) => {
        send({
          type: "status",
          status,
          sessionId,
        })
      })

      const heartbeatTimer = setInterval(() => {
        send({
          type: "heartbeat",
          at: new Date().toISOString(),
        })
      }, 25000)

      request.signal.addEventListener("abort", cleanup)
      send({
        type: "status",
        status: "CONNECTING",
        sessionId,
      })
    },
    cancel() {
      cleanup()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
