"use client"

import { useCallback, useEffect, useState } from "react"

// ============================================================
// 派对照片 · what the chef shot at the party
// ============================================================
// Two sets per party from the prep sheet: setup and end of party. Shown here
// so the owner can send them to the customer the next morning and keep the
// good ones for ads. Signed URLs expire in an hour, so the panel refetches
// each time an order is opened. Built 2026-09-19.

type Photo = { id: string; phase: string; url: string | null; created_at: string }

const PT = "America/Los_Angeles"

export function OrderPhotosPanel({ adminKey, orderId }: { adminKey: string; orderId: string | null }) {
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    // No key is fine: the login-session cookie carries the identity.
    if (!orderId) return
    setError(null)
    try {
      const res = await fetch(`/api/admin/order-photos?orderId=${encodeURIComponent(orderId)}`, {
        headers: { "x-admin-key": adminKey },
        cache: "no-store",
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
      setPhotos(json.photos as Photo[])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPhotos([])
    }
  }, [adminKey, orderId])

  useEffect(() => {
    void load()
  }, [load])

  if (photos === null) return <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>读取中…</p>
  if (photos.length === 0) {
    return (
      <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>
        还没有照片（厨师在备料单上拍，开始和结束各一组）
        {error ? ` · ${error}` : ""}
      </p>
    )
  }

  const groups: Array<{ key: string; label: string }> = [
    { key: "setup", label: "开始" },
    { key: "after", label: "结束" },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {groups.map((g) => {
        const shots = photos.filter((p) => p.phase === g.key)
        if (shots.length === 0) return null
        return (
          <div key={g.key}>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
              {g.label} · {shots.length} 张 ·{" "}
              {new Date(shots[0].created_at).toLocaleString("en-US", { timeZone: PT, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} PT
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {shots.map((p) =>
                p.url ? (
                  <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" title="打开原图">
                    <img
                      src={p.url}
                      alt={`${g.label} ${p.id.slice(0, 6)}`}
                      style={{ width: 104, height: 104, objectFit: "cover", borderRadius: 8, border: "1px solid #e5e7eb", display: "block" }}
                    />
                  </a>
                ) : null,
              )}
            </div>
          </div>
        )
      })}
      {error && <p style={{ fontSize: 12, color: "#b91c1c", margin: 0 }}>{error}</p>}
    </div>
  )
}
