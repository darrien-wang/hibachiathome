import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { ALBUM_BUCKET, ALBUM_MAX_FILES_PER_DEVICE, DEVICE_RE } from "@/lib/party-album"
import { albumByToken, albumDir, albumIndex, albumItems, albumLinks, albumSlot, contributorCount, guestNames, importChefPhotos, setGuestName } from "@/lib/party-album-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ============================================================
// Party album - the public side (/album/<token>)
// ============================================================
// The token is the only key: whoever has the link can look and add. Files go
// straight from the phone into the private party-photos bucket through a
// one-time signed upload URL (a 4K video is far past the 4.5 MB a function can
// take), then "done" indexes them. A phone is a random device id it keeps in
// localStorage - enough to let people take back what they added. No names, no
// numbers, no coupon here (owner, 2026-11-23: this page is only about joining in).
//
// Two links per album: the invite link (token) can add; the share link
// (view_token) can only look and share on - its POSTs are refused.
//
//   GET  ?device=                                    -> album + items
//   POST { action: "slot", device, type, size, thumb } -> signed upload URL(s)
//   POST { action: "done", device, path, thumbPath? }  -> indexed
//   POST { action: "remove", device, id }              -> deletes one of your own
//   POST { action: "name", device, name }              -> first name on your tiles

type Ctx = { params: Promise<{ token: string }> }

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status })

export async function GET(request: NextRequest, { params }: Ctx) {
  const { token } = await params
  const supabase = createServerSupabaseClient()
  if (!supabase) return bad("not configured", 500)
  const found = await albumByToken(supabase, token)
  if (!found) return bad("This link doesn't open anything. Please text us and we'll send a new one.", 404)
  const { album, role } = found
  const device = request.nextUrl.searchParams.get("device")
  const dev = device && DEVICE_RE.test(device) ? device : null
  // The chef may upload after the album was made: pull in anything new from
  // this party's prep sheet (idempotent; a shot the owner hid stays hidden).
  if (album.order_id) await importChefPhotos(supabase, album, "auto").catch(() => 0)
  const { items, rows } = await albumItems(supabase, album, { device: role === "contributor" ? dev : null })
  const video = album.video_path
    ? ((await supabase.storage.from(ALBUM_BUCKET).createSignedUrl(album.video_path, 6 * 3600)).data?.signedUrl ?? null)
    : null
  const links = albumLinks(new URL(request.url).origin, album)
  return NextResponse.json({
    ok: true,
    role,
    album: { title: album.title, eventDate: album.event_date, place: album.place, open: album.status === "open", video },
    // A viewer never learns the invite link.
    links: role === "contributor" ? links : { share: links.share },
    items,
    people: contributorCount(rows),
    me: role === "contributor" && dev ? { name: (await guestNames(supabase, album.id)).get(dev) ?? null } : null,
  })
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const { token } = await params
  const supabase = createServerSupabaseClient()
  if (!supabase) return bad("not configured", 500)
  const found = await albumByToken(supabase, token)
  if (!found) return bad("This link doesn't open anything.", 404)
  if (found.role !== "contributor") return bad("This link is for looking only. Ask whoever sent it for the invite link to add photos.", 403)
  const { album } = found

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return bad("invalid json")
  }
  const device = String(body.device ?? "")
  if (!DEVICE_RE.test(device)) return bad("bad device")
  const dir = albumDir(album, device)

  if (body.action === "slot") {
    if (album.status !== "open") return bad("This album is closed for new photos.")
    const { count } = await supabase.from("album_media").select("id", { count: "exact", head: true }).eq("album_id", album.id).eq("device", device)
    if ((count ?? 0) >= ALBUM_MAX_FILES_PER_DEVICE) return bad("That's the most we can take from one phone - thank you!")
    const slot = await albumSlot(supabase, dir, body.type, body.size, !!body.thumb)
    return slot.ok ? NextResponse.json(slot) : bad(slot.error, slot.status)
  }

  if (body.action === "done") {
    const r = await albumIndex(supabase, album, dir, body.path, body.thumbPath, { source: "guest", device, addedBy: null })
    return r.ok ? NextResponse.json(r) : bad(r.error, r.status)
  }

  if (body.action === "name") {
    const name = await setGuestName(supabase, album.id, device, String(body.name ?? ""))
    return name ? NextResponse.json({ ok: true, name }) : bad("Please type your first name.")
  }

  if (body.action === "remove") {
    const id = String(body.id ?? "")
    const { data: row } = await supabase
      .from("album_media")
      .select("id, device, source, storage_path, thumb_path")
      .eq("id", id)
      .eq("album_id", album.id)
      .maybeSingle()
    if (!row || row.source !== "guest" || row.device !== device) return bad("You can only remove what you added from this phone.", 403)
    await supabase.storage.from(ALBUM_BUCKET).remove([row.storage_path as string, ...(row.thumb_path ? [row.thumb_path as string] : [])])
    await supabase.from("album_media").delete().eq("id", id)
    return NextResponse.json({ ok: true })
  }

  return bad("unknown action")
}
