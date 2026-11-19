// Shared by the <Dial action> handler (app/api/twilio/voice-status) and the
// lead-watch backstop: one text, one idempotency key, so a caller is texted
// once per missed call no matter which path notices first.

// Opens with the house signature so the SMS brakes read it as automated.
export const MISSED_CALL_TEXT =
  "Real Hibachi: sorry we missed your call. Please text your date and city here and we'll answer right away."

export function missedCallTouchpointId(callSid: string): string {
  return `missed:${callSid}`
}

type CallLike = { status: string; duration?: string | number | null }

/**
 * Did nobody on our side pick this call up? The lead-watch backstop asks this
 * about every call into the line. `legs` are the legs the call dialed (the
 * app's seats, the backup phone), or null when they were not read.
 *
 * A call that is still going is not missed. One that never completed, or ended
 * in under 20 s, is. A call of 20 s or more used to count as answered, but the
 * ringing is on the clock too: 2026-11-19 13:35 a caller rang for 24 s, none of
 * the three app seats picked up and she hung up before the backup phone rang -
 * "completed, 24 s" - so nobody texted her. A longer call is missed when its
 * legs can be seen and none of them was picked up. When they cannot be seen it
 * counts as answered: "sorry we missed your call" to someone who just talked
 * to the owner is the worse mistake (2026-10-27).
 */
export function callWasMissed(call: CallLike, legs: CallLike[] | null): boolean {
  if (call.status === "in-progress" || call.status === "ringing" || call.status === "queued") return false
  if (call.status !== "completed" || (Number(call.duration) || 0) < 20) return true
  if (!legs) return false
  return !legs.some((leg) => leg.status === "completed" && (Number(leg.duration) || 0) > 0)
}
