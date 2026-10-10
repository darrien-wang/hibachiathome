import { type NextRequest, NextResponse } from "next/server"
import { loadWhisperFacts, pacificDate, whisperLine } from "@/lib/call-whisper"
import { toE164 } from "@/lib/sms-thread"
import { createServerSupabaseClient } from "@/lib/supabase"
import { escapeXml } from "@/lib/twilio-identity"
import { isValidTwilioSignature } from "@/lib/twilio-signature"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// 来电耳语 (lib/call-whisper.ts): the <Client url> / <Number url> TwiML of an inbound call to the
// 213 line. Twilio fetches it when someone answers and plays it to them alone; the caller is
// bridged when it ends. So this route must never be what stops a call from connecting: anything
// short of a clean lookup - a bad signature, a slow database, an error - is an empty <Response/>,
// and the call goes through without a whisper.
//
// It says who is calling, so it says it to Twilio only (signed with our auth token); the caller's
// number is in ?from=, digits only.

const VOICE = 'language="cmn-CN" voice="Polly.Zhiyu"'
/** The answering agent waits on this lookup; past it they get the caller without a whisper. */
const LOOKUP_BUDGET_MS = 3000

function twiml(body: string): NextResponse {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "content-type": "text/xml" },
  })
}

export async function POST(request: NextRequest) {
  const started = Date.now()
  const params: Record<string, string> = {}
  try {
    const form = await request.formData()
    for (const [k, v] of form.entries()) if (typeof v === "string") params[k] = v
  } catch {
    return twiml("")
  }
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.realhibachi.com"
  const signature = request.headers.get("x-twilio-signature") ?? ""
  if (!isValidTwilioSignature(`${base}/api/twilio/voice-whisper${request.nextUrl.search}`, params, signature)) {
    console.warn("[voice-whisper] invalid signature")
    return twiml("")
  }

  const digits = (request.nextUrl.searchParams.get("from") ?? "").replace(/\D/g, "")
  const phone = digits ? toE164(`+${digits}`) : null
  const supabase = createServerSupabaseClient()
  if (!phone || !supabase) return twiml("")

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const now = Date.now()
    const facts = await Promise.race([
      loadWhisperFacts(supabase, phone, now),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`lookup over ${LOOKUP_BUDGET_MS} ms`)), LOOKUP_BUDGET_MS)
      }),
    ]).finally(() => clearTimeout(timer))
    const line = whisperLine(facts, pacificDate(now))
    console.log("[voice-whisper]", { caller: `…${digits.slice(-4)}`, line, ms: Date.now() - started })
    return twiml(line ? `<Say ${VOICE}>${escapeXml(line)}</Say>` : "")
  } catch (error) {
    console.error("[voice-whisper] no whisper", { caller: `…${digits.slice(-4)}`, error: String(error), ms: Date.now() - started })
    return twiml("")
  }
}
