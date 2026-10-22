// Is the Meta lead-form sync actually working? (2026-10-22)
//
// From 2026-10-21 16:34 to the next morning every 2-minute sweep failed with
// "Requires pages_manage_ads permission" (META_LEADS_TOKEN was never set, the
// read-only ads token stood in), three form leads waited in Meta without a
// quote, and nothing said so: pg_cron does not read responses. So the route
// keeps a streak in workbench_settings and mails ops when it crosses these
// lines, and once more when it comes back.

/** Stored at workbench_settings key META_LEADS_HEALTH_KEY. */
export type SweepHealth = {
  fail_streak: number
  last_attempt_at: string | null
  last_ok_at: string | null
  last_error: string | null
  alerted_at: string | null
}

export const META_LEADS_HEALTH_KEY = "meta_leads.health"
/** 15 sweeps x 2 min = half an hour of failing before the first mail. */
export const META_LEADS_ALERT_FIRST = 15
/** Then one reminder every 360 sweeps = 12 hours. */
export const META_LEADS_ALERT_EVERY = 360

export type SweepOutcome = { ok: true } | { ok: false; error: string }

const EMPTY: SweepHealth = { fail_streak: 0, last_attempt_at: null, last_ok_at: null, last_error: null, alerted_at: null }

/** The stored row, or a clean slate when it is missing or malformed. */
export function readHealth(value: unknown): SweepHealth {
  if (!value || typeof value !== "object") return { ...EMPTY }
  const v = value as Partial<SweepHealth>
  const s = (x: unknown) => (typeof x === "string" && x ? x : null)
  return {
    fail_streak: typeof v.fail_streak === "number" && v.fail_streak >= 0 ? Math.floor(v.fail_streak) : 0,
    last_attempt_at: s(v.last_attempt_at),
    last_ok_at: s(v.last_ok_at),
    last_error: s(v.last_error),
    alerted_at: s(v.alerted_at),
  }
}

/** Mail at the 15th failure in a row, then every 360 more. */
export function alertDue(streak: number): boolean {
  if (streak < META_LEADS_ALERT_FIRST) return false
  return (streak - META_LEADS_ALERT_FIRST) % META_LEADS_ALERT_EVERY === 0
}

/**
 * One cron sweep's effect on the stored health.
 * alert: mail "still failing" now. recovered: it had been failing long enough
 * to alert and just worked again, so mail "back".
 */
export function nextHealth(prev: SweepHealth, outcome: SweepOutcome, nowIso: string): { health: SweepHealth; alert: boolean; recovered: boolean } {
  if (outcome.ok) {
    const recovered = prev.fail_streak >= META_LEADS_ALERT_FIRST
    return { health: { fail_streak: 0, last_attempt_at: nowIso, last_ok_at: nowIso, last_error: null, alerted_at: prev.alerted_at }, alert: false, recovered }
  }
  const streak = prev.fail_streak + 1
  const alert = alertDue(streak)
  return {
    health: { fail_streak: streak, last_attempt_at: nowIso, last_ok_at: prev.last_ok_at, last_error: outcome.error.slice(0, 500), alerted_at: alert ? nowIso : prev.alerted_at },
    alert,
    recovered: false,
  }
}

/** Hours since an ISO time, one decimal; null when unknown. */
export function hoursSince(iso: string | null, nowMs: number): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? Math.round(((nowMs - t) / 3600_000) * 10) / 10 : null
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
