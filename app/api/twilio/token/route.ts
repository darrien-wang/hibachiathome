import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"
import twilio from "twilio"
import { identityForActor } from "@/lib/twilio-identity"

export const dynamic = "force-dynamic"

// Owner key, agent keys and SMS-login sessions all resolve through lib/admin-auth.
const resolveActor = (request: NextRequest) => resolveAdminActor(request)

export async function GET(request: NextRequest) {
  const actor = await resolveActor(request)
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

  const identity = identityForActor(actor)
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
