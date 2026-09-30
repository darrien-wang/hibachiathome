// The customer's party planner link in its keyed form: /order?key=ok_... on the
// planner domain - the same link the deposit text carries. The invoice app
// reuses a live key for the same booking, so asking twice hands back the same
// link and the customer keeps ONE planner link per party.
//
// Why the deposit success page needs it (2026-09-29): its "Manage Party-Day
// Details" button used to build the old parameter link, on the invoice domain,
// with the customer's email, phone and name written into the address. The
// parameter entrance could not be closed while that page depended on it.

export async function plannerKeyLink(params: {
  bookingId?: string | null
  email?: string | null
  phone?: string | null
  surface: string
}): Promise<string | undefined> {
  const base = (process.env.INVOICE_SELF_SERVICE_BASE_URL || process.env.NEXT_PUBLIC_INVOICE_SELF_SERVICE_BASE_URL || "").trim()
  const externalOrderId = params.bookingId?.trim() || undefined
  const email = params.email?.trim() || undefined
  const phone = params.phone?.trim() || undefined
  if (!base || (!externalOrderId && !email && !phone)) return undefined
  try {
    const res = await fetch(`${new URL(base).origin}/api/order-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ externalOrderId, email, phone }),
      signal: AbortSignal.timeout(5000),
    })
    const data = (await res.json().catch(() => null)) as { ok?: boolean; id?: string } | null
    if (!res.ok || !data?.ok || !data.id) return undefined
    const url = new URL(base)
    if (!url.pathname.includes("/order")) url.pathname = `${url.pathname.replace(/\/$/, "")}/order`
    url.search = ""
    url.searchParams.set("key", data.id)
    url.searchParams.set("surface", params.surface)
    return url.toString()
  } catch {
    return undefined
  }
}
