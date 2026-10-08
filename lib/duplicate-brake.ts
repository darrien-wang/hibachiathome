// One customer, one answer (owner 2026-10-07, widened 2026-10-08).
//
// Two desks answered Eileen's sake question 17 s apart on 10-07. The first
// version of this brake only looked three minutes back, which still let a
// second desk answer the same message four minutes later. Now: once anyone has
// texted a customer since that customer's last message, a different sender
// cannot add to it for the whole reply window (15 min by default) - unless the
// customer speaks again. The same sender can keep going (a two-line answer);
// automated texts ("Real Hibachi: ...", the instant quote) never count.
//
// Unknown senders (the machine's template B, the missed-call text, a text sent
// from the phone app) count as "someone else": a person texting a minute after
// the machine's first response would be sending a second first response.

export type ThreadLine = { sid: string; direction: "inbound" | "outbound"; at: string; body: string }

export const isAutomatedText = (body: string) => body.trimStart().startsWith("Real Hibachi:")

/**
 * The newest text another sender sent this customer inside the window since
 * the customer last spoke, or null when this send is not a duplicate.
 * `senderOf` maps a Twilio SID to the session that sent it (null = unknown).
 */
export function otherSenderJustAnswered(
  thread: ThreadLine[],
  senderOf: (sid: string) => string | null,
  me: string,
  nowMs: number,
  windowMs: number,
): { at: string; body: string; by: string | null; ageMs: number } | null {
  const lastIn = [...thread].reverse().find((m) => m.direction === "inbound")
  const lastInMs = lastIn ? Date.parse(lastIn.at) : -Infinity
  const recent = thread
    .filter((m) => m.direction === "outbound" && !isAutomatedText(m.body))
    .filter((m) => {
      const at = Date.parse(m.at)
      return at > lastInMs && nowMs - at >= 0 && nowMs - at < windowMs
    })
  for (const m of [...recent].reverse()) {
    const by = senderOf(m.sid)
    if (by !== me) return { at: m.at, body: m.body, by, ageMs: nowMs - Date.parse(m.at) }
  }
  return null
}
