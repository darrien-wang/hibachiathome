import { NextRequest, NextResponse } from "next/server"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import {
  TABLECLOTHS,
  clothFor,
  describeSetup,
  findTheme,
  findVariant,
  type ClothId,
  type SetupSelection,
} from "@/config/table-themes"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 已下单的客户在 /rentals?lead_id=... 选完桌面主题，按"Send this to Real
// Hibachi"走到这里。押金后我们发的那条短信带 lead_id，和押金页是同一套认人
// 方式——没有新的 token 体系。
//
// 客户端传什么都不信：pkg/cloth/theme/variant 一律拿 config/table-themes.ts
// 的目录校验，人数夹在 1–200。校验完才写：
//   leads.setup_selection   —— 永远写
//   orders.setup_selection  —— 有订单就写（装车清单和师傅单读它）
//   orders.customer_notes   —— 追加一句人话，工作台一眼能看到
//   lead_touchpoints        —— 进线索时间线
//
// 不返回任何客户信息：lead_id 猜不出来，但万一被撞到也只该得到 ok。

type Body = {
  lead_id?: unknown
  pkg?: unknown
  cloth?: unknown
  themeId?: unknown
  variantId?: unknown
  guests?: unknown
  source?: unknown
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status })
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit("setup-selection", request, 20, 600)
  if (!limited.ok) {
    const r = tooManyRequests()
    return NextResponse.json({ ok: false, error: r.body.error }, { status: r.status })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return bad("Malformed request.")
  }

  const leadId = typeof body.lead_id === "string" ? body.lead_id.trim() : ""
  if (!UUID.test(leadId)) return bad("We couldn't tell which party this is for.")

  const pkg = body.pkg === "tables" ? "tables" : body.pkg === "full" ? "full" : null
  if (!pkg) return bad("Pick a setup first.")

  const clothId = typeof body.cloth === "string" ? body.cloth : ""
  const cloth = (TABLECLOTHS.find((c) => c.id === clothId)?.id ?? "black") as ClothId

  const guestsRaw = typeof body.guests === "number" ? body.guests : Number.parseInt(String(body.guests ?? ""), 10)
  if (!Number.isFinite(guestsRaw)) return bad("How many guests?")
  const guests = Math.max(1, Math.min(200, Math.round(guestsRaw)))

  const selection: SetupSelection = { pkg, cloth, guests, source: "rentals_page", chosenAt: new Date().toISOString() }

  if (pkg === "full") {
    const theme = findTheme(typeof body.themeId === "string" ? body.themeId : "")
    if (!theme) return bad("Pick a table theme first.")
    const variant = findVariant(theme, typeof body.variantId === "string" ? body.variantId : "")
    selection.themeId = theme.id
    selection.variantId = variant?.id
    // 桌布跟着主题/摆法走,以目录为准,别让客户端改。
    selection.cloth = clothFor(theme, variant)
  }

  const supabase = getSupabaseAdmin()
  if (!supabase) return bad("Setup choices are temporarily unavailable.", 503)

  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("id, full_name")
    .eq("id", leadId)
    .maybeSingle()
  if (leadErr) return bad("Could not save that. Text us and we'll set it by hand.", 500)
  if (!lead) return bad("We couldn't tell which party this is for.", 404)

  const sentence = describeSetup(selection)

  await supabase.from("leads").update({ setup_selection: selection }).eq("id", leadId)

  // 一个线索可能有多张订单（补单/改期）,写最近那张。
  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_notes")
    .eq("source_metadata->>lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (order) {
    const stamp = new Date().toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" })
    const line = `Setup picked by customer (${stamp}): ${sentence}`
    const prior = (order.customer_notes ?? "").trim()
    // 同一句不重复堆叠——客户改主意会多发几次。
    const kept = prior
      .split("\n")
      .filter((l: string) => !l.startsWith("Setup picked by customer"))
      .join("\n")
      .trim()
    await supabase
      .from("orders")
      .update({ setup_selection: selection, customer_notes: kept ? `${kept}\n${line}` : line })
      .eq("id", order.id)
  }

  await supabase.from("lead_touchpoints").insert({
    lead_id: leadId,
    touchpoint_type: "setup_selected",
    touchpoint_source: "rentals_page",
    raw_payload_json: { selection, sentence, order_linked: Boolean(order) },
  })

  return NextResponse.json({ ok: true, linkedToOrder: Boolean(order) })
}
