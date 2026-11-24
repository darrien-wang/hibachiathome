import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { resolveAdminActor } from "@/lib/admin-auth"
import { CRON_PURPOSE_PARTY_ALBUMS, isCronCall } from "@/lib/cron-key"
import {
  albumDir,
  albumForOrder,
  albumIndex,
  albumItems,
  albumLinks,
  albumSlot,
  autoCreateAlbums,
  contributorCount,
  ensureAlbumForOrder,
  importChefPhotos,
} from "@/lib/party-album-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 派对相册 · 工作台侧（2026-11-23）
//   GET  ?orderId=                                   -> { album, links{invite 能上传, share 只能看}, items(含隐藏), people }
//   POST { action: "create", orderId }               -> 建相册（幂等，一单一个），顺手把师傅拍的放进去
//   POST { action: "title", orderId, title }         -> 改标题（"Sophia's Sweet 16"）
//   POST { action: "slot", orderId, type, size, thumb } -> 种子素材：签名上传地址
//   POST { action: "done", orderId, path, thumbPath }   -> 种子素材：入库
//   POST { action: "chef", orderId, setup? }         -> 把师傅备料单上传的照片视频放进相册
//   POST { action: "media", id, status?, picked? }   -> 隐藏/恢复、挑进选材夹
//   POST { action: "status", orderId, open }         -> 关/开上传
//   POST ?consumer=cron（pg_cron 每 15 分钟，派生钥匙 party-albums）-> 已开始没取消的派对自动建相册，不发任何消息

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const linksFor = (request: NextRequest, album: Parameters<typeof albumLinks>[1]) => albumLinks(new URL(request.url).origin, album)
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function GET(request: NextRequest) {
  if (!(await resolveAdminActor(request))) return fail("unauthorized", 401)
  const supabase = createServerSupabaseClient()
  if (!supabase) return fail("supabase not configured", 500)
  const orderId = request.nextUrl.searchParams.get("orderId") ?? ""
  if (!UUID_RE.test(orderId)) return fail("orderId required")
  const album = await albumForOrder(supabase, orderId)
  if (!album) return NextResponse.json({ ok: true, album: null })
  const { items, rows } = await albumItems(supabase, album, { includeHidden: true })
  const byId = new Map(rows.map((r) => [r.id, r]))
  return NextResponse.json({
    ok: true,
    album: { id: album.id, title: album.title, eventDate: album.event_date, place: album.place, open: album.status === "open", token: album.token },
    links: linksFor(request, album),
    items: items.map((it) => ({ ...it, status: byId.get(it.id)?.status ?? "visible", picked: byId.get(it.id)?.picked ?? false })),
    people: contributorCount(rows.filter((r) => r.status === "visible")),
  })
}

export async function POST(request: NextRequest) {
  if (isCronCall(request, CRON_PURPOSE_PARTY_ALBUMS)) {
    const supabase = createServerSupabaseClient()
    if (!supabase) return fail("supabase not configured", 500)
    try {
      const made = await autoCreateAlbums(supabase)
      return NextResponse.json({ ok: true, made: made.length })
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e), 500)
    }
  }
  const actor = await resolveAdminActor(request)
  if (!actor) return fail("unauthorized", 401)
  const supabase = createServerSupabaseClient()
  if (!supabase) return fail("supabase not configured", 500)
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return fail("invalid json")
  }

  if (body.action === "media") {
    const id = String(body.id ?? "")
    if (!UUID_RE.test(id)) return fail("id required")
    const patch: Record<string, unknown> = {}
    if (body.status === "visible" || body.status === "hidden") patch.status = body.status
    if (typeof body.picked === "boolean") patch.picked = body.picked
    if (Object.keys(patch).length === 0) return fail("nothing to change")
    const { error } = await supabase.from("album_media").update(patch).eq("id", id)
    return error ? fail(error.message, 500) : NextResponse.json({ ok: true })
  }

  const orderId = String(body.orderId ?? "")
  if (!UUID_RE.test(orderId)) return fail("orderId required")

  if (body.action === "create") {
    try {
      const album = await ensureAlbumForOrder(supabase, orderId, actor.alias)
      // The chef's volcano and end-of-party shots are the natural first seeds.
      const added = await importChefPhotos(supabase, album, actor.alias).catch(() => 0)
      return NextResponse.json({ ok: true, links: linksFor(request, album), chefAdded: added })
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e), 500)
    }
  }

  const album = await albumForOrder(supabase, orderId)
  if (!album) return fail("这单还没有相册")

  if (body.action === "title") {
    const title = String(body.title ?? "").trim().replace(/\s+/g, " ").slice(0, 60)
    if (title.length < 2) return fail("标题太短")
    const { error } = await supabase.from("party_albums").update({ title }).eq("id", album.id)
    return error ? fail(error.message, 500) : NextResponse.json({ ok: true })
  }

  if (body.action === "slot") {
    const slot = await albumSlot(supabase, albumDir(album, "staff"), body.type, body.size, !!body.thumb)
    return slot.ok ? NextResponse.json(slot) : fail(slot.error, slot.status)
  }

  if (body.action === "done") {
    const r = await albumIndex(supabase, album, albumDir(album, "staff"), body.path, body.thumbPath, { source: "staff", device: null, addedBy: actor.alias })
    return r.ok ? NextResponse.json(r) : fail(r.error, r.status)
  }

  if (body.action === "chef") {
    try {
      const added = await importChefPhotos(supabase, album, actor.alias, !!body.setup)
      return NextResponse.json({ ok: true, added })
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e), 500)
    }
  }

  if (body.action === "status") {
    const { error } = await supabase.from("party_albums").update({ status: body.open ? "open" : "closed" }).eq("id", album.id)
    return error ? fail(error.message, 500) : NextResponse.json({ ok: true })
  }

  return fail("unknown action")
}
