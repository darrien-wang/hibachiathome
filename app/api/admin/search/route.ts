import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { resolveAdminActor } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"

// ============================================================
// GET /api/admin/search?q=<name | phone | email | order no | address>
// ============================================================
// One box for both workbenches. Until 2026-09-18 neither the lead list nor
// the order list could be searched: each showed its newest 100–200 rows and
// the owner scrolled. Fifty-one customers already made that slow; two
// hundred would have made it useless.
//
// Results are grouped by CUSTOMER (phone digits, else email), because the
// same person is often two or three lead rows plus an order, and what the
// owner wants is "everything about this person", not a row from each table.
// The tables themselves are untouched — this is a read-only join at query
// time, so nothing about how leads or orders are written changes.

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
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  event_start: string | null
  event_address: string | null
  order_status: string | null
  deposit_status: string | null
  balance_due_cents: number | null
  source_metadata: Record<string, unknown> | null
  created_at: string
}

export type CustomerHit = {
  key: string
  name: string | null
  phone: string | null
  email: string | null
  leads: LeadHit[]
  orders: OrderHit[]
  lastActivity: string
}

function digitsOf(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "")
}

/** Last ten digits of a phone: "+15624584699" and "15624584699" are one key. */
function phoneKey(value: string | null | undefined): string {
  const d = digitsOf(value)
  return d.length >= 10 ? d.slice(-10) : ""
}

/** Strip the characters PostgREST's filter grammar would misread. */
function sanitize(q: string): string {
  return q.replace(/[,()%*\\"']/g, " ").replace(/\s+/g, " ").trim()
}

export async function GET(request: NextRequest) {
  if (!resolveAdminActor(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const raw = (request.nextUrl.searchParams.get("q") ?? "").trim()
  const q = sanitize(raw)
  if (q.length < 2) return NextResponse.json({ ok: true, q: raw, customers: [] })

  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "supabase not configured" }, { status: 500 })

  // A query that is mostly digits is a phone (or an order number like
  // RH-20260918-0948, which we match on the order_no text instead).
  const digits = digitsOf(q)
  const phoneLike = digits.length >= 4 && digits.length / q.replace(/\s/g, "").length > 0.6 && !/^rh-?\d/i.test(q)

  const leadFilters = phoneLike
    ? [`phone.ilike.%${digits}%`]
    : [`full_name.ilike.%${q}%`, `email.ilike.%${q}%`, ...(digits.length >= 4 ? [`phone.ilike.%${digits}%`] : [])]
  const orderFilters = phoneLike
    ? [`customer_phone.ilike.%${digits}%`, `order_no.ilike.%${q}%`]
    : [
        `customer_name.ilike.%${q}%`,
        `customer_email.ilike.%${q}%`,
        `order_no.ilike.%${q}%`,
        `event_address.ilike.%${q}%`,
        ...(digits.length >= 4 ? [`customer_phone.ilike.%${digits}%`] : []),
      ]

  const [leadRes, orderRes] = await Promise.all([
    supabase
      .from("leads")
      .select("id, full_name, phone, email, status, lead_source, city_or_zip, guest_count, created_at, last_seen_at")
      .or(leadFilters.join(","))
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("orders")
      .select(
        "id, order_no, customer_name, customer_phone, customer_email, event_start, event_address, order_status, deposit_status, balance_due_cents, source_metadata, created_at",
      )
      .or(orderFilters.join(","))
      .order("created_at", { ascending: false })
      .limit(30),
  ])
  if (leadRes.error) return NextResponse.json({ error: leadRes.error.message }, { status: 500 })
  if (orderRes.error) return NextResponse.json({ error: orderRes.error.message }, { status: 500 })

  const leads = (leadRes.data ?? []) as LeadHit[]
  const orders = (orderRes.data ?? []) as OrderHit[]

  // Pull in the rest of each matched person: an order found by order number
  // should also show that customer's leads, and a lead found by name should
  // show the order that came out of it.
  const keys = new Set<string>()
  for (const l of leads) keys.add(phoneKey(l.phone) || (l.email ?? "").toLowerCase())
  for (const o of orders) keys.add(phoneKey(o.customer_phone) || (o.customer_email ?? "").toLowerCase())
  keys.delete("")
  const phoneKeys = Array.from(keys).filter((k) => /^\d{10}$/.test(k))
  const emailKeys = Array.from(keys).filter((k) => k.includes("@"))
  const haveLead = new Set(leads.map((l) => l.id))
  const haveOrder = new Set(orders.map((o) => o.id))
  if (phoneKeys.length > 0 || emailKeys.length > 0) {
    const leadSib = [
      ...phoneKeys.map((k) => `phone.ilike.%${k}`),
      ...emailKeys.map((k) => `email.ilike.${k}`),
    ]
    const orderSib = [
      ...phoneKeys.map((k) => `customer_phone.ilike.%${k}`),
      ...emailKeys.map((k) => `customer_email.ilike.${k}`),
    ]
    const [leadSibRes, orderSibRes] = await Promise.all([
      supabase
        .from("leads")
        .select("id, full_name, phone, email, status, lead_source, city_or_zip, guest_count, created_at, last_seen_at")
        .or(leadSib.join(","))
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("orders")
        .select(
          "id, order_no, customer_name, customer_phone, customer_email, event_start, event_address, order_status, deposit_status, balance_due_cents, source_metadata, created_at",
        )
        .or(orderSib.join(","))
        .order("created_at", { ascending: false })
        .limit(60),
    ])
    for (const l of (leadSibRes.data ?? []) as LeadHit[]) if (!haveLead.has(l.id)) { leads.push(l); haveLead.add(l.id) }
    for (const o of (orderSibRes.data ?? []) as OrderHit[]) if (!haveOrder.has(o.id)) { orders.push(o); haveOrder.add(o.id) }
  }

  const customers = new Map<string, CustomerHit>()
  const bucket = (phone: string | null, email: string | null): CustomerHit => {
    const key = phoneKey(phone) || (email ?? "").toLowerCase() || `anon-${customers.size}`
    let c = customers.get(key)
    if (!c) {
      c = { key, name: null, phone: null, email: null, leads: [], orders: [], lastActivity: "" }
      customers.set(key, c)
    }
    return c
  }
  for (const o of orders) {
    const c = bucket(o.customer_phone, o.customer_email)
    c.orders.push(o)
    c.name = c.name || o.customer_name
    c.phone = c.phone || o.customer_phone
    c.email = c.email || o.customer_email
    if (o.created_at > c.lastActivity) c.lastActivity = o.created_at
  }
  for (const l of leads) {
    const c = bucket(l.phone, l.email)
    c.leads.push(l)
    // A real name beats the "+1562…" placeholder the SMS webhook files under.
    if (!c.name || /^\+?\d+$/.test(c.name) || c.name === "Unknown Contact") c.name = l.full_name && !/^\+?\d+$/.test(l.full_name) ? l.full_name : c.name
    c.phone = c.phone || l.phone
    c.email = c.email || l.email
    const seen = l.last_seen_at ?? l.created_at
    if (seen > c.lastActivity) c.lastActivity = seen
  }
  const out = Array.from(customers.values())
    .map((c) => ({
      ...c,
      leads: c.leads.sort((a, b) => b.created_at.localeCompare(a.created_at)),
      orders: c.orders.sort((a, b) => (b.event_start ?? "").localeCompare(a.event_start ?? "")),
    }))
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity))
    .slice(0, 20)

  return NextResponse.json({ ok: true, q: raw, customers: out })
}
