"use client"

import { useMemo } from "react"

// 一张拿 OpenStreetMap 瓦片拼出来的地图：图钉 + 连线。没装地图库，也不用 key。
// 日历上「N 场」的弹窗和分享出去的排班页（/tools/schedule）共用（2026-09-29 抽出来）。
//
// 颜色用的是 .wb 作用域里的 CSS 变量，放在工作台样式下面才对。

export type MapPin = { id: string; lat: number; lng: number; label: string; title?: string; active?: boolean; muted?: boolean }
export type MapLine = { fromId: string; toId: string; text?: string; dashed?: boolean }

const TILE = 256
const MAX_Z = 17

// Web Mercator：经纬度 → 瓦片坐标（z 级下的小数瓦片号）
const xOf = (lng: number, z: number) => ((lng + 180) / 360) * 2 ** z
const yOf = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z
}

export function TileMap({
  pins,
  home,
  lines = [],
  onPick,
  width = 640,
  height = 420,
}: {
  pins: MapPin[]
  home?: { lat: number; lng: number; label: string } | null
  lines?: MapLine[]
  onPick?: (id: string) => void
  width?: number
  height?: number
}) {
  // 选一个刚好装下全部点的缩放级别，而不是写死一个——同城五场和跨县五场
  // 差着几个数量级，写死不是太挤就是太空。
  const view = useMemo(() => {
    const pts = [...pins, ...(home ? [home] : [])]
    if (pts.length === 0) return null
    const pad = 56
    const lats = pts.map((p) => p.lat)
    const lngs = pts.map((p) => p.lng)
    let z = MAX_Z
    for (; z > 3; z--) {
      const xs = lngs.map((v) => xOf(v, z) * TILE)
      const ys = lats.map((v) => yOf(v, z) * TILE)
      if (Math.max(...xs) - Math.min(...xs) <= width - pad * 2 && Math.max(...ys) - Math.min(...ys) <= height - pad * 2) break
    }
    const cx = (xOf(Math.min(...lngs), z) + xOf(Math.max(...lngs), z)) / 2
    const cy = (yOf(Math.min(...lats), z) + yOf(Math.max(...lats), z)) / 2
    const originX = cx * TILE - width / 2
    const originY = cy * TILE - height / 2
    const at = (lat: number, lng: number) => ({ x: xOf(lng, z) * TILE - originX, y: yOf(lat, z) * TILE - originY })
    const tiles: Array<{ x: number; y: number; left: number; top: number }> = []
    const x0 = Math.floor(originX / TILE)
    const y0 = Math.floor(originY / TILE)
    for (let tx = x0; tx * TILE < originX + width; tx++) {
      for (let ty = y0; ty * TILE < originY + height; ty++) {
        if (ty < 0 || ty >= 2 ** z) continue
        tiles.push({ x: ((tx % 2 ** z) + 2 ** z) % 2 ** z, y: ty, left: tx * TILE - originX, top: ty * TILE - originY })
      }
    }
    return { z, at, tiles }
  }, [pins, home, width, height])

  // 挨得太近的图钉（隔壁城市、同一个小区）在屏幕上摊开一圈，不然后画的那颗把前一颗整个盖住、点不到。
  // 只挪画的位置，连线跟着挪；真实坐标不变。
  const spot = useMemo(() => {
    const out = new Map<string, { x: number; y: number }>()
    if (!view) return out
    const groups: Array<Array<{ id: string; x: number; y: number }>> = []
    for (const p of pins) {
      const at = { id: p.id, ...view.at(p.lat, p.lng) }
      const g = groups.find((g) => g.some((q) => Math.hypot(q.x - at.x, q.y - at.y) < 28))
      if (g) g.push(at)
      else groups.push([at])
    }
    for (const g of groups) {
      if (g.length === 1) {
        out.set(g[0].id, { x: g[0].x, y: g[0].y })
        continue
      }
      const cx = g.reduce((s, p) => s + p.x, 0) / g.length
      const cy = g.reduce((s, p) => s + p.y, 0) / g.length
      const r = 16 + 4 * (g.length - 2)
      g.forEach((p, i) => {
        const a = (2 * Math.PI * i) / g.length - Math.PI / 2
        out.set(p.id, { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
      })
    }
    return out
  }, [view, pins])

  if (!view) return null
  const byId = new Map(pins.map((p) => [p.id, p]))
  const pos = (p: MapPin) => spot.get(p.id) ?? view.at(p.lat, p.lng)

  return (
    <div style={{ position: "relative", width, height, maxWidth: "100%", overflow: "hidden", border: "2px solid var(--color-text)", background: "#e8e4df" }}>
      {view.tiles.map((t) => (
        <img
          key={`${t.x}-${t.y}`}
          src={`https://tile.openstreetmap.org/${view.z}/${t.x}/${t.y}.png`}
          alt=""
          width={TILE}
          height={TILE}
          style={{ position: "absolute", left: t.left, top: t.top, filter: "grayscale(1) contrast(0.92) brightness(1.06)" }}
        />
      ))}

      <svg width={width} height={height} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {lines.map((l) => {
          const a = byId.get(l.fromId)
          const b = byId.get(l.toId)
          if (!a || !b) return null
          const p = pos(a)
          const q = pos(b)
          return (
            <g key={`${l.fromId}-${l.toId}`}>
              <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="var(--color-accent)" strokeWidth={3.5} strokeDasharray={l.dashed ? "7 5" : undefined} />
              {l.text ? (
                <text x={(p.x + q.x) / 2} y={(p.y + q.y) / 2 - 7} textAnchor="middle" fontSize={12} fontWeight={800} fill="var(--color-text)" stroke="#fff" strokeWidth={3} paintOrder="stroke">
                  {l.text}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>

      {home ? (
        <div
          title={home.label}
          style={{ position: "absolute", left: view.at(home.lat, home.lng).x - 7, top: view.at(home.lat, home.lng).y - 7, width: 14, height: 14, borderRadius: "50%", background: "#fff", border: "3px solid var(--color-text)" }}
        />
      ) : null}

      {pins.map((s) => {
        const p = pos(s)
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick?.(s.id)}
            title={s.title ?? s.label}
            style={{
              position: "absolute",
              left: p.x - 15,
              top: p.y - 15,
              width: 30,
              height: 30,
              borderRadius: "50%",
              border: `3px solid ${s.active ? "var(--color-text)" : "#fff"}`,
              background: s.muted ? "var(--color-neutral-500)" : "var(--color-accent)",
              color: "#fff",
              fontWeight: 800,
              fontSize: 14,
              cursor: onPick ? "pointer" : "default",
              boxShadow: "0 1px 5px rgba(0,0,0,.35)",
            }}
          >
            {s.label}
          </button>
        )
      })}
    </div>
  )
}
