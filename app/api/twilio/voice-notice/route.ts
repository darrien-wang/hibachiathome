import { NextResponse } from "next/server"
import { escapeXml } from "@/lib/twilio-identity"
import { RECORDING_NOTICE } from "@/lib/twilio-recording"

export const dynamic = "force-dynamic"

// Whisper TwiML played to the party we dialled, the moment they answer and
// before the legs bridge. Deliberately unauthenticated and side-effect free:
// it returns a fixed sentence and nothing else, so there is nothing to abuse.
export async function POST() {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escapeXml(RECORDING_NOTICE)}</Say></Response>`,
    { headers: { "content-type": "text/xml" } }
  )
}

export const GET = POST
