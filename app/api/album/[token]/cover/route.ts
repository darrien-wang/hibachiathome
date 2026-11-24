import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { ALBUM_BUCKET } from "@/lib/party-album"
import { albumByToken } from "@/lib/party-album-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// The album's cover for link previews (og:image). Facebook, iMessage and
// WhatsApp cache the preview image URL, and signed storage URLs die in hours, so
// the page points here and this redirects to a fresh signed URL each time.
// Cover = the first visible seed (or item) that has a still image.

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createServerSupabaseClient()
  if (!supabase) return new NextResponse("not configured", { status: 500 })
  const found = await albumByToken(supabase, token)
  if (!found) return new NextResponse("not found", { status: 404 })
  const { data } = await supabase
    .from("album_media")
    .select("kind, source, storage_path, thumb_path, created_at")
    .eq("album_id", found.album.id)
    .eq("status", "visible")
    .order("created_at", { ascending: true })
    .limit(60)
  const rows = (data ?? []) as Array<{ kind: string; source: string; storage_path: string; thumb_path: string | null }>
  const ordered = [...rows.filter((r) => r.source !== "guest"), ...rows.filter((r) => r.source === "guest")]
  const pick = ordered.find((r) => r.kind === "photo") ?? ordered.find((r) => r.thumb_path)
  const path = pick ? (pick.kind === "photo" ? pick.storage_path : pick.thumb_path) : null
  if (!path) return NextResponse.redirect(new URL("/images/brand/flame.png", _request.url), 302)
  const { data: signed } = await supabase.storage.from(ALBUM_BUCKET).createSignedUrl(path, 24 * 3600)
  if (!signed?.signedUrl) return new NextResponse("not found", { status: 404 })
  const res = NextResponse.redirect(signed.signedUrl, 302)
  res.headers.set("Cache-Control", "public, max-age=3600")
  return res
}
