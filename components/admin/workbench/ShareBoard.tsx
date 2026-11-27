"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { adminJson } from "./api"
import { askConfirm, tell } from "./ask"
import { Dialog, DialogHead, Tag } from "./ui"
import { addDays, dowZh, md, ptToday } from "./helpers"
import { headsText } from "@/lib/party-heads"
import { hoursToParty } from "@/lib/dispatch-plan-order"
import { ROTATION, TARGET_CHEFS, TARGET_MAX, TARGET_MIN } from "@/lib/chef-share"
import { checkMove, teamsAfter, weekHeads, type BoardDay, type BoardStop, type Move, type MoveCheck } from "@/lib/share-move"

// 份额页 · 拖单调人数（老板 2026-11-14「能够简单的分配每周的总人数，自主的给某些师傅加单和减单」）。
//
// 一行一位师傅、一列一天。单只能在同一天里换人（日期是客人的，不是我们的）。
// 拖下去先算：这位师傅这天接不接得上（和日历地图同一个算法），接不上的单要让出来——
// 换给拖出来的那位，或者放回未派；还有点名、新手、难度这些提醒。确认了才写。
// 写的时候只改名单不发短信（quiet），最后点"通知改动"一起通知，和日历地图同一个入口。
// 每一步都能撤销。

type DayResp = BoardDay & {
  chefs: Array<{ id: string; name: string; active: boolean; canHelp: boolean }>
  /** 外包的单（lib/outsourced.ts）：不上这张板，只看还欠不欠"不用去"的通知。stops 里只有直营的。 */
  outsourced?: Array<Pick<BoardStop, "id" | "name" | "time" | "pending">>
}

type Drag = { orderId: string; from: string | null; date: string }
type Proposal = { move: Move; date: string; check: MoveCheck }
type Undo = { label: string; teams: Array<{ orderId: string; team: string[] }>; dates: string[] }

const UNASSIGNED = "__none__"
const cellKey = (chef: string | null, date: string) => `${chef ?? UNASSIGNED}|${date}`

export function ShareBoard({ adminKey, week, isMobile, onOpenOrder, onChanged }: { adminKey: string; week: string; isMobile: boolean; onOpenOrder: (id: string) => void; onChanged: () => Promise<void> | void }) {
  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week])
  const [days, setDays] = useState<Record<string, DayResp | null>>({})
  const [err, setErr] = useState<string | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState<Undo[]>([])
  // 只看一位师傅（老板 2026-11-19「截图给师傅看，需要看日期，但是不想让他看到其他人的排单」）。
  const [only, setOnly] = useState<string | null>(null)
  const today = ptToday()

  const loadDay = useCallback(
    async (date: string) => {
      const r = await adminJson<DayResp>(adminKey, `/api/admin/day-map?date=${date}`)
      setDays((cur) => ({ ...cur, [date]: { ...r, date } }))
    },
    [adminKey],
  )
  const loadAll = useCallback(async () => {
    setErr(null)
    try {
      await Promise.all(dates.map((d) => loadDay(d)))
    } catch (e) {
      setErr(e instanceof Error ? e.message : "读不出来")
    }
  }, [dates, loadDay])
  useEffect(() => {
    setDays({})
    setHistory([])
    void loadAll()
  }, [loadAll])

  const loaded = dates.map((d) => days[d]).filter((d): d is DayResp => !!d)
  const staff = useMemo(() => {
    const m = new Map<string, { id: string; name: string; active: boolean; canHelp: boolean }>()
    for (const d of loaded) for (const c of d.chefs ?? []) m.set(c.id, c)
    return m
  }, [loaded])
  const nameOf = useCallback((id: string) => staff.get(id)?.name ?? "?", [staff])
  const activeIds = useMemo(() => new Set([...staff.values()].filter((c) => c.active && c.canHelp).map((c) => c.id)), [staff])
  const totals = useMemo(() => weekHeads(loaded), [loaded])

  // 行：派单顺序的五位在前，其余在职师傅按这周人数多少，最后是未派。这周有单但已不可派的人也列出来。
  const rows = useMemo(() => {
    const ids = new Set<string>([...activeIds, ...totals.keys()])
    const list = [...ids].filter((id) => staff.has(id))
    const rank = (id: string) => {
      const i = ROTATION.indexOf(nameOf(id))
      return i >= 0 ? i : ROTATION.length
    }
    return list.sort((a, b) => rank(a) - rank(b) || (totals.get(b)?.heads ?? 0) - (totals.get(a)?.heads ?? 0) || nameOf(a).localeCompare(nameOf(b)))
  }, [activeIds, totals, staff, nameOf])

  const stopsIn = (chef: string | null, date: string) => {
    const d = days[date]
    if (!d) return []
    if (chef === null) return d.stops.filter((s) => s.chefIds.length < Math.max(1, s.plan.chefs))
    return d.stops.filter((s) => s.chefIds.includes(chef))
  }

  const propose = (move: Move, date: string) => {
    const d = days[date]
    if (!d) return
    const check = checkMove(d, move, {
      nameOf,
      activeIds,
      today,
      started: (s) => (hoursToParty(`${date}T${String(Math.floor(s.startMin / 60)).padStart(2, "0")}:${String(s.startMin % 60).padStart(2, "0")}:00`) ?? 1) <= 0,
    })
    setProposal({ move, date, check })
  }
  const dropOn = (chef: string | null, date: string) => {
    const g = drag
    setDrag(null)
    setOver(null)
    if (!g || g.date !== date || g.from === chef) return
    propose({ orderId: g.orderId, from: g.from, to: chef }, date)
  }

  const apply = async (resolve: "swap" | "unassign") => {
    if (!proposal || busy) return
    const d = days[proposal.date]
    if (!d) return
    const teams = teamsAfter(d, proposal.move, proposal.check.clashes, resolve)
    const before = teams.map((t) => ({ orderId: t.orderId, team: d.stops.find((s) => s.id === t.orderId)?.chefIds ?? [] }))
    setBusy(true)
    try {
      for (const t of teams) {
        await adminJson(adminKey, "/api/admin/chefs", { body: { action: "assign", quiet: true, order_id: t.orderId, staff_member_ids: t.team } })
      }
      const s = d.stops.find((x) => x.id === proposal.move.orderId)
      setHistory((h) => [...h, { label: `${md(proposal.date)} ${s?.time ?? ""} ${s?.name ?? ""}`, teams: before, dates: [proposal.date] }])
      setProposal(null)
    } catch (e) {
      void tell({ title: "没改成", message: e instanceof Error ? e.message : "出错了" })
    } finally {
      await loadDay(proposal.date).catch(() => undefined)
      await onChanged()
      setBusy(false)
    }
  }

  const undo = async () => {
    const last = history[history.length - 1]
    if (!last || busy) return
    if (!(await askConfirm({ title: "撤销上一步", message: `${last.label}：名单改回去（同一天被顶掉的单也一起改回）。`, okLabel: "撤销" }))) return
    setBusy(true)
    try {
      for (const t of last.teams) await adminJson(adminKey, "/api/admin/chefs", { body: { action: "assign", quiet: true, order_id: t.orderId, staff_member_ids: t.team } })
      setHistory((h) => h.slice(0, -1))
    } catch (e) {
      void tell({ title: "没撤销成", message: e instanceof Error ? e.message : "出错了" })
    } finally {
      await Promise.all(last.dates.map((x) => loadDay(x).catch(() => undefined)))
      await onChanged()
      setBusy(false)
    }
  }

  // 通知改动：和日历地图同一个入口——拿着备料单却被换下的说"不用去"，新上来的、这单发过备料单的补发。
  // 外包的单也算：外包前拿过备料单的人要告诉他不用去。
  const pending = loaded.flatMap((d) => [...d.stops, ...(d.outsourced ?? [])].filter((s) => (s.pending?.add.length ?? 0) + (s.pending?.remove.length ?? 0) > 0).map((s) => ({ d, s })))
  const notify = async () => {
    if (!pending.length || busy) return
    const names = (ids: string[]) => ids.map(nameOf).join("、")
    const ok = await askConfirm({
      title: `通知改动 · ${pending.length} 单`,
      message: [
        ...pending.map(({ d, s }) =>
          [`${md(d.date)} ${s.time} ${s.name}：`, s.pending!.add.length ? `发备料单给 ${names(s.pending!.add)}` : "", s.pending!.add.length && s.pending!.remove.length ? "；" : "", s.pending!.remove.length ? `告诉 ${names(s.pending!.remove)} 不用去了` : ""].join(""),
        ),
        "",
        "都从 213 线发短信。",
      ].join("\n"),
      okLabel: "发送",
    })
    if (!ok) return
    setBusy(true)
    const out: string[] = []
    try {
      for (const { d, s } of pending) {
        try {
          const r = await adminJson<{ notice?: string; sheetNotice?: string }>(adminKey, "/api/admin/chefs", { body: { action: "notify_changes", order_id: s.id } })
          out.push(`${md(d.date)} ${s.time} ${s.name}：${[r.notice, r.sheetNotice].filter(Boolean).join("；") || "已通知"}`)
        } catch (e) {
          out.push(`${md(d.date)} ${s.time} ${s.name}：没发出去（${e instanceof Error ? e.message : "出错了"}）`)
        }
      }
      void tell({ title: "改动已通知", message: out.join("\n") })
    } finally {
      await loadAll()
      setBusy(false)
    }
  }

  const targetNote = (id: string) => {
    if (!TARGET_CHEFS.includes(nameOf(id))) return null
    const h = totals.get(id)?.heads ?? 0
    if (h < TARGET_MIN) return { text: `差 ${headsText(Math.round((TARGET_MIN - h) * 10) / 10)}`, warn: true }
    if (h > TARGET_MAX) return { text: `超 ${headsText(Math.round((h - TARGET_MAX) * 10) / 10)}`, warn: true }
    return { text: `${TARGET_MIN}–${TARGET_MAX} 内`, warn: false }
  }

  const card = (s: BoardStop, chef: string | null, date: string) => {
    const share = chef === null ? s.guests : s.guests / Math.max(1, s.chefIds.length)
    const short = Math.max(1, s.plan.chefs) - s.chefIds.length
    const picked = drag?.orderId === s.id && drag.from === chef
    return (
      <div
        key={`${s.id}|${chef ?? ""}`}
        draggable={!busy}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move"
          e.dataTransfer.setData("text/plain", s.id)
          setDrag({ orderId: s.id, from: chef, date })
        }}
        onDragEnd={() => {
          setDrag(null)
          setOver(null)
        }}
        onClick={(e) => {
          e.stopPropagation()
          // 手机/iPad 没有拖：先点单，再点同一天要给的那一格。再点一下取消。
          // 已经拿起一张单时点到另一格里的单，算点那一格（iPad 2026-11-26：格子被单占满就没处点了）。
          if (drag && !picked && drag.date === date && drag.from !== chef) {
            dropOn(chef, date)
            return
          }
          setDrag((cur) => (cur && cur.orderId === s.id && cur.from === chef ? null : { orderId: s.id, from: chef, date }))
        }}
        onDoubleClick={() => onOpenOrder(s.id)}
        title={`${s.time} ${s.name} · ${s.address}\n双击打开订单`}
        style={{
          border: picked ? "2px solid var(--color-accent)" : "1px solid var(--color-line)",
          background: "var(--color-bg)",
          padding: "3px 5px",
          fontSize: 12,
          lineHeight: 1.3,
          cursor: busy ? "default" : "grab",
          marginBottom: 4,
          userSelect: "none",
        }}
      >
        <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {s.time.replace(/:00(?= )/, "")} {s.name.split(/\s+/)[0]}
        </div>
        <div style={{ color: "var(--color-neutral-600)", whiteSpace: "nowrap" }}>
          {headsText(Math.round(share * 10) / 10)} 人{s.chefIds.length > 1 && chef !== null ? `/${headsText(s.guests)}` : ""}
          {s.difficulty && s.difficulty.score >= 3 ? <span style={{ color: s.difficulty.score >= 4 ? "var(--color-accent)" : undefined }}> · 难{s.difficulty.score}</span> : null}
          {chef === null && s.chefIds.length > 0 ? <span style={{ color: "var(--color-accent)" }}> · 缺{short}</span> : null}
        </div>
        {picked ? (
          // 触屏没有双击：拿起来的单多一个「打开订单」（iPad 2026-11-26）。
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setDrag(null)
              onOpenOrder(s.id)
            }}
            style={{ marginTop: 4, width: "100%", minHeight: 30, border: "1px solid var(--color-accent)", background: "var(--color-surface)", color: "var(--color-accent-700)", font: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            打开订单
          </button>
        ) : null}
      </div>
    )
  }

  const cell = (chef: string | null, date: string) => {
    const k = cellKey(chef, date)
    const can = !!drag && drag.date === date && drag.from !== chef
    return (
      <td
        key={k}
        onDragOver={(e) => {
          if (!can) return
          e.preventDefault()
          if (over !== k) setOver(k)
        }}
        onDragLeave={() => over === k && setOver(null)}
        onDrop={(e) => {
          e.preventDefault()
          dropOn(chef, date)
        }}
        onClick={() => can && dropOn(chef, date)}
        style={{
          verticalAlign: "top",
          padding: 4,
          minWidth: 92,
          borderBottom: "1px solid var(--color-line)",
          borderLeft: "1px solid var(--color-line)",
          background: over === k ? "var(--color-accent-100)" : can ? "var(--color-neutral-100)" : drag && drag.date !== date ? "var(--color-bg)" : undefined,
          opacity: drag && drag.date !== date ? 0.45 : 1,
          cursor: can ? "copy" : undefined,
        }}
      >
        {stopsIn(chef, date).map((s) => card(s, chef, date))}
      </td>
    )
  }

  const p = proposal
  const pStop = p ? days[p.date]?.stops.find((s) => s.id === p.move.orderId) : null
  const delta = (id: string | null) => {
    if (!p || id === null || !pStop) return null
    const now = totals.get(id)?.heads ?? 0
    const d = days[p.date]
    if (!d) return null
    const teams = teamsAfter(d, p.move, p.check.clashes, p.check.swap?.ok ? "swap" : "unassign")
    let after = now
    for (const t of teams) {
      const s = d.stops.find((x) => x.id === t.orderId)
      if (!s) continue
      const was = s.chefIds.includes(id) ? s.guests / Math.max(1, s.chefIds.length) : 0
      const will = t.team.includes(id) ? s.guests / Math.max(1, t.team.length) : 0
      after += will - was
    }
    return `${nameOf(id)} 这周 ${headsText(Math.round(now * 10) / 10)} → ${headsText(Math.round(after * 10) / 10)} 人`
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{only ? `${nameOf(only)} · 这周排班` : "拖单调人数"}</div>
        {only ? null : (
          <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
            {isMobile ? "先点一张单，再点同一天要给的那一格" : "把单拖到同一天另一位师傅那一格；触屏上先点单再点格子"} · 点一下单能打开订单 · 改完先不发短信
          </div>
        )}
        <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }} title="截图给师傅看：只留他这一行">
            只看
            <select value={only ?? ""} onChange={(e) => setOnly(e.target.value || null)} style={{ font: "inherit", fontSize: 13, padding: "4px 6px", minHeight: 32 }}>
              <option value="">全部师傅</option>
              {rows.map((id) => (
                <option key={id} value={id}>
                  {nameOf(id)}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-secondary btn-sm" disabled={!history.length || busy} onClick={() => void undo()}>
            撤销上一步{history.length ? `（${history.length}）` : ""}
          </button>
          <button type="button" className={pending.length ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"} disabled={!pending.length || busy} onClick={() => void notify()} title="拿着备料单被换下的说不用去，新上来的补发备料单">
            通知改动{pending.length ? ` · ${pending.length} 单` : ""}
          </button>
        </span>
      </div>
      {err ? <div style={{ color: "var(--color-accent)", fontSize: 13 }}>读不出来：{err}</div> : null}
      {loaded.length < dates.length && !err ? <div style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>读取这周每天的单和车程…</div> : null}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 760 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", fontSize: 12, padding: "4px 6px", borderBottom: "2px solid var(--color-text)", minWidth: 110 }}>师傅 · 这周</th>
              {dates.map((d) => (
                <th key={d} style={{ textAlign: "left", fontSize: 12, padding: "4px 6px", borderBottom: "2px solid var(--color-text)", fontWeight: d === today ? 800 : 600 }}>
                  {md(d)} {dowZh(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(only ? rows.filter((id) => id === only) : rows).map((id) => {
              const t = totals.get(id)
              const note = only ? null : targetNote(id)
              return (
                <tr key={id}>
                  <td style={{ verticalAlign: "top", padding: "6px", borderBottom: "1px solid var(--color-line)", fontSize: 13 }}>
                    <div style={{ fontWeight: 700 }}>
                      {nameOf(id)}
                      {!activeIds.has(id) ? <span style={{ fontWeight: 400, fontSize: 11, color: "var(--color-neutral-600)" }}> · 不可派</span> : null}
                    </div>
                    <div>
                      {headsText(Math.round((t?.heads ?? 0) * 10) / 10)} 人 · {t?.parties ?? 0} 单
                    </div>
                    {note ? <div style={{ fontSize: 11, color: note.warn ? "var(--color-accent)" : "var(--color-neutral-600)" }}>{note.text}</div> : null}
                  </td>
                  {dates.map((d) => cell(id, d))}
                </tr>
              )
            })}
            {only ? null : <tr>
              <td style={{ verticalAlign: "top", padding: "6px", fontSize: 13 }}>
                <div style={{ fontWeight: 700 }}>未派</div>
                <div style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>拖到这里 = 拿掉这位师傅</div>
              </td>
              {dates.map((d) => cell(null, d))}
            </tr>}
          </tbody>
        </table>
      </div>

      {p && pStop ? (
        <Dialog onClose={() => !busy && setProposal(null)} width={520}>
          <DialogHead
            title={`${md(p.date)} ${pStop.time} ${pStop.name}`}
            lines={[`${headsText(pStop.guests)} 人 · ${p.move.from ? nameOf(p.move.from) : "未派"} → ${p.move.to ? nameOf(p.move.to) : "未派"}`]}
            onClose={() => !busy && setProposal(null)}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14 }}>
            {p.check.block ? (
              <div style={{ color: "var(--color-accent)", fontWeight: 700 }}>{p.check.block}</div>
            ) : (
              <>
                {p.check.clashes.length ? (
                  <div style={{ border: "2px solid var(--color-accent)", padding: 10 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{nameOf(p.move.to!)} 这天接不上下面这几单，得让出来：</div>
                    {p.check.clashes.map((cid) => {
                      const s = days[p.date]?.stops.find((x) => x.id === cid)
                      return <div key={cid}>{s ? `${s.time} ${s.name} · ${headsText(s.guests)} 人` : cid}</div>
                    })}
                    {p.check.swap && !p.check.swap.ok ? <div style={{ fontSize: 12, color: "var(--color-neutral-600)", marginTop: 4 }}>换给 {p.move.from ? nameOf(p.move.from) : "原来的人"} 不行：{p.check.swap.reason}</div> : null}
                  </div>
                ) : null}
                {p.check.warnings.length ? (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {p.check.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ color: "var(--color-neutral-600)" }}>{p.check.clashes.length ? "" : "接得上，没有要提醒的。"}</div>
                )}
                <div style={{ fontSize: 13 }}>
                  {[delta(p.move.from), delta(p.move.to)].filter(Boolean).map((x) => (
                    <div key={x!}>{x}</div>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>只改订单上的名单，不发短信；改完点"通知改动"再通知师傅。</div>
              </>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setProposal(null)}>
                {p.check.block ? "知道了" : "取消"}
              </button>
              {!p.check.block && p.check.clashes.length && p.check.swap?.ok ? (
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void apply("swap")}>
                  互换：冲突的给 {nameOf(p.move.from!)}
                </button>
              ) : null}
              {!p.check.block && p.check.clashes.length ? (
                <button type="button" className={p.check.swap?.ok ? "btn btn-secondary" : "btn btn-primary"} disabled={busy} onClick={() => void apply("unassign")}>
                  冲突的放回未派
                </button>
              ) : null}
              {!p.check.block && !p.check.clashes.length ? (
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void apply("unassign")}>
                  {busy ? "改…" : "确定"}
                </button>
              ) : null}
            </div>
          </div>
        </Dialog>
      ) : null}
      {drag && !proposal ? <Tag cls="tag-ink" style={{ alignSelf: "flex-start" }}>已选中，点同一天要给的那一格；再点一下这张单取消</Tag> : null}
    </div>
  )
}
