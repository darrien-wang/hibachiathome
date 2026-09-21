"use client"

import { useMemo, useState } from "react"
import { Chip } from "./ui"
import { addDays, dowZh, eventParts, firstName, md, parseYmd, ptToday, stageOf, type OrderRow } from "./helpers"
import { holidayOn, upcomingHolidays } from "./holidays"
import type { WorkbenchSettings } from "@/lib/workbench-settings-shared"

// 日历 · every booked party on a month grid or a week timeline. Evening
// parties (from settings.calendar.evening_from_hour) print in ink, lunch
// parties in grey; a red bar means the order still needs details or money.

type Ev = { id: string; time: string; hour: number; minute: number; name: string; city: string; guests: number; evening: boolean; flag: boolean }

const DOW_MON = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]

export function CalendarTab({ orders, settings, isMobile, onOpenOrder }: { orders: OrderRow[]; settings: WorkbenchSettings["calendar"]; isMobile: boolean; onOpenOrder: (id: string) => void }) {
  const today = ptToday()
  const [view, setView] = useState<"month" | "week">("month")
  const [cursor, setCursor] = useState(today)
  const now = Date.now()

  const byDate = useMemo(() => {
    const map: Record<string, Ev[]> = {}
    for (const o of orders) {
      if (o.order_status === "cancelled") continue
      const p = eventParts(o.event_start)
      if (!p) continue
      const stage = stageOf(o, now)
      const city = (o.event_address ?? "").split(",").slice(-3, -2)[0]?.trim() ?? ""
      const ev: Ev = {
        id: o.id,
        time: p.hm,
        hour: p.hour,
        minute: p.minute,
        name: firstName(o.customer_name) || o.customer_name || o.customer_phone || "客户",
        city,
        guests: (o.guest_adult_count ?? 0) + (o.guest_child_count ?? 0),
        evening: p.hour >= settings.evening_from_hour,
        flag: stage === "待细节" || stage === "待尾款",
      }
      ;(map[p.ymd] = map[p.ymd] ?? []).push(ev)
    }
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.time.localeCompare(b.time))
    return map
  }, [orders, now, settings.evening_from_hour])

  const cur = parseYmd(cursor)
  const y = cur.getUTCFullYear()
  const m = cur.getUTCMonth()
  const monthFirst = `${y}-${String(m + 1).padStart(2, "0")}-01`
  const lead = (parseYmd(monthFirst).getUTCDay() + 6) % 7
  const gridStart = addDays(monthFirst, -lead)
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = addDays(gridStart, i)
    const inMonth = parseYmd(d).getUTCMonth() === m
    const dow = parseYmd(d).getUTCDay()
    return { d, day: parseYmd(d).getUTCDate(), inMonth, isToday: d === today, weekend: dow === 0 || dow === 6, events: byDate[d] ?? [], holiday: holidayOn(d) }
  })
  const wkStart = addDays(cursor, -((cur.getUTCDay() + 6) % 7))
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(wkStart, i)
    const events = byDate[d] ?? []
    return { d, label: md(d), dow: DOW_MON[i], isToday: d === today, events, guests: events.reduce((a, e) => a + e.guests, 0), holiday: holidayOn(d) }
  })
  const nextHolidays = upcomingHolidays(today, 4).map((h) => ({ ...h, count: (byDate[h.date] ?? []).length }))
  const hours = Array.from({ length: Math.max(1, settings.day_end_hour - settings.day_start_hour) }, (_, i) => settings.day_start_hour + i)
  const rowH = 44

  const move = (n: number) => {
    const d = parseYmd(cursor)
    if (view === "month") d.setUTCMonth(d.getUTCMonth() + n)
    else d.setUTCDate(d.getUTCDate() + 7 * n)
    setCursor(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`)
  }
  const title = view === "month" ? `${y} 年 ${m + 1} 月` : `${md(wkStart)} – ${md(addDays(wkStart, 6))}`
  const monthCount = cells.filter((c) => c.inMonth).reduce((a, c) => a + c.events.length, 0)

  const evStyle = (e: Ev) => ({
    background: e.evening ? "var(--color-text)" : "var(--color-neutral-300)",
    color: e.evening ? "var(--color-bg)" : "var(--color-text)",
    borderLeft: `3px solid ${e.flag ? "var(--color-accent)" : e.evening ? "var(--color-text)" : "var(--color-neutral-300)"}`,
  })

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-secondary btn-icon" onClick={() => move(-1)} aria-label="上一个">
          ‹
        </button>
        <button type="button" className="btn btn-secondary btn-icon" onClick={() => move(1)} aria-label="下一个">
          ›
        </button>
        <h2 style={{ fontSize: 22 }}>{title}</h2>
        <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>{view === "month" ? `${monthCount} 场` : `${weekDays.reduce((a, d) => a + d.events.length, 0)} 场`}</span>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setCursor(today)}>
          今天
        </button>
        <div style={{ marginLeft: "auto", display: "flex" }}>
          <Chip active={view === "month"} onClick={() => setView("month")}>
            月
          </Chip>
          <Chip active={view === "week"} onClick={() => setView("week")} style={{ marginLeft: -1 }}>
            周
          </Chip>
        </div>
      </div>

      {view === "month" ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", borderTop: "2px solid var(--color-divider)", borderLeft: "2px solid var(--color-divider)" }}>
            {DOW_MON.map((d) => (
              <div key={d} className="kicker" style={{ padding: "6px 8px", borderRight: "2px solid var(--color-divider)", borderBottom: "2px solid var(--color-divider)" }}>
                {isMobile ? d.slice(1) : d}
              </div>
            ))}
            {cells.map((c) => (
              <div
                key={c.d}
                style={{
                  minHeight: isMobile ? 64 : 104,
                  padding: 6,
                  borderRight: "2px solid var(--color-divider)",
                  borderBottom: "1px solid var(--color-line)",
                  background: c.isToday ? "var(--color-surface)" : c.holiday && c.inMonth ? "var(--color-accent-100)" : c.weekend && c.inMonth ? "color-mix(in srgb, var(--color-text) 3%, transparent)" : "transparent",
                  opacity: c.inMonth ? 1 : 0.35,
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  minWidth: 0,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontWeight: c.isToday || c.holiday ? 800 : 400, fontSize: 13, whiteSpace: "nowrap", color: c.isToday ? "var(--color-accent)" : c.holiday ? "var(--color-accent-700)" : c.d < today ? "var(--color-neutral-600)" : "var(--color-text)" }}>{c.day}</span>
                  {c.events.length ? <span style={{ fontSize: 11, color: "var(--color-neutral-600)", whiteSpace: "nowrap" }}>{c.events.length} 场</span> : null}
                </div>
                {c.holiday ? <div className="clamp1" style={{ fontSize: 10, fontWeight: 600, color: "var(--color-accent-700)" }}>{c.holiday}</div> : null}
                {c.events.map((e) => (
                  <button key={e.id} type="button" className="wb-ev clamp1" onClick={() => onOpenOrder(e.id)} style={{ padding: "3px 6px", fontSize: isMobile ? 10 : 11, lineHeight: 1.3, ...evStyle(e) }}>
                    <strong>{e.time}</strong> {isMobile ? e.name : `${e.name} · ${e.guests}人`}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--color-neutral-600)", flexWrap: "wrap" }}>
            <span>
              <span style={{ display: "inline-block", width: 10, height: 10, background: "var(--color-text)", marginRight: 6, verticalAlign: "middle" }} />
              晚场 ({settings.evening_from_hour}:00 后)
            </span>
            <span>
              <span style={{ display: "inline-block", width: 10, height: 10, background: "var(--color-neutral-300)", marginRight: 6, verticalAlign: "middle" }} />
              午场
            </span>
            <span>
              <span style={{ display: "inline-block", width: 10, height: 10, borderLeft: "3px solid var(--color-accent)", marginRight: 6, verticalAlign: "middle" }} />
              待细节 / 待尾款
            </span>
            <span>
              <span style={{ display: "inline-block", width: 10, height: 10, background: "var(--color-accent-100)", border: "1px solid var(--color-accent-300)", marginRight: 6, verticalAlign: "middle" }} />
              节假日
            </span>
          </div>
        </>
      ) : null}

      <div style={{ display: "flex", alignItems: "baseline", gap: "8px 18px", flexWrap: "wrap", fontSize: 13, borderTop: "2px solid var(--color-divider)", paddingTop: 10 }}>
        <span className="kicker" style={{ whiteSpace: "nowrap" }}>接下来的节假日</span>
        {nextHolidays.map((h) => (
          <button
            key={h.date}
            type="button"
            className="wb-row"
            onClick={() => {
              setCursor(h.date)
              setView("week")
            }}
            style={{ border: 0, background: "transparent", padding: 0, font: "inherit", color: "inherit", whiteSpace: "nowrap" }}
          >
            <strong style={{ color: "var(--color-accent-700)" }}>{h.name}</strong>{" "}
            <span style={{ color: "var(--color-neutral-600)" }}>
              {md(h.date)} {dowZh(h.date)} · 已订 {h.count ? `${h.count} 场` : "空"}
            </span>
          </button>
        ))}
      </div>

      {view === "month" ? null : !isMobile ? (
        <div style={{ display: "grid", gridTemplateColumns: `48px repeat(7, minmax(0,1fr))`, borderTop: "2px solid var(--color-divider)" }}>
          <div style={{ borderBottom: "2px solid var(--color-divider)" }} />
          {weekDays.map((d) => (
            <div key={d.d} style={{ padding: 8, borderLeft: "1px solid var(--color-line)", borderBottom: "2px solid var(--color-divider)", background: d.isToday ? "var(--color-surface)" : d.holiday ? "var(--color-accent-100)" : "transparent" }}>
              <div className="kicker">{d.dow}</div>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 20, color: d.isToday ? "var(--color-accent)" : d.holiday ? "var(--color-accent-700)" : "var(--color-text)" }}>{d.label}</div>
              <div style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>{d.events.length ? `${d.events.length} 场 · ${d.guests} 人` : ""}</div>
              {d.holiday ? <div className="clamp1" style={{ fontSize: 10, fontWeight: 600, color: "var(--color-accent-700)" }}>{d.holiday}</div> : null}
            </div>
          ))}
          <div>
            {hours.map((h) => (
              <div key={h} style={{ height: rowH, fontSize: 11, color: "var(--color-neutral-600)", padding: "2px 6px 0 0", textAlign: "right", borderBottom: "1px solid var(--color-line)" }}>
                {h}:00
              </div>
            ))}
          </div>
          {weekDays.map((d) => (
            <div
              key={d.d}
              style={{
                position: "relative",
                borderLeft: "1px solid var(--color-line)",
                background: d.isToday ? "var(--color-surface)" : "transparent",
                backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${rowH - 1}px, var(--color-line) ${rowH - 1}px ${rowH}px)`,
                height: rowH * hours.length,
              }}
            >
              {d.events.map((e) => {
                const top = (e.hour - settings.day_start_hour) * rowH + (e.minute / 60) * rowH
                return (
                  <button key={e.id} type="button" className="wb-ev" onClick={() => onOpenOrder(e.id)} style={{ position: "absolute", left: 3, right: 3, top: Math.max(0, top), height: rowH * 2 - 2, padding: "4px 6px", fontSize: 12, lineHeight: 1.3, overflow: "hidden", ...evStyle(e) }}>
                    <div style={{ fontWeight: 800 }}>
                      {e.time} · {e.guests} 人
                    </div>
                    <div className="clamp1">{e.name}</div>
                    <div className="clamp1" style={{ opacity: 0.7 }}>
                      {e.city}
                    </div>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", borderTop: "2px solid var(--color-divider)" }}>
          {weekDays.map((d) => (
            <div key={d.d} style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--color-line)", background: d.isToday ? "var(--color-surface)" : d.holiday ? "var(--color-accent-100)" : "transparent" }}>
              <div>
                <div className="kicker">{d.dow}</div>
                <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 22, color: d.isToday ? "var(--color-accent)" : d.holiday ? "var(--color-accent-700)" : "var(--color-text)" }}>{d.label}</div>
                <div style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>{d.events.length ? `${d.events.length} 场 · ${d.guests} 人` : "空"}</div>
                {d.holiday ? <div style={{ fontSize: 10, fontWeight: 600, color: "var(--color-accent-700)" }}>{d.holiday}</div> : null}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {d.events.length === 0 ? <div style={{ fontSize: 13, color: "var(--color-neutral-500)", padding: "6px 0" }}>空</div> : null}
                {d.events.map((e) => (
                  <button key={e.id} type="button" className="wb-ev" onClick={() => onOpenOrder(e.id)} style={{ padding: "8px 10px", fontSize: 13, display: "flex", justifyContent: "space-between", gap: 8, ...evStyle(e) }}>
                    <span>
                      <strong>{e.time}</strong> {e.name}
                    </span>
                    <span>{e.guests} 人</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
