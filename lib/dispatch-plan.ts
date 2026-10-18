// The order's dispatch plan: how many chefs and grills a party gets, and why.
//
// Eileen Heng, RH-20260919-0223 (2026-10-17, 29 adults + 2 kids): the desk had
// texted "two U shapes ... each chef cooks from an open end" on 10-04 and "two
// stations, a 10x10 pop-up each" on 10-07, yet the order said
// required_staff_count = 1, the prep sheet had no notes and dispatch had one
// lead chef plus a helper. The promise lived only in the SMS thread. This
// module is where it lands instead: orders.dispatch_plan (jsonb), read by the
// prep sheet, the workbench and the lint.
//
// MIRRORED FILE: v0-real-hibachi-invoice-generator/lib/dispatch-plan.ts is the same code
// (that copy defines GUESTS_PER_CHEF itself; this one takes the quote
// wording's own constant from config/pricing-rules); tests/fixtures/bills.json carries it so
// the marketing mirror test catches drift. Change both copies together.

/**
 * One chef and one grill serve up to this many paid heads; past it a second
 * chef and grill, past twice it a third (the city pages say "One chef serves
 * up to 28 guests; past that we send a second chef and grill"). Owner
 * 2026-10-13 on Stacy's 29: still one chef unless the customer asks - that is
 * what the owner override is for, the rule itself stays at the quoted number.
 */
import { GUESTS_PER_CHEF } from "@/config/pricing-rules"
export { GUESTS_PER_CHEF }

/** Inside this many hours of the party a staffing lint issue blocks instead of warning. */
export const STAFFING_LINT_WINDOW_HOURS = 72

/** lead_touchpoints row that records a staffing promise made to the customer. */
export const PROMISE_TOUCHPOINT_TYPE = "promise"
/** Its touchpoint_source; with the message SID as external_touchpoint_id the unique index makes capture idempotent. */
export const PROMISE_TOUCHPOINT_SOURCE = "promise_capture"

export type DispatchPlanSource = "rule" | "owner" | "promise"

/** What the customer was told, verbatim, and what it adds up to. */
export type StaffingPromise = {
  chefs: number
  grills: number
  /** The sentence(s) that made the promise, trimmed. */
  text: string
  /** Twilio message SID (sms) or provider message id (email); null when unknown. */
  sid: string | null
  /** When it was sent (ISO). */
  at: string
  via?: "sms" | "email"
  lead_id?: string | null
  /** Where the chefs stand, when the text said so ("two U shapes, each chef at an open end"). */
  stations_note?: string | null
}

export type DispatchPlan = {
  chefs: number
  grills: number
  /** Printed on the prep sheet: "two U shapes, each chef at an open end, by the pool". */
  stations_note?: string | null
  source: DispatchPlanSource
  /** The promise this plan honours - or, on an owner plan, the one it has to be checked against. */
  promise?: StaffingPromise | null
  /** Paid heads the plan was computed for (rule plans), so a headcount change is visible. */
  heads?: number | null
  set_by?: string | null
  set_at?: string | null
}

export const MAX_CHEFS = 6

/** Paid heads: an adult is one, a paying kid half, a free little kid nothing (lib/chef-pay payableHeads). */
export function paidHeads(c: { adults: number; kids: number }): number {
  return Math.max(0, c.adults) + 0.5 * Math.max(0, c.kids)
}

/** Chefs by rule: one per GUESTS_PER_CHEF paid heads, never fewer than one. */
export function ruleChefs(heads: number): number {
  if (!Number.isFinite(heads) || heads <= 0) return 1
  return Math.max(1, Math.min(MAX_CHEFS, Math.ceil(heads / GUESTS_PER_CHEF)))
}

export function rulePlan(heads: number, at?: string): DispatchPlan {
  const chefs = ruleChefs(heads)
  return { chefs, grills: chefs, source: "rule", heads, set_at: at ?? null }
}

const clampCount = (v: unknown): number | null => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) && n >= 1 && n <= MAX_CHEFS ? n : null
}

const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null)

export function normalizePromise(raw: unknown): StaffingPromise | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const chefs = clampCount(r.chefs)
  const grills = clampCount(r.grills) ?? chefs
  if (!chefs || !grills) return null
  const at = str(r.at, 40) ?? new Date(0).toISOString()
  return {
    chefs,
    grills,
    text: str(r.text, 400) ?? "",
    sid: str(r.sid, 80),
    at,
    ...(r.via === "sms" || r.via === "email" ? { via: r.via } : {}),
    ...(str(r.lead_id, 40) ? { lead_id: str(r.lead_id, 40) } : {}),
    ...(str(r.stations_note, 200) ? { stations_note: str(r.stations_note, 200) } : {}),
  }
}

/** A stored dispatch_plan, or null when the column is empty or garbage. */
export function normalizeDispatchPlan(raw: unknown): DispatchPlan | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const chefs = clampCount(r.chefs)
  if (!chefs) return null
  const grills = clampCount(r.grills) ?? chefs
  const source: DispatchPlanSource = r.source === "owner" || r.source === "promise" ? r.source : "rule"
  const heads = Number(r.heads)
  return {
    chefs,
    grills,
    stations_note: str(r.stations_note, 200),
    source,
    promise: normalizePromise(r.promise),
    heads: Number.isFinite(heads) ? heads : null,
    set_by: str(r.set_by, 80),
    set_at: str(r.set_at, 40),
  }
}

/**
 * The plan to act on. A rule plan (or no plan at all) follows the current
 * headcount - the row is a snapshot, the party changes. Owner and promise
 * plans stand as written.
 */
export function effectivePlan(raw: unknown, heads: number): DispatchPlan {
  const stored = normalizeDispatchPlan(raw)
  if (!stored || stored.source === "rule") {
    return { ...rulePlan(heads), stations_note: stored?.stations_note ?? null, promise: stored?.promise ?? null }
  }
  return stored
}

/**
 * Fold a promise into the plan. The promise wins over a rule plan and over an
 * owner plan that falls short of it; an owner plan that already covers the
 * promise keeps its source and just records the promise (the lint checks it).
 */
export function applyPromise(existing: DispatchPlan | null, promise: StaffingPromise, heads: number, at: string): DispatchPlan {
  if (existing?.source === "owner" && existing.chefs >= promise.chefs && existing.grills >= promise.grills) {
    return { ...existing, promise, stations_note: existing.stations_note ?? promise.stations_note ?? null }
  }
  return {
    chefs: promise.chefs,
    grills: promise.grills,
    stations_note: promise.stations_note ?? existing?.stations_note ?? null,
    source: "promise",
    promise,
    heads,
    set_by: "promise_capture",
    set_at: at,
  }
}

// ── promise capture ────────────────────────────────────────────────────────
// What the desk writes to customers, as it writes it (lead_touchpoints,
// 2026-09..10): "2 chefs and 2 grills for 30", "a two-chef party - two grills
// going", "For 35 we send two chefs, each with their own grill", "with 60
// guests that's 3 chefs", "we'd bring 2-3 chefs with their own grills", "each
// chef cooks from an open end", "we'll set the two stations a few feet back".
// And the one that must NOT count: "28 guests is one chef and one grill -
// past 28 it becomes two chefs" (a rule explained, not a promise).

const NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6 }
const NUM_RE = "(\\d|one|two|three|four|five|six)"
const CHEF_COUNT_RE = new RegExp(`\\b${NUM_RE}(?:\\s*(?:-|–|to|or)\\s*${NUM_RE})?[\\s-]*chefs?\\b`, "gi")
const GRILL_COUNT_RE = new RegExp(`\\b${NUM_RE}(?:\\s*(?:-|–|to|or)\\s*${NUM_RE})?[\\s-]*(?:grills?|(?:cooking |hibachi )?stations?)\\b`, "gi")
/** A count in the same clause as one of these is the rule for a bigger party, not this one. */
const CONDITIONAL_RE = /\b(past|over|above|beyond|more than)\b/i
const CLAUSE_BREAK_RE = /[.!?;\n]|\s-\s|—/g
const EACH_CHEF_RE = /\b(each|both|every) chefs?\b|\bper chef\b|\b(a |an )?(second|extra|additional) (chef|grill)\b/i
/** "One chef handles groups up to 28" - a text that states one chef is explaining the rule, not promising a crew. */
const SINGLE_CHEF_RE = /\b(one|1|a single) chef\b/i
const OWN_GRILL_RE = /\b(each|all) with (their|his|her) own grills?\b|\btheir own grills?\b|\ba grill each\b|\bown grills\b/i
const STATIONS_RE = /\bu[\s-]?shapes?\b|\bstations?\b|\bpop-?ups?\b|\bopen end\b|\bby the pool\b|\bset (up|the) (two|2|three|3)\b|\bfeet back\b/i

export type ParsedPromise = { chefs: number; grills: number; stations_note: string | null; text: string }

function counts(text: string, re: RegExp): number[] {
  const out: number[] = []
  re.lastIndex = 0
  for (const m of text.matchAll(re)) {
    // The clause the count sits in: from the last sentence or dash break.
    let clauseStart = 0
    for (const b of text.slice(0, m.index).matchAll(CLAUSE_BREAK_RE)) clauseStart = (b.index ?? 0) + b[0].length
    if (CONDITIONAL_RE.test(text.slice(clauseStart, m.index))) continue
    const a = NUM[m[1].toLowerCase()] ?? 0
    const b = m[2] ? NUM[m[2].toLowerCase()] ?? 0 : 0
    out.push(Math.max(a, b))
  }
  return out
}

/** The sentences that place the chefs, for the prep sheet. */
function stationsNoteOf(text: string): string | null {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean)
  const hits = sentences.filter((s) => STATIONS_RE.test(s) && /\b(chefs?|grills?|stations?)\b/i.test(s))
  if (!hits.length) return null
  return hits.join(" · ").replace(/\s+/g, " ").slice(0, 200)
}

/**
 * Does this outbound text or email promise the customer more than one chef or
 * grill? Returns what was promised, or null. Explicit counts win; "each chef",
 * "a second chef" and "their own grills" mean at least two; grills default to
 * the chef count and vice versa.
 */
export function parseStaffingPromise(raw: string): ParsedPromise | null {
  const text = (raw ?? "").replace(/\s+/g, " ").trim()
  if (!text) return null
  const chefCounts = counts(text, CHEF_COUNT_RE).filter((n) => n >= 2)
  const grillCounts = counts(text, GRILL_COUNT_RE).filter((n) => n >= 2)
  // "each chef" / "a second chef" / "their own grills" mean a crew - unless the
  // same text says "one chef": then they describe what bigger parties get
  // (Jackson Rogow, 10-12: "One chef handles groups up to 28, so there are no
  // extra chef or grill fees").
  const plural = (EACH_CHEF_RE.test(text) || OWN_GRILL_RE.test(text)) && !SINGLE_CHEF_RE.test(text)
  let chefs = chefCounts.length ? Math.max(...chefCounts) : 0
  let grills = grillCounts.length ? Math.max(...grillCounts) : 0
  if (!chefs && !grills && !plural) return null
  if (!chefs) chefs = grills || 2
  if (!grills) grills = chefs
  chefs = Math.min(MAX_CHEFS, chefs)
  grills = Math.min(MAX_CHEFS, grills)
  if (chefs < 2 && grills < 2) return null
  return { chefs, grills, stations_note: stationsNoteOf(text), text: text.slice(0, 400) }
}

// ── lint ──────────────────────────────────────────────────────────────────

export type LintSeverity = "blocking" | "warning"
export type LintCode = "chefs_short" | "second_cook_missing" | "grills_below_rule" | "promise_unmet"
export type LintIssue = { code: LintCode; severity: LintSeverity; message: string; messageZh: string }

export type StaffingLintInput = {
  plan: DispatchPlan
  /** Paid heads of the party as it stands. */
  heads: number
  /** Active cooking assignments (lead_chef rows): tentative, confirmed or completed. */
  cooks: number
  /** Active helper assignments (assistant_chef): on site, no grill of their own. */
  helpers: number
  /** Hours until the party; null when the start is unknown (then nothing blocks). */
  hoursToParty: number | null
}

/**
 * Staffing checks on one order. Everything is a warning until the party is
 * inside STAFFING_LINT_WINDOW_HOURS; then it blocks (the prep sheet send
 * refuses without force, the workbench shows red).
 */
export function lintStaffing(i: StaffingLintInput): LintIssue[] {
  const severity: LintSeverity = i.hoursToParty !== null && i.hoursToParty <= STAFFING_LINT_WINDOW_HOURS ? "blocking" : "warning"
  const out: LintIssue[] = []
  const rule = ruleChefs(i.heads)
  if (i.cooks < i.plan.chefs) {
    if (i.plan.chefs >= 2 && i.cooks <= 1 && i.helpers > 0) {
      out.push({
        code: "second_cook_missing",
        severity,
        message: `${i.plan.chefs} chefs planned, ${i.cooks} cooking + ${i.helpers} helper: a helper has no grill - assign a second chef.`,
        messageZh: `计划 ${i.plan.chefs} 位师傅，只派了 ${i.cooks} 位 + ${i.helpers} 个帮手：帮手不带灶，要再派一位师傅。`,
      })
    } else {
      out.push({
        code: "chefs_short",
        severity,
        message: `${i.plan.chefs} chefs planned, ${i.cooks} assigned.`,
        messageZh: `计划 ${i.plan.chefs} 位师傅，只派了 ${i.cooks} 位。`,
      })
    }
  }
  if (i.plan.grills < rule) {
    out.push({
      code: "grills_below_rule",
      severity,
      message: `${i.plan.grills} grill${i.plan.grills === 1 ? "" : "s"} planned for ${i.heads} paid heads; the rule (${GUESTS_PER_CHEF} a grill) says ${rule}.`,
      messageZh: `${i.heads} 个付费人头只计划 ${i.plan.grills} 台灶；按规则（${GUESTS_PER_CHEF} 人一台）要 ${rule} 台。`,
    })
  }
  const p = i.plan.promise
  if (p && (i.plan.chefs < p.chefs || i.plan.grills < p.grills || i.cooks < p.chefs)) {
    out.push({
      code: "promise_unmet",
      severity,
      message: `Customer was told ${p.chefs} chefs / ${p.grills} grills (${p.at.slice(0, 10)}); plan ${i.plan.chefs}/${i.plan.grills}, ${i.cooks} assigned.`,
      messageZh: `答应过客人 ${p.chefs} 位师傅 / ${p.grills} 台灶（${p.at.slice(0, 10)}）；计划 ${i.plan.chefs}/${i.plan.grills}，派了 ${i.cooks} 位。`,
    })
  }
  return out
}

export const hasBlocking = (issues: LintIssue[]): boolean => issues.some((x) => x.severity === "blocking")

/** "2 chefs · 2 grills" for headers. */
export function planLabel(plan: Pick<DispatchPlan, "chefs" | "grills">): string {
  return `${plan.chefs} chef${plan.chefs === 1 ? "" : "s"} · ${plan.grills} grill${plan.grills === 1 ? "" : "s"}`
}
