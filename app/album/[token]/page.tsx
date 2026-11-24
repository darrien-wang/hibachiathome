import type { Metadata } from "next"
import { headers } from "next/headers"
import { createServerSupabaseClient } from "@/lib/supabase"
import { albumByToken } from "@/lib/party-album-server"
import AlbumClient from "./AlbumClient"

// 派对相册（2026-11-23）：一场派对两个链接——邀请链接（能上传）和展示链接（只能看、能再分享）。
// 链接预览（Facebook/iMessage/WhatsApp）显示 "Tommy's Party" + 封面图。私人页面，不进索引。

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  const supabase = createServerSupabaseClient()
  const found = supabase ? await albumByToken(supabase, token).catch(() => null) : null
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "www.realhibachi.com"
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  const origin = `${proto}://${host}`
  const title = found?.album.title ?? "Party album"
  const description = "Photos and videos from the night."
  const image = found ? `${origin}/api/album/${token}/cover` : undefined
  return {
    title: { absolute: title },
    description,
    robots: { index: false, follow: false, nocache: true },
    alternates: { canonical: null },
    openGraph: { title, description, type: "website", url: `${origin}/album/${token}`, images: image ? [{ url: image, width: 960, height: 960 }] : undefined },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : undefined },
  }
}

export default async function AlbumPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return (
    <main className="min-h-[70vh] bg-cream text-ink">
      <AlbumClient token={token} />
    </main>
  )
}
