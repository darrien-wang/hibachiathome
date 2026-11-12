// Is the Meta lead-form sync actually working? (2026-10-22)
//
// From 2026-10-21 16:34 to the next morning every 2-minute sweep failed with
// "Requires pages_manage_ads permission" (META_LEADS_TOKEN was never set, the
// read-only ads token stood in), three form leads waited in Meta without a
// quote, and nothing said so: pg_cron does not read responses. So the route
// keeps a streak in workbench_settings and mails ops when it crosses these
// lines, and once more when it comes back.
//
// The stored record and the decisions are lib/sweep-health.ts, shared with the
// Conversions API sweep. The lines and the mails here are this sync's own.

import { alertDue as dueAt, hoursSince, nextHealth as next, type AlertCadence, type SweepHealth, type SweepOutcome } from "@/lib/sweep-health"

export { hoursSince, readHealth, type SweepHealth, type SweepOutcome } from "@/lib/sweep-health"

/** The record is stored at this workbench_settings key. */
export const META_LEADS_HEALTH_KEY = "meta_leads.health"
/** 15 sweeps x 2 min = half an hour of failing before the first mail. */
export const META_LEADS_ALERT_FIRST = 15
/** Then one reminder every 360 sweeps = 12 hours. */
export const META_LEADS_ALERT_EVERY = 360

const CADENCE: AlertCadence = { first: META_LEADS_ALERT_FIRST, every: META_LEADS_ALERT_EVERY }

/** Mail at the 15th failure in a row, then every 360 more. */
export function alertDue(streak: number): boolean {
  return dueAt(streak, CADENCE)
}

/**
 * One cron sweep's effect on the stored health.
 * alert: mail "still failing" now. recovered: it had been failing long enough
 * to alert and just worked again, so mail "back".
 */
export function nextHealth(prev: SweepHealth, outcome: SweepOutcome, nowIso: string): { health: SweepHealth; alert: boolean; recovered: boolean } {
  return next(prev, outcome, nowIso, CADENCE)
}

/** The ops mail for a failing streak. Chinese for the owner; the error stays as Meta wrote it. */
export function failingMail(h: SweepHealth, nowMs: number): { subject: string; text: string } {
  const since = hoursSince(h.last_ok_at, nowMs)
  const lines = [
    `Meta 表单广告的线索拉不进工作台，已经连续失败 ${h.fail_streak} 次（每 2 分钟一次）${since != null ? `，距上次成功 ${since} 小时` : "，上线以来还没成功过"}。`,
    "这期间填了表的客人收不到报价短信，线索还在 Meta 里等着。",
    "",
    `最后一次错误：${h.last_error ?? "-"}`,
    "",
    "多半是令牌问题：Vercel 的 META_LEADS_TOKEN 要用系统用户令牌，带 leads_retrieval、pages_manage_ads、pages_read_engagement、pages_show_list，系统用户要分到主页。修好后程序会回看 48 小时，自动给这段时间的线索补发报价。",
  ]
  return { subject: `⚠️ Meta 表单线索拉不下来 · 连续失败 ${h.fail_streak} 次`, text: lines.join("\n") }
}

/** The ops mail when it works again after an alert. */
export function recoveredMail(prev: SweepHealth, nowMs: number): { subject: string; text: string } {
  const since = hoursSince(prev.last_ok_at, nowMs)
  const text = [
    `Meta 表单线索恢复了：之前连续失败 ${prev.fail_streak} 次${since != null ? `（约 ${since} 小时）` : ""}，这一轮拉成功了。`,
    "这段时间里 48 小时内的表单线索会自动补发报价；更早的要去 Meta 里手动看。",
  ].join("\n")
  return { subject: "✅ Meta 表单线索恢复了", text }
}
