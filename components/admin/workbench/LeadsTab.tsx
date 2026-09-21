"use client"

import { useMemo, useState } from "react"
import { adminJson } from "./api"
import { Cell, Chip, Dialog, DialogHead, Field, PhoneIcon, Tag } from "./ui"
import {
  displayName,
  firstRespText,
  isTestLead,
  LEAD_DOT,
  LEAD_STATUS_LABELS,
  LEAD_TAG_CLASS,
  leadIsAds,
  leadKeyword,
  leadUnreplied,
  md,
  prettyPhone,
  ptDateOf,
  relativeTime,
  type LeadRow,
  type LeadStats,
} from "./helpers"
import type { WorkbenchSettings } from "@/lib/workbench-settings-shared"
import { PlannerPill, type PlannerLive } from "./planner-live"

// 线索 · 客服. Won leads are orders now and live on the 订单 tab; 无效
// (spam/tests) stays out of 全部 so the list is the work queue, not a log.

type Filter = "all" | "unreplied" | "new" | "qualified" | "lost" | "won" | "disqualified"
const FILTERS: Array<[Filter, string]> = [
  ["all", "全部"],
  ["unreplied", "等回复"],
  ["new", "待联系"],
  ["qualified", "跟进中"],
  ["lost", "流失"],
  ["won", "已成单"],
  ["disqualified", "无效"],
]
const MANUAL_CHANNELS = [
  ["phone", "电话"],
  ["sms", "短信"],
  ["facebook", "Facebook"],
  ["instagram", "Instagram"],
  ["wechat", "微信"],
  ["walk_in", "当面"],
  ["referral", "转介绍"],
  ["other", "其他"],
] as const

export function LeadsTab({
  adminKey,
  leads,
  stats,
  settings,
  viewerRole,
  isMobile,
  since,
  planner,
  onClearSince,
  onOpenLead,
  onOpenOrder,
  onCall,
  onChanged,
}: {
  adminKey: string
  leads: LeadRow[]
  stats: LeadStats | null
  settings: WorkbenchSettings
  viewerRole: "owner" | "agent" | null
  isMobile: boolean
  planner: PlannerLive
  onOpenOrder: (id: string) => void
  /** From the board: only leads received on/after this Pacific date. */
  since: string | null
  onClearSince: () => void
  onOpenLead: (id: string) => void
  onCall: (phone: string) => void
  onChanged: () => Promise<void> | void
}) {
  const [filter, setFilter] = useState<Filter>("all")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showAdd, setShowAdd] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const now = Date.now()
  const sla = settings.targets.first_response_sla_minutes

  const scoped = useMemo(() => (since ? leads.filter((l) => ptDateOf(l.created_at) >= since) : leads), [leads, since])
  const matches = (l: LeadRow, f: Filter) => {
    if (f === "all") return l.status !== "won" && l.status !== "disqualified"
    if (f === "unreplied") return leadUnreplied(l)
    return l.status === f
  }
  const counts = useMemo(() => Object.fromEntries(FILTERS.map(([k]) => [k, scoped.filter((l) => matches(l, k)).length])) as Record<Filter, number>, [scoped])
  const rows = useMemo(
    () =>
      scoped
        .filter((l) => matches(l, filter))
        .sort((a, b) => Number(leadUnreplied(b)) - Number(leadUnreplied(a)) || Date.parse(b.last_seen_at ?? b.created_at) - Date.parse(a.last_seen_at ?? a.created_at)),
    [scoped, filter],
  )
  const unrepliedCount = leads.filter(leadUnreplied).length
  const newCount = leads.filter((l) => l.status === "new").length
  const weekSunday = (() => {
    const t = ptDateOf(now)
    const d = new Date(t + "T00:00:00Z")
    d.setUTCDate(d.getUTCDate() - d.getUTCDay())
    return d.toISOString().slice(0, 10)
  })()
  const wonThisWeek = leads.filter((l) => l.status === "won" && ptDateOf(l.last_seen_at ?? l.created_at) >= weekSunday).length

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const bulk = async (action: "bulk_status" | "merge", status?: string) => {
    if (selected.size === 0) return
    if (action === "merge" && !window.confirm(`把这 ${selected.size} 条合并成同一个人？最早的一条保留，其余并入。`)) return
    setBulkBusy(true)
    try {
      await adminJson(adminKey, "/api/admin/leads", { method: "PATCH", body: { action, leadIds: Array.from(selected), status } })
      setSelected(new Set())
      await onChanged()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "操作失败")
    } finally {
      setBulkBusy(false)
    }
  }

  // "最后一条": who said it decides the colour. Red only when the customer is
  // actually waiting on us (Twilio thread + timeline agree); the robot's
  // quote is ours, shown neutral with a nudge if nobody followed up.
  const lastLine = (l: LeadRow) => {
    const un = leadUnreplied(l)
    const speaker = l.last_speaker ?? (un ? "customer" : l.last_outbound_at ? "us" : null)
    const text = (l.last_preview ?? l.latest_message ?? "").replace(/\s+/g, " ").trim()
    const prefix = speaker === "customer" ? "客人：" : speaker === "auto" ? "自动报价：" : speaker === "us" ? "我方：" : ""
    const suffix = speaker === "auto" && l.needs_followup ? " · 还没人工跟进" : ""
    return { text: text || "（还没有留言）", color: un ? "var(--color-accent-700)" : "var(--color-neutral-700)", weight: un ? 600 : 400, prefix, suffix }
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="wb-grid" style={{ gridTemplateColumns: isMobile ? "repeat(2, minmax(0,1fr))" : "repeat(4, minmax(0,1fr))" }}>
        <Cell label="今日询盘" value={stats?.today_leads ?? "—"} />
        <Cell label="客人等回复" value={unrepliedCount} color={unrepliedCount > 0 ? "var(--color-accent)" : undefined} onClick={() => setFilter("unreplied")} />
        <Cell label="待联系" value={newCount} onClick={() => setFilter("new")} />
        <Cell
          label={`7 天平均首响 · 目标 ≤ ${sla} 分`}
          value={
            stats?.avg_response_minutes_7d != null ? (
              <>
                {stats.avg_response_minutes_7d} <span style={{ fontSize: 14, fontWeight: 400 }}>分</span>
              </>
            ) : (
              "—"
            )
          }
          color={stats?.avg_response_minutes_7d != null && stats.avg_response_minutes_7d > sla ? "var(--color-accent-700)" : undefined}
          sub={stats ? `${stats.responded_count_7d}/${stats.leads_7d} 已响应 · 5 分钟内 ${stats.within_5min_rate_7d ?? 0}%` : undefined}
        />
      </div>


      <div style={{ display: "flex", gap: 8, alignItems: "center", overflowX: "auto", paddingBottom: 2 }}>
        {FILTERS.map(([k, label]) => (
          <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>
            {label} <span style={{ opacity: 0.6 }}>{counts[k]}</span>
          </Chip>
        ))}
        {since ? (
          <Chip active onClick={onClearSince} title="来自看板的日期范围，点一下清除">
            自 {md(since)} 起 ×
          </Chip>
        ) : null}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-neutral-600)", whiteSpace: "nowrap" }}>本周 {wonThisWeek} 条付押金 → 已转入订单</span>
        <button type="button" className="btn btn-secondary" style={{ whiteSpace: "nowrap" }} onClick={() => setShowAdd(true)}>
          + 手动添加
        </button>
      </div>

      {rows.length === 0 ? <div className="empty">这一栏没有线索。</div> : null}

      {!isMobile ? (
        <table className="table">
          <thead>
            <tr style={{ whiteSpace: "nowrap" }}>
              <th style={{ width: 28 }}></th>
              <th>客户</th>
              <th>状态 · 来源</th>
              <th>城市 · 人数</th>
              <th>最后一条</th>
              <th className="r">首响</th>
              <th className="r">收到</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const last = lastLine(l)
              const resp = firstRespText(l.response_seconds, sla)
              return (
                <tr key={l.id} className="wb-row" onClick={() => onOpenLead(l.id)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} style={{ accentColor: "var(--color-accent)" }} aria-label="选择" />
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ display: "inline-block", width: 8, height: 8, background: LEAD_DOT[l.status] ?? "var(--color-neutral-400)", flex: "none" }} />
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {displayName(l.full_name, l.phone)}
                          {isTestLead(l) ? <span className="tag tag-faint" style={{ marginLeft: 6 }}>测试</span> : null}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>{prettyPhone(l.phone)}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Tag cls={LEAD_TAG_CLASS[l.status] ?? "tag-neutral"}>{LEAD_STATUS_LABELS[l.status] ?? l.status}</Tag>
                    <div style={{ fontSize: 11, color: "var(--color-neutral-600)", marginTop: 4, maxWidth: 200 }} className="clamp1">
                      {leadIsAds(l) ? "广告 · " : ""}
                      {leadKeyword(l)}
                    </div>
                    <PlannerPill s={planner.byLead[l.id]} project={planner.clarityProject} compact style={{ marginTop: 3 }} />
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {l.city_or_zip ?? "—"} <span style={{ color: "var(--color-neutral-600)" }}>· {l.guest_count ?? "?"} 人</span>
                    {l.event_hint ? <div style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>想订 {md(l.event_hint)}</div> : null}
                  </td>
                  <td style={{ maxWidth: 0, width: "36%" }}>
                    <div className="clamp1" style={{ color: last.color, fontWeight: last.weight }}>
                      {last.prefix}
                      {last.text}
                      {last.suffix ? <span style={{ color: "var(--color-accent-700)", fontWeight: 600 }}>{last.suffix}</span> : null}
                    </div>
                  </td>
                  <td className="r" style={{ color: resp.late ? "var(--color-accent-700)" : undefined, whiteSpace: "nowrap" }}>
                    {resp.text}
                  </td>
                  <td className="r" style={{ color: "var(--color-neutral-600)", whiteSpace: "nowrap" }}>
                    {relativeTime(l.created_at, now)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          {rows.map((l) => {
            const last = lastLine(l)
            const resp = firstRespText(l.response_seconds, sla)
            return (
              <article key={l.id} className="card wb-row" onClick={() => onOpenLead(l.id)} style={{ gap: 10, padding: 14, borderTop: `3px solid ${LEAD_DOT[l.status] ?? "var(--color-neutral-400)"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 17, lineHeight: 1.2 }}>{displayName(l.full_name, l.phone)}</div>
                    <div style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>{prettyPhone(l.phone)}</div>
                  </div>
                  <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <PlannerPill s={planner.byLead[l.id]} project={planner.clarityProject} compact />
                    <Tag cls={LEAD_TAG_CLASS[l.status] ?? "tag-neutral"}>{LEAD_STATUS_LABELS[l.status] ?? l.status}</Tag>
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>
                  {l.city_or_zip ?? "—"} · {l.guest_count ?? "?"} 人 · <span style={{ color: "var(--color-neutral-600)" }}>{leadKeyword(l)}</span>
                  {l.event_hint ? ` · 想订 ${md(l.event_hint)}` : ""}
                </div>
                <div className="clamp2" style={{ fontSize: 13, lineHeight: 1.45, color: last.color, fontWeight: last.weight }}>
                  {last.prefix}
                  {last.text}
                  {last.suffix ? <span style={{ color: "var(--color-accent-700)", fontWeight: 600 }}>{last.suffix}</span> : null}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "var(--color-neutral-600)", borderTop: "1px solid var(--color-line)", paddingTop: 8 }}>
                  <span>
                    {relativeTime(l.created_at, now)} · 首响 <span style={{ color: resp.late ? "var(--color-accent-700)" : undefined }}>{resp.text}</span>
                  </span>
                  {l.phone ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        onCall(l.phone!)
                      }}
                      aria-label="打电话"
                    >
                      {PhoneIcon}
                    </button>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {selected.size > 0 ? (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: isMobile ? 56 : 0, zIndex: 30, display: "flex", gap: 8, alignItems: "center", padding: "10px 16px", background: "var(--color-text)", color: "var(--color-bg)" }}>
          <strong>已选 {selected.size} 条</strong>
          {viewerRole === "owner" ? (
            <>
              <button type="button" className="btn btn-secondary btn-sm" style={{ color: "var(--color-bg)", borderColor: "var(--color-bg)" }} disabled={bulkBusy} onClick={() => void bulk("bulk_status", "disqualified")}>
                标无效
              </button>
              <button type="button" className="btn btn-secondary btn-sm" style={{ color: "var(--color-bg)", borderColor: "var(--color-bg)" }} disabled={bulkBusy} onClick={() => void bulk("bulk_status", "lost")}>
                标流失
              </button>
            </>
          ) : null}
          <button type="button" className="btn btn-secondary btn-sm" style={{ color: "var(--color-bg)", borderColor: "var(--color-bg)" }} disabled={bulkBusy || selected.size < 2} onClick={() => void bulk("merge")}>
            合并为同一人
          </button>
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: "auto", color: "var(--color-bg)" }} onClick={() => setSelected(new Set())}>
            取消
          </button>
        </div>
      ) : null}

      {showAdd ? (
        <AddLeadDialog
          adminKey={adminKey}
          onClose={() => setShowAdd(false)}
          onDone={async (id) => {
            setShowAdd(false)
            await onChanged()
            onOpenLead(id)
          }}
        />
      ) : null}
    </section>
  )
}

function AddLeadDialog({ adminKey, onClose, onDone }: { adminKey: string; onClose: () => void; onDone: (leadId: string) => void }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", channel: "phone", message: "", adRef: "" })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const submit = async () => {
    if (!form.name.trim() && !form.phone.trim()) {
      setMsg("姓名或手机至少填一个")
      return
    }
    setBusy(true)
    try {
      const d = await adminJson<{ ok: boolean; leadId?: string; deduped?: boolean; error?: string }>(adminKey, "/api/admin/leads", {
        body: { name: form.name.trim() || undefined, phone: form.phone.trim() || undefined, email: form.email.trim() || undefined, channel: form.channel, message: form.message.trim() || undefined, adRef: form.adRef.trim() || undefined },
      })
      if (d.ok && d.leadId) onDone(d.leadId)
      else setMsg(d.error ?? "添加失败")
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "添加失败")
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog onClose={onClose} width={520}>
      <DialogHead title="手动添加线索" lines={["电话、当面、Marketplace 来的客人记在这里；同一手机 180 天内自动并入已有线索。"]} onClose={onClose} />
      <div className="dialog-col" style={{ gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="姓名">
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="手机">
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="邮箱">
            <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="来源">
            <select className="input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
              {MANUAL_CHANNELS.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="客人说了什么">
          <textarea className="input" rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        </Field>
        <Field label="广告码（短信里的 AD 码，可选）">
          <input className="input" value={form.adRef} onChange={(e) => setForm({ ...form, adRef: e.target.value })} placeholder="如 AD12" />
        </Field>
        {msg ? <div className="notice danger">{msg}</div> : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void submit()}>
            {busy ? "添加中…" : "添加"}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
