"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CHANNEL_LABELS, GROUP_LABELS, PAID_CHANNELS, channelLabel, type ChannelGroup, type ChannelScore } from "@/lib/channels"

// 渠道计分板:Google / ChatGPT / Meta / Yelp 同一口径并排。花费来自
// ad_spend_daily(Google 走 API 同步,其余 CSV/手填),线索与成交来自
// Supabase 真相表,分类由数据库里的 rh_resolve_channel 统一决定。
// 综合 CPA = 全部付费花费 ÷ 全渠道付订金成交,就是决策日志的北极星。

type Blended = {
  costCents: number
  deposits: number
  leads: number
  revenueCents: number
  blendedCpaCents: number | null
  paidCpaCents: number | null
  freeDeposits: number
  targetCpaCents: number
  ultimateCpaCents: number
}

type DailyRow = { date: string; channel: string; channel_group: ChannelGroup; cost_cents: number; clicks: number; leads: number; deposits: number; revenue_cents: number }

type SpendRow = {
  id: string
  channel: string
  campaign_name: string | null
  ad_group_name: string | null
  date: string
  impressions: number
  clicks: number
  cost_cents: number
  platform_conversions: number
  source: string
  note: string | null
  created_by: string | null
}

const inputStyle: React.CSSProperties = { padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13.5, boxSizing: "border-box", width: "100%" }
const labelStyle: React.CSSProperties = { fontSize: 12, color: "#6b7280", margin: "10px 0 4px", fontWeight: 600 }
const btnStyle: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "1px solid #111827", background: "#111827", color: "#fff", fontSize: 13.5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }
const btnGhost: React.CSSProperties = { ...btnStyle, background: "#fff", color: "#111827", border: "1px solid #d1d5db" }
const card: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff" }
const th: React.CSSProperties = { padding: "6px 8px", fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }
const td: React.CSSProperties = { padding: "7px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }

const money = (cents: number | null | undefined, digits = 0) =>
  cents === null || cents === undefined ? "—" : `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(0)}%`)

function ptDate(offsetDays: number): string {
  return new Date(Date.now() - offsetDays * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })
}

// Tiny CSV reader: quoted fields, CRLF, BOM. Enough for an Ads Manager export.
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  const src = text.replace(/^﻿/, "")
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += c
    } else if (c === '"') quoted = true
    else if (c === ",") {
      row.push(cell)
      cell = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++
      row.push(cell)
      if (row.some((x) => x.trim() !== "")) rows.push(row)
      row = []
      cell = ""
    } else cell += c
  }
  row.push(cell)
  if (row.some((x) => x.trim() !== "")) rows.push(row)
  return rows
}

function pickHeader(headers: string[], candidates: string[]): number {
  const norm = headers.map((h) => h.trim().toLowerCase())
  for (const c of candidates) {
    const i = norm.findIndex((h) => h === c || h.includes(c))
    if (i >= 0) return i
  }
  return -1
}

function toIsoDate(raw: string): string | null {
  const t = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10)
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(t)
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`
  }
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-CA", { timeZone: "UTC" })
}

const numeric = (raw: string | undefined) => Number((raw ?? "").replace(/[^0-9.\-]/g, "")) || 0

export default function ChannelsWorkbench() {
  const [adminKey, setAdminKey] = useState("")
  const [keyInput, setKeyInput] = useState("")
  const [authFailed, setAuthFailed] = useState(false)
  const [from, setFrom] = useState(() => ptDate(13))
  const [to, setTo] = useState(() => ptDate(0))
  const [loading, setLoading] = useState(false)
  const [channels, setChannels] = useState<ChannelScore[]>([])
  const [blended, setBlended] = useState<Blended | null>(null)
  const [daily, setDaily] = useState<DailyRow[]>([])
  const [unresolved, setUnresolved] = useState(0)
  const [spendRows, setSpendRows] = useState<SpendRow[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  // manual entry
  const [mChannel, setMChannel] = useState("chatgpt_ads")
  const [mDate, setMDate] = useState(() => ptDate(1))
  const [mCampaign, setMCampaign] = useState("")
  const [mCost, setMCost] = useState("")
  const [mClicks, setMClicks] = useState("")
  const [mImpr, setMImpr] = useState("")
  const [mNote, setMNote] = useState("")
  // csv
  const [csvChannel, setCsvChannel] = useState("chatgpt_ads")
  const [csvPreview, setCsvPreview] = useState<{ rows: Array<Record<string, unknown>>; skipped: number; headers: string[] } | null>(null)

  useEffect(() => {
    document.title = "渠道计分板 — Real Hibachi"
    try {
      const params = new URLSearchParams(window.location.search)
      const fromUrl = params.get("key")?.trim()
      if (fromUrl) {
        window.localStorage.setItem("rh_admin_key", fromUrl)
        window.history.replaceState(null, "", window.location.pathname)
        setAdminKey(fromUrl)
        return
      }
      const saved = window.localStorage.getItem("rh_admin_key")
      if (saved) setAdminKey(saved)
    } catch {}
  }, [])

  const headers = useMemo(() => ({ "x-admin-key": adminKey, "Content-Type": "application/json" }), [adminKey])

  const load = useCallback(async () => {
    if (!adminKey) return
    setLoading(true)
    try {
      const [scoreRes, spendRes] = await Promise.all([
        fetch(`/api/admin/channels?from=${from}&to=${to}`, { headers, cache: "no-store" }),
        fetch(`/api/admin/ad-spend?from=${from}&to=${to}`, { headers, cache: "no-store" }),
      ])
      if (scoreRes.status === 401) {
        setAuthFailed(true)
        setAdminKey("")
        try {
          window.localStorage.removeItem("rh_admin_key")
        } catch {}
        return
      }
      const score = await scoreRes.json()
      const spend = await spendRes.json()
      if (score.ok) {
        setChannels(score.channels ?? [])
        setBlended(score.blended ?? null)
        setDaily(score.daily ?? [])
        setUnresolved(score.unresolvedOrders ?? 0)
      } else setMessage(`✖ ${score.error}`)
      if (spend.ok) setSpendRows(spend.rows ?? [])
      setAuthFailed(false)
    } catch (e) {
      setMessage(`✖ ${e instanceof Error ? e.message : "load failed"}`)
    } finally {
      setLoading(false)
    }
  }, [adminKey, from, to, headers])

  useEffect(() => {
    void load()
  }, [load])

  const act = async (label: string, fn: () => Promise<Response>) => {
    setBusy(label)
    setMessage(null)
    try {
      const res = await fn()
      const p = await res.json().catch(() => null)
      if (!res.ok || !p?.ok) throw new Error(p?.error || `${res.status}`)
      return p
    } catch (e) {
      setMessage(`✖ ${label}: ${e instanceof Error ? e.message : "failed"}`)
      return null
    } finally {
      setBusy(null)
    }
  }

  const syncGoogle = async () => {
    const days = Math.max(1, Math.ceil((Date.parse(to) - Date.parse(from)) / 86400000) + 1)
    const p = await act("同步 Google", () => fetch(`/api/admin/ad-spend?action=sync_google&days=${Math.min(400, days + 1)}`, { method: "POST", headers }))
    if (p) {
      setMessage(`✔ Google Ads 同步 ${p.rows} 行(${p.from} ~ ${p.to}),合计 ${money(p.costCents, 2)}`)
      void load()
    }
  }

  const sweep = async () => {
    const p = await act("归因扫描", () => fetch(`/api/admin/channels?action=sweep`, { method: "POST", headers }))
    if (p) {
      const list: Array<{ order_no: string; customer_name: string; channel: string }> = p.resolved ?? []
      setMessage(list.length ? `✔ 归因 ${list.length} 单:${list.map((r) => `${r.customer_name} → ${channelLabel(r.channel)}`).join(";")}` : "✔ 没有待归因的订单")
      void load()
    }
  }

  const submitManual = async () => {
    const cost = Number(mCost)
    if (!Number.isFinite(cost) || cost < 0) return setMessage("✖ 花费要是数字")
    const p = await act("录入花费", () =>
      fetch("/api/admin/ad-spend", {
        method: "POST",
        headers,
        body: JSON.stringify({
          rows: [
            {
              channel: mChannel,
              date: mDate,
              campaignId: mCampaign.trim() ? mCampaign.trim().toLowerCase().replace(/\s+/g, "_") : "",
              campaignName: mCampaign.trim() || null,
              costCents: Math.round(cost * 100),
              clicks: numeric(mClicks),
              impressions: numeric(mImpr),
              source: "manual",
              note: mNote.trim() || null,
            },
          ],
        }),
      }),
    )
    if (p) {
      setMessage(`✔ 已录入 ${channelLabel(mChannel)} ${mDate} ${money(Math.round(cost * 100), 2)}`)
      setMCost("")
      setMClicks("")
      setMImpr("")
      setMNote("")
      void load()
    }
  }

  const onCsvFile = async (file: File) => {
    const text = await file.text()
    const table = parseCsv(text)
    if (table.length < 2) return setMessage("✖ CSV 没有数据行")
    const head = table[0]
    const iDate = pickHeader(head, ["date", "day", "日期"])
    const iCamp = pickHeader(head, ["campaign name", "campaign", "广告系列"])
    const iGroup = pickHeader(head, ["ad group", "adgroup", "ad set", "广告组"])
    const iCost = pickHeader(head, ["spend", "cost", "amount spent", "花费"])
    const iClicks = pickHeader(head, ["clicks", "点击"])
    const iImpr = pickHeader(head, ["impressions", "impr", "展示"])
    const iConv = pickHeader(head, ["conversions", "results", "转化"])
    if (iDate < 0 || iCost < 0) return setMessage(`✖ CSV 需要 date 和 spend/cost 两列;识别到的表头:${head.join(" | ")}`)
    let skipped = 0
    const rows = table.slice(1).flatMap((r) => {
      const date = toIsoDate(r[iDate] ?? "")
      if (!date) {
        skipped++
        return []
      }
      const campaignName = iCamp >= 0 ? (r[iCamp] ?? "").trim() : ""
      const adGroupName = iGroup >= 0 ? (r[iGroup] ?? "").trim() : ""
      return [
        {
          channel: csvChannel,
          date,
          campaignId: campaignName.toLowerCase().replace(/\s+/g, "_"),
          campaignName: campaignName || null,
          adGroupId: adGroupName.toLowerCase().replace(/\s+/g, "_"),
          adGroupName: adGroupName || null,
          costCents: Math.round(numeric(r[iCost]) * 100),
          clicks: iClicks >= 0 ? numeric(r[iClicks]) : 0,
          impressions: iImpr >= 0 ? numeric(r[iImpr]) : 0,
          platformConversions: iConv >= 0 ? numeric(r[iConv]) : 0,
          source: "csv",
          note: `csv:${file.name}`,
        },
      ]
    })
    setCsvPreview({ rows, skipped, headers: head })
  }

  const submitCsv = async () => {
    if (!csvPreview) return
    const p = await act("导入 CSV", () => fetch("/api/admin/ad-spend", { method: "POST", headers, body: JSON.stringify({ rows: csvPreview.rows }) }))
    if (p) {
      setMessage(`✔ 导入 ${p.rows} 行,合计 ${money(p.costCents, 2)}${p.skipped?.length ? `;跳过 ${p.skipped.length} 行` : ""}`)
      setCsvPreview(null)
      void load()
    }
  }

  const deleteRow = async (id: string) => {
    const p = await act("删除", () => fetch(`/api/admin/ad-spend?id=${id}`, { method: "DELETE", headers }))
    if (p) void load()
  }

  const dailyPaid = useMemo(() => {
    const m = new Map<string, { cost: number; deposits: number; leads: number }>()
    for (const r of daily) {
      const acc = m.get(r.date) ?? { cost: 0, deposits: 0, leads: 0 }
      acc.cost += Number(r.cost_cents)
      acc.deposits += Number(r.deposits)
      acc.leads += Number(r.leads)
      m.set(r.date, acc)
    }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
  }, [daily])
  const peakCost = Math.max(1, ...dailyPaid.map(([, v]) => v.cost))

  if (!adminKey) {
    return (
      <div style={{ maxWidth: 360, margin: "120px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h2 style={{ margin: "0 0 8px" }}>渠道计分板</h2>
        {authFailed && <p style={{ color: "#b91c1c", fontSize: 13 }}>密钥不对,再试一次。</p>}
        <input style={inputStyle} type="password" placeholder="管理密钥" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setAdminKey(keyInput.trim())} />
        <button style={{ ...btnStyle, marginTop: 10, width: "100%" }} onClick={() => setAdminKey(keyInput.trim())}>进入</button>
      </div>
    )
  }

  const target = blended?.targetCpaCents ?? 15000
  const cpaTone = (v: number | null) => (v === null ? "#6b7280" : v <= (blended?.ultimateCpaCents ?? 8000) ? "#047857" : v <= target ? "#0f766e" : "#b91c1c")

  return (
    <div style={{ padding: "18px 20px 80px", fontFamily: "system-ui, sans-serif", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>渠道计分板</h1>
          <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 4 }}>同一口径:成交 = 付了订金(paid_verified);综合 CPA = 全部付费花费 ÷ 全渠道成交;n&lt;10 不下结论。</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {[
            ["7天", 6],
            ["14天", 13],
            ["30天", 29],
            ["90天", 89],
          ].map(([label, d]) => (
            <button key={label as string} style={btnGhost} onClick={() => { setFrom(ptDate(d as number)); setTo(ptDate(0)) }}>{label}</button>
          ))}
          <input style={{ ...inputStyle, width: 140 }} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span style={{ color: "#9ca3af" }}>→</span>
          <input style={{ ...inputStyle, width: 140 }} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <button style={btnGhost} onClick={() => void load()} disabled={loading}>{loading ? "…" : "刷新"}</button>
        </div>
      </div>

      {message && (
        <div style={{ marginTop: 12, borderRadius: 8, border: `1px solid ${message.startsWith("✔") ? "#a7f3d0" : "#fecaca"}`, background: message.startsWith("✔") ? "#ecfdf5" : "#fef2f2", padding: "9px 12px", fontSize: 13 }}>{message}</div>
      )}

      {/* 北极星 */}
      {blended && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginTop: 16 }}>
          {[
            { k: "综合 CPA", v: money(blended.blendedCpaCents), sub: `目标 ≤ ${money(target)} · 终极 ${money(blended.ultimateCpaCents)}`, tone: cpaTone(blended.blendedCpaCents) },
            { k: "广告归因 CPA", v: money(blended.paidCpaCents), sub: "只算付费渠道成交", tone: cpaTone(blended.paidCpaCents) },
            { k: "付费花费", v: money(blended.costCents), sub: `${from} ~ ${to}` },
            { k: "成交(全渠道)", v: String(blended.deposits), sub: `其中免费渠道 ${blended.freeDeposits}` },
            { k: "线索", v: String(blended.leads), sub: blended.leads ? `线索→成交 ${pct(blended.deposits / blended.leads)}` : "" },
            { k: "合同额", v: money(blended.revenueCents), sub: blended.costCents ? `ROAS ${(blended.revenueCents / blended.costCents).toFixed(1)}x` : "" },
          ].map((c) => (
            <div key={c.k} style={card}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{c.k}</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: c.tone ?? "#111827", fontVariantNumeric: "tabular-nums" }}>{c.v}</div>
              {c.sub && <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 2 }}>{c.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {/* 计分板 */}
      <div style={{ ...card, marginTop: 16, overflowX: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <strong style={{ fontSize: 14 }}>按渠道</strong>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {unresolved > 0 && <span style={{ fontSize: 12, color: "#b45309" }}>{unresolved} 单未归因</span>}
            <button style={btnGhost} onClick={sweep} disabled={busy !== null}>{busy === "归因扫描" ? "扫描中…" : "归因扫描"}</button>
            <button style={btnGhost} onClick={syncGoogle} disabled={busy !== null}>{busy === "同步 Google" ? "同步中…" : "同步 Google 花费"}</button>
          </div>
        </div>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13, minWidth: 900 }}>
          <thead>
            <tr style={{ color: "#6b7280", fontSize: 12 }}>
              <th style={{ ...th, textAlign: "left" }}>渠道</th>
              <th style={th}>花费</th>
              <th style={th}>点击</th>
              <th style={th}>CPC</th>
              <th style={th}>线索</th>
              <th style={th}>CPL</th>
              <th style={th}>成交</th>
              <th style={th}>CPA</th>
              <th style={th}>线索→成交</th>
              <th style={th}>合同额</th>
              <th style={th}>ROAS</th>
            </tr>
          </thead>
          <tbody>
            {channels.length === 0 && (
              <tr><td colSpan={11} style={{ padding: 16, color: "#6b7280", textAlign: "center" }}>{loading ? "加载中…" : "这个区间没有数据"}</td></tr>
            )}
            {channels.map((c, i) => {
              const newGroup = i === 0 || channels[i - 1].group !== c.group
              return (
                <tr key={c.channel} style={{ borderTop: newGroup ? "2px solid #e5e7eb" : "1px solid #f3f4f6" }}>
                  <td style={{ ...td, textAlign: "left" }}>
                    <span style={{ fontWeight: 600 }}>{channelLabel(c.channel)}</span>
                    <span style={{ marginLeft: 8, fontSize: 11, color: "#6b7280" }}>{GROUP_LABELS[c.group]}</span>
                    {c.thin && <span style={{ marginLeft: 8, fontSize: 10.5, color: "#b45309", border: "1px solid #fcd34d", borderRadius: 999, padding: "1px 6px" }}>n&lt;10</span>}
                  </td>
                  <td style={td}>{c.costCents ? money(c.costCents, 2) : "—"}</td>
                  <td style={td}>{c.clicks || "—"}</td>
                  <td style={td}>{money(c.cpcCents, 2)}</td>
                  <td style={td}>{c.leads || "—"}</td>
                  <td style={td}>{money(c.cplCents)}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{c.deposits || "—"}</td>
                  <td style={{ ...td, color: cpaTone(c.cpaCents), fontWeight: 600 }}>{money(c.cpaCents)}</td>
                  <td style={td}>{pct(c.leadToDepositRate)}</td>
                  <td style={td}>{c.revenueCents ? money(c.revenueCents) : "—"}</td>
                  <td style={td}>{c.costCents && c.revenueCents ? `${(c.revenueCents / c.costCents).toFixed(1)}x` : "—"}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 8 }}>
          付费渠道的"成交"只算能追到点击(gclid / oppref / utm)的单;跨设备或先看后打电话的单会落到"直接/未追踪",所以综合 CPA 才是判定口径。平台自报的转化数不进这张表。
        </div>
      </div>

      {/* 每日 */}
      {dailyPaid.length > 0 && (
        <div style={{ ...card, marginTop: 16 }}>
          <strong style={{ fontSize: 14 }}>每日:付费花费 vs 全渠道成交</strong>
          <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 90, marginTop: 12 }}>
            {dailyPaid.map(([d, v]) => (
              <div key={d} title={`${d}\n花费 ${money(v.cost, 2)}\n线索 ${v.leads}\n成交 ${v.deposits}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <div style={{ fontSize: 10, color: v.deposits ? "#047857" : "transparent", fontWeight: 700 }}>{v.deposits ? `+${v.deposits}` : "0"}</div>
                <div style={{ width: "100%", height: Math.max(2, Math.round((v.cost / peakCost) * 60)), background: v.deposits ? "#0f766e" : "#cbd5e1", borderRadius: 2 }} />
                <div style={{ fontSize: 9, color: "#9ca3af" }}>{d.slice(5)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 花费录入 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginTop: 16 }}>
        <div style={card}>
          <strong style={{ fontSize: 14 }}>手填花费(一天一行)</strong>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>ChatGPT / Meta / Yelp 还没接 API 时用这个;同一渠道 + 日期 + 系列再填一次会覆盖。</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" }}>
            <div>
              <div style={labelStyle}>渠道</div>
              <select style={inputStyle} value={mChannel} onChange={(e) => setMChannel(e.target.value)}>
                {PAID_CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
              </select>
            </div>
            <div>
              <div style={labelStyle}>日期</div>
              <input style={inputStyle} type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={labelStyle}>广告系列(可空)</div>
              <input style={inputStyle} value={mCampaign} onChange={(e) => setMCampaign(e.target.value)} placeholder="e.g. LA hibachi at home" />
            </div>
            <div>
              <div style={labelStyle}>花费 $</div>
              <input style={inputStyle} inputMode="decimal" value={mCost} onChange={(e) => setMCost(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <div style={labelStyle}>点击</div>
              <input style={inputStyle} inputMode="numeric" value={mClicks} onChange={(e) => setMClicks(e.target.value)} placeholder="0" />
            </div>
            <div>
              <div style={labelStyle}>展示</div>
              <input style={inputStyle} inputMode="numeric" value={mImpr} onChange={(e) => setMImpr(e.target.value)} placeholder="0" />
            </div>
            <div>
              <div style={labelStyle}>备注</div>
              <input style={inputStyle} value={mNote} onChange={(e) => setMNote(e.target.value)} />
            </div>
          </div>
          <button style={{ ...btnStyle, marginTop: 12 }} onClick={submitManual} disabled={busy !== null || !mCost}>{busy === "录入花费" ? "保存中…" : "保存"}</button>
        </div>

        <div style={card}>
          <strong style={{ fontSize: 14 }}>导入 CSV(Ads Manager 导出)</strong>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>按表头自动识别 date / campaign / ad group / spend / clicks / impressions / conversions,按日按系列导出即可。</div>
          <div style={labelStyle}>这份 CSV 属于哪个渠道</div>
          <select style={inputStyle} value={csvChannel} onChange={(e) => setCsvChannel(e.target.value)}>
            {PAID_CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
          </select>
          <div style={labelStyle}>文件</div>
          <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && void onCsvFile(e.target.files[0])} />
          {csvPreview && (
            <div style={{ marginTop: 10, fontSize: 12.5 }}>
              <div>识别 {csvPreview.rows.length} 行{csvPreview.skipped ? `,跳过 ${csvPreview.skipped} 行(日期不识别)` : ""},合计 {money(csvPreview.rows.reduce((a, r) => a + Number(r.costCents ?? 0), 0), 2)}</div>
              <div style={{ color: "#6b7280", marginTop: 2 }}>表头:{csvPreview.headers.join(" | ")}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button style={btnStyle} onClick={submitCsv} disabled={busy !== null}>{busy === "导入 CSV" ? "导入中…" : `导入到 ${channelLabel(csvChannel)}`}</button>
                <button style={btnGhost} onClick={() => setCsvPreview(null)}>取消</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 最近花费行 */}
      <div style={{ ...card, marginTop: 16, overflowX: "auto" }}>
        <strong style={{ fontSize: 14 }}>花费明细({spendRows.length} 行)</strong>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5, marginTop: 8, minWidth: 760 }}>
          <thead>
            <tr style={{ color: "#6b7280", fontSize: 11.5 }}>
              <th style={{ ...th, textAlign: "left" }}>日期</th>
              <th style={{ ...th, textAlign: "left" }}>渠道</th>
              <th style={{ ...th, textAlign: "left" }}>系列 / 组</th>
              <th style={th}>花费</th>
              <th style={th}>点击</th>
              <th style={th}>展示</th>
              <th style={th}>平台转化</th>
              <th style={{ ...th, textAlign: "left" }}>来源</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {spendRows.slice(0, 120).map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                <td style={{ ...td, textAlign: "left" }}>{r.date}</td>
                <td style={{ ...td, textAlign: "left" }}>{channelLabel(r.channel)}</td>
                <td style={{ ...td, textAlign: "left", whiteSpace: "normal" }}>{r.campaign_name ?? "—"}{r.ad_group_name ? ` / ${r.ad_group_name}` : ""}</td>
                <td style={td}>{money(r.cost_cents, 2)}</td>
                <td style={td}>{r.clicks}</td>
                <td style={td}>{r.impressions}</td>
                <td style={td}>{Number(r.platform_conversions) || "—"}</td>
                <td style={{ ...td, textAlign: "left", color: "#6b7280" }}>{r.source}{r.created_by ? ` · ${r.created_by}` : ""}{r.note ? ` · ${r.note}` : ""}</td>
                <td style={td}>{r.source !== "api" && <button style={{ ...btnGhost, padding: "3px 8px", fontSize: 11.5 }} onClick={() => void deleteRow(r.id)}>删</button>}</td>
              </tr>
            ))}
            {spendRows.length === 0 && <tr><td colSpan={9} style={{ padding: 12, color: "#6b7280", textAlign: "center" }}>还没有花费记录,点"同步 Google 花费"或手填。</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
