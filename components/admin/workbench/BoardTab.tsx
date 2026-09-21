"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { adminJson } from "./api"
import { Chip } from "./ui"
import { addDays, daysBetween, digits10, dowZh, isTestLead, md, money, money0, monthStartOf, num, pct, ptDateOf, ptToday, weekSundayOf, type LeadRow, type OrderRow } from "./helpers"
import { channelLabel, type ChannelScore } from "@/lib/channels"
import type { WorkbenchSettings } from "@/lib/workbench-settings-shared"

// 看板 · 老板：广告花费 → 展示 → 点击 → 留资 → 成单，按"从某天起"对比之前
// 等长的一段。Numbers come from /api/admin/channels (the
// channel_scorecard_daily view: spend, leads and deposits on one Pacific
// date basis), campaign rows from /api/admin/ad-spend, and the owner's
// weekly 口径 (Sun–Sat PT, leads with ≥ N guests, first-response median)
// is computed from the lead list on top.

type DailyRow = { date: string; channel: string; cost_cents: number; clicks: number; impressions: number; leads: number; leads_qualified: number; deposits: number; revenue_cents: number }
type ChannelsResp = { ok: boolean; from: string; to: string; channels: ChannelScore[]; blended: { costCents: number; deposits: number; leads: number; revenueCents: number; blendedCpaCents: number | null; paidCpaCents: number | null; freeDeposits: number; targetCpaCents: number; ultimateCpaCents: number }; daily: DailyRow[]; unresolvedOrders: number }
type SpendRow = { id: string; channel: string; campaign_id: string | null; campaign_name: string | null; ad_group_name: string | null; date: string; impressions: number | null; clicks: number | null; cost_cents: number | null; updated_at: string | null; source: string | null }

type Tot = { cost: number; impr: number; clicks: number; leads: number; won: number; revenue: number }
const zero = (): Tot => ({ cost: 0, impr: 0, clicks: 0, leads: 0, won: 0, revenue: 0 })
const addRow = (t: Tot, r: DailyRow) => {
  t.cost += r.cost_cents
  t.impr += r.impressions
  t.clicks += r.clicks
  t.leads += r.leads
  t.won += r.deposits
  t.revenue += r.revenue_cents
}

function delta(a: number, b: number, lowerGood: boolean): { text: string; color: string } {
  if (!b) return { text: "—", color: "var(--color-neutral-600)" }
  const r = ((a - b) / b) * 100
  const good = lowerGood ? r <= 0 : r >= 0
  return { text: `${r >= 0 ? "▲" : "▼"} ${Math.abs(r).toFixed(0)}%`, color: good ? "var(--color-text)" : "var(--color-accent-700)" }
}

export function BoardTab({
  adminKey,
  settings,
  leads,
  orders,
  isMobile,
  viewerRole,
  onGoLeads,
  onGoOrders,
}: {
  adminKey: string
  settings: WorkbenchSettings
  leads: LeadRow[]
  orders: OrderRow[]
  isMobile: boolean
  viewerRole: "owner" | "agent" | null
  onGoLeads: (since: string) => void
  onGoOrders: () => void
}) {
  const today = ptToday()
  const weekStart = weekSundayOf(today)
  const [since, setSince] = useState(weekStart)
  const [cur, setCur] = useState<ChannelsResp | null>(null)
  const [prev, setPrev] = useState<ChannelsResp | null>(null)
  const [spend, setSpend] = useState<SpendRow[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const span = daysBetween(since, today)
  const prevFrom = addDays(since, -span)
  const prevTo = addDays(since, -1)

  const load = useCallback(async () => {
    setLoading(true)
    setMsg(null)
    try {
      const [a, b, s] = await Promise.all([
        adminJson<ChannelsResp>(adminKey, `/api/admin/channels?from=${since}&to=${today}`),
        adminJson<ChannelsResp>(adminKey, `/api/admin/channels?from=${prevFrom}&to=${prevTo}`),
        adminJson<{ ok: boolean; rows: SpendRow[] }>(adminKey, `/api/admin/ad-spend?from=${since}&to=${today}`),
      ])
      setCur(a)
      setPrev(b)
      setSpend(Array.isArray(s.rows) ? s.rows : [])
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "读取失败")
    } finally {
      setLoading(false)
    }
  }, [adminKey, since, today, prevFrom, prevTo])

  useEffect(() => {
    void load()
  }, [load])

  const curT = useMemo(() => {
    const t = zero()
    for (const r of cur?.daily ?? []) addRow(t, r)
    return t
  }, [cur])
  const prevT = useMemo(() => {
    const t = zero()
    for (const r of prev?.daily ?? []) addRow(t, r)
    return t
  }, [prev])

  const target = settings.targets.cpa_target_cents
  const cpa = (t: Tot) => (t.won > 0 && t.cost > 0 ? t.cost / t.won : null)
  const cpl = (t: Tot) => (t.leads > 0 && t.cost > 0 ? t.cost / t.leads : null)

  // Owner's weekly 口径 on top of the view: viable leads, ads leads, first response.
  const inWindow = useMemo(() => leads.filter((l) => !isTestLead(l) && l.lead_channel !== "sms" && l.status !== "disqualified" && ptDateOf(l.created_at) >= since), [leads, since])
  const viable = inWindow.filter((l) => (l.guest_count ?? 0) >= settings.targets.lead_min_guests)
  const adsLeads = inWindow.filter((l) => !!l.gclid)
  const lags = inWindow.filter((l) => l.response_seconds !== null).map((l) => (l.response_seconds ?? 0) / 60).sort((a, b) => a - b)
  const medianResp = lags.length ? lags[Math.floor(lags.length / 2)] : null
  const depositsWindow = orders.filter((o) => o.deposit_status === "paid_verified" && ptDateOf(o.created_at) >= since && ((o.source_metadata ?? {}) as Record<string, unknown>).customer_type !== "returning")
  const isWeek = since === weekStart

  const funnel = [
    { label: "累计花费", value: money0(curT.cost), prev: money0(prevT.cost), d: delta(curT.cost, prevT.cost, true), unit: `${money0(curT.cost / span)} / 天`, rate: isWeek ? `上限 ${money0(settings.targets.weekly_spend_cap_cents)}` : "" },
    { label: "展示", value: num(curT.impr), prev: num(prevT.impr), d: delta(curT.impr, prevT.impr, false), unit: `${curT.impr ? money((curT.cost / curT.impr) * 1000) : "–"} CPM`, rate: `CTR ${pct(curT.clicks, curT.impr)}` },
    { label: "点击", value: num(curT.clicks), prev: num(prevT.clicks), d: delta(curT.clicks, prevT.clicks, false), unit: `${curT.clicks ? money(curT.cost / curT.clicks) : "–"} CPC`, rate: `留资率 ${pct(curT.leads, curT.clicks)}` },
    { label: "留资", value: num(curT.leads), prev: num(prevT.leads), d: delta(curT.leads, prevT.leads, false), unit: `${cpl(curT) ? money0(cpl(curT)!) : "–"} CPL`, rate: `有效(≥${settings.targets.lead_min_guests}人) ${viable.length} · 广告 ${adsLeads.length}`, go: () => onGoLeads(since) },
    {
      label: "成单 · 成本",
      value: num(curT.won),
      prev: num(prevT.won),
      d: delta(curT.won, prevT.won, false),
      unit: `${cpa(curT) ? money0(cpa(curT)!) : "–"} CPA · 目标 ≤ ${money0(target)}`,
      rate: isWeek ? `本周目标 ≥ ${settings.targets.weekly_deposit_target} 单 · 每单 > ${money0(settings.targets.weekly_cost_per_order_stop_cents)} 就停` : cpa(prevT) ? `之前 ${money0(cpa(prevT)!)}` : "",
      hot: (cpa(curT) ?? 0) > target,
      bg: "var(--color-surface)",
      go: onGoOrders,
    },
  ]

  const prevByChannel = new Map((prev?.channels ?? []).map((c) => [c.channel, c]))
  const channels = (cur?.channels ?? []).filter((c) => c.costCents > 0 || c.leads > 0 || c.deposits > 0)

  // Campaign table from raw spend rows; leads matched by utm_campaign (id or name).
  const campaigns = useMemo(() => {
    const m = new Map<string, { name: string; channel: string; impr: number; clicks: number; cost: number; ids: Set<string> }>()
    for (const r of spend) {
      const key = r.campaign_name ?? r.campaign_id ?? "(未命名)"
      const c = m.get(key) ?? { name: key, channel: r.channel, impr: 0, clicks: 0, cost: 0, ids: new Set<string>() }
      c.impr += r.impressions ?? 0
      c.clicks += r.clicks ?? 0
      c.cost += r.cost_cents ?? 0
      if (r.campaign_id) c.ids.add(r.campaign_id)
      if (r.campaign_name) c.ids.add(r.campaign_name.toLowerCase())
      m.set(key, c)
    }
    const depositPhones = new Set(depositsWindow.map((o) => digits10(o.customer_phone)).filter(Boolean))
    return Array.from(m.values())
      .map((c) => {
        const ls = inWindow.filter((l) => l.utm_campaign && (c.ids.has(l.utm_campaign) || c.ids.has(l.utm_campaign.toLowerCase())))
        const won = ls.filter((l) => depositPhones.has(digits10(l.phone))).length
        return { ...c, leads: ls.length, won }
      })
      .sort((a, b) => b.cost - a.cost)
  }, [spend, inWindow, depositsWindow])
  const lastSync = spend.reduce<string | null>((a, r) => (r.source === "api" && r.updated_at && (!a || r.updated_at > a) ? r.updated_at : a), null)

  // Daily list: up to 7 days before `since`, then everything after.
  const daily = useMemo(() => {
    const map: Record<string, Tot> = {}
    for (const r of [...(prev?.daily ?? []), ...(cur?.daily ?? [])]) addRow((map[r.date] = map[r.date] ?? zero()), r)
    const from = addDays(since, -Math.min(7, span))
    const out: Array<{ d: string; t: Tot }> = []
    for (let d = from; d <= today; d = addDays(d, 1)) out.push({ d, t: map[d] ?? zero() })
    return out
  }, [prev, cur, since, span, today])
  const maxCost = Math.max(1, ...daily.map((r) => r.t.cost))

  const months = useMemo(() => {
    const m: Record<string, { n: number; quoted: number; paid: number; due: number }> = {}
    for (const o of orders) {
      if (o.order_status === "cancelled") continue
      const k = ptDateOf(o.created_at).slice(0, 7)
      const row = (m[k] = m[k] ?? { n: 0, quoted: 0, paid: 0, due: 0 })
      row.n += 1
      row.quoted += o.quoted_total_cents ?? 0
      row.paid += o.amount_paid_total_cents ?? 0
      row.due += o.balance_due_cents ?? 0
    }
    return Object.entries(m)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 4)
  }, [orders])

  const sync = (action: "sync" | "sweep") =>
    (async () => {
      setBusy(action)
      try {
        if (action === "sync") {
          const days = Math.min(400, Math.max(1, span + 8))
          const d = await adminJson<{ ok: boolean; rows?: number; costCents?: number; error?: string }>(adminKey, `/api/admin/ad-spend?action=sync_google&days=${days}`, { method: "POST", body: {} })
          setMsg(d.ok ? `Google 花费已同步：${d.rows ?? 0} 行 · ${money0(d.costCents ?? 0)}` : `同步失败：${d.error ?? "unknown"}（多半是 OAuth 令牌过期，去 设置 → 数据同步 看说明）`)
        } else {
          const d = await adminJson<{ ok: boolean; resolved?: unknown[]; error?: string }>(adminKey, "/api/admin/channels?action=sweep", { method: "POST", body: {} })
          setMsg(d.ok ? `归因扫描完成：${Array.isArray(d.resolved) ? d.resolved.length : 0} 单` : `扫描失败：${d.error ?? "unknown"}`)
        }
        await load()
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "失败")
      } finally {
        setBusy(null)
      }
    })()

  // On a Sunday "本周" and "今天" are the same day; the week is the owner's unit.
  const rangeLabel = since === weekStart ? `本周（${md(weekStart)} 周日起）` : since === today ? "今天" : since === addDays(today, -6) ? "近 7 天" : since === monthStartOf(today) ? "本月至今" : `${md(since)} 起至今`

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: "0 8px 0 0" }}>广告 · {rangeLabel}</h2>
        <Chip active={since === today} onClick={() => setSince(today)}>
          今天
        </Chip>
        <Chip active={since === weekStart} onClick={() => setSince(weekStart)}>
          本周
        </Chip>
        <Chip active={since === addDays(today, -6)} onClick={() => setSince(addDays(today, -6))}>
          近 7 天
        </Chip>
        <Chip active={since === monthStartOf(today)} onClick={() => setSince(monthStartOf(today))}>
          本月
        </Chip>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginLeft: 4 }}>
          从 <input type="date" className="input" value={since} max={today} onChange={(e) => e.target.value && e.target.value <= today && setSince(e.target.value)} style={{ width: 150, minHeight: 34, padding: "4px 8px" }} /> 起到今天
        </label>
        <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
          对比：之前等长的 {span} 天{loading ? " · 读取中…" : ""}
        </span>
      </div>
      {msg ? <div className="notice">{msg}</div> : null}

      <div className="wb-grid" style={{ gridTemplateColumns: isMobile ? "repeat(2, minmax(0,1fr))" : "repeat(5, minmax(0,1fr))" }}>
        {funnel.map((f) => (
          <div key={f.label} className="wb-cell" style={{ background: f.bg, cursor: f.go ? "pointer" : undefined }} onClick={f.go}>
            <div className="kicker">{f.label}</div>
            <div className="big" style={{ color: f.hot ? "var(--color-accent-700)" : undefined }}>
              {f.value}
            </div>
            <div style={{ fontSize: 12, color: f.d.color }}>
              {f.d.text} <span style={{ color: "var(--color-neutral-600)" }}>之前 {f.prev}</span>
            </div>
            <div style={{ fontSize: 12, borderTop: "1px solid var(--color-line)", paddingTop: 6, marginTop: 2, display: "flex", justifyContent: "space-between", gap: 6, flexWrap: "wrap" }}>
              <strong>{f.unit}</strong>
              <span style={{ color: "var(--color-neutral-700)" }}>{f.rate}</span>
            </div>
          </div>
        ))}
      </div>

      {isWeek ? (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
          <span>
            本周押金 <strong>{depositsWindow.length}</strong> / 目标 {settings.targets.weekly_deposit_target}
          </span>
          <span>
            每单 <strong style={{ color: depositsWindow.length && curT.cost / depositsWindow.length > settings.targets.weekly_cost_per_order_stop_cents ? "var(--color-accent-700)" : undefined }}>{depositsWindow.length ? money0(curT.cost / depositsWindow.length) : "—"}</strong> / 停线 {money0(settings.targets.weekly_cost_per_order_stop_cents)}
          </span>
          <span>
            首响中位 <strong style={{ color: medianResp != null && medianResp > settings.targets.first_response_sla_minutes ? "var(--color-accent-700)" : undefined }}>{medianResp != null ? `${Math.round(medianResp)} 分` : "—"}</strong> / 目标 ≤ {settings.targets.first_response_sla_minutes} 分（{lags.length}/{inWindow.length} 已响应）
          </span>
          <span>
            点击→广告线索 <strong>{pct(adsLeads.length, curT.clicks)}</strong>
          </span>
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 3fr) minmax(0, 2fr)", gap: 28, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, gap: 12 }}>
              <h4>渠道 · 每个环节</h4>
              <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>CPA = 花费 ÷ 押金单 · n&lt;10 别下结论</span>
            </div>
            {!isMobile ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>渠道</th>
                    <th className="r">展示</th>
                    <th className="r">点击</th>
                    <th className="r">CTR</th>
                    <th className="r">留资</th>
                    <th className="r">成单</th>
                    <th className="r">花费</th>
                    <th className="r">CPL</th>
                    <th className="r">CPA</th>
                    <th className="r">之前 CPA</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.map((c) => {
                    const p = prevByChannel.get(c.channel)
                    const hot = (c.cpaCents ?? 0) > target || (c.costCents > 0 && !c.cpaCents)
                    return (
                      <tr key={c.channel} style={{ opacity: c.costCents === 0 && c.deposits === 0 ? 0.5 : 1 }}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{channelLabel(c.channel)}</div>
                          <div style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>{c.group === "paid" ? "付费" : c.group === "referral" ? "转介" : c.group === "organic" ? "自然" : c.group === "direct" ? "直接" : "未归因"}{c.thin ? " · 样本少" : ""}</div>
                        </td>
                        <td className="r">{num(c.impressions)}</td>
                        <td className="r">{num(c.clicks)}</td>
                        <td className="r" style={{ color: "var(--color-neutral-700)" }}>{pct(c.clicks, c.impressions)}</td>
                        <td className="r">{num(c.leads)}</td>
                        <td className="r" style={{ fontWeight: 800 }}>{num(c.deposits)}</td>
                        <td className="r">{money0(c.costCents)}</td>
                        <td className="r" style={{ color: "var(--color-neutral-700)" }}>{c.cplCents ? money0(c.cplCents) : "–"}</td>
                        <td className="r" style={{ fontWeight: 800, color: hot ? "var(--color-accent-700)" : undefined }}>{c.cpaCents ? money0(c.cpaCents) : c.costCents > 0 ? "无成单" : "–"}</td>
                        <td className="r" style={{ color: "var(--color-neutral-600)" }}>{p?.cpaCents ? money0(p.cpaCents) : "–"}</td>
                      </tr>
                    )
                  })}
                  <tr className="total">
                    <td>合计</td>
                    <td className="r">{num(curT.impr)}</td>
                    <td className="r">{num(curT.clicks)}</td>
                    <td className="r" style={{ fontWeight: 400 }}>{pct(curT.clicks, curT.impr)}</td>
                    <td className="r">{num(curT.leads)}</td>
                    <td className="r">{num(curT.won)}</td>
                    <td className="r">{money0(curT.cost)}</td>
                    <td className="r" style={{ fontWeight: 400 }}>{cpl(curT) ? money0(cpl(curT)!) : "–"}</td>
                    <td className="r" style={{ color: (cpa(curT) ?? 0) > target ? "var(--color-accent-700)" : undefined }}>{cpa(curT) ? money0(cpa(curT)!) : "–"}</td>
                    <td className="r" style={{ fontWeight: 400, color: "var(--color-neutral-600)" }}>{cpa(prevT) ? money0(cpa(prevT)!) : "–"}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <div className="wb-list">
                {channels.map((c) => (
                  <div key={c.channel} className="wb-line">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontWeight: 600 }}>{channelLabel(c.channel)}</div>
                      <div style={{ fontWeight: 800, color: (c.cpaCents ?? 0) > target ? "var(--color-accent-700)" : undefined }}>CPA {c.cpaCents ? money0(c.cpaCents) : "–"}</div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6, fontSize: 12, marginTop: 8 }}>
                      {[
                        ["花费", money0(c.costCents)],
                        ["展示", num(c.impressions)],
                        ["点击", num(c.clicks)],
                        ["留资", num(c.leads)],
                        ["成单", num(c.deposits)],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <div style={{ color: "var(--color-neutral-600)", fontSize: 10 }}>{k}</div>
                          {v}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {campaigns.length > 0 ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, gap: 12 }}>
                <h4>广告系列 · 花费</h4>
                <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>留资按 utm_campaign 对上的算 · {lastSync ? `Google 最近同步 ${ptDateOf(lastSync)}` : "未同步过"}</span>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th>系列</th>
                    <th className="r">展示</th>
                    <th className="r">点击</th>
                    <th className="r">CTR</th>
                    <th className="r">CPC</th>
                    <th className="r">花费</th>
                    <th className="r">留资</th>
                    <th className="r">成单</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.name} style={{ opacity: c.cost === 0 ? 0.5 : 1 }}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>{channelLabel(c.channel)}</div>
                      </td>
                      <td className="r">{num(c.impr)}</td>
                      <td className="r">{num(c.clicks)}</td>
                      <td className="r">{pct(c.clicks, c.impr)}</td>
                      <td className="r">{c.clicks ? money(c.cost / c.clicks) : "–"}</td>
                      <td className="r">{money0(c.cost)}</td>
                      <td className="r">{c.leads || "–"}</td>
                      <td className="r" style={{ fontWeight: 800 }}>{c.won || "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, gap: 12 }}>
              <h4>按天 · {md(since)} 之后有什么变化</h4>
              <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>条 = 花费</span>
            </div>
            <div className="wb-list">
              {daily.map(({ d, t }) => {
                const after = d >= since
                return (
                  <div key={d} style={{ display: "grid", gridTemplateColumns: "70px 1fr 120px", gap: 10, alignItems: "center", padding: "6px 0 6px 8px", borderBottom: "1px solid var(--color-line)", borderLeft: `3px solid ${d === since ? "var(--color-accent)" : "transparent"}`, background: after ? "var(--color-surface)" : "transparent" }}>
                    <div style={{ fontSize: 12, fontWeight: after ? 600 : 400 }}>
                      {md(d)} <span style={{ color: "var(--color-neutral-600)", fontWeight: 400 }}>{dowZh(d).slice(1)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ height: 12, background: after ? "var(--color-text)" : "var(--color-neutral-300)", width: `${Math.max(2, (t.cost / maxCost) * 100)}%` }} />
                      <span style={{ fontSize: 11, color: "var(--color-neutral-700)" }}>{money0(t.cost)}</span>
                    </div>
                    <div style={{ fontSize: 12, textAlign: "right", whiteSpace: "nowrap" }}>
                      <span style={{ color: "var(--color-neutral-600)" }}>{t.leads} 留资</span> · <strong>{t.won} 单</strong>
                    </div>
                  </div>
                )
              })}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", marginTop: 14, borderTop: "2px solid var(--color-divider)" }}>
                <div style={{ padding: "10px 12px 10px 0", borderRight: "2px solid var(--color-divider)" }}>
                  <div className="kicker">{md(since)} 之前 · 日均</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    {money0(prevT.cost / span)} · {(prevT.leads / span).toFixed(1)} 留资 · {(prevT.won / span).toFixed(1)} 单
                  </div>
                  <div className="num" style={{ fontSize: 22, marginTop: 2 }}>
                    CPA {cpa(prevT) ? money0(cpa(prevT)!) : "–"}
                  </div>
                </div>
                <div style={{ padding: "10px 0 10px 12px", background: "var(--color-surface)" }}>
                  <div className="kicker">之后 · 日均</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    {money0(curT.cost / span)} · {(curT.leads / span).toFixed(1)} 留资 · {(curT.won / span).toFixed(1)} 单
                  </div>
                  <div className="num" style={{ fontSize: 22, marginTop: 2, color: (cpa(curT) ?? 0) > target ? "var(--color-accent-700)" : undefined }}>
                    CPA {cpa(curT) ? money0(cpa(curT)!) : "–"}{" "}
                    {cpa(curT) && cpa(prevT) ? <span style={{ fontSize: 13, fontWeight: 600 }}>{delta(cpa(curT)!, cpa(prevT)!, true).text}</span> : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, gap: 12 }}>
              <h4>月度 · 按下单月</h4>
              <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>洛杉矶时间切月 · 不含已取消</span>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>月</th>
                  <th className="r">单数</th>
                  <th className="r">合同额</th>
                  <th className="r">已收</th>
                  <th className="r">待收</th>
                </tr>
              </thead>
              <tbody>
                {months.map(([k, r]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td className="r">{r.n}</td>
                    <td className="r">{money0(r.quoted)}</td>
                    <td className="r">{money0(r.paid)}</td>
                    <td className="r">{money0(r.due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", fontSize: 12, color: "var(--color-neutral-600)" }}>
            <span>数据：</span>
            <button type="button" className="wb-chip wb-chip-sm" disabled={!!busy} onClick={() => void sync("sync")} title={viewerRole === "owner" ? undefined : "坐席也可以点：只是把 Google 的花费拉进来"}>
              {busy === "sync" ? "同步中…" : `同步 Google 花费${lastSync ? "" : " · 未同步过"}`}
            </button>
            <button type="button" className="wb-chip wb-chip-sm" disabled={!!busy} onClick={() => void sync("sweep")}>
              {busy === "sweep" ? "扫描中…" : `归因扫描${cur?.unresolvedOrders ? ` (${cur.unresolvedOrders} 单未归因)` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
