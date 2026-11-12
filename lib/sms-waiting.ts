// Which customer texts are waiting on a person: lead-watch's sweep of the last
// day. Pure - the route hands in Twilio's two lists (newest first) - so the
// rules are unit-tested in tests/sms-waiting.test.ts.
//
// 2026-11-12: the 10:35 run listed four "customers waiting", all urgent, and
// none was. Three were chefs' "1" replies to a change text (Eason, JASON, Blu):
// a chef's number is not a customer, and that reply is filed by the system
// (lib/chef-notices.ts). The fourth was Jeffrey's "5 pm dinner but arrival
// time is 4 pm correct ?" from 18:26 the evening before, "waiting 968 minutes":
// it was answered at 18:27, but the sweep asked Twilio for the last 60 texts
// we sent, and by mid-morning those reached back only to the small hours - the
// answer had fallen off the list while the question was still on the other.

import { notAQuestion } from "@/lib/courtesy-text"

export type SweepMessage = {
  sid: string
  from: string
  to: string
  body: string | null
  date_sent: string | null
  date_created: string
  num_media?: string
}

export type WaitingSms = { kind: "sms"; sid: string; from: string; minutesWaiting: number; body: string }

export type SmsWaitingOptions = {
  now: number
  /** Texts older than this instant are not looked at. */
  cutoff: number
  /** The page size both lists were asked for. A list that came back full may not reach back to `cutoff`. */
  pageSize: number
  /** Numbers that are never a customer waiting: our own test numbers, and staff. */
  skip: (from: string) => boolean
  /** On hold, marked 不用回, or not a question (lib/lead-hold.ts loadQuiet). Pictures carry no body. */
  quiet: (from: string, at: number, body: string | undefined) => boolean
}

const when = (m: SweepMessage) => new Date(m.date_sent ?? m.date_created).getTime()
const mediaCount = (m: SweepMessage) => Number(m.num_media ?? 0) || 0

/** Per number, the time of the newest text we sent it (Twilio lists newest first). */
export function lastOutboundByPeer(outbound: SweepMessage[]): Map<string, number> {
  const lastOut = new Map<string, number>()
  for (const m of outbound) if (!lastOut.has(m.to)) lastOut.set(m.to, when(m))
  return lastOut
}

export function smsWaiting(inbound: SweepMessage[], outbound: SweepMessage[], o: SmsWaitingOptions): WaitingSms[] {
  const lastOut = lastOutboundByPeer(outbound)
  // How far back the list of what we sent reaches. A list shorter than the
  // page holds everything; a full one stops somewhere, and before that point
  // "nothing from us to this number" means "not on the list", not "no answer".
  let horizon = 0
  if (outbound.length >= o.pageSize) {
    horizon = Infinity
    for (const m of outbound) horizon = Math.min(horizon, when(m))
  }
  // Per number: the newest inbound, and the newest one that says something.
  // A "Loved …" reaction or a bare "thanks" after a real question (or photos)
  // must not hide it - same rule as the inbox, lib/sms-thread.ts foldLastByPeer.
  const newest = new Map<string, SweepMessage>()
  const newestReal = new Map<string, SweepMessage>()
  for (const m of inbound) {
    if (!newest.has(m.from)) newest.set(m.from, m)
    if (!newestReal.has(m.from) && (mediaCount(m) > 0 || !notAQuestion(m.body ?? ""))) newestReal.set(m.from, m)
  }
  const waiting: WaitingSms[] = []
  for (const [from, n] of newest) {
    const at = when(n)
    if (at < o.cutoff || o.skip(from)) continue
    const answeredAt = lastOut.get(from)
    if ((answeredAt ?? 0) >= at) continue
    // Nothing from us on the list, and the list does not reach back to this
    // text: whether it was answered cannot be told from here, so it is not
    // reported as waiting (the inbox, which reads 800 a side, is the judge).
    if (answeredAt === undefined && at < horizon) continue
    const real = newestReal.get(from)
    const m = real && when(real) > Math.max(answeredAt ?? 0, horizon) ? real : n
    const mAt = when(m)
    const media = mediaCount(m)
    const body = (m.body ?? "").trim()
    // 挂起中、老板标过「不用回」、或者这条本来就不是问题 —— 一条规则，见
    // lib/lead-hold.ts loadQuiet（老板 2026-09-24：免得一直提醒）。图片没有正文，不走"不是问题"那条。
    if (o.quiet(from, mAt, media > 0 ? undefined : body)) continue
    waiting.push({ kind: "sms", sid: m.sid, from, minutesWaiting: Math.round((o.now - mAt) / 60_000), body: (body || (media > 0 ? `[${media} image(s)]` : "")).slice(0, 400) })
  }
  return waiting
}
