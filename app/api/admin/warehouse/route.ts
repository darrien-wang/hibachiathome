import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { createServerSupabaseClient } from "@/lib/supabase"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// 虚拟仓库：消耗品按"包"记（整包 / 剩半 / 划掉），周转品按"件 + 在谁手上"记。
// 入库仍然只有一条路——agent 读小票或网购订单，写 supply_purchases 的同时在这里
// 加包；页面只负责划掉和借还。两件事分开是故意的：买了多少是账，手上还有多少
// 是物，账可以补录，物只能靠人看一眼。
//
// 撤销做在服务端：每次写入生成一个 batch_id，并把"反着做一遍"的指令存在
// 第一条流水的 undo_payload 上，所以刷新页面之后那个撤销按钮依然有效。

const PT = "America/Los_Angeles"
const ptDay = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: PT })
const MAX_PACKS = 24

type ItemRow = {
  item_key: string
  name: string
  category: string
  kind: string
  pack_label: string
  unit: string
  min_qty: number
  par_qty: number
  buy_channel: string | null
  total_qty: number
  whole_only: boolean
  pantry_key: string | null
  image_url: string | null
  sort_order: number
  counted_at: string | null
  aliases: string[]
}

type PackRow = { item_key: string; idx: number; value: number; source_label: string | null; covers: number | null; size_note: string | null }
type HoldRow = { item_key: string; holder_key: string; holder_kind: string; holder_name: string; qty: number; size_note: string | null }
type MoveIn = { item_key: string; holder_key: string; holder_kind: string; holder_name: string; delta: number; size_note?: string | null }

const str = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const HOLDER_KINDS = new Set(["chef", "event", "misc"])
// 数量 + 量词一起写，不然会出现"划掉 1 个半 盒"这种句子。
// 1 盒 -> "1 盒"，1.5 盒 -> "1 盒半"，0.5 盒 -> "半盒"
const qty = (n: number, unit: string) => {
  const whole = Math.floor(n)
  const half = n - whole >= 0.5
  if (!whole) return `半${unit}`
  return `${whole} ${unit}${half ? "半" : ""}`
}

export async function GET(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "supabase not configured" }, { status: 500 })

  const now = new Date()
  const today = ptDay(now)
  const soon = new Date(now.getTime() - 12 * 3600_000).toISOString()
  const horizon = new Date(now.getTime() + 10 * 24 * 3600_000).toISOString()

  const [itemsRes, packsRes, holdRes, logRes, purchRes, chefRes, orderRes] = await Promise.all([
    supabase.from("warehouse_items").select("*").eq("active", true).order("sort_order"),
    supabase.from("warehouse_packs").select("item_key, idx, value, source_label, covers, size_note").order("idx"),
    supabase.from("warehouse_holdings").select("*").gt("qty", 0),
    supabase.from("warehouse_log").select("id, item_key, body, via, quote, created_at, batch_id, undo_payload").order("created_at", { ascending: false }).limit(60),
    supabase.from("supply_purchases").select("id, purchased_on, channel, amount_cents, tip_cents, note, lines").order("purchased_on", { ascending: false }).limit(12),
    supabase.from("staff_members").select("id, display_name, full_name").eq("status", "active").order("full_name"),
    supabase.from("orders").select("id, order_no, customer_name, event_start, guest_adult_count, guest_child_count, order_status").gte("event_start", soon).lte("event_start", horizon).order("event_start").limit(20),
  ])

  const firstErr = [itemsRes, packsRes, holdRes, logRes].find((r) => r.error)?.error
  if (firstErr) return NextResponse.json({ error: firstErr.message }, { status: 500 })

  const items = (itemsRes.data ?? []) as ItemRow[]
  const packsAll = (packsRes.data ?? []) as PackRow[]
  const packs: Record<string, PackRow[]> = {}
  for (const p of packsAll) (packs[p.item_key] = packs[p.item_key] ?? []).push(p)
  // 用完的包留着当痕迹，但只留最近一截，免得一年后每样东西后面拖着几十个叉。
  for (const key of Object.keys(packs)) packs[key] = packs[key].slice(-MAX_PACKS)

  const holdings: Record<string, HoldRow[]> = {}
  for (const h of (holdRes.data ?? []) as HoldRow[]) (holdings[h.item_key] = holdings[h.item_key] ?? []).push(h)

  // 入库记录直接复用采购流水：agent 录小票时已经把行项目拆好了。
  const records = (purchRes.data ?? [])
    .map((p) => {
      const lines = Array.isArray(p.lines) ? (p.lines as Array<Record<string, unknown>>) : []
      return {
        id: String(p.id),
        date: String(p.purchased_on ?? "").slice(5),
        channel: p.channel === "instacart" ? "网购订单" : "线下小票",
        store: str(p.note, 60) || String(p.channel ?? ""),
        meta: `合计 $${(((p.amount_cents ?? 0) + (p.tip_cents ?? 0)) / 100).toFixed(2)}`,
        lines: lines
          .map((l) => ({ item_key: str(l.item_key, 40), n: Number(l.qty) || 0, raw: str(l.label, 90) }))
          .filter((l) => l.item_key),
      }
    })
    .filter((r) => r.lines.length)

  const chefs = (chefRes.data ?? []).map((c) => ({
    key: `chef:${c.id}`,
    name: str(c.display_name, 40) || str(c.full_name, 40),
  }))

  const events = (orderRes.data ?? [])
    .filter((o) => o.order_status !== "cancelled")
    .map((o) => {
      const heads = (o.guest_adult_count ?? 0) + (o.guest_child_count ?? 0)
      const day = String(o.event_start ?? "").slice(5, 10)
      return { key: `order:${o.id}`, name: `${str(o.customer_name, 24) || o.order_no} ${heads ? `${heads} 人 · ` : ""}${day}` }
    })

  // agent 视图：一屏能读完的摘要，别名带上，省得它拿小票文字来回猜。
  if (request.nextUrl.searchParams.get("view") === "agent") {
    return NextResponse.json({
      today,
      items: items.map((it) => {
        const mine = packs[it.item_key] ?? []
        const remain = mine.reduce((a, p) => a + Number(p.value), 0)
        const out = (holdings[it.item_key] ?? []).reduce((a, h) => a + h.qty, 0)
        return it.kind === "cons"
          ? { item_key: it.item_key, name: it.name, kind: "cons", unit: it.unit, pack_label: it.pack_label, remain, min: it.min_qty, par: it.par_qty, need: remain < it.min_qty, buy: it.buy_channel, aliases: it.aliases }
          : { item_key: it.item_key, name: it.name, kind: "ret", unit: it.unit, total: it.total_qty, out, in_stock: it.total_qty - out, holders: (holdings[it.item_key] ?? []).map((h) => ({ key: h.holder_key, name: h.holder_name, qty: h.qty })), aliases: it.aliases }
      }),
      chefs,
      events,
      recent_log: (logRes.data ?? []).slice(0, 15).map((l) => ({ at: l.created_at, item: l.item_key, body: l.body, via: l.via })),
    })
  }

  return NextResponse.json({
    today: today.slice(5),
    canWrite: actor.role === "owner",
    items,
    packs,
    holdings,
    log: logRes.data ?? [],
    records,
    chefs,
    events,
  })
}

export async function POST(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (actor.role !== "owner") return NextResponse.json({ error: "只有老板能改仓库" }, { status: 403 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "supabase not configured" }, { status: 500 })

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const action = str(body.action, 24)
  const via = body.via === "agent" ? "agent" : "manual"
  const quote = str(body.quote, 300) || null
  const batchId = crypto.randomUUID()

  const writeLog = async (
    rows: Array<{ item_key: string; body: string }>,
    undo: Record<string, unknown> | null,
  ) => {
    if (!rows.length) return
    const stamped = rows.map((r, i) => ({
      item_key: r.item_key,
      body: r.body,
      via,
      quote,
      actor: actor.alias,
      batch_id: batchId,
      undo_payload: i === 0 ? undo : null,
    }))
    await supabase.from("warehouse_log").insert(stamped)
  }

  const itemOf = async (key: string) => {
    const { data } = await supabase.from("warehouse_items").select("*").eq("item_key", key).maybeSingle()
    return (data ?? null) as ItemRow | null
  }

  // 小票上写的是 "KS CHKN BRST BNLS 10.2LB"，不是"鸡胸"。先按 item_key / 名字对，
  // 再按别名双向包含匹配；对不上就如实返回 null，绝不猜一个最像的入库。
  const resolveKey = (text: string, all: ItemRow[]): string | null => {
    const t = text.toLowerCase().trim()
    if (!t) return null
    const exact = all.find((i) => i.item_key === t || i.name === text.trim())
    if (exact) return exact.item_key
    for (const i of all) {
      for (const a of i.aliases ?? []) {
        const al = a.toLowerCase()
        if (al && (t.includes(al) || al.includes(t))) return i.item_key
      }
    }
    return null
  }
  const allItems = async () => ((await supabase.from("warehouse_items").select("*").eq("active", true)).data ?? []) as ItemRow[]

  if (action === "resolve") {
    const all = await allItems()
    const texts = Array.isArray(body.texts) ? body.texts.map((t) => str(t, 120)) : [str(body.text, 120)]
    return NextResponse.json({ ok: true, matches: texts.filter(Boolean).map((t) => ({ text: t, item_key: resolveKey(t, all) })) })
  }

  if (action === "add_alias") {
    const key = str(body.item_key, 40)
    const alias = str(body.alias, 60).toLowerCase()
    if (!key || !alias) return NextResponse.json({ error: "item_key / alias 不对" }, { status: 400 })
    const item = await itemOf(key)
    if (!item) return NextResponse.json({ error: "没有这个品项" }, { status: 404 })
    if ((item.aliases ?? []).includes(alias)) return NextResponse.json({ ok: true, already: true })
    const { error } = await supabase.from("warehouse_items").update({ aliases: [...(item.aliases ?? []), alias] }).eq("item_key", key)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // 整张小票一次入库。source_ref 是幂等钥匙：同一张票重录只会跳过，不会翻倍。
  if (action === "stock_in") {
    const sourceRef = str(body.source_ref, 80)
    if (!sourceRef) return NextResponse.json({ error: "source_ref 必填（同一张小票重录要靠它去重）" }, { status: 400 })
    const sourceLabel = str(body.source_label, 120) || null
    const all = await allItems()
    const rows = Array.isArray(body.items) ? body.items : []
    const results: Array<{ input: string; item_key: string | null; added: number; skipped?: string }> = []
    const logs: Array<{ item_key: string; body: string }> = []
    const undoKeys: string[] = []

    for (const raw of rows.slice(0, 60)) {
      const o = (raw ?? {}) as Record<string, unknown>
      const given = str(o.item_key, 40)
      const input = given || str(o.match, 120)
      const key = given && all.some((i) => i.item_key === given) ? given : resolveKey(input, all)
      const count = Math.max(0, Math.min(60, Math.floor(Number(o.packs) || 0)))
      if (!key) {
        results.push({ input, item_key: null, added: 0, skipped: "认不出这是什么，先用 add_alias 教一下" })
        continue
      }
      const item = all.find((i) => i.item_key === key)
      if (!item || item.kind !== "cons") {
        results.push({ input, item_key: key, added: 0, skipped: "周转品不走入库，用 set_item 改总数" })
        continue
      }
      if (!count) {
        results.push({ input, item_key: key, added: 0, skipped: "packs 要是正整数" })
        continue
      }
      const { data: dupe } = await supabase.from("warehouse_packs").select("idx").eq("item_key", key).eq("source_ref", sourceRef).limit(1)
      if (dupe && dupe.length) {
        results.push({ input, item_key: key, added: 0, skipped: "这张票的这一项已经入过库了" })
        continue
      }
      const { data: last } = await supabase.from("warehouse_packs").select("idx").eq("item_key", key).order("idx", { ascending: false }).limit(1).maybeSingle()
      const start = (last?.idx ?? 0) + 1
      // 替换品 / 称重商品：这一包多大跟目录的标准包装不一样，按小票实重记下来，
      // 不然同一个 item 里 3.5 lb 的大盘和 0.6 lb 的小盘在系统里长得一模一样。
      const coversRaw = Number(o.covers)
      const covers = Number.isFinite(coversRaw) && coversRaw > 0 ? Math.round(coversRaw * 100) / 100 : null
      const sizeNote = str(o.size_note, 60) || null
      const { error } = await supabase.from("warehouse_packs").insert(
        Array.from({ length: count }, (_, i) => ({ item_key: key, idx: start + i, value: 1, source_ref: sourceRef, source_label: sourceLabel, covers, size_note: sizeNote })),
      )
      if (error) {
        results.push({ input, item_key: key, added: 0, skipped: error.message })
        continue
      }
      results.push({ input, item_key: key, added: count })
      logs.push({ item_key: key, body: `入库 +${count} ${item.unit}${sizeNote ? `（${sizeNote}）` : ""}${sourceLabel ? ` · ${sourceLabel}` : ""}` })
      undoKeys.push(key)
    }
    if (logs.length) await writeLog(logs, { kind: "stock_in", source_ref: sourceRef, item_keys: undoKeys })
    const added = results.reduce((a, r) => a + r.added, 0)
    return NextResponse.json({ ok: true, batch_id: batchId, added, results, toast: added ? `入库 ${logs.length} 项 · 共 ${added} 包` : "没有新入库的行" })
  }

  // 用掉多少：老板在聊天里说"鸡胸用了一盒半"，从最早的包开始划。
  if (action === "consume") {
    const all = await allItems()
    const rows = Array.isArray(body.items) ? body.items : []
    const logs: Array<{ item_key: string; body: string }> = []
    const undoPacks: Array<{ item_key: string; idx: number; value: number }> = []
    const results: Array<{ item_key: string | null; used: number; short?: number }> = []

    for (const raw of rows.slice(0, 40)) {
      const o = (raw ?? {}) as Record<string, unknown>
      const given = str(o.item_key, 40)
      const key = given && all.some((i) => i.item_key === given) ? given : resolveKey(str(o.match, 120), all)
      let want = Number(o.packs)
      const item = key ? all.find((i) => i.item_key === key) : undefined
      if (!key || !item || !Number.isFinite(want) || want <= 0) {
        results.push({ item_key: key, used: 0 })
        continue
      }
      want = Math.round(want * 2) / 2
      const { data: packRows } = await supabase.from("warehouse_packs").select("idx, value").eq("item_key", key).gt("value", 0).order("idx")
      let used = 0
      for (const pr of packRows ?? []) {
        if (want <= 0) break
        const cur = Number(pr.value)
        // 整只买的东西没有半只：要么整只划掉，要么不动。
        const take = item.whole_only ? (want >= cur ? cur : 0) : Math.min(cur, want)
        const next = Math.round((cur - take) * 2) / 2
        if (next === cur) continue
        await supabase.from("warehouse_packs").update({ value: next }).eq("item_key", key).eq("idx", pr.idx)
        undoPacks.push({ item_key: key, idx: pr.idx, value: cur })
        used += cur - next
        want -= cur - next
      }
      if (used > 0) logs.push({ item_key: key, body: `划掉 ${qty(used, item.unit)}` })
      // 库里不够就如实说少了多少，别偷偷记成用完了——那正是"以为还有"的来源。
      results.push({ item_key: key, used, short: want > 0 ? Math.round(want * 2) / 2 : undefined })
    }
    if (logs.length) await writeLog(logs, { kind: "consume", packs: undoPacks })
    return NextResponse.json({ ok: true, batch_id: batchId, results, toast: logs.length ? `划掉 ${logs.length} 项` : "没有可划的库存" })
  }

  // 点一下格子：整包 → 剩半 → 划掉 → 整包。整只买的东西（龙虾尾）没有半只。
  if (action === "tap_pack") {
    const key = str(body.item_key, 40)
    const idx = Number(body.idx)
    if (!key || !Number.isInteger(idx)) return NextResponse.json({ error: "item_key / idx 不对" }, { status: 400 })
    const item = await itemOf(key)
    if (!item) return NextResponse.json({ error: "没有这个品项" }, { status: 404 })
    const { data: pack } = await supabase.from("warehouse_packs").select("value").eq("item_key", key).eq("idx", idx).maybeSingle()
    if (!pack) return NextResponse.json({ error: "没有这一包" }, { status: 404 })
    const cur = Number(pack.value)
    const next = cur === 1 ? (item.whole_only ? 0 : 0.5) : cur === 0.5 ? 0 : 1
    const { error } = await supabase.from("warehouse_packs").update({ value: next }).eq("item_key", key).eq("idx", idx)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const used = cur - next
    const text = used > 0 ? (used === 1 ? `划掉 1 ${item.unit}` : `划掉半${item.unit}`) : `恢复 1 ${item.unit}`
    await writeLog([{ item_key: key, body: text }], { kind: "pack", item_key: key, idx, value: cur })
    return NextResponse.json({ ok: true, batch_id: batchId, value: next, toast: `${item.name} ${text}` })
  }

  // 入库：在末尾追加整包。agent 录完小票顺手调这个。
  if (action === "add_packs") {
    const key = str(body.item_key, 40)
    const count = Math.max(1, Math.min(60, Math.floor(Number(body.count) || 0)))
    if (!key || !count) return NextResponse.json({ error: "item_key / count 不对" }, { status: 400 })
    const item = await itemOf(key)
    if (!item) return NextResponse.json({ error: "没有这个品项" }, { status: 404 })
    const { data: last } = await supabase.from("warehouse_packs").select("idx").eq("item_key", key).order("idx", { ascending: false }).limit(1).maybeSingle()
    const start = (last?.idx ?? 0) + 1
    const rows = Array.from({ length: count }, (_, i) => ({
      item_key: key,
      idx: start + i,
      value: 1,
      source_ref: str(body.source_ref, 80) || null,
      source_label: str(body.source_label, 120) || null,
    }))
    const { error } = await supabase.from("warehouse_packs").insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await writeLog([{ item_key: key, body: `入库 +${count} ${item.unit}` }], { kind: "packs_added", item_key: key, from: start, to: start + count - 1 })
    return NextResponse.json({ ok: true, batch_id: batchId, added: count, toast: `${item.name} 入库 +${count} ${item.unit}` })
  }

  // 借还：一次可以带多条（发一套工服 = 帽子 + 厨师服 + 围裙）。
  if (action === "move") {
    const raw = Array.isArray(body.moves) ? body.moves : []
    const moves: MoveIn[] = []
    for (const m of raw.slice(0, 30)) {
      const o = (m ?? {}) as Record<string, unknown>
      const item_key = str(o.item_key, 40)
      const holder_key = str(o.holder_key, 60)
      const holder_kind = str(o.holder_kind, 10)
      const delta = Math.trunc(Number(o.delta) || 0)
      if (!item_key || !holder_key || !HOLDER_KINDS.has(holder_kind) || !delta) continue
      moves.push({ item_key, holder_key, holder_kind, holder_name: str(o.holder_name, 60) || holder_key, delta, size_note: str(o.size_note, 20) || null })
    }
    if (!moves.length) return NextResponse.json({ error: "没有有效的动作" }, { status: 400 })

    const logs: Array<{ item_key: string; body: string }> = []
    const applied: MoveIn[] = []
    const toasts: string[] = []
    for (const mv of moves) {
      const item = await itemOf(mv.item_key)
      if (!item || item.kind !== "ret") continue
      const { data: allHold } = await supabase.from("warehouse_holdings").select("holder_key, qty").eq("item_key", mv.item_key)
      const out = (allHold ?? []).reduce((a, h) => a + (Number(h.qty) || 0), 0)
      const cur = Number((allHold ?? []).find((h) => h.holder_key === mv.holder_key)?.qty) || 0
      const free = item.total_qty - out
      // 出库不能超过在库，归还不能还成负数——多出来的那一件不是被谁拿了，是数错了。
      const want = cur + mv.delta
      const next = Math.max(0, Math.min(want, cur + Math.max(0, free)))
      if (next === cur) continue
      if (next === 0) {
        await supabase.from("warehouse_holdings").delete().eq("item_key", mv.item_key).eq("holder_key", mv.holder_key)
      } else {
        await supabase.from("warehouse_holdings").upsert(
          {
            item_key: mv.item_key,
            holder_key: mv.holder_key,
            holder_kind: mv.holder_kind,
            holder_name: mv.holder_name,
            qty: next,
            size_note: mv.size_note,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "item_key,holder_key" },
        )
      }
      const chef = mv.holder_kind === "chef"
      const text =
        next > cur
          ? chef
            ? `发给 ${mv.holder_name} ${next - cur}`
            : `出库 ${next - cur} → ${mv.holder_name}`
          : `${mv.holder_name} 归还 ${cur - next}`
      logs.push({ item_key: mv.item_key, body: text })
      toasts.push(`${item.name} ${text}`)
      applied.push({ ...mv, delta: next - cur })
    }
    if (!applied.length) return NextResponse.json({ error: "库里没有可动的数量" }, { status: 409 })
    await writeLog(logs, { kind: "move", moves: applied.map((a) => ({ ...a, delta: -a.delta })) })
    return NextResponse.json({
      ok: true,
      batch_id: batchId,
      applied: applied.length,
      toast: toasts.length > 1 ? `${toasts.length} 件已登记` : toasts[0],
    })
  }

  // 实盘：周转品改总数，消耗品改安全线 / 常备量 / 采购渠道。
  if (action === "set_item") {
    const key = str(body.item_key, 40)
    if (!key) return NextResponse.json({ error: "item_key 不对" }, { status: 400 })
    const item = await itemOf(key)
    if (!item) return NextResponse.json({ error: "没有这个品项" }, { status: 404 })
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    const notes: string[] = []
    if (body.total_qty !== undefined) {
      const n = Math.max(0, Math.min(9999, Math.floor(Number(body.total_qty) || 0)))
      patch.total_qty = n
      patch.counted_at = new Date().toISOString()
      notes.push(`总数盘成 ${n} ${item.unit}`)
    }
    if (body.min_qty !== undefined) {
      const n = Math.max(0, Math.min(999, Number(body.min_qty) || 0))
      patch.min_qty = n
      notes.push(`安全线 ${n}`)
    }
    if (body.par_qty !== undefined) {
      const n = Math.max(0, Math.min(999, Number(body.par_qty) || 0))
      patch.par_qty = n
      notes.push(`常备 ${n}`)
    }
    if (body.buy_channel !== undefined) {
      patch.buy_channel = str(body.buy_channel, 40) || null
      notes.push(`补货去 ${patch.buy_channel ?? "—"}`)
    }
    if (notes.length === 0) return NextResponse.json({ error: "没有要改的字段" }, { status: 400 })
    const { error } = await supabase.from("warehouse_items").update(patch).eq("item_key", key)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await writeLog([{ item_key: key, body: notes.join(" · ") }], {
      kind: "item",
      item_key: key,
      prev: { total_qty: item.total_qty, min_qty: item.min_qty, par_qty: item.par_qty, buy_channel: item.buy_channel, counted_at: item.counted_at },
    })
    return NextResponse.json({ ok: true, batch_id: batchId, toast: `${item.name} ${notes.join(" · ")}` })
  }

  // 撤销：拿这批流水存的反向指令重放一次，然后把这批流水删掉——
  // 撤销掉的动作不该在流水里留下一对互相抵消的记录，那只会让人看不懂。
  if (action === "undo") {
    const bid = str(body.batch_id, 40)
    if (!bid) return NextResponse.json({ error: "batch_id 不对" }, { status: 400 })
    const { data: head } = await supabase.from("warehouse_log").select("undo_payload").eq("batch_id", bid).not("undo_payload", "is", null).maybeSingle()
    const undo = (head?.undo_payload ?? null) as Record<string, unknown> | null
    if (!undo) return NextResponse.json({ error: "这一步已经撤销过了" }, { status: 409 })

    if (undo.kind === "pack") {
      await supabase.from("warehouse_packs").update({ value: Number(undo.value) }).eq("item_key", String(undo.item_key)).eq("idx", Number(undo.idx))
    } else if (undo.kind === "packs_added") {
      await supabase.from("warehouse_packs").delete().eq("item_key", String(undo.item_key)).gte("idx", Number(undo.from)).lte("idx", Number(undo.to))
    } else if (undo.kind === "move") {
      for (const m of (undo.moves ?? []) as MoveIn[]) {
        const { data: cur } = await supabase.from("warehouse_holdings").select("qty").eq("item_key", m.item_key).eq("holder_key", m.holder_key).maybeSingle()
        const next = Math.max(0, (Number(cur?.qty) || 0) + m.delta)
        if (next === 0) {
          await supabase.from("warehouse_holdings").delete().eq("item_key", m.item_key).eq("holder_key", m.holder_key)
        } else {
          await supabase.from("warehouse_holdings").upsert(
            { item_key: m.item_key, holder_key: m.holder_key, holder_kind: m.holder_kind, holder_name: m.holder_name, qty: next, size_note: m.size_note ?? null, updated_at: new Date().toISOString() },
            { onConflict: "item_key,holder_key" },
          )
        }
      }
    } else if (undo.kind === "stock_in") {
      for (const k of (undo.item_keys ?? []) as string[]) {
        await supabase.from("warehouse_packs").delete().eq("item_key", k).eq("source_ref", String(undo.source_ref))
      }
    } else if (undo.kind === "consume") {
      for (const pk of (undo.packs ?? []) as Array<{ item_key: string; idx: number; value: number }>) {
        await supabase.from("warehouse_packs").update({ value: pk.value }).eq("item_key", pk.item_key).eq("idx", pk.idx)
      }
    } else if (undo.kind === "item") {
      await supabase.from("warehouse_items").update((undo.prev ?? {}) as Record<string, unknown>).eq("item_key", String(undo.item_key))
    }
    await supabase.from("warehouse_log").delete().eq("batch_id", bid)
    return NextResponse.json({ ok: true, undone: true })
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 })
}
