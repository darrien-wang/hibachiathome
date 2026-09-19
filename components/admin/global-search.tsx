"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { Search } from "lucide-react"

// ============================================================
// One search box for the whole admin: name, phone, email, order no, address.
// ============================================================
// Talks to /api/admin/search, which groups hits by customer, so the result
// for "Natalie" is one card per Natalie with her leads and her orders under
// it - not a lead row here and an order row there. Lives in the nav so it
// is on every workbench page. The admin key is the one the pages already
// keep in localStorage (rh_admin_key); no key, no search.

type LeadHit = {
  id: string
  full_name: string | null
  phone: string | null
  email: string | null
  status: string | null
  lead_source: string | null
  city_or_zip: string | null
  guest_count: number | null
  created_at: string
  last_seen_at: string | null
}

type OrderHit = {
  id: string
  order_no: string
  event_start: string | null
  event_address: string | null
  order_status: string | null
  deposit_status: string | null
  balance_due_cents: number | null
  created_at: string
}

type CustomerHit = {
  key: string
  name: string | null
  phone: string | null
  email: string | null
  leads: LeadHit[]
  orders: OrderHit[]
  lastActivity: string
}

const PT = "America/Los_Angeles"

function day(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { timeZone: PT, month: "short", day: "numeric" })
}

function partyDay(iso: string | null): string {
  if (!iso) return "日期待定"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { timeZone: PT, month: "short", day: "numeric", weekday: "short" })
}

function prettyPhone(raw: string | null): string {
  const digits = (raw ?? "").replace(/\D/g, "")
  const m = /^1?(\d{3})(\d{3})(\d{4})$/.exec(digits)
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : raw ?? ""
}

const STATUS_LABEL: Record<string, string> = {
  new: "新",
  qualified: "跟进中",
  won: "已成交",
  lost: "流失",
  disqualified: "无效",
}

function readKey(): string {
  try {
    return window.localStorage.getItem("rh_admin_key") ?? ""
  } catch {
    return ""
  }
}

export default function GlobalSearch() {
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hits, setHits] = useState<CustomerHit[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const seq = useRef(0)

  const run = useCallback(async (term: string) => {
    const key = readKey()
    const mine = ++seq.current
    if (term.trim().length < 2) {
      setHits(null)
      setError(null)
      return
    }
    if (!key) {
      setError("先在页面上输入管理密钥")
      setHits([])
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(term.trim())}`, { headers: { "x-admin-key": key }, cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (mine !== seq.current) return
      if (!res.ok) {
        setError(String(data.error ?? res.status))
        setHits([])
        return
      }
      setError(null)
      setHits(Array.isArray(data.customers) ? data.customers : [])
    } catch (e) {
      if (mine !== seq.current) return
      setError(e instanceof Error ? e.message : "search failed")
      setHits([])
    } finally {
      if (mine === seq.current) setBusy(false)
    }
  }, [])

  // Debounce: one request per pause in typing, not one per keystroke.
  useEffect(() => {
    const t = window.setTimeout(() => void run(q), 250)
    return () => window.clearTimeout(t)
  }, [q, run])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
      // "/" from anywhere on the page focuses the box, like GitHub.
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName ?? "")) {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
    }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  const show = open && q.trim().length >= 2

  return (
    <div ref={boxRef} style={{ position: "relative", marginLeft: "auto", width: "min(420px, 46vw)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid #d1d5db", borderRadius: 999, padding: "5px 12px", background: "#f9fafb" }}>
        <Search size={15} strokeWidth={2.2} color="#6b7280" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="找客户：姓名 / 手机 / 邮箱 / 订单号 / 地址（按 / 聚焦）"
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13.5, minWidth: 0 }}
        />
        {busy && <span style={{ fontSize: 11, color: "#9ca3af" }}>…</span>}
      </div>

      {show && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            width: "min(640px, 92vw)",
            maxHeight: "70vh",
            overflowY: "auto",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            boxShadow: "0 12px 32px rgba(0,0,0,0.12)",
            padding: 8,
            zIndex: 80,
          }}
        >
          {error && <p style={{ margin: 6, fontSize: 13, color: "#b91c1c" }}>{error}</p>}
          {!error && hits && hits.length === 0 && <p style={{ margin: 6, fontSize: 13, color: "#9ca3af" }}>没找到 “{q.trim()}”</p>}
          {!error && hits === null && <p style={{ margin: 6, fontSize: 13, color: "#9ca3af" }}>至少输两个字符</p>}
          {(hits ?? []).map((c) => (
            <div key={c.key} style={{ padding: "8px 10px", borderRadius: 10, borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 14 }}>{c.name || "（未留名）"}</strong>
                {c.phone && <span style={{ fontSize: 12.5, color: "#374151" }}>{prettyPhone(c.phone)}</span>}
                {c.email && <span style={{ fontSize: 12.5, color: "#6b7280" }}>{c.email}</span>}
                <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: "auto" }}>最近 {day(c.lastActivity)}</span>
              </div>
              {c.orders.length > 0 && (
                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
                  {c.orders.map((o) => (
                    <Link
                      key={o.id}
                      href={`/admin/orders?order=${o.id}`}
                      onClick={() => setOpen(false)}
                      style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 13, textDecoration: "none", color: "#111827", padding: "3px 6px", borderRadius: 6, background: "#fff7ed" }}
                    >
                      <span style={{ fontWeight: 600, color: "#c2410c" }}>订单</span>
                      <span>{o.order_no}</span>
                      <span style={{ color: "#6b7280" }}>· 派对 {partyDay(o.event_start)}</span>
                      {o.event_address && <span style={{ color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>· {o.event_address}</span>}
                      <span style={{ marginLeft: "auto", fontSize: 11.5, color: o.deposit_status === "paid_verified" ? "#15803d" : "#9ca3af" }}>
                        {o.deposit_status === "paid_verified" ? "押金已付" : o.deposit_status ?? ""}
                        {typeof o.balance_due_cents === "number" && o.balance_due_cents > 0 ? ` · 尾款 $${(o.balance_due_cents / 100).toFixed(0)}` : ""}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              {c.leads.length > 0 && (
                <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 3 }}>
                  {c.leads.map((l) => (
                    <Link
                      key={l.id}
                      href={`/admin/leads?lead=${l.id}`}
                      onClick={() => setOpen(false)}
                      style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 13, textDecoration: "none", color: "#111827", padding: "3px 6px", borderRadius: 6 }}
                    >
                      <span style={{ fontWeight: 600, color: "#1d4ed8" }}>线索</span>
                      <span>{day(l.created_at)}</span>
                      <span style={{ color: "#6b7280" }}>· {STATUS_LABEL[l.status ?? ""] ?? l.status ?? ""}</span>
                      {(l.city_or_zip || l.guest_count) && (
                        <span style={{ color: "#9ca3af" }}>
                          · {l.city_or_zip ?? ""}
                          {l.guest_count ? ` ${l.guest_count} 人` : ""}
                        </span>
                      )}
                      {l.lead_source && <span style={{ marginLeft: "auto", fontSize: 11.5, color: "#9ca3af" }}>{l.lead_source}</span>}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
