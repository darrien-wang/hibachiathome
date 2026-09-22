"use client"

import { useCallback, useEffect, useState } from "react"
import { adminJson } from "./api"
import { tell } from "./ask"
import { relativeTime } from "./helpers"

// 线索页顶部的 "Reddit 有人在问"。/api/admin/reddit-watch 每 20 分钟抓一次目标
// 版块，这里只列还没处理的命中。回复永远是人去 Reddit 手动发（坦白身份、不放
// 链接，写法见 docs/Reddit-AMA-开帖与答案库-2026-09-22.md 的规矩），这里只记
// "已回 / 跳过"。没有待处理项时整块不显示，免得平时占地方。

type Item = {
  id: string
  subreddit: string
  title: string
  body: string | null
  author: string | null
  url: string
  posted_at: string
  tier: number
  keywords: string[]
  source: string
  status: string
  found_at: string
}

export function RedditPanel({ adminKey }: { adminKey: string }) {
  const [items, setItems] = useState<Item[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [showAdjacent, setShowAdjacent] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await adminJson<{ items?: Item[] }>(adminKey, "/api/admin/reddit-watch?list=1&status=new")
      setItems(r.items ?? [])
    } catch {
      setItems([])
    }
  }, [adminKey])

  useEffect(() => {
    void load()
    const t = window.setInterval(() => void load(), 5 * 60_000)
    return () => window.clearInterval(t)
  }, [load])

  const mark = async (id: string, status: "replied" | "skipped") => {
    setBusy(id)
    try {
      await adminJson(adminKey, "/api/admin/reddit-watch", { method: "PATCH", body: { id, status } })
      setItems((prev) => (prev ?? []).filter((i) => i.id !== id))
    } catch (e) {
      void tell({ message: e instanceof Error ? e.message : "没存上，再试一次" })
    } finally {
      setBusy(null)
    }
  }

  if (!items || items.length === 0) return null
  const direct = items.filter((i) => i.tier === 1)
  const adjacent = items.filter((i) => i.tier !== 1)
  const shown = showAdjacent ? items : direct

  return (
    <div className="card" style={{ borderRadius: 12, border: "1px solid var(--color-neutral-200, rgba(0,0,0,0.08))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14 }}>Reddit 有人在问</strong>
        <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
          直接问 {direct.length} · 相邻 {adjacent.length} · 回的时候坦白身份、不放链接
        </span>
        {adjacent.length > 0 ? (
          <button type="button" className="btn btn-secondary" style={{ marginLeft: "auto", whiteSpace: "nowrap" }} onClick={() => setShowAdjacent((v) => !v)}>
            {showAdjacent ? "只看直接问" : `看相邻 ${adjacent.length} 条`}
          </button>
        ) : null}
      </div>
      {shown.length === 0 ? <div className="empty">没有直接询问；相邻的几条点右上角看。</div> : null}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {shown.map((i) => (
          <li key={i.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 999,
                whiteSpace: "nowrap",
                background: i.tier === 1 ? "var(--color-accent)" : "var(--color-neutral-200, rgba(0,0,0,0.08))",
                color: i.tier === 1 ? "#fff" : "var(--color-neutral-700)",
              }}
            >
              {i.tier === 1 ? "直接问" : "相邻"}
            </span>
            <div style={{ flex: "1 1 260px", minWidth: 0 }}>
              <a href={i.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, textDecoration: "underline" }}>
                {i.title}
              </a>
              <div style={{ fontSize: 12, color: "var(--color-neutral-600)", marginTop: 2 }}>
                r/{i.subreddit} · u/{i.author || "?"} · {relativeTime(i.posted_at)} · {i.keywords.join(", ")}
              </div>
              {i.body ? (
                <div style={{ fontSize: 13, color: "var(--color-neutral-700)", marginTop: 2 }}>
                  {i.body.slice(0, 220)}
                  {i.body.length > 220 ? "…" : ""}
                </div>
              ) : null}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" className="btn btn-secondary" disabled={busy === i.id} onClick={() => void mark(i.id, "replied")}>
                已回
              </button>
              <button type="button" className="btn btn-secondary" disabled={busy === i.id} onClick={() => void mark(i.id, "skipped")}>
                跳过
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
