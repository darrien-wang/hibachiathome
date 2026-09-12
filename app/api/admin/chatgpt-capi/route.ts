import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import { isChatgptCapiConfigured, sendChatgptDepositConversion } from "@/lib/chatgpt-ads-capi"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Smoke test for the ChatGPT Conversions API wiring: sends one
// validate_only order_created (nothing is stored on OpenAI's side) and
// reports whether the key + payload were accepted. The daily report can
// call this to catch a rotated/expired key before a real deposit hits it.
export async function GET(request: NextRequest) {
  if (!resolveAdminActor(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (!isChatgptCapiConfigured()) return NextResponse.json({ ok: false, configured: false, error: "CHATGPT_ADS_CAPI_KEY not set" })
  const result = await sendChatgptDepositConversion({
    eventId: `capi_smoke_${new Date().toISOString().slice(0, 10)}`,
    amountCents: 1990,
    currency: "USD",
    email: "smoke-test@realhibachi.com",
    firstName: "Smoke",
    lastName: "Test",
    postalCode: "91744",
    sourceUrl: "https://www.realhibachi.com/deposit/pay",
    validateOnly: true,
  })
  return NextResponse.json({ ok: result.delivered, configured: true, validateOnly: true, ...result })
}
