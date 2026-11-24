// ============================================================
// Party album (派对相册) - shared rules, safe for client and server
// ============================================================
// Owner, 2026-11-23: after the party, one link where every guest adds their
// photos and videos; we cut a party video from the pool and send it back so it
// gets shared again. Uploading = agreeing that we may use what you add on our
// social media and our website.
//
// Same day, the owner narrowed it: the page has one job - get people to join
// in. It must read as a photo/video album at first glance (staff seed it
// first), and nothing on it may pull attention away from adding: no coupon and
// no form for the person sharing. The $50 is for the people a guest shares the
// party with later (next stage), not for the guest. ALBUM_COUPON (owner-approved
// rules: 12 months, one $50 offer per party, works at the $599 minimum) and the
// coupons table wait for that stage.

/** Bump whenever the album terms change; stored on every upload. */
export const ALBUM_TERMS_VERSION = "2026-11-23.2"

export const ALBUM_COUPON = {
  amountCents: 5000,
  months: 12,
  source: "party_album",
} as const

/** One bucket for all party media; album files live under album/<albumId>/. */
export const ALBUM_BUCKET = "party-photos"
/** Same as the bucket's own limit (500 MB) - a 4K phone video fits. */
export const ALBUM_MAX_BYTES = 500 * 1024 * 1024
/** Per phone per album: generous for a real guest, a wall for a script. */
export const ALBUM_MAX_FILES_PER_DEVICE = 200

export const ALBUM_MEDIA_TYPES: Record<string, { ext: string; kind: "photo" | "video" }> = {
  "image/jpeg": { ext: "jpg", kind: "photo" },
  "image/png": { ext: "png", kind: "photo" },
  "image/webp": { ext: "webp", kind: "photo" },
  "image/heic": { ext: "heic", kind: "photo" },
  "image/heif": { ext: "heif", kind: "photo" },
  "video/mp4": { ext: "mp4", kind: "video" },
  "video/quicktime": { ext: "mov", kind: "video" },
  "video/webm": { ext: "webm", kind: "video" },
}

/** Browsers sometimes leave file.type empty (HEIC on Windows, some Android). */
export function albumMediaType(type: string, fileName: string): string | null {
  const t = (type || "").toLowerCase()
  if (ALBUM_MEDIA_TYPES[t]) return t
  const ext = (fileName.split(".").pop() || "").toLowerCase()
  const byExt: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
    mp4: "video/mp4",
    m4v: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
  }
  return byExt[ext] ?? null
}

export const DEVICE_RE = /^[a-z0-9]{16,40}$/

/**
 * "Tommy Lee" -> "Tommy's Party"; "James" -> "James' Party"; blank -> "Our Party".
 * Owner, 2026-11-23: the title should read like a keepsake ("Tommy's Party"),
 * so the first feeling is "this was a night worth remembering", not "they want
 * my info". The workbench can rename it ("Sophia's Sweet 16").
 */
export function albumTitle(customerName: string | null | undefined): string {
  const first = (customerName ?? "").trim().split(/\s+/)[0] ?? ""
  const clean = first.replace(/[^\p{L}\p{M}'\-]/gu, "")
  if (!clean) return "Our Party"
  const name = clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase()
  return /s$/i.test(name) ? `${name}' Party` : `${name}'s Party`
}

/** US numbers only (that is who we serve): "(951) 207-0523" -> "+19512070523". */
export function albumPhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "")
  const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(ten) ? `+1${ten}` : null
}

// No 0/O/1/I/L: the code gets read out loud over the phone.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

function randomChars(n: number, alphabet: string): string {
  const bytes = new Uint8Array(n)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")
}

/** Album link token: 12 lowercase letters/digits, unguessable enough for a party album. */
export function newAlbumToken(): string {
  return randomChars(12, "abcdefghijkmnpqrstuvwxyz23456789")
}

/** "RH50-7KQ3PX" */
export function newCouponCode(): string {
  return `RH${ALBUM_COUPON.amountCents / 100}-${randomChars(6, CODE_ALPHABET)}`
}

export function couponExpiry(from: Date = new Date()): Date {
  const d = new Date(from)
  d.setMonth(d.getMonth() + ALBUM_COUPON.months)
  return d
}

/** The message the host gets the morning after (copied from the workbench for now). */
export function hostAlbumText(firstName: string, link: string): string {
  const hi = firstName ? `Hi ${firstName}, thank you` : "Thank you"
  return (
    `${hi} for having us! Here are the photos and videos from your party: ${link}\n` +
    `Everyone can add theirs to the same album, and we'll make a short party video from the best clips.`
  )
}

/** What the host pastes into the group chat. */
export function groupAlbumText(link: string): string {
  return `All the pics and videos from the party are here 👉 ${link}\nAdd yours too - they're making us a party video!`
}

/**
 * Who a tile says it's from: you, us (seeds), or the first name a guest left.
 * Owner, 2026-11-23: a name on each tile gives people the "that's mine" feeling.
 */
export function albumByLabel(source: string, mine: boolean, guestName?: string | null): string | null {
  if (mine) return "You"
  if (source === "staff" || source === "chef") return "Real Hibachi"
  return albumFirstName(guestName)
}

/** "  maria  lopez " -> "Maria"; junk -> null. First names only (album terms). */
export function albumFirstName(raw: string | null | undefined): string | null {
  const first = (raw ?? "").trim().split(/\s+/)[0] ?? ""
  const clean = first.replace(/[^\p{L}\p{M}'\-]/gu, "").slice(0, 20)
  if (clean.length < 1) return null
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

/** A steady colour per name for the initial circle (same name, same colour). */
export function avatarColor(name: string): string {
  const palette = ["#c2410c", "#0f766e", "#7c3aed", "#b45309", "#be185d", "#1d4ed8", "#4d7c0f", "#9f1239"]
  let h = 0
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return palette[h % palette.length]
}
