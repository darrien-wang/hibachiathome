"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { phone as sitePhone } from "@/config/site"
import { Facebook, Heart, ImagePlus, Instagram, Link as LinkIcon, MessageCircle, MessageSquare, MoreHorizontal, Music2, UserPlus } from "lucide-react"
import { albumMediaType, avatarColor, groupAlbumText } from "@/lib/party-album"
import { uploadAlbumFile } from "@/lib/album-upload-client"
import Festive, { seasonOf } from "./Festive"
import { SHARE_PLATFORMS, pickShareMedia, shareFileName, sharePlan, type SharePlatform } from "@/lib/album-share"

// ============================================================
// /album/<token> - the party album guests open from the group chat
// ============================================================
// Owner, 2026-11-23: one job - get people to join in. At first glance it has to
// be the party itself (a title like "Tommy's Party", the date, the photos and
// videos we seeded), so it feels like a keepsake, not a form or a promo. The
// only actions sit in one bar pinned to the bottom (owner, same day):
//   Invite (left)  - sends the invite link; whoever opens it can add too.
//   Upload (middle) - add your own photos and videos.
//   Share (right)  - the look-only link, or the media itself, to Instagram,
//                    TikTok, Facebook, X, WhatsApp, Messages (lib/album-share).
// Someone who opened the look-only link gets the album and Share, nothing else.
// Nothing to fill in, no coupon. What you add shows up the moment you pick it.

type Item = {
  id: string
  source: "guest" | "staff" | "chef"
  kind: "photo" | "video"
  url: string | null
  thumb: string | null
  by: string | null
  name: string | null
  mine: boolean
  createdAt: string
}
type AlbumData = {
  ok: boolean
  error?: string
  role?: "contributor" | "viewer"
  links?: { invite?: string; share: string }
  album?: { title: string; eventDate: string | null; place: string | null; open: boolean; video: string | null }
  items?: Item[]
  people?: number
  me?: { name: string | null } | null
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

/**
 * The party's date as a little tear-off calendar page (owner, 2026-11-23:
 * "the date should feel like a calendar card") - a keepsake, not a form field.
 */
function CalendarCard({ date }: { date: string }) {
  const d = new Date(`${date}T12:00:00Z`)
  const opt = (o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-US", { timeZone: "UTC", ...o })
  return (
    <div
      className="relative w-[84px] shrink-0 -rotate-3 overflow-hidden rounded-2xl bg-surface text-center shadow-[0_6px_18px_rgba(61,42,28,0.18)] ring-1 ring-ink/10"
      aria-label={opt({ weekday: "long", month: "long", day: "numeric", year: "numeric" })}
      role="img"
    >
      <div className="relative bg-flame pb-1 pt-2.5 text-[13px] font-extrabold uppercase tracking-[0.18em] text-cream">
        <span className="absolute left-4 top-1 h-1.5 w-1.5 rounded-full bg-cream/80" />
        <span className="absolute right-4 top-1 h-1.5 w-1.5 rounded-full bg-cream/80" />
        {opt({ month: "short" })}
      </div>
      <div className="font-serif text-[40px] font-extrabold leading-[1.05] text-ink">{opt({ day: "numeric" })}</div>
      <div className="border-t border-dashed border-ink/15 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-clay-700">
        {opt({ weekday: "short" })} · {opt({ year: "numeric" })}
      </div>
    </div>
  )
}

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
  const [sheet, setSheet] = useState<"share" | "invite" | null>(null)
  const [nameSkipped, setNameSkipped] = useState(false)
  const [celebrate, setCelebrate] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const api = `/api/album/${encodeURIComponent(token)}`

  useEffect(() => setDevice(deviceId()), [])
  useEffect(() => {
    if (!note) return
    const t = setTimeout(() => setNote(null), 4500)
    return () => clearTimeout(t)
  }, [note])

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
      let landed = 0
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
            landed++
          } catch (e) {
            patch(b.key, { state: "failed", error: e instanceof Error ? e.message : "Didn't upload" })
          }
        }
      }
      await Promise.all([worker(), worker()])
      // A thank-you burst of confetti once their photos are in.
      if (landed > 0) setCelebrate((n) => n + 1)
      await load()
      // The real tiles are in the grid now; keep only what is still going or failed.
      setPending((list) => list.filter((u) => u.state !== "done"))
    },
    [load, post],
  )

  // Invite = the phone's own share sheet (group chats live there); a computer
  // without one gets the small panel instead.
  const invite = useCallback(async () => {
    const link = data?.links?.invite
    if (!link) return
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text: groupAlbumText(link) })
      } catch {
        /* closed the share sheet */
      }
      return
    }
    setSheet("invite")
  }, [data?.links?.invite])

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
  const canAdd = data.role === "contributor" && album.open

  return (
    <div className={`${shell} ${canAdd ? "pb-48" : "pb-32"} pt-8 sm:pt-12`}>
      <Festive season={seasonOf(album.eventDate)} burst={celebrate} />
      <header>
        <div className="flex items-center gap-4">
          {album.eventDate ? <CalendarCard date={album.eventDate} /> : null}
          <div className="min-w-0">
            {album.place ? <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-clay-700">{album.place}</p> : null}
            <h1 className="mt-1 font-serif text-[38px] font-extrabold leading-[1.02] tracking-tight sm:text-5xl">{album.title}</h1>
          </div>
        </div>
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
          <span className="absolute left-3 top-3">
            <ByPill item={hero} />
          </span>
          {hero.kind === "video" ? (
            <span className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-cocoa/60 px-3 py-1.5 text-[13px] font-semibold text-cream">
              <PlayIcon size={14} /> Video
            </span>
          ) : null}
        </button>
      ) : pending.length === 0 ? (
        <div className="mt-6 flex aspect-[4/5] w-full flex-col items-center justify-center rounded-[24px] bg-surface px-8 text-center">
          <p className="font-serif text-2xl font-extrabold">{canAdd ? "Add the first photo" : "Photos coming soon"}</p>
        </div>
      ) : null}

      {total > 0 ? (
        <p className="mt-5 text-[14px] font-semibold text-ink">
          {`${total} ${total === 1 ? "photo or video" : "photos & videos"}`}
          {people > 1 ? <span className="font-normal text-clay-700"> · from {people} people</span> : null}
        </p>
      ) : null}

      {canAdd && data.me && !data.me.name && !nameSkipped && (items.some((i) => i.mine) || pending.some((u) => u.state === "done")) ? (
        <NamePrompt
          onSave={async (name) => {
            await post({ action: "name", name })
            await load()
          }}
          onSkip={() => setNameSkipped(true)}
        />
      ) : null}

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
                <ByPill item={it} small />
              </button>
            )
          })}
        </div>
      ) : null}


      {/* The action bar (owner, 2026-11-23: "make it warmer"): a floating card,
          not a toolbar - Invite friends on the left, a raised round "Add photos"
          in the middle, "Share my happiness" on the right. */}
      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-[520px]">
          {note ? (
            <p className="mx-auto mb-2 w-fit rounded-full bg-ink/85 px-4 py-1.5 text-center text-[13px] font-semibold text-cream shadow">{note}</p>
          ) : null}
          {canAdd ? (
            <div className="rounded-[28px] bg-surface/95 px-3 pb-2 pt-2.5 shadow-[0_10px_30px_rgba(61,42,28,0.18)] ring-1 ring-ink/5 backdrop-blur">
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
              <div className="grid grid-cols-3 items-end">
                <button type="button" onClick={() => void invite()} className="flex flex-col items-center gap-1 rounded-2xl py-1 active:scale-95">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-100 text-gold-800">
                    <UserPlus size={21} strokeWidth={2.2} aria-hidden="true" />
                  </span>
                  <span className="text-[13px] font-semibold leading-tight text-ink">Invite friends</span>
                </button>
                <button type="button" onClick={() => inputRef.current?.click()} className="flex flex-col items-center gap-1 active:scale-95">
                  <span className="-mt-9 flex h-[68px] w-[68px] items-center justify-center rounded-full bg-gradient-to-br from-[#f5a25d] via-flame to-flame-600 text-cream shadow-[0_8px_20px_rgba(232,114,42,0.45)] ring-4 ring-surface">
                    <ImagePlus size={28} strokeWidth={2.2} aria-hidden="true" />
                  </span>
                  <span className="text-[13px] font-bold leading-tight text-flame-700">{busy ? "Adding…" : "Add photos"}</span>
                </button>
                <button type="button" onClick={() => setSheet("share")} className="flex flex-col items-center gap-1 rounded-2xl py-1 active:scale-95">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fde4ea] text-[#d6336c]">
                    <Heart size={21} strokeWidth={2.2} fill="currentColor" aria-hidden="true" />
                  </span>
                  <span className="text-[13px] font-semibold leading-tight text-ink">Share my happiness</span>
                </button>
              </div>
              <p className="mt-1.5 text-center text-[11px] leading-snug text-clay-700">
                Photos you add may appear on our social & website ·{" "}
                <button type="button" className="font-semibold text-ink underline" onClick={() => setTermsOpen(true)}>
                  Terms
                </button>
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSheet("share")}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-[#f5a25d] via-flame to-flame-600 px-6 py-4 text-[17px] font-bold text-cream shadow-[0_10px_26px_rgba(232,114,42,0.4)] active:scale-[0.98]"
            >
              <Heart size={20} strokeWidth={2.2} fill="currentColor" aria-hidden="true" />
              Share the happiness
            </button>
          )}
        </div>
      </div>

      {sheet === "share" && data.links ? (
        <ShareSheet
          title={album.title}
          shareLink={data.links.share}
          items={items}
          partyVideo={album.video}
          onNote={(t) => setNote(t)}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === "invite" && data.links?.invite ? <InviteSheet link={data.links.invite} onClose={() => setSheet(null)} onNote={(t) => setNote(t)} /> : null}
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

const XGlyph = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <path d="M5 4l14 16M19 4L5 20" />
  </svg>
)

const PLATFORM_LOOK: Record<SharePlatform, { bg: string; icon: React.ReactNode }> = {
  instagram: { bg: "linear-gradient(45deg,#f9ce34,#ee2a7b 55%,#6228d7)", icon: <Instagram size={22} strokeWidth={2.2} /> },
  tiktok: { bg: "#111111", icon: <Music2 size={22} strokeWidth={2.2} /> },
  facebook: { bg: "#1877F2", icon: <Facebook size={22} strokeWidth={2.2} /> },
  x: { bg: "#111111", icon: <XGlyph /> },
  whatsapp: { bg: "#25D366", icon: <MessageCircle size={22} strokeWidth={2.2} /> },
  messages: { bg: "#34C759", icon: <MessageSquare size={22} strokeWidth={2.2} /> },
  copy: { bg: "#3d2a1c", icon: <LinkIcon size={22} strokeWidth={2.2} /> },
  more: { bg: "#7c6a5c", icon: <MoreHorizontal size={22} strokeWidth={2.2} /> },
}

function BottomSheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
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
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-cocoa/40 sm:items-center" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="w-full max-w-[560px] rounded-t-[28px] bg-cream p-6 pb-[max(24px,env(safe-area-inset-bottom))] sm:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-serif text-2xl font-extrabold leading-tight">{title}</h2>
        {children}
      </div>
    </div>
  )
}

/**
 * Share: the look-only link or the media itself, per platform (lib/album-share).
 * Instagram and TikTok need the file handed to the phone's share sheet; fetching
 * a video takes a moment and browsers only allow sharing straight from a tap,
 * so it is two taps: pick the app (we get the file ready), then "Share now".
 */
function ShareSheet({
  title,
  shareLink,
  items,
  partyVideo,
  onNote,
  onClose,
}: {
  title: string
  shareLink: string
  items: Item[]
  partyVideo: string | null
  onNote: (t: string) => void
  onClose: () => void
}) {
  const [prep, setPrep] = useState<null | { platform: SharePlatform; label: string; state: "loading" | "ready" | "failed"; file?: File; caption: string; error?: string }>(null)

  const choose = async (platform: SharePlatform, label: string) => {
    const plan = sharePlan(platform, { title, shareLink })
    if (plan.kind === "open") {
      if (plan.url.startsWith("sms:")) window.location.href = plan.url
      else window.open(plan.url, "_blank", "noopener,noreferrer")
      onClose()
      return
    }
    if (plan.kind === "copy") {
      try {
        await navigator.clipboard.writeText(plan.text)
        onNote("Link copied")
      } catch {
        window.prompt("Copy this link:", plan.text)
      }
      onClose()
      return
    }
    if (plan.kind === "native") {
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ text: plan.text, url: plan.url })
        } catch {
          /* closed */
        }
      } else {
        try {
          await navigator.clipboard.writeText(plan.url)
          onNote("Link copied")
        } catch {}
      }
      onClose()
      return
    }
    // Instagram / TikTok: get the file ready.
    const media = pickShareMedia(items, partyVideo, plan.prefer)
    if (!media) {
      setPrep({ platform, label, state: "failed", caption: plan.caption, error: "There's nothing to post yet - add a photo or video first." })
      return
    }
    setPrep({ platform, label, state: "loading", caption: plan.caption })
    try {
      const res = await fetch(media.url)
      if (!res.ok) throw new Error(String(res.status))
      const blob = await res.blob()
      const type = blob.type || (media.kind === "video" ? "video/mp4" : "image/jpeg")
      const file = new File([blob], shareFileName(title, media.kind, type), { type })
      setPrep({ platform, label, state: "ready", file, caption: plan.caption })
    } catch {
      setPrep({ platform, label, state: "failed", caption: plan.caption, error: "Couldn't get it ready. Please check your connection and try again." })
    }
  }

  const shareNow = async () => {
    if (!prep?.file) return
    // Caption first (no await, so the share below still counts as this tap).
    navigator.clipboard?.writeText(prep.caption).catch(() => {})
    const files = [prep.file]
    if (typeof navigator.canShare === "function" && navigator.canShare({ files })) {
      try {
        await navigator.share({ files })
        onNote(`Caption copied - paste it in ${prep.label}`)
        onClose()
      } catch {
        /* closed the share sheet; stay here so they can try again */
      }
      return
    }
    // A computer: save the file to post from the phone app.
    const url = URL.createObjectURL(prep.file)
    const a = document.createElement("a")
    a.href = url
    a.download = prep.file.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
    onNote(`Saved. Post it from ${prep.label} on your phone - the caption is copied.`)
    onClose()
  }

  if (prep) {
    const look = PLATFORM_LOOK[prep.platform]
    const isVideo = prep.file?.type.startsWith("video/")
    return (
      <BottomSheet title={`Share to ${prep.label}`} onClose={onClose}>
        <div className="mt-5 flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: look.bg }}>
            {look.icon}
          </span>
          <p className="text-[15px] leading-relaxed text-clay-700">
            {prep.state === "loading"
              ? "Getting it ready…"
              : prep.state === "failed"
                ? prep.error
                : `Your ${isVideo ? "video" : "photo"} is ready. We'll copy a caption for you to paste.`}
          </p>
        </div>
        {prep.state === "ready" ? (
          <button type="button" onClick={() => void shareNow()} className="mt-6 w-full rounded-full bg-flame px-6 py-4 text-[17px] font-semibold text-cream">
            Share now
          </button>
        ) : prep.state === "loading" ? (
          <div className="mt-6 h-14 w-full animate-pulse rounded-full bg-surface" />
        ) : null}
        <button type="button" onClick={() => setPrep(null)} className="mt-3 w-full rounded-full px-6 py-3 text-[15px] font-semibold text-clay-700">
          Back
        </button>
      </BottomSheet>
    )
  }

  return (
    <BottomSheet title="Share my happiness" onClose={onClose}>
      <p className="mt-1 text-[15px] text-clay-700">{title}</p>
      <div className="mt-5 grid grid-cols-4 gap-y-4">
        {SHARE_PLATFORMS.map((p) => {
          const look = PLATFORM_LOOK[p.id]
          return (
            <button key={p.id} type="button" onClick={() => void choose(p.id, p.label)} className="flex flex-col items-center gap-1.5">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-white" style={{ background: look.bg }}>
                {look.icon}
              </span>
              <span className="text-[12px] font-semibold text-ink">{p.label}</span>
            </button>
          )
        })}
      </div>
      <p className="mt-5 text-center text-[12px] text-clay-700">People you share with can look and share, not add.</p>
    </BottomSheet>
  )
}

/** Invite on a computer (phones use their own share sheet). */
function InviteSheet({ link, onClose, onNote }: { link: string; onClose: () => void; onNote: (t: string) => void }) {
  const text = groupAlbumText(link)
  return (
    <BottomSheet title="Invite people from the party" onClose={onClose}>
      <p className="mt-2 text-[15px] leading-relaxed text-clay-700">Anyone you send this to can add their photos and videos too.</p>
      <div className="mt-5 grid grid-cols-3 gap-3">
        <a href={`sms:?&body=${encodeURIComponent(text)}`} className="flex flex-col items-center gap-1.5">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-white" style={{ background: PLATFORM_LOOK.messages.bg }}>
            {PLATFORM_LOOK.messages.icon}
          </span>
          <span className="text-[12px] font-semibold">Messages</span>
        </a>
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-1.5">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-white" style={{ background: PLATFORM_LOOK.whatsapp.bg }}>
            {PLATFORM_LOOK.whatsapp.icon}
          </span>
          <span className="text-[12px] font-semibold">WhatsApp</span>
        </a>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text)
              onNote("Invite copied - paste it into your group chat")
            } catch {
              window.prompt("Copy this:", text)
            }
            onClose()
          }}
          className="flex flex-col items-center gap-1.5"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-white" style={{ background: PLATFORM_LOOK.copy.bg }}>
            {PLATFORM_LOOK.copy.icon}
          </span>
          <span className="text-[12px] font-semibold">Copy invite</span>
        </button>
      </div>
    </BottomSheet>
  )
}

/**
 * Who added it, on the tile: our flame for seeds, a coloured initial + first
 * name for guests who left one, "You" on your own (owner, 2026-11-23: a name on
 * each tile makes it feel like everyone's album). Nothing for unnamed guests.
 */
function ByPill({ item, small = false }: { item: Item; small?: boolean }) {
  const seed = item.source !== "guest"
  const label = item.mine ? "You" : item.by
  if (!label) return null
  const initial = (item.mine ? item.name : item.by)?.charAt(0).toUpperCase() ?? ""
  const dot = small ? "h-4 w-4 text-[9px]" : "h-6 w-6 text-[12px]"
  const pos = small ? "absolute bottom-1 left-1 max-w-[92%]" : ""
  return (
    <span className={`${pos} inline-flex items-center gap-1 rounded-full bg-cocoa/60 py-0.5 pl-0.5 pr-2 font-semibold text-cream ${small ? "text-[11px]" : "text-[13px]"}`}>
      {seed ? (
        // eslint-disable-next-line @next/next/no-img-element -- 32px brand mark
        <img src="/images/brand/flame.png" alt="" className={`${dot} rounded-full bg-cream object-contain p-0.5`} />
      ) : initial ? (
        <span className={`${dot} flex shrink-0 items-center justify-center rounded-full font-bold text-white`} style={{ background: avatarColor(item.name ?? item.by ?? "") }}>
          {initial}
        </span>
      ) : null}
      <span className="truncate">{label}</span>
    </span>
  )
}

/** Shown once after your first upload: optional, no phone, no account. */
function NamePrompt({ onSave, onSkip }: { onSave: (name: string) => Promise<void>; onSkip: () => void }) {
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  return (
    <form
      className="mt-4 flex flex-col gap-2 rounded-2xl bg-surface p-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setErr(null)
        try {
          await onSave(name)
        } catch (x) {
          setErr(x instanceof Error ? x.message : "Couldn't save")
        } finally {
          setBusy(false)
        }
      }}
    >
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your first name"
          autoComplete="given-name"
          maxLength={20}
          className="min-w-0 flex-1 rounded-xl border-2 border-ink/10 bg-cream px-3 py-2.5 text-[16px] outline-none focus:border-flame"
        />
        <button type="submit" disabled={busy || !name.trim()} className="rounded-xl bg-ink px-4 text-[15px] font-semibold text-cream disabled:opacity-50">
          {busy ? "…" : "Save"}
        </button>
        <button type="button" onClick={onSkip} className="px-2 text-[14px] font-semibold text-clay-700">
          Skip
        </button>
      </div>
      {err ? <p className="text-[13px] font-semibold text-flame-800">{err}</p> : null}
    </form>
  )
}
