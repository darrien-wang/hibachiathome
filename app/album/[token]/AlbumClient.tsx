"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { phone as sitePhone } from "@/config/site"
import { ALBUM_COUPON, albumMediaType, groupAlbumText } from "@/lib/party-album"

// ============================================================
// /album/<token> - the party album guests open from the group chat
// ============================================================
// One big button: pick photos and videos, they upload in the background (two
// at a time, straight to storage), the grid fills in. After the first one
// lands, a card asks for name + phone and hands back a $50 code. Built to be
// the easiest page on the site: no sign-in, nothing to fill before uploading.

type Item = {
  id: string
  source: "guest" | "chef"
  kind: "photo" | "video"
  url: string | null
  thumb: string | null
  by: string | null
  mine?: boolean
  createdAt: string
}
type AlbumData = {
  ok: boolean
  error?: string
  album?: { title: string; eventDate: string | null; open: boolean; video: string | null }
  items?: Item[]
  claimed?: { code: string; expiresAt: string } | null
}
type Upload = { key: string; name: string; progress: number; state: "waiting" | "uploading" | "done" | "failed"; error?: string }

const DEVICE_KEY = "rh-album-device"

function deviceId(): string {
  const fresh = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 24)
  try {
    const have = localStorage.getItem(DEVICE_KEY)
    if (have && /^[a-z0-9]{16,40}$/.test(have)) return have
    const id = fresh()
    localStorage.setItem(DEVICE_KEY, id)
    return id
  } catch {
    return fresh()
  }
}

const prettyDate = (d: string | null) =>
  d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }) : ""

const until = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })

/** A 480px JPEG preview, made on the phone so the grid never pulls the full files. */
async function makeThumb(file: File, kind: "photo" | "video"): Promise<Blob | null> {
  const draw = (src: CanvasImageSource, w: number, h: number) => {
    if (!w || !h) return null
    const scale = Math.min(1, 480 / Math.max(w, h))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(w * scale)
    canvas.height = Math.round(h * scale)
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height)
    return new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8))
  }
  const url = URL.createObjectURL(file)
  try {
    if (kind === "photo") {
      const img = new Image()
      img.decoding = "async"
      img.src = url
      await img.decode()
      return await draw(img, img.naturalWidth, img.naturalHeight)
    }
    const video = document.createElement("video")
    video.muted = true
    video.playsInline = true
    video.preload = "metadata"
    video.src = url
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error("video"))
      setTimeout(() => reject(new Error("timeout")), 8000)
    })
    video.currentTime = Math.min(1, (video.duration || 2) / 2)
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve()
      setTimeout(() => reject(new Error("timeout")), 8000)
    })
    return await draw(video, video.videoWidth, video.videoHeight)
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

function put(url: string, body: Blob, type: string, onProgress?: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url)
    xhr.setRequestHeader("content-type", type)
    xhr.setRequestHeader("x-upsert", "false")
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total)
    }
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload ${xhr.status}`)))
    xhr.onerror = () => reject(new Error("network"))
    xhr.send(body)
  })
}

export default function AlbumClient({ token }: { token: string }) {
  const [device, setDevice] = useState<string | null>(null)
  const [data, setData] = useState<AlbumData | null>(null)
  const [uploads, setUploads] = useState<Upload[]>([])
  const [termsOpen, setTermsOpen] = useState(false)
  const [viewer, setViewer] = useState<Item | null>(null)
  const [shareNote, setShareNote] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const api = `/api/album/${encodeURIComponent(token)}`

  useEffect(() => setDevice(deviceId()), [])

  const load = useCallback(async () => {
    if (!device) return
    try {
      const res = await fetch(`${api}?device=${device}`, { cache: "no-store" })
      setData((await res.json()) as AlbumData)
    } catch {
      setData({ ok: false, error: "We couldn't open the album. Please check your connection and try again." })
    }
  }, [api, device])

  useEffect(() => {
    void load()
  }, [load])

  const post = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch(api, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, device }) })
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (!res.ok || json.ok === false) throw new Error(String(json.error ?? `Something went wrong (${res.status})`))
      return json
    },
    [api, device],
  )

  const setUpload = (key: string, patch: Partial<Upload>) => setUploads((list) => list.map((u) => (u.key === key ? { ...u, ...patch } : u)))

  const uploadOne = useCallback(
    async (file: File, key: string) => {
      const type = albumMediaType(file.type, file.name)
      if (!type) {
        setUpload(key, { state: "failed", error: "Not a photo or video" })
        return
      }
      const kind = type.startsWith("video/") ? "video" : "photo"
      setUpload(key, { state: "uploading", progress: 0.01 })
      try {
        const thumb = await makeThumb(file, kind)
        const slot = (await post({ action: "slot", type, size: file.size, thumb: !!thumb })) as { path: string; url: string; thumbPath: string | null; thumbUrl: string | null }
        await put(slot.url, file, type, (p) => setUpload(key, { progress: Math.max(0.02, p * 0.97) }))
        let thumbPath: string | null = null
        if (thumb && slot.thumbUrl && slot.thumbPath) {
          try {
            await put(slot.thumbUrl, thumb, "image/jpeg")
            thumbPath = slot.thumbPath
          } catch {
            /* the full file still made it; the grid falls back to it */
          }
        }
        await post({ action: "done", path: slot.path, thumbPath })
        setUpload(key, { state: "done", progress: 1 })
      } catch (e) {
        setUpload(key, { state: "failed", error: e instanceof Error ? e.message : "Upload failed" })
      }
    },
    [post],
  )

  const onPick = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      const batch = Array.from(files).map((f, i) => ({ file: f, key: `${Date.now()}-${i}-${f.name}` }))
      setUploads((list) => [...list, ...batch.map((b) => ({ key: b.key, name: b.file.name, progress: 0, state: "waiting" as const }))])
      // Two at a time: fast on Wi-Fi, doesn't choke a phone on LTE.
      let next = 0
      const worker = async () => {
        while (next < batch.length) {
          const b = batch[next++]
          await uploadOne(b.file, b.key)
        }
      }
      await Promise.all([worker(), worker()])
      await load()
    },
    [load, uploadOne],
  )

  const shareAlbum = useCallback(async () => {
    const link = window.location.href.split("?")[0]
    const text = groupAlbumText(link)
    try {
      if (navigator.share) {
        await navigator.share({ text })
        return
      }
      await navigator.clipboard.writeText(text)
      setShareNote("Copied - paste it into your group chat.")
    } catch {
      /* closed the share sheet */
    }
  }, [])

  const remove = useCallback(
    async (item: Item) => {
      if (!window.confirm("Remove this from the album?")) return
      try {
        await post({ action: "remove", id: item.id })
        setViewer(null)
        await load()
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Couldn't remove it")
      }
    },
    [load, post],
  )

  const items = data?.items ?? []
  const busy = uploads.some((u) => u.state === "waiting" || u.state === "uploading")
  const active = uploads.filter((u) => u.state !== "done")
  const doneCount = uploads.filter((u) => u.state === "done").length
  const addedSome = doneCount > 0 || items.some((i) => i.mine)

  const shell = "mx-auto w-full max-w-[640px] px-4 pb-16 pt-20 sm:px-5 sm:pt-24"

  if (!data) {
    return (
      <div className={shell}>
        <div className="h-48 animate-pulse rounded-[28px] bg-surface" />
      </div>
    )
  }
  if (!data.ok || !data.album) {
    return (
      <div className={shell}>
        <h1 className="font-serif text-3xl font-extrabold leading-tight">We couldn&apos;t open this album</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-clay-700">{data.error}</p>
        <a href={`sms:${sitePhone.sms.e164}`} className="mt-7 inline-block rounded-full bg-flame px-6 py-3.5 font-semibold text-cream">
          Text us
        </a>
      </div>
    )
  }

  const { album } = data
  return (
    <div className={shell}>
      <span className="inline-block rounded-full bg-gold-100 px-4 py-1.5 text-xs font-semibold tracking-wide text-gold-800">Party album</span>
      <h1 className="mt-4 font-serif text-4xl font-extrabold leading-[1.08] tracking-tight">{album.title}</h1>
      {album.eventDate ? <p className="mt-2 text-[17px] text-clay-700">{prettyDate(album.eventDate)}</p> : null}

      {album.video ? (
        <section className="mt-7 overflow-hidden rounded-[24px] bg-cocoa">
          <video src={album.video} controls playsInline className="aspect-[9/16] max-h-[70vh] w-full bg-cocoa object-contain" />
          <div className="flex items-center justify-between gap-3 px-5 py-4 text-cream">
            <span className="text-[16px] font-bold">Your party video</span>
            <a href={album.video} download className="rounded-full bg-cream px-4 py-2 text-[14px] font-semibold text-ink">
              Save video
            </a>
          </div>
        </section>
      ) : null}

      {album.open ? (
        <section className="mt-7 rounded-[28px] bg-surface p-5 sm:p-6">
          <p className="text-[17px] leading-relaxed">
            Add the photos and videos you took, so everyone has them in one place. Everyone who adds some gets{" "}
            <strong>${ALBUM_COUPON.amountCents / 100} off their own hibachi party</strong>, and we&apos;ll turn the best clips into a party video.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void onPick(e.target.files)
              e.target.value = ""
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-5 w-full rounded-full bg-flame px-6 py-4 text-[17px] font-semibold text-cream active:bg-flame-600"
          >
            {addedSome ? "Add more photos & videos" : "Add your photos & videos"}
          </button>
          <p className="mt-3 text-[13px] leading-relaxed text-clay-700">
            By adding photos or videos, you agree we may share them on our social media and website.{" "}
            <button type="button" className="font-semibold text-ink underline" onClick={() => setTermsOpen((v) => !v)} aria-expanded={termsOpen}>
              {termsOpen ? "Hide terms" : "Read terms"}
            </button>
          </p>
          {termsOpen ? <AlbumTerms /> : null}

          {active.length > 0 || doneCount > 0 ? (
            <div className="mt-5 flex flex-col gap-2">
              {doneCount > 0 ? (
                <p className="text-[14px] font-semibold text-ink">
                  {doneCount} added{busy ? ` · ${active.filter((u) => u.state !== "failed").length} to go - you can keep browsing` : " - thank you!"}
                </p>
              ) : busy ? (
                <p className="text-[14px] font-semibold text-ink">Uploading - you can keep browsing, just keep this page open</p>
              ) : null}
              {active.slice(0, 6).map((u) => (
                <div key={u.key} className="flex items-center gap-3 text-[13px]">
                  <span className="w-28 shrink-0 truncate text-clay-700">{u.name}</span>
                  {u.state === "failed" ? (
                    <span className="font-semibold text-flame-800">{u.error}</span>
                  ) : (
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-cream">
                      <span className="block h-full rounded-full bg-flame transition-[width]" style={{ width: `${Math.round(u.progress * 100)}%` }} />
                    </span>
                  )}
                </div>
              ))}
              {active.length > 6 ? <p className="text-[13px] text-clay-700">and {active.length - 6} more…</p> : null}
            </div>
          ) : null}
        </section>
      ) : (
        <p className="mt-6 text-[15px] text-clay-700">This album is closed for new photos. Thank you to everyone who added some!</p>
      )}

      {data.claimed ? (
        <CouponCard code={data.claimed.code} expiresAt={data.claimed.expiresAt} />
      ) : addedSome ? (
        <ClaimCard onClaim={async (name, phone, adsOk) => {
          await post({ action: "claim", name, phone, adsOk })
          await load()
        }} />
      ) : null}

      <button
        type="button"
        onClick={() => void shareAlbum()}
        className="mt-5 w-full rounded-full border-2 border-ink/15 bg-surface px-6 py-3.5 text-[16px] font-semibold text-ink"
      >
        Invite friends from the party
      </button>
      {shareNote ? <p className="mt-2 text-center text-[13px] text-clay-700">{shareNote}</p> : null}

      <section className="mt-8">
        <h2 className="text-[15px] font-bold">{items.length === 0 ? "Nothing here yet" : items.length === 1 ? "1 photo or video" : `${items.length} photos & videos`}</h2>
        {items.length === 0 ? (
          <p className="mt-2 text-[15px] text-clay-700">Be the first to add one.</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2">
            {items.map((it) => (
              <Tile key={it.id} item={it} onOpen={() => setViewer(it)} />
            ))}
          </div>
        )}
      </section>

      {viewer ? <Viewer item={viewer} onClose={() => setViewer(null)} onRemove={viewer.mine ? () => void remove(viewer) : undefined} /> : null}
    </div>
  )
}

function Tile({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const src = item.thumb ?? (item.kind === "photo" ? item.url : null)
  return (
    <button type="button" onClick={onOpen} className="relative aspect-square overflow-hidden rounded-xl bg-surface" aria-label={item.kind === "video" ? "Play video" : "Open photo"}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed storage URLs, already sized on the phone
        <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : item.url ? (
        <video src={`${item.url}#t=0.5`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
      ) : null}
      {item.kind === "video" ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cocoa/60">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="#fffaf3" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
      ) : null}
      {item.by ? <span className="absolute bottom-1 left-1 max-w-[90%] truncate rounded-full bg-cocoa/55 px-2 py-0.5 text-[11px] font-semibold text-cream">{item.by}</span> : null}
    </button>
  )
}

function Viewer({ item, onClose, onRemove }: { item: Item; onClose: () => void; onRemove?: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-cocoa/95" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3 text-cream" onClick={(e) => e.stopPropagation()}>
        <span className="text-[14px] font-semibold">{item.by ?? ""}</span>
        <div className="flex items-center gap-2">
          {onRemove ? (
            <button type="button" onClick={onRemove} className="rounded-full px-3 py-2 text-[14px] font-semibold text-cream/80">
              Remove
            </button>
          ) : null}
          {item.url ? (
            <a href={item.url} download className="rounded-full bg-cream px-4 py-2 text-[14px] font-semibold text-ink">
              Save
            </a>
          ) : null}
          <button type="button" onClick={onClose} aria-label="Close" className="ml-1 flex h-10 w-10 items-center justify-center rounded-full text-cream">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-2 pb-4" onClick={(e) => e.stopPropagation()}>
        {item.url ? (
          item.kind === "video" ? (
            <video src={item.url} controls autoPlay playsInline className="max-h-full max-w-full" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- full-size signed storage URL
            <img src={item.url} alt="" className="max-h-full max-w-full object-contain" />
          )
        ) : (
          <p className="text-cream">This one is still processing.</p>
        )}
      </div>
    </div>
  )
}

function ClaimCard({ onClaim }: { onClaim: (name: string, phone: string, adsOk: boolean) => Promise<void> }) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [adsOk, setAdsOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const field = "mt-1.5 w-full rounded-2xl border-2 border-ink/10 bg-cream px-4 py-3 text-[17px] text-ink outline-none focus:border-flame"
  return (
    <section className="mt-5 rounded-[28px] border-2 border-gold-300 bg-gold-100/60 p-5 sm:p-6">
      <h2 className="font-serif text-2xl font-extrabold leading-tight">Your ${ALBUM_COUPON.amountCents / 100} is waiting</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-clay-700">
        Thanks for adding to the album! Leave your name and number and we&apos;ll save ${ALBUM_COUPON.amountCents / 100} off your own hibachi party
        for you. We&apos;ll text you when the party video is ready.
      </p>
      <form
        className="mt-4"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setErr(null)
          try {
            await onClaim(name, phone, adsOk)
          } catch (x) {
            setErr(x instanceof Error ? x.message : "Something went wrong")
          } finally {
            setBusy(false)
          }
        }}
      >
        <label className="block text-[15px] font-semibold">
          Your name
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} maxLength={60} />
        </label>
        <label className="mt-3 block text-[15px] font-semibold">
          Mobile number
          <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" required placeholder="(555) 555-5555" />
        </label>
        <label className="mt-4 flex items-start gap-3 text-[14px] leading-relaxed text-clay-700">
          <input type="checkbox" checked={adsOk} onChange={(e) => setAdsOk(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-flame" />
          <span>It&apos;s also fine to use what I added in Real Hibachi ads. (Optional)</span>
        </label>
        {err ? <p className="mt-3 text-[14px] font-semibold text-flame-800">{err}</p> : null}
        <button type="submit" disabled={busy} className="mt-4 w-full rounded-full bg-ink px-6 py-4 text-[17px] font-semibold text-cream disabled:opacity-60">
          {busy ? "Saving…" : `Save my $${ALBUM_COUPON.amountCents / 100}`}
        </button>
      </form>
    </section>
  )
}

function CouponCard({ code, expiresAt }: { code: string; expiresAt: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <section className="mt-5 rounded-[28px] border-2 border-dashed border-gold-500 bg-gold-100/60 p-5 text-center sm:p-6">
      <p className="text-[14px] font-semibold uppercase tracking-wide text-gold-800">${ALBUM_COUPON.amountCents / 100} off your own party</p>
      <p className="mt-2 font-mono text-3xl font-extrabold tracking-wider">{code}</p>
      <p className="mt-2 text-[14px] leading-relaxed text-clay-700">
        Saved to your number until {until(expiresAt)}. When you&apos;re ready, mention it when you book or text us at {sitePhone.sms.display}.
      </p>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code)
            setCopied(true)
          } catch {}
        }}
        className="mt-4 rounded-full bg-ink px-5 py-2.5 text-[15px] font-semibold text-cream"
      >
        {copied ? "Copied" : "Copy code"}
      </button>
    </section>
  )
}

/** What "Read terms" opens. Bump ALBUM_TERMS_VERSION in lib/party-album.ts when this changes. */
function AlbumTerms() {
  const terms: Array<[string, ReactNode]> = useMemo(
    () => [
      ["Who sees the album", "anyone who has this album link can see and save what's in it."],
      [
        "How we use what you add",
        "by adding photos or videos, you let Real Hibachi use them, including editing them into a party video, on our social media and our website. We use first names only, and never show an address.",
      ],
      ["Ads", "we only use what you added in paid ads if you tick the box for that."],
      ["Kids", "we don't use close-ups of children's faces in ads."],
      ["Only add your own", "please add only photos and videos you took and are happy to share."],
      [
        "Taking something down",
        `you can remove anything you added from this phone right here. For anything else, text us at ${sitePhone.sms.display} and we'll take down a photo or video of you within 48 hours.`,
      ],
      [
        `The $${ALBUM_COUPON.amountCents / 100}`,
        `one per person per party, for people who add at least one photo or video. It's $${ALBUM_COUPON.amountCents / 100} off your own Real Hibachi party within ${ALBUM_COUPON.months} months, one $${ALBUM_COUPON.amountCents / 100} offer per party (it can't be combined with another $${ALBUM_COUPON.amountCents / 100} offer), and it has no cash value.`,
      ],
      ["Texts", "we'll text the number you leave about your coupon and the party video. Reply STOP to opt out."],
    ],
    [],
  )
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-cream p-4 text-[13px] leading-relaxed text-clay-700">
      {terms.map(([t, body]) => (
        <p key={t}>
          <span className="font-semibold text-ink">{t}:</span> {body}
        </p>
      ))}
    </div>
  )
}
