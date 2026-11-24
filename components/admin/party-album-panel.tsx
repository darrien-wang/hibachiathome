"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { albumMediaType, groupAlbumText, hostAlbumText } from "@/lib/party-album"
import { uploadAlbumFile } from "@/lib/album-upload-client"

// ============================================================
// 派对相册 · 订单弹窗「记录」页（2026-11-23）
// ============================================================
// 老板定：相册页只为一件事——让客人参与进来。所以先由我们放「种子」：
// 建相册时自动放进师傅拍的洋葱火山和派对结束的照片视频，这里还能再传
// 一批（摄影/挑过的好图）；客人打开第一眼就是一本有内容的相册。
// 标题默认 "Tommy's Party"，可以改成 "Sophia's Sweet 16" 这种更有纪念感的。
// 短信先手动复制发。

type Item = {
  id: string
  source: "guest" | "staff" | "chef"
  kind: "photo" | "video"
  url: string | null
  thumb: string | null
  status?: "visible" | "hidden"
  picked?: boolean
}
type Data = {
  ok: boolean
  error?: string
  album: null | { id: string; title: string; eventDate: string | null; place: string | null; open: boolean; token: string }
  link?: string
  items?: Item[]
  people?: number
}

const small = { fontSize: 12, color: "#6b7280" } as const
const chip = { fontSize: 12, padding: "4px 10px", borderRadius: 999, border: "1px solid #d1d5db", background: "#fff", cursor: "pointer" } as const
const SOURCE_LABEL: Record<Item["source"], string> = { guest: "客人", staff: "我们传的", chef: "师傅拍的" }

export function PartyAlbumPanel({ adminKey, orderId, customerName }: { adminKey: string; orderId: string; customerName?: string | null }) {
  const [data, setData] = useState<Data | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [seeding, setSeeding] = useState<{ done: number; total: number; failed: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const call = useCallback(
    async (method: "GET" | "POST", body?: Record<string, unknown>) => {
      const res = await fetch(method === "GET" ? `/api/admin/party-album?orderId=${orderId}` : "/api/admin/party-album", {
        method,
        headers: { "x-admin-key": adminKey, ...(body ? { "content-type": "application/json" } : {}) },
        body: body ? JSON.stringify({ orderId, ...body }) : undefined,
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
      const d = (await call("GET")) as Data
      setData(d)
      if (d.album) setTitle(d.album.title)
    } catch (e) {
      setData({ ok: false, album: null, error: e instanceof Error ? e.message : String(e) })
    }
  }, [call])

  useEffect(() => {
    void load()
  }, [load])

  const act = async (body: Record<string, unknown>, done?: string | ((r: Record<string, unknown>) => string)) => {
    setBusy(true)
    setMsg(null)
    try {
      const r = (await call("POST", body)) as Record<string, unknown>
      if (done) setMsg(typeof done === "function" ? done(r) : done)
      await load()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const seed = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const list = Array.from(files)
    let done = 0
    let failed = 0
    setSeeding({ done, total: list.length, failed })
    let next = 0
    const worker = async () => {
      while (next < list.length) {
        const file = list[next++]
        const type = albumMediaType(file.type, file.name)
        try {
          if (!type) throw new Error("不是照片或视频")
          await uploadAlbumFile(file, type, {
            slot: (a) => call("POST", { action: "slot", ...a }),
            done: (a) => call("POST", { action: "done", ...a }),
          })
          done++
        } catch {
          failed++
        }
        setSeeding({ done, total: list.length, failed })
      }
    }
    await Promise.all([worker(), worker()])
    setSeeding(null)
    setMsg(`传好 ${done} 个${failed ? `，${failed} 个失败` : ""}`)
    await load()
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
        <button
          type="button"
          className="wb-chip wb-chip-sm"
          disabled={busy}
          onClick={() => void act({ action: "create" }, (r) => `相册建好了${Number(r.chefAdded) ? `，放进了师傅拍的 ${r.chefAdded} 个` : ""}`)}
        >
          {busy ? "…" : "建派对相册"}
        </button>
        <span style={small}>
          一场派对一个链接，大家把照片视频都放进来；师傅拍的会自动放进去当第一批{data.error ? ` · ${data.error}` : ""}
        </span>
      </div>
    )
  }

  const album = data.album
  const link = data.link ?? ""
  const rawFirst = (customerName ?? "").trim().split(/\s+/)[0] ?? ""
  const first = rawFirst ? rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1).toLowerCase() : ""
  const items = data.items ?? []
  const visible = items.filter((i) => i.status !== "hidden")
  const coverId = visible[0]?.id
  const guestCount = items.filter((i) => i.source === "guest").length
  const seedCount = visible.filter((i) => i.source !== "guest").length

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
          style={{ fontSize: 15, fontWeight: 700, padding: "4px 8px", border: "1px solid #d1d5db", borderRadius: 8, minWidth: 200 }}
          aria-label="相册标题"
        />
        {title.trim() !== album.title ? (
          <button type="button" style={chip} disabled={busy} onClick={() => void act({ action: "title", title }, "标题改好了")}>
            保存标题
          </button>
        ) : null}
        <span style={small}>
          {[album.eventDate, album.place].filter(Boolean).join(" · ")} · {album.open ? "开放上传" : "已关闭上传"}
        </span>
      </div>
      <a href={link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, wordBreak: "break-all" }}>
        {link}
      </a>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            void seed(e.target.files)
            e.target.value = ""
          }}
        />
        <button type="button" style={{ ...chip, borderColor: "#e8722a", color: "#a34812", fontWeight: 600 }} disabled={!!seeding} onClick={() => fileRef.current?.click()}>
          {seeding ? `传种子素材 ${seeding.done + seeding.failed}/${seeding.total}…` : "传种子素材"}
        </button>
        <button type="button" style={chip} disabled={busy} onClick={() => void act({ action: "chef" }, (r) => (Number(r.added) ? `放进了师傅拍的 ${r.added} 个` : "师傅拍的都已经在里面了"))}>
          放进师傅拍的
        </button>
        <button type="button" style={chip} onClick={() => void copy(link, "链接")}>复制链接</button>
        <button type="button" style={chip} onClick={() => void copy(hostAlbumText(first, link), "给主人的短信")}>复制给主人的短信</button>
        <button type="button" style={chip} onClick={() => void copy(groupAlbumText(link), "给群里的话")}>复制给群里的话</button>
        <button type="button" style={chip} disabled={busy} onClick={() => void act({ action: "status", open: !album.open }, album.open ? "已关闭上传" : "已重新开放")}>
          {album.open ? "关闭上传" : "重新开放"}
        </button>
      </div>
      <div style={small}>
        种子 {seedCount} 个 · 客人传了 {guestCount} 个 · 参与 {data.people ?? 0} 人（同一部手机算一人）
        {seedCount === 0 ? <span style={{ color: "#b45309" }}> · 还没有种子，先传几张好的再发给主人</span> : null}
      </div>
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
                  {it.id === coverId ? <span style={{ position: "absolute", top: 4, right: 4, fontSize: 10, background: "#e8722a", color: "#fff", borderRadius: 4, padding: "1px 4px" }}>封面</span> : null}
                </a>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{SOURCE_LABEL[it.source]}</div>
                <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                  <button type="button" style={{ ...chip, padding: "2px 6px", fontSize: 11 }} disabled={busy} onClick={() => void act({ action: "media", id: it.id, picked: !it.picked })}>
                    {it.picked ? "取消选" : "选"}
                  </button>
                  <button type="button" style={{ ...chip, padding: "2px 6px", fontSize: 11 }} disabled={busy} onClick={() => void act({ action: "media", id: it.id, status: hidden ? "visible" : "hidden" })}>
                    {hidden ? "恢复" : "隐藏"}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
      <div style={small}>封面 = 排第一个的种子（最先放进去的）。客人的按新到旧排在种子后面。</div>
      {msg ? <p style={{ fontSize: 12, color: "#374151", margin: 0 }}>{msg}</p> : null}
    </div>
  )
}
