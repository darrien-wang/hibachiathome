import { type NextRequest, NextResponse } from "next/server"
import { resolveAdminActor } from "@/lib/admin-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ============================================================
// Pictures and videos customers text us
// ============================================================
// Twilio keeps MMS attachments behind HTTP basic auth, so until now the
// workbench could only say "[1 image]" and the ops email the same - the
// owner had to log into Twilio to see anything. On 2026-09-20 a lead texted
// a screenshot of our own quote page to show what it promised, and nobody
// saw it for an hour. This streams the attachment through the admin key,
// leaving the Twilio credentials on the server.
//
//   GET ?sid=<message sid>&i=<index>   -> the attachment bytes
//
// Attachments never change, so they cache privately for an hour.

const SID_RE = /^[A-Z]{2}[0-9a-f]{32}$/i
const ALLOWED_TYPES = /^(image|video|audio)\//i

type MediaItem = { sid: string; uri: string; content_type: string }

export async function GET(request: NextRequest) {
  if (!resolveAdminActor(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const messageSid = (request.nextUrl.searchParams.get("sid") ?? "").trim()
  const index = Number(request.nextUrl.searchParams.get("i") ?? "0")
  if (!SID_RE.test(messageSid)) return NextResponse.json({ error: "bad sid" }, { status: 400 })
  if (!Number.isInteger(index) || index < 0 || index > 9) return NextResponse.json({ error: "bad index" }, { status: 400 })

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!accountSid || !token) return NextResponse.json({ error: "twilio not configured" }, { status: 500 })
  const auth = `Basic ${Buffer.from(`${accountSid}:${token}`).toString("base64")}`

  const listRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${messageSid}/Media.json?PageSize=10`,
    { headers: { Authorization: auth }, cache: "no-store" },
  )
  if (!listRes.ok) return NextResponse.json({ error: `twilio_${listRes.status}` }, { status: 502 })
  const list = (await listRes.json().catch(() => null)) as { media_list?: MediaItem[] } | null
  const item = (list?.media_list ?? [])[index]
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 })
  if (!ALLOWED_TYPES.test(item.content_type)) return NextResponse.json({ error: "unsupported type" }, { status: 415 })

  // The .json suffix is the metadata; without it Twilio serves the file.
  const fileRes = await fetch(`https://api.twilio.com${item.uri.replace(/\.json$/, "")}`, {
    headers: { Authorization: auth },
    redirect: "follow",
    cache: "no-store",
  })
  if (!fileRes.ok) return NextResponse.json({ error: `twilio_media_${fileRes.status}` }, { status: 502 })
  const bytes = Buffer.from(await fileRes.arrayBuffer())

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": item.content_type,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=3600, no-transform",
    },
  })
}
