// 客户在 /pay 上填一个总数，我们照那个数刷卡；超出尾款的部分全是师傅的小费。
//
// 2026-09-23 改的口径（老板定）：师傅当天一般已经和客户当面谈好付多少，所以
// 页面不再显示这一单欠多少、也不再给 20/25/30 档位——显示一个他已经知道的数
// 反而是干扰。客户填总数，我们只负责把它拆开记账。
//
// 刷多少 = 客户填的数，一分不多。以前会在上面再加 4% 卡费，现在不加了：既然
// 让客户填"总数"，收到的就必须正好是那个数，否则卡上金额和他跟师傅谈的对不上。

export const CARD_FEE_RATE = 0.04

export type PaymentSplit = {
  /** 实际要刷的金额（分）= 客户填的数 */
  chargeCents: number
  /** 其中抵尾款的部分（分） */
  towardBalanceCents: number
  /** 其中归师傅的小费（分）= 超出尾款的部分 */
  tipCents: number
}

/**
 * @param amountDollars 客户填的总数（美元）
 * @param balanceDueDollars 这单还欠多少（美元，服务端现查，客户看不到）
 */
export function splitPayment(amountDollars: number, balanceDueDollars: number): PaymentSplit {
  const chargeCents = Math.max(0, Math.round(amountDollars * 100))
  const balanceCents = Math.max(0, Math.round(balanceDueDollars * 100))
  const towardBalanceCents = Math.min(chargeCents, balanceCents)
  return {
    chargeCents,
    towardBalanceCents,
    tipCents: Math.max(0, chargeCents - towardBalanceCents),
  }
}

/**
 * 快捷按钮（20/25/30%）往输入框里填的那个数：尾款 + 小费，**含 4% 卡费**。
 * 老板 09-23 定：按钮是便利，算好含卡费的全额直接填进去；客户自己手打的数
 * 我们照打的数刷，不再加。
 *
 * 加在哪一层照发票的规矩：现金发票的 balanceDue 不含卡费 → 整笔 ×1.04；
 * 刷卡发票的已经含了 → 只有小费 ×1.04。这正是发票底部那两列的差别。
 */
export function quickFillCents(balanceDueDollars: number, tipDollars: number, invoiceIsCard: boolean): number {
  const b = Math.max(0, Math.round(balanceDueDollars * 100))
  const t = Math.max(0, Math.round(tipDollars * 100))
  const fee = (c: number) => Math.round(c * (1 + CARD_FEE_RATE))
  return invoiceIsCard ? b + fee(t) : fee(b + t)
}

export const dollars = (c: number) => (c / 100).toFixed(2)
