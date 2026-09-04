"use client"

import { useEffect, useRef, useState } from "react"

// Bandwidth-friendly video: nothing downloads until the element nears the
// viewport (then it loads and autoplays muted), and playback pauses again
// when scrolled away so multiple sections never compete for a slow
// connection. Pair with a poster taken from the video's own first frame so
// the poster-to-video handoff is invisible.
export default function LazyVideo({
  src,
  poster,
  className,
  ...props
}: {
  src: string
  poster?: string
  className?: string
  [key: string]: unknown
}) {
  const ref = useRef<HTMLVideoElement | null>(null)
  const [active, setActive] = useState(false)
  const [failed, setFailed] = useState(false)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(true)
          } else {
            ref.current?.pause()
          }
        }
      },
      { rootMargin: "300px 0px" }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el || !active) return
    // The src just landed on the element: fetch and start playback.
    el.load()
    el.play().catch(() => {
      // iOS Low Power Mode and data-saver settings reject muted autoplay;
      // without controls the poster becomes a dead tap target, so surface
      // the native play button.
      setBlocked(true)
    })
  }, [active])

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className ?? ""}`}>
        <button
          onClick={() => {
            setFailed(false)
            setActive(true)
          }}
          className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 transition-colors"
        >
          Reload video
        </button>
      </div>
    )
  }

  // The video URL is an attribute, never a <source> child. As a child it had
  // to be inserted before the fallback text node the first time a card drifted
  // into view - and browser translation (Chrome/Safari auto-translate, which
  // fires on its own for Spanish- and Chinese-preferring visitors) re-parents
  // every text node into a <font> wrapper first. React's insertBefore then
  // threw NotFoundError and took the whole page down with "Application error:
  // a client-side exception has occurred" - the quote page died this way for
  // translated ad traffic. A childless <video> has nothing to translate and
  // nothing to insert before.
  return (
    <video
      ref={ref}
      src={active ? src : undefined}
      className={className}
      poster={poster}
      preload="none"
      muted
      loop
      playsInline
      controls={blocked}
      onPlay={() => setBlocked(false)}
      onClick={() => {
        const el = ref.current
        // With native controls visible, taps belong to the control UI.
        if (!el || el.controls) return
        if (el.paused) {
          el.play().catch(() => setBlocked(true))
        } else {
          el.pause()
        }
      }}
      onError={() => {
        if (active) setFailed(true)
      }}
      {...props}
    />
  )
}
