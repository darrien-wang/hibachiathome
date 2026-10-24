import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { resolveAdminActor } from "@/lib/admin-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// ============================================================
// Party photos (read side)
// ============================================================
// The chef uploads two sets from the prep sheet - the table once they are set
// up, and the food and the group at the end - into the private party-photos
// bucket (index: public.order_photos). This hands the workbench short-lived
// signed URLs so the owner can look at them, send them to the customer the
// next morning, and pull ad material out of them. Added 2026-09-19, the day a
// party went by with no pictures at all.
//
//   GET ?orderId=<uuid>  ->  { photos: [{ id, phase, url, created_at }] }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SIGNED_URL_TTL_SECONDS = 3600

type PhotoRow = {
  id: string
  phase: string
  storage_path: string
  content_type: string | null
  bytes: number | null
  created_at: string
}

export async function GET(request: NextRequest) {
  if (!(await resolveAdminActor(request))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }
  const orderId = (request.nextUrl.searchParams.get("orderId") ?? "").trim()
  if (!UUID_RE.test(orderId)) return NextResponse.json({ error: "orderId required" }, { status: 400 })

  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "supabase not configured" }, { status: 500 })

  const { data, error } = await supabase
    .from("order_photos")
    .select("id,phase,storage_path,content_type,bytes,created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as PhotoRow[]
  if (rows.length === 0) return NextResponse.json({ ok: true, photos: [] })

  const { data: signed, error: signError } = await supabase.storage
    .from("party-photos")
    .createSignedUrls(rows.map((r) => r.storage_path), SIGNED_URL_TTL_SECONDS)
  if (signError) return NextResponse.json({ error: signError.message }, { status: 500 })

  const urlByPath = new Map((signed ?? []).map((s) => [s.path ?? "", s.signedUrl]))
  return NextResponse.json({
    ok: true,
    photos: rows.map((r) => ({
      id: r.id,
      phase: r.phase,
      bytes: r.bytes,
      content_type: r.content_type,
      created_at: r.created_at,
      url: urlByPath.get(r.storage_path) ?? null,
    })),
  })
}

// ============================================================
// Party media (write side, owner only) - 2026-10-24
// ============================================================
// Chefs sometimes send the party video over WeChat instead of the prep sheet
// (a 54 s phone clip is ~100 MB; the sheet's link has also expired by the next
// morning). This lets the workbench / desk file it on the order the same way the
// prep sheet does: ask for a one-time signed upload URL, PUT the file straight
// into the party-photos bucket (it never passes through this server), then
// report it so it gets an order_photos row and shows in the media library.
//
//   POST { action: "slot", orderId, phase, type, size }  -> { path, url }
//   POST { action: "done", orderId, phase, path }        -> { ok, id }

const PHASES = new Set(["setup", "volcano", "after"])
const MEDIA_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
}

export async function POST(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (actor.role !== "owner") return NextResponse.json({ error: "只有老板能补传派对素材" }, { status: 403 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "supabase not configured" }, { status: 500 })
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  const orderId = String(body.orderId ?? "")
  const phase = String(body.phase ?? "")
  if (!UUID_RE.test(orderId)) return NextResponse.json({ error: "orderId required" }, { status: 400 })
  if (!PHASES.has(phase)) return NextResponse.json({ error: "phase 只能是 setup / volcano / after" }, { status: 400 })

  if (body.action === "slot") {
    const type = String(body.type ?? "").toLowerCase()
    const ext = MEDIA_TYPES[type]
    if (!ext) return NextResponse.json({ error: "只收 jpg/png/webp/mp4/mov/webm" }, { status: 400 })
    const path = `${orderId}/${phase}-${Date.now()}-w.${ext}`
    const { data, error } = await supabase.storage.from("party-photos").createSignedUploadUrl(path)
    if (error || !data) return NextResponse.json({ error: error?.message ?? "no upload url" }, { status: 500 })
    return NextResponse.json({ ok: true, path, url: data.signedUrl })
  }

  if (body.action === "done") {
    const path = String(body.path ?? "")
    const m = new RegExp(`^${orderId}/${phase}-\d+-w\.(jpg|png|webp|mp4|mov|webm)$`).exec(path)
    if (!m) return NextResponse.json({ error: "bad path" }, { status: 400 })
    const name = path.slice(orderId.length + 1)
    const { data: listed } = await supabase.storage.from("party-photos").list(orderId, { search: name, limit: 5 })
    const obj = (listed ?? []).find((o) => o.name === name)
    if (!obj) return NextResponse.json({ error: "not uploaded" }, { status: 400 })
    const meta = (obj.metadata ?? {}) as { size?: number; mimetype?: string }
    const contentType = meta.mimetype || Object.entries(MEDIA_TYPES).find(([, e]) => e === m[1])?.[0] || null
    const { data: row, error } = await supabase
      .from("order_photos")
      .insert({ order_id: orderId, phase, storage_path: path, content_type: contentType, bytes: typeof meta.size === "number" ? meta.size : null, uploaded_by: `admin:${actor.alias}` })
      .select("id")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, id: row.id })
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 })
}
