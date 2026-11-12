import type { CancelOutcome } from "@/lib/order-cancel"

// The cancel dialog's wording (workbench order drawer, 2026-11-11): what a
// cancellation is about to do, read off the dry run, and what it did. Kept
// apart from lib/order-cancel.ts so the drawer bundles these few lines and not
// the server code; the type import is erased.

const failWhy = (error: string | undefined) => (error === "staff_has_no_phone" ? "没存手机号" : error || "没发出去")

/** Before: every step, each chef's text word for word, the $99 line when it applies. Nothing reaches the customer. */
export function cancelPlanLines(plan: CancelOutcome): string[] {
  const lines = [`${plan.orderNo ?? "订单"} · ${plan.party}`, `原因：${plan.reason}`, ""]
  if (plan.nothingToDo) return [...lines, "这单已经取消过了，师傅和线索也都处理完了，没有要做的。"]
  lines.push(plan.already ? "这单已经是取消状态，补上没做完的：" : "确认后会做这些事：")
  if (!plan.already) lines.push("· 订单标成已取消（日历、派单、备货里都不再出现）")
  for (const c of plan.chefs) {
    if (c.skipped === "party_over") lines.push(`· ${c.name}：派对时间早就过了，不发短信，派工撤掉`)
    else if (c.text && c.phone) lines.push(`· 短信通知 ${c.name}：「${c.text}」`)
    else if (c.text) lines.push(`· ${c.name} 没存手机号，短信发不了，要自己告诉他`)
  }
  if (plan.assignmentsCancelled && !plan.chefs.length) lines.push(`· 撤掉 ${plan.assignmentsCancelled} 条派工`)
  if (!plan.assignmentsCancelled) lines.push("· 这单还没派师傅，不用通知谁")
  if (plan.lead?.markedLost) lines.push("· 线索标成流失，原因记进时间线")
  else if (plan.lead?.kept) lines.push(`· 线索不动：${plan.lead.kept}`)
  lines.push("", "不会给客人发任何消息，也不会扣款、退款。")
  if (plan.lateFeeNote) lines.push(`⚠ ${plan.lateFeeNote}`)
  for (const w of plan.warnings) lines.push(`⚠ ${w}`)
  return lines
}

/** After: who was told, who was not, what is left for a person. */
export function cancelDoneLines(done: CancelOutcome): string[] {
  const lines = [`${done.orderNo ?? "订单"} 已取消。`]
  for (const c of done.chefs) {
    if (c.texted) lines.push(`· 已短信通知 ${c.name}`)
    else if (c.text) lines.push(`· ${c.name} 没通知到（${failWhy(c.error)}），要自己告诉他`)
  }
  if (done.lead?.markedLost) lines.push("· 线索已标成流失")
  else if (done.lead?.kept) lines.push(`· 线索没动：${done.lead.kept}`)
  if (done.lateFeeNote) lines.push(`⚠ ${done.lateFeeNote}`)
  for (const w of done.warnings) lines.push(`⚠ ${w}`)
  return lines
}
