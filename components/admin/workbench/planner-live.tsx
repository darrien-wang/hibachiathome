"use client"

import type { CSSProperties } from "react"
import { copyText, displayName, isPlaceholderName, md, prettyPhone, stamp } from "./helpers"

// Planner 实时：who is in the party planner right now. Shapes mirror
// app/api/admin/planner-live/route.ts.

export type PlannerSession = {
  sid: string
  state: "live" | "just_left" | "recent" | "earlier"
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
  leadId: string | null
  orderId: string | null
  leadName: string | null
  leadPhone: string | null
  orderNo: string | null
  customerName: string | null
  eventDate: string | null
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
  unlock_open: "打开留资卡",
  unlock_submit: "提交留资",
  unlock_dismiss: "关掉留资卡",
  lead_captured: "留资成功",
  find_party_open: "找派对",
  feedback_open: "打开反馈",
  feedback_sent: "发了反馈",
  blocked_tap: "点了没反应",
  error_shown: "看到报错",
  client_error: "前端报错",
  new_party: "开新派对",
  leave: "离开",
}
export const SHEET_LABELS: Record<string, string> = { tour: "引导", confirm: "确认", share: "分享", menu: "选菜", tables: "桌子", unlock: "留资", feedback: "反馈", invite: "邀请" }

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

/** Small inline pill: pulsing dot when live, grey text otherwise. */
export function PlannerPill({ s, project, style, compact }: { s: PlannerSession | undefined; project: string; style?: CSSProperties; compact?: boolean }) {
  if (!s || s.state === "earlier") return null
  const live = s.state === "live"
  const c = clarityUrl(s, project)
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: live ? "var(--color-accent-700)" : "var(--color-neutral-600)", whiteSpace: "nowrap", ...style }}>
      <span className={live ? "wb-live" : "wb-live wb-live-off"} aria-hidden="true" />
      {compact ? (live ? "Planner 中" : `Planner ${s.minutesAgo} 分前`) : plannerStateText(s)}
      {!compact ? (
        <a
          href={c.url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            e.stopPropagation()
            if (!c.direct) copyText(s.sid)
          }}
          title={c.direct ? "打开这段录像" : `${CLARITY_HINT}（${s.sid}）`}
          style={{ fontWeight: 400 }}
        >
          Clarity ↗
        </a>
      ) : null}
    </span>
  )
}

/** The strip on the leads tab: everyone in the planner now / lately, named or not. */
export function PlannerLiveStrip({ live, onOpenLead, onOpenOrder }: { live: PlannerLive; onOpenLead: (id: string) => void; onOpenOrder: (id: string) => void }) {
  const shown = live.sessions.filter((s) => s.state !== "earlier").slice(0, 12)
  if (shown.length === 0) return null
  return (
    <div style={{ border: "2px solid var(--color-divider)", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <span className="kicker" style={{ color: live.liveCount ? "var(--color-accent)" : undefined, fontWeight: 800 }}>
          Planner 上的人 · 现在 {live.liveCount} · 最近一小时 {live.recentCount}
        </span>
        <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>没留资的也算数：点 Clarity 看他在哪卡住。</span>
      </div>
      {shown.map((s) => {
        const who = !isPlaceholderName(s.customerName) ? s.customerName : displayName(s.leadName, s.leadPhone)
        const c = clarityUrl(s, live.clarityProject)
        const open = s.orderId ? () => onOpenOrder(s.orderId!) : s.leadId ? () => onOpenLead(s.leadId!) : null
        return (
          <div key={s.sid} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center", fontSize: 13, padding: "4px 0", borderTop: "1px solid var(--color-line)" }}>
            <span className={s.state === "live" ? "wb-live" : "wb-live wb-live-off"} aria-hidden="true" />
            <div style={{ minWidth: 0 }}>
              <div className="clamp1">
                {open ? (
                  <button type="button" className="wb-row" onClick={open} style={{ border: 0, background: "transparent", padding: 0, font: "inherit", color: "inherit", fontWeight: 600 }}>
                    {who}
                    {s.orderNo ? <span className="mono" style={{ fontSize: 11, color: "var(--color-neutral-600)" }}> {s.orderNo}</span> : null}
                    {s.leadPhone && !who.includes(prettyPhone(s.leadPhone)) ? <span style={{ color: "var(--color-neutral-600)", fontWeight: 400 }}> · {prettyPhone(s.leadPhone)}</span> : null}
                  </button>
                ) : (
                  <span style={{ fontWeight: 600 }}>匿名{s.identified ? "（填过联系方式）" : ""}</span>
                )}
                <span style={{ color: "var(--color-neutral-600)" }}>
                  {" "}· {ENTRY_LABELS[s.entry ?? ""] ?? s.entry ?? "—"} · {s.state === "live" ? "正在动" : `${s.minutesAgo} 分钟前`}
                  {s.eventDate ? ` · 派对 ${md(s.eventDate)}` : ""}
                </span>
              </div>
              <div className="clamp1" style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
                {s.guests != null ? `${s.guests} 人${s.picked != null ? ` · 选菜 ${s.picked}/${s.guests}` : ""}${s.joined ? ` · ${s.joined} 位客人加入` : ""} · ` : ""}
                {s.events} 步：{s.steps.slice(0, 4).reverse().map(stepLabel).join(" → ")}
                {s.secs ? ` · 停留 ${Math.round(s.secs / 60)} 分` : ""} · 首次 {stamp(s.firstAt)}
              </div>
            </div>
            <a
              href={c.url}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                if (!c.direct) copyText(s.sid)
              }}
              title={c.direct ? "打开这段录像" : `${CLARITY_HINT}（${s.sid}）`}
            >
              Clarity ↗
            </a>
          </div>
        )
      })}
    </div>
  )
}
