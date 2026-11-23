import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import {
  ALBUM_BUCKET,
  ALBUM_COUPON,
  ALBUM_MAX_BYTES,
  ALBUM_MAX_FILES_PER_DEVICE,
  ALBUM_MEDIA_TYPES,
  ALBUM_TERMS_VERSION,
  DEVICE_RE,
  albumPhone,
  couponExpiry,
  newCouponCode,
} from "@/lib/party-album"
import { albumByToken, albumItems } from "@/lib/party-album-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ============================================================
// Party album - the public side (/album/<token>)
// ============================================================
// The token is the only key: whoever has the link can look and add. Files go
// straight from the phone into the private party-photos bucket through a
// one-time signed upload URL (a 4K video is far past the 4.5 MB a function can
// take), then "done" indexes them. A phone is identified by a random device id
// it keeps in localStorage - enough to let people take back their own uploads
// and to tie their uploads to the name + phone they leave for the coupon.
//
//   GET  ?device=                                   -> album + items
//   POST { action: "slot", device, type, size, thumb } -> signed upload URL(s)
//   POST { action: "done", device, path, thumbPath? }  -> indexed
//   POST { action: "claim", device, name, phone, adsOk } -> $50 coupon
//   POST { action: "remove", device, id }              -> deletes one of your own

type Ctx = { params: Promise<{ token: string }> }

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status })

export async function GET(request: NextRequest, { params }: Ctx) {
  const { token } = await params
  const supabase = createServerSupabaseClient()
  if (!supabase) return bad("not configured", 500)
  const album = await albumByToken(supabase, token)
  if (!album) return bad("This album link doesn't work. Please text us and we'll send a new one.", 404)
  const device = request.nextUrl.searchParams.get("device")
  const dev = device && DEVICE_RE.test(device) ? device : null
  const { items } = await albumItems(supabase, album, { device: dev })

  let claimed: { code: string; expiresAt: string } | null = null
  if (dev) {
    const { data: person } = await supabase.from("album_people").select("phone").eq("album_id", album.id).eq("device", dev).maybeSingle()
    if (person?.phone) {
      const { data: c } = await supabase
        .from("coupons")
        .select("code, expires_at")
        .eq("source", ALBUM_COUPON.source)
        .eq("album_id", album.id)
        .eq("phone", person.phone)
        .maybeSingle()
      if (c) claimed = { code: c.code as string, expiresAt: c.expires_at as string }
    }
  }
  const video = album.video_path
    ? ((await supabase.storage.from(ALBUM_BUCKET).createSignedUrl(album.video_path, 6 * 3600)).data?.signedUrl ?? null)
    : null

  return NextResponse.json({
    ok: true,
    album: { title: album.title, eventDate: album.event_date, open: album.status === "open", video },
    items,
    claimed,
    termsVersion: ALBUM_TERMS_VERSION,
  })
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const { token } = await params
  const supabase = createServerSupabaseClient()
  if (!supabase) return bad("not configured", 500)
  const album = await albumByToken(supabase, token)
  if (!album) return bad("This album link doesn't work.", 404)

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return bad("invalid json")
  }
  const device = String(body.device ?? "")
  if (!DEVICE_RE.test(device)) return bad("bad device")
  const prefix = `album/${album.id}/${device}/`

  if (body.action === "slot") {
    if (album.status !== "open") return bad("This album is closed for new photos.")
    const type = String(body.type ?? "").toLowerCase()
    const media = ALBUM_MEDIA_TYPES[type]
    if (!media) return bad("We can take photos (JPG, PNG, HEIC) and videos (MP4, MOV).")
    const size = Number(body.size ?? 0)
    if (!(size > 0) || size > ALBUM_MAX_BYTES) return bad("That file is over 500 MB. Could you trim it a little and try again?")
    const { count } = await supabase.from("album_media").select("id", { count: "exact", head: true }).eq("album_id", album.id).eq("device", device)
    if ((count ?? 0) >= ALBUM_MAX_FILES_PER_DEVICE) return bad("That's the most we can take from one phone - thank you!")
    const stem = `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const path = `${stem}.${media.ext}`
    const main = await supabase.storage.from(ALBUM_BUCKET).createSignedUploadUrl(path)
    if (main.error || !main.data) return bad(main.error?.message ?? "no upload url", 500)
    let thumbPath: string | null = null
    let thumbUrl: string | null = null
    if (body.thumb) {
      thumbPath = `${stem}.thumb.jpg`
      const t = await supabase.storage.from(ALBUM_BUCKET).createSignedUploadUrl(thumbPath)
      thumbUrl = t.data?.signedUrl ?? null
      if (!thumbUrl) thumbPath = null
    }
    return NextResponse.json({ ok: true, path, url: main.data.signedUrl, thumbPath, thumbUrl })
  }

  if (body.action === "done") {
    const path = String(body.path ?? "")
    const m = /^album\/[0-9a-f-]{36}\/[a-z0-9]+\/\d+-[a-z0-9]+\.([a-z0-9]+)$/.exec(path)
    if (!path.startsWith(prefix) || !m) return bad("bad path")
    const ext = m[1]
    const entry = Object.entries(ALBUM_MEDIA_TYPES).find(([, v]) => v.ext === ext)
    if (!entry) return bad("bad type")
    const name = path.slice(prefix.length)
    const { data: listed } = await supabase.storage.from(ALBUM_BUCKET).list(prefix.slice(0, -1), { search: name.split(".")[0], limit: 10 })
    const obj = (listed ?? []).find((o) => o.name === name)
    if (!obj) return bad("The upload didn't finish. Could you try that one again?")
    const thumbRaw = String(body.thumbPath ?? "")
    const thumbName = thumbRaw.startsWith(prefix) ? thumbRaw.slice(prefix.length) : ""
    const thumbOk = !!thumbName && thumbName === `${name.replace(/\.[a-z0-9]+$/, "")}.thumb.jpg` && (listed ?? []).some((o) => o.name === thumbName)
    const meta = (obj.metadata ?? {}) as { size?: number; mimetype?: string }
    const { data: person } = await supabase.from("album_people").select("id").eq("album_id", album.id).eq("device", device).maybeSingle()
    const { data: dup } = await supabase.from("album_media").select("id").eq("storage_path", path).maybeSingle()
    if (dup) return NextResponse.json({ ok: true, id: dup.id })
    const { data: row, error } = await supabase
      .from("album_media")
      .insert({
        album_id: album.id,
        person_id: person?.id ?? null,
        device,
        kind: entry[1].kind,
        storage_path: path,
        thumb_path: thumbOk ? thumbRaw : null,
        content_type: meta.mimetype || entry[0],
        bytes: typeof meta.size === "number" ? meta.size : null,
        terms_version: ALBUM_TERMS_VERSION,
      })
      .select("id")
      .single()
    if (error) return bad(error.message, 500)
    return NextResponse.json({ ok: true, id: row.id })
  }

  if (body.action === "remove") {
    const id = String(body.id ?? "")
    const { data: row } = await supabase.from("album_media").select("id, device, storage_path, thumb_path").eq("id", id).eq("album_id", album.id).maybeSingle()
    if (!row || row.device !== device) return bad("You can only remove what you added from this phone.", 403)
    await supabase.storage.from(ALBUM_BUCKET).remove([row.storage_path as string, ...(row.thumb_path ? [row.thumb_path as string] : [])])
    await supabase.from("album_media").delete().eq("id", id)
    return NextResponse.json({ ok: true })
  }

  if (body.action === "claim") {
    const name = String(body.name ?? "").trim().replace(/\s+/g, " ").slice(0, 60)
    const phone = albumPhone(String(body.phone ?? ""))
    if (name.length < 2) return bad("Please add your name.")
    if (!phone) return bad("Please check the phone number - we need a 10-digit US number.")
    const { count } = await supabase.from("album_media").select("id", { count: "exact", head: true }).eq("album_id", album.id).eq("device", device)
    if ((count ?? 0) < 1) return bad("Add at least one photo or video first, then your $50 is yours.")

    // One person per phone per album; a second phone with the same number joins it.
    const { data: existing } = await supabase.from("album_people").select("id").eq("album_id", album.id).eq("phone", phone).maybeSingle()
    let personId = existing?.id as string | undefined
    if (personId) {
      await supabase.from("album_people").update({ name, device, terms_version: ALBUM_TERMS_VERSION, ads_ok: !!body.adsOk }).eq("id", personId)
    } else {
      const { data: p, error } = await supabase
        .from("album_people")
        .insert({ album_id: album.id, name, phone, device, terms_version: ALBUM_TERMS_VERSION, ads_ok: !!body.adsOk })
        .select("id")
        .single()
      if (error || !p) return bad(error?.message ?? "could not save", 500)
      personId = p.id as string
    }
    await supabase.from("album_media").update({ person_id: personId }).eq("album_id", album.id).eq("device", device).is("person_id", null)

    const { data: have } = await supabase
      .from("coupons")
      .select("code, expires_at")
      .eq("source", ALBUM_COUPON.source)
      .eq("album_id", album.id)
      .eq("phone", phone)
      .maybeSingle()
    if (have) return NextResponse.json({ ok: true, code: have.code, expiresAt: have.expires_at })
    for (let i = 0; i < 4; i++) {
      const { data: c, error } = await supabase
        .from("coupons")
        .insert({
          code: newCouponCode(),
          phone,
          name,
          amount_cents: ALBUM_COUPON.amountCents,
          source: ALBUM_COUPON.source,
          album_id: album.id,
          expires_at: couponExpiry().toISOString(),
          note: `Party album: ${album.title}${album.event_date ? ` (${album.event_date})` : ""}`,
        })
        .select("code, expires_at")
        .single()
      if (!error && c) return NextResponse.json({ ok: true, code: c.code, expiresAt: c.expires_at })
      // A double tap: the unique (source, album, phone) row is already there.
      const { data: race } = await supabase
        .from("coupons")
        .select("code, expires_at")
        .eq("source", ALBUM_COUPON.source)
        .eq("album_id", album.id)
        .eq("phone", phone)
        .maybeSingle()
      if (race) return NextResponse.json({ ok: true, code: race.code, expiresAt: race.expires_at })
    }
    return bad("Could not save your coupon. Please text us and we'll add it by hand.", 500)
  }

  return bad("unknown action")
}
