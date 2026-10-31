"use client"

import { useMemo, useState } from "react"
import { OTHER_KEY, ROTATION, TARGET_MAX, TARGET_MIN, UNASSIGNED_KEY, weekShare, type ShareParty, type ShareSlice } from "@/lib/chef-share"
import { zhTime } from "@/lib/cooler-sheet"
import { addDays, dowZh, md, type OrderRow } from "./helpers"
import type { ChefSummary } from "./chef-types"
import { Chip } from "./ui"

// 员工 · 份额：每位师傅占这周总人数的比例。点一块看是哪些单、大概多少人（老板 2026-10-30）。

// 跟人走的固定颜色，过了对比和色盲校验（scripts/validate_palette.js）。
// 有两个颜色贴着底色偏浅，所以右边永远有名字和数字，不只靠颜色认人。
const SLICE_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"]
const OTHER_COLOR = "#6250d6"
const UNASSIGNED_COLOR = "#b9b5b3"
const colorOf = (s: ShareSlice) => {
  if (s.key === UNASSIGNED_KEY) return UNASSIGNED_COLOR
  if (s.key === OTHER_KEY) return OTHER_COLOR
  return SLICE_COLORS[ROTATION.indexOf(s.label)] ?? OTHER_COLOR
}

const PIE_SIZE = 260
const PIE_R = 116
const SELECTED_OFFSET = 7

const heads = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
const pct = (ratio: number) => `${Math.round(ratio * 100)}%`
/** 只有 Blu/Gary/John 有目标。两周看时写还差多少，下周补谁一眼能看出来。 */
function targetText(s: ShareSlice, weeks: number) {
  const min = TARGET_MIN * weeks
  const max = TARGET_MAX * weeks
  if (s.target === "low") return `差 ${heads(min - s.heads)} 人到 ${min}`
  if (s.target === "high") return `超过 ${max}`
  return `在 ${min}–${max}`
}

/** "…, Lancaster, CA 93534" / "…, Los Angeles CA 90049" → 城市；只写了城市的原样给。 */
const cityOf = (address: string | null) => {
  if (!address) return ""
  return /,\s*([^,]+?),?\s+CA\b/i.exec(address)?.[1] ?? address
}

function slicePath(a0: number, a1: number) {
  const c = PIE_SIZE / 2
  const at = (a: number) => `${c + PIE_R * Math.cos(a)} ${c + PIE_R * Math.sin(a)}`
  return `M ${c} ${c} L ${at(a0)} A ${PIE_R} ${PIE_R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${at(a1)} Z`
}

function Pie({ slices, picked, onPick, onHover }: { slices: ShareSlice[]; picked: string | null; onPick: (key: string) => void; onHover: (key: string | null) => void }) {
  const c = PIE_SIZE / 2
  let a = -Math.PI / 2
  return (
    <svg viewBox={`0 0 ${PIE_SIZE} ${PIE_SIZE}`} role="img" aria-label="师傅份额饼图" style={{ width: "100%", maxWidth: PIE_SIZE, display: "block", margin: "0 auto", overflow: "visible" }}>
      {slices.map((s) => {
        const a0 = a
        a += s.ratio * Math.PI * 2
        const mid = (a0 + a) / 2
        const on = picked === s.key
        const shared = {
          role: "button",
          tabIndex: 0,
          "aria-label": `${s.label} ${heads(s.heads)} 人，占 ${pct(s.ratio)}`,
          "aria-pressed": on,
          fill: colorOf(s),
          stroke: "var(--color-bg)",
          strokeWidth: 2,
          opacity: picked && !on ? 0.45 : 1,
          style: { cursor: "pointer", transition: "transform 120ms ease, opacity 120ms ease", transform: on ? `translate(${Math.cos(mid) * SELECTED_OFFSET}px, ${Math.sin(mid) * SELECTED_OFFSET}px)` : undefined },
          onClick: () => onPick(s.key),
          onMouseEnter: () => onHover(s.key),
          onMouseLeave: () => onHover(null),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key !== "Enter" && e.key !== " ") return
            e.preventDefault()
            onPick(s.key)
          },
        }
        // 这周只有一块：一条弧画不出整圆。
        return slices.length === 1 ? <circle key={s.key} cx={c} cy={c} r={PIE_R} {...shared} /> : <path key={s.key} d={slicePath(a0, a)} {...shared} />
      })}
    </svg>
  )
}

function PartyRow({ p, showChef, onOpen }: { p: ShareParty; showChef: boolean; onOpen: (id: string) => void }) {
  const when = [`${md(p.date)} ${dowZh(p.date)}`, p.eventStart ? zhTime(p.eventStart) : ""].filter(Boolean).join(" ")
  return (
    <div className="wb-row" onClick={() => onOpen(p.orderId)} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderBottom: "1px solid var(--color-line)", fontSize: 14 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{p.customer || "（没有名字）"}</div>
        <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>{[when, cityOf(p.address), showChef ? p.chefName : null].filter(Boolean).join(" · ")}</div>
      </div>
      <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
        <div style={{ fontWeight: 600 }}>{heads(p.heads)} 人</div>
        {p.chefCount > 1 ? <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>全场 {heads(p.wholeHeads)} 人 · {p.chefCount} 位平分</div> : null}
      </div>
    </div>
  )
}

export function ChefShare({ chefs, orders, week, weekEnd, isMobile, onOpenOrder }: { chefs: ChefSummary[]; orders: OrderRow[]; week: string; weekEnd: string; isMobile: boolean; onOpenOrder: (id: string) => void }) {
  const [pickedKey, setPickedKey] = useState<string | null>(null)
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const [weeks, setWeeks] = useState<1 | 2>(1)
  // 最近两周 = 这一周连上一周。
  const from = weeks === 2 ? addDays(week, -7) : week
  const { slices, totalHeads, partyCount } = useMemo(() => weekShare(chefs, orders, from, weekEnd, weeks), [chefs, orders, from, weekEnd, weeks])
  // 换了一周，这个人这周可能没单：选中的那块跟着消失。
  const picked = slices.find((s) => s.key === pickedKey) ?? null
  const hovered = slices.find((s) => s.key === hoverKey) ?? null
  const pick = (key: string) => setPickedKey((cur) => (cur === key ? null : key))
  const caption = hovered ?? picked
  const rangeName = weeks === 2 ? "这两周" : "这周"
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex" }}>
          <Chip small active={weeks === 1} onClick={() => setWeeks(1)}>
            这一周
          </Chip>
          <Chip small active={weeks === 2} onClick={() => setWeeks(2)} style={{ marginLeft: -1 }}>
            最近两周
          </Chip>
        </div>
        <div style={{ fontSize: 15 }}>
          {weeks === 2 ? `${md(from)} – ${md(weekEnd)} ` : ""}
          {rangeName}共 <strong>{heads(totalHeads)}</strong> 人 · {partyCount} 单 <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>小孩算半个，帮手不算</span>
        </div>
      </div>
      {!slices.length ? <div style={{ fontSize: 14, color: "var(--color-neutral-600)", padding: "24px 0" }}>{rangeName}还没有单。</div> : null}
      {slices.length ? <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : `${PIE_SIZE + 24}px minmax(0, 1fr)`, gap: 24, alignItems: "center" }}>
        <div>
          <Pie slices={slices} picked={picked?.key ?? null} onPick={pick} onHover={setHoverKey} />
          <div style={{ textAlign: "center", fontSize: 13, marginTop: 10, minHeight: 18, color: caption ? undefined : "var(--color-neutral-600)" }}>{caption ? `${caption.label} · ${heads(caption.heads)} 人 · ${pct(caption.ratio)}` : "点一块看是哪些单"}</div>
        </div>
        <div>
          {slices.map((s) => (
            <div key={s.key} className="wb-row" onClick={() => pick(s.key)} style={{ display: "grid", gridTemplateColumns: "12px minmax(0, 1fr) auto auto", gap: 10, alignItems: "center", padding: "9px 0", borderBottom: "1px solid var(--color-line)", fontSize: 14, fontWeight: picked?.key === s.key ? 700 : 400 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: colorOf(s) }} />
              <span>
                {s.label}
                {s.target ? <span style={{ fontSize: 12, fontWeight: 400, color: "var(--color-neutral-600)", marginLeft: 8 }}>{targetText(s, weeks)}</span> : null}
              </span>
              <span style={{ whiteSpace: "nowrap" }}>
                {heads(s.heads)} 人 · {s.parties.length} 单
              </span>
              <strong style={{ minWidth: 42, textAlign: "right" }}>{pct(s.ratio)}</strong>
            </div>
          ))}
        </div>
      </div> : null}
      {picked ? (
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, paddingBottom: 6, borderBottom: "2px solid var(--color-text)" }}>
            {picked.label} {rangeName}的单 · {heads(picked.heads)} 人
          </div>
          {picked.parties.map((p) => (
            <PartyRow key={`${p.orderId}-${p.chefName ?? ""}`} p={p} showChef={picked.key === OTHER_KEY} onOpen={onOpenOrder} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
