import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { addStockSpec, stockWho } from "@/lib/stocktake-server"
import { TRANSCRIBE_PROMPT, normalizeAi, stockAiMessages, type ChatTurn, type PendingPack } from "@/lib/stocktake-ai"
import { cleanLine, itemDef, type CountLine, type CustomSpec, type RestockLevel } from "@/lib/stocktake"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

// 盘点的语音 / 打字助手（lib/stocktake-ai.ts）。和 /api/tools/stock 同一套身份（?t= 师傅 / 工作台登录）。
//   POST multipart：audio（录音，可选）+ text（打的字，可选）+ state（JSON：draft / levels / history）
//   → { heard, say, questions, items: [{ key, mode, lines }], restock, specs }
// 只回建议，页面填进去等师傅自己提交；这里唯一会写库的是师傅说出来的新包装规格（老板定：规格加了就能用）。

const noStore = { "cache-control": "no-store" } as const
const deny = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status, headers: noStore })
const TRANSCRIBE_MODELS = [process.env.STOCK_TRANSCRIBE_MODEL, "gpt-4o-transcribe", "whisper-1"].filter(Boolean) as string[]
const CHAT_MODEL = process.env.STOCK_AI_MODEL ?? process.env.OPENAI_SUMMARY_MODEL ?? process.env.OPENAI_TRANSLATE_MODEL ?? "gpt-5.6-luna"

async function transcribe(apiKey: string, audio: File): Promise<string> {
  let last = ""
  for (const model of [...new Set(TRANSCRIBE_MODELS)]) {
    const fd = new FormData()
    fd.append("file", audio, audio.name || "speech.webm")
    fd.append("model", model)
    fd.append("prompt", TRANSCRIBE_PROMPT)
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { authorization: `Bearer ${apiKey}` }, body: fd })
    const j = (await res.json().catch(() => ({}))) as { text?: string; error?: { message?: string } }
    if (res.ok) return String(j.text ?? "").trim()
    last = j.error?.message ?? `HTTP ${res.status}`
    // 模型不存在 / 没权限才换下一个；音频本身的问题换模型也没用
    if (!/model|not found|does not exist|access/i.test(last)) break
  }
  throw new Error(`没听清（${last}）`)
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  if (!supabase) return deny(500, "supabase not configured")
  const me = await stockWho(request, supabase)
  if (!me) return deny(401, "链接不对或者已经收回了")
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return deny(503, "语音助手还没开通，先手点")

  const form = await request.formData().catch(() => null)
  if (!form) return deny(400, "没收到")
  const audio = form.get("audio")
  let heard = String(form.get("text") ?? "").trim().slice(0, 2000)
  type State = { draft?: Record<string, unknown[]>; levels?: Record<string, RestockLevel>; history?: ChatTurn[] }
  let state: State = {}
  try {
    state = JSON.parse(String(form.get("state") ?? "{}")) as State
  } catch {}

  if (audio instanceof File && audio.size > 0) {
    if (audio.size > 12 * 1024 * 1024) return deny(413, "录得太长了，分几次说")
    try {
      heard = [heard, await transcribe(apiKey, audio)].filter(Boolean).join(" ")
    } catch (e) {
      return deny(502, e instanceof Error ? e.message : "没听清")
    }
  }
  if (!heard) return deny(400, "没听到说话，靠近一点再说一遍")

  const { data: specRows } = await supabase.from("stock_specs").select("id, item_key, label, amount, unit, created_by").is("archived_at", null)
  const specs = ((specRows ?? []) as CustomSpec[]).map((s) => ({ ...s, amount: Number(s.amount) }))
  const draft: Record<string, CountLine[]> = {}
  for (const [k, lines] of Object.entries(state.draft ?? {})) {
    const d = itemDef(k)
    if (d && Array.isArray(lines)) draft[k] = lines.map((l) => cleanLine(d, l)).filter((l): l is CountLine => !!l)
  }
  const history = (Array.isArray(state.history) ? state.history : []).filter((t) => t && (t.who === "chef" || t.who === "ai") && typeof t.text === "string")

  let raw: unknown
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model: CHAT_MODEL, response_format: { type: "json_object" }, messages: stockAiMessages({ specs, draft, levels: state.levels ?? {}, history, said: heard }) }),
    })
    const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } }
    if (!res.ok) throw new Error(j.error?.message ?? `HTTP ${res.status}`)
    raw = JSON.parse(j.choices?.[0]?.message?.content ?? "{}")
  } catch (e) {
    console.error("[stock-voice] model failed", e)
    return NextResponse.json({ ok: false, heard, error: "助手这次没回上来，听到的话在上面，手点一下或者再说一遍" }, { status: 502, headers: noStore })
  }

  const ai = normalizeAi(raw, specs)
  // 师傅说出来的新包装：建成规格（加了就能用），把待定的行换成真规格
  const created: CustomSpec[] = []
  const items: Array<{ key: string; mode: "replace" | "add"; lines: CountLine[] }> = []
  for (const it of ai.items) {
    const lines: CountLine[] = []
    for (const l of it.lines) {
      if (l.kind !== "pending") {
        lines.push(l)
        continue
      }
      const p = l as PendingPack
      const r = await addStockSpec(supabase, { item_key: it.key, label: p.label, amount: p.amount, unit: p.unit }, me.name)
      if (!r.ok) continue
      if (!created.some((s) => s.id === r.spec.id)) created.push(r.spec)
      lines.push({ kind: "pack", specId: r.spec.id, specLabel: r.spec.label, amount: r.spec.amount, unit: r.spec.unit, packs: p.packs })
    }
    items.push({ key: it.key, mode: it.mode, lines })
  }
  return NextResponse.json({ ok: true, heard, say: ai.say, questions: ai.questions, items, restock: ai.restock, specs: created }, { headers: noStore })
}
