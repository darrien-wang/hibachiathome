// What the customer wrote to us on the party page, as the order carries it
// (order-flow rebuild 2026-11-11, D-1111-03).
//
// The invoice app (card B) keeps it on the order in invoice_data.customerNotes:
// a list of { at, text, source }, oldest first, append only. Before that it
// lived only in invoice_update_requests.customer_message, where neither the
// order nor the chef's sheet showed it ("surprise birthday, come in by the side
// gate", "call when you arrive and I'll open the gate"). The workbench order
// drawer prints the list; an order without the field prints nothing.
//
// No server imports: the drawer bundles this file into the browser.

export type CustomerNote = { at: string | null; text: string; source: string }

const SOURCE_LABELS: Record<string, string> = {
  party_page: "派对页",
  order_page: "派对页",
  planner: "派对页",
  invoice_form: "发票表单",
  sms: "短信",
  desk: "desk",
  staff: "办公室",
}

/** The notes on a stored invoice, oldest first. Anything malformed is skipped; no field, no notes. */
export function customerNotesOf(invoiceData: unknown): CustomerNote[] {
  const raw = invoiceData && typeof invoiceData === "object" ? (invoiceData as Record<string, unknown>).customerNotes : null
  if (!Array.isArray(raw)) return []
  const out: CustomerNote[] = []
  for (const item of raw) {
    // A bare string is read too: the text is what matters.
    const entry = typeof item === "string" ? { text: item } : item
    if (!entry || typeof entry !== "object") continue
    const e = entry as Record<string, unknown>
    const text = typeof e.text === "string" ? e.text.replace(/\r\n?/g, "\n").trim() : ""
    if (!text) continue
    const at = typeof e.at === "string" && Number.isFinite(Date.parse(e.at)) ? e.at : null
    out.push({ at, text, source: typeof e.source === "string" && e.source.trim() ? e.source.trim() : "" })
  }
  return out
}

/** "派对页" for party_page; an unknown source is shown as written. */
export function noteSourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source
}
