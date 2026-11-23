import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { resolveAdminActor } from "@/lib/admin-auth"
import { ALBUM_COUPON } from "@/lib/party-album"
import { albumForOrder, albumItems, ensureAlbumForOrder } from "@/lib/party-album-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 派对相册 · 工作台侧（2026-11-23）
//   GET  ?orderId=                          -> { album, link, items(含隐藏), people(含券码) }
//   POST { action: "create", orderId }      -> 建相册（幂等，一单一个）
//   POST { action: "media", id, status?, picked? } -> 隐藏/恢复、挑进选材夹
//   POST { action: "status", orderId, open } -> 关/开上传

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const linkFor = (request: NextRequest, token: string) => `${new URL(request.url).origin}/album/${token}`

export async function GET(request: NextRequest) {
  if (!(await resolveAdminActor(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "supabase not configured" }, { status: 500 })
  const orderId = request.nextUrl.searchParams.get("orderId") ?? ""
  if (!UUID_RE.test(orderId)) return NextResponse.json({ error: "orderId required" }, { status: 400 })
  const album = await albumForOrder(supabase, orderId)
  if (!album) return NextResponse.json({ ok: true, album: null })

  const { items, rows } = await albumItems(supabase, album, { includeHidden: true })
  const byId = new Map(rows.map((r) => [r.id, r]))
  const [{ data: people }, { data: coupons }] = await Promise.all([
    supabase.from("album_people").select("id, name, phone, ads_ok, created_at").eq("album_id", album.id).order("created_at"),
    supabase.from("coupons").select("phone, code, redeemed_at").eq("source", ALBUM_COUPON.source).eq("album_id", album.id),
  ])
  const couponOf = new Map((coupons ?? []).map((c) => [c.phone as string, c]))
  const countOf = new Map<string, number>()
  for (const r of rows) if (r.person_id) countOf.set(r.person_id, (countOf.get(r.person_id) ?? 0) + 1)

  return NextResponse.json({
    ok: true,
    album: { id: album.id, title: album.title, eventDate: album.event_date, open: album.status === "open", token: album.token },
    link: linkFor(request, album.token),
    items: items.map((it) => ({ ...it, status: byId.get(it.id)?.status ?? "visible", picked: byId.get(it.id)?.picked ?? false })),
    people: (people ?? []).map((p) => ({
      name: p.name,
      phone: p.phone,
      adsOk: p.ads_ok,
      uploads: countOf.get(p.id as string) ?? 0,
      code: couponOf.get(p.phone as string)?.code ?? null,
      redeemed: !!couponOf.get(p.phone as string)?.redeemed_at,
    })),
    anonymousUploads: rows.filter((r) => !r.person_id).length,
  })
}

export async function POST(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "supabase not configured" }, { status: 500 })
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }

  if (body.action === "create") {
    const orderId = String(body.orderId ?? "")
    if (!UUID_RE.test(orderId)) return NextResponse.json({ error: "orderId required" }, { status: 400 })
    try {
      const album = await ensureAlbumForOrder(supabase, orderId, actor.alias)
      return NextResponse.json({ ok: true, token: album.token, link: linkFor(request, album.token) })
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
    }
  }

  if (body.action === "media") {
    const id = String(body.id ?? "")
    if (!UUID_RE.test(id)) return NextResponse.json({ error: "id required" }, { status: 400 })
    const patch: Record<string, unknown> = {}
    if (body.status === "visible" || body.status === "hidden") patch.status = body.status
    if (typeof body.picked === "boolean") patch.picked = body.picked
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "nothing to change" }, { status: 400 })
    const { error } = await supabase.from("album_media").update(patch).eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === "status") {
    const orderId = String(body.orderId ?? "")
    if (!UUID_RE.test(orderId)) return NextResponse.json({ error: "orderId required" }, { status: 400 })
    const { error } = await supabase.from("party_albums").update({ status: body.open ? "open" : "closed" }).eq("order_id", orderId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 })
}
