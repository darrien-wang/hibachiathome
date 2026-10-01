"use client"

import { useEffect, useMemo, useState } from "react"
import { batchCost, batchGrams, costPerOz, G_PER_OZ, HOUSE_SAUCES, type SauceIngredient, type SauceRecipe } from "@/config/house-sauces"

// 自制酱计算器（老板 2026-09-30）：姜汁酱 / Yum Yum 切换。为了新鲜一周做一次，所以按这周
// 订单的人头算要做多少，再把配方按倍数放大缩小成每样料多少克，顺带估原料成本。
// 订单来自仓库接口的 events（未来 10 天，带日期和人数）；配方和单价在 config/house-sauces.ts。
//
// 冻底料模式（老板 2026-09-30）：能冻的那几样（配方里 base: true）提前打成泥分袋冻，
// 每周解冻几袋、现加美乃滋这些不能冻的。袋是整袋用的，所以本周按整袋往上取。

type Ev = { key: string; name: string; date?: string; guests?: number }
type Key = SauceRecipe["key"]
type Mode = "fresh" | "frozen"

const MUTED = "var(--color-neutral-600)"
const INK = "var(--color-text)"
const PICK_KEY = "rh-sauce-pick"
const MODE_KEY = "rh-sauce-mode"
const BAG_KEY = "rh-sauce-bag"

const ptToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })
const addDays = (ymd: string, n: number) => {
  const d = new Date(`${ymd}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const md = (ymd: string) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`
const num = (v: string, fallback = 0) => {
  const n = Number(v)
  return v.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : fallback
}
const grams = (g: number) => (g >= 10 ? `${Math.round(g).toLocaleString()} g` : `${Math.round(g * 10) / 10} g`)
const usd = (n: number) => `$${n.toFixed(2)}`
const r1 = (n: number) => Math.round(n * 10) / 10
const store = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v)
  } catch {}
}

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

type Row = SauceIngredient & { gScaled: number; cost: number; estText: string }
const scale = (list: SauceIngredient[], factor: number): Row[] =>
  list.map((i) => ({
    ...i,
    gScaled: i.g * factor,
    cost: i.g * factor * i.price.perG,
    estText: i.est ? `≈ ${frac(i.est.qty * factor)} ${i.est.unit}${i.est.note ? `（${i.est.note}）` : ""}` : "",
  }))

function Table({ rows, showCost = true }: { rows: Row[]; showCost?: boolean }) {
  return (
    <table className="table" style={{ width: "100%", fontSize: 14 }}>
      <thead>
        <tr>
          <th style={{ textAlign: "left" }}>配料</th>
          <th style={{ textAlign: "right", width: 110 }}>克数</th>
          <th style={{ textAlign: "left" }}>大概</th>
          {showCost ? <th style={{ textAlign: "right", width: 70 }}>成本</th> : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.en}>
            <td style={{ fontWeight: 700 }}>
              {r.zh} <span style={{ fontWeight: 400, color: MUTED }}>{r.en}</span>
            </td>
            <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{grams(r.gScaled)}</td>
            <td style={{ color: MUTED, fontSize: 13 }}>{r.estText}</td>
            {showCost ? (
              <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: MUTED, fontSize: 13 }} title={r.price.note}>
                {usd(r.cost)}
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function SauceCalc({ events }: { events: Ev[] }) {
  const today = ptToday()
  const [pick, setPick] = useState<Key>("ginger")
  const [mode, setMode] = useState<Mode>("fresh")
  const [bagScale, setBagScale] = useState(1)
  useEffect(() => {
    try {
      const v = localStorage.getItem(PICK_KEY)
      if (v && HOUSE_SAUCES.some((s) => s.key === v)) setPick(v as Key)
      const m = localStorage.getItem(MODE_KEY)
      if (m === "fresh" || m === "frozen") setMode(m)
      const b = Number(localStorage.getItem(BAG_KEY))
      if (b === 1 || b === 0.5) setBagScale(b)
    } catch {}
  }, [])
  const choose = (k: Key) => {
    setPick(k)
    store(PICK_KEY, k)
  }
  const recipe = HOUSE_SAUCES.find((s) => s.key === pick) ?? HOUSE_SAUCES[0]
  const hasBase = recipe.ingredients.some((i) => i.base)
  const frozen = hasBase && mode === "frozen"

  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(addDays(today, 6))
  const [off, setOff] = useState<Set<string>>(() => new Set())
  const [extra, setExtra] = useState("0")
  // 每人用量各酱各记：姜汁酱 1 oz、Yum Yum 2 oz，切过去不串
  const [perGuestBy, setPerGuestBy] = useState<Record<Key, string>>(() => Object.fromEntries(HOUSE_SAUCES.map((s) => [s.key, String(s.perGuestOz)])) as Record<Key, string>)
  const [buffer, setBuffer] = useState("10")
  const [leftBy, setLeftBy] = useState<Record<Key, string>>({ ginger: "0", yumyum: "0" })
  const [makeBags, setMakeBags] = useState("4")
  const [copied, setCopied] = useState<string | null>(null)

  const perGuest = num(perGuestBy[pick] ?? "", recipe.perGuestOz)
  const left = num(leftBy[pick] ?? "")
  const inRange = useMemo(() => events.filter((e) => e.date && e.date >= from && e.date <= to), [events, from, to])
  const counted = inRange.filter((e) => !off.has(e.key))
  const guests = counted.reduce((n, e) => n + (e.guests ?? 0), 0) + num(extra)
  const need = guests * perGuest
  const withBuffer = need * (1 + num(buffer) / 100)
  const target = Math.max(0, withBuffer - left)
  const baseG = batchGrams(recipe)
  const exactFactor = (target * G_PER_OZ) / baseG

  // 冻底料：底料是整袋用的，本周按整袋往上取（差一点点不多开一袋）
  const baseList = recipe.ingredients.filter((i) => i.base)
  const freshList = recipe.ingredients.filter((i) => !i.base)
  const bagG = baseList.reduce((n, i) => n + i.g, 0) * bagScale
  const bags = frozen && target > 0 ? Math.max(1, Math.ceil(exactFactor / bagScale - 0.05)) : 0
  const factor = frozen ? bags * bagScale : exactFactor
  const madeOz = (factor * baseG) / G_PER_OZ
  const madeG = factor * baseG
  const bottles = Math.ceil(madeOz / recipe.bottleOz)
  const perOz = costPerOz(recipe)

  const allRows = scale(recipe.ingredients, factor)
  const freshRows = scale(freshList, factor)
  const cost = allRows.reduce((n, r) => n + r.cost, 0)
  const makeN = Math.max(0, Math.round(num(makeBags)))
  const makeRows = scale(baseList, makeN * bagScale)
  const makeTotalG = makeRows.reduce((n, r) => n + r.gScaled, 0)

  const toggle = (key: string) =>
    setOff((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const bagLabel = bagScale === 1 ? "一锅的量" : "半锅的量"
  const copyText = async (which: "week" | "base") => {
    const lines =
      which === "base"
        ? [
            `${recipe.name}底料 · 做 ${makeN} 袋（每袋 ${grams(bagG)}，${bagLabel}），合计 ${grams(makeTotalG)}`,
            ...makeRows.map((r) => `${r.zh} ${r.en}：${grams(r.gScaled)}${r.estText ? `  ${r.estText}` : ""}`),
            recipe.baseHowTo ?? "",
          ]
        : frozen
          ? [
              `${recipe.name} · ${md(from)}–${md(to)} · ${guests} 人 × ${perGuest} oz → 解冻 ${bags} 袋底料（每袋 ${grams(bagG)}）+ 现加下面这些，做出 ${r1(madeOz)} oz，装 ${bottles} 瓶`,
              ...freshRows.map((r) => `${r.zh} ${r.en}：${grams(r.gScaled)}${r.estText ? `  ${r.estText}` : ""}`),
            ]
          : [
              `${recipe.name} · ${md(from)}–${md(to)} · ${guests} 人 × ${perGuest} oz → 做 ${r1(madeOz)} oz（${Math.round(madeG).toLocaleString()} g，配方的 ${Math.round(factor * 100) / 100} 倍，装 ${bottles} 瓶，原料约 ${usd(cost)}）`,
              ...allRows.map((r) => `${r.zh} ${r.en}：${grams(r.gScaled)}${r.estText ? `  ${r.estText}` : ""}`),
            ]
    try {
      await navigator.clipboard.writeText(lines.filter(Boolean).join("\n"))
      setCopied(which)
      setTimeout(() => setCopied(null), 1500)
    } catch {}
  }

  const field = (label: string, value: string, set: (v: string) => void, unit: string, width = 64) => (
    <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 13 }}>
      {label}
      <input className="input" inputMode="decimal" style={{ width, textAlign: "center" }} value={value} onChange={(e) => set(e.target.value.replace(/[^\d.]/g, ""))} />
      {unit}
    </label>
  )
  const box = { border: `2px solid ${INK}`, padding: "12px 14px", marginBottom: 14 } as const
  const h = { fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 19 } as const

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 24 }}>自制酱</div>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 4, lineHeight: 1.6 }}>
          一周做一次保新鲜：按这周订单的人头算要做多少，再把配方按倍数换成每样料的克数。每人用量和备料单同一个数。
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
        {HOUSE_SAUCES.map((s) => (
          <button key={s.key} type="button" className="wb-chip" aria-pressed={pick === s.key} onClick={() => choose(s.key)}>
            {s.name} · 每人 {s.perGuestOz} oz
          </button>
        ))}
      </div>
      {hasBase ? (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
          {(
            [
              ["fresh", "全部现做"],
              ["frozen", "冻底料"],
            ] as Array<[Mode, string]>
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              className="wb-chip wb-chip-sm"
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m)
                store(MODE_KEY, m)
              }}
            >
              {label}
            </button>
          ))}
          {frozen ? (
            <span style={{ display: "inline-flex", gap: 4, alignItems: "center", marginLeft: 10, fontSize: 13 }}>
              每袋装
              {[1, 0.5].map((b) => (
                <button
                  key={b}
                  type="button"
                  className="wb-chip wb-chip-sm"
                  aria-pressed={bagScale === b}
                  onClick={() => {
                    setBagScale(b)
                    store(BAG_KEY, String(b))
                  }}
                >
                  {b === 1 ? "一锅的量" : "半锅的量"}
                </button>
              ))}
              <span style={{ color: MUTED }}>（{grams(bagG)}）</span>
            </span>
          ) : null}
        </div>
      ) : null}

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
        {field("每人", perGuestBy[pick] ?? "", (v) => setPerGuestBy((p) => ({ ...p, [pick]: v })), "oz")}
        {field("多做", buffer, setBuffer, "%")}
        {field("还有能用的", leftBy[pick] ?? "", (v) => setLeftBy((p) => ({ ...p, [pick]: v })), "oz")}
      </div>

      <div style={box}>
        <div style={{ fontSize: 13, color: MUTED }}>
          {counted.length} 单{num(extra) ? ` + 另外 ${num(extra)} 人` : ""} · 共 {guests} 人 × {perGuest} oz = {r1(need)} oz
          {num(buffer) ? `，多做 ${num(buffer)}% → ${r1(withBuffer)} oz` : ""}
          {left ? `，减去还有的 ${left} oz` : ""}
        </div>
        {frozen ? (
          <>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 22, marginTop: 4 }}>
              解冻 {bags} 袋底料 + 现加下面这些 → 做出 {r1(madeOz)} oz
            </div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>
              底料按整袋用（每袋 {grams(bagG)}，{bagLabel}），比要的 {r1(target)} oz 多 {r1(Math.max(0, madeOz - target))} oz · 装 {bottles} 瓶（{recipe.bottleOz} oz）
            </div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 22, marginTop: 4 }}>
              {recipe.name}：做 {r1(madeOz)} oz（{Math.round(madeG).toLocaleString()} g）
            </div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>
              配方的 {Math.round(factor * 100) / 100} 倍 · 装 {bottles} 瓶（{recipe.bottleOz} oz）
            </div>
          </>
        )}
        <div style={{ fontSize: 13, marginTop: 8 }}>
          原料约 <b>{usd(cost)}</b> · 每 oz 约 <b>{usd(perOz)}</b>（每位客人 {recipe.perGuestOz} oz ≈ {usd(perOz * recipe.perGuestOz)}）
          <span style={{ color: MUTED }}>
            {" "}
            · 买现成的 {recipe.storeBought.label} 约 {usd(recipe.storeBought.perOz)}/oz，自制约是它的 {Math.round((perOz / recipe.storeBought.perOz) * 100)}%（没算人工）
          </span>
        </div>
      </div>

      {recipe.notes?.length ? (
        <div className="notice" style={{ marginBottom: 14, fontSize: 13, lineHeight: 1.6 }}>
          {recipe.notes.map((n) => (
            <div key={n}>{n}</div>
          ))}
        </div>
      ) : null}

      {frozen ? (
        <>
          <div style={{ ...h, marginBottom: 6 }}>本周现加（底料以外）</div>
          <Table rows={freshRows} />
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-secondary btn-sm" disabled={bags <= 0} onClick={() => void copyText("week")}>
              {copied === "week" ? "已复制" : "复制本周做法"}
            </button>
          </div>

          <div style={{ ...box, marginTop: 22 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={h}>做底料冻起来</div>
              {field("做", makeBags, setMakeBags, `袋（每袋 ${grams(bagG)}，${bagLabel}）`, 56)}
            </div>
            <div style={{ fontSize: 12.5, color: MUTED, marginTop: 6, lineHeight: 1.6 }}>{recipe.baseHowTo}</div>
          </div>
          {makeN > 0 ? <Table rows={makeRows} showCost={false} /> : null}
          {makeN > 0 ? (
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13 }}>
                合计 <b>{grams(makeTotalG)}</b>，分 {makeN} 袋，每袋 {grams(bagG)}
              </span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copyText("base")}>
                {copied === "base" ? "已复制" : "复制底料做法"}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <Table rows={allRows} />
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-secondary btn-sm" disabled={target <= 0} onClick={() => void copyText("week")}>
              {copied === "week" ? "已复制" : "复制成文字（发给备菜的人）"}
            </button>
            <span style={{ fontSize: 12, color: MUTED }}>
              配方：{recipe.batchLabel} · 一锅原料约 {usd(batchCost(recipe))}
            </span>
          </div>
        </>
      )}

      <details style={{ marginTop: 14 }}>
        <summary style={{ cursor: "pointer", fontSize: 13, color: MUTED }}>单价从哪来（有收据用收据，没买过的按 9 月市价估）</summary>
        <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.8, marginTop: 6 }}>
          {recipe.ingredients.map((i) => (
            <div key={i.en}>
              {i.zh}：{i.price.note}
            </div>
          ))}
          <div>
            对照 {recipe.storeBought.label}：{recipe.storeBought.note}
          </div>
        </div>
      </details>
    </div>
  )
}
