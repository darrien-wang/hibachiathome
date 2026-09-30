"use client"

import { useCallback, useEffect, useState } from "react"
import { adminJson } from "./api"
import { Tag } from "./ui"
import { askConfirm } from "./ask"

// 排班计算器的分享链接（老板 2026-09-29）：发给认识的人，对方粘一天的「时间 + 地址」
// 算最少几个师傅。这里发链接、看每个链接用了多少、随时收回。
//
// 分享出去的走免费的 OpenStreetMap，不花 Google 的钱；对方粘的地址服务器不存。

type LinkRow = {
  id: string
  token: string
  name: string
  daily_limit: number
  created_at: string
  revoked_at: string | null
  last_used_at: string | null
  usage: { today: number; runs: number; stops: number }
}

const md = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("zh-CN", { timeZone: "America/Los_Angeles", month: "numeric", day: "numeric" }) : "—")

export function ScheduleLinksSection({ adminKey }: { adminKey: string }) {
  const [links, setLinks] = useState<LinkRow[] | null>(null)
  const [name, setName] = useState("")
  const [limit, setLimit] = useState("30")
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const d = await adminJson<{ links: LinkRow[] }>(adminKey, "/api/admin/schedule-links")
      setLinks(d.links)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "读不到")
    }
  }, [adminKey])
  useEffect(() => {
    void load()
  }, [load])

  const urlOf = (token: string) => `${typeof window !== "undefined" ? window.location.origin : "https://www.realhibachi.com"}/tools/schedule?t=${token}`

  const copy = async (l: LinkRow) => {
    try {
      await navigator.clipboard.writeText(urlOf(l.token))
      setCopied(l.id)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      setMsg(urlOf(l.token))
    }
  }

  const create = async () => {
    if (!name.trim() || busy) return
    setBusy("create")
    setMsg(null)
    try {
      const d = await adminJson<{ link: LinkRow }>(adminKey, "/api/admin/schedule-links", { body: { action: "create", name: name.trim(), daily_limit: Number(limit) || 30 } })
      setName("")
      await load()
      // 新建完直接放进剪贴板：下一步几乎一定是发给对方
      try {
        await navigator.clipboard.writeText(urlOf(d.link.token))
        setCopied(d.link.id)
        setTimeout(() => setCopied(null), 2500)
      } catch {}
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "没建成")
    } finally {
      setBusy(null)
    }
  }

  const revoke = async (l: LinkRow) => {
    if (!(await askConfirm({ title: "收回链接", message: `收回「${l.name}」之后，对方手上的链接立刻失效。`, okLabel: "收回" }))) return
    setBusy(l.id)
    try {
      await adminJson(adminKey, "/api/admin/schedule-links", { body: { action: "revoke", id: l.id } })
      await load()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "没收回")
    } finally {
      setBusy(null)
    }
  }

  const live = (links ?? []).filter((l) => !l.revoked_at)
  const gone = (links ?? []).filter((l) => l.revoked_at)

  return (
    <section style={{ borderTop: "2px solid var(--color-divider)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <div style={{ fontWeight: 800, fontSize: 17 }}>排班计算器 · 分享链接</div>
        <div style={{ fontSize: 12.5, color: "var(--color-neutral-600)", marginTop: 4, lineHeight: 1.6 }}>
          发给认识的人：对方粘一天的「时间 + 地址」，算最少几个师傅、谁接谁，和你日历上点「N 场」是同一个算法。
          走免费的 OpenStreetMap，不花你 Google 的钱；对方粘的地址服务器不存，也碰不到你的订单。
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input className="input" style={{ flex: "1 1 200px" }} placeholder="发给谁，比如「Tony · 同行」" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void create()} />
        <span style={{ fontSize: 13, display: "inline-flex", gap: 6, alignItems: "center" }}>
          每天
          <input className="input" inputMode="numeric" style={{ width: 64, textAlign: "center" }} value={limit} onChange={(e) => setLimit(e.target.value.replace(/\D/g, "").slice(0, 4))} />次
        </span>
        <button type="button" className="btn btn-primary btn-sm" disabled={!name.trim() || busy === "create"} onClick={() => void create()}>
          {busy === "create" ? "生成中…" : "生成链接"}
        </button>
      </div>
      {msg ? <div className="notice">{msg}</div> : null}

      {links === null ? <div style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>读取中…</div> : null}
      {live.map((l) => (
        <div key={l.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "8px 0", borderBottom: "1px solid var(--color-line)" }}>
          <span style={{ fontWeight: 700, minWidth: 140 }}>{l.name}</span>
          <span style={{ fontSize: 12.5, color: "var(--color-neutral-600)", flex: 1, minWidth: 200 }}>
            今天 {l.usage.today}/{l.daily_limit} 次 · 累计 {l.usage.runs} 次、{l.usage.stops} 个地址 · 上次用 {md(l.last_used_at)} · {md(l.created_at)} 发出
          </span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copy(l)}>
            {copied === l.id ? "已复制" : "复制链接"}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy === l.id} onClick={() => void revoke(l)}>
            收回
          </button>
        </div>
      ))}
      {gone.length ? (
        <div style={{ fontSize: 12, color: "var(--color-neutral-500)" }}>
          已收回：{gone.map((l) => (
            <Tag key={l.id} cls="tag-faint" style={{ marginRight: 6 }}>
              {l.name} · 累计 {l.usage.runs} 次
            </Tag>
          ))}
        </div>
      ) : null}
    </section>
  )
}
