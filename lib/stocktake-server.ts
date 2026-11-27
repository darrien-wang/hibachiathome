import type { createServerSupabaseClient } from "@/lib/supabase"
import { stockLabel, stockUnit } from "@/lib/pantry"
import { RESTOCK_CHECK, STOCK_ITEMS, cleanLine, itemDef, totalBase, type AmountUnit, type CountLine, type CustomSpec, type RestockLevel } from "@/lib/stocktake"

// 师傅盘点的服务器端（lib/stocktake.ts 说了口径）。/api/tools/stock 用。
// 盘完写 pantry_stock：qty 设成这次盘的数、counted_at = 现在、updated_by = 谁盘的；stock_moves 记一笔 reason=count。
// 和备货页「对货」写的是同一列，所以备货页的「在库」立刻就是师傅盘的数。

type Supa = NonNullable<ReturnType<typeof createServerSupabaseClient>>

export type StockStaff = { id: string; name: string }

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/

/** 链接里的 token → 在职员工。 */
export async function staffByStockToken(supabase: Supa, token: string): Promise<StockStaff | null> {
  if (!TOKEN_RE.test(token)) return null
  const { data } = await supabase.from("staff_members").select("id, display_name, full_name, status").eq("stock_token", token).maybeSingle()
  const row = data as { id: string; display_name: string | null; full_name: string | null; status: string } | null
  if (!row || row.status !== "active") return null
  return { id: row.id, name: String(row.display_name ?? row.full_name ?? "").trim() || "师傅" }
}

export type ItemState = {
  key: string
  qty: number | null
  countedAt: string | null
  countedBy: string | null
  /** 上次盘的时候怎么数的（下次打开预填，师傅只改变了的）。 */
  lastLines: CountLine[] | null
  lastLevel: RestockLevel | null
}

export type StockState = { items: ItemState[]; specs: CustomSpec[] }

const KEYS = [...STOCK_ITEMS.map((i) => i.key), ...RESTOCK_CHECK.map((i) => i.key)]

export async function loadStockState(supabase: Supa): Promise<StockState> {
  const [{ data: pantry }, { data: specs }, { data: recent }] = await Promise.all([
    supabase.from("pantry_stock").select("item_key, qty, counted_at, updated_by").in("item_key", KEYS),
    supabase.from("stock_specs").select("id, item_key, label, amount, unit, created_by").is("archived_at", null).order("created_at"),
    // 每样最近一次盘点怎么数的：取最近 400 条，按样取第一条就够（一样东西不会一周盘 400 次）
    supabase.from("stock_count_items").select("item_key, lines, level, created_at").in("item_key", KEYS).order("created_at", { ascending: false }).limit(400),
  ])
  const p = new Map(((pantry ?? []) as Array<{ item_key: string; qty: number | null; counted_at: string | null; updated_by: string | null }>).map((r) => [r.item_key, r]))
  const last = new Map<string, { lines: unknown; level: string | null }>()
  for (const r of (recent ?? []) as Array<{ item_key: string; lines: unknown; level: string | null }>) if (!last.has(r.item_key)) last.set(r.item_key, r)
  const items: ItemState[] = KEYS.map((key) => {
    const row = p.get(key)
    const l = last.get(key)
    const def = itemDef(key)
    const lines = def && Array.isArray(l?.lines) ? (l!.lines as unknown[]).map((x) => cleanLine(def, x)).filter((x): x is CountLine => !!x) : null
    const lvl = l?.level === "ok" || l?.level === "low" || l?.level === "out" ? (l.level as RestockLevel) : null
    return { key, qty: row?.qty == null ? null : Number(row.qty), countedAt: row?.counted_at ?? null, countedBy: row?.updated_by ?? null, lastLines: lines, lastLevel: lvl }
  })
  return { items, specs: ((specs ?? []) as Array<CustomSpec & { amount: number | string }>).map((s) => ({ ...s, amount: Number(s.amount) })) }
}

export type SubmitItem = { item_key: string; lines?: unknown[]; level?: unknown }

export type SubmitResult = { ok: true; countId: string; applied: number } | { ok: false; status: number; error: string }

/** 一次提交 = 一次盘点。只写提交里有的那几样；没盘的不动。 */
export async function submitStockCount(supabase: Supa, who: { staffId: string | null; name: string; via: "link" | "workbench" }, raw: SubmitItem[], note?: string): Promise<SubmitResult> {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, status: 400, error: "这次一样都没盘" }
  type Clean = { key: string; lines: CountLine[]; base: number | null; level: RestockLevel | null }
  const clean: Clean[] = []
  const seen = new Set<string>()
  for (const r of raw.slice(0, 60)) {
    const key = typeof r?.item_key === "string" ? r.item_key : ""
    if (!key || seen.has(key)) continue
    const def = itemDef(key)
    if (def) {
      const list = Array.isArray(r.lines) ? r.lines : []
      const lines = list.map((x) => cleanLine(def, x))
      if (lines.some((x) => !x)) return { ok: false, status: 400, error: `${def.label} 有一行数不对` }
      clean.push({ key, lines: lines as CountLine[], base: totalBase(def, lines as CountLine[]), level: null })
    } else if (RESTOCK_CHECK.some((x) => x.key === key)) {
      const level = r.level === "ok" || r.level === "low" || r.level === "out" ? (r.level as RestockLevel) : null
      if (!level) continue
      clean.push({ key, lines: [], base: null, level })
    } else continue
    seen.add(key)
  }
  if (!clean.length) return { ok: false, status: 400, error: "这次一样都没盘" }

  const { data: count, error: cErr } = await supabase
    .from("stock_counts")
    .insert({ staff_member_id: who.staffId, counted_by: who.name, via: who.via, note: note?.slice(0, 500) || null })
    .select("id")
    .single()
  if (cErr || !count) return { ok: false, status: 500, error: cErr?.message ?? "没存上" }
  const countId = (count as { id: string }).id

  const { data: cur } = await supabase.from("pantry_stock").select("item_key, qty").in("item_key", clean.map((c) => c.key))
  const before = new Map(((cur ?? []) as Array<{ item_key: string; qty: number | null }>).map((r) => [r.item_key, r.qty == null ? null : Number(r.qty)]))
  const now = new Date().toISOString()

  const rows = clean.map((c) => ({ count_id: countId, item_key: c.key, lines: c.lines, base_qty: c.base, unit: stockUnit(c.key), prev_qty: before.get(c.key) ?? null, level: c.level }))
  const { error: iErr } = await supabase.from("stock_count_items").insert(rows)
  if (iErr) return { ok: false, status: 500, error: iErr.message }

  let applied = 0
  for (const c of clean) {
    const prev = before.get(c.key)
    // 补货型：没了 → 0；够 / 快没了 → 数量不动，只记盘过（这类本来就"没有就补"，账上的数不准也不追）
    const qty = c.level ? (c.level === "out" ? 0 : null) : c.base
    const patch: Record<string, unknown> = { label: stockLabel(c.key), unit: stockUnit(c.key), counted_at: now, updated_by: who.name, updated_at: now }
    if (qty != null) patch.qty = qty
    const { error } = before.has(c.key)
      ? await supabase.from("pantry_stock").update(patch).eq("item_key", c.key)
      : await supabase.from("pantry_stock").insert({ item_key: c.key, qty: qty ?? 0, ...patch })
    if (error) return { ok: false, status: 500, error: error.message }
    if (qty != null) {
      await supabase.from("stock_moves").insert({ item_key: c.key, delta: qty - (prev ?? 0), unit: stockUnit(c.key), reason: "count", ref: `stock_count:${countId}`, note: `${who.name} 盘点`, created_by: who.name })
    }
    applied++
  }
  return { ok: true, countId, applied }
}

const UNITS: AmountUnit[] = ["oz", "lb", "piece", "base"]

/** 师傅加一个规格：加了就能用（老板 2026-11-26）。同一样东西同名同量的不重复加。 */
export async function addStockSpec(supabase: Supa, raw: { item_key?: unknown; label?: unknown; amount?: unknown; unit?: unknown }, by: string): Promise<{ ok: true; spec: CustomSpec } | { ok: false; status: number; error: string }> {
  const key = typeof raw.item_key === "string" ? raw.item_key : ""
  const def = itemDef(key)
  if (!def) return { ok: false, status: 400, error: "没有这样东西" }
  const unit = UNITS.includes(raw.unit as AmountUnit) ? (raw.unit as AmountUnit) : null
  const amount = Number(raw.amount)
  if (!unit || !Number.isFinite(amount) || amount <= 0 || amount > 10000) return { ok: false, status: 400, error: "每包多少没填对" }
  if (unit === "piece" && !def.piece) return { ok: false, status: 400, error: `${def.label}不按个数` }
  if ((unit === "oz" || unit === "lb") && !def.ozPerBase) return { ok: false, status: 400, error: `${def.label}不按重量` }
  const unitText = unit === "piece" ? def.piece!.noun : unit === "base" ? stockUnit(key) : unit
  const label = (typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : `${Math.round(amount * 100) / 100} ${unitText}/包`).slice(0, 40)
  const { data: dup } = await supabase.from("stock_specs").select("id, item_key, label, amount, unit, created_by").eq("item_key", key).eq("unit", unit).eq("amount", amount).eq("label", label).is("archived_at", null).maybeSingle()
  if (dup) return { ok: true, spec: { ...(dup as CustomSpec), amount: Number((dup as CustomSpec).amount) } }
  const { data, error } = await supabase.from("stock_specs").insert({ item_key: key, label, amount, unit, created_by: by }).select("id, item_key, label, amount, unit, created_by").single()
  if (error || !data) return { ok: false, status: 500, error: error?.message ?? "没存上" }
  return { ok: true, spec: { ...(data as CustomSpec), amount: Number((data as CustomSpec).amount) } }
}

export async function archiveStockSpec(supabase: Supa, id: string): Promise<boolean> {
  const { error } = await supabase.from("stock_specs").update({ archived_at: new Date().toISOString() }).eq("id", id)
  return !error
}

export type CountHistory = { id: string; countedBy: string; via: string; createdAt: string; items: Array<{ key: string; base: number | null; prev: number | null; unit: string | null; level: string | null; lines: unknown }> }

export async function recentCounts(supabase: Supa, limit = 20): Promise<CountHistory[]> {
  const { data } = await supabase.from("stock_counts").select("id, counted_by, via, created_at, stock_count_items(item_key, base_qty, prev_qty, unit, level, lines)").order("created_at", { ascending: false }).limit(limit)
  return ((data ?? []) as Array<{ id: string; counted_by: string; via: string; created_at: string; stock_count_items: Array<{ item_key: string; base_qty: number | null; prev_qty: number | null; unit: string | null; level: string | null; lines: unknown }> }>).map((c) => ({
    id: c.id,
    countedBy: c.counted_by,
    via: c.via,
    createdAt: c.created_at,
    items: (c.stock_count_items ?? []).map((i) => ({ key: i.item_key, base: i.base_qty == null ? null : Number(i.base_qty), prev: i.prev_qty == null ? null : Number(i.prev_qty), unit: i.unit, level: i.level, lines: i.lines })),
  }))
}
