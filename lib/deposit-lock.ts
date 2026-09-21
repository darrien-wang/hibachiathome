import { createServerSupabaseClient } from "@/lib/supabase"

// "Has this party already been locked with a deposit?" - asked by the deposit
// page when it opens and by /api/deposit/start before it creates a Stripe
// session. Born 2026-09-20 (RH-20260921-4337): a host paid, then Safari
// restored the old deposit tab with the pay button still live, one tap from
// a second $19.90.
//
// Identity is the lead in the link (a UUID nobody can guess). Without one,
// the email AND the exact event date both have to match, and the answer is
// then a bare yes/no with no order number or link - an email alone must not
// reveal anything. A lock is any paid order for a party still ahead of us:
// the same lead moving the date does not pay again (staff move the order),
// and a genuinely second party goes through the "another party" door that
// skips this check.

export type DepositLock =
  | { locked: false }
  | {
      locked: true
      matchedBy: "lead" | "email"
      orderNo: string
      eventDate: string | null
      eventTime: string | null
      customerName: string | null
      manageUrl: string | null
    }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// order_status values that mean the deposit no longer holds a date
const CLOSED_STATUSES = new Set(["cancelled", "canceled", "refunded", "void", "voided", "closed"])

type OrderRow = {
  order_no: string | null
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  event_start: string | null
  order_status: string | null
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

/** The self-service planner for a paid order, built the way the success page builds it. */
function manageUrlFor(row: OrderRow): string | null {
  const base = clean(process.env.NEXT_PUBLIC_INVOICE_SELF_SERVICE_BASE_URL)
  if (!base || !row.order_no) return null
  try {
    const url = new URL(base)
    if (!url.pathname.includes("/order")) url.pathname = `${url.pathname.replace(/\/$/, "")}/order`
    url.searchParams.set("booking_id", row.order_no)
    if (row.customer_email) url.searchParams.set("email", row.customer_email)
    if (row.customer_phone) url.searchParams.set("phone", row.customer_phone)
    url.searchParams.set("surface", "deposit_locked")
    return url.toString()
  } catch {
    return null
  }
}

export async function findDepositLock(input: {
  leadId?: string | null
  email?: string | null
  eventDate?: string | null
}): Promise<DepositLock> {
  const leadId = clean(input.leadId)
  const email = clean(input.email).toLowerCase()
  const eventDate = clean(input.eventDate)
  const byLead = UUID_RE.test(leadId)
  const byEmail = !byLead && EMAIL_RE.test(email) && DATE_RE.test(eventDate)
  if (!byLead && !byEmail) return { locked: false }

  const supabase = createServerSupabaseClient()
  if (!supabase) return { locked: false }

  // event_start holds the party's wall-clock time stored as UTC; a day of
  // grace keeps a party earlier today locked no matter the timezone math.
  const since = new Date(Date.now() - 24 * 3600_000).toISOString()
  let query = supabase
    .from("orders")
    .select("order_no, customer_name, customer_email, customer_phone, event_start, order_status")
    .eq("deposit_status", "paid_verified")
    .gte("event_start", since)
    .order("event_start", { ascending: true })
    .limit(5)
  query = byLead
    ? query.eq("source_metadata->>lead_id", leadId)
    : query.ilike("customer_email", email).gte("event_start", `${eventDate}T00:00:00+00:00`).lt("event_start", `${eventDate}T23:59:59+00:00`)

  const { data, error } = await query
  if (error) {
    console.warn("[deposit-lock] lookup failed", error.message)
    return { locked: false }
  }
  const row = ((data ?? []) as OrderRow[]).find((r) => !CLOSED_STATUSES.has(clean(r.order_status).toLowerCase()) && r.order_no)
  if (!row) return { locked: false }

  const start = clean(row.event_start)
  return {
    locked: true,
    matchedBy: byLead ? "lead" : "email",
    orderNo: row.order_no as string,
    eventDate: start ? start.slice(0, 10) : null,
    eventTime: start && start.length >= 16 ? start.slice(11, 16) : null,
    customerName: clean(row.customer_name) || null,
    manageUrl: byLead ? manageUrlFor(row) : null,
  }
}
