"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { adminJson } from "./api"
import { Dialog, DialogHead, Tag } from "./ui"

// 一天几场摆到地图上（老板 2026-09-29）。五场挤在 17:00–20:30，能不能让一个师傅连做
// 两场，靠的不是名单而是"它们离多远、顺不顺路"。
//
// 底图是 OpenStreetMap 的瓦片，用 <img> 拼出来的，没装地图库：
// 一个只有老板会打开的调度视图，不值得为它加一个依赖和一串 API key。

type Stop = {
  id: string
  orderNo: string
  name: string
  phone: string | null
  address: string
  time: string
  guests: number
  lat: number | null
  lng: number | null
}
type Hop = { minutes: number; miles: number } | null
type Resp = {
  date: string
  stops: Stop[]
  missing: Array<{ name: string; address: string }>
  home: { lat: number; lng: number; label: string } | null
  hops: Hop[]
}

const TILE = 256
const MAX_Z = 17

// Web Mercator：经纬度 → 瓦片坐标（z 级下的小数瓦片号）
const xOf = (lng: number, z: number) => ((lng + 180) / 360) * 2 ** z
const yOf = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z
}

export function DayMap({ adminKey, date, onClose, onOpenOrder }: { adminKey: string; date: string; onClose: () => void; onOpenOrder: (id: string) => void }) {
  const [d, setD] = useState<Resp | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setD(await adminJson<Resp>(adminKey, `/api/admin/day-map?date=${date}`))
    } catch (e) {
      setErr(e instanceof Error ? e.message : "读不到")
    }
  }, [adminKey, date])
  useEffect(() => {
    void load()
  }, [load])

  const placed = useMemo(() => (d?.stops ?? []).filter((s) => s.lat !== null && s.lng !== null) as Array<Stop & { lat: number; lng: number }>, [d])

  // 选一个刚好framing 全部点的缩放级别，而不是写死一个——同城五场和跨县五场
  // 差着几个数量级，写死不是太挤就是太空。
  const view = useMemo(() => {
    const pts = [...placed, ...(d?.home ? [d.home] : [])]
    if (pts.length === 0) return null
    const W = 640
    const H = 420
    const pad = 56
    const lats = pts.map((p) => p.lat)
    const lngs = pts.map((p) => p.lng)
    let z = MAX_Z
    for (; z > 3; z--) {
      const xs = lngs.map((v) => xOf(v, z) * TILE)
      const ys = lats.map((v) => yOf(v, z) * TILE)
      if (Math.max(...xs) - Math.min(...xs) <= W - pad * 2 && Math.max(...ys) - Math.min(...ys) <= H - pad * 2) break
    }
    const cx = (xOf(Math.min(...lngs), z) + xOf(Math.max(...lngs), z)) / 2
    const cy = (yOf(Math.min(...lats), z) + yOf(Math.max(...lats), z)) / 2
    const originX = cx * TILE - W / 2
    const originY = cy * TILE - H / 2
    const at = (lat: number, lng: number) => ({ x: xOf(lng, z) * TILE - originX, y: yOf(lat, z) * TILE - originY })
    const tiles: Array<{ x: number; y: number; left: number; top: number }> = []
    const x0 = Math.floor(originX / TILE)
    const y0 = Math.floor(originY / TILE)
    for (let tx = x0; tx * TILE < originX + W; tx++) {
      for (let ty = y0; ty * TILE < originY + H; ty++) {
        if (ty < 0 || ty >= 2 ** z) continue
        tiles.push({ x: ((tx % 2 ** z) + 2 ** z) % 2 ** z, y: ty, left: tx * TILE - originX, top: ty * TILE - originY })
      }
    }
    return { W, H, z, at, tiles }
  }, [placed, d])

  const cur = placed.find((s) => s.id === open) ?? null
  // 一次把全天串成一条路线丢给 Google 地图：真要导航的时候还是用它。
  const routeUrl =
    placed.length > 0
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(placed[placed.length - 1].address)}` +
        (placed.length > 1 ? `&waypoints=${placed.slice(0, -1).map((s) => encodeURIComponent(s.address)).join("|")}` : "")
      : null

  return (
    <Dialog onClose={onClose} width={720}>
      <DialogHead
        title={`${date} · ${d?.stops.length ?? 0} 场`}
        lines={[placed.length > 1 ? "按开场时间编号，线上的数字是从上一场开过来的车程" : "点一下图上的圆点看详情"]}
        onClose={onClose}
      />
      <div className="dialog-col" style={{ gap: 12 }}>
        {err ? <div className="notice danger">{err}</div> : null}
        {!d ? <div style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>算距离中…（第一次打开要给每个地址定位，慢一点）</div> : null}

        {d && view ? (
          <div style={{ position: "relative", width: view.W, height: view.H, maxWidth: "100%", overflow: "hidden", border: "2px solid var(--color-text)", background: "#e8e4df" }}>
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

            <svg width={view.W} height={view.H} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              {placed.slice(1).map((s, i) => {
                const a = view.at(placed[i].lat, placed[i].lng)
                const b = view.at(s.lat, s.lng)
                const hop = d.hops?.[i]
                return (
                  <g key={s.id}>
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--color-accent)" strokeWidth={2.5} strokeDasharray="6 4" />
                    {hop ? (
                      <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 6} textAnchor="middle" fontSize={12} fontWeight={800} fill="var(--color-text)" stroke="#fff" strokeWidth={3} paintOrder="stroke">
                        {hop.minutes} 分 · {hop.miles} mi
                      </text>
                    ) : null}
                  </g>
                )
              })}
            </svg>

            {d.home ? (
              <div title={d.home.label} style={{ position: "absolute", left: view.at(d.home.lat, d.home.lng).x - 7, top: view.at(d.home.lat, d.home.lng).y - 7, width: 14, height: 14, borderRadius: "50%", background: "#fff", border: "3px solid var(--color-text)" }} />
            ) : null}

            {placed.map((s, i) => {
              const p = view.at(s.lat, s.lng)
              const on = open === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setOpen(on ? null : s.id)}
                  title={`${s.time} ${s.name}`}
                  style={{
                    position: "absolute",
                    left: p.x - 15,
                    top: p.y - 15,
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    border: `3px solid ${on ? "var(--color-text)" : "#fff"}`,
                    background: "var(--color-accent)",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: "pointer",
                    boxShadow: "0 1px 5px rgba(0,0,0,.35)",
                  }}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>
        ) : null}

        {d ? (
          <div style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>
            底图 © OpenStreetMap contributors · 车程由 OSRM 估算
          </div>
        ) : null}

        {cur ? (
          <div style={{ border: "2px solid var(--color-text)", padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 18 }}>
                {placed.findIndex((s) => s.id === cur.id) + 1}. {cur.time} {cur.name} <Tag cls="tag-neutral">{cur.guests} 人</Tag>
              </div>
              <span className="mono" style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>{cur.orderNo}</span>
            </div>
            <div style={{ fontSize: 13, marginTop: 6 }}>{cur.address}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => onOpenOrder(cur.id)}>
                打开这一单
              </button>
              <a className="btn btn-secondary btn-sm" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cur.address)}`} target="_blank" rel="noopener noreferrer">
                导航过去
              </a>
              {cur.phone ? (
                <a className="btn btn-secondary btn-sm" href={`tel:${cur.phone}`}>
                  打给客人
                </a>
              ) : null}
            </div>
          </div>
        ) : null}

        {d?.stops.length ? (
          <div>
            {d.stops.map((s, i) => {
              const idx = placed.findIndex((p) => p.id === s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => (idx >= 0 ? setOpen(open === s.id ? null : s.id) : onOpenOrder(s.id))}
                  className="btn btn-ghost btn-left"
                  style={{ width: "100%", display: "flex", gap: 10, alignItems: "baseline", padding: "8px 6px", borderBottom: "1px solid var(--color-divider)" }}
                >
                  <span style={{ fontWeight: 800, width: 18, color: idx >= 0 ? "var(--color-accent-700)" : "var(--color-neutral-500)" }}>{idx >= 0 ? idx + 1 : "—"}</span>
                  <span style={{ fontWeight: 700 }}>{s.time}</span>
                  <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    {s.name} · {s.guests} 人
                    {idx < 0 ? <span style={{ color: "var(--color-accent-700)" }}> · 地址定位不到</span> : null}
                  </span>
                  {i > 0 && idx > 0 && d.hops?.[idx - 1] ? (
                    <span style={{ fontSize: 12, color: "var(--color-neutral-600)", whiteSpace: "nowrap" }}>
                      上一场开过来 {d.hops[idx - 1]!.minutes} 分
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        ) : null}

        {routeUrl ? (
          <a className="btn btn-secondary" href={routeUrl} target="_blank" rel="noopener noreferrer">
            在 Google 地图里按顺序打开全天
          </a>
        ) : null}
      </div>
    </Dialog>
  )
}
