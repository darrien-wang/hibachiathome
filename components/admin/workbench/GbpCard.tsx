"use client"

import { useState, type CSSProperties } from "react"
import { adminJson } from "./api"
import { askConfirm } from "./ask"
import { Tag } from "./ui"
import { stamp } from "./helpers"

// 「好评」页签顶上的 Google 商家后台卡片（2026-10-09，只有老板看得到）。
// 连接一次之后：全部评价一次拉齐（Places 只给 5 条），在台账里直接回复评价。
// 授权走 Google 的"桌面应用"流程：授权完浏览器跳到 127.0.0.1（这台机器上没人听，
// 显示"无法访问此网站"），把那一页的地址整段贴回这里。说明见 lib/gbp.ts。

export type GbpStatus = {
  clientReady: boolean
  clientProject: string | null
  expectedProject: string
  connected: boolean
  email: string | null
  location: { name: string; title: string | null; placeIdMatches: boolean | null; mapsUri: string | null } | null
  candidates: Array<{ name: string; title: string | null; account: string }>
  pending: boolean
  connectedAt: string | null
  connectedBy: string | null
  lastSyncAt: string | null
  lastSync: { added?: number; linked?: number; photos?: number; onGoogle?: number; total?: number | null; unreplied?: number; missing?: number } | null
  lastError: string | null
  lastErrorAt: string | null
  firstSyncDone: boolean
  linked: number
  apis: Array<{ id: string; label: string; url: string }>
}

type RowBrief = { id: string; reviewer: string | null; date: string | null; snippet: string; hasBonus: boolean }
type GoogleBrief = { reviewer: string | null; date: string | null; rating: number | null; snippet: string; photos: number; replied: boolean }
type SyncResult = {
  dry: boolean
  onGoogle: number
  total: number | null
  average: number | null
  alreadyLinked: number
  newlyLinked: Array<{ rule: string; ledger: RowBrief; google: GoogleBrief }>
  fresh: GoogleBrief[]
  suspects: Array<{ google: GoogleBrief; ledger: RowBrief[] }>
  missing: RowBrief[]
  photoUpgrades: Array<{ reviewer: string | null; date: string | null; hasBonus: boolean }>
  replied: number
  unreplied: number
  added?: number
  linked?: number
  photos?: number
  errors?: string[]
}

const RULE_LABEL: Record<string, string> = { key: "同一个 id", body: "评价人 + 正文", date: "评价人 + 日期", name: "名字唯一（请核对）" }
const who = (s: string | null) => s ?? "匿名"
const line = (d: string | null, snippet: string) => `${d ?? "日期未知"}${snippet ? ` · ${snippet}` : " ·（没写字）"}`

export default function GbpCard({ adminKey, status, onChanged, cardStyle }: { adminKey: string; status: GbpStatus; onChanged: () => Promise<void> | void; cardStyle: CSSProperties }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [authUrl, setAuthUrl] = useState<string | null>(null)
  const [pasted, setPasted] = useState("")
  const [preview, setPreview] = useState<SyncResult | null>(null)

  const call = async <T,>(tag: string, body: Record<string, unknown>): Promise<T | null> => {
    setBusy(tag)
    setErr(null)
    setMsg(null)
    try {
      return await adminJson<T>(adminKey, "/api/admin/reviews", { body })
    } catch (e) {
      setErr(e instanceof Error ? e.message : "失败")
      return null
    } finally {
      setBusy(null)
    }
  }

  const connect = async () => {
    // 先同步开一个空白页再填地址——等请求回来再 window.open 会被浏览器当弹窗拦掉
    const w = typeof window !== "undefined" ? window.open("about:blank", "_blank") : null
    const r = await call<{ url: string }>("start", { action: "gbp_connect_start" })
    if (!r?.url) {
      w?.close()
      return
    }
    setAuthUrl(r.url)
    setPasted("")
    if (w) {
      w.opener = null
      w.location.href = r.url
    }
  }

  const finish = async () => {
    const r = await call<{ email: string | null; located: { found: number; picked: { title: string | null } | null } | null; locateError?: string }>("finish", { action: "gbp_connect_finish", pasted })
    if (!r) return
    setAuthUrl(null)
    setPasted("")
    if (r.locateError) setErr(`授权成功了（${r.email ?? "?"}），但找门店失败：${r.locateError}`)
    else if (r.located?.picked) setMsg(`连上了：${r.email ?? "?"} · ${r.located.picked.title ?? ""}。下一步点「全量同步」先预演。`)
    else setMsg(`连上了：${r.email ?? "?"}，这个账号下有 ${r.located?.found ?? 0} 家店，下面选一下是哪家`)
    await onChanged()
  }

  const relocate = async (location?: string) => {
    const r = await call<{ found: number; picked: { title: string | null } | null }>("locate", { action: "gbp_locate", ...(location ? { location } : {}) })
    if (!r) return
    setMsg(r.picked ? `门店：${r.picked.title ?? "?"}` : `找到 ${r.found} 家，选一家`)
    await onChanged()
  }

  const disconnectIt = async () => {
    const ok = await askConfirm({
      title: "断开 Google 商家后台",
      message:
        "只删工作台这边存的授权，Google 上什么都不动。断开后不能在这里回复评价，「手动刷新」退回只拉 5 条。要从 Google 那边彻底撤销：Google 账号 → 安全 → 第三方应用里删掉 Real Hibachi——注意那样同一个账号给 Google Ads 的授权也会一起失效。",
      okLabel: "断开",
      danger: true,
    })
    if (!ok) return
    const r = await call("disconnect", { action: "gbp_disconnect" })
    if (!r) return
    setPreview(null)
    setMsg("已断开")
    await onChanged()
  }

  const dryRun = async () => {
    const r = await call<SyncResult>("dry", { action: "gbp_sync", dry: true })
    if (r) setPreview(r)
  }

  const apply = async () => {
    const r = await call<SyncResult>("apply", { action: "gbp_sync", dry: false, confirmed: true })
    if (!r) return
    setPreview(null)
    setMsg(
      `同步完：新进 ${r.added ?? 0} 条，和旧记录对上 ${r.linked ?? 0} 条${r.photos ? `，补上带图 ${r.photos} 条` : ""}；Google 共 ${r.onGoogle} 条，${r.unreplied} 条还没回复${r.errors?.length ? `（${r.errors.length} 处没写进去：${r.errors[0]}）` : ""}`,
    )
    await onChanged()
  }

  const muted: CSSProperties = { fontSize: 11.5, color: "var(--color-neutral-600)" }
  const projectWrong = status.clientProject && status.clientProject !== status.expectedProject
  const apisLine = (
    <span>
      {status.apis.map((a, i) => (
        <span key={a.id}>
          {i ? " · " : ""}
          <a href={a.url} target="_blank" rel="noreferrer">
            {a.label} ↗
          </a>
        </span>
      ))}
    </span>
  )

  return (
    <div style={{ ...cardStyle, borderColor: status.connected && !status.lastError ? undefined : "var(--color-accent)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div className="kicker">Google 商家后台</div>
        {status.connected ? <Tag cls="tag-ink">已连接</Tag> : <Tag cls="tag-outline">未连接</Tag>}
        {status.connected && status.location ? (
          <span style={{ fontSize: 12.5 }}>
            {status.email ?? "?"} · <strong>{status.location.title ?? status.location.name}</strong>
            {status.location.placeIdMatches === false ? <span style={{ color: "var(--color-accent-700)" }}>（Place ID 和网站上的对不上，确认是不是这家）</span> : null}
          </span>
        ) : status.connected ? (
          <span style={{ fontSize: 12.5 }}>{status.email ?? "?"} · 还没认出门店</span>
        ) : null}
        <span style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {status.connected && status.location ? (
            <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => void dryRun()}>
              {busy === "dry" ? "对账中…" : status.firstSyncDone ? "全量同步" : "全量同步（先预演）"}
            </button>
          ) : null}
          {status.connected ? (
            <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => void relocate()}>
              重新查找门店
            </button>
          ) : null}
          <button type="button" className={status.connected ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm"} disabled={!!busy || !status.clientReady} onClick={() => void connect()}>
            {busy === "start" ? "打开中…" : status.connected ? "重新连接" : "连接 Google"}
          </button>
          {status.connected ? (
            <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => void disconnectIt()}>
              断开
            </button>
          ) : null}
        </span>
      </div>

      {status.connected && status.lastSyncAt ? (
        <div style={{ ...muted, marginTop: 4 }}>
          上次同步 {stamp(status.lastSyncAt)} · Google {status.lastSync?.onGoogle ?? "?"} 条 · 台账已对上 {status.linked} 条 · 未回复 {status.lastSync?.unreplied ?? "?"} 条
          {status.lastSync?.missing ? ` · 台账有、Google 上没有 ${status.lastSync.missing} 条` : ""}
        </div>
      ) : null}
      {status.connected && status.location && !status.firstSyncDone ? (
        <div style={{ ...muted, marginTop: 4 }}>第一次同步要把台账里几十条老记录和 Google 一条条对上：先点「全量同步（先预演）」看清楚哪些对上、哪些是新的，再写入。之后「手动刷新」就直接全量同步。</div>
      ) : null}

      {!status.connected && !authUrl ? (
        <div style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 6 }}>
          连上之后：全部评价一次拉齐（现在只拉得到 5 条），在下面每条评价上直接回复。<strong>只做一次，请在电脑浏览器上做</strong>（手机工作台 App 里 Google 不让登录）。
          <ol style={{ margin: "6px 0 0", paddingLeft: 20 }}>
            <li>点「连接 Google」，会开一个 Google 授权的新标签页。</li>
            <li>选平时管理 Real Hibachi 商家资料的那个 Google 账号。如果出现“Google 未验证此应用”，点左下角「高级」→ 最下面「转至 …（不安全）」——这是我们自己的应用，没送 Google 审核，只有你一个人用。</li>
            <li>和“Google 商家”有关的那一项（英文 “See, edit, create, and delete your Google business listings”）一定要打勾 → 「继续」。</li>
            <li>最后那页会显示“无法访问此网站”——正常，说明授权成功了。把那一页地址栏的整段地址复制，贴到这里的框里，点「完成连接」。</li>
          </ol>
          <div style={{ ...muted, marginTop: 4 }}>
            提前要在 Google Cloud（real-hibachi 项目）启用这三个 API：{apisLine}
          </div>
        </div>
      ) : null}

      {authUrl ? (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12.5 }}>
            在新标签页里授权（没弹出来就点
            <a href={authUrl} target="_blank" rel="noreferrer" style={{ margin: "0 4px" }}>
              这里打开 Google 授权页 ↗
            </a>
            ）。最后那页显示“无法访问此网站”时，把地址栏整段复制贴到下面：
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input className="input" style={{ flex: "1 1 260px", minWidth: 0, fontSize: 12.5 }} placeholder="127.0.0.1:8769/?state=…&code=…" value={pasted} onChange={(e) => setPasted(e.target.value)} />
            <button type="button" className="btn btn-primary btn-sm" disabled={!!busy || !pasted.trim()} onClick={() => void finish()}>
              {busy === "finish" ? "连接中…" : "完成连接"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => setAuthUrl(null)}>
              取消
            </button>
          </div>
          <div style={muted}>20 分钟内有效。这段地址只能用一次，用完就作废。</div>
        </div>
      ) : null}

      {status.connected && !status.location && status.candidates.length ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12.5, marginBottom: 4 }}>这个账号能管好几家店，选 Real Hibachi 那家：</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {status.candidates.map((c) => (
              <button key={c.name} type="button" className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => void relocate(c.name)}>
                {c.title ?? c.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {projectWrong ? <div className="notice notice-accent" style={{ fontSize: 12, marginTop: 8 }}>服务器用的 OAuth 客户端属于项目 {status.clientProject}，不是批了白名单的 {status.expectedProject}——配额会是 0。这条要开发处理。</div> : null}
      {status.lastError ? (
        <div className="notice notice-accent" style={{ fontSize: 12, marginTop: 8 }}>
          {status.lastErrorAt ? `${stamp(status.lastErrorAt)} · ` : ""}
          {status.lastError}
          {/没启用/.test(status.lastError) ? <div style={{ marginTop: 4 }}>{apisLine}</div> : null}
        </div>
      ) : null}
      {err ? <div className="notice notice-accent" style={{ fontSize: 12, marginTop: 8 }}>{err}</div> : null}
      {msg ? <div className="notice" style={{ fontSize: 12, marginTop: 8 }}>{msg}</div> : null}

      {preview ? <SyncPreview p={preview} busy={busy} onApply={() => void apply()} onCancel={() => setPreview(null)} /> : null}
    </div>
  )
}

export function SyncPreview({ p, busy, onApply, onCancel }: { p: SyncResult; busy: string | null; onApply: () => void; onCancel: () => void }) {
  const named = p.newlyLinked.filter((l) => l.rule === "name")
  const other = p.newlyLinked.filter((l) => l.rule !== "name")
  const box: CSSProperties = { borderTop: "1px solid var(--color-line)", padding: "6px 0", fontSize: 12 }
  const nothing = !p.newlyLinked.length && !p.fresh.length && !p.photoUpgrades.length
  return (
    <div style={{ marginTop: 10, borderTop: "2px solid var(--color-text)", paddingTop: 8 }}>
      <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>
        <strong>预演（还没写）</strong>：Google 上 {p.onGoogle} 条{p.average ? `（平均 ${p.average.toFixed(1)}★）` : ""} · 早就对上的 {p.alreadyLinked} · 这次和旧记录对上 {p.newlyLinked.length} · 新进 {p.fresh.length}
        {p.photoUpgrades.length ? ` · 补带图 ${p.photoUpgrades.length}` : ""} · 台账有、Google 上没有 {p.missing.length} · 还没回复 {p.unreplied}
      </div>
      {named.length ? (
        <div style={box}>
          <div style={{ fontWeight: 600, color: "var(--color-accent-700)" }}>按“名字唯一”对上的 {named.length} 条——日期/正文对不上，只靠名字，请扫一眼是不是同一条：</div>
          {named.map((l, i) => (
            <div key={i} style={{ marginTop: 3 }}>
              {who(l.ledger.reviewer)}：台账 {line(l.ledger.date, l.ledger.snippet)}
              <br />
              <span style={{ color: "var(--color-neutral-600)" }}>⇄ Google {line(l.google.date, l.google.snippet)}</span>
            </div>
          ))}
        </div>
      ) : null}
      {other.length ? (
        <details style={box}>
          <summary>和旧记录对上 {other.length} 条（正文/日期对得上，放心）</summary>
          {other.map((l, i) => (
            <div key={i} style={{ marginTop: 3 }}>
              {who(l.ledger.reviewer)} · {l.ledger.date ?? "?"} → {l.google.date ?? "?"} · {RULE_LABEL[l.rule] ?? l.rule}
            </div>
          ))}
        </details>
      ) : null}
      {p.fresh.length ? (
        <div style={box}>
          <div style={{ fontWeight: 600 }}>新进 {p.fresh.length} 条：</div>
          {p.fresh.map((g, i) => (
            <div key={i} style={{ marginTop: 3 }}>
              {who(g.reviewer)} · {g.rating ? `${g.rating}★ · ` : ""}
              {line(g.date, g.snippet)}
              {g.photos ? ` · 带图 ${g.photos}` : ""}
            </div>
          ))}
        </div>
      ) : null}
      {p.suspects.length ? (
        <div style={box}>
          <div style={{ fontWeight: 600, color: "var(--color-accent-700)" }}>新进的里有 {p.suspects.length} 条和台账里没对上的行同名（多半是重名的新客人，写入前看一眼）：</div>
          {p.suspects.map((s, i) => (
            <div key={i} style={{ marginTop: 3 }}>
              Google：{who(s.google.reviewer)} {line(s.google.date, s.google.snippet)}
              {s.ledger.map((r) => (
                <div key={r.id} style={{ color: "var(--color-neutral-600)" }}>
                  台账：{line(r.date, r.snippet)}
                  {r.hasBonus ? "（挂着奖励）" : ""}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : null}
      {p.photoUpgrades.length ? (
        <div style={box}>
          <div style={{ fontWeight: 600 }}>Google 上带图、台账里还是无图的 {p.photoUpgrades.length} 条（照片挂上；已记给师傅、没结算的奖励 $2 → $3）：</div>
          {p.photoUpgrades.map((u, i) => (
            <div key={i} style={{ marginTop: 3 }}>
              {who(u.reviewer)} · {u.date ?? "?"}
              {u.hasBonus ? " · 挂着奖励" : ""}
            </div>
          ))}
        </div>
      ) : null}
      {p.missing.length ? (
        <details style={box}>
          <summary>台账有、Google 上没有 {p.missing.length} 条（不会删——可能是客人删了评价，或者当初记重了）</summary>
          {p.missing.map((r) => (
            <div key={r.id} style={{ marginTop: 3 }}>
              {who(r.reviewer)} · {line(r.date, r.snippet)}
              {r.hasBonus ? "（挂着奖励）" : ""}
            </div>
          ))}
        </details>
      ) : null}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <button type="button" className="btn btn-primary btn-sm" disabled={!!busy} onClick={onApply}>
          {busy === "apply" ? "写入中…" : nothing ? "确认（只更新回复状态）" : "没问题，写入台账"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={onCancel}>
          先不写
        </button>
      </div>
    </div>
  )
}
