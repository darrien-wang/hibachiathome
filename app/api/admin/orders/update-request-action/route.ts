import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const INVOICE_APP_ORIGIN = "https://invoice.realhibachi.com"

// Staff-only proxy to the invoice app's update-request admin actions, so the
// order workbench can confirm / complete customer-submitted invoice changes
// inline. The invoice app holds the state machine and sends the customer
// notifications; this route only forwards with the shared admin token, which
// never reaches the browser.
function isAuthorized(request: NextRequest): boolean {
  const provided = request.headers.get("x-admin-key") ?? ""
  if (!provided) return false
  const owner = process.env.ADMIN_DASH_KEY
  if (owner && provided === owner) return true
  for (const entry of (process.env.AGENT_DASH_KEYS ?? "").split(",")) {
    const [alias, key] = entry.split(":").map((s) => s?.trim())
    if (alias && key && provided === key) return true
  }
  return false
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const adminToken = process.env.INVOICE_UPDATE_ADMIN_TOKEN?.trim()
  if (!adminToken) {
    return NextResponse.json(
      { ok: false, error: "INVOICE_UPDATE_ADMIN_TOKEN is not configured on the workbench side." },
      { status: 500 },
    )
  }

  let body: { requestId?: string; action?: string; operator?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  const requestId = String(body.requestId ?? "").trim()
  const action = String(body.action ?? "").trim()
  if (!requestId || (action !== "confirm" && action !== "complete")) {
    return NextResponse.json({ error: "requestId and action (confirm|complete) are required" }, { status: 400 })
  }

  try {
    const res = await fetch(
      `${INVOICE_APP_ORIGIN}/api/self-service/update-requests/${encodeURIComponent(requestId)}/${action}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken,
          "x-admin-actor": `workbench:${String(body.operator ?? "staff").trim() || "staff"}`,
        },
        body: "{}",
        cache: "no-store",
      },
    )
    const data = await res.json().catch(() => null)
    return NextResponse.json(data ?? { ok: false, error: `invoice app returned ${res.status}` }, {
      status: res.ok ? 200 : res.status,
    })
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 502 })
  }
}
