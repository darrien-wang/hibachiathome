"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { adminJson } from "./api"
import { tell } from "./ask"
import { Chip, Dialog, DialogHead, Kicker, Tag } from "./ui"
import { addDays, dowZh, md, ptToday } from "./helpers"
import { PREP_GROUP_TITLES, type PrepGroup, type PrepItem } from "@/lib/prep-bom"

// 备料采购：明天有几场、每场吃什么、合计买什么（按 Walmart / Instacart 的
// 采购单位换算，宁多勿少）。数据口径 = 发票系统同一套份量配比。

type PrepOrder = {
  id: string
  orderNo: string
  name: string
  timeLabel: string
  city: string | null
  adults: number
  kids: number
  menuKnown: boolean
  proteinLine: string
  extrasLine: string
}
type StockRow = { item_key: string; label: string; unit: string; qty: number; low_at: number | null; note: string | null; updated_at: string }
type PrepData = {
  ok: boolean
  date: string
  orderCount: number
  guestTotal: number
  orders: PrepOrder[]
  totals: PrepItem[]
  stock: StockRow[]
  pantry: Record<string, number>
  consumed: boolean
  warnings: string[]
}

const GROUP_ORDER: PrepGroup[] = ["protein", "produce", "frozen", "pantry", "setup"]

export function PrepDialog({ adminKey, owner, onClose, onOpenOrder }: { adminKey: string; owner: boolean; onClose: () => void; onOpenOrder: (id: string) => void }) {
  const today = ptToday()
  const [date, setDate] = useState(addDays(today, 1))
  const [d, setD] = useState<PrepData | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setD(null)
    setErr(null)
    try {
      setD(await adminJson<PrepData>(adminKey, `/api/admin/prep?date=${date}`))
    } catch (e) {
      setErr(e instanceof Error ? e.message : "读取失败")
    }
  }, [adminKey, date])
  useEffect(() => {
    void load()
  }, [load])

  const groups = useMemo(() => {
    const by = new Map<PrepGroup, PrepItem[]>()
    for (const it of d?.totals ?? []) {
      const list = by.get(it.group) ?? []
      list.push(it)
      by.set(it.group, list)
    }
    return GROUP_ORDER.filter((g) => by.has(g)).map((g) => ({ key: g, title: PREP_GROUP_TITLES[g], items: by.get(g)! }))
  }, [d])

  const copyText = useMemo(() => {
    if (!d) return ""
    const lines: string[] = [`${md(d.date)} ${dowZh(d.date)} 备料 · ${d.orderCount} 场 ${d.guestTotal} 人（宁多勿少：建议量已 +10% 取整）`]
    for (const w of d.warnings) lines.push(`⚠ ${w}`)
    for (const g of groups) {
      lines.push(``, `【${g.title}】`)
      for (const it of g.items) lines.push(`- ${it.label}：${it.qty} ${it.unit}${it.alt ? `（${it.alt}）` : ""}`)
    }
    lines.push(``, `——按单——`)
    for (const o of d.orders) lines.push(`${o.timeLabel} ${o.name} ${o.adults + o.kids}人${o.city ? ` · ${o.city}` : ""}：${o.menuKnown ? o.proteinLine : "菜单未定"}${o.extrasLine ? ` · ${o.extrasLine}` : ""}`)
    lines.push(``, `冰箱里已有的自己扣掉。`)
    return lines.join("\n")
  }, [d, groups])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      void tell({ title: "复制不了，长按选中下面文字", message: copyText })
    }
  }

  const dates = [0, 1, 2].map((n) => addDays(today, n))
  const dateName = (ymd: string) => (ymd === today ? "今天" : ymd === addDays(today, 1) ? "明天" : "后天")

  return (
    <Dialog onClose={onClose} width={640}>
      <DialogHead
        title="备料采购"
        lines={[<>份量口径和厨师备料单一致；换算按 Walmart / Instacart 常买规格，建议量已按&quot;宁多勿少&quot;+10% 取整。</>]}
        onClose={onClose}
      />
      <div className="dialog-col" style={{ gap: 16 }}>
        <div style={{ display: "flex", gap: 0, alignItems: "center" }}>
          {dates.map((ymd, i) => (
            <Chip key={ymd} active={date === ymd} onClick={() => setDate(ymd)} style={i > 0 ? { marginLeft: -1 } : undefined}>
              {dateName(ymd)} {md(ymd)}
            </Chip>
          ))}
          <button type="button" className="btn btn-secondary btn-sm" style={{ marginLeft: "auto" }} onClick={() => void copy()} disabled={!d || d.orderCount === 0}>
            {copied ? "✓ 已复制" : "复制清单"}
          </button>
        </div>

        {err ? <div className="notice">{err}</div> : null}
        {!d && !err ? <div className="empty">算料中…</div> : null}
        {d && d.orderCount === 0 ? <div className="empty">{md(d.date)} {dowZh(d.date)} 没有订单，不用备料。</div> : null}

        {d?.warnings.map((w, i) => (
          <div key={i} className="notice" style={{ borderColor: "var(--color-accent)", color: "var(--color-accent-700)" }}>
            ⚠ {w}
          </div>
        ))}

        {d && d.orderCount > 0 ? (
          <>
            <div>
              <Kicker style={{ marginBottom: 8 }}>
                {md(d.date)} {dowZh(d.date)} · {d.orderCount} 场 · {d.guestTotal} 人
              </Kicker>
              {d.orders.map((o) => (
                <div key={o.id} className="wb-row" onClick={() => onOpenOrder(o.id)} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "8px 0", borderBottom: "1px solid var(--color-line)", cursor: "pointer" }}>
                  <strong style={{ whiteSpace: "nowrap" }}>{o.timeLabel}</strong>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    {o.name} · {o.adults + o.kids} 人{o.kids ? `（小孩 ${o.kids}）` : ""}
                    <span style={{ color: "var(--color-neutral-700)" }}>{o.menuKnown ? ` · ${o.proteinLine}` : ""}{o.extrasLine ? ` · ${o.extrasLine}` : ""}</span>
                  </span>
                  {!o.menuKnown ? <Tag cls="tag-accent">菜单未定</Tag> : null}
                </div>
              ))}
            </div>

            {groups.map((g) => (
              <div key={g.key}>
                <Kicker style={{ marginBottom: 6 }}>{g.title}</Kicker>
                {g.items.map((it) => {
                  const have = d.pantry?.[it.id]
                  const short = have != null ? Math.max(0, Math.round((it.qty - have) * 10) / 10) : null
                  return (
                    <div key={`${it.id}|${it.unit}`} style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "6px 0", borderBottom: "1px solid var(--color-line)", opacity: it.group === "pantry" ? 0.75 : 1 }}>
                      <span style={{ flex: 1, minWidth: 0 }}>{it.label}</span>
                      {have != null && have > 0 ? (
                        <span style={{ whiteSpace: "nowrap", fontSize: 12.5, color: short === 0 ? "var(--color-neutral-600)" : "var(--color-neutral-700)" }}>
                          在库 {have}{short === 0 ? " · 够了" : ` · 还差 ${short}`}
                        </span>
                      ) : null}
                      <strong style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                        {it.qty} {it.unit}
                      </strong>
                      {it.alt ? <span style={{ whiteSpace: "nowrap", fontSize: 12.5, color: "var(--color-accent-700)" }}>{it.alt}</span> : null}
                    </div>
                  )
                })}
              </div>
            ))}
            <ConsumeRow adminKey={adminKey} owner={owner} date={d.date} consumed={d.consumed} totals={d.totals} onDone={load} />
            <div style={{ fontSize: 12, color: "var(--color-neutral-600)", lineHeight: 1.6 }}>
              菜单没定的单只算了主食、蔬菜和蛋；冰箱里已有的自己扣。份量表改动要和发票系统同一天改（lib/prep-bom.ts 是镜像）。
            </div>
          </>
        ) : null}

        {d ? <StockSection adminKey={adminKey} owner={owner} stock={d.stock} need={d.totals.filter((t) => t.group === "setup")} onSaved={load} /> : null}
      </div>
    </Dialog>
  )
}

// ---- 办完之后把当天用量从食材库存里扣掉（同一天只生效一次）----

function ConsumeRow({ adminKey, owner, date, consumed, totals, onDone }: { adminKey: string; owner: boolean; date: string; consumed: boolean; totals: PrepItem[]; onDone: () => Promise<void> | void }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  if (!owner) return null
  const items = totals.filter((t) => t.group !== "setup" && t.id !== "mixed_vege").map((t) => ({ item_key: t.id, qty: t.qty }))
  const run = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const r = await adminJson<{ ok: boolean; applied: number }>(adminKey, "/api/admin/prep", { body: { action: "consume", date, items } })
      setMsg(`已扣 ${r.applied} 项`)
      await onDone()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "失败")
    } finally {
      setBusy(false)
    }
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--color-neutral-600)" }}>
      <span style={{ flex: 1 }}>{consumed ? "这一天的用量已经从库存扣过了。" : "办完之后点一下，把这一天的用量从食材库存里扣掉。"}</span>
      {msg ? <span>{msg}</span> : null}
      <button type="button" className="btn btn-secondary btn-sm" disabled={busy || consumed} onClick={() => void run()}>
        {busy ? "扣料中…" : consumed ? "已扣料" : "扣掉当天用量"}
      </button>
    </div>
  )
}

// ---- 装备库存盘点：桌椅桌布餐具气罐，需求 vs 在库，一眼看够不够 ----

const NEED_KEY: Record<string, string> = { tables: "tables", chairs: "chairs", utensils: "utensils" }

function StockSection({ adminKey, owner, stock, need, onSaved }: { adminKey: string; owner: boolean; stock: StockRow[]; need: PrepItem[]; onSaved: () => Promise<void> | void }) {
  const [edit, setEdit] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const needBy = new Map<string, number>()
  for (const n of need) {
    const k = NEED_KEY[n.id]
    if (k) needBy.set(k, (needBy.get(k) ?? 0) + n.qty)
    if (n.id === "tables") needBy.set("tablecloths", (needBy.get("tablecloths") ?? 0) + n.qty)
  }
  const save = async (row: StockRow) => {
    const raw = edit[row.item_key]
    const qty = Math.round(Number(raw))
    if (!Number.isFinite(qty) || qty < 0) return
    setBusy(row.item_key)
    setMsg(null)
    try {
      await adminJson(adminKey, "/api/admin/prep", { body: { action: "set_stock", item_key: row.item_key, qty } })
      setEdit((e) => ({ ...e, [row.item_key]: "" }))
      await onSaved()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "失败")
    } finally {
      setBusy(null)
    }
  }
  return (
    <div>
      <Kicker style={{ marginBottom: 6 }}>装备库存（盘点在这里改数）</Kicker>
      {msg ? <div className="notice">{msg}</div> : null}
      {stock.map((row) => {
        const needQty = needBy.get(row.item_key)
        const short = needQty != null && row.qty < needQty
        const low = !short && row.low_at != null && row.qty <= row.low_at
        return (
          <div key={row.item_key} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--color-line)" }}>
            <span style={{ flex: 1, minWidth: 0 }}>{row.label}</span>
            {needQty != null ? <span style={{ fontSize: 12.5, color: "var(--color-neutral-600)", whiteSpace: "nowrap" }}>要 {needQty}</span> : null}
            <strong style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", color: short ? "var(--color-accent-700)" : undefined }}>
              在库 {row.qty} {row.unit}
            </strong>
            {short ? <Tag cls="tag-accent">不够</Tag> : low ? <Tag cls="tag-outline">偏低</Tag> : null}
            {owner ? (
              <span style={{ display: "flex", gap: 4, alignItems: "center", flex: "none" }}>
                <input
                  className="input"
                  inputMode="numeric"
                  placeholder="盘点数"
                  value={edit[row.item_key] ?? ""}
                  onChange={(e) => setEdit((x) => ({ ...x, [row.item_key]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && void save(row)}
                  style={{ width: 72, minHeight: 32, padding: "3px 8px" }}
                />
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy === row.item_key || !(edit[row.item_key] ?? "").trim()} onClick={() => void save(row)}>
                  存
                </button>
              </span>
            ) : null}
          </div>
        )
      })}
      <div style={{ fontSize: 12, color: "var(--color-neutral-600)", marginTop: 6, lineHeight: 1.6 }}>
        桌布按桌数折算需求；买了新装备、用坏了几把，随手把在库数改成实际数就算盘点完。
      </div>
    </div>
  )
}
