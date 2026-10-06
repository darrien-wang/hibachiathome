// /pay 的金额拆账。
//
// 两套口径（config/pricing-rules.ts 的 PricingTerms）：
//
//   v1（2026-10-05 及之前建的单）：价格含税，刷卡 / Venmo / Zelle +4%。专属链接
//   只给刷卡价（老板 2026-10-01 定）：尾款 ×1.04，再给"加 20% / 25% 小费"的总数。
//   拆账先换回现金口径（÷1.04）再抵尾款，剩下的是师傅的小费——以前把 4% 整个
//   记成了小费（Daria，2026-10-01：$1,600 里记了 $264.65 小费，其中 $53.41 是手续费）。
//
//   v2（2026-10-06 起，老板 2026-10-05 定）：价格是税前价，总价上加 10% 消费税；
//   当天付现金给师傅拿 10% 现金折扣（和税同额），任何付款方式都没有手续费。
//   从链接付的是刷卡 / Venmo / Zelle：刷卡尾款 = 现金尾款 + 税（税按派对总价算，
//   发票接口给），小费不含税。拆账：先扣税，再抵尾款，剩下的是小费。

export const CARD_FEE_RATE = 0.04

/** 这单按哪套口径，以及 v2 下这单的税（美元，来自发票接口）。 */
export type PayTerms = { version: "v1" | "v2"; taxDollars: number }
export const V1_TERMS: PayTerms = { version: "v1", taxDollars: 0 }

const round2 = (n: number) => Math.round(n * 100) / 100

/** 现金尾款换成刷卡尾款：v1 ×1.04；v2 加上这单的税。 */
export function cardPrice(cashDollars: number, terms: PayTerms = V1_TERMS): number {
  return terms.version === "v2" ? round2(cashDollars + terms.taxDollars) : round2(cashDollars * (1 + CARD_FEE_RATE))
}

/** 刷卡尾款加小费：v1 小费也过 4%（Stripe 按全额收费）；v2 小费不含税。 */
export function cardPriceWithTip(cashBalanceDollars: number, tipDollars: number, terms: PayTerms = V1_TERMS): number {
  return terms.version === "v2" ? round2(cashBalanceDollars + terms.taxDollars + tipDollars) : cardPrice(cashBalanceDollars + tipDollars)
}

export type PaymentSplit = {
  /** 实际要刷的金额（分）= 客户选/填的数 */
  chargeCents: number
  /** 其中抵尾款的部分（分，现金口径） */
  towardBalanceCents: number
  /** 其中归师傅的小费（分，现金口径；v1 已扣掉手续费，v2 已扣掉税） */
  tipCents: number
}

/**
 * 一笔刷卡付款怎么拆。
 * @param amountDollars 客户付的刷卡总数（美元）
 * @param cashBalanceDollars 这单还欠多少（现金口径，美元，服务端现查）
 */
export function splitCardPayment(amountDollars: number, cashBalanceDollars: number, terms: PayTerms = V1_TERMS): PaymentSplit {
  const chargeCents = Math.max(0, Math.round(amountDollars * 100))
  const balanceCents = Math.max(0, Math.round(cashBalanceDollars * 100))
  // v2: the tax comes off the top (it is owed on the party, not on the tip);
  // a payment smaller than the tax is all tax, nothing toward the balance.
  const cashEquivalentCents =
    terms.version === "v2"
      ? Math.max(0, chargeCents - Math.round(terms.taxDollars * 100))
      : Math.round(chargeCents / (1 + CARD_FEE_RATE))
  const towardBalanceCents = Math.min(cashEquivalentCents, balanceCents)
  return {
    chargeCents,
    towardBalanceCents,
    tipCents: Math.max(0, cashEquivalentCents - balanceCents),
  }
}

/**
 * Stripe 结账页金额下面那行小字：只说付的是什么，**不写金额**。页面上给的全是
 * 刷卡价，这里要是再冒出一个现金口径的数（以前写 "Party balance $1283.00"，
 * 上面却是 $1,334.32），客人会以为收错了（老板 2026-10-01）。
 */
export function checkoutDescription(split: PaymentSplit, cashBalanceDollars: number, terms: PayTerms = V1_TERMS): string {
  const balanceCents = Math.max(0, Math.round(cashBalanceDollars * 100))
  const what =
    split.towardBalanceCents === 0
      ? "Gratuity for your chef"
      : split.tipCents > 0
        ? "Party balance + gratuity for your chef"
        : split.towardBalanceCents < balanceCents
          ? "Toward your party balance"
          : "Party balance"
  if (terms.version === "v2") return split.towardBalanceCents === 0 ? what : `${what} · sales tax included`
  return `${what} · 4% card fee included`
}

export const dollars = (c: number) => (c / 100).toFixed(2)
