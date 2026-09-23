// 客户自选小费时"到底刷多少"的唯一算法。
//
// 发票底部那张 Chef Gratuity 表已经把这套规则印给客户看过了（lib/invoice-html.ts
// 的 tipRows），这里必须一模一样，否则同一场派对会出现两个"20% 该付多少"。
//
// 两种情况不一样，别混：
//   现金发票：balanceDue 里没有卡费，所以刷卡时整笔（尾款+小费）都要 +4%。
//   刷卡发票：balanceDue 里已经含了卡费，只有新加的小费要 +4%。
// 这正是发票上 "TOTAL WITH CASH" 和 "VENMO / ZELLE / CARD (+4%)" 两列的差别。

export const CARD_FEE_RATE = 0.04

const cents = (dollars: number) => Math.round(dollars * 100)
const withCardFee = (c: number) => Math.round(c * (1 + CARD_FEE_RATE))

export type PayMath = {
  /** 尾款本身（发票口径，单位：分） */
  balanceCents: number
  /** 客户选的小费（分） */
  tipCents: number
  /** 这笔卡要刷的总额（分） */
  chargeCents: number
  /** 其中属于卡手续费的部分（分），给客户看一句"含 4%" */
  cardFeeCents: number
}

/**
 * @param balanceDue  发票算出来的 balanceDue（美元）
 * @param tipDollars  客户选的小费（美元，0 = 不给）
 * @param invoiceIsCard 发票的 paymentMethod 是不是 card（true = balanceDue 已含卡费）
 */
export function computeCharge(balanceDue: number, tipDollars: number, invoiceIsCard: boolean): PayMath {
  const balanceCents = Math.max(0, cents(balanceDue))
  const tipCents = Math.max(0, cents(tipDollars))
  const chargeCents = invoiceIsCard ? balanceCents + withCardFee(tipCents) : withCardFee(balanceCents + tipCents)
  return {
    balanceCents,
    tipCents,
    chargeCents,
    cardFeeCents: Math.max(0, chargeCents - balanceCents - tipCents),
  }
}

export const dollars = (c: number) => (c / 100).toFixed(2)
