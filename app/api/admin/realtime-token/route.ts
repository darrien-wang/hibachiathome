import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"

const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL ?? "gpt-live-transcribe"

// Mints a short-lived credential so the browser can open its own Realtime
// connection. The account key never leaves the server: anyone who scrapes the
// page gets a secret that is scoped to one transcription session and expires
// in about a minute.
export async function GET(request: NextRequest) {
  const actor = resolveAdminActor(request)
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "live captions not configured: missing OPENAI_API_KEY" }, { status: 503 })
  }

  try {
    const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        session: {
          type: "transcription",
          audio: {
            input: {
              // No turn_detection here on purpose: gpt-live-transcribe segments
              // speech itself and rejects the parameter outright ("Turn
              // detection is not supported for this transcription model").
              transcription: { model: TRANSCRIBE_MODEL },
            },
          },
        },
      }),
    })

    const body = (await res.json()) as Record<string, any>
    if (!res.ok) {
      const detail = body?.error?.message ?? `status ${res.status}`
      console.error("[realtime-token] OpenAI refused", detail)
      return NextResponse.json({ error: `令牌签发失败：${detail}` }, { status: 502 })
    }

    // The shape has moved before; accept both the flat and nested forms rather
    // than breaking captions on a rename.
    const value = body?.value ?? body?.client_secret?.value
    if (!value) {
      console.error("[realtime-token] no secret in response", Object.keys(body))
      return NextResponse.json({ error: "令牌响应里没有找到密钥" }, { status: 502 })
    }

    return NextResponse.json(
      { value, model: TRANSCRIBE_MODEL },
      { headers: { "cache-control": "no-store" } }
    )
  } catch (error) {
    console.error("[realtime-token] failed", error)
    return NextResponse.json({ error: "令牌签发失败" }, { status: 502 })
  }
}
