// /pay 的金额拆账。
//
// 2026-10-01 改的口径（老板定）：从专属付款链接（/pay?o=<订单>）付的钱一定是
// 刷卡，所以页面只给**刷卡价**——尾款加 4% 已经算好，再列出"加 20% / 25% 小费"
// 的总数，客人点一个就付，不用自己算，也没有算错的空间。发票同一天改成了
// "现金价 / 刷卡价"两个余额，两边的数一致。
//
// 拆账跟着改：一笔刷卡付款先换回现金口径（÷1.04），抵掉现金尾款，剩下的才是
// 师傅的小费。以前直接用"刷卡额 − 现金尾款"，4% 手续费整个被记成了小费
// （Daria，2026-10-01：$1,600 里记了 $264.65 小费，其中 $53.41 其实是手续费）。
// 4% 对刷卡上的每一块钱都收——包括小费那部分，因为 Stripe 也按全额收费；发票的
// 小费表用的是同一个算法（刷卡总数 = (现金尾款 + 小费) × 1.04）。

export const CARD_FEE_RATE = 0.04

const round2 = (n: number) => Math.round(n * 100) / 100

/** 现金价换成刷卡价：发票上的 Card / Venmo / Zelle 价就是这个数。 */
export function cardPrice(cashDollars: number): number {
  return round2(cashDollars * (1 + CARD_FEE_RATE))
}

export type PaymentSplit = {
  /** 实际要刷的金额（分）= 客户选/填的数 */
  chargeCents: number
  /** 其中抵尾款的部分（分，现金口径） */
  towardBalanceCents: number
  /** 其中归师傅的小费（分，现金口径，手续费已经扣掉） */
  tipCents: number
}

/**
 * 一笔刷卡付款怎么拆。
 * @param amountDollars 客户付的刷卡总数（美元）
 * @param cashBalanceDollars 这单还欠多少（现金口径，美元，服务端现查）
 */
export function splitCardPayment(amountDollars: number, cashBalanceDollars: number): PaymentSplit {
  const chargeCents = Math.max(0, Math.round(amountDollars * 100))
  const cashEquivalentCents = Math.round(chargeCents / (1 + CARD_FEE_RATE))
  const balanceCents = Math.max(0, Math.round(cashBalanceDollars * 100))
  const towardBalanceCents = Math.min(cashEquivalentCents, balanceCents)
  return {
    chargeCents,
    towardBalanceCents,
    tipCents: Math.max(0, cashEquivalentCents - balanceCents),
  }
}

export const dollars = (c: number) => (c / 100).toFixed(2)
