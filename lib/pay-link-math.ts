// /pay 的金额拆账。
//
// 两套口径（config/pricing-rules.ts 的 PricingTerms）：
//
//   v1（2026-10-05 及之前建的单）：价格含税，刷卡 +4%。专属链接
//   只给刷卡价（老板 2026-10-01 定）：尾款 ×1.04，再给"加 20% / 25% 小费"的总数。
//   拆账先换回现金口径（÷1.04）再抵尾款，剩下的是师傅的小费——以前把 4% 整个
//   记成了小费（Daria，2026-10-01：$1,600 里记了 $264.65 小费，其中 $53.41 是手续费）。
//
//   v2 "by method"（2026-10-06 起，决策日志 D-1006-05/06）：一个标价，两张账。
//   现金 = 标价（含税）；
//   刷卡 = 标价 + 派对地址的实际销售税 + Stripe 手续费 2.9% + 30¢ + 放在卡上的小费。
//   /pay 走的是 Stripe，所以页面上的大数是刷卡账：现金尾款 + 这单的税 + 小费，
//   再按实刷金额算手续费。税是派对的（发票引擎按地址算好给过来，这里不用常数
//   重算），小费不含税。拆账：先扣手续费和税，再抵尾款，剩下的是小费。

import { cardProcessingFeeOn, STRIPE_FEE_FIXED, STRIPE_FEE_RATE } from "@/config/pricing-rules"

/** v1 的 4%（含税价上加）。v2 不用它。 */
export const CARD_FEE_RATE = 0.04

/**
 * 这单按哪套口径。v2 带着发票引擎给的数：这单的税（美元）、税率（显示用，
 * 如 0.1075）、派对本身的现金尾款（不含发票上已选的小费）。
 */
export type PayTerms =
  | { version: "v1" }
  | {
      version: "v2"
      taxDollars: number
      taxRate: number
      /** 税率是不是按派对地址定的；"default" 表示发票还没定税率，页面要标"估"。 */
      taxRateSource: "address" | "default" | "none"
      cashBalance: number
    }
export const V1_TERMS: PayTerms = { version: "v1" }

const round2 = (n: number) => Math.round(n * 100) / 100

/** 刷卡要刷多少：v2 = 现金尾款 + 税 + 小费 + 按这笔实刷算的手续费。 */
function v2CardCharge(cashBalanceDollars: number, tipDollars: number, taxDollars: number): { charge: number; fee: number } {
  const beforeFee = round2(Math.max(0, cashBalanceDollars) + Math.max(0, taxDollars) + Math.max(0, tipDollars))
  const fee = cardProcessingFeeOn(beforeFee)
  return { charge: round2(beforeFee + fee), fee }
}

/** 现金尾款换成刷卡尾款：v1 ×1.04；v2 加税再加手续费。 */
export function cardPrice(cashDollars: number, terms: PayTerms = V1_TERMS): number {
  return terms.version === "v2" ? v2CardCharge(cashDollars, 0, terms.taxDollars).charge : round2(cashDollars * (1 + CARD_FEE_RATE))
}

/** 刷卡尾款加小费：v1 小费也过 4%（Stripe 按全额收费）；v2 小费不含税，手续费按全额。 */
export function cardPriceWithTip(cashBalanceDollars: number, tipDollars: number, terms: PayTerms = V1_TERMS): number {
  return terms.version === "v2" ? v2CardCharge(cashBalanceDollars, tipDollars, terms.taxDollars).charge : cardPrice(cashBalanceDollars + tipDollars)
}

/** v2 刷卡账里的手续费那一行（按这笔实刷算）。v1 返回 0（4% 在价里，不单列）。 */
export function cardProcessingFeeFor(cashBalanceDollars: number, tipDollars: number, terms: PayTerms = V1_TERMS): number {
  return terms.version === "v2" ? v2CardCharge(cashBalanceDollars, tipDollars, terms.taxDollars).fee : 0
}

export type PaymentSplit = {
  /** 实际要刷的金额（分）= 客户选/填的数 */
  chargeCents: number
  /** 其中抵尾款的部分（分，现金口径） */
  towardBalanceCents: number
  /** 其中归师傅的小费（分，现金口径；v1 已扣掉手续费，v2 已扣掉税和手续费） */
  tipCents: number
  /** 其中的手续费（分）：v1 是 4% 那块，v2 是 Stripe 2.9% + 30¢。 */
  feeCents: number
  /** 其中的销售税（分）：v2 这单的税，v1 为 0（含在价里）。 */
  taxCents: number
}

/**
 * 一笔刷卡付款怎么拆。
 * @param amountDollars 客户付的刷卡总数（美元）
 * @param cashBalanceDollars 这单还欠多少（现金口径，美元，服务端现查）
 */
export function splitCardPayment(amountDollars: number, cashBalanceDollars: number, terms: PayTerms = V1_TERMS): PaymentSplit {
  const chargeCents = Math.max(0, Math.round(amountDollars * 100))
  const balanceCents = Math.max(0, Math.round(cashBalanceDollars * 100))
  let feeCents: number
  let taxCents: number
  if (terms.version === "v2") {
    // The fee is what Stripe takes on THIS charge: 2.9% + 30c of the gross.
    // The bill was grossed up with the same rule (cardProcessingFeeOn), so a
    // customer paying the full card balance covers the cash balance to the
    // cent and the rest is the tip; the tax comes off the top (it is owed on
    // the party, not on the tip); a payment smaller than tax + fee buys
    // nothing toward the balance.
    feeCents = Math.round(chargeCents * STRIPE_FEE_RATE + STRIPE_FEE_FIXED * 100)
    taxCents = Math.round(Math.max(0, terms.taxDollars) * 100)
  } else {
    feeCents = chargeCents - Math.round(chargeCents / (1 + CARD_FEE_RATE))
    taxCents = 0
  }
  const cashEquivalentCents = Math.max(0, chargeCents - feeCents - taxCents)
  const towardBalanceCents = Math.min(cashEquivalentCents, balanceCents)
  return {
    chargeCents,
    towardBalanceCents,
    tipCents: Math.max(0, cashEquivalentCents - balanceCents),
    feeCents,
    taxCents,
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
  if (terms.version === "v2") return split.towardBalanceCents === 0 ? `${what} · with card processing` : `${what} · with sales tax and card processing`
  return `${what} · 4% card fee included`
}

export const dollars = (c: number) => (c / 100).toFixed(2)
