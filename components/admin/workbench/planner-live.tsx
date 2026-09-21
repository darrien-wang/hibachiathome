"use client"

import { Fragment, useEffect, useMemo, useState, type CSSProperties } from "react"
import { adminJson } from "./api"
import { Chip } from "./ui"
import { copyText, displayName, isPlaceholderName, md, prettyPhone, stamp } from "./helpers"

// Planner 实时：who is in the party planner, right now and lately. Shapes
// mirror app/api/admin/planner-live/route.ts.

export type PlannerSession = {
  sid: string
  shortId: string
  state: "live" | "just_left" | "recent" | "earlier"
  role: "host" | "guest" | "anonymous" | "staff"
  firstAt: string
  lastAt: string
  minutesAgo: number
  events: number
  lastEvent: string
  entry: string | null
  steps: Array<{ event: string; at: string; sheet?: string }>
  guests: number | null
  picked: number | null
  joined: number | null
  secs: number | null
  phase: string | null
  identified: boolean
  edited: boolean
  keyId: string | null
  planId: string | null
  shareId: string | null
  leadId: string | null
  orderId: string | null
  leadName: string | null
  leadPhone: string | null
  orderNo: string | null
  customerName: string | null
  eventDate: string | null
  hostName: string | null
  othersOnPlan: number
  device: string | null
  city: string | null
  ip: string | null
  claritySession: string | null
  clarityUser: string | null
  utmSource: string | null
}

export type PlannerLive = {
  sessions: PlannerSession[]
  byOrder: Record<string, PlannerSession>
  byLead: Record<string, PlannerSession>
  liveCount: number
  recentCount: number
  anonymousLive: number
  clarityProject: string
  fetchedAt: number
}

export const EMPTY_PLANNER_LIVE: PlannerLive = { sessions: [], byOrder: {}, byLead: {}, liveCount: 0, recentCount: 0, anonymousLive: 0, clarityProject: "y9dgbtwodj", fetchedAt: 0 }

export const ENTRY_LABELS: Record<string, string> = { key: "私链", known: "认识的", share: "客人分享", cold: "冷入口", returning: "回访", staff: "员工" }
export const ROLE_LABELS: Record<PlannerSession["role"], string> = { host: "本人", guest: "客人", anonymous: "匿名", staff: "员工" }
export const STEP_LABELS: Record<string, string> = {
  planner_open: "打开 planner",
  first_edit: "开始布置",
  tour_done: "看完引导",
  sheet_open: "打开面板",
  confirm_open: "看确认页",
  submitted: "提交了",
  share_done: "分享给客人",
  invite_open: "打开邀请",
  seat_claimed: "认领座位",
  claim_shown: "看到认领",
  claim_dismissed: "关掉认领",
  claim_lost: "座位被抢",
  unlock_open: "打开留资卡",
  unlock_submit: "提交留资",
  unlock_dismiss: "关掉留资卡",
  lead_captured: "留资成功",
  find_party_open: "找派对",
  find_party_submit: "找派对提交",
  feedback_open: "打开反馈",
  feedback_sent: "发了反馈",
  blocked_tap: "点了没反应",
  error_shown: "看到报错",
  client_error: "前端报错",
  rsvp_declined: "婉拒了",
  guest_plan_own: "客人另开派对",
  perms_changed: "改了权限",
  new_party: "开新派对",
  leave: "离开",
}
export const SHEET_LABELS: Record<string, string> = { tour: "引导", confirm: "确认", share: "分享", menu: "选菜", guest_menu: "客人选菜", tables: "桌子", unlock: "留资", feedback: "反馈", invite: "邀请", extras: "加购", find: "找派对" }

export function stepLabel(s: { event: string; sheet?: string }): string {
  const base = STEP_LABELS[s.event] ?? s.event
  return s.event === "sheet_open" && s.sheet ? `${base}：${SHEET_LABELS[s.sheet] ?? s.sheet}` : base
}

export function plannerStateText(s: PlannerSession): string {
  if (s.state === "live") return "正在操作 Planner"
  if (s.state === "just_left") return `刚离开 Planner · ${s.minutesAgo} 分钟前`
  if (s.state === "recent") return `Planner ${s.minutesAgo} 分钟前动过`
  const h = Math.round(s.minutesAgo / 60)
  return `Planner ${h < 48 ? `${h} 小时前` : `${Math.round(h / 24)} 天前`}动过`
}

/** "Christine Toy · 本人" / "Christine Toy 分享的客人 #a2lgq0" / "匿名 · iPhone · Riverside, CA · #e99hy9". */
export function sessionWho(s: PlannerSession): { main: string; sub: string; anonymous: boolean } {
  const name = !isPlaceholderName(s.customerName) ? s.customerName! : s.leadName || s.leadPhone ? displayName(s.leadName, s.leadPhone) : null
  const tag = [s.device, s.city].filter(Boolean).join(" · ")
  if (s.role === "staff") return { main: "员工查看", sub: tag, anonymous: false }
  if (s.role === "guest") return { main: `${s.hostName ?? name ?? "某派对"} 分享的客人`, sub: `#${s.shortId}${tag ? ` · ${tag}` : ""}`, anonymous: false }
  if (s.role === "host" && name) return { main: `${name} · 本人`, sub: tag, anonymous: false }
  if (s.role === "host") return { main: "私链访客 · 没对上订单", sub: `#${s.shortId}${tag ? ` · ${tag}` : ""}`, anonymous: true }
  return { main: `匿名${s.identified ? "（填过联系方式）" : ""}`, sub: `#${s.shortId}${tag ? ` · ${tag}` : ""}`, anonymous: true }
}

/**
 * Where to look in Clarity. Clarity never hands the page its own session id
 * (identify() only echoes the custom ids back), so there is no direct player
 * link; the planner identifies the recording with the device id, and the
 * recordings page filters on it: Filters → Custom user ID → paste.
 */
export function clarityUrl(s: PlannerSession, project: string): { url: string; direct: boolean } {
  if (s.claritySession && s.clarityUser) return { url: `https://clarity.microsoft.com/player/${project}/${s.clarityUser}/${s.claritySession}`, direct: true }
  return { url: `https://clarity.microsoft.com/projects/view/${project}/recordings`, direct: false }
}
export const CLARITY_HINT = "已复制设备号。Clarity 里 Filters → Custom user ID 粘贴，就是这个人的录像。"

function ClarityLink({ s, project, asButton }: { s: PlannerSession; project: string; asButton?: boolean }) {
  const c = clarityUrl(s, project)
  return (
    <a
      href={c.url}
      target="_blank"
      rel="noreferrer"
      className={asButton ? "btn btn-secondary btn-sm" : undefined}
      onClick={(e) => {
        e.stopPropagation()
        if (!c.direct) copyText(s.sid)
      }}
      title={c.direct ? "打开这段录像" : `${CLARITY_HINT}（${s.sid}）`}
      style={asButton ? undefined : { fontWeight: 400 }}
    >
      Clarity ↗
    </a>
  )
}

/** Small inline pill: pulsing dot when live, grey text otherwise. */
export function PlannerPill({ s, project, style, compact }: { s: PlannerSession | undefined; project: string; style?: CSSProperties; compact?: boolean }) {
  if (!s || s.state === "earlier") return null
  const live = s.state === "live"
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: live ? "var(--color-accent-700)" : "var(--color-neutral-600)", whiteSpace: "nowrap", ...style }}>
      <span className={live ? "wb-live" : "wb-live wb-live-off"} aria-hidden="true" />
      {compact ? (live ? "Planner 中" : `Planner ${s.minutesAgo} 分前`) : plannerStateText(s)}
      {!compact ? <ClarityLink s={s} project={project} /> : null}
    </span>
  )
}

function progress(s: PlannerSession): string {
  const bits: string[] = []
  if (s.guests != null) bits.push(`${s.guests} 人${s.picked != null ? ` · 选菜 ${s.picked}/${s.guests}` : ""}`)
  if (s.joined) bits.push(`${s.joined} 位客人加入`)
  if (s.othersOnPlan) bits.push(`同派对另 ${s.othersOnPlan} 台设备`)
  return bits.join(" · ")
}

// ---------------------------------------------------------------- the tab

type Filter = "all" | "live" | "hour" | "host" | "guest" | "anonymous"
const FILTERS: Array<[Filter, string]> = [
  ["all", "全部"],
  ["live", "正在动"],
  ["hour", "最近一小时"],
  ["host", "本人"],
  ["guest", "客人"],
  ["anonymous", "匿名"],
]

export function PlannerTab({ adminKey, live, isMobile, onOpenLead, onOpenOrder }: { adminKey: string; live: PlannerLive; isMobile: boolean; onOpenLead: (id: string) => void; onOpenOrder: (id: string) => void }) {
  const [hours, setHours] = useState<24 | 168>(24)
  const [week, setWeek] = useState<PlannerLive | null>(null)
  const [filter, setFilter] = useState<Filter>("all")
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => {
    if (hours !== 168) return
    let alive = true
    const load = async () => {
      try {
        const d = await adminJson<Omit<PlannerLive, "fetchedAt">>(adminKey, "/api/admin/planner-live?hours=168")
        if (alive) setWeek({ ...d, fetchedAt: Date.now() })
      } catch {}
    }
    void load()
    const t = setInterval(() => void load(), 30_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [hours, adminKey])
  const data = hours === 168 && week ? week : live
  const rows = useMemo(
    () =>
      data.sessions
        .filter((s) => s.role !== "staff")
        .filter((s) => (filter === "all" ? true : filter === "live" ? s.state === "live" : filter === "hour" ? s.state !== "earlier" : s.role === filter)),
    [data, filter],
  )
  const counts = useMemo(() => {
    const all = data.sessions.filter((s) => s.role !== "staff")
    return { all: all.length, live: all.filter((s) => s.state === "live").length, hour: all.filter((s) => s.state !== "earlier").length, host: all.filter((s) => s.role === "host").length, guest: all.filter((s) => s.role === "guest").length, anonymous: all.filter((s) => s.role === "anonymous").length }
  }, [data])

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 22, display: "inline-flex", alignItems: "center", gap: 8 }}>
          Planner 上的人{data.liveCount ? <span className="wb-live" /> : null}
        </h2>
        <span style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>
          现在 {data.liveCount} · 最近一小时 {data.recentCount}
        </span>
        <div style={{ marginLeft: "auto", display: "flex" }}>
          <Chip active={hours === 24} onClick={() => setHours(24)}>
            24 小时
          </Chip>
          <Chip active={hours === 168} onClick={() => setHours(168)} style={{ marginLeft: -1 }}>
            7 天
          </Chip>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
        {FILTERS.map(([k, label]) => (
          <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>
            {label} <span style={{ opacity: 0.6 }}>{counts[k]}</span>
          </Chip>
        ))}
      </div>
      <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>本人 = 通过自己的私链或认识的入口进来；客人 = 通过主人分享的链接；匿名 = 从网站直接进来，用设备、城市和设备号区分。点 Clarity 复制设备号，到 Clarity 的 Custom user ID 里粘贴就能看录像。</div>
      {rows.length === 0 ? <div className="empty">这段时间没有人打开 planner。</div> : null}
      {!isMobile ? (
        <table className="table">
          <thead>
            <tr style={{ whiteSpace: "nowrap" }}>
              <th style={{ width: 20 }}></th>
              <th>谁</th>
              <th>入口</th>
              <th>状态</th>
              <th>派对</th>
              <th>进度 · 最近几步</th>
              <th className="r">停留</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const who = sessionWho(s)
              const openRow = s.orderId ? () => onOpenOrder(s.orderId!) : s.leadId ? () => onOpenLead(s.leadId!) : () => setOpen(open === s.sid ? null : s.sid)
              const expanded = open === s.sid
              return (
                <Fragment key={s.sid}>
                  <tr className="wb-row" onClick={openRow}>
                    <td>
                      <span className={s.state === "live" ? "wb-live" : "wb-live wb-live-off"} aria-hidden="true" />
                    </td>
                    <td style={{ maxWidth: 0, width: "24%" }}>
                      <div className="clamp1" style={{ fontWeight: 600, color: who.anonymous ? "var(--color-neutral-700)" : undefined }}>
                        {who.main}
                      </div>
                      <div className="clamp1" style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>
                        {who.sub || "—"}
                        {s.leadPhone && s.role === "host" ? ` · ${prettyPhone(s.leadPhone)}` : ""}
                      </div>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <span className={`tag ${s.role === "guest" ? "tag-outline" : s.role === "host" ? "tag-ink" : "tag-neutral"}`}>{ROLE_LABELS[s.role]}</span>
                      <div style={{ fontSize: 11, color: "var(--color-neutral-600)", marginTop: 4 }}>
                        {ENTRY_LABELS[s.entry ?? ""] ?? s.entry ?? "—"}
                        {s.utmSource ? ` · ${s.utmSource}` : ""}
                      </div>
                    </td>
                    <td style={{ whiteSpace: "nowrap", color: s.state === "live" ? "var(--color-accent-700)" : "var(--color-neutral-700)", fontWeight: s.state === "live" ? 600 : 400 }}>
                      {s.state === "live" ? "正在动" : s.state === "just_left" ? `刚离开 · ${s.minutesAgo} 分前` : `${s.minutesAgo < 90 ? `${s.minutesAgo} 分钟前` : s.minutesAgo < 2880 ? `${Math.round(s.minutesAgo / 60)} 小时前` : `${Math.round(s.minutesAgo / 1440)} 天前`}`}
                      <div style={{ fontSize: 11, color: "var(--color-neutral-600)", fontWeight: 400 }}>首次 {stamp(s.firstAt)}</div>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {s.orderNo ? <span className="mono" style={{ fontSize: 11 }}>{s.orderNo}</span> : s.leadId ? <span style={{ fontSize: 12 }}>线索</span> : <span style={{ color: "var(--color-neutral-500)" }}>—</span>}
                      {s.eventDate ? <div style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>派对 {md(s.eventDate)}</div> : null}
                    </td>
                    <td style={{ maxWidth: 0, width: "34%" }}>
                      <div className="clamp1" style={{ fontSize: 12 }}>{progress(s) || "—"}</div>
                      <div className="clamp1" style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>
                        {s.events} 步：{s.steps.slice(0, 5).reverse().map(stepLabel).join(" → ")}
                      </div>
                    </td>
                    <td className="r" style={{ whiteSpace: "nowrap", color: "var(--color-neutral-700)" }}>
                      {s.secs ? `${Math.max(1, Math.round(s.secs / 60))} 分` : "—"}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <ClarityLink s={s} project={data.clarityProject} asButton />
                    </td>
                  </tr>
                  {expanded ? (
                    <tr>
                      <td colSpan={8} style={{ background: "var(--color-surface)", fontSize: 12 }}>
                        设备号 <span className="mono">{s.sid}</span>
                        {s.ip ? ` · IP ${s.ip}` : ""} · 全部步骤：{s.steps.slice().reverse().map((x) => `${stampShort(x.at)} ${stepLabel(x)}`).join(" → ")}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
          {rows.map((s) => {
            const who = sessionWho(s)
            const openRow = s.orderId ? () => onOpenOrder(s.orderId!) : s.leadId ? () => onOpenLead(s.leadId!) : undefined
            return (
              <article key={s.sid} className="card wb-row" onClick={openRow} style={{ gap: 6, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                    <span className={s.state === "live" ? "wb-live" : "wb-live wb-live-off"} aria-hidden="true" />
                    {who.main}
                  </span>
                  <span className={`tag ${s.role === "guest" ? "tag-outline" : s.role === "host" ? "tag-ink" : "tag-neutral"}`}>{ROLE_LABELS[s.role]}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
                  {who.sub ? `${who.sub} · ` : ""}
                  {ENTRY_LABELS[s.entry ?? ""] ?? s.entry ?? "—"} · {s.state === "live" ? "正在动" : `${s.minutesAgo} 分钟前`}
                  {s.orderNo ? ` · ${s.orderNo}` : ""}
                </div>
                <div style={{ fontSize: 12 }}>{progress(s)}</div>
                <div style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>
                  {s.events} 步：{s.steps.slice(0, 4).reverse().map(stepLabel).join(" → ")}
                </div>
                <div>
                  <ClarityLink s={s} project={data.clarityProject} asButton />
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

function stampShort(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles", hour: "2-digit", minute: "2-digit", hour12: false })
}
