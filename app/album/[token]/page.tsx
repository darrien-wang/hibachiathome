import type { Metadata } from "next"
import AlbumClient from "./AlbumClient"

// 派对相册（2026-11-23）：派对后发给主人、主人转到群里，大家把照片视频都传上来，
// 传了的人留名字手机拿 $50 券。私人页面，一场派对一个链接。

export const metadata: Metadata = {
  title: "Party album",
  description: "Everyone's photos and videos from the party, in one place.",
  robots: { index: false, follow: false, nocache: true },
}

export default async function AlbumPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return (
    <main className="min-h-[70vh] bg-cream text-ink">
      <AlbumClient token={token} />
    </main>
  )
}
