"use client"

import { useEffect, useState } from "react"

// 手机优先（客户从短信点进来）。一屏事实 + 一个大按钮。
// 有问题的出口是"text us what to change"——sms: 协议要给桌面留降级
// （号码本身始终可见，这是 09-08 丢单换来的规矩）。

type Summary = {
  ok: boolean
  error?: string
  orderNo?: string | null
  firstName?: string
  dateLabel?: string | null
  timeLabel?: string | null
  address?: string | null
  adults?: number
  kids?: number
  littles?: number
  menuKnown?: boolean
  proteins?: Array<{ label: string; servings: number }>
  tableHeads?: number
  utensilHeads?: number
  allergies?: string[]
  totalCents?: number | null
  state?: "pending" | "confirmed" | "stale"
  confirmedAt?: string | null
}

const usd = (c: number) => (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })

export default function ConfirmClient() {
  const [orderId, setOrderId] = useState<string | null>(null)
  const [data, setData] = useState<Summary | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
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
    if (!orderId) return
    fetch(`/api/confirm-invoice?o=${encodeURIComponent(orderId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Summary) => setData(d))
      .catch(() => setData({ ok: false, error: "Could not load — please text us." }))
  }, [orderId])

  const confirm = async () => {
    if (!orderId || busy) return
    setBusy(true)
    setErr(null)
    try {
      const r = await fetch("/api/confirm-invoice", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId }) })
      const d = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (!r.ok || !d?.ok) throw new Error(d?.error ?? "Could not save")
      setDone(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save — please text us.")
    } finally {
      setBusy(false)
    }
  }

  const smsBody = encodeURIComponent(`Hi Real Hibachi, one thing to change on ${data?.orderNo ?? "my party"}: `)

  if (orderId !== null && !orderId) {
    return <Shell title="This link isn't valid.">Text us at <PhoneLink /> and we&apos;ll send a fresh one.</Shell>
  }
  if (!data) {
    return <Shell title="One moment…">Loading your party details.</Shell>
  }
  if (!data.ok) {
    return <Shell title={data.error ?? "This link isn't valid."}>Text us at <PhoneLink /> and we&apos;ll sort it out.</Shell>
  }

  const confirmed = done || data.state === "confirmed"
  const rows: Array<[string, string]> = []
  if (data.dateLabel) rows.push(["Date", `${data.dateLabel}${data.timeLabel ? ` · ${data.timeLabel}` : ""}`])
  if (data.address) rows.push(["Address", data.address])
  rows.push(["Guests", `${data.adults} adult${data.adults === 1 ? "" : "s"}${data.kids ? ` · ${data.kids} kid${data.kids === 1 ? "" : "s"}` : ""}${data.littles ? ` · ${data.littles} little (3–4, free)` : ""}`])
  if (data.menuKnown && data.proteins?.length) rows.push(["Menu", data.proteins.map((p) => `${p.label} ×${p.servings}`).join(" · ")])
  if (data.tableHeads) rows.push(["Tables & chairs", `for ${data.tableHeads}`])
  if (data.utensilHeads) rows.push(["Utensils & tableware", `for ${data.utensilHeads}`])
  if (data.allergies?.length) rows.push(["Allergies", data.allergies.join(" · ")])
  if (data.totalCents) rows.push(["Party total", usd(data.totalCents)])

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-flame">Real Hibachi</p>
      <h1 className="mt-2 font-display text-3xl font-bold">
        {confirmed ? `All set, ${data.firstName}! 🎉` : `Quick check, ${data.firstName}`}
      </h1>
      <p className="mt-2 text-sm text-ink/70">
        {confirmed
          ? "You've confirmed these details — your chef preps from exactly this."
          : "30 seconds: make sure everything below is exactly right, then tap confirm."}
      </p>

      <div className="mt-6 divide-y divide-ink/10 rounded-2xl border border-ink/15 bg-white shadow-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-4 px-4 py-3">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-ink/50 pt-0.5">{k}</span>
            <span className="text-right text-sm font-semibold">{v}</span>
          </div>
        ))}
        {!data.menuKnown ? <div className="px-4 py-3 text-sm text-ink/60">Menu picks are still open — you can set them on your party planner link.</div> : null}
      </div>

      {confirmed ? (
        <div className="mt-6 rounded-2xl bg-ink px-5 py-4 text-center text-cream">
          <p className="text-lg font-bold">✓ Confirmed</p>
          <p className="mt-1 text-xs text-cream/70">Anything changes later? Just text us — we&apos;ll update it and send this page again.</p>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={busy}
            className="mt-6 w-full rounded-2xl bg-flame px-5 py-4 text-lg font-bold text-white shadow-md transition active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? "Saving…" : "Everything's right — confirm ✓"}
          </button>
          {err ? <p className="mt-2 text-sm text-flame">{err}</p> : null}
        </>
      )}

      <p className="mt-5 text-center text-sm text-ink/70">
        Something&apos;s off?{" "}
        <a className="font-semibold underline" href={`sms:+12137707788&body=${smsBody}`}>
          Text us what to change
        </a>
        <br />
        <span className="text-xs text-ink/50">(213) 770-7788</span>
      </p>
    </div>
  )
}

function PhoneLink() {
  return (
    <a className="font-semibold underline" href="sms:+12137707788">
      (213) 770-7788
    </a>
  )
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-flame">Real Hibachi</p>
      <h1 className="mt-3 font-display text-2xl font-bold">{title}</h1>
      <p className="mt-3 text-sm text-ink/70">{children}</p>
    </div>
  )
}
