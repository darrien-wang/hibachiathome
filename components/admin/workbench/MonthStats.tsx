"use client"

import { useEffect, useState, type CSSProperties } from "react"
import { adminJson } from "./api"
import { money0, ptToday } from "./helpers"
import type { MonthStat } from "@/lib/party-heads"

// 每月小结：场次 / 服务人数 / 营业额。口径在 lib/party-heads.ts——
// 服务人数 = 大人 + 收费小孩 × 0.5，免费小孩不计；营业额 = 订单总价
//（现金口径，含路费，不含小费），按派对日期归月。

type Resp = { ok: boolean; today: string; withMoney: boolean; months: MonthStat[] }

export function useMonthStats(adminKey: string): { months: MonthStat[] | null; withMoney: boolean; error: string | null } {
  const [d, setD] = useState<Resp | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let dead = false
    adminJson<Resp>(adminKey, "/api/admin/month-stats")
      .then((r) => {
        if (!dead) setD(r)
      })
      .catch((e) => {
        if (!dead) setError(e instanceof Error ? e.message : "读取失败")
      })
    return () => {
      dead = true
    }
  }, [adminKey])
  return { months: d?.months ?? null, withMoney: d?.withMoney === true, error }
}

/** 12.5 -> "12.5"，12 -> "12" */
export const headsText = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
const monthLabel = (m: string) => `${m.slice(0, 4)} 年 ${Number(m.slice(5))} 月`

/** 看板：每月服务人数（历史小结）。 */
export function MonthlyHeads({ adminKey, isMobile }: { adminKey: string; isMobile: boolean }) {
  const { months, withMoney, error } = useMonthStats(adminKey)
  const thisMonth = ptToday().slice(0, 7)
  const rows = (months ?? []).slice().sort((a, b) => b.month.localeCompare(a.month))
  const maxHeads = Math.max(1, ...rows.map((r) => r.heads))
  const th: CSSProperties = { textAlign: "right", padding: "6px 0 6px 14px", borderBottom: "2px solid var(--color-text)", fontSize: 12, whiteSpace: "nowrap" }
  const td: CSSProperties = { textAlign: "right", padding: "7px 0 7px 14px", borderBottom: "1px solid var(--color-line)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }
  return (
    <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>每月服务人数</h3>
        <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
          按派对日期归月。服务人数 = 大人 + 收费小孩 × ½，免费小孩不计。营业额 = 订单总价（含路费，不含小费）；本月和以后的月份含还没办的场。
        </span>
      </div>
      {error ? <div className="notice">{error}</div> : null}
      {!months ? (
        <div className="empty">读取中…</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%", minWidth: isMobile ? 520 : 0 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left", paddingLeft: 0 }}>月份</th>
                <th style={th}>场次</th>
                <th style={th}>服务人数</th>
                <th style={{ ...th, textAlign: "left", width: "22%" }} />
                <th style={th}>大人</th>
                <th style={th}>收费小孩</th>
                <th style={th}>免费小孩</th>
                {withMoney ? <th style={th}>营业额</th> : null}
                {withMoney ? <th style={th}>每位大人量</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const future = r.month > thisMonth
                const partial = r.month === thisMonth
                return (
                  <tr key={r.month} style={{ color: future ? "var(--color-neutral-600)" : undefined }}>
                    <td style={{ ...td, textAlign: "left", paddingLeft: 0, fontWeight: 700 }}>
                      {monthLabel(r.month)}
                      {partial ? <span style={{ fontWeight: 400, color: "var(--color-neutral-600)" }}> · 本月（已办 {r.done}）</span> : future ? <span style={{ fontWeight: 400 }}> · 已订</span> : null}
                    </td>
                    <td style={td}>{r.parties}</td>
                    <td style={{ ...td, fontWeight: 800 }}>{r.countOnly ? "—" : headsText(r.heads)}</td>
                    <td style={{ ...td, textAlign: "left" }}>
                      {r.countOnly ? (
                        <span style={{ fontSize: 11.5, color: "var(--color-neutral-600)" }}>只有场次（2025 导入，无人数金额）</span>
                      ) : (
                        <div style={{ height: 8, background: "var(--color-neutral-200)" }}>
                          <div style={{ height: "100%", width: `${Math.round((100 * r.heads) / maxHeads)}%`, background: future ? "var(--color-neutral-500)" : "var(--color-text)" }} />
                        </div>
                      )}
                    </td>
                    <td style={td}>{r.countOnly ? "—" : r.adults}</td>
                    <td style={td}>{r.countOnly ? "—" : r.kids}</td>
                    <td style={td}>{r.countOnly ? "—" : r.littles}</td>
                    {withMoney ? <td style={{ ...td, fontWeight: 700 }}>{r.revenueCents == null ? "—" : money0(r.revenueCents)}</td> : null}
                    {withMoney ? <td style={td}>{r.revenueCents == null || r.heads <= 0 ? "—" : money0(Math.round(r.revenueCents / r.heads))}</td> : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
