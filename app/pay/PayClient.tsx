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
  tiers?: Array<{ rate: number; tip: number; chargeCents: number }>
  noTipChargeCents?: number
}

/** 选了哪一档。custom = 自己填，none = 不给。 */
type TipMode = { kind: "tier"; rate: number } | { kind: "custom" } | { kind: "none" }

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
  const [mode, setMode] = useState<TipMode | null>(null)
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

  const tiers = data?.tiers ?? []

  const tipNumber = useMemo(() => {
    if (!mode) return 0
    if (mode.kind === "none") return 0
    if (mode.kind === "tier") return tiers.find((t) => t.rate === mode.rate)?.tip ?? 0
    const n = Number.parseFloat(tip.replace(/[^0-9.]/g, ""))
    return Number.isFinite(n) && n > 0 ? n : 0
  }, [mode, tip, tiers])

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

  const settled = Boolean(data.settled)
  const dateLabel = prettyDate(data.eventDate)
  // POS 机也要先点一下才能付。没选过档位就不放行——避免客人以为自己给了小费
  // 结果按了个默认值，也避免我们替他决定。
  const canPay = mode !== null && (settled ? tipNumber > 0 : true)

  return (
    <div className={shell}>
      <span className="inline-block rounded-full bg-gold-100 px-4 py-1.5 text-xs font-semibold tracking-wide text-gold-800">
        {settled ? "Paid in full" : "Balance due"}
      </span>
      <h1 className="mt-5 font-serif text-4xl font-extrabold leading-[1.08] tracking-tight">
        {settled
          ? `Thank you${data.clientName ? `, ${data.clientName}` : ""}`
          : `${data.clientName ? `${data.clientName}, here's` : "Here's"} your balance`}
      </h1>
      {dateLabel && (
        <p className="mt-3 text-[17px] text-clay-700">
          {dateLabel} party{data.guests ? ` · ${data.guests} guests` : ""}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-4 rounded-[28px] bg-surface p-6">
        {settled ? (
          <p className="m-0 text-[17px] leading-relaxed">
            Your party is paid in full — nothing is owed. This page is only here if you&apos;d like to add
            something for your chef.
          </p>
        ) : (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[17px]">Balance</span>
            <span className="font-serif text-2xl font-extrabold tabular-nums">{usd(data.balanceDue ?? 0)}</span>
          </div>
        )}

        <div className="h-px bg-black/10" />

        <div className="flex flex-col gap-3">
          <span className="text-[15px] font-bold">Tip for your chef</span>
          <span className="text-[13px] leading-relaxed text-clay-700">
            Optional — it goes straight to the chef who cooked for you.
          </span>

          {/* 餐厅 POS 机那种档位（老板 09-23 定）：一排大按钮，每个把百分比和
              金额都印出来，客人一眼就知道按下去是多少钱。 */}
          <div className="grid grid-cols-3 gap-2">
            {tiers.map((t) => {
              const on = mode?.kind === "tier" && mode.rate === t.rate
              return (
                <button
                  key={t.rate}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setMode({ kind: "tier", rate: t.rate })}
                  className={`flex flex-col items-center gap-0.5 rounded-2xl border-2 px-2 py-3.5 transition-colors ${
                    on ? "border-flame bg-flame-100" : "border-transparent bg-cream hover:bg-gold-100"
                  }`}
                >
                  <span className="font-serif text-2xl font-extrabold leading-none">
                    {Math.round(t.rate * 100)}%
                  </span>
                  <span className="text-[13px] tabular-nums text-clay-700">{usd(t.tip)}</span>
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={mode?.kind === "custom"}
              onClick={() => setMode({ kind: "custom" })}
              className={`rounded-2xl border-2 px-3 py-2.5 text-[15px] font-semibold transition-colors ${
                mode?.kind === "custom" ? "border-flame bg-flame-100" : "border-transparent bg-cream hover:bg-gold-100"
              }`}
            >
              Custom
            </button>
            <button
              type="button"
              aria-pressed={mode?.kind === "none"}
              onClick={() => setMode({ kind: "none" })}
              className={`rounded-2xl border-2 px-3 py-2.5 text-[15px] font-semibold transition-colors ${
                mode?.kind === "none" ? "border-flame bg-flame-100" : "border-transparent bg-cream hover:bg-gold-100"
              }`}
            >
              No tip
            </button>
          </div>

          {mode?.kind === "custom" && (
            <label className="mt-1 flex items-center gap-2 rounded-2xl bg-cream px-4 py-3">
              <span className="text-xl font-bold text-clay-700">$</span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                placeholder="0"
                value={tip}
                onChange={(e) => setTip(e.target.value.replace(/[^0-9.]/g, "").slice(0, 7))}
                className="w-full bg-transparent text-2xl font-bold tabular-nums outline-none"
                aria-label="Tip amount in dollars"
              />
            </label>
          )}
        </div>

        <div className="h-px bg-black/10" />

        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[17px] font-bold">{settled ? "Tip total" : "You'll be charged"}</span>
          <span className="font-serif text-3xl font-extrabold tabular-nums">{usd(total)}</span>
        </div>
        <span className="-mt-2 text-[13px] leading-relaxed text-clay-700">
          Includes the 4% the card network charges to process a payment. Paying cash on the day skips it.
        </span>

        <button
          type="button"
          onClick={() => void pay()}
          disabled={busy || !canPay}
          className="mt-1 rounded-full bg-flame px-6 py-4 text-center text-[17px] font-semibold text-cream transition-colors hover:bg-flame-800 disabled:opacity-50"
        >
          {busy ? "Opening secure checkout…" : canPay ? `Pay ${usd(total)}` : "Choose a tip above"}
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
