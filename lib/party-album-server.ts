import type { SupabaseClient } from "@supabase/supabase-js"
import { ALBUM_BUCKET, albumTitle, newAlbumToken } from "@/lib/party-album"

// Server half of the party album: create one per order, list what is in it.

export type AlbumRow = {
  id: string
  order_id: string | null
  token: string
  title: string
  event_date: string | null
  status: "open" | "closed"
  video_path: string | null
  video_ready_at: string | null
  created_at: string
}

export type AlbumMediaRow = {
  id: string
  album_id: string
  person_id: string | null
  device: string | null
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
  source: "guest" | "chef"
  kind: "photo" | "video"
  url: string | null
  thumb: string | null
  by: string | null
  mine?: boolean
  createdAt: string
}

const SIGN_TTL = 6 * 3600
const ALBUM_COLS = "id, order_id, token, title, event_date, status, video_path, video_ready_at, created_at"

export async function albumByToken(supabase: SupabaseClient, token: string): Promise<AlbumRow | null> {
  if (!/^[a-z0-9]{8,24}$/.test(token)) return null
  const { data } = await supabase.from("party_albums").select(ALBUM_COLS).eq("token", token).maybeSingle()
  return (data as AlbumRow | null) ?? null
}

export async function albumForOrder(supabase: SupabaseClient, orderId: string): Promise<AlbumRow | null> {
  const { data } = await supabase.from("party_albums").select(ALBUM_COLS).eq("order_id", orderId).maybeSingle()
  return (data as AlbumRow | null) ?? null
}

/** Idempotent: an order has at most one album. */
export async function ensureAlbumForOrder(supabase: SupabaseClient, orderId: string, createdBy: string): Promise<AlbumRow> {
  const existing = await albumForOrder(supabase, orderId)
  if (existing) return existing
  const { data: order, error: oErr } = await supabase
    .from("orders")
    .select("id, customer_name, event_start")
    .eq("id", orderId)
    .maybeSingle()
  if (oErr || !order) throw new Error(oErr?.message ?? "order not found")
  const eventDate = order.event_start
    ? new Date(order.event_start as string).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })
    : null
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase
      .from("party_albums")
      .insert({ order_id: orderId, token: newAlbumToken(), title: albumTitle(order.customer_name as string | null), event_date: eventDate, created_by: createdBy })
      .select(ALBUM_COLS)
      .single()
    if (!error && data) return data as AlbumRow
    // Lost a race with another click: read the winner back.
    const again = await albumForOrder(supabase, orderId)
    if (again) return again
    if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message)
  }
  throw new Error("could not create album")
}

async function signMany(supabase: SupabaseClient, paths: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter(Boolean)))
  if (unique.length === 0) return new Map()
  const { data } = await supabase.storage.from(ALBUM_BUCKET).createSignedUrls(unique, SIGN_TTL)
  return new Map((data ?? []).filter((s) => s.signedUrl).map((s) => [s.path ?? "", s.signedUrl]))
}

/**
 * Everything a viewer of the album sees: guests' uploads (visible only, unless
 * includeHidden) plus the chef's shots of the food and the volcano (the setup
 * photo of an empty table is left out - nobody wants that one).
 */
export async function albumItems(
  supabase: SupabaseClient,
  album: AlbumRow,
  opts: { device?: string | null; includeHidden?: boolean } = {},
): Promise<{ items: AlbumItem[]; rows: AlbumMediaRow[] }> {
  let q = supabase
    .from("album_media")
    .select("id, album_id, person_id, device, kind, storage_path, thumb_path, content_type, bytes, status, picked, created_at")
    .eq("album_id", album.id)
    .order("created_at", { ascending: true })
    .limit(1000)
  if (!opts.includeHidden) q = q.eq("status", "visible")
  const { data: mediaData } = await q
  const rows = (mediaData ?? []) as AlbumMediaRow[]

  const personIds = Array.from(new Set(rows.map((r) => r.person_id).filter(Boolean))) as string[]
  const { data: people } = personIds.length
    ? await supabase.from("album_people").select("id, name").in("id", personIds)
    : { data: [] as Array<{ id: string; name: string }> }
  const nameOf = new Map((people ?? []).map((p) => [p.id as string, String(p.name ?? "").split(/\s+/)[0] || null]))

  const chef = album.order_id
    ? (
        await supabase
          .from("order_photos")
          .select("id, phase, storage_path, content_type, created_at")
          .eq("order_id", album.order_id)
          .in("phase", ["volcano", "after"])
          .order("created_at", { ascending: true })
      ).data ?? []
    : []

  const signed = await signMany(supabase, [
    ...rows.flatMap((r) => [r.storage_path, r.thumb_path ?? ""]),
    ...chef.map((c) => c.storage_path as string),
  ])

  const items: AlbumItem[] = [
    ...chef.map((c) => ({
      id: `chef-${c.id}`,
      source: "chef" as const,
      kind: String(c.content_type ?? "").startsWith("video/") ? ("video" as const) : ("photo" as const),
      url: signed.get(c.storage_path as string) ?? null,
      thumb: null,
      by: "Your chef",
      createdAt: c.created_at as string,
    })),
    ...rows.map((r) => ({
      id: r.id,
      source: "guest" as const,
      kind: r.kind,
      url: signed.get(r.storage_path) ?? null,
      thumb: r.thumb_path ? (signed.get(r.thumb_path) ?? null) : null,
      by: r.person_id ? (nameOf.get(r.person_id) ?? null) : null,
      mine: !!opts.device && r.device === opts.device,
      createdAt: r.created_at,
    })),
  ]
  return { items, rows }
}
