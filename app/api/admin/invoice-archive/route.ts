import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { resolveAdminActor } from "@/lib/admin-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ============================================================
// Sent-invoice archive (read side)
// ============================================================
// The invoice tool writes public.invoice_archive every time it emails an
// invoice: the rendered document exactly as sent, the data behind it, and
// the send facts. The table is append-only (UPDATE/DELETE blocked by
// trigger), so this is the audit copy - the customer's own link expires after
// 30 days and the order's saved invoice is only the current version.
//
//   GET ?order_no=RH-...  or ?order_id=<uuid>   -> list of sends (no html)
//   GET ?id=<uuid>                              -> the archived document
//
// Owner or agent key, header x-admin-key (or ?key=).

type ArchiveRow = {
  id: string
  order_id: string | null
  order_no: string | null
  kind: string
  sent_to: string | null
  subject: string | null
  totals: Record<string, unknown> | null
  customer_url: string | null
  provider: string | null
  provider_message_id: string | null
  source: string
  note: string | null
  created_at: string
}

const LIST_COLUMNS =
  "id,order_id,order_no,kind,sent_to,subject,totals,customer_url,provider,provider_message_id,source,note,created_at"
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string)
}

// A thin strip above the document so a printout or screenshot can never be
// mistaken for a live invoice. The stored html itself is not changed.
function withBanner(row: ArchiveRow & { html: string }): string {
  const sentAt = new Date(row.created_at).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    dateStyle: "medium",
    timeStyle: "short",
  })
  const bits = [
    "Archived copy - as sent",
    row.order_no ?? "",
    row.sent_to ? `to ${row.sent_to}` : "",
    `${sentAt} PT`,
    row.source === "backfill" ? "(backfilled)" : "",
  ].filter(Boolean)
  const note = row.note ? `<div style="margin-top:4px;font-weight:400">${escapeHtml(row.note)}</div>` : ""
  const banner =
    `<div style="font:600 13px/1.4 -apple-system,Segoe UI,sans-serif;background:#1f2937;color:#fff;padding:8px 14px">` +
    `${escapeHtml(bits.join(" · "))}${note}</div>`
  const html = row.html
  const bodyOpen = html.match(/<body[^>]*>/i)
  if (!bodyOpen || bodyOpen.index === undefined) return banner + html
  const at = bodyOpen.index + bodyOpen[0].length
  return html.slice(0, at) + banner + html.slice(at)
}

export async function GET(request: NextRequest) {
  if (!resolveAdminActor(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const supabase = createServerSupabaseClient()
  const p = request.nextUrl.searchParams
  const id = (p.get("id") ?? "").trim()

  if (id) {
    if (!UUID_RE.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 })
    const { data, error } = await supabase
      .from("invoice_archive")
      .select(`${LIST_COLUMNS},html`)
      .eq("id", id)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: "not found" }, { status: 404 })
    return new NextResponse(withBanner(data as ArchiveRow & { html: string }), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    })
  }

  const orderNo = (p.get("order_no") ?? "").trim().slice(0, 40)
  const orderId = (p.get("order_id") ?? "").trim()
  if (!orderNo && !UUID_RE.test(orderId)) {
    return NextResponse.json({ error: "order_no or order_id required" }, { status: 400 })
  }

  let query = supabase.from("invoice_archive").select(LIST_COLUMNS).order("created_at", { ascending: false }).limit(50)
  query = orderNo && orderId && UUID_RE.test(orderId)
    ? query.or(`order_no.eq.${orderNo},order_id.eq.${orderId}`)
    : orderNo
      ? query.eq("order_no", orderNo)
      : query.eq("order_id", orderId)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, sends: (data ?? []) as ArchiveRow[] })
}
