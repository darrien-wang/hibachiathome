"use client"

import { useMemo, useState } from "react"
import { Chip, Tag } from "./ui"
import { displayName, dowZh, eventParts, inDaysLabel, md, money, prettyPhone, ptToday, stageOf, STAGE_TAG_CLASS, type OrderRow, type Stage, type UpdateRequest } from "./helpers"
import type { AssignmentMap } from "./chef-types"
import { PlannerPill, type PlannerLive } from "./planner-live"
import { PrepDialog } from "./PrepDialog"

// 订单 · 售后. One row per order; "有修改" surfaces the ones the customer
// changed in the planner and nobody has looked at yet.

export type OrderFilter = "upcoming" | "changed" | "待细节" | "本周执行" | "待尾款" | "已办完" | "已取消" | "all"
const FILTERS: Array<[OrderFilter, string]> = [
  ["upcoming", "即将执行"],
  ["changed", "有修改"],
  ["待细节", "待细节"],
  ["本周执行", "本周执行"],
  ["待尾款", "待尾款"],
  ["已办完", "已办完"],
  ["已取消", "已取消"],
  ["all", "全部"],
]
const OPEN_REQUEST = new Set(["received", "confirmed_in_progress"])

export function changedOrderIds(pending: UpdateRequest[], orders: OrderRow[]): Set<string> {
  const ids = new Set<string>()
  for (const r of pending) {
    if (!OPEN_REQUEST.has(r.status)) continue
    if (r.order_id) ids.add(r.order_id)
    else if (r.external_order_id) {
      const o = orders.find((x) => x.source_ref === r.external_order_id)
      if (o) ids.add(o.id)
    }
  }
  return ids
}

export function OrdersTab({
  adminKey,
  viewerRole,
  orders,
  pendingUpdates,
  assignments,
  planner,
  isMobile,
  initialFilter,
  onOpenOrder,
}: {
  adminKey: string
  viewerRole: "owner" | "agent" | null
  orders: OrderRow[]
  pendingUpdates: UpdateRequest[]
  assignments: AssignmentMap
  planner: PlannerLive
  isMobile: boolean
  initialFilter?: OrderFilter | null
  onOpenOrder: (id: string) => void
}) {
  const [prepOpen, setPrepOpen] = useState(false)
  const chefLine = (id: string) => {
    const team = assignments[id] ?? []
    return team.length ? { text: `师傅 ${team.map((a) => a.name).join(" + ")}`, color: "var(--color-neutral-600)" } : { text: "师傅 未派", color: "var(--color-accent-700)" }
  }
  const [filter, setFilter] = useState<OrderFilter>(initialFilter ?? "upcoming")
  // 排序：活动时间（默认升序，最近的派对在最上面）或下单时间；点表头切换升降。
  const [sortKey, setSortKey] = useState<"event" | "created">("event")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const now = Date.now()
  const today = ptToday()
  const changed = useMemo(() => changedOrderIds(pendingUpdates, orders), [pendingUpdates, orders])

  const rowsAll = useMemo(
    () =>
      orders.map((o) => {
        const ev = eventParts(o.event_start)
        return { o, ev, stage: stageOf(o, now) as Stage, changed: changed.has(o.id) }
      }),
    [orders, now, changed],
  )
  const match = (r: (typeof rowsAll)[number], f: OrderFilter) => {
    if (f === "all") return true
    if (f === "upcoming") return !!r.ev && r.ev.ymd >= today && r.stage !== "已取消"
    if (f === "changed") return r.changed
    return r.stage === f
  }
  const counts = Object.fromEntries(FILTERS.map(([k]) => [k, rowsAll.filter((r) => match(r, k)).length])) as Record<OrderFilter, number>
  const liveOf = (id: string) => planner.byOrder[id]
  const dirSign = sortDir === "asc" ? 1 : -1
  const rows = rowsAll
    .filter((r) => match(r, filter))
    .sort((a, b) => {
      if (sortKey === "created") return dirSign * (Date.parse(a.o.created_at) - Date.parse(b.o.created_at))
      const am = a.ev?.ms ?? Number.MAX_SAFE_INTEGER
      const bm = b.ev?.ms ?? Number.MAX_SAFE_INTEGER
      return dirSign * (am - bm)
    })
  const toggleSort = (key: "event" | "created") => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc")
    else {
      setSortKey(key)
      setSortDir(key === "event" ? "asc" : "desc")
    }
  }
  const arrow = (key: "event" | "created") => (sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "")

  const plannerLine = (r: (typeof rowsAll)[number]) =>
    r.changed ? { text: "客人改了，未核对", color: "var(--color-accent-700)" } : r.o.details_status !== "complete" ? { text: "Planner 未填", color: "var(--color-accent-700)" } : { text: "细节已填", color: "var(--color-neutral-600)" }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", overflowX: "auto", paddingBottom: 2 }}>
        {FILTERS.map(([k, label]) => (
          <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>
            {label} <span style={{ opacity: 0.6 }}>{counts[k]}</span>
          </Chip>
        ))}
        <button type="button" className="btn btn-secondary btn-sm" style={{ flex: "none" }} onClick={() => setPrepOpen(true)}>
          备料采购
        </button>
        <span style={{ marginLeft: "auto", display: "flex", gap: 0, alignItems: "center", flex: "none" }}>
          <span style={{ fontSize: 12, color: "var(--color-neutral-600)", marginRight: 8, whiteSpace: "nowrap" }}>排序</span>
          <Chip small active={sortKey === "event"} onClick={() => toggleSort("event")} title="点一下切换升降">
            活动时间{arrow("event")}
          </Chip>
          <Chip small active={sortKey === "created"} onClick={() => toggleSort("created")} style={{ marginLeft: -1 }} title="点一下切换升降">
            下单时间{arrow("created")}
          </Chip>
        </span>
      </div>
      {rows.length === 0 ? <div className="empty">这一栏没有订单。</div> : null}
      {!isMobile ? (
        <table className="table">
          <thead>
            <tr style={{ whiteSpace: "nowrap" }}>
              <th style={{ cursor: "pointer" }} onClick={() => toggleSort("event")} title="按活动时间排序，再点切换升降">
                活动时间{arrow("event")}
              </th>
              <th>客户</th>
              <th>地址</th>
              <th className="r">人数</th>
              <th className="r">总报价</th>
              <th className="r">尾款</th>
              <th>状态</th>
              <th style={{ cursor: "pointer" }} onClick={() => toggleSort("created")} title="按下单时间排序，再点切换升降">
                单号{arrow("created")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pl = plannerLine(r)
              const guests = (r.o.guest_adult_count ?? 0) + (r.o.guest_child_count ?? 0)
              return (
                <tr key={r.o.id} className="wb-row" onClick={() => onOpenOrder(r.o.id)}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div style={{ fontWeight: 600 }}>
                      {r.ev ? md(r.ev.ymd) : "—"} <span style={{ color: "var(--color-neutral-600)", fontWeight: 400 }}>{r.ev ? dowZh(r.ev.ymd) : ""}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>{r.ev ? `${r.ev.hm} · ${inDaysLabel(r.ev.ymd, today)}` : ""}</div>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div style={{ fontWeight: 600 }}>{displayName(r.o.customer_name, r.o.customer_phone)}</div>
                    <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>{prettyPhone(r.o.customer_phone)}</div>
                  </td>
                  <td style={{ maxWidth: 0, width: "28%" }}>
                    <div className="clamp1">{r.o.event_address ?? "—"}</div>
                    {r.stage !== "已取消" && r.stage !== "已办完" ? (
                      <div className="clamp1" style={{ fontSize: 11, color: chefLine(r.o.id).color }}>
                        {chefLine(r.o.id).text}
                      </div>
                    ) : null}
                  </td>
                  <td className="r" style={{ whiteSpace: "nowrap" }}>
                    {guests || "—"}
                  </td>
                  <td className="r" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                    {money(r.o.quoted_total_cents)}
                  </td>
                  <td className="r" style={{ whiteSpace: "nowrap", color: r.stage === "待尾款" ? "var(--color-accent-700)" : undefined }}>
                    {r.o.balance_due_cents && r.o.balance_due_cents > 0 ? money(r.o.balance_due_cents) : "—"}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Tag cls={STAGE_TAG_CLASS[r.stage]}>{r.stage}</Tag>
                    {r.changed ? (
                      <Tag cls="tag-outline" style={{ marginLeft: 4 }}>
                        Planner 改了
                      </Tag>
                    ) : null}
                    <div style={{ fontSize: 11, marginTop: 4, color: pl.color }}>{pl.text}</div>
                    <PlannerPill s={liveOf(r.o.id)} project={planner.clarityProject} compact style={{ marginTop: 3 }} />
                  </td>
                  <td className="mono" style={{ fontSize: 11, color: "var(--color-neutral-600)", whiteSpace: "nowrap" }}>
                    {r.o.order_no}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          {rows.map((r) => {
            const pl = plannerLine(r)
            const guests = (r.o.guest_adult_count ?? 0) + (r.o.guest_child_count ?? 0)
            return (
              <article key={r.o.id} className="card wb-row" onClick={() => onOpenOrder(r.o.id)} style={{ gap: 8, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 17, lineHeight: 1.2 }}>
                    {r.ev ? `${md(r.ev.ymd)} ${dowZh(r.ev.ymd)}` : "日期未定"} <span style={{ fontWeight: 400, fontSize: 14 }}>{r.ev?.hm}</span>
                  </div>
                  <span style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
                    <PlannerPill s={liveOf(r.o.id)} project={planner.clarityProject} compact />
                    <Tag cls={STAGE_TAG_CLASS[r.stage]}>{r.stage}</Tag>
                    {r.changed ? <Tag cls="tag-outline">Planner 改了</Tag> : null}
                  </span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>
                  {displayName(r.o.customer_name, r.o.customer_phone)} <span style={{ fontWeight: 400, color: "var(--color-neutral-700)", fontSize: 13 }}>· {prettyPhone(r.o.customer_phone)}</span>
                </div>
                <div style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>{r.o.event_address ?? "—"}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderTop: "1px solid var(--color-line)", paddingTop: 8 }}>
                  <span>
                    {guests || "—"} 人 · <strong>{money(r.o.quoted_total_cents)}</strong>
                  </span>
                  <span style={{ color: r.stage === "待尾款" ? "var(--color-accent-700)" : undefined }}>尾款 {r.o.balance_due_cents && r.o.balance_due_cents > 0 ? money(r.o.balance_due_cents) : "—"}</span>
                </div>
                <div style={{ fontSize: 12, color: pl.color }}>
                  {pl.text} · {r.ev ? inDaysLabel(r.ev.ymd, today) : ""}
                </div>
                {r.stage !== "已取消" && r.stage !== "已办完" ? <div style={{ fontSize: 12, color: chefLine(r.o.id).color }}>{chefLine(r.o.id).text}</div> : null}
              </article>
            )
          })}
        </div>
      )}
      {prepOpen ? <PrepDialog adminKey={adminKey} owner={viewerRole === "owner"} onClose={() => setPrepOpen(false)} onOpenOrder={(id) => { setPrepOpen(false); onOpenOrder(id) }} /> : null}
    </section>
  )
}
