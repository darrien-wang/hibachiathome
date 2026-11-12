// Is the Meta Conversions API sweep still working? (2026-11-12)
//
// From 2026-10-26 to 2026-11-12 every 15-minute sweep had one of its reads
// refused by the database API, 35 events went to Meta without the browser of
// their click, and nothing said so for 17 days: pg_cron does not read
// responses. A refused read now stops the sweep, which is honest and just as
// silent - nothing reaches Meta until someone looks. So the cron sweep keeps
// the same record as the lead-form sync (lib/sweep-health.ts) under its own
// key, and mails ops at these lines.
//
// Here: the lines, how each failure of the sweep reads, and the two mails.

import type { CapiResult } from "@/lib/meta-capi"
import { hoursSince, type AlertCadence, type SweepHealth, type SweepMail, type SweepOutcome } from "@/lib/sweep-health"

/** The record is stored at this workbench_settings key. No migration: the first cron sweep creates the row. */
export const META_CAPI_HEALTH_KEY = "meta_capi.health"
/** 4 sweeps x 15 min: about an hour without a sweep that worked, then the first mail. */
export const META_CAPI_ALERT_FIRST = 4
/** Then one reminder every 48 sweeps = 12 hours. */
export const META_CAPI_ALERT_EVERY = 48
export const META_CAPI_CADENCE: AlertCadence = { first: META_CAPI_ALERT_FIRST, every: META_CAPI_ALERT_EVERY }

// ---- What a failed sweep says ------------------------------------------------
// One line each. The sweep answers with it ({ ok: false, error }), the record
// keeps the last one, and the mail tells the kinds apart by how the line starts.

/** The sweep's reads, by table. */
export const SWEEP_READS = ["leads", "meta_click_context", "lead_touchpoints", "orders", "bookings", "meta_capi_events"] as const
export type SweepRead = (typeof SWEEP_READS)[number]

export const TOKEN_NOT_SET = "META_CAPI_TOKEN not set"

/** A read the database refused: the sweep stops there and sends nothing. */
export function readRefused(read: SweepRead, message: string): string {
  return `${read}: ${message}`
}

const META = "Meta"

/** A batch Meta did not take, in Meta's own words: "Meta HTTP 400: Invalid parameter (code 100/2804003) - Event Timestamp Too Old". */
export function metaRefused(res: CapiResult): string {
  const e = (res.body as { error?: unknown } | null)?.error
  // sendCapiEvents itself: no token, or no answer at all.
  if (typeof e === "string") return `${META}: ${e}`
  if (e && typeof e === "object") {
    const m = e as Record<string, unknown>
    const codes = [m.code, m.error_subcode].filter((c) => c != null).join("/")
    const detail = [m.error_user_title, m.error_user_msg].filter((s) => typeof s === "string" && s).join(": ")
    return `${META} HTTP ${res.status}: ${typeof m.message === "string" && m.message ? m.message : "no message"}${codes ? ` (code ${codes})` : ""}${detail ? ` - ${detail}` : ""}`
  }
  return `${META} HTTP ${res.status}: ${JSON.stringify(res.body ?? null).slice(0, 300)}`
}

const NOT_ON_FILE = "meta_capi_events insert: "

/** A batch Meta took that could not be put on file as sent. */
export function sentNotOnFile(events: number, message: string): string {
  return `${NOT_ON_FILE}${message} (${events} sent to Meta and not on file: the next sweep sends them again)`
}

/** Anything but ok:true is a failed sweep, whatever the HTTP status was. */
export function sweepOutcome(answer: Record<string, unknown>): SweepOutcome {
  if (answer.ok === true) return { ok: true }
  return { ok: false, error: typeof answer.error === "string" && answer.error ? answer.error : "the sweep did not answer ok:true and gave no error" }
}

// ---- The mails ----------------------------------------------------------------

const PT_STAMP = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })

/** "11-12 11:41", Los Angeles time. */
function ptStamp(iso: string): string {
  const p = Object.fromEntries(PT_STAMP.formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return `${p.month}-${p.day} ${p.hour}:${p.minute}`
}

const NOT_SENT =
  "这段时间客人的回话（Contact）和锁单（Purchase、Schedule）没有报给 Meta，Meta 不知道哪些广告点击带来了回话和订单，也就没法照着成交去找人。Meta 只收 7 天内的事件：7 天内修好，攒下的会在恢复后的第一轮自动补发；超过 7 天的补不了。"
// Meta's deduplication page (read 2026-11-12) promises to drop a repeat when
// the browser sent the same event too; of two consecutive server events with
// the same information it says neither is discarded. Contact and Schedule
// only ever come from this sweep.
const SENT_AGAIN =
  "事件已经发给 Meta，但没能记进已发记录（meta_capi_events），所以每 15 分钟会把同一批再发一遍，直到记得上为止。只从服务器发的事件 Meta 不保证去重，回话和锁单可能被重复计数，越早修越好。"

/** What this failure means for the business, and where to look for it. */
function reading(error: string): { impact: string; look: string } {
  // Anywhere in the line: a sweep with more than one batch can have had one refused before this.
  if (error.includes(NOT_ON_FILE)) {
    return { impact: SENT_AGAIN, look: "Supabase 里的 meta_capi_events 表：权限或字段有没有改过；同一个事件只能有一行（唯一索引 meta_capi_events_real_uniq）。" }
  }
  if (error === TOKEN_NOT_SET) {
    return { impact: NOT_SENT, look: "Vercel 的环境变量 META_CAPI_TOKEN 是空的。在 Meta 事件管理工具（Events Manager）→ 数据集 → 设置里生成访问令牌，填进去后重新部署。" }
  }
  if (error.startsWith(META)) {
    return {
      impact: NOT_SENT,
      look: "Meta 没收下这一批（拒收或者没有回应），原话在上面。多半是令牌失效或被撤销：在 Meta 事件管理工具（Events Manager）→ 数据集 → 设置里重新生成，换掉 Vercel 的 META_CAPI_TOKEN 后重新部署。如果原话说的是某个参数，就是某条事件的数据 Meta 不认。",
    }
  }
  const read = SWEEP_READS.find((r) => error.startsWith(`${r}: `))
  if (read) {
    return {
      impact: NOT_SENT,
      look: `数据库拒绝了对 ${read} 的读取，所以这一轮什么都没发。看 Supabase 的 API 日志里 /rest/v1/${read} 的 4xx：请求太长、字段改了名，或者权限变了。`,
    }
  }
  return { impact: NOT_SENT, look: "程序自己出错了（不是数据库拒绝读取，也不是 Meta 拒收）。看 Vercel 函数日志里的 [meta-capi]，sweep crashed 那一行带出错位置。" }
}

/** The ops mail for a failing streak. Chinese for the owner; the error stays as it was written. */
export function failingMail(h: SweepHealth, nowMs: number): SweepMail {
  const error = h.last_error ?? "-"
  const since = hoursSince(h.last_ok_at, nowMs)
  const lastOk = h.last_ok_at && since != null ? `上次成功是 ${ptStamp(h.last_ok_at)}（洛杉矶时间），${since} 小时前。` : "开始记录以来还没成功过。"
  const { impact, look } = reading(error)
  const lines = [
    `给 Meta 回传客人回话和锁单的任务（Conversions API，每 15 分钟一轮）已经连续失败 ${h.fail_streak} 次。${lastOk}`,
    "",
    `最后一次错误：${error}`,
    "",
    `影响：${impact}`,
    "",
    `去哪看：${look}`,
    "想重现又不真发事件：用管理员身份 POST /api/integrations/meta-capi?dry=1，只读库、列出这一轮要发的事件，读库出错会原样返回。连续失败的记录在 workbench_settings 的 meta_capi.health。",
  ]
  return { subject: `⚠️ Meta 回传（回话 / 锁单）出错 · 连续失败 ${h.fail_streak} 次`, text: lines.join("\n") }
}

/** The ops mail when it works again after an alert. `sent`: the events the sweep that worked sent. */
export function recoveredMail(prev: SweepHealth, nowMs: number, sent: number): SweepMail {
  const since = hoursSince(prev.last_ok_at, nowMs)
  const text = [
    `Meta 回传恢复了：之前连续失败 ${prev.fail_streak} 次${since != null ? `（约 ${since} 小时）` : ""}，这一轮成功了。`,
    sent > 0
      ? `这一轮发出 ${sent} 条事件：失败期间攒下的回话和锁单，只要还在 7 天内，都在里面。超过 7 天的 Meta 不收，补不了。`
      : "这一轮没有要补发的事件。如果中断超过了 7 天，更早的回话和锁单 Meta 已经不收，补不了。",
  ].join("\n")
  return { subject: "✅ Meta 回传（回话 / 锁单）恢复了", text }
}
