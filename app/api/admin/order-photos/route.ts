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
  if (!resolveAdminActor(request)) {
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
      created_at: r.created_at,
      url: urlByPath.get(r.storage_path) ?? null,
    })),
  })
}
