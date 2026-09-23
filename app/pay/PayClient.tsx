"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

// 客户自己填总数的付款页。
//
// 2026-09-23 老板定的口径：**师傅当天一般已经和客户当面谈好付多少**，所以这页
// 不显示这单欠多少、不给 20/25/30 档位、也不替他算——一个输入框，填多少刷多少。
// 超出尾款的部分服务端会拆成师傅的小费。
//
// 手机优先：付款几乎全发生在短信点进来的 iPhone 上。

type Summary = {
  ok: boolean
  settled?: boolean
  error?: string
  clientName?: string
  eventDate?: string | null
  guests?: number | null
  tiers?: Array<{ rate: number; fillCents: number }>
}

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
      setData({ ok: false, error: "That link looks incomplete. Text us and we'll send a new one." })
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

  const pay = useCallback(async () => {
    if (!orderId || amountNumber <= 0) return
    setBusy(true)
    setErr(null)
    try {
      const r = await fetch("/api/pay/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ o: orderId, amount: amountNumber }),
      })
      const j = (await r.json()) as { ok?: boolean; url?: string; error?: string }
      if (!r.ok || !j.ok || !j.url) throw new Error(j.error || "We couldn't start the payment.")
      window.location.href = j.url
    } catch (e) {
      setErr(e instanceof Error ? e.message : "We couldn't start the payment.")
      setBusy(false)
    }
  }, [orderId, amountNumber])

  const shell = "mx-auto w-full max-w-[520px] px-5 py-12 sm:py-16"

  if (!data) {
    return (
      <div className={shell}>
        <div className="h-40 animate-pulse rounded-[28px] bg-surface" />
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

        {/* 快捷填数（老板 09-23 定）：点一下把含 4% 的全额填进上面的框，客户
            仍可以随手改。按钮是便利，不是选项——主体永远是那个输入框。 */}
        {(data.tiers?.length ?? 0) > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] text-clay-700">Or fill it in for me — balance plus tip, card fee included:</span>
            <div className="grid grid-cols-3 gap-2">
              {data.tiers!.map((t) => (
                <button
                  key={t.rate}
                  type="button"
                  onClick={() => setAmount((t.fillCents / 100).toFixed(2))}
                  className="flex flex-col items-center gap-0.5 rounded-2xl border-2 border-transparent bg-cream px-2 py-2.5 transition-colors hover:bg-gold-100"
                >
                  <span className="font-serif text-xl font-extrabold leading-none">{Math.round(t.rate * 100)}%</span>
                  <span className="text-[12px] tabular-nums text-clay-700">{usd(t.fillCents / 100)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 先说师傅为这场做了什么，再说超出的部分全归他（老板 09-23 定）。这几项
            和发票底部那句 Chef Gratuity 用同一套说法，都是我们真做的事。 */}
        <p className="m-0 text-[13px] leading-relaxed text-clay-700">
          Your chef brought the grill in, set up, cooked and performed at the table
          {typeof data.guests === "number" && data.guests > 0 ? ` for all ${data.guests} guests` : ""}, and cleaned up
          before leaving.{" "}
          <span className="font-semibold text-ink">Anything above the balance is their tip, 100% of it</span> — we keep
          none of it.
        </p>

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
