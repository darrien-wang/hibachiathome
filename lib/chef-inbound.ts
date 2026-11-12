import { courtesyOnly, isTapback } from "@/lib/courtesy-text"

// A text from a staff number on the 213 line (lib/staff-phones.ts): what it is.
//
// Until 2026-11-11 staff texts were dropped from every list (10-13: Gary's
// "好的" was reported as a customer waiting). That also hid the ones that
// needed someone: a chef asking for a fresh prep sheet waited 18 hours. The
// order-flow rebuild (D-1111-03) gives them their own place:
//
//   confirm   "1" - the chef confirming a change notice (the notice says 回 1 确认).
//             The SMS webhook stamps chef_change_notices.acked_at; never an inbox item.
//   ack       好的 / 收到 / OK / 👍 / a reaction - an acknowledgement. Nobody is owed
//             an answer, so it stays off the list (the 10-13 rule) - unless the chef
//             still has an unconfirmed change notice, where "收到" instead of "1" is
//             shown so a person decides whether it counts.
//   message   anything else, and any photo: a chef waiting on us → [chef] in the inbox.
//
// Pure: lib/sms-thread.ts folds Twilio's lists with it, the webhook reads one text.

export type ChefTextKind = "confirm" | "ack" | "message"

const WRAP = String.raw`[\s"'“”‘’「」『』]*`
const TAIL = String.raw`[\s。.．!！~～"'“”‘’「」『』]*`
// "1", "１", "1。", "1 确认", "确认", "已确认". Nothing else on the line.
const CONFIRM = new RegExp(`^${WRAP}(?:[1１]\\s*[,，、.。]?\\s*(?:确认|確認)?了?|(?:已|已经)?(?:确认|確認)了?)${TAIL}$`)
// Acknowledgements only. 可以 / 行 / 没问题 / yes are answers to something we asked
// and must reach a person, the same way "yes" does for a customer (lib/courtesy-text.ts).
const ACK_RUN = /^(?:好的?|好嘞|好滴|好哒|好吧|收到了?|明白了?|知道了|了解了?|嗯+|恩+|哦+|谢谢|多谢|感谢|辛苦了?|不客气|没事|明天见|回头见|再见|拜拜|晚安|ok+|okay|k+|thanks|thankyou|thx|gotit|noted)+$/

/** "1" (or 确认) and nothing else: the chef confirming a change notice. */
export function isChefConfirm(body: string | null | undefined): boolean {
  return CONFIRM.test(body ?? "")
}

export function classifyChefText(body: string | null | undefined, media = 0): ChefTextKind {
  if (media > 0) return "message"
  const b = (body ?? "").trim()
  if (isChefConfirm(b)) return "confirm"
  if (!b) return "ack"
  // A bare "?" strips down to nothing below; it is a question.
  if (/[?？]/.test(b)) return "message"
  if (isTapback(b) || courtesyOnly(b)) return "ack"
  const core = b.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")
  if (!core) return "ack" // only emoji / punctuation: 👌
  return ACK_RUN.test(core) ? "ack" : "message"
}

/** The slice of lib/sms-thread.ts LastByPeer this file judges (kept structural: sms-thread imports this file). */
export type ChefThread = {
  lastAnswerOutAt: string | null
  chef: { msg: { at: string; body: string; media: number } | null; ack: { at: string; body: string } | null }
}
export type OpenChefText = { at: string; body: string; media: number; ackOnly: boolean }

/**
 * The chef's text that is waiting on us, or null.
 *
 * A message is open until we send something that can be an answer after it
 * (lastAnswerOutAt), or a person marks the thread handled (handledUntil, ms -
 * he was called, it was settled on WeChat). A bare 好的 / 收到 is open only
 * while this chef has a change notice he has not confirmed that went out before
 * it (pendingNoticeSentAt, ms): then the question is whether it counts as his "1".
 */
export function openChefText(v: ChefThread, pendingNoticeSentAt: number | null, handledUntil: number | null): OpenChefText | null {
  const answered = (at: string) => Boolean(v.lastAnswerOutAt && Date.parse(v.lastAnswerOutAt) >= Date.parse(at))
  const handled = (at: string) => handledUntil !== null && Date.parse(at) <= handledUntil
  const msg = v.chef.msg
  if (msg && !answered(msg.at) && !handled(msg.at)) return { ...msg, ackOnly: false }
  const ack = v.chef.ack
  if (ack && !answered(ack.at) && !handled(ack.at) && pendingNoticeSentAt !== null && pendingNoticeSentAt <= Date.parse(ack.at)) {
    return { at: ack.at, body: ack.body, media: 0, ackOnly: true }
  }
  return null
}

/**
 * One of our texts that nobody wrote as an answer: the automatic change notice
 * (card A, "…回 1 确认") or a workbench login code. A chef's question is still
 * open after one of these; a prep sheet, a reply or a "你不用去" text does close it.
 */
export function isAutoStaffNotice(body: string | null | undefined): boolean {
  const b = body ?? ""
  return /回\s*复?\s*[1１]\s*确认/.test(b) || /^Real Hibachi workbench: your login code/i.test(b.trim())
}
