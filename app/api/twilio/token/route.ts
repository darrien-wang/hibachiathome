import { type NextRequest, NextResponse } from "next/server"
import twilio from "twilio"
import { identityForAlias } from "@/lib/twilio-identity"

export const dynamic = "force-dynamic"

type Actor = { role: "owner" | "agent"; alias: string }

// Same scheme as the other admin endpoints: owner uses ADMIN_DASH_KEY,
// agents use AGENT_DASH_KEYS="anna:key1,bob:key2".
function resolveActor(request: NextRequest): Actor | null {
  const provided =
    request.headers.get("x-admin-key") ?? request.nextUrl.searchParams.get("key") ?? ""
  if (!provided) return null
  const owner = process.env.ADMIN_DASH_KEY
  if (owner && provided === owner) return { role: "owner", alias: "owner" }
  for (const entry of (process.env.AGENT_DASH_KEYS ?? "").split(",")) {
    const [alias, key] = entry.split(":").map((s) => s?.trim())
    if (alias && key && provided === key) return { role: "agent", alias }
  }
  return null
}

export async function GET(request: NextRequest) {
  const actor = resolveActor(request)
  if (!actor) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const apiKeySid = process.env.TWILIO_API_KEY_SID
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID

  if (!accountSid || !apiKeySid || !apiKeySecret) {
    return NextResponse.json(
      { error: "softphone not configured: missing TWILIO_API_KEY_SID / TWILIO_API_KEY_SECRET" },
      { status: 503 }
    )
  }

  const identity = identityForAlias(actor.alias)
  const AccessToken = twilio.jwt.AccessToken
  const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, { identity, ttl: 3600 })
  token.addGrant(
    new AccessToken.VoiceGrant({
      // Outgoing needs a TwiML App pointing at /api/twilio/voice-outbound.
      // Without it the softphone can still receive calls, just not place them.
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true,
    })
  )

  return NextResponse.json(
    { token: token.toJwt(), identity, canDialOut: Boolean(twimlAppSid) },
    { headers: { "cache-control": "no-store" } }
  )
}
