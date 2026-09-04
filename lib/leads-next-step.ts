// "What does this lead need next?" — the one decision the workbench exists to make.
//
// The old list showed every lead with the same row of buttons and left the
// operator to work out which of them applied. This derives the single next SOP
// step from where the lead sits in its lifecycle, so the row can carry one
// button that says what to do rather than five that say what is possible.
//
// Deliberately pure: `now` and "has this step already been sent" come in as
// arguments rather than being read from Date.now()/localStorage inside, so the
// whole decision table can be exercised without a browser. The caller supplies
// `sent` from the same `sop_sent_<leadId>_<stepId>` keys the send path writes.

export type LeadForNextStep = {
  id: string
  status: string
  first_response_at: string | null
  response_seconds: number | null
  created_at: string
  latest_message: string | null
  guest_count: number | null
}

export type NextStep = {
  /** SOP step id, or "first_response" for the reply that starts the clock. */
  sopId: string
  /** Step title, emoji stripped — the design renders no emoji. */
  title: string
  /** Short verb phrase for the row's single primary button. */
  actionLabel: string
  /** Human note about timing, e.g. "已超时 37 分钟". */
  dueNote: string
  /** True when the step is overdue and the row should read as urgent. */
  due: boolean
  /** When the step comes due, for sorting. null sorts last. */
  dueAt: number | null
}

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

/** The 5-minute first-response target the workbench is measured against. */
const FIRST_RESPONSE_TARGET_MS = 5 * MIN
const F45_MS = 45 * MIN

// Same three shapes the message parser in the workbench accepts.
export function extractEventDate(message: string | null): Date | null {
  if (!message) return null
  const raw =
    message.match(/(?:Event )?Date:\s*(\d{4}-\d{2}-\d{2})/i)?.[1] ||
    message.match(/Event\s+(\d{4}-\d{2}-\d{2})/i)?.[1] ||
    message.match(/(\d{4}-\d{2}-\d{2})/)?.[1]
  if (!raw) return null
  const [y, m, d] = raw.split("-").map(Number)
  // Parties start in the evening; 19:00 local is close enough to drive a
  // 48-hour confirmation window without inventing precision we do not have.
  const dt = new Date(y, m - 1, d, 19, 0, 0, 0)
  return Number.isNaN(dt.getTime()) ? null : dt
}

function minutes(ms: number): number {
  return Math.max(0, Math.round(ms / MIN))
}

function overdueNote(overdueMs: number): string {
  const m = minutes(overdueMs)
  if (m < 60) return `已超时 ${m} 分钟`
  const h = Math.floor(m / 60)
  if (h < 24) return `已超时 ${h} 小时`
  return `已超时 ${Math.floor(h / 24)} 天`
}

function waitingNote(remainingMs: number): string {
  const m = minutes(remainingMs)
  if (m < 60) return `${m} 分钟后到点`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时后到点`
  return `${Math.floor(h / 24)} 天后到点`
}

function step(
  sopId: string,
  title: string,
  actionLabel: string,
  dueAt: number | null,
  now: number,
  opts: { dueNote?: string; overdueNote?: string } = {}
): NextStep {
  const due = dueAt === null ? true : now >= dueAt
  const note =
    dueAt === null
      ? (opts.dueNote ?? "")
      : due
        ? (opts.overdueNote ?? overdueNote(now - dueAt))
        : (opts.dueNote ?? waitingNote(dueAt - now))
  return { sopId, title, actionLabel, dueNote: note, due, dueAt }
}

/**
 * The next thing to do for this lead, or null when there is nothing to chase
 * (lost, disqualified, or the whole sequence is done).
 */
export function nextStep(
  lead: LeadForNextStep,
  opts: { now: number; sent: (sopId: string) => boolean }
): NextStep | null {
  const { now, sent } = opts
  const status = lead.status

  if (status === "lost" || status === "disqualified") return null

  // 1. Nobody has replied yet. Everything else waits on this, and the 5-minute
  //    target is the number the workbench reports on, so it is always overdue
  //    the moment it slips — there is no "waiting" state worth showing.
  if (!lead.first_response_at) {
    const createdAt = new Date(lead.created_at).getTime()
    const target = createdAt + FIRST_RESPONSE_TARGET_MS
    const over = now - target
    return {
      sopId: "first_response",
      title: "首次响应",
      actionLabel: "发首响",
      dueNote: over > 0 ? `距 5 分钟目标已超 ${minutes(over)} 分钟` : `${minutes(-over)} 分钟内回复`,
      due: true,
      dueAt: target,
    }
  }

  const respondedAt = new Date(lead.first_response_at).getTime()

  // 2. Booked. The confirmation is a promise made in the ads, so it outranks
  //    anything else once the 48-hour window opens.
  if (status === "won") {
    const eventAt = extractEventDate(lead.latest_message)?.getTime() ?? null

    if (!sent("w_planner")) {
      return step("w_planner", "发派对布置工具（专属链接）", "发 planner", respondedAt, now, {
        overdueNote: "订金已确认，立刻发",
      })
    }
    if (!sent("w_confirm48") && eventAt !== null) {
      return step("w_confirm48", "48小时厨师实名确认", "发确认", eventAt - 48 * HOUR, now, {
        overdueNote: "48 小时确认已到点",
      })
    }
    // The party runs in the evening, so "the day after" means the next
    // morning, not the same hour a day later — +24h would put the invite at
    // dinner time the following night, well past when the guests posted.
    const MORNING_AFTER = 15 * HOUR
    if (!sent("w_review") && eventAt !== null) {
      return step("w_review", "派对次日：邀评", "发邀评", eventAt + MORNING_AFTER, now, {
        overdueNote: "派对已办完，邀评",
      })
    }
    if (!sent("w_ugc") && eventAt !== null) {
      return step("w_ugc", "派对次日：晒图邀请", "发晒图", eventAt + MORNING_AFTER, now)
    }
    // Booked, everything sent, or no event date to schedule against.
    return null
  }

  // 3. Still chasing. One ladder, each rung skipped once it has been sent.
  //    Order matters: it is the sequence the SOP prescribes.
  if (!sent("f45")) {
    return step("f45", "45分钟跟进：确定性+选择题+限时hold", "发跟进", respondedAt + F45_MS, now, {
      overdueNote: "45 分钟跟进已到点",
    })
  }
  if (!sent("f_night")) {
    return step("f_night", "当晚软锁定：免订金占位", "发跟进", respondedAt + 8 * HOUR, now)
  }
  if (!sent("f_planner")) {
    return step("f_planner", "次日拉回：发派对组局工具", "发 planner", respondedAt + DAY, now)
  }
  if (!sent("f_morning")) {
    return step("f_morning", "次日跟进：亮到场承诺", "发跟进", respondedAt + DAY + 4 * HOUR, now)
  }
  if (!sent("f_promo")) {
    return step("f_promo", "第3天促销复活钩", "发促销", respondedAt + 3 * DAY, now, {
      dueNote: "最后一发，之后停",
      overdueNote: "最后一发，之后停",
    })
  }

  // The ladder is exhausted: the sequence says stop rather than keep poking.
  return null
}

/**
 * Sort key for the queue: overdue first, then by how soon the step comes due.
 * Leads with nothing to do sink to the bottom rather than disappearing.
 */
export function nextStepSortKey(ns: NextStep | null): number {
  if (!ns) return Number.MAX_SAFE_INTEGER
  if (ns.dueAt === null) return Number.MAX_SAFE_INTEGER - 1
  return ns.dueAt
}
