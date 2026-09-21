"use client"

import { useCallback, useEffect, useState } from "react"

// ============================================================
// 已发送的发票 · the audit copies of every invoice sent for one order
// ============================================================
// Lists public.invoice_archive rows through /api/admin/invoice-archive and
// opens the archived document - exactly what the customer was sent - in a
// new tab. The customer's own link dies after 30 days and the saved invoice
// is only the current version; this is the copy that does not change.
// Built 2026-09-19 after the owner asked where the final copy of a sent
// invoice lives for audit.

type Send = {
  id: string
  sent_to: string | null
  totals: { finalTotal?: number; deposit?: number; balanceDue?: number } | null
  source: string
  note: string | null
  has_pdf?: boolean
  created_at: string
}

const PT = "America/Los_Angeles"

function stamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { timeZone: PT, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
}

function money(n: unknown): string {
  return typeof n === "number" && Number.isFinite(n) ? `$${n.toFixed(2)}` : "-"
}

export function InvoiceArchivePanel({
  adminKey,
  orderNo,
  orderId,
}: {
  adminKey: string
  orderNo: string | null
  orderId: string | null
}) {
  const [sends, setSends] = useState<Send[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [opening, setOpening] = useState<string | null>(null)

  const load = useCallback(async () => {
    // No key is fine: the login-session cookie carries the identity.
    if (!orderNo && !orderId) return
    setError(null)
    const qs = new URLSearchParams()
    if (orderNo) qs.set("order_no", orderNo)
    if (orderId) qs.set("order_id", orderId)
    try {
      const res = await fetch(`/api/admin/invoice-archive?${qs}`, { headers: { "x-admin-key": adminKey }, cache: "no-store" })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
      setSends(json.sends as Send[])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSends([])
    }
  }, [adminKey, orderNo, orderId])

  useEffect(() => {
    void load()
  }, [load])

  // Open the tab synchronously (so the popup blocker allows it), then fill it
  // once the document arrives - the key stays in a header, not in a URL.
  const open = async (id: string) => {
    const win = window.open("", "_blank")
    setOpening(id)
    try {
      const res = await fetch(`/api/admin/invoice-archive?id=${encodeURIComponent(id)}`, {
        headers: { "x-admin-key": adminKey },
        cache: "no-store",
      })
      const html = await res.text()
      if (!res.ok) throw new Error(html.slice(0, 200))
      if (win) {
        win.document.open()
        win.document.write(html)
        win.document.close()
      }
    } catch (e) {
      if (win) win.close()
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setOpening(null)
    }
  }

  // The PDF the customer was emailed (sends from 2026-09-19 on). Fetched with
  // the key in a header, handed to the new tab as a blob URL.
  const openPdf = async (id: string) => {
    const win = window.open("", "_blank")
    setOpening(`${id}:pdf`)
    try {
      const res = await fetch(`/api/admin/invoice-archive?id=${encodeURIComponent(id)}&format=pdf`, {
        headers: { "x-admin-key": adminKey },
        cache: "no-store",
      })
      if (!res.ok) throw new Error((await res.text()).slice(0, 200))
      const url = URL.createObjectURL(await res.blob())
      if (win) win.location.href = url
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      if (win) win.close()
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setOpening(null)
    }
  }

  if (sends === null) return <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>读取中…</p>
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {sends.length === 0 && !error && (
        <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>还没有发过发票（从发票工具发出后会自动存档）</p>
      )}
      {sends.map((s) => (
        <div
          key={s.id}
          style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid #e5e7eb", borderRadius: 8, padding: "7px 10px" }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {money(s.totals?.finalTotal)}
              <span style={{ fontWeight: 400, color: "#6b7280" }}>
                {" "}· 押金 {money(s.totals?.deposit)} · 尾款 {money(s.totals?.balanceDue)}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {stamp(s.created_at)} PT · {s.sent_to ?? "-"}
              {s.source === "backfill" ? " · 补录" : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void open(s.id)}
            disabled={opening === s.id}
            style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}
          >
            {opening === s.id ? "打开中…" : "查看已发送版本"}
          </button>
          {s.has_pdf && (
            <button
              type="button"
              onClick={() => void openPdf(s.id)}
              disabled={opening === `${s.id}:pdf`}
              style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" }}
            >
              {opening === `${s.id}:pdf` ? "打开中…" : "PDF"}
            </button>
          )}
        </div>
      ))}
      {error && <p style={{ fontSize: 12, color: "#b91c1c", margin: 0 }}>{error}</p>}
    </div>
  )
}
