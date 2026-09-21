import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { resolveAdminActor } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// 素材库 · 按天：厨师在师傅端传的派对照片（order_photos）+ 后台/厨师传到
// chef_files 的照片和视频，按活动日期分组，签名链接 1 小时。
//   GET ?from&to        -> { items: MediaItem[], picks: string[] }
//   POST {action:"picks", ids:[...]} -> 选材夹（存 workbench_settings.media_picks）

const BUCKET = "party-photos"
const SIGN_TTL = 3600

export type MediaItem = {
  id: string
  source: "order_photos" | "chef_files"
  date: string
  chef: string
  event: string
  orderId: string | null
  type: "photo" | "video"
  contentType: string | null
  url: string | null
  storagePath: string
  phase: string | null
  createdAt: string
}

const ptDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })

export async function GET(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "supabase not configured" }, { status: 500 })
  const to = request.nextUrl.searchParams.get("to") ?? new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })
  const from = request.nextUrl.searchParams.get("from") ?? new Date(Date.now() - 90 * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })

  const [{ data: photos }, { data: files }, { data: picksRow }] = await Promise.all([
    supabase.from("order_photos").select("id, order_id, phase, storage_path, content_type, bytes, uploaded_by, created_at").gte("created_at", `${from}T00:00:00Z`).lte("created_at", `${to}T23:59:59Z`).order("created_at", { ascending: false }).limit(1500),
    supabase.from("chef_files").select("id, staff_member_id, order_id, kind, title, storage_path, content_type, created_at").in("kind", ["photo", "video"]).gte("created_at", `${from}T00:00:00Z`).lte("created_at", `${to}T23:59:59Z`).order("created_at", { ascending: false }).limit(1500),
    supabase.from("workbench_settings").select("value").eq("key", "media_picks").maybeSingle(),
  ])
  const orderIds = Array.from(new Set([...(photos ?? []).map((p) => p.order_id), ...(files ?? []).map((f) => f.order_id)].filter(Boolean))) as string[]
  const staffIds = Array.from(new Set((files ?? []).map((f) => f.staff_member_id)))
  const [{ data: orders }, { data: assigns }, { data: staff }] = await Promise.all([
    orderIds.length ? supabase.from("orders").select("id, order_no, customer_name, event_start, event_address").in("id", orderIds) : { data: [] },
    orderIds.length ? supabase.from("order_staff_assignments").select("order_id, staff_member_id").in("order_id", orderIds).in("assignment_status", ["tentative", "confirmed", "completed"]) : { data: [] },
    supabase.from("staff_members").select("id, display_name, full_name"),
  ])
  const staffName = new Map((staff ?? []).map((s) => [s.id, String(s.display_name ?? s.full_name ?? "").trim() || "?"]))
  const orderMap = new Map((orders ?? []).map((o) => [o.id, o]))
  const chefsOf = new Map<string, string[]>()
  for (const a of assigns ?? []) (chefsOf.get(a.order_id) ?? chefsOf.set(a.order_id, []).get(a.order_id)!).push(staffName.get(a.staff_member_id) ?? "?")
  const eventLabel = (o: { customer_name: string | null; event_address: string | null } | undefined) => {
    if (!o) return "未关联订单"
    const city = (o.event_address ?? "").split(",").slice(-3, -2)[0]?.trim()
    return `${o.customer_name ?? "客户"}${city ? ` · ${city}` : ""}`
  }

  const items: MediaItem[] = []
  for (const p of photos ?? []) {
    const o = orderMap.get(p.order_id)
    const isVideo = (p.content_type ?? "").startsWith("video/")
    items.push({
      id: `op_${p.id}`,
      source: "order_photos",
      date: o?.event_start ? String(o.event_start).slice(0, 10) : ptDate(p.created_at),
      chef: (chefsOf.get(p.order_id) ?? []).join(" + ") || (p.uploaded_by ? String(p.uploaded_by).replace(/^chef:/, "") : "师傅端"),
      event: eventLabel(o),
      orderId: p.order_id,
      type: isVideo ? "video" : "photo",
      contentType: p.content_type,
      url: null,
      storagePath: p.storage_path,
      phase: p.phase,
      createdAt: p.created_at,
    })
  }
  for (const f of files ?? []) {
    const o = f.order_id ? orderMap.get(f.order_id) : undefined
    items.push({
      id: `cf_${f.id}`,
      source: "chef_files",
      date: o?.event_start ? String(o.event_start).slice(0, 10) : ptDate(f.created_at),
      chef: staffName.get(f.staff_member_id) ?? "?",
      event: o ? eventLabel(o) : f.title ?? "未关联订单",
      orderId: f.order_id,
      type: f.kind === "video" ? "video" : "photo",
      contentType: f.content_type,
      url: null,
      storagePath: f.storage_path ?? "",
      phase: null,
      createdAt: f.created_at,
    })
  }
  const paths = items.map((i) => i.storagePath).filter(Boolean)
  if (paths.length) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGN_TTL)
    const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))
    for (const i of items) i.url = byPath.get(i.storagePath) ?? null
  }
  items.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  const picks = Array.isArray((picksRow?.value as { ids?: unknown } | null)?.ids) ? ((picksRow!.value as { ids: string[] }).ids ?? []) : []
  return NextResponse.json({ ok: true, from, to, items, picks })
}

export async function POST(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "supabase not configured" }, { status: 500 })
  let body: { action?: string; ids?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  if (body.action !== "picks") return NextResponse.json({ error: "unknown action" }, { status: 400 })
  const ids = (Array.isArray(body.ids) ? body.ids : []).filter((x): x is string => typeof x === "string" && /^(op|cf)_[0-9a-f-]{36}$/i.test(x)).slice(0, 500)
  const { error } = await supabase.from("workbench_settings").upsert({ key: "media_picks", value: { ids }, updated_at: new Date().toISOString(), updated_by: actor.alias }, { onConflict: "key" })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, picks: ids })
}
