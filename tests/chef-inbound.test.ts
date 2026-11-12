// Layer-2 self-test: a text from a staff number (lib/chef-inbound.ts, order-flow
// rebuild 2026-11-11). "1" confirms a change notice, 好的 / 收到 needs nobody, and
// anything else is a chef waiting on us. 10-13 Gary's "好的" was reported as a
// customer; a chef asking for a fresh prep sheet later sat 18 hours unseen.
//   npm test
import { test } from "node:test"
import assert from "node:assert/strict"
import { classifyChefText, isAutoStaffNotice, isChefConfirm, openChefText } from "../lib/chef-inbound"
import { foldLastByPeer, type TwilioMessage } from "../lib/sms-thread"

test("chef text · a bare 1 is the confirmation, however it is typed", () => {
  for (const t of ["1", " 1 ", "１", "1。", "1.", "1!", "「1」", "1 确认", "1确认", "确认", "已确认", "确认了"]) {
    assert.equal(isChefConfirm(t), true, t)
    assert.equal(classifyChefText(t), "confirm", t)
  }
})

test("chef text · a 1 inside something else is not a confirmation", () => {
  for (const t of ["11", "1 个问题", "1点到可以吗", "确认一下地址", "还没确认", "2", "", "1 和 2 都行"]) assert.equal(isChefConfirm(t), false, t)
})

test("chef text · an acknowledgement needs nobody", () => {
  for (const t of ["好的", "好的👌", "收到", "收到了，谢谢", "OK", "ok", "Ok!", "好", "嗯嗯", "明白", "知道了", "谢谢", "辛苦了", "好的，明天见", "晚安", "👍", "👌", "Liked “Real Hibachi prep sheet”", "thanks", ""]) {
    assert.equal(classifyChefText(t), "ack", t)
  }
})

test("chef text · anything with content is a chef waiting on us", () => {
  for (const t of [
    "备料单打不开，再发一次",
    "这场要带桌子吗",
    "可以", // an answer to something we asked, not an acknowledgement
    "行",
    "没问题",
    "去不了",
    "?",
    "？",
    "好的，几点到",
    "收到 但是地址不对",
    "2",
    "Can you resend the sheet",
  ]) {
    assert.equal(classifyChefText(t), "message", t)
  }
  assert.equal(classifyChefText("", 1), "message", "a photo is a message")
  assert.equal(classifyChefText("1", 1), "message", "a photo with a 1 is still a photo to look at")
})

test("chef text · our automatic notices are told apart from answers", () => {
  assert.equal(isAutoStaffNotice("11月14日 Irvine 那场改了：8 位加餐具。https://invoice.realhibachi.com/chef/abc 回 1 确认"), true)
  assert.equal(isAutoStaffNotice("改动见链接，回复1确认"), true)
  assert.equal(isAutoStaffNotice("Real Hibachi workbench: your login code is 123456. It expires in 10 minutes."), true)
  assert.equal(isAutoStaffNotice("Real Hibachi prep sheet - Sat Nov 14 5:30 PM - Irvine - 18 guests\nhttps://invoice.realhibachi.com/chef/abc"), false)
  assert.equal(isAutoStaffNotice("11月14日下午5:30 Irvine（Joyce）那场改给别人了，你不用去，之前的备料单作废。"), false)
  assert.equal(isAutoStaffNotice("好的，马上重发"), false)
})

const thread = (lastAnswerOutAt: string | null, msg: string | null, ack: string | null) => ({
  lastAnswerOutAt,
  chef: { msg: msg ? { at: msg, body: "备料单再发一次", media: 0 } : null, ack: ack ? { at: ack, body: "收到" } : null },
})
const T = (hhmm: string) => `2026-11-12T${hhmm}:00.000Z`
const ms = (hhmm: string) => Date.parse(T(hhmm))

test("open chef text · a message is open until we answer it or someone marks it handled", () => {
  assert.equal(openChefText(thread(null, T("18:00"), null), null, null)?.body, "备料单再发一次")
  assert.equal(openChefText(thread(T("17:00"), T("18:00"), null), null, null)?.ackOnly, false, "our earlier text is not an answer")
  assert.equal(openChefText(thread(T("18:05"), T("18:00"), null), null, null), null, "answered")
  assert.equal(openChefText(thread(null, T("18:00"), null), null, ms("18:10")), null, "handled by a person")
  assert.ok(openChefText(thread(null, T("18:00"), null), null, ms("17:50")), "a text after the handled mark is open again")
})

test("open chef text · 收到 is open only while a change notice of his is unconfirmed", () => {
  assert.equal(openChefText(thread(null, null, T("18:00")), null, null), null, "no notice pending: an acknowledgement, nothing to do")
  const open = openChefText(thread(null, null, T("18:00")), ms("17:30"), null)
  assert.equal(open?.ackOnly, true)
  assert.equal(open?.body, "收到")
  assert.equal(openChefText(thread(null, null, T("18:00")), ms("18:30"), null), null, "the notice went out after his 收到: not about it")
  assert.equal(openChefText(thread(T("18:05"), null, T("18:00")), ms("17:30"), null), null, "someone answered him")
  assert.equal(openChefText(thread(null, null, T("18:00")), ms("17:30"), ms("18:01")), null, "marked handled")
})

const OURS = "+12137707788"
const CHEF = "+16265550188"
const out = (at: string, body: string): TwilioMessage => ({ sid: `SMo${at}`, direction: "outbound-api", body, from: OURS, to: CHEF, status: "delivered", date_sent: at, date_created: at })
const inb = (at: string, body: string, media = 0): TwilioMessage => ({ sid: `SMi${at}`, direction: "inbound", body, from: CHEF, to: OURS, status: "received", date_sent: at, date_created: at, num_media: String(media) })

test("fold · a question, then a 1 for a notice: the question is still the open one", () => {
  const v = foldLastByPeer([out(T("17:00"), "改动见链接，回 1 确认")], [inb(T("17:20"), "这场要带桌子吗"), inb(T("17:21"), "1")]).get(CHEF)!
  assert.equal(v.chef.msg?.body, "这场要带桌子吗")
  assert.equal(v.chef.ack, null)
  assert.equal(v.lastAnswerOutAt, null, "the notice is not an answer")
  assert.ok(openChefText(v, null, null), "nobody has answered the tables question")
})

test("fold · an automatic change notice after his question does not close it; a prep sheet or a reply does", () => {
  const asked = inb(T("17:20"), "备料单打不开，再发一次")
  const auto = foldLastByPeer([out(T("17:30"), "11月14日 Irvine 那场改了：加 2 位。回 1 确认")], [asked]).get(CHEF)!
  assert.equal(auto.lastOutAt, T("17:30"))
  assert.equal(auto.lastAnswerOutAt, null)
  assert.ok(openChefText(auto, null, null))
  const resent = foldLastByPeer([out(T("17:40"), "Real Hibachi prep sheet - Sat Nov 14 5:30 PM - Irvine - 18 guests")], [asked]).get(CHEF)!
  assert.equal(openChefText(resent, null, null), null)
})

test("fold · 好的 after our text is an acknowledgement, kept apart from messages", () => {
  const v = foldLastByPeer([out(T("17:00"), "明天早 30 分钟到")], [inb(T("17:05"), "好的")]).get(CHEF)!
  assert.equal(v.chef.msg, null)
  assert.equal(v.chef.ack?.body, "好的")
  assert.equal(openChefText(v, null, null), null)
})
