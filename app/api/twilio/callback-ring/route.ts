import { type NextRequest, NextResponse } from "next/server"
import { markCallbackDone, openCallback, snoozeCallback, spokenName } from "@/lib/callback-ring"
import { toE164 } from "@/lib/sms-thread"
import { createServerSupabaseClient } from "@/lib/supabase"
import { escapeXml } from "@/lib/twilio-identity"
import { recordingAttributes } from "@/lib/twilio-recording"
import { isValidTwilioSignature } from "@/lib/twilio-signature"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// The owner's side of 请回电 (lib/callback-ring.ts): what he hears when he picks up the ring, and
// what his key press does.
//   step=prompt  who wants a call; 1 = put me through, 2 = remind me in ten minutes, 3 = no call needed
//   step=key     the key he pressed
//   step=dialed  how the call to the customer ended (only a no-answer gets a word)
// The prompt is in Mandarin: the owner reads and listens in Chinese.

const VOICE = 'language="cmn-CN" voice="Polly.Zhiyu"'
const say = (text: string) => `<Say ${VOICE}>${escapeXml(text)}</Say>`

function twiml(body: string): NextResponse {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "content-type": "text/xml" },
  })
}

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const params: Record<string, string> = {}
  for (const [k, v] of form.entries()) {
    if (typeof v === "string") params[k] = v
  }
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.realhibachi.com"
  const signature = request.headers.get("x-twilio-signature") ?? ""
  if (!isValidTwilioSignature(`${base}/api/twilio/callback-ring${request.nextUrl.search}`, params, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 403 })
  }

  const leadId = request.nextUrl.searchParams.get("lead") ?? ""
  const step = request.nextUrl.searchParams.get("step") ?? "prompt"
  if (!/^[0-9a-f-]{36}$/i.test(leadId)) return twiml(say("这条提醒找不到客人，请看工作台。"))
  const here = (s: string) => `${base}/api/twilio/callback-ring?lead=${leadId}&step=${s}`

  if (step === "dialed") {
    const status = params.DialCallStatus ?? ""
    return twiml(status === "completed" ? "<Hangup/>" : say("客人没有接。可以在工作台给他发条短信。"))
  }

  const supabase = createServerSupabaseClient()
  if (!supabase) return twiml(say("系统暂时连不上，请看工作台。"))
  const open = await openCallback(supabase, leadId)
  if (!open) return twiml(say("这位客人已经处理过了，不用回电。"))

  if (step === "key") {
    const digit = (params.Digits ?? "").trim()
    if (digit === "1") {
      const to = toE164(open.phone)
      const callerId = process.env.TWILIO_CALLER_ID
      if (!to || !callerId) return twiml(say("客人的号码不对，没法接通，请看工作台。"))
      await markCallbackDone(supabase, leadId, "connected", params.CallSid)
      // Same as any outbound call from the App (voice-outbound): the customer hears the recording
      // notice the moment they pick up, before the legs are bridged (Penal Code 632).
      const recording = recordingAttributes()
      const whisper = recording ? ` url="${escapeXml(`${base}/api/twilio/voice-notice`)}"` : ""
      return twiml(
        say("正在接通客人。") +
          `<Dial callerId="${escapeXml(callerId)}" answerOnBridge="true" timeout="30" action="${escapeXml(here("dialed"))}" method="POST"${recording}>` +
          `<Number${whisper}>${escapeXml(to)}</Number></Dial>`,
      )
    }
    if (digit === "2") {
      await snoozeCallback(supabase, leadId)
      return twiml(say("好的，十分钟后再提醒你。"))
    }
    if (digit === "3") {
      await markCallbackDone(supabase, leadId, "dismissed", params.CallSid)
      return twiml(say("好的，这位客人不用回电了。"))
    }
    return twiml(`<Redirect method="POST">${escapeXml(here("prompt"))}</Redirect>`)
  }

  const line = `客人${spokenName(open)}想跟你通电话。按 1，现在接通；按 2，十分钟后再提醒；按 3，不用回电。`
  return twiml(
    `<Gather input="dtmf" numDigits="1" timeout="8" action="${escapeXml(here("key"))}" method="POST">${say(line)}<Pause length="1"/>${say(line)}</Gather>` +
      say("没有按键。十分钟后会再响一次。"),
  )
}
