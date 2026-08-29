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
    // The <source> just mounted: fetch and start playback.
    el.load()
    el.play().catch(() => {
      // Autoplay rejection is fine - the user still has controls.
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

  return (
    <video
      ref={ref}
      className={className}
      poster={poster}
      preload="none"
      muted
      loop
      playsInline
      onError={() => {
        if (active) setFailed(true)
      }}
      {...props}
    >
      {active && <source src={src} type="video/mp4" />}
      Your browser does not support the video tag.
    </video>
  )
}
