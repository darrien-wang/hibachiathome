"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { phone as sitePhone } from "@/config/site"
import { albumMediaType, groupAlbumText } from "@/lib/party-album"
import { uploadAlbumFile } from "@/lib/album-upload-client"

// ============================================================
// /album/<token> - the party album guests open from the group chat
// ============================================================
// Owner, 2026-11-23: one job - get people to join in. At first glance it has to
// be the party itself (a title like "Tommy's Party", the date, the photos and
// videos we seeded), so it feels like a keepsake, not a form or a promo. The
// only action is "Add your photos & videos", pinned to the bottom; nothing to
// fill in, no coupon. What you add shows up in the grid the moment you pick it.

type Item = {
  id: string
  source: "guest" | "staff" | "chef"
  kind: "photo" | "video"
  url: string | null
  thumb: string | null
  by: string | null
  mine: boolean
  createdAt: string
}
type AlbumData = {
  ok: boolean
  error?: string
  album?: { title: string; eventDate: string | null; place: string | null; open: boolean; video: string | null }
  items?: Item[]
  people?: number
}
type Pending = { key: string; preview: string | null; progress: number; state: "waiting" | "uploading" | "done" | "failed"; error?: string }

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
  d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric" }) : ""

const PlayIcon = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="#fffaf3" aria-hidden="true">
    <path d="M8 5v14l11-7z" />
  </svg>
)

export default function AlbumClient({ token }: { token: string }) {
  const [device, setDevice] = useState<string | null>(null)
  const [data, setData] = useState<AlbumData | null>(null)
  const [pending, setPending] = useState<Pending[]>([])
  const [termsOpen, setTermsOpen] = useState(false)
  const [viewer, setViewer] = useState<number | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const api = `/api/album/${encodeURIComponent(token)}`

  useEffect(() => setDevice(deviceId()), [])

  const load = useCallback(async () => {
    if (!device) return
    try {
      const res = await fetch(`${api}?device=${device}`, { cache: "no-store" })
      setData((await res.json()) as AlbumData)
    } catch {
      setData((d) => d ?? { ok: false, error: "We couldn't open it. Please check your connection and try again." })
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

  const patch = (key: string, p: Partial<Pending>) => setPending((list) => list.map((u) => (u.key === key ? { ...u, ...p } : u)))

  const onPick = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      const batch = Array.from(files).map((file, i) => ({ file, type: albumMediaType(file.type, file.name), key: `${Date.now()}-${i}-${file.name}` }))
      setPending((list) => [
        ...batch.map((b) => ({
          key: b.key,
          preview: null,
          progress: 0,
          state: b.type ? ("waiting" as const) : ("failed" as const),
          error: b.type ? undefined : "Not a photo or video",
        })),
        ...list,
      ])
      // Two at a time: quick on Wi-Fi, doesn't choke a phone on LTE.
      const queue = batch.filter((b) => b.type)
      let next = 0
      const worker = async () => {
        while (next < queue.length) {
          const b = queue[next++]
          patch(b.key, { state: "uploading", progress: 0.01 })
          try {
            await uploadAlbumFile(b.file, b.type as string, {
              slot: (a) => post({ action: "slot", ...a }) as never,
              done: (a) => post({ action: "done", ...a }),
              onPreview: (url) => patch(b.key, { preview: url }),
              onProgress: (p) => patch(b.key, { progress: p }),
            })
            patch(b.key, { state: "done", progress: 1 })
          } catch (e) {
            patch(b.key, { state: "failed", error: e instanceof Error ? e.message : "Didn't upload" })
          }
        }
      }
      await Promise.all([worker(), worker()])
      await load()
      // The real tiles are in the grid now; keep only what is still going or failed.
      setPending((list) => list.filter((u) => u.state !== "done"))
    },
    [load, post],
  )

  const invite = useCallback(async () => {
    const text = groupAlbumText(window.location.href.split("?")[0])
    try {
      if (navigator.share) {
        await navigator.share({ text })
        return
      }
      await navigator.clipboard.writeText(text)
      setNote("Link copied - paste it into your group chat.")
    } catch {
      /* closed the share sheet */
    }
  }, [])

  const remove = useCallback(
    async (item: Item) => {
      if (!window.confirm("Take this one out of the album?")) return
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

  const shell = "mx-auto w-full max-w-[640px] px-4 sm:px-5"

  if (!data) {
    return (
      <div className={`${shell} pt-10`}>
        <div className="h-5 w-48 animate-pulse rounded bg-surface" />
        <div className="mt-4 h-12 w-64 animate-pulse rounded bg-surface" />
        <div className="mt-6 aspect-[4/5] w-full animate-pulse rounded-[24px] bg-surface" />
      </div>
    )
  }
  if (!data.ok || !data.album) {
    return (
      <div className={`${shell} pb-16 pt-16`}>
        <h1 className="font-serif text-3xl font-extrabold leading-tight">We couldn&apos;t open this</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-clay-700">{data.error}</p>
        <a href={`sms:${sitePhone.sms.e164}`} className="mt-7 inline-block rounded-full bg-flame px-6 py-3.5 font-semibold text-cream">
          Text us
        </a>
      </div>
    )
  }

  const { album } = data
  const items = data.items ?? []
  const hero = album.video ? null : (items[0] ?? null)
  const grid = album.video ? items : items.slice(1)
  const busy = pending.some((u) => u.state === "waiting" || u.state === "uploading")
  const total = items.length
  const people = data.people ?? 0
  const dateLine = [prettyDate(album.eventDate), album.place].filter(Boolean).join(" · ")

  return (
    <div className={`${shell} ${album.open ? "pb-44" : "pb-16"} pt-8 sm:pt-12`}>
      <header>
        {dateLine ? <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-clay-700">{dateLine}</p> : null}
        <h1 className="mt-2 font-serif text-[42px] font-extrabold leading-[1.02] tracking-tight sm:text-5xl">{album.title}</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-clay-700">Every photo and video from the night, all in one place.</p>
      </header>

      {album.video ? (
        <section className="mt-6 overflow-hidden rounded-[24px] bg-cocoa">
          <video src={album.video} controls playsInline className="aspect-[9/16] max-h-[78vh] w-full bg-cocoa object-contain" />
        </section>
      ) : hero ? (
        <button type="button" onClick={() => setViewer(0)} className="relative mt-6 block w-full overflow-hidden rounded-[24px] bg-surface" aria-label="Open">
          {hero.kind === "video" && hero.url ? (
            <video src={hero.url} poster={hero.thumb ?? undefined} autoPlay muted loop playsInline preload="metadata" className="aspect-[4/5] w-full object-cover" />
          ) : hero.url || hero.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
            <img src={hero.url ?? hero.thumb ?? ""} alt="" className="aspect-[4/5] w-full object-cover" />
          ) : null}
          {hero.kind === "video" ? (
            <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-cocoa/60 px-3 py-1.5 text-[13px] font-semibold text-cream">
              <PlayIcon size={14} /> Video
            </span>
          ) : null}
        </button>
      ) : pending.length === 0 ? (
        <div className="mt-6 flex aspect-[4/5] w-full flex-col items-center justify-center rounded-[24px] bg-surface px-8 text-center">
          <p className="font-serif text-2xl font-extrabold">The first photo starts the album</p>
          <p className="mt-2 text-[15px] text-clay-700">Add one from the night and everyone at the party will see it here.</p>
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-[14px] font-semibold text-ink">
          {total === 0 ? "" : `${total} ${total === 1 ? "photo or video" : "photos & videos"}`}
          {people > 1 ? <span className="font-normal text-clay-700"> · from {people} people</span> : null}
        </p>
        <button type="button" onClick={() => void invite()} className="shrink-0 text-[14px] font-semibold text-flame-700 underline-offset-4 hover:underline">
          Invite others
        </button>
      </div>
      {note ? <p className="mt-1 text-right text-[13px] text-clay-700">{note}</p> : null}

      {pending.length > 0 || grid.length > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2">
          {pending.map((u) => (
            <div key={u.key} className="relative aspect-square overflow-hidden rounded-xl bg-surface">
              {u.preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- local preview of the file being added
                <img src={u.preview} alt="" className={`h-full w-full object-cover ${u.state === "done" ? "" : "opacity-70"}`} />
              ) : null}
              {u.state === "failed" ? (
                <span className="absolute inset-0 flex items-center justify-center bg-cocoa/60 p-2 text-center text-[11px] font-semibold text-cream">{u.error}</span>
              ) : u.state !== "done" ? (
                <span className="absolute inset-x-2 bottom-2 h-1.5 overflow-hidden rounded-full bg-cream/70">
                  <span className="block h-full rounded-full bg-flame transition-[width]" style={{ width: `${Math.round(Math.max(0.04, u.progress) * 100)}%` }} />
                </span>
              ) : null}
            </div>
          ))}
          {grid.map((it) => {
            const src = it.thumb ?? (it.kind === "photo" ? it.url : null)
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => setViewer(items.indexOf(it))}
                className="relative aspect-square overflow-hidden rounded-xl bg-surface"
                aria-label={it.kind === "video" ? "Play video" : "Open photo"}
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed storage URL, sized on the phone
                  <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : it.url ? (
                  <video src={`${it.url}#t=0.5`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                ) : null}
                {it.kind === "video" ? (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cocoa/55">
                      <PlayIcon />
                    </span>
                  </span>
                ) : null}
                {it.mine ? <span className="absolute bottom-1 left-1 rounded-full bg-cocoa/55 px-2 py-0.5 text-[11px] font-semibold text-cream">You</span> : null}
              </button>
            )
          })}
        </div>
      ) : null}

      <p className="mt-10 text-center text-[13px] text-clay-700">Cooked with love by Real Hibachi</p>

      {album.open ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-cream/95 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto w-full max-w-[640px] px-4 sm:px-5">
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
              className="flex w-full items-center justify-center gap-2 rounded-full bg-flame px-6 py-4 text-[17px] font-semibold text-cream active:bg-flame-600"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {busy ? "Adding… pick more anytime" : "Add your photos & videos"}
            </button>
            <p className="mt-2 text-center text-[12px] leading-snug text-clay-700">
              By adding, you agree we may share them on our social media and website.{" "}
              <button type="button" className="font-semibold text-ink underline" onClick={() => setTermsOpen(true)}>
                Terms
              </button>
            </p>
          </div>
        </div>
      ) : null}

      {termsOpen ? <TermsSheet onClose={() => setTermsOpen(false)} /> : null}
      {viewer !== null && items[viewer] ? (
        <Viewer items={items} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} onRemove={(it) => void remove(it)} />
      ) : null}
    </div>
  )
}

function Viewer({
  items,
  index,
  onIndex,
  onClose,
  onRemove,
}: {
  items: Item[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
  onRemove: (it: Item) => void
}) {
  const item = items[index]
  const touchX = useRef<number | null>(null)
  const go = useCallback((d: number) => onIndex((index + d + items.length) % items.length), [index, items.length, onIndex])
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowRight") go(1)
      if (e.key === "ArrowLeft") go(-1)
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
  }, [go, onClose])
  const arrow = "absolute top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full text-cream/80 sm:flex"
  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-cocoa/95"
      role="dialog"
      aria-modal="true"
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null
      }}
      onTouchEnd={(e) => {
        const start = touchX.current
        const end = e.changedTouches[0]?.clientX
        touchX.current = null
        if (start == null || end == null || items.length < 2) return
        if (end - start > 50) go(-1)
        else if (start - end > 50) go(1)
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 text-cream">
        <span className="text-[14px] font-semibold tabular-nums text-cream/80">
          {index + 1} / {items.length}
        </span>
        <div className="flex items-center gap-2">
          {item.mine ? (
            <button type="button" onClick={() => onRemove(item)} className="rounded-full px-3 py-2 text-[14px] font-semibold text-cream/80">
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
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-6" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} className="flex max-h-full max-w-full items-center justify-center">
          {item.url ? (
            item.kind === "video" ? (
              <video key={item.id} src={item.url} controls autoPlay playsInline className="max-h-[80vh] max-w-full" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- full-size signed storage URL
              <img key={item.id} src={item.url} alt="" className="max-h-[80vh] max-w-full object-contain" />
            )
          ) : (
            <p className="text-cream">Still processing - try again in a minute.</p>
          )}
        </div>
        {items.length > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous"
              onClick={(e) => {
                e.stopPropagation()
                go(-1)
              }}
              className={`${arrow} left-1`}
            >
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={(e) => {
                e.stopPropagation()
                go(1)
              }}
              className={`${arrow} right-1`}
            >
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}

/** "Terms" opens this. Bump ALBUM_TERMS_VERSION in lib/party-album.ts when it changes. */
function TermsSheet({ onClose }: { onClose: () => void }) {
  const terms: Array<[string, string]> = [
    ["Who sees it", "anyone with this link can see and save what's here."],
    [
      "How we use what you add",
      "by adding photos or videos, you let Real Hibachi use them, including in a party video, on our social media and our website. We use first names only and never show an address.",
    ],
    ["Ads", "we don't use what you add in paid ads without asking you first."],
    ["Kids", "we don't use close-ups of children's faces in ads."],
    ["Only add your own", "please add only photos and videos you took and are happy to share."],
    [
      "Taking something down",
      `you can remove anything you added from this phone right here. For anything else, text us at ${sitePhone.sms.display} and we'll take down a photo or video of you within 48 hours.`,
    ],
  ]
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-cocoa/40 sm:items-center" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-[560px] overflow-y-auto rounded-t-[28px] bg-cream p-6 sm:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-serif text-2xl font-extrabold">Album terms</h2>
        <div className="mt-4 flex flex-col gap-3 text-[14px] leading-relaxed text-clay-700">
          {terms.map(([t, body]) => (
            <p key={t}>
              <span className="font-semibold text-ink">{t}:</span> {body}
            </p>
          ))}
        </div>
        <button type="button" onClick={onClose} className="mt-6 w-full rounded-full bg-ink px-6 py-3.5 text-[16px] font-semibold text-cream">
          Got it
        </button>
      </div>
    </div>
  )
}
