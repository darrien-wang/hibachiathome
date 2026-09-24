"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { adminJson } from "./api"
import { addDays, md, ptToday } from "./helpers"

// 成单趋势 · 七天滚动
//
// 为什么存在：押金是个稀有事件（2026-09 实测 ≈1 单/天）。在这个速率下，即使
// 生意完全稳定，纯随机也会让 38% 的日子是零单——所以"今天没单"几乎不携带
// 信息，盯着它只会徒增焦虑。再加上线索到押金的中位时长是 0.9 天、尾巴拖到
// 10 天，某一天的结果本来就是过去一周线索的混合，不对应那天的努力。
//
// 这个面板把同一批数据画成七天滚动均值（灰柱=每天，黑线=趋势），并用泊松
// 分布把"连续几天零单才值得抬头"算成一条明确的线，让随机空档不再被误读。
// 数据来自 /api/admin/channels 的 daily（channel_scorecard_daily 视图，按 PT
// 日期、全渠道含自然流），与看板其它数字同源。

const FETCH_DAYS = 42 // 多取 7 天用来给第一个滚动点垫底
const SHOW_DAYS = 35

type DailyRow = { date: string; deposits: number }
type Resp = { ok: boolean; daily: DailyRow[] }

/**
 * 连续 k 天零单的概率低于 5% 时，才算值得看一眼。λ=0 时返回 null。
 * 泊松假设速率恒定，而真实数据是聚簇的（周末、档期、天气），2026-09 实测
 * 双单日比泊松预期多、单单日少。所以这里加了 3 天下限，否则速率一高
 * （λ≈1.7 时两天就触发）面板会天天喊狼来了。
 */
function streakThreshold(lambda: number): number | null {
  if (lambda <= 0) return null
  const p0 = Math.exp(-lambda)
  if (p0 >= 1) return null
  for (let k = 1; k <= 30; k++) if (Math.pow(p0, k) < 0.05) return Math.max(3, k)
  return null
}

export function DepositTrend({ adminKey, isMobile }: { adminKey: string; isMobile: boolean }) {
  const today = ptToday()
  const from = addDays(today, -(FETCH_DAYS - 1))
  const [daily, setDaily] = useState<DailyRow[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setErr(null)
    try {
      const r = await adminJson<Resp>(adminKey, `/api/admin/channels?from=${from}&to=${today}`)
      setDaily(Array.isArray(r.daily) ? r.daily : [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : "读取失败")
    }
  }, [adminKey, from, today])

  useEffect(() => {
    void load()
  }, [load])

  const model = useMemo(() => {
    if (!daily) return null
    const byDate = new Map<string, number>()
    for (const r of daily) byDate.set(r.date, (byDate.get(r.date) ?? 0) + (r.deposits ?? 0))
    const days: string[] = []
    for (let d = from; d <= today; d = addDays(d, 1)) days.push(d)
    const counts = days.map((d) => byDate.get(d) ?? 0)
    // 押金入库是 2026-09-01 才开始的，再往前的 0 是"没有数据"不是"没有单"。
    // 窗口开头那一长串连续 0 如果贴着取数起点，就当成数据边界裁掉，否则图上
    // 会出现一段假的死亡期。中途的 0 一律保留，那些是真的。
    const firstReal = counts.findIndex((c) => c > 0)
    const dataStart = firstReal > 7 ? firstReal : 0
    const truncated = dataStart > 0
    const roll = counts.map((_, i) => {
      if (i - dataStart < 6) return null // 不足 7 天不画滚动值，免得开头假陡
      if (i === counts.length - 1) return null // 今天没过完，算进去会把末端拉下来
      const w = counts.slice(i - 6, i + 1)
      return w.reduce((a, b) => a + b, 0) / w.length
    })
    const start = Math.max(dataStart, days.length - SHOW_DAYS)
    // 今天还没过完：早上 9 点的 0 不是"零单日"。滚动均值和连续零单都只数
    // 到昨天为止，今天的柱子照画但标成未完成。
    const last = counts.length - 2
    const lambda = (last >= 0 ? roll[last] : null) ?? 0
    let streak = 0
    for (let i = last; i >= dataStart && counts[i] === 0; i--) streak++
    return {
      days: days.slice(start),
      counts: counts.slice(start),
      roll: roll.slice(start),
      lambda,
      truncated,
      dataFrom: days[dataStart],
      last7: counts.slice(-8, -1).reduce((a, b) => a + b, 0),
      prev7: counts.slice(-15, -8).reduce((a, b) => a + b, 0),
      zeroPct: Math.round(Math.exp(-lambda) * 100),
      threshold: streakThreshold(lambda),
      streak,
    }
  }, [daily, from, today])

  if (err) return <div className="notice">成单趋势读取失败：{err}</div>
  if (!model) return null

  const W = 700
  const H = 130
  const n = model.counts.length
  const maxY = Math.max(3, ...model.counts)
  const step = W / n
  const barW = Math.max(3, step * 0.52)
  const y = (v: number) => H - (v / maxY) * H
  let started = false
  const line = model.roll
    .map((v, i) => {
      if (v == null) return ""
      const cmd = started ? "L" : "M"
      started = true
      return `${cmd}${(i + 0.5) * step},${y(v)}`
    })
    .join(" ")
    .trim()
  const alarming = model.threshold != null && model.streak >= model.threshold
  const trend = model.last7 - model.prev7

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, gap: 12, flexWrap: "wrap" }}>
        <h4 style={{ margin: 0 }}>成单趋势 · 七天滚动</h4>
        <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
          灰柱 = 当天押金单（最右一根是今天，还没过完）· 黑线 = 七天滚动均值，只数到昨天
          {model.truncated ? ` · 押金入库自 ${md(model.dataFrom)} 起` : ""}
        </span>
      </div>

      <div className="wb-grid" style={{ gridTemplateColumns: isMobile ? "repeat(2, minmax(0,1fr))" : "repeat(3, minmax(0,1fr))", marginBottom: 12 }}>
        <div className="wb-cell">
          <div className="kicker">七天滚动</div>
          <div className="big">{model.lambda.toFixed(2)}</div>
          <div style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>单 / 天</div>
        </div>
        <div className="wb-cell">
          <div className="kicker">近 7 天合计</div>
          <div className="big">{model.last7}</div>
          <div style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
            {trend === 0 ? "与上一个 7 天持平" : `${trend > 0 ? "▲" : "▼"} ${Math.abs(trend)} 单 · 上一个 7 天 ${model.prev7}`}
          </div>
        </div>
        <div className="wb-cell" style={{ background: alarming ? "var(--color-surface)" : undefined }}>
          <div className="kicker">当前连续零单</div>
          <div className="big" style={{ color: alarming ? "var(--color-accent-700)" : undefined }}>
            {model.streak} 天
          </div>
          <div style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
            {model.threshold == null ? "样本不足" : alarming ? `已达 ${model.threshold} 天，值得查一下` : `连续 ${model.threshold} 天才值得查`}
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H + 18}`} width="100%" style={{ display: "block", overflow: "visible" }} role="img" aria-label={`近 ${n} 天每日押金单数与七天滚动均值，当前滚动均值每天 ${model.lambda.toFixed(2)} 单`}>
        <line x1={0} y1={H} x2={W} y2={H} stroke="var(--color-line)" strokeWidth={1} />
        {model.counts.map((v, i) => (
          <rect
            key={model.days[i]}
            x={(i + 0.5) * step - barW / 2}
            y={y(v)}
            width={barW}
            height={Math.max(0, H - y(v))}
            fill={i === n - 1 ? "var(--color-neutral-200, var(--color-neutral-300))" : "var(--color-neutral-300)"}
            opacity={i === n - 1 ? 0.55 : 1}
          />
        ))}
        <path d={line} fill="none" stroke="var(--color-text)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {model.days.map((d, i) =>
          d.endsWith("-01") || i === 0 || i === n - 1 ? (
            <text key={`t${d}`} x={(i + 0.5) * step} y={H + 14} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize={11} fill="var(--color-neutral-600)">
              {md(d)}
            </text>
          ) : null,
        )}
      </svg>

      <p style={{ fontSize: 12, color: "var(--color-neutral-700)", marginTop: 10, lineHeight: 1.7 }}>
        按现在 {model.lambda.toFixed(2)} 单/天 的速率，<strong>单独一天零单的概率本来就有 {model.zeroPct}%</strong>，所以某一天没单不说明任何问题。
        {model.threshold != null ? ` 连续 ${model.threshold} 天零单的概率才低于 5%，那时候再查。` : ""} 线索到押金的中位时长是 0.9 天、尾巴拖到 10 天，今天的结果对应的是过去一周的线索，不是今天的努力。
      </p>
    </div>
  )
}
