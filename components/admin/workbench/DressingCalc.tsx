"use client"

import { useMemo, useState } from "react"
import { DRESSING_BATCH_G, DRESSING_BATCH_OZ, DRESSING_BOTTLE_OZ, DRESSING_COST_PER_OZ, DRESSING_PER_GUEST_OZ, DRESSING_RECIPE, G_PER_OZ, STORE_BOUGHT } from "@/config/ginger-dressing"

// 姜汁酱计算器（老板 2026-09-30）：为了新鲜一周做一次，所以按这周订单的人头算要做多少，
// 再把标准配方（一锅 48 oz）按倍数放大缩小成每样料多少克。
// 订单来自仓库接口的 events（未来 10 天，带日期和人数）；配方在 config/ginger-dressing.ts。

type Ev = { key: string; name: string; date?: string; guests?: number }

const MUTED = "var(--color-neutral-600)"
const INK = "var(--color-text)"

const ptToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })
const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const md = (ymd: string) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`
const num = (v: string, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}
const grams = (g: number) => (g >= 10 ? `${Math.round(g).toLocaleString()} g` : `${Math.round(g * 10) / 10} g`)
const usd = (n: number) => `$${n.toFixed(2)}`

/** 按 1/8 取整写成分数：0.625 → "5/8"，1.25 → "1 1/4"，2 → "2"。备菜的人看分数比看小数顺。 */
function frac(x: number): string {
  const eighths = Math.round(x * 8)
  if (eighths === 0) return x > 0 ? "一点点" : "0"
  const whole = Math.floor(eighths / 8)
  const rest = eighths % 8
  if (!rest) return String(whole)
  const g = rest % 4 === 0 ? 4 : rest % 2 === 0 ? 2 : 1
  const f = `${rest / g}/${8 / g}`
  return whole ? `${whole} ${f}` : f
}

export function DressingCalc({ events }: { events: Ev[] }) {
  const today = ptToday()
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(addDays(today, 6))
  const [off, setOff] = useState<Set<string>>(() => new Set())
  const [extra, setExtra] = useState("0")
  const [perGuest, setPerGuest] = useState(String(DRESSING_PER_GUEST_OZ))
  const [buffer, setBuffer] = useState("10")
  const [left, setLeft] = useState("0")
  const [copied, setCopied] = useState(false)

  const inRange = useMemo(() => events.filter((e) => e.date && e.date >= from && e.date <= to), [events, from, to])
  const counted = inRange.filter((e) => !off.has(e.key))
  const guests = counted.reduce((n, e) => n + (e.guests ?? 0), 0) + num(extra)
  const need = guests * num(perGuest, DRESSING_PER_GUEST_OZ)
  const withBuffer = need * (1 + num(buffer) / 100)
  const target = Math.max(0, withBuffer - num(left))
  const targetG = target * G_PER_OZ
  const factor = targetG / DRESSING_BATCH_G
  const bottles = Math.ceil(target / DRESSING_BOTTLE_OZ)

  const rows = DRESSING_RECIPE.map((i) => ({
    ...i,
    g: i.g * factor,
    cost: i.g * factor * i.price.perG,
    est: i.est ? `≈ ${frac(i.est.qty * factor)} ${i.est.unit}${i.est.note ? `（${i.est.note}）` : ""}` : "",
  }))
  // 成本（老板 2026-09-30）：单价在 config/ginger-dressing.ts，有收据用收据，没买过的按市价估
  const cost = rows.reduce((n, r) => n + r.cost, 0)

  const toggle = (key: string) =>
    setOff((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const copy = async () => {
    const lines = [
      `姜汁酱 · ${md(from)}–${md(to)} · ${guests} 人 → 做 ${Math.round(target * 10) / 10} oz（${Math.round(targetG).toLocaleString()} g，标准一锅的 ${Math.round(factor * 100) / 100} 倍，装 ${bottles} 瓶，原料约 ${usd(cost)}）`,
      ...rows.map((r) => `${r.zh} ${r.en}：${grams(r.g)}${r.est ? `  ${r.est}` : ""}`),
    ]
    try {
      await navigator.clipboard.writeText(lines.join("\n"))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  const field = (label: string, value: string, set: (v: string) => void, unit: string, width = 64) => (
    <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13 }}>
      {label}
      <input className="input" inputMode="decimal" style={{ width, textAlign: "center" }} value={value} onChange={(e) => set(e.target.value.replace(/[^\d.]/g, ""))} />
      {unit}
    </label>
  )

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 24 }}>姜汁酱</div>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 4, lineHeight: 1.6 }}>
          一周做一次保新鲜：按这周订单的人头算要做多少，再把标准配方（一锅 {DRESSING_BATCH_OZ} oz）按倍数换成每样料的克数。每人 {DRESSING_PER_GUEST_OZ} oz，和备料单同一个数。
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13 }}>
          从
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 160 }} />
        </label>
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13 }}>
          到
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 160 }} />
        </label>
        <span style={{ fontSize: 12, color: MUTED }}>（只看得到未来 10 天的单）</span>
      </div>

      <div style={{ border: `2px solid ${INK}`, marginBottom: 12 }}>
        {inRange.length === 0 ? <div style={{ padding: "10px 14px", fontSize: 13, color: MUTED }}>这几天没有订单。</div> : null}
        {inRange.map((e) => (
          <label key={e.key} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 14px", borderBottom: "1px solid var(--color-divider)", cursor: "pointer", fontSize: 14 }}>
            <input type="checkbox" checked={!off.has(e.key)} onChange={() => toggle(e.key)} />
            <span style={{ fontWeight: 600 }}>{e.name}</span>
          </label>
        ))}
      </div>

      <div style={{ display: "flex", gap: "10px 18px", flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        {field("另外加", extra, setExtra, "人")}
        {field("每人", perGuest, setPerGuest, "oz")}
        {field("多做", buffer, setBuffer, "%")}
        {field("还有能用的", left, setLeft, "oz")}
      </div>

      <div style={{ border: `2px solid ${INK}`, padding: "12px 14px", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: MUTED }}>
          {counted.length} 单{num(extra) ? ` + 另外 ${num(extra)} 人` : ""} · 共 {guests} 人 × {num(perGuest, DRESSING_PER_GUEST_OZ)} oz = {Math.round(need * 10) / 10} oz
          {num(buffer) ? `，多做 ${num(buffer)}% → ${Math.round(withBuffer * 10) / 10} oz` : ""}
          {num(left) ? `，减去还有的 ${num(left)} oz` : ""}
        </div>
        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 22, marginTop: 4 }}>
          做 {Math.round(target * 10) / 10} oz（{Math.round(targetG).toLocaleString()} g）
        </div>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>
          标准一锅的 {Math.round(factor * 100) / 100} 倍 · 装 {bottles} 瓶（{DRESSING_BOTTLE_OZ} oz）
        </div>
        <div style={{ fontSize: 13, marginTop: 8 }}>
          原料约 <b>{usd(cost)}</b> · 每 oz 约 <b>{usd(DRESSING_COST_PER_OZ)}</b>（每位客人 1 oz）
          <span style={{ color: MUTED }}>
            {" "}
            · 买现成的 {STORE_BOUGHT.label} 约 {usd(STORE_BOUGHT.perOz)}/oz，自制约是它的 {Math.round((DRESSING_COST_PER_OZ / STORE_BOUGHT.perOz) * 100)}%（没算人工）
          </span>
        </div>
      </div>

      <table className="table" style={{ width: "100%", fontSize: 14 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>配料</th>
            <th style={{ textAlign: "right", width: 110 }}>克数</th>
            <th style={{ textAlign: "left" }}>大概</th>
            <th style={{ textAlign: "right", width: 70 }}>成本</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.en}>
              <td style={{ fontWeight: 700 }}>
                {r.zh} <span style={{ fontWeight: 400, color: MUTED }}>{r.en}</span>
              </td>
              <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{grams(r.g)}</td>
              <td style={{ color: MUTED, fontSize: 13 }}>{r.est}</td>
              <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: MUTED, fontSize: 13 }} title={r.price.note}>
                {usd(r.cost)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-secondary btn-sm" disabled={target <= 0} onClick={() => void copy()}>
          {copied ? "已复制" : "复制成文字（发给备菜的人）"}
        </button>
        <span style={{ fontSize: 12, color: MUTED }}>标准一锅：各料合计 {DRESSING_BATCH_G.toLocaleString()} g ≈ {DRESSING_BATCH_OZ} oz</span>
      </div>

      <details style={{ marginTop: 12 }}>
        <summary style={{ cursor: "pointer", fontSize: 13, color: MUTED }}>单价从哪来（有收据用收据，没买过的按 9 月市价估）</summary>
        <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.8, marginTop: 6 }}>
          {DRESSING_RECIPE.map((i) => (
            <div key={i.en}>
              {i.zh}：{i.price.note}
            </div>
          ))}
        </div>
      </details>
    </div>
  )
}
