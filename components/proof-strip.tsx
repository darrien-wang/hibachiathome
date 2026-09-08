"use client"

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react"
import LazyVideo from "@/components/lazy-video"
import type { ProofMedia } from "@/config/proof-media"

// The "real parties" strip used on the homepage, /quote and the ad landing
// pages. Swipe on phones; on desktop it also drags with the mouse, scrolls
// with the arrow buttons, and every clip is tap-to-play / tap-to-pause with a
// badge that shows which. (2026-09-08: the owner reported the strip "stuck"
// on desktop — a hidden-scrollbar overflow row has no mouse affordance.)

function Cell({ item, size }: { item: ProofMedia; size: "sm" | "md" }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const video = ref.current?.querySelector("video")
    if (!video) return
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    video.addEventListener("play", onPlay)
    video.addEventListener("pause", onPause)
    return () => {
      video.removeEventListener("play", onPlay)
      video.removeEventListener("pause", onPause)
    }
  }, [])

  const box = size === "sm" ? "h-[130px] w-[180px] lg:h-48 lg:w-72" : "h-44 w-64 lg:h-56 lg:w-[22rem]"

  return (
    <div ref={ref} className={`relative shrink-0 snap-start overflow-hidden rounded-2xl bg-cocoa/10 ${box}`}>
      {item.type === "video" ? (
        <>
          <LazyVideo className="absolute inset-0 h-full w-full cursor-pointer object-cover" poster={item.poster} src={item.src} />
          <button
            type="button"
            aria-label={playing ? "Pause clip" : "Play clip"}
            onClick={() => {
              const video = ref.current?.querySelector("video")
              if (!video) return
              if (video.paused) void video.play().catch(() => undefined)
              else video.pause()
            }}
            className={`absolute bottom-2 left-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white transition ${
              playing ? "opacity-60 hover:opacity-100" : ""
            }`}
          >
            {playing ? <Pause className="h-3.5 w-3.5 fill-white" aria-hidden="true" /> : <Play className="h-3.5 w-3.5 fill-white" aria-hidden="true" />}
          </button>
        </>
      ) : (
        <Image src={item.src} alt={item.alt} fill sizes="(max-width: 1024px) 180px, 352px" className="object-cover" draggable={false} />
      )}
    </div>
  )
}

export default function ProofStrip({
  media,
  size = "sm",
  className,
  bleed = true,
}: {
  media: ProofMedia[]
  size?: "sm" | "md"
  className?: string
  /** Extend to the screen edges on phones (parent has px-5). */
  bleed?: boolean
}) {
  const scroller = useRef<HTMLDivElement | null>(null)
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(true)

  const update = () => {
    const el = scroller.current
    if (!el) return
    setCanPrev(el.scrollLeft > 8)
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 8)
  }
  useEffect(() => {
    update()
    const el = scroller.current
    if (!el) return
    el.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    return () => {
      el.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [])

  const page = (dir: 1 | -1) => {
    const el = scroller.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.8), behavior: "smooth" })
  }

  // Mouse drag-to-scroll (touch already scrolls natively).
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || !scroller.current) return
    drag.current = { x: e.clientX, left: scroller.current.scrollLeft, moved: false }
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || !scroller.current) return
    const dx = e.clientX - drag.current.x
    if (Math.abs(dx) > 4) drag.current.moved = true
    scroller.current.scrollLeft = drag.current.left - dx
  }
  const onPointerUp = () => {
    drag.current = null
  }
  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    // A drag should not count as a tap on the clip underneath.
    if (drag.current?.moved) e.stopPropagation()
  }

  return (
    <div className={`relative ${className ?? ""}`}>
      <div
        ref={scroller}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClickCapture={onClickCapture}
        className={`flex snap-x gap-2 overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] lg:cursor-grab lg:gap-3 lg:active:cursor-grabbing [&::-webkit-scrollbar]:hidden ${
          bleed ? "-mx-5 px-5 lg:mx-0 lg:px-0" : ""
        }`}
        aria-label="Photos and clips from real Real Hibachi parties"
      >
        {media.map((item) => (
          <Cell key={item.src} item={item} size={size} />
        ))}
      </div>
      <button
        type="button"
        aria-label="Previous"
        onClick={() => page(-1)}
        disabled={!canPrev}
        className="absolute left-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-ink/10 bg-white/95 text-ink shadow-organic-lg transition disabled:opacity-0 lg:inline-flex"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Next"
        onClick={() => page(1)}
        disabled={!canNext}
        className="absolute right-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-ink/10 bg-white/95 text-ink shadow-organic-lg transition disabled:opacity-0 lg:inline-flex"
      >
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  )
}
