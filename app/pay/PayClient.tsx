"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

// 客户自己填小费的尾款页（老板 2026-09-23 定：不给档位，直接填）。
//
// 尾款金额是死的——页面只显示，不给改，服务端也不接受客户端传的尾款。客户
// 能决定的只有小费，因为那本来就是他的决定。
//
// 手机优先：付款几乎全发生在短信点进来的 iPhone 上。

type Summary = {
  ok: boolean
  settled?: boolean
  error?: string
  clientName?: string
  eventDate?: string | null
  guests?: number | null
  balanceDue?: number
  invoiceIsCard?: boolean
  twentyPercentTip?: number | null
  noTipChargeCents?: number
}

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 })

const CARD_FEE_RATE = 0.04

/** 和 lib/pay-link-math.ts 同一套规则；这里只为了实时显示，真金额服务端再算一遍。 */
function charge(balanceDue: number, tip: number, invoiceIsCard: boolean): number {
  const b = Math.round(balanceDue * 100)
  const t = Math.round(Math.max(0, tip) * 100)
  const fee = (c: number) => Math.round(c * (1 + CARD_FEE_RATE))
  return (invoiceIsCard ? b + fee(t) : fee(b + t)) / 100
}

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
  const [tip, setTip] = useState("")
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
        if (!cancelled) setData({ ok: false, error: "We couldn't load your balance. Text us and we'll sort it." })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orderId])

  const tipNumber = useMemo(() => {
    const n = Number.parseFloat(tip.replace(/[^0-9.]/g, ""))
    return Number.isFinite(n) && n > 0 ? n : 0
  }, [tip])

  const total = useMemo(() => {
    if (!data?.ok || !data.balanceDue) return 0
    return charge(data.balanceDue, tipNumber, Boolean(data.invoiceIsCard))
  }, [data, tipNumber])

  const pay = useCallback(async () => {
    if (!orderId) return
    setBusy(true)
    setErr(null)
    try {
      const r = await fetch("/api/pay/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ o: orderId, tip: tipNumber }),
      })
      const j = (await r.json()) as { ok?: boolean; url?: string; error?: string }
      if (!r.ok || !j.ok || !j.url) throw new Error(j.error || "We couldn't start the payment.")
      window.location.href = j.url
    } catch (e) {
      setErr(e instanceof Error ? e.message : "We couldn't start the payment.")
      setBusy(false)
    }
  }, [orderId, tipNumber])

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

  if (data.settled) {
    return (
      <div className={shell}>
        <h1 className="font-serif text-3xl font-extrabold leading-tight">
          You&apos;re all paid up{data.clientName ? `, ${data.clientName}` : ""}.
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-clay-700">
          Nothing left on this party. If that doesn&apos;t look right, text us at 213-770-7788.
        </p>
      </div>
    )
  }

  const dateLabel = prettyDate(data.eventDate)

  return (
    <div className={shell}>
      <span className="inline-block rounded-full bg-gold-100 px-4 py-1.5 text-xs font-semibold tracking-wide text-gold-800">
        Balance due
      </span>
      <h1 className="mt-5 font-serif text-4xl font-extrabold leading-[1.08] tracking-tight">
        {data.clientName ? `${data.clientName}, here's` : "Here's"} your balance
      </h1>
      {dateLabel && (
        <p className="mt-3 text-[17px] text-clay-700">
          {dateLabel} party{data.guests ? ` · ${data.guests} guests` : ""}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-4 rounded-[28px] bg-surface p-6">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[17px]">Balance</span>
          <span className="font-serif text-2xl font-extrabold tabular-nums">{usd(data.balanceDue ?? 0)}</span>
        </div>

        <div className="h-px bg-black/10" />

        <label className="flex flex-col gap-2">
          <span className="text-[15px] font-bold">Tip for your chef</span>
          <span className="text-[13px] leading-relaxed text-clay-700">
            Optional, and entirely yours to decide — it goes straight to the chef who cooked for you.
            {typeof data.twentyPercentTip === "number" && data.twentyPercentTip > 0
              ? ` For reference, 20% of your party is ${usd(data.twentyPercentTip)}.`
              : ""}
          </span>
          <span className="mt-1 flex items-center gap-2 rounded-2xl bg-cream px-4 py-3">
            <span className="text-xl font-bold text-clay-700">$</span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={tip}
              onChange={(e) => setTip(e.target.value.replace(/[^0-9.]/g, "").slice(0, 7))}
              className="w-full bg-transparent text-2xl font-bold tabular-nums outline-none"
              aria-label="Tip amount in dollars"
            />
          </span>
        </label>

        <div className="h-px bg-black/10" />

        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[17px] font-bold">You&apos;ll be charged</span>
          <span className="font-serif text-3xl font-extrabold tabular-nums">{usd(total)}</span>
        </div>
        <span className="-mt-2 text-[13px] leading-relaxed text-clay-700">
          Includes the 4% the card network charges to process a payment. Paying cash on the day skips it.
        </span>

        <button
          type="button"
          onClick={() => void pay()}
          disabled={busy}
          className="mt-1 rounded-full bg-flame px-6 py-4 text-center text-[17px] font-semibold text-cream transition-colors hover:bg-flame-800 disabled:opacity-70"
        >
          {busy ? "Opening secure checkout…" : `Pay ${usd(total)}`}
        </button>
        {err && <span className="text-[13px] leading-snug text-flame-800">{err}</span>}
        <span className="text-center text-xs text-clay-700">Card payment handled by Stripe. We never see your card.</span>
      </div>

      <p className="mt-6 text-center text-[13px] leading-relaxed text-clay-700">
        Questions about this bill? Text 213-770-7788.
      </p>
    </div>
  )
}
