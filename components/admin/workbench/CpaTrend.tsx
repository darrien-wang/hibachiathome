"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { adminJson } from "./api"
import { buildCpaModel, REF_WEEKS, WEEKS, type CpaDailyRow } from "./cpa-model"
import { addDays, md, money0, ptToday, weekSundayOf } from "./helpers"

// CPA 波动 · 按周
//
// 看板头上那个 CPA 是一个数字；老板想知道它平时抖到什么程度。这件事**不画波动带
// 就会看错**——押金单一周只有几个，单周 CPA 的涨跌大半是运气。算法和理由都在
// ./cpa-model.ts，这里只负责取数和画图。
//
// 数字和看板同源：/api/admin/channels 的 daily（channel_scorecard_daily 视图，
// PT 日期、全渠道），口径和看板头部一样是"全部花费 ÷ 全部押金单"。

type Resp = { ok: boolean; daily: CpaDailyRow[] }

export function CpaTrend({ adminKey, targetCents, isMobile }: { adminKey: string; targetCents: number; isMobile: boolean }) {
  const today = ptToday()
  const thisWeek = weekSundayOf(today)
  const from = addDays(thisWeek, -7 * (WEEKS - 1))
  const [daily, setDaily] = useState<CpaDailyRow[] | null>(null)
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

  const model = useMemo(() => (daily ? buildCpaModel(daily, from, thisWeek) : null), [daily, from, thisWeek])

  if (err) return <div className="notice">CPA 波动读取失败：{err}</div>
  if (!model || model.weeks.length === 0) return null

  const { weeks, refCpa, cur, last, streakOut } = model
  const W = 700
  const H = 130
  const n = weeks.length
  const step = W / n
  const bandW = Math.max(6, step * 0.42)
  const tops = weeks.flatMap((w) => [w.cpa, w.high].filter((v): v is number => v != null))
  const maxY = Math.max(targetCents * 1.5, ...tops, 1)
  const y = (v: number) => H - (Math.min(v, maxY) / maxY) * H

  const hot = streakOut === "above"

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, gap: 12, flexWrap: "wrap" }}>
        <h4 style={{ margin: 0 }}>CPA 波动 · 按周</h4>
        <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
          浅带 = 纯随机就能落到的范围 · 黑点 = 那周真实 CPA · 虚线 = 目标 {money0(targetCents)}（最右一周还没过完）
        </span>
      </div>

      <div className="wb-grid" style={{ gridTemplateColumns: isMobile ? "repeat(2, minmax(0,1fr))" : "repeat(3, minmax(0,1fr))", marginBottom: 12 }}>
        <div className="wb-cell">
          <div className="kicker">近 {REF_WEEKS} 周 CPA</div>
          <div className="big">{refCpa ? money0(refCpa) : "–"}</div>
          <div style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>{model.refDeposits} 单撑着这个数 · 看趋势只看它</div>
        </div>
        <div className="wb-cell">
          <div className="kicker">本周（未过完）</div>
          <div className="big">{cur?.cpa ? money0(cur.cpa) : cur && cur.cost > 0 ? "无成单" : "–"}</div>
          <div style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
            {cur && cur.cost > 0
              ? `${cur.deposits} 单 · 少一单就是 ${model.oneLess ? money0(model.oneLess) : "—"}，多一单 ${model.oneMore ? money0(model.oneMore) : "—"}`
              : "本周还没有花费"}
          </div>
        </div>
        <div className="wb-cell" style={{ background: hot ? "var(--color-surface)" : undefined }}>
          <div className="kicker">上一个完整周</div>
          <div className="big" style={{ color: hot ? "var(--color-accent-700)" : undefined }}>
            {last?.cpa ? money0(last.cpa) : last && last.cost > 0 ? "无成单" : "–"}
          </div>
          <div style={{ fontSize: 12, color: "var(--color-neutral-700)" }}>
            {last == null || last.side === "na"
              ? "样本不足，判不了"
              : streakOut === "above"
                ? "连续两周高出随机范围，值得查"
                : streakOut === "below"
                  ? "连续两周低于随机范围，是真的变好了"
                  : last.side === "in"
                    ? "落在随机范围内 = 看不出变化"
                    : "只有这一周在范围外，还不算数"}
          </div>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H + 18}`}
        width="100%"
        style={{ display: "block", overflow: "visible" }}
        role="img"
        aria-label={`最近 ${n} 周每周 CPA 与随机波动范围，近 ${REF_WEEKS} 周 CPA ${refCpa ? money0(refCpa) : "无"}`}
      >
        <line x1={0} y1={H} x2={W} y2={H} stroke="var(--color-line)" strokeWidth={1} />

        {/* 随机波动带：花费不动，只让成单数按 Poisson 抖一抖，CPA 就能落在这一段里 */}
        {weeks.map((w, i) =>
          w.low != null ? (
            <rect
              key={`b${w.start}`}
              x={(i + 0.5) * step - bandW / 2}
              y={y(w.high ?? maxY)}
              width={bandW}
              height={Math.max(2, y(w.low) - y(w.high ?? maxY))}
              fill="var(--color-neutral-300)"
              opacity={w.partial ? 0.35 : 0.6}
              rx={3}
            />
          ) : null,
        )}

        <line x1={0} y1={y(targetCents)} x2={W} y2={y(targetCents)} stroke="var(--color-neutral-600)" strokeWidth={1} strokeDasharray="4 4" />

        {weeks.map((w, i) =>
          w.cpa != null ? (
            <circle
              key={`d${w.start}`}
              cx={(i + 0.5) * step}
              cy={y(w.cpa)}
              r={w.partial ? 3.5 : 4.5}
              fill={w.side === "above" ? "var(--color-accent-700)" : "var(--color-text)"}
              opacity={w.partial ? 0.5 : 1}
            />
          ) : w.cost > 0 ? (
            // 有花费没成单：CPA 不是一个数，画在顶上提醒它存在
            <text key={`z${w.start}`} x={(i + 0.5) * step} y={10} textAnchor="middle" fontSize={10} fill="var(--color-accent-700)">
              0 单
            </text>
          ) : null,
        )}

        {weeks.map((w, i) =>
          i === 0 || i === n - 1 || i % 2 === 0 ? (
            <text
              key={`t${w.start}`}
              x={(i + 0.5) * step}
              y={H + 14}
              textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
              fontSize={11}
              fill="var(--color-neutral-600)"
            >
              {md(w.start)}
            </text>
          ) : null,
        )}
      </svg>

      <p style={{ fontSize: 12, color: "var(--color-neutral-700)", marginTop: 10, lineHeight: 1.7 }}>
        CPA 的分母是押金单，一周只有几个，计数的随机幅度是 <strong>√n</strong>：
        {cur && cur.deposits > 0 ? (
          <>
            本周 {cur.deposits} 单，<strong>少一单 CPA 就变 {model.oneLess ? money0(model.oneLess) : "—"}、多一单变 {model.oneMore ? money0(model.oneMore) : "—"}</strong>
            ——
          </>
        ) : (
          <>按现在每周几单的量，一单之差就能让 CPA 动两三成——</>
        )}
        所以单周的涨跌先别当信号。点落在浅带里，就是"生意没变，只是运气在抖"；
        <strong>连着两周掉在带外同一侧，纯随机的概率不到 3%</strong>，那时候才值得去查是哪个系列、哪一天出的问题。要看趋势请看左边那个近 {REF_WEEKS} 周的数。
      </p>
    </div>
  )
}
