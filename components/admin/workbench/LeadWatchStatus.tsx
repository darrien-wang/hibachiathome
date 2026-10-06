"use client"

import { useCallback, useEffect, useState } from "react"
import { adminJson } from "./api"

// 巡检状态：读 GET /api/admin/lead-watch（lead_watch_runs 的汇总）。线索页顶部
// 一行看它活没活、今天做了什么；设置页列最近十几次。2026-10-06 起有这张表，
// 之前只能去 Supabase 查 cron.job_run_details。

export type LeadWatchRun = {
  ran_at: string
  caller: string
  quiet_hours: boolean
  disabled: boolean
  auto_sent: number
  missed_call_texts: number
  needs_human: number
  still_open: number
  escalated: number
  duration_ms: number | null
  ok: boolean
  error: string | null
}

export type LeadWatchStatus = {
  ok: boolean
  health: "ok" | "stale" | "error" | "never"
  lastRunAt: string | null
  lastCaller: string | null
  ageMinutes: number | null
  lastError: string | null
  lastCronAt: string | null
  quietHours: boolean
  disabled: boolean
  runs24h: number
  cronRuns24h: number
  failed24h: number
  today: { autoSent: number; missedCallTexts: number; escalated: number }
  stillOpen: number
  recent: LeadWatchRun[]
}

export function useLeadWatchStatus(adminKey: string, everyMs = 60_000) {
  const [status, setStatus] = useState<LeadWatchStatus | null>(null)
  const [failed, setFailed] = useState(false)
  const load = useCallback(async () => {
    try {
      setStatus(await adminJson<LeadWatchStatus>(adminKey, "/api/admin/lead-watch"))
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [adminKey])
  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), everyMs)
    return () => clearInterval(t)
  }, [load, everyMs])
  return { status, failed, reload: load }
}

const callerLabel = (c: string | null) => (c === "cron" ? "服务器" : c === "owner" ? "老板" : c || "—")
const ago = (min: number | null) => (min === null ? "—" : min < 1 ? "刚刚" : min < 60 ? `${min} 分钟前` : `${Math.floor(min / 60)} 小时 ${min % 60} 分前`)
const fmtPt = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })

/** One line under the leads header: is the patrol alive, and what did it do today. */
export function LeadWatchStrip({ adminKey, onClick }: { adminKey: string; onClick?: () => void }) {
  const { status: s } = useLeadWatchStatus(adminKey)
  if (!s) return null
  const bad = s.health !== "ok" || s.disabled
  const headline = s.disabled
    ? "巡检已关闭"
    : s.health === "never"
      ? "巡检还没跑过"
      : s.health === "error"
        ? `巡检上次出错 · ${ago(s.ageMinutes)}`
        : s.health === "stale"
          ? `巡检停了 · 最后一次 ${ago(s.ageMinutes)}`
          : `巡检在跑 · ${callerLabel(s.lastCaller)} ${ago(s.ageMinutes)}${s.quietHours ? " · 安静时段" : ""}`
  return (
    <div
      onClick={onClick}
      title={s.lastError ?? (s.lastRunAt ? `最近一次 ${fmtPt(s.lastRunAt)} PT` : undefined)}
      style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 14px", fontSize: 12, color: bad ? "var(--color-accent-700)" : "var(--color-neutral-600)", cursor: onClick ? "pointer" : undefined }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, display: "inline-block", background: bad ? "var(--color-accent-700)" : "#2e7d32" }} />
        {headline}
      </span>
      <span>今天自动首响 {s.today.autoSent} · 漏接来电短信 {s.today.missedCallTexts} · 转接 {s.today.escalated}</span>
      <span>
        24h 跑了 {s.runs24h} 次（服务器 {s.cronRuns24h}）{s.failed24h ? ` · 失败 ${s.failed24h}` : ""}
      </span>
    </div>
  )
}

/** Settings → 线索巡检: the last dozen runs. */
export function LeadWatchRuns({ adminKey }: { adminKey: string }) {
  const { status, reload } = useLeadWatchStatus(adminKey, 30_000)
  if (!status) return null
  return (
    <div style={{ fontSize: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 12 }}>
        <strong>最近运行{status.lastCronAt ? ` · 服务器上次 ${fmtPt(status.lastCronAt)} PT` : " · 服务器还没跑过"}</strong>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void reload()}>
          刷新
        </button>
      </div>
      {status.recent.length === 0 ? (
        <div style={{ color: "var(--color-neutral-600)" }}>24 小时内没有记录。</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>时间 (PT)</th>
              <th>谁</th>
              <th>结果</th>
              <th className="r">自动首响</th>
              <th className="r">漏接短信</th>
              <th className="r">转接</th>
              <th className="r">待人</th>
              <th className="r">耗时</th>
            </tr>
          </thead>
          <tbody>
            {status.recent.map((r) => (
              <tr key={`${r.ran_at}-${r.caller}`}>
                <td>{fmtPt(r.ran_at)}</td>
                <td>{callerLabel(r.caller)}</td>
                <td style={{ color: r.ok ? undefined : "var(--color-accent-700)" }}>{!r.ok ? `出错：${(r.error ?? "").slice(0, 60)}` : r.disabled ? "已关闭" : r.quiet_hours ? "安静时段" : "正常"}</td>
                <td className="r">{r.auto_sent}</td>
                <td className="r">{r.missed_call_texts}</td>
                <td className="r">{r.escalated}</td>
                <td className="r">{r.still_open}</td>
                <td className="r">{r.duration_ms != null ? `${(r.duration_ms / 1000).toFixed(1)}s` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
