"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { zelleVenmoPriceOf } from "@/config/pricing-rules"
import { splitCardPayment, V1_TERMS, type PayTerms } from "@/lib/pay-link-math"

// 付款页。
//
// 专属链接（/pay?o=<订单>，2026-10-01 老板定）：从这里付一定是刷卡，所以页面
// **只给刷卡价**——尾款（已含 4%）、加 20% 小费、加 25% 小费、或自己填，点一个
// 就付，客人不用算也算不错。4% 只用一行小字带过。选"只付尾款"时先弹一个框，
// 说清楚小费付的是师傅哪些活；已经现金给过小费的直接付，真有不满意的可以留话。
//
// 口径（D-1006-05/06，2026-10-06）：10-06 起的单一个标价两张账。页面大数仍是刷卡账
// （现金尾款 + 派对地址的销售税 + Stripe 手续费 2.9% + 30¢ + 选的小费），大数下面
// 列税和手续费两行，再给一行 "Other ways to pay"：现金给师傅 $X（含税）。
// 数全由 /api/pay/summary 从发票引擎搬来，页面不算税。老单（v1）文案不变。
//
// 通用链接（/pay 不带订单号）：客人自己填名字、手机和金额，不变。
//
// 手机优先：付款几乎全发生在短信点进来的 iPhone 上。

type Summary = {
  ok: boolean
  /** 没有订单号的通用收款链接 */
  openLink?: boolean
  settled?: boolean
  error?: string
  clientName?: string
  eventDate?: string | null
  guests?: number | null
  /** 刷卡尾款（v1 已含 4%；v2 = 现金尾款 + 税 + 手续费）。已结清或没有金额时为 null。 */
  cardBalance?: number | null
  /** v1 = 含税价 + 4%（10-05 及之前的单）；v2 = 一个标价两张账（10-06 起，D-1006-05/06）。 */
  terms?: "v1" | "v2"
  /** v2 的两张账和刷卡账下面的两行，发票引擎算好给的；v1 没有。 */
  v2?: {
    taxDue: number
    taxRate: number
    /** 如 "10.75%" */
    taxRateLabel: string
    /** 发票还没按派对地址定税率：数是估的 */
    taxEstimated: boolean
    /** 只付尾款时的手续费（2.9% + 30¢，按实刷算） */
    processingFee: number
    /** 派对本身的现金尾款（不含发票上已选的小费），拆账用 */
    cashBalance: number
    /** 现金给师傅的数（含已选小费） */
    cashDue: number
  }
  /** 发票上已经选好小费时，尾款里含的那份小费（现金口径）；此时没有小费档位。 */
  gratuityIncluded?: number | null
  tipOptions?: Array<{ rate: number; tip: number; total: number; fee?: number }>
}

type Choice = "balance" | "tip20" | "tip25" | "other"

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 })

function prettyDate(iso?: string | null): string {
  if (!iso) return ""
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return ""
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" })
}

export default function PayClient() {
  const [orderId, setOrderId] = useState<string | null>(null)
  const [data, setData] = useState<Summary | null>(null)
  const [amount, setAmount] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // 通用链接（不带 ?o=）用的两个字段，见下面 openLink 分支。
  const [payerName, setPayerName] = useState("")
  const [payerPhone, setPayerPhone] = useState("")
  // 专属链接的选项、"只付尾款"前的说明框、以及留话。
  const [choice, setChoice] = useState<Choice | null>(null)
  const [tipCheck, setTipCheck] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [feedbackSent, setFeedbackSent] = useState(false)

  // useSearchParams 会把整页推成 CSR（仓库里踩过），一律读 window.location。
  useEffect(() => {
    try {
      setOrderId((new URLSearchParams(window.location.search).get("o") ?? "").trim())
    } catch {
      setOrderId("")
    }
  }, [])

  useEffect(() => {
    if (orderId === null) return
    if (!orderId) {
      // 老板 2026-09-25：要一条不用每次重新生成的收款链接。没有订单号就是
      // 通用模式——客人自己填名字、手机和金额，后台按手机号去认订单。
      setData({ ok: true, openLink: true })
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const r = await fetch(`/api/pay/summary?o=${encodeURIComponent(orderId)}`, { cache: "no-store" })
        const j = (await r.json()) as Summary
        if (!cancelled) setData(j)
      } catch {
        if (!cancelled) setData({ ok: false, error: "We couldn't load your party. Text us and we'll sort it." })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orderId])

  const amountNumber = useMemo(() => {
    const n = Number.parseFloat(amount.replace(/[^0-9.]/g, ""))
    return Number.isFinite(n) && n > 0 ? n : 0
  }, [amount])

  const pay = useCallback(async (override?: number) => {
    const payAmount = typeof override === "number" ? override : amountNumber
    if (payAmount <= 0) return
    if (!orderId && (!payerName.trim() || payerPhone.replace(/\D/g, "").length < 10)) {
      setErr("Add your name and mobile number so we can match the payment to your party.")
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const r = await fetch("/api/pay/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          orderId
            ? { o: orderId, amount: payAmount }
            : { amount: payAmount, name: payerName.trim(), phone: payerPhone.trim() },
        ),
      })
      const j = (await r.json()) as { ok?: boolean; url?: string; error?: string }
      if (!r.ok || !j.ok || !j.url) throw new Error(j.error || "We couldn't start the payment.")
      window.location.href = j.url
    } catch (e) {
      setErr(e instanceof Error ? e.message : "We couldn't start the payment.")
      setBusy(false)
    }
  }, [orderId, amountNumber, payerName, payerPhone])

  // 顶部要避开 60px 的固定导航，否则上面那个小标签会被盖掉一截。
  const shell = "mx-auto w-full max-w-[520px] px-5 pb-12 pt-20 sm:pb-16 sm:pt-24"

  if (!data) {
    return (
      <div className={shell}>
        <div className="h-40 animate-pulse rounded-[28px] bg-surface" />
      </div>
    )
  }

  if (data.openLink) {
    const field =
      "mt-1 w-full rounded-2xl border-2 border-line bg-white px-4 py-3 text-[17px] outline-none focus:border-flame"
    return (
      <div className={shell}>
        <span className="inline-block rounded-full bg-gold-100 px-4 py-1.5 text-xs font-semibold tracking-wide text-gold-800">
          Pay Real Hibachi
        </span>
        <h1 className="mt-5 font-serif text-4xl font-extrabold leading-[1.08] tracking-tight">Pay by card</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-clay-700">
          Enter the amount you agreed with us and pay right here. Card payments are secured by Stripe.
        </p>

        <label className="mt-7 block text-[15px] font-semibold text-ink">
          Your name
          <input
            className={field}
            value={payerName}
            onChange={(e) => setPayerName(e.target.value)}
            placeholder="First and last name"
            autoComplete="name"
          />
        </label>
        <label className="mt-4 block text-[15px] font-semibold text-ink">
          Mobile number
          <input
            className={field}
            value={payerPhone}
            onChange={(e) => setPayerPhone(e.target.value)}
            placeholder="(213) 555-0123"
            inputMode="tel"
            autoComplete="tel"
          />
        </label>
        <label className="mt-4 block text-[15px] font-semibold text-ink">
          Amount
          <input
            className={field}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="$0.00"
            inputMode="decimal"
          />
        </label>

        {err ? <p className="mt-4 text-[15px] font-semibold text-flame-800">{err}</p> : null}

        <button
          type="button"
          onClick={() => void pay()}
          disabled={busy || amountNumber <= 0}
          className="mt-7 w-full rounded-full bg-flame px-6 py-4 text-[17px] font-semibold text-cream disabled:opacity-60"
        >
          {busy ? "Opening secure checkout…" : amountNumber > 0 ? `Pay ${usd(amountNumber)}` : "Enter an amount"}
        </button>
        <p className="mt-5 text-[14px] leading-relaxed text-clay-700">
          Paying for a party we already have on the books? Your name and number are all we need to match it up.
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-clay-700">
          Questions about the amount? Text 213-770-7788.
        </p>
      </div>
    )
  }

  if (!data.ok) {
    return (
      <div className={shell}>
        <h1 className="font-serif text-3xl font-extrabold leading-tight">We couldn&apos;t open that link</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-clay-700">{data.error}</p>
        <a
          href="sms:+12137707788"
          className="mt-7 inline-block rounded-full bg-flame px-6 py-3.5 font-semibold text-cream"
        >
          Text us: 213-770-7788
        </a>
      </div>
    )
  }

  const settled = Boolean(data.settled)
  const dateLabel = prettyDate(data.eventDate)
  const cardBalance = typeof data.cardBalance === "number" && data.cardBalance > 0 ? data.cardBalance : null
  const tip20 = data.tipOptions?.find((o) => Math.abs(o.rate - 0.2) < 1e-9) ?? null
  const tip25 = data.tipOptions?.find((o) => Math.abs(o.rate - 0.25) < 1e-9) ?? null
  const tipIncluded = typeof data.gratuityIncluded === "number" && data.gratuityIncluded > 0 ? data.gratuityIncluded : null

  const sendFeedback = async () => {
    if (feedback.trim().length < 2 || !orderId) return
    try {
      const r = await fetch("/api/pay/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ o: orderId, message: feedback.trim() }),
      })
      if (r.ok) setFeedbackSent(true)
      else setErr("We couldn't send that - text 213-770-7788 and we'll call you.")
    } catch {
      setErr("We couldn't send that - text 213-770-7788 and we'll call you.")
    }
  }

  // ---- priced order link: card prices only -------------------------------
  if (!settled && cardBalance !== null) {
    const chosenAmount =
      choice === "balance"
        ? cardBalance
        : choice === "tip20" && tip20
          ? tip20.total
          : choice === "tip25" && tip25
            ? tip25.total
            : choice === "other"
              ? amountNumber
              : 0
    // v1：刷卡尾款 = 现金尾款 × 1.04 取到分，÷1.04 再取到分正好还原现金尾款；
    // v2：现金尾款、税都是接口给的。用它跑和服务端同一个拆账，
    // "Other amount" 下面显示的小费和手续费才和记账一致。
    const v2 = data.terms === "v2" && data.v2 ? data.v2 : null
    const terms: PayTerms = v2
      ? { version: "v2", taxDollars: Math.max(0, v2.taxDue), taxRate: v2.taxRate, taxRateSource: v2.taxEstimated ? "default" : "address", cashBalance: v2.cashBalance }
      : V1_TERMS
    const cashBalance = v2 ? v2.cashBalance : Math.round(Math.round(cardBalance * 100) / 1.04) / 100
    const otherSplit = choice === "other" && amountNumber > 0 ? splitCardPayment(amountNumber, cashBalance, terms) : null
    const otherTipCents = otherSplit?.tipCents ?? 0
    // The card-processing line under the headline follows the amount being paid.
    const shownFee = !v2
      ? 0
      : choice === "tip20" && tip20
        ? tip20.fee ?? v2.processingFee
        : choice === "tip25" && tip25
          ? tip25.fee ?? v2.processingFee
          : otherSplit
            ? otherSplit.feeCents / 100
            : v2.processingFee
    const option = (key: Choice, label: string, sub: string | null, value: number | null) => (
      <button
        key={key}
        type="button"
        onClick={() => {
          setChoice(key)
          setTipCheck(false)
          setErr(null)
        }}
        className={`flex w-full items-center justify-between rounded-2xl border-2 px-5 py-4 text-left transition-colors ${
          choice === key ? "border-flame bg-cream" : "border-line bg-white"
        }`}
      >
        <span className="flex flex-col">
          <span className="text-[16px] font-bold text-ink">{label}</span>
          {sub ? <span className="text-[13px] text-clay-700">{sub}</span> : null}
        </span>
        {value !== null ? <span className="text-[18px] font-extrabold tabular-nums text-ink">{usd(value)}</span> : null}
      </button>
    )

    return (
      <div className={shell}>
        <span className="inline-block rounded-full bg-gold-100 px-4 py-1.5 text-xs font-semibold tracking-wide text-gold-800">
          Pay for your party
        </span>
        <h1 className="mt-5 font-serif text-4xl font-extrabold leading-[1.08] tracking-tight">
          {data.clientName ? `${data.clientName}, ` : ""}pay your balance
        </h1>
        {dateLabel && (
          <p className="mt-3 text-[17px] text-clay-700">
            {dateLabel} party{data.guests ? ` · ${data.guests} guests` : ""}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3 rounded-[28px] bg-surface p-6">
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] font-bold">Your balance</span>
            {/* "(card price)" under the number - owner 10-01; one line doesn't fit a phone. */}
            <span className="flex flex-col items-end">
              <span className="text-[26px] font-extrabold leading-tight tabular-nums">{usd(cardBalance)}</span>
              <span className="text-[12px] text-clay-700">(card price)</span>
            </span>
          </div>
          {tipIncluded ? (
            <span className="-mt-2 text-[13px] text-clay-700">Includes {usd(tipIncluded)} gratuity for your chef</span>
          ) : null}
          {v2 ? (
            <div className="-mt-1 flex flex-col gap-0.5 text-[13px] text-clay-700">
              <span className="flex justify-between gap-3">
                <span>Sales tax ({v2.taxRateLabel})</span>
                <span className="tabular-nums">{usd(v2.taxDue)}</span>
              </span>
              <span className="flex justify-between gap-3">
                <span>Card processing (2.9% + 30¢)</span>
                <span className="tabular-nums">{usd(shownFee)}</span>
              </span>
              <span className="mt-1">Add your chef&apos;s gratuity here, or tip them in person on the day.</span>
            </div>
          ) : null}

          {tip20 ? option("tip20", "With 20% gratuity", `${usd(tip20.tip)} for your chef`, tip20.total) : null}
          {tip25 ? option("tip25", "With 25% gratuity", `${usd(tip25.tip)} for your chef`, tip25.total) : null}
          {option("balance", tipIncluded ? "Pay the balance" : "Balance only", null, cardBalance)}
          {option("other", "Other amount", null, null)}

          {choice === "other" ? (
            <label className="flex items-center gap-2 rounded-2xl bg-cream px-5 py-4">
              <span className="text-3xl font-bold text-clay-700">$</span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, "").slice(0, 8))}
                className="w-full bg-transparent text-4xl font-extrabold tabular-nums outline-none placeholder:text-clay-700/40"
                aria-label="Amount to pay in dollars"
              />
            </label>
          ) : null}
          {choice === "other" ? (
            <span className="text-[13px] text-clay-700">
              {otherTipCents > 0
                ? `${usd(otherTipCents / 100)} for your chef`
                : amountNumber > 0 && amountNumber < cardBalance
                  ? "This pays part of your balance."
                  : amountNumber > 0
                    ? "This pays your balance."
                    : `Enter more than ${usd(cardBalance)} to add a gratuity for your chef.`}
            </span>
          ) : null}

          {/* "Balance only": say what the gratuity is for before taking it (owner 10-01). */}
          {choice === "balance" && tipCheck ? (
            <div className="flex flex-col gap-3 rounded-2xl border-2 border-gold-200 bg-white p-5">
              <span className="text-[16px] font-bold text-ink">Before you go - what your chef&apos;s gratuity is for</span>
              <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-[14px] leading-relaxed text-clay-700">
                <li>Drove the grill, the propane and all of your food to you</li>
                <li>Set up the grill, the mats and the station before anyone ate</li>
                <li>Cooked every plate fresh, one guest at a time</li>
                <li>Put on the show at the grill</li>
                <li>Served{typeof data.guests === "number" && data.guests > 0 ? ` all ${data.guests} guests` : " every guest"}</li>
                <li>Cleaned the grill and packed everything out</li>
              </ul>
              <span className="text-[13px] text-clay-700">100% of the gratuity goes to your chef.</span>
              {tip20 ? (
                <button
                  type="button"
                  onClick={() => void pay(tip20.total)}
                  disabled={busy}
                  className="rounded-full bg-flame px-6 py-3.5 text-[16px] font-semibold text-cream disabled:opacity-50"
                >
                  Add 20% for my chef - {usd(tip20.total)}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void pay(cardBalance)}
                disabled={busy}
                className="rounded-full border-2 border-ink px-6 py-3.5 text-[16px] font-semibold text-ink disabled:opacity-50"
              >
                I already tipped my chef in cash - pay {usd(cardBalance)}
              </button>
              {!feedbackOpen && !feedbackSent ? (
                <button type="button" onClick={() => setFeedbackOpen(true)} className="text-[14px] font-semibold text-clay-700 underline">
                  Something wasn&apos;t right? Tell us
                </button>
              ) : null}
              {feedbackOpen && !feedbackSent ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value.slice(0, 2000))}
                    rows={4}
                    placeholder="What happened? Bling reads every one of these."
                    className="w-full rounded-2xl border-2 border-line bg-white px-4 py-3 text-[15px] outline-none focus:border-flame"
                  />
                  <button
                    type="button"
                    onClick={() => void sendFeedback()}
                    disabled={feedback.trim().length < 2}
                    className="rounded-full bg-ink px-6 py-3 text-[15px] font-semibold text-cream disabled:opacity-50"
                  >
                    Send to Bling
                  </button>
                </div>
              ) : null}
              {feedbackSent ? (
                <span className="text-[14px] font-semibold text-ink">
                  Thank you - Bling will read this today. You can still pay your balance above.
                </span>
              ) : null}
            </div>
          ) : null}

          {!(choice === "balance" && tipCheck) ? (
            <button
              type="button"
              onClick={() => {
                if (choice === "balance" && !tipIncluded) {
                  setTipCheck(true)
                  return
                }
                void pay(chosenAmount)
              }}
              disabled={busy || !choice || chosenAmount <= 0}
              className="mt-1 rounded-full bg-flame px-6 py-4 text-center text-[17px] font-semibold text-cream transition-colors hover:bg-flame-800 disabled:opacity-50"
            >
              {busy ? "Opening secure checkout…" : !choice ? "Choose an amount" : chosenAmount > 0 ? `Pay ${usd(chosenAmount)}` : "Enter an amount"}
            </button>
          ) : null}
          {err && <span className="text-[13px] leading-snug text-flame-800">{err}</span>}
          <span className="text-center text-xs text-clay-700">
            {v2 ? "The cash price includes sales tax reimbursement computed to the nearest mill." : "Prices include the 4% card processing fee."}
          </span>
          <span className="text-center text-xs text-clay-700">Card payment handled by Stripe. We never see your card.</span>
        </div>

        {v2 ? (
          <div className="mt-5 flex flex-col gap-2.5 rounded-[28px] border-2 border-line bg-white p-6">
            <span className="text-[15px] font-bold">Other ways to pay</span>
            <span className="text-[15px]">
              Cash to your chef on the day — <span className="font-bold tabular-nums">{usd(v2.cashDue)}</span> (tax included)
            </span>
            <span className="text-[15px]">
              Zelle or Venmo to your chef on the day — <span className="font-bold tabular-nums">{usd(zelleVenmoPriceOf(v2.cashDue))}</span>
            </span>
          </div>
        ) : null}

        <p className="mt-6 text-center text-[13px] leading-relaxed text-clay-700">
          Questions? Ask your chef or text 213-770-7788.
        </p>
      </div>
    )
  }

  // ---- paid in full (or no amount on file): add something for the chef -------
  return (
    <div className={shell}>
      <span className="inline-block rounded-full bg-gold-100 px-4 py-1.5 text-xs font-semibold tracking-wide text-gold-800">
        {settled ? "Paid in full" : "Pay for your party"}
      </span>
      <h1 className="mt-5 font-serif text-4xl font-extrabold leading-[1.08] tracking-tight">
        {settled
          ? `Thank you${data.clientName ? `, ${data.clientName}` : ""}`
          : `${data.clientName ? `${data.clientName}, ` : ""}pay your chef`}
      </h1>
      {dateLabel && (
        <p className="mt-3 text-[17px] text-clay-700">
          {dateLabel} party{data.guests ? ` · ${data.guests} guests` : ""}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-4 rounded-[28px] bg-surface p-6">
        <div className="flex flex-col gap-1.5">
          <span className="text-[15px] font-bold">
            {settled ? "Adding something for your chef?" : "How much are you paying?"}
          </span>
          <span className="text-[13px] leading-relaxed text-clay-700">
            {settled
              ? "Your party is paid in full — anything you enter here goes to your chef."
              : "Enter the total you agreed with your chef."}
          </span>
        </div>

        <label className="flex items-center gap-2 rounded-2xl bg-cream px-5 py-4">
          <span className="text-3xl font-bold text-clay-700">$</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, "").slice(0, 8))}
            className="w-full bg-transparent text-4xl font-extrabold tabular-nums outline-none placeholder:text-clay-700/40"
            aria-label="Amount to pay in dollars"
          />
        </label>

        <button
          type="button"
          onClick={() => void pay()}
          disabled={busy || amountNumber <= 0}
          className="mt-1 rounded-full bg-flame px-6 py-4 text-center text-[17px] font-semibold text-cream transition-colors hover:bg-flame-800 disabled:opacity-50"
        >
          {busy ? "Opening secure checkout…" : amountNumber > 0 ? `Pay ${usd(amountNumber)}` : "Enter an amount"}
        </button>
        {err && <span className="text-[13px] leading-snug text-flame-800">{err}</span>}
        <span className="text-center text-xs text-clay-700">
          Card payment handled by Stripe. We never see your card.
        </span>
      </div>

      <p className="mt-6 text-center text-[13px] leading-relaxed text-clay-700">
        Not sure of the amount? Text 213-770-7788.
      </p>
    </div>
  )
}
