// Is a scheduled sweep still working, and has anyone been told when it is not?
//
// pg_cron calls the sweeps and never reads what they answer. Two of them have
// failed for a long time with nothing saying so: the Meta lead-form sync for
// 17 hours on 2026-10-21/22 (lib/meta-leads-health.ts) and the Meta
// Conversions API sweep for 17 days until 2026-11-12 (lib/meta-capi-health.ts).
// So a sweep keeps a streak of failures in a row in workbench_settings, mails
// ops when the streak crosses a line, again every so many sweeps, and once
// more when it comes back.
//
// Here: the stored record and the decisions, the same for every sweep. Each
// sweep brings its own lines and its own mails. lib/sweep-health-store.ts
// reads and writes the record.

/** Stored in workbench_settings under the sweep's own key. */
export type SweepHealth = {
  fail_streak: number
  last_attempt_at: string | null
  last_ok_at: string | null
  last_error: string | null
  alerted_at: string | null
}

export type SweepOutcome = { ok: true } | { ok: false; error: string }

/** Mail at the `first`-th failure in a row, then every `every` more. Counted in sweeps, not in minutes. */
export type AlertCadence = { first: number; every: number }

export type SweepMail = { subject: string; text: string }

/** One sweep's record, lines and mails: what lib/sweep-health-store.ts needs to keep it. */
export type SweepWatch = {
  /** The workbench_settings key. No migration: the first sweep recorded creates the row. */
  key: string
  /** Who the row says wrote it ("<name> cron"), and the tag in the function log. */
  name: string
  cadence: AlertCadence
  failingMail: (health: SweepHealth, nowMs: number) => SweepMail
  recoveredMail: (prev: SweepHealth, nowMs: number) => SweepMail
}

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

/** Mail at the first line, then every `every` failures after it, never in between. */
export function alertDue(streak: number, cadence: AlertCadence): boolean {
  if (streak < cadence.first) return false
  return (streak - cadence.first) % cadence.every === 0
}

/**
 * One cron sweep's effect on the stored health.
 * alert: mail "still failing" now. recovered: it had been failing long enough
 * to alert and just worked again, so mail "back".
 */
export function nextHealth(
  prev: SweepHealth,
  outcome: SweepOutcome,
  nowIso: string,
  cadence: AlertCadence,
): { health: SweepHealth; alert: boolean; recovered: boolean } {
  if (outcome.ok) {
    const recovered = prev.fail_streak >= cadence.first
    return { health: { fail_streak: 0, last_attempt_at: nowIso, last_ok_at: nowIso, last_error: null, alerted_at: prev.alerted_at }, alert: false, recovered }
  }
  const streak = prev.fail_streak + 1
  const alert = alertDue(streak, cadence)
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
