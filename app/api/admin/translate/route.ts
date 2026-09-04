import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"

const MODEL = process.env.OPENAI_TRANSLATE_MODEL ?? "gpt-5.6-luna"

export async function POST(request: NextRequest) {
  const actor = resolveAdminActor(request)
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "missing OPENAI_API_KEY" }, { status: 503 })
  }

  const body = (await request.json().catch(() => ({}))) as { text?: string }
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 2000) : ""
  if (!text) {
    return NextResponse.json({ error: "text required" }, { status: 400 })
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            // This runs on live captions of a catering call, so the output is
            // read at a glance mid-conversation: no preamble, no alternatives,
            // no notes about the translation itself.
            content:
              [
                "You are translating live captions of a phone call for Real Hibachi, a hibachi catering company: chefs cook at the customer's home or venue. There is no restaurant — 'book hibachi' means booking a chef to come to them, never booking a table.",
                "Translate the user's message into Simplified Chinese. Reply with the translation only — no quotes, no explanation, no alternatives.",
                "Keep names, dates, addresses, phone numbers and guest counts exactly as given. If it is already Chinese, echo it unchanged.",
                "The source is speech-to-text of an accented speaker, so it may be garbled: translate the most plausible reading rather than transliterating nonsense.",
              ].join(" "),
          },
          { role: "user", content: text },
        ],
      }),
    })

    const json = (await res.json()) as Record<string, any>
    if (!res.ok) {
      const detail = json?.error?.message ?? `status ${res.status}`
      console.error("[translate] OpenAI refused", detail)
      return NextResponse.json({ error: detail }, { status: 502 })
    }

    const translated = json?.choices?.[0]?.message?.content?.trim() ?? ""
    return NextResponse.json({ text: translated }, { headers: { "cache-control": "no-store" } })
  } catch (error) {
    console.error("[translate] failed", error)
    return NextResponse.json({ error: "translation failed" }, { status: 502 })
  }
}
