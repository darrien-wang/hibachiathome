"use client"

import { useEffect, useMemo, useState } from "react"

// ============================================================
// Festive layer for the party album (owner, 2026-11-23)
// ============================================================
// "Make it warm: streamers, confetti, snow for the season, so people feel the
// party the moment they open it." Pure CSS animation, no library:
//   - on open: a short burst of confetti + streamers (~4 s);
//   - then a light, slow seasonal fall for the party's month - snow (Dec-Feb),
//     petals (Mar-May), confetti (Jun-Aug), leaves (Sep-Nov);
//   - `burst` changes -> another burst (we fire one when an upload lands, as a
//     thank-you).
// pointer-events: none, so it never blocks a tap; nothing at all for people who
// ask their phone for reduced motion.

export type Season = "winter" | "spring" | "summer" | "fall"

export function seasonOf(date: string | null): Season {
  const m = date ? Number(date.slice(5, 7)) : new Date().getMonth() + 1
  if (m === 12 || m <= 2) return "winter"
  if (m <= 5) return "spring"
  if (m <= 8) return "summer"
  return "fall"
}

const PARTY = ["#e8722a", "#c9962e", "#ee2a7b", "#1d9bf0", "#25b866", "#7c3aed", "#f9ce34"]
const LEAVES = ["#c2410c", "#d97706", "#b45309", "#a16207", "#9f1239"]
const PETALS = ["#f9a8d4", "#fbcfe8", "#f472b6", "#fecdd3"]

type Bit = { id: string; left: number; delay: number; dur: number; size: number; color: string; kind: string; drift: number; spin: number }

const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]

function burstBits(tag: string): Bit[] {
  return Array.from({ length: 70 }, (_, i) => {
    const streamer = i % 5 === 0
    return {
      id: `${tag}-${i}`,
      left: rnd(0, 100),
      delay: rnd(0, 0.9),
      dur: rnd(2.6, 4.2),
      size: streamer ? rnd(26, 40) : rnd(7, 11),
      color: pick(PARTY),
      kind: streamer ? "streamer" : "confetti",
      drift: rnd(-60, 60),
      spin: rnd(360, 1080) * (Math.random() < 0.5 ? -1 : 1),
    }
  })
}

function ambientBits(season: Season): Bit[] {
  const n = season === "winter" ? 34 : 22
  return Array.from({ length: n }, (_, i) => ({
    id: `a-${i}`,
    left: rnd(0, 100),
    delay: rnd(-14, 0), // already mid-fall on first paint
    dur: season === "winter" ? rnd(9, 16) : rnd(10, 18),
    size: season === "winter" ? rnd(5, 10) : season === "summer" ? rnd(7, 10) : rnd(12, 18),
    color: season === "fall" ? pick(LEAVES) : season === "spring" ? pick(PETALS) : season === "summer" ? pick(PARTY) : "#ffffff",
    kind: season === "winter" ? "snow" : season === "spring" ? "petal" : season === "fall" ? "leaf" : "confetti",
    drift: rnd(-50, 50),
    spin: rnd(180, 540) * (Math.random() < 0.5 ? -1 : 1),
  }))
}

function shape(b: Bit): React.CSSProperties {
  switch (b.kind) {
    case "streamer":
      return { width: 5, height: b.size, borderRadius: 4, background: b.color }
    case "snow":
      return {
        width: b.size,
        height: b.size,
        borderRadius: "50%",
        background: "radial-gradient(circle, #fff 55%, rgba(255,255,255,.6))",
        boxShadow: "0 0 4px rgba(90,120,160,.45)",
      }
    case "petal":
      return { width: b.size, height: b.size * 0.7, borderRadius: "100% 0 100% 0", background: b.color, opacity: 0.9 }
    case "leaf":
      return { width: b.size, height: b.size * 0.65, borderRadius: "0 100% 0 100%", background: b.color, opacity: 0.85 }
    default:
      return { width: b.size, height: b.size * 1.5, borderRadius: 2, background: b.color }
  }
}

export default function Festive({ season, burst }: { season: Season; burst: number }) {
  const [reduced, setReduced] = useState(true)
  const [bursts, setBursts] = useState<Array<{ key: number; bits: Bit[] }>>([])
  const [ambient, setAmbient] = useState<Bit[]>([])

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(mq.matches)
    setAmbient(ambientBits(season))
  }, [season])

  useEffect(() => {
    if (reduced) return
    const key = Date.now() + burst
    setBursts((list) => [...list, { key, bits: burstBits(String(key)) }])
    const t = setTimeout(() => setBursts((list) => list.filter((b) => b.key !== key)), 5600)
    return () => clearTimeout(t)
  }, [burst, reduced])

  const css = useMemo(
    () => `
@keyframes rh-fall { from { transform: translate3d(0,-12vh,0) rotate(0deg); } to { transform: translate3d(var(--drift),112vh,0) rotate(var(--spin)); } }
@keyframes rh-flutter { 0%,100% { transform: rotateY(0deg) rotateX(0deg); } 50% { transform: rotateY(180deg) rotateX(35deg); } }
@keyframes rh-sway { 0%,100% { margin-left: 0; } 50% { margin-left: 18px; } }
`,
    [],
  )

  if (reduced) return null
  const render = (b: Bit, burstOne: boolean) => (
    <span
      key={b.id}
      className="absolute top-0 block"
      style={
        {
          left: `${b.left}%`,
          "--drift": `${b.drift}px`,
          "--spin": `${b.spin}deg`,
          animation: `rh-fall ${b.dur}s ${burstOne ? "cubic-bezier(.25,.6,.5,1)" : "linear"} ${b.delay}s ${burstOne ? "1 both" : "infinite"}`,
        } as React.CSSProperties
      }
    >
      <span
        className="block"
        style={{
          ...shape(b),
          animation: b.kind === "snow" ? `rh-sway ${rnd(3, 5).toFixed(1)}s ease-in-out infinite` : `rh-flutter ${rnd(0.8, 1.6).toFixed(2)}s ease-in-out infinite`,
        }}
      />
    </span>
  )
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      <style>{css}</style>
      {ambient.map((b) => render(b, false))}
      {bursts.flatMap((g) => g.bits.map((b) => render(b, true)))}
    </div>
  )
}
