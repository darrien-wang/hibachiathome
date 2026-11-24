import type { SupabaseClient } from "@supabase/supabase-js"
import { cityOf } from "@/lib/customers"
import {
  ALBUM_BUCKET,
  ALBUM_MAX_BYTES,
  ALBUM_MEDIA_TYPES,
  ALBUM_TERMS_VERSION,
  albumByLabel,
  albumFirstName,
  albumTitle,
  newAlbumToken,
  seedRank,
} from "@/lib/party-album"

// Server half of the party album: create one per order, take uploads (guest or
// staff), copy the chef's shots in, list what is in it.

export type AlbumRow = {
  id: string
  order_id: string | null
  token: string
  view_token: string
  title: string
  event_date: string | null
  place: string | null
  status: "open" | "closed"
  video_path: string | null
  video_ready_at: string | null
  created_at: string
}

export type AlbumSource = "guest" | "staff" | "chef"

export type AlbumMediaRow = {
  id: string
  album_id: string
  device: string | null
  source: AlbumSource
  added_by: string | null
  kind: "photo" | "video"
  storage_path: string
  thumb_path: string | null
  content_type: string | null
  bytes: number | null
  status: "visible" | "hidden"
  picked: boolean
  created_at: string
}

export type AlbumItem = {
  id: string
  source: AlbumSource
  kind: "photo" | "video"
  url: string | null
  thumb: string | null
  by: string | null
  /** The guest's own first name (shown with "You" on their phone too). */
  name: string | null
  mine: boolean
  createdAt: string
}

const SIGN_TTL = 6 * 3600
const ALBUM_COLS = "id, order_id, token, view_token, title, event_date, place, status, video_path, video_ready_at, created_at"
const MEDIA_COLS = "id, album_id, device, source, added_by, kind, storage_path, thumb_path, content_type, bytes, status, picked, created_at"

/**
 * Two links per album (owner, 2026-11-23): the invite link (`token`) lets you
 * add photos; the share link (`view_token`) only lets you look and share on.
 */
export type AlbumRole = "contributor" | "viewer"

export async function albumByToken(supabase: SupabaseClient, token: string): Promise<{ album: AlbumRow; role: AlbumRole } | null> {
  if (!/^[a-z0-9]{8,24}$/.test(token)) return null
  const { data } = await supabase
    .from("party_albums")
    .select(ALBUM_COLS)
    .or(`token.eq.${token},view_token.eq.${token}`)
    .limit(1)
    .maybeSingle()
  const album = (data as AlbumRow | null) ?? null
  if (!album) return null
  return { album, role: album.token === token ? "contributor" : "viewer" }
}

export const albumLinks = (origin: string, album: AlbumRow) => ({
  invite: `${origin}/album/${album.token}`,
  share: `${origin}/album/${album.view_token}`,
})

export async function albumForOrder(supabase: SupabaseClient, orderId: string): Promise<AlbumRow | null> {
  const { data } = await supabase.from("party_albums").select(ALBUM_COLS).eq("order_id", orderId).maybeSingle()
  return (data as AlbumRow | null) ?? null
}

/** Idempotent: an order has at most one album. */
export async function ensureAlbumForOrder(supabase: SupabaseClient, orderId: string, createdBy: string): Promise<AlbumRow> {
  const existing = await albumForOrder(supabase, orderId)
  if (existing) return existing
  const { data: order, error: oErr } = await supabase.from("orders").select("id, customer_name, event_start, event_address").eq("id", orderId).maybeSingle()
  if (oErr || !order) throw new Error(oErr?.message ?? "order not found")
  const eventDate = order.event_start
    ? new Date(order.event_start as string).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })
    : null
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from("party_albums")
      .insert({
        order_id: orderId,
        token: newAlbumToken(),
        view_token: newAlbumToken(),
        title: albumTitle(order.customer_name as string | null),
        event_date: eventDate,
        place: cityOf(order.event_address as string | null),
        created_by: createdBy,
      })
      .select(ALBUM_COLS)
      .single()
    if (!error && data) return data as AlbumRow
    const again = await albumForOrder(supabase, orderId)
    if (again) return again
    if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message)
  }
  throw new Error("could not create album")
}

/** Storage folder for one uploader: a guest's device id, or "staff". */
export const albumDir = (album: AlbumRow, who: string) => `album/${album.id}/${who}/`

/** One-time signed upload URL(s) for a file going into `dir`. */
export async function albumSlot(
  supabase: SupabaseClient,
  dir: string,
  typeRaw: unknown,
  sizeRaw: unknown,
  wantThumb: boolean,
): Promise<{ ok: true; path: string; url: string; thumbPath: string | null; thumbUrl: string | null } | { ok: false; error: string; status?: number }> {
  const type = String(typeRaw ?? "").toLowerCase()
  const media = ALBUM_MEDIA_TYPES[type]
  if (!media) return { ok: false, error: "We can take photos (JPG, PNG, HEIC) and videos (MP4, MOV)." }
  const size = Number(sizeRaw ?? 0)
  if (!(size > 0) || size > ALBUM_MAX_BYTES) return { ok: false, error: "That file is over 500 MB. Could you trim it a little and try again?" }
  const stem = `${dir}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const path = `${stem}.${media.ext}`
  const main = await supabase.storage.from(ALBUM_BUCKET).createSignedUploadUrl(path)
  if (main.error || !main.data) return { ok: false, error: main.error?.message ?? "no upload url", status: 500 }
  let thumbPath: string | null = null
  let thumbUrl: string | null = null
  if (wantThumb) {
    thumbPath = `${stem}.thumb.jpg`
    const t = await supabase.storage.from(ALBUM_BUCKET).createSignedUploadUrl(thumbPath)
    thumbUrl = t.data?.signedUrl ?? null
    if (!thumbUrl) thumbPath = null
  }
  return { ok: true, path, url: main.data.signedUrl, thumbPath, thumbUrl }
}

/** Index a file that landed in `dir` (checks it is really there). */
export async function albumIndex(
  supabase: SupabaseClient,
  album: AlbumRow,
  dir: string,
  pathRaw: unknown,
  thumbRaw: unknown,
  who: { source: AlbumSource; device: string | null; addedBy: string | null },
): Promise<{ ok: true; id: string } | { ok: false; error: string; status?: number }> {
  const path = String(pathRaw ?? "")
  if (!path.startsWith(dir)) return { ok: false, error: "bad path" }
  const name = path.slice(dir.length)
  const m = /^\d+-[a-z0-9]+\.([a-z0-9]+)$/.exec(name)
  if (!m) return { ok: false, error: "bad path" }
  const entry = Object.entries(ALBUM_MEDIA_TYPES).find(([, v]) => v.ext === m[1])
  if (!entry) return { ok: false, error: "bad type" }
  const { data: dup } = await supabase.from("album_media").select("id").eq("storage_path", path).maybeSingle()
  if (dup) return { ok: true, id: dup.id as string }
  const { data: listed } = await supabase.storage.from(ALBUM_BUCKET).list(dir.slice(0, -1), { search: name.split(".")[0], limit: 10 })
  const obj = (listed ?? []).find((o) => o.name === name)
  if (!obj) return { ok: false, error: "The upload didn't finish. Could you try that one again?" }
  const thumb = String(thumbRaw ?? "")
  const thumbName = thumb.startsWith(dir) ? thumb.slice(dir.length) : ""
  const thumbOk = !!thumbName && thumbName === `${name.replace(/\.[a-z0-9]+$/, "")}.thumb.jpg` && (listed ?? []).some((o) => o.name === thumbName)
  const meta = (obj.metadata ?? {}) as { size?: number; mimetype?: string }
  const { data: row, error } = await supabase
    .from("album_media")
    .insert({
      album_id: album.id,
      device: who.device,
      source: who.source,
      added_by: who.addedBy,
      kind: entry[1].kind,
      storage_path: path,
      thumb_path: thumbOk ? thumb : null,
      content_type: meta.mimetype || entry[0],
      bytes: typeof meta.size === "number" ? meta.size : null,
      terms_version: ALBUM_TERMS_VERSION,
    })
    .select("id")
    .single()
  if (error || !row) return { ok: false, error: error?.message ?? "could not save", status: 500 }
  return { ok: true, id: row.id as string }
}

/**
 * Copy the chef's shots from the prep sheet (order_photos) into the album. The
 * files stay where they are; the album rows just point at them. Setup photos
 * (an empty table) are skipped unless asked for. Returns how many were added.
 */
export async function importChefPhotos(supabase: SupabaseClient, album: AlbumRow, addedBy: string, includeSetup = false): Promise<number> {
  if (!album.order_id) return 0
  const phases = includeSetup ? ["setup", "volcano", "after"] : ["volcano", "after"]
  const { data: photos } = await supabase
    .from("order_photos")
    .select("storage_path, content_type, bytes, phase")
    .eq("order_id", album.order_id)
    .in("phase", phases)
    .order("created_at", { ascending: true })
  const { data: have } = await supabase.from("album_media").select("storage_path").eq("album_id", album.id).eq("source", "chef")
  const already = new Set((have ?? []).map((h) => h.storage_path as string))
  const rows = (photos ?? [])
    .filter((p) => !already.has(p.storage_path as string))
    .map((p) => ({
      album_id: album.id,
      device: null,
      source: "chef",
      added_by: addedBy,
      kind: String(p.content_type ?? "").startsWith("video/") ? "video" : "photo",
      storage_path: p.storage_path as string,
      thumb_path: null,
      content_type: p.content_type as string | null,
      bytes: p.bytes as number | null,
      terms_version: ALBUM_TERMS_VERSION,
    }))
  if (rows.length === 0) return 0
  const { error } = await supabase.from("album_media").insert(rows)
  if (error) throw new Error(error.message)
  return rows.length
}

async function signMany(supabase: SupabaseClient, paths: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)))
  if (unique.length === 0) return new Map()
  const { data } = await supabase.storage.from(ALBUM_BUCKET).createSignedUrls(unique, SIGN_TTL)
  return new Map((data ?? []).filter((s) => s.signedUrl).map((s) => [s.path ?? "", s.signedUrl]))
}

/**
 * What a viewer sees. Seeds first - this party's chef video leads, so it is the
 * cover (seedRank) - then guests, newest first, so a guest coming back sees
 * what's new.
 */
export async function albumItems(
  supabase: SupabaseClient,
  album: AlbumRow,
  opts: { device?: string | null; includeHidden?: boolean } = {},
): Promise<{ items: AlbumItem[]; rows: AlbumMediaRow[] }> {
  let q = supabase.from("album_media").select(MEDIA_COLS).eq("album_id", album.id).order("created_at", { ascending: true }).limit(1000)
  if (!opts.includeHidden) q = q.eq("status", "visible")
  const { data } = await q
  const all = (data ?? []) as AlbumMediaRow[]
  const seeds = all.filter((r) => r.source !== "guest").sort((a, b) => seedRank(a) - seedRank(b))
  const guests = all.filter((r) => r.source === "guest").reverse()
  const rows = [...seeds, ...guests]
  const [signed, names] = await Promise.all([
    signMany(supabase, rows.flatMap((r) => [r.storage_path, r.thumb_path ?? ""])),
    guestNames(supabase, album.id),
  ])
  const items = rows.map((r) => {
    const mine = !!opts.device && r.device === opts.device
    return {
      id: r.id,
      source: r.source,
      kind: r.kind,
      url: signed.get(r.storage_path) ?? null,
      thumb: r.thumb_path ? (signed.get(r.thumb_path) ?? null) : null,
      by: albumByLabel(r.source, mine, r.device ? names.get(r.device) : null),
      name: r.source === "guest" && r.device ? (albumFirstName(names.get(r.device)) ?? null) : null,
      mine,
      createdAt: r.created_at,
    }
  })
  return { items, rows }
}

/** "8 people" - distinct guest phones plus us, if we seeded. */
export function contributorCount(rows: AlbumMediaRow[]): number {
  const guests = new Set(rows.filter((r) => r.source === "guest" && r.device).map((r) => r.device))
  return guests.size + (rows.some((r) => r.source !== "guest") ? 1 : 0)
}

/** device -> name a guest left on this album. */
export async function guestNames(supabase: SupabaseClient, albumId: string): Promise<Map<string, string>> {
  const { data } = await supabase.from("album_people").select("device, name").eq("album_id", albumId).not("device", "is", null)
  return new Map((data ?? []).map((p) => [p.device as string, String(p.name ?? "")]))
}

/** Save (or change) the first name for one phone on one album. */
export async function setGuestName(supabase: SupabaseClient, albumId: string, device: string, raw: string): Promise<string | null> {
  const name = albumFirstName(raw)
  if (!name) return null
  const { data: have } = await supabase.from("album_people").select("id").eq("album_id", albumId).eq("device", device).maybeSingle()
  if (have) {
    await supabase.from("album_people").update({ name, terms_version: ALBUM_TERMS_VERSION }).eq("id", have.id)
  } else {
    const { error } = await supabase.from("album_people").insert({ album_id: albumId, device, name, terms_version: ALBUM_TERMS_VERSION })
    if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message)
    if (error) await supabase.from("album_people").update({ name }).eq("album_id", albumId).eq("device", device)
  }
  return name
}

/**
 * Owner, 2026-11-23: "as soon as the party starts normally that day, make one
 * automatically". Every party that is still active and whose start time has
 * passed (looking back 12 hours) gets its album, with the chef's shots so far.
 * Nothing is sent to anyone. Returns the orders it made albums for.
 */
export async function autoCreateAlbums(supabase: SupabaseClient, now = new Date()): Promise<string[]> {
  const from = new Date(now.getTime() - 12 * 3600 * 1000).toISOString()
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id")
    .eq("order_status", "active")
    .gte("event_start", from)
    .lte("event_start", now.toISOString())
    .limit(50)
  if (error) throw new Error(error.message)
  const ids = (orders ?? []).map((o) => o.id as string)
  if (ids.length === 0) return []
  const { data: have } = await supabase.from("party_albums").select("order_id").in("order_id", ids)
  const has = new Set((have ?? []).map((h) => h.order_id as string))
  const made: string[] = []
  for (const id of ids.filter((x) => !has.has(x))) {
    const album = await ensureAlbumForOrder(supabase, id, "auto")
    await importChefPhotos(supabase, album, "auto").catch(() => 0)
    made.push(id)
  }
  return made
}
