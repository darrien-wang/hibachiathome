import type { SupabaseClient } from "@supabase/supabase-js"
import { notAQuestion } from "@/lib/courtesy-text"

// 「球在客人那边」——和线索状态是两回事（老板 2026-09-23 定）。客人说了他会回头
// 告诉我们，那条 "I'll get back to you" 不是在等我们回；挂起期间不算我们欠回复，
// 也不该响手机。
//
// 规则只写一份：桌面筛选走 components/admin/workbench/helpers.ts 的 leadOnHold，
// 服务端（巡检 + 手机收件箱）走这里。以前巡检自己抄了一份、手机压根不知道有挂起
// 这回事，于是同一条消息桌面安静、手机每隔几分钟报一次"等了 63 分钟"。
//
// **已成单的客人算在内**：成单之后他照样发短信，"菜单我收齐了再告诉你"正是要挂
// 起的那种（Micah Hamilton，2026-09-24，状态 won）。真正谈不上"等谁"的是丢掉的
// 线索。
const CLOSED_DEAD = "(lost,disqualified)"

type HoldRow = {
  normalized_phone: string | null
  phone: string | null
  hold_until: string
  hold_set_at: string | null
}

const digits10 = (phone: string | null | undefined) => String(phone ?? "").replace(/\D/g, "").slice(-10)

export type HoldLookup = {
  /**
   * @param phone 任意格式的号码
   * @param messageAt 这条消息的时间。客人在我们挂起之后又说话 = 他回来了，球回到
   *                  我们这边，挂起作废。不传就只看挂起还在不在。
   */
  onHold(phone: string | null | undefined, messageAt?: number): boolean
}

/** 查不到就按"没挂起"走：宁可多提醒一次，也不要静默吞掉客人的问题。 */
const NO_HOLDS: HoldLookup = { onHold: () => false }

export async function loadHolds(supabase: SupabaseClient, now = Date.now()): Promise<HoldLookup> {
  const { data, error } = await supabase
    .from("leads")
    .select("normalized_phone, phone, hold_until, hold_set_at")
    .not("hold_until", "is", null)
    .gt("hold_until", new Date(now).toISOString())
    .not("status", "in", CLOSED_DEAD)
  if (error || !data) return NO_HOLDS

  const byPhone = new Map<string, { until: number; setAt: number }>()
  for (const r of data as HoldRow[]) {
    const d = digits10(r.normalized_phone ?? r.phone)
    if (!d) continue
    const until = Date.parse(r.hold_until)
    if (!Number.isFinite(until)) continue
    // 同一个号码可能挂在好几条线索上，取挂得最久的那条。
    const prev = byPhone.get(d)
    if (prev && prev.until >= until) continue
    byPhone.set(d, { until, setAt: r.hold_set_at ? Date.parse(r.hold_set_at) : 0 })
  }

  return {
    onHold(phone, messageAt) {
      const h = byPhone.get(digits10(phone))
      if (!h || !(h.until > now)) return false
      if (messageAt && h.setAt && messageAt > h.setAt) return false
      return true
    },
  }
}

// ============================================================
// 「这条不用回」——2026-09-24 老板定（原话："这种可回可不回的帮我标记一下，免得
// 一直提醒"）。起因：Natalie 发来 "Perfect. Thank you so much. That is very
// helpful!"，手机每隔几分钟报一次"等了 63 分钟"。
//
// 和挂起是两件事：挂起 = 球在客人那边、到某天为止；这个 = **这一刻之前的消息都
// 处理完了**，之后再来新消息照样响。所以它是一条水位线（leads.acked_until），
// 不是一个状态。
// ============================================================

export type QuietLookup = {
  /** 挂起中、或者这条消息已经被标成"不用回"。 */
  quiet(phone: string | null | undefined, messageAt?: number, body?: string | null): boolean
}

/**
 * 提醒侧唯一入口：挂起 + 「不用回」水位线 + 点赞回执，一次查库全带上。
 * 查不到就按"要回"走——宁可多提醒一次，也不要静默吞掉客人的问题。
 */
export async function loadQuiet(supabase: SupabaseClient, now = Date.now()): Promise<QuietLookup> {
  const [holds, ackRes] = await Promise.all([
    loadHolds(supabase, now),
    supabase
      .from("leads")
      .select("normalized_phone, phone, acked_until")
      .not("acked_until", "is", null)
      .not("status", "in", CLOSED_DEAD),
  ])

  const ackByPhone = new Map<string, number>()
  for (const r of (ackRes.data ?? []) as Array<{ normalized_phone: string | null; phone: string | null; acked_until: string }>) {
    const d = digits10(r.normalized_phone ?? r.phone)
    const at = Date.parse(r.acked_until)
    if (!d || !Number.isFinite(at)) continue
    // 同号多条线索：以标得最晚的那条为准。
    if ((ackByPhone.get(d) ?? 0) < at) ackByPhone.set(d, at)
  }

  return {
    quiet(phone, messageAt, body) {
      if (body !== undefined && notAQuestion(String(body ?? ''))) return true
      if (holds.onHold(phone, messageAt)) return true
      const acked = ackByPhone.get(digits10(phone))
      return Boolean(acked && messageAt && messageAt <= acked)
    },
  }
}
