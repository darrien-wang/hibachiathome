"use client"

import { useMemo, useState } from "react"
import { adminJson } from "./api"
import { Tag } from "./ui"
import { tell } from "./ask"
import type { OrderRow, OrderStaffingRow } from "./helpers"
import { MAX_CHEFS, type DispatchPlan, type LintIssue } from "@/lib/dispatch-plan"
import { lintOrderStaffing, orderPaidHeads, planForOrder } from "@/lib/dispatch-plan-order"

// 派工计划（老板 2026-10-17）：这一单几位师傅、几台灶、站位怎么摆，以及这个数是哪来的——
// 按人头的规则、老板定的、还是答应过客人的。Eileen 10-17 那单短信里答应了两台灶两个站位，
// 订单上 required_staff_count=1、备料单没备注，现场一台灶。计划放在订单上
// （orders.dispatch_plan，lib/dispatch-plan.ts），备料单、日地图和这里读的是同一份；
// lint 拿它对照派了几个人，派对 72 小时内差着就红。

const SOURCE_LABEL: Record<DispatchPlan["source"], string> = { rule: "按人头规则", owner: "老板定的", promise: "答应过客人" }

export function DispatchPlanPanel({
  adminKey,
  order,
  staffing,
  cooksFallback,
  viewerRole,
  onSaved,
}: {
  adminKey: string
  order: OrderRow
  staffing: { cooks: OrderStaffingRow[]; helpers: OrderStaffingRow[] } | null | undefined
  /** Cooks from the list payload while the detail is still loading. */
  cooksFallback: number
  viewerRole: "owner" | "agent" | null
  onSaved: () => Promise<void> | void
}) {
  const plan = useMemo(() => planForOrder(order), [order])
  const heads = orderPaidHeads(order)
  const cooks = staffing ? staffing.cooks.length : cooksFallback
  const helpers = staffing ? staffing.helpers.length : 0
  const lint: LintIssue[] = useMemo(() => lintOrderStaffing(order, { cooks, helpers }), [order, cooks, helpers])
  const [editing, setEditing] = useState(false)
  const [chefs, setChefs] = useState(String(plan.chefs))
  const [grills, setGrills] = useState(String(plan.grills))
  const [stations, setStations] = useState(plan.stations_note ?? "")
  const [busy, setBusy] = useState(false)
  const owner = viewerRole === "owner"

  const save = async (clear: boolean) => {
    setBusy(true)
    try {
      const body: Record<string, unknown> = { action: "set_dispatch_plan", order_id: order.id }
      if (clear) body.clear = true
      else {
        const c = Number(chefs)
        const g = Number(grills)
        if (!Number.isInteger(c) || c < 1 || c > MAX_CHEFS || !Number.isInteger(g) || g < 1 || g > MAX_CHEFS) throw new Error(`师傅和灶都填 1–${MAX_CHEFS}`)
        body.chefs = c
        body.grills = g
        body.stations_note = stations.trim()
      }
      const r = await adminJson<{ ok: boolean; error?: string }>(adminKey, "/api/admin/chefs", { body })
      if (!r.ok) throw new Error(r.error ?? "没存上")
      setEditing(false)
      await onSaved()
    } catch (e) {
      void tell({ title: "派工计划没存上", message: e instanceof Error ? e.message : "出错了" })
    } finally {
      setBusy(false)
    }
  }

  const promise = plan.promise ?? null
  const strong = plan.chefs > 1 || plan.grills > 1
  return (
    <div style={{ border: "1px solid var(--color-divider)", padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span>
          <span className="kicker" style={{ marginRight: 8 }}>派工计划</span>
          <strong style={{ fontSize: 15, color: strong ? "var(--color-accent-700)" : undefined }}>
            {plan.chefs} 位师傅 · {plan.grills} 台灶
          </strong>{" "}
          <Tag cls={plan.source === "rule" ? "tag-faint" : "tag-accent"}>{SOURCE_LABEL[plan.source]}</Tag>
          <span style={{ color: "var(--color-neutral-600)" }}> · {heads} 个付费人头</span>
        </span>
        {owner ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing((v) => !v)}>
            {editing ? "收起" : "改计划"}
          </button>
        ) : null}
      </div>
      {plan.stations_note ? <div>站位：{plan.stations_note}</div> : null}
      {promise ? (
        <div style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
          答应过客人 {promise.chefs} 位师傅 / {promise.grills} 台灶（{promise.at.slice(0, 10)}
          {promise.via === "email" ? " 邮件" : " 短信"}）：“{promise.text.slice(0, 160)}
          {promise.text.length > 160 ? "…" : ""}”
        </div>
      ) : null}
      {lint.map((x) => (
        <div key={x.code} className={x.severity === "blocking" ? "notice danger" : "notice"} style={{ fontSize: 12.5 }}>
          {x.messageZh}
          {x.severity === "blocking" ? "（派对 72 小时内：发备料单会被拦下）" : ""}
        </div>
      ))}
      {editing ? (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", paddingTop: 4 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
            师傅
            <input className="input" type="number" min={1} max={MAX_CHEFS} value={chefs} onChange={(e) => setChefs(e.target.value)} style={{ width: 64, padding: "4px 6px" }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12 }}>
            灶
            <input className="input" type="number" min={1} max={MAX_CHEFS} value={grills} onChange={(e) => setGrills(e.target.value)} style={{ width: 64, padding: "4px 6px" }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 2, fontSize: 12, flex: 1, minWidth: 220 }}>
            站位（印在备料单上）
            <input className="input" value={stations} onChange={(e) => setStations(e.target.value)} placeholder="two U shapes, each chef at an open end, by the pool" style={{ padding: "4px 8px" }} maxLength={200} />
          </label>
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void save(false)}>
            {busy ? "保存中…" : "保存"}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void save(true)} title="回到按人头的规则（28 人一位师傅一台灶）">
            按规则
          </button>
        </div>
      ) : null}
    </div>
  )
}
