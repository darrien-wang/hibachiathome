// ============================================================
// Party album - what "Share" sends to each place (owner, 2026-11-23)
// ============================================================
// "Share" only ever hands out the look-only link (or the media itself), never
// the invite link. Each platform gets what works there:
//   Instagram / TikTok - no web share URL and links in captions don't click, so
//     the phone's share sheet gets the file itself (a video if there is one;
//     TikTok also takes photos) and the caption goes to the clipboard.
//   Facebook - the share link; the preview (title + cover) comes from og tags.
//   X - short text + the share link.
//   WhatsApp / Messages - text + the share link.
// Pure functions: safe for client and tests.

export type SharePlatform = "instagram" | "tiktok" | "facebook" | "x" | "whatsapp" | "messages" | "copy" | "more"

export type ShareMediaItem = { kind: "photo" | "video"; url: string | null; source?: string }

export type SharePlan =
  | { kind: "file"; prefer: "video" | "photo"; caption: string }
  | { kind: "open"; url: string }
  | { kind: "copy"; text: string }
  | { kind: "native"; text: string; url: string }

export const SHARE_PLATFORMS: Array<{ id: SharePlatform; label: string }> = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "facebook", label: "Facebook" },
  { id: "x", label: "X" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "messages", label: "Messages" },
  { id: "copy", label: "Copy link" },
  { id: "more", label: "More" },
]

export function shareText(title: string): string {
  return `${title} 🔥 Look back at the night:`
}

export function sharePlan(platform: SharePlatform, ctx: { title: string; shareLink: string }): SharePlan {
  const line = shareText(ctx.title)
  switch (platform) {
    case "instagram":
      return { kind: "file", prefer: "video", caption: `${ctx.title} 🔥 Hibachi night with @realhibachi` }
    case "tiktok":
      return { kind: "file", prefer: "video", caption: `${ctx.title} 🔥 #hibachi #hibachiparty #partyideas` }
    case "facebook":
      return { kind: "open", url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(ctx.shareLink)}` }
    case "x":
      return { kind: "open", url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(line)}&url=${encodeURIComponent(ctx.shareLink)}` }
    case "whatsapp":
      return { kind: "open", url: `https://wa.me/?text=${encodeURIComponent(`${line} ${ctx.shareLink}`)}` }
    case "messages":
      // "sms:?&body=" is the form both iOS and Android accept.
      return { kind: "open", url: `sms:?&body=${encodeURIComponent(`${line} ${ctx.shareLink}`)}` }
    case "copy":
      return { kind: "copy", text: ctx.shareLink }
    case "more":
    default:
      return { kind: "native", text: line, url: ctx.shareLink }
  }
}

/**
 * Which file goes to Instagram / TikTok: the finished party video if there is
 * one, else the first video in the album (seeds come first, so ours), else the
 * first photo.
 */
export function pickShareMedia(
  items: ShareMediaItem[],
  partyVideo: string | null,
  prefer: "video" | "photo",
): { url: string; kind: "photo" | "video" } | null {
  if (partyVideo) return { url: partyVideo, kind: "video" }
  const withUrl = items.filter((i) => i.url)
  const first = (k: "photo" | "video") => withUrl.find((i) => i.kind === k)
  const pick = prefer === "video" ? (first("video") ?? first("photo")) : (first("photo") ?? first("video"))
  return pick?.url ? { url: pick.url, kind: pick.kind } : null
}

/** "Tommy's Party" -> "tommys-party.mp4" */
export function shareFileName(title: string, kind: "photo" | "video", contentType: string): string {
  const stem = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "party"
  const ext = kind === "video" ? (/quicktime/.test(contentType) ? "mov" : /webm/.test(contentType) ? "webm" : "mp4") : /png/.test(contentType) ? "png" : /webp/.test(contentType) ? "webp" : "jpg"
  return `${stem}.${ext}`
}
