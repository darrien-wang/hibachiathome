"use client"

import { useCallback, useEffect, useState } from "react"
import { groupAlbumText, hostAlbumText } from "@/lib/party-album"

// ============================================================
// 派对相册 · 订单弹窗「记录」页（2026-11-23）
// ============================================================
// 建相册 → 复制给主人的短信 / 给群里的话 → 看谁传了、发了几张券 →
// 每个素材可以隐藏（有人要求下架）或挑进选材夹（剪片子用）。
// 现在短信先手动复制发，等老板看过预发再接自动发。

type Item = {
  id: string
  source: "guest" | "chef"
  kind: "photo" | "video"
  url: string | null
  thumb: string | null
  by: string | null
  status?: "visible" | "hidden"
  picked?: boolean
}
type Person = { name: string; phone: string; adsOk: boolean; uploads: number; code: string | null; redeemed: boolean }
type Data = {
  ok: boolean
  error?: string
  album: null | { id: string; title: string; eventDate: string | null; open: boolean; token: string }
  link?: string
  items?: Item[]
  people?: Person[]
  anonymousUploads?: number
}

const small = { fontSize: 12, color: "#6b7280" } as const
const chip = { fontSize: 12, padding: "4px 10px", borderRadius: 999, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" } as const

export function PartyAlbumPanel({ adminKey, orderId, customerName }: { adminKey: string; orderId: string; customerName: string | null }) {
  const [data, setData] = useState<Data | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const call = useCallback(
    async (method: "GET" | "POST", body?: Record<string, unknown>) => {
      const res = await fetch(method === "GET" ? `/api/admin/party-album?orderId=${orderId}` : "/api/admin/party-album", {
        method,
        headers: { "x-admin-key": adminKey, ...(body ? { "content-type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
      return json
    },
    [adminKey, orderId],
  )

  const load = useCallback(async () => {
    try {
      setData((await call("GET")) as Data)
    } catch (e) {
      setData({ ok: false, album: null, error: e instanceof Error ? e.message : String(e) })
    }
  }, [call])

  useEffect(() => {
    void load()
  }, [load])

  const act = async (body: Record<string, unknown>, done?: string) => {
    setBusy(true)
    setMsg(null)
    try {
      await call("POST", body)
      if (done) setMsg(done)
      await load()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setMsg(`已复制：${label}`)
    } catch {
      window.prompt("复制这段：", text)
    }
  }

  if (!data) return <p style={{ ...small, margin: 0 }}>读取中…</p>
  if (!data.album) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="wb-chip wb-chip-sm" disabled={busy} onClick={() => void act({ action: "create", orderId }, "相册已建好")}>
          {busy ? "…" : "建派对相册"}
        </button>
        <span style={small}>派对后发给主人，客人传照片视频，传了的人各拿 $50 券{data.error ? ` · ${data.error}` : ""}</span>
      </div>
    )
  }

  const link = data.link ?? ""
  const first = (customerName ?? "").trim().split(/\s+/)[0] ?? ""
  const items = data.items ?? []
  const guestItems = items.filter((i) => i.source === "guest")
  const people = data.people ?? []
  const coupons = people.filter((p) => p.code).length

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, wordBreak: "break-all" }}>
          {link}
        </a>
        <span style={{ ...small, color: data.album.open ? "#047857" : "#b45309" }}>{data.album.open ? "开放上传" : "已关闭上传"}</span>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" style={chip} onClick={() => void copy(link, "链接")}>复制链接</button>
        <button type="button" style={chip} onClick={() => void copy(hostAlbumText(first, link), "给主人的短信")}>复制给主人的短信</button>
        <button type="button" style={chip} onClick={() => void copy(groupAlbumText(link), "给群里的话")}>复制给群里的话</button>
        <button type="button" style={chip} disabled={busy} onClick={() => void act({ action: "status", orderId, open: !data.album!.open }, data.album!.open ? "已关闭上传" : "已重新开放")}>
          {data.album.open ? "关闭上传" : "重新开放"}
        </button>
      </div>
      <div style={small}>
        客人传了 {guestItems.length} 个（隐藏 {guestItems.filter((i) => i.status === "hidden").length}）· 留了名字 {people.length} 人 · 发券 {coupons} 张
        {data.anonymousUploads ? ` · 还没留名字的上传 ${data.anonymousUploads} 个` : ""}
      </div>
      {people.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {people.map((p) => (
            <div key={p.phone} style={{ fontSize: 12 }}>
              {p.name} · {p.phone} · 传了 {p.uploads} 个 · 券 {p.code ?? "—"}
              {p.redeemed ? "（已用）" : ""}
              {p.adsOk ? " · 同意用于广告" : ""}
            </div>
          ))}
        </div>
      ) : null}
      {items.length > 0 ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {items.map((it) => {
            const src = it.thumb ?? (it.kind === "photo" ? it.url : null)
            const hidden = it.status === "hidden"
            return (
              <div key={it.id} style={{ width: 104, opacity: hidden ? 0.4 : 1 }}>
                <a href={it.url ?? "#"} target="_blank" rel="noopener noreferrer" title={it.kind === "video" ? "打开视频" : "打开原图"} style={{ position: "relative", display: "block" }}>
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 后台缩略图
                    <img src={src} alt="" style={{ width: 104, height: 104, objectFit: "cover", borderRadius: 8, border: it.picked ? "3px solid #e8722a" : "1px solid #e5e7eb", display: "block" }} />
                  ) : it.url ? (
                    <video src={`${it.url}#t=0.5`} muted preload="metadata" style={{ width: 104, height: 104, objectFit: "cover", borderRadius: 8, display: "block", background: "#000" }} />
                  ) : null}
                  {it.kind === "video" ? <span style={{ position: "absolute", top: 4, left: 4, fontSize: 10, background: "rgba(0,0,0,.6)", color: "#fff", borderRadius: 4, padding: "1px 4px" }}>视频</span> : null}
                </a>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {it.source === "chef" ? "师傅" : (it.by ?? "未留名")}
                </div>
                {it.source === "guest" ? (
                  <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                    <button type="button" style={{ ...chip, padding: "2px 6px", fontSize: 11 }} disabled={busy} onClick={() => void act({ action: "media", id: it.id, picked: !it.picked })}>
                      {it.picked ? "取消选" : "选"}
                    </button>
                    <button type="button" style={{ ...chip, padding: "2px 6px", fontSize: 11 }} disabled={busy} onClick={() => void act({ action: "media", id: it.id, status: hidden ? "visible" : "hidden" })}>
                      {hidden ? "恢复" : "隐藏"}
                    </button>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
      {msg ? <p style={{ fontSize: 12, color: "#374151", margin: 0 }}>{msg}</p> : null}
    </div>
  )
}
