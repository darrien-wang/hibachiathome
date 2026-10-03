"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { adminJson } from "./api"
import { Dialog, DialogHead, Tag } from "./ui"
import { askConfirm, askPrompt, tell } from "./ask"
import { TileMap } from "@/components/schedule/TileMap"

// 一天几场摆到地图上，并算出最少要几个师傅、谁接谁（老板 2026-09-29）。
// 排班规则照的是他们人工的算法，见 lib/dispatch.ts。
//
// 图上的线只画**排班里真正用到的衔接**，不画"时间上相邻的两场"——后者是第一版的
// 做法，它会让人以为相邻就是该连的，而 10-03 那天最稳的一对隔着三场。
//
// 接不接一条可能迟到的衔接是老板的风险决定，所以给的是几版排法让他切着看：
// 稳的要几个师傅，肯冒迟到的险又能省几个。
//
// 底图是 OpenStreetMap 的瓦片，用 <img> 拼出来的，没装地图库：
// 一个只有老板会打开的调度视图，不值得为它加一个依赖和一串 API key。

type Stop = {
  id: string
  orderNo: string
  name: string
  phone: string | null
  address: string
  time: string
  guests: number
  lat: number | null
  lng: number | null
  /** 只精确到城市/邮编——图钉不是门口。 */
  approx?: boolean
  /** 这一单现在派给了谁（order_staff_assignments 里没取消的） */
  chefIds: string[]
}
type Chef = { id: string; name: string; active: boolean }
type Grade = "solid" | "ontime" | "late_ok" | "late_limit"
type Link = {
  fromId: string
  toId: string
  minutes: number
  miles: number | null
  /** 到场减开场：负数早到，正数迟到。顺利（服务按最短）的情况。 */
  bestLate: number
  /** 拖满的情况——排班看这个数。 */
  worstLate: number
  grade: Grade
  fix: { minutes: number; laterStart: string; earlierStart: string | null } | null
}
/** key: safe / late_ok / late_limit = 最少几个师傅；spread_N = 多派到 N 个 */
type Plan = { key: string; tolerance: number; chefs: number; chains: string[][]; links: Link[]; spread: boolean; onePerParty: boolean }
type Resp = {
  date: string
  stops: Stop[]
  chefs: Chef[]
  missing: Array<{ name: string; address: string }>
  home: { lat: number; lng: number; label: string } | null
  plans: Plan[]
  params: { busyMin: number; busyMax: number; arriveEarly: number; lateOk: number; lateLimit: number }
  source: "google_traffic" | "google" | "osrm" | "none"
  note: string | null
}

const SOURCE_LABEL: Record<Resp["source"], string> = {
  google_traffic: "Google，按师傅出发那个时刻预测的路况",
  google: "Google，不含路况（出发时刻已经过去了）",
  osrm: "OSRM，不含堵车的理想值",
  none: "没算出来",
}

const GRADE_LABEL: Record<Grade, string> = {
  solid: "稳",
  ontime: "踩点",
  late_ok: "可能迟到",
  late_limit: "迟到要赔",
}

const when = (late: number) => (late <= 0 ? `早到 ${-late} 分` : `迟到 ${late} 分`)

export function DayMap({ adminKey, date, onClose, onOpenOrder }: { adminKey: string; date: string; onClose: () => void; onOpenOrder: (id: string) => void }) {
  const [d, setD] = useState<Resp | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // 默认看最稳的那版：冒不冒险得是老板自己点过去看的，不是打开就替他选好。
  const [tier, setTier] = useState<string>("safe")
  const [assigning, setAssigning] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      setD(await adminJson<Resp>(adminKey, `/api/admin/day-map?date=${date}`))
    } catch (e) {
      setErr(e instanceof Error ? e.message : "读不到")
    }
  }, [adminKey, date])
  useEffect(() => {
    void load()
  }, [load])

  // OSM 在沙漠区缺街道，那偏偏是我们最赚钱的一块。与其等它补数据，不如让老板从
  // Google 地图右键抄一个 Plus Code 贴进来——那玩意儿本身就是坐标。
  const pin = useCallback(
    async (address: string) => {
      const v = await askPrompt({
        title: "手工定位",
        message: "在 Google 地图上右键那个点，复制 Plus Code 贴进来（长这样 4G4J+24 Yucca Valley）。经纬度也行。",
        placeholder: "4G4J+24 Yucca Valley, California",
      })
      if (!v) return
      setBusy(true)
      try {
        await adminJson(adminKey, "/api/admin/day-map", { body: { address, value: v } })
        await load()
      } catch (e) {
        void tell({ title: "定位不了", message: e instanceof Error ? e.message : "认不出来" })
      } finally {
        setBusy(false)
      }
    },
    [adminKey, load],
  )

  const placed = useMemo(() => (d?.stops ?? []).filter((s) => s.lat !== null && s.lng !== null) as Array<Stop & { lat: number; lng: number }>, [d])
  const byId = useMemo(() => new Map((d?.stops ?? []).map((s) => [s.id, s])), [d])
  // 图钉上的数字 = 按开场时间排的第几场（只数定位到的）
  const numOf = useCallback((id: string) => placed.findIndex((s) => s.id === id) + 1, [placed])
  const plan = useMemo(() => d?.plans.find((p) => p.key === tier) ?? d?.plans[0] ?? null, [d, tier])

  const cur = placed.find((s) => s.id === open) ?? null

  const tierLabel = (p: Plan) =>
    p.spread
      ? p.onePerParty
        ? `每人一台 · ${p.chefs} 个`
        : `多派 · ${p.chefs} 个`
      : p.key === "safe"
        ? `稳妥 · ${p.chefs} 个师傅`
        : p.key === "late_ok"
          ? `肯迟到 ${p.tolerance} 分内 · ${p.chefs} 个`
          : `极限迟到 ${p.tolerance} 分 · ${p.chefs} 个`

  // 多派（老板 2026-09-30）：有时候想让每个师傅都有台做，不一定最省人。10 场的一天多派的
  // 版本会有七八个，芯片只放前几个和"每人一台"。
  const chips = useMemo(() => {
    const all = d?.plans ?? []
    const spread = all.filter((p) => p.spread)
    return [...all.filter((p) => !p.spread), ...(spread.length > 6 ? [...spread.slice(0, 4), spread[spread.length - 1]] : spread)]
  }, [d])

  // ---- 指派（老板 2026-09-30）：给每条线派一个师傅，写进这条线上每一单
  const chefName = useMemo(() => new Map((d?.chefs ?? []).map((c) => [c.id, c.name])), [d])
  const namesOf = (ids: string[]) => ids.map((id) => chefName.get(id) ?? "已停用的师傅").join("、")
  /** 这条线现在派给了谁：每一单都正好是同一个人才算数；各单不一样 = mixed */
  const chainChef = (chain: string[]): { id: string; mixed: boolean } => {
    const sets = chain.map((id) => byId.get(id)?.chefIds ?? [])
    const one = sets[0]?.length === 1 ? sets[0][0] : null
    if (one && sets.every((s) => s.length === 1 && s[0] === one)) return { id: one, mixed: false }
    return { id: "", mixed: sets.some((s) => s.length > 0) }
  }
  const assignChain = async (ci: number, chain: string[], chefId: string) => {
    if (!chefId) return
    const who = chefName.get(chefId) ?? "这位师傅"
    const change = chain.map((id) => byId.get(id)).filter((s): s is Stop => !!s && !(s.chefIds.length === 1 && s.chefIds[0] === chefId))
    if (!change.length) return
    // 换掉已经派了的人要先问：两个师傅的大单这样派会只剩一个
    const replacing = change.filter((s) => s.chefIds.length > 0)
    if (replacing.length) {
      const ok = await askConfirm({
        title: `改派给 ${who}`,
        message: `${replacing.map((s) => `${s.time} ${s.name}：现在是 ${namesOf(s.chefIds)}`).join("\n")}\n\n改完这几单都只有 ${who} 一个人。`,
        okLabel: "改派",
      })
      if (!ok) return
    }
    setAssigning(ci)
    try {
      for (const s of change) await adminJson(adminKey, "/api/admin/chefs", { body: { action: "assign", order_id: s.id, staff_member_ids: [chefId] } })
    } catch (e) {
      void tell({ title: "没派上", message: e instanceof Error ? e.message : "出错了" })
    } finally {
      await load()
      setAssigning(null)
    }
  }
  // 同一个师傅被派到了两条线上：线是按"一个人跑得过来"拆的，两条都给他多半接不上
  const doubleBooked = (() => {
    if (!plan) return [] as string[]
    const seen = new Map<string, number[]>()
    plan.chains.forEach((c, ci) => {
      const x = chainChef(c)
      if (x.id) seen.set(x.id, [...(seen.get(x.id) ?? []), ci + 1])
    })
    return Array.from(seen.entries())
      .filter(([, v]) => v.length > 1)
      .map(([id, v]) => `${chefName.get(id) ?? "?"} 排在了师傅 ${v.join("、")} 两条线上`)
  })()

  // ---- 批量发 prep sheet（老板 2026-10-02："发送短信给师傅，能够勾选，批量发送"——"就是发 prep sheet"）
  // 按每单现在派给了谁分组（排班的线只是建议，发给谁以指派为准）。每单一条短信：走
  // /api/admin/chefs 的 send_sheet，发票工具从 213 线发备料单链接，和订单弹窗里发的是同一个。
  const [sendOpen, setSendOpen] = useState(false)
  const [sendOff, setSendOff] = useState<Set<string>>(() => new Set())
  const [sendNote, setSendNote] = useState("")
  const [sendState, setSendState] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const sendGroups = useMemo(() => {
    const stops = d?.stops ?? []
    const by = new Map<string, Stop[]>()
    for (const s of stops) for (const cid of s.chefIds) by.set(cid, [...(by.get(cid) ?? []), s])
    return Array.from(by.entries())
      .map(([chefId, list]) => ({ chefId, name: chefName.get(chefId) ?? "已停用的师傅", stops: list, first: stops.indexOf(list[0]) }))
      .sort((a, b) => a.first - b.first)
  }, [d, chefName])
  const unassigned = (d?.stops ?? []).filter((s) => s.chefIds.length === 0)
  const picked = sendGroups.filter((g) => !sendOff.has(g.chefId))
  const msgCount = picked.reduce((n, g) => n + g.stops.length, 0)
  // "83145 N. Shore Dr, Indio, CA 92203" → "Indio"（末尾可能还带 USA）
  const cityOf = (a: string) => {
    const p = a.split(",").map((x) => x.trim()).filter(Boolean)
    if (p.length >= 2 && /^(USA|US|United States)$/i.test(p[p.length - 1])) p.pop()
    if (p.length >= 2 && /^[A-Z]{2}\b/.test(p[p.length - 1])) return p[p.length - 2]
    return p[p.length - 1] ?? a
  }
  const sendSheets = async () => {
    if (sending || !picked.length) return
    const ok = await askConfirm({
      title: "发 prep sheet",
      message: [
        ...picked.map((g) => `${g.name}：${g.stops.map((s) => `${s.time} ${s.name}`).join("、")}`),
        "",
        `一共 ${msgCount} 条短信，从 213 线发出${sendNote.trim() ? `，附言："${sendNote.trim()}"` : ""}。`,
      ].join("\n"),
      okLabel: "发送",
    })
    if (!ok) return
    setSending(true)
    for (const g of picked) {
      for (const s of g.stops) {
        const key = `${s.id}|${g.chefId}`
        setSendState((p) => ({ ...p, [key]: "sending" }))
        try {
          const r = await adminJson<{ ok: boolean; resent?: boolean; sms?: { delivered?: boolean; error?: string } }>(adminKey, "/api/admin/chefs", {
            body: { action: "send_sheet", order_id: s.id, staff_member_id: g.chefId, note: sendNote.trim() || undefined },
          })
          setSendState((p) => ({ ...p, [key]: r.sms && r.sms.delivered === false ? `链接生成了，短信没发出去：${r.sms.error ?? "原因不明"}` : "ok" }))
        } catch (e) {
          setSendState((p) => ({ ...p, [key]: e instanceof Error ? e.message : "没发出去" }))
        }
      }
    }
    setSending(false)
  }

  return (
    <Dialog onClose={onClose} width={720}>
      <DialogHead
        title={d && plan ? `${date} · ${d.stops.length} 场 · ${plan.chefs} 个师傅` : `${date}`}
        lines={["实线 = 拖满也不迟到；虚线 = 拖满会迟到。点圆点看详情。"]}
        onClose={onClose}
      />
      <div className="dialog-col" style={{ gap: 12 }}>
        {err ? <div className="notice danger">{err}</div> : null}
        {!d ? <div style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>算距离中…（第一次打开要给每个地址定位，慢一点）</div> : null}
        {d?.note ? <div className="notice">{d.note}</div> : null}

        {d && chips.length > 1 ? (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {chips.map((p) => (
              <button key={p.key} type="button" className="wb-chip wb-chip-sm" aria-pressed={plan?.key === p.key} onClick={() => setTier(p.key)}>
                {tierLabel(p)}
              </button>
            ))}
          </div>
        ) : null}

        {d && placed.length ? (
          <TileMap
            pins={placed.map((st, i) => ({ id: st.id, lat: st.lat, lng: st.lng, label: String(i + 1), title: `${st.time} ${st.name}`, active: open === st.id }))}
            home={d.home}
            lines={(plan?.links ?? []).map((l) => ({ fromId: l.fromId, toId: l.toId, dashed: l.worstLate > 0, text: `路上 ${l.minutes} 分 · 拖满${when(l.worstLate)}` }))}
            onPick={(id) => setOpen(open === id ? null : id)}
          />
        ) : null}

        {cur ? (
          <div style={{ border: "2px solid var(--color-text)", padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 18 }}>
                {numOf(cur.id)}. {cur.time} {cur.name} <Tag cls="tag-neutral">{cur.guests} 人</Tag>
              </div>
              <span className="mono" style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>{cur.orderNo}</span>
            </div>
            <div style={{ fontSize: 13, marginTop: 6 }}>{cur.address}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => onOpenOrder(cur.id)}>
                打开这一单
              </button>
              <a className="btn btn-secondary btn-sm" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(cur.address)}`} target="_blank" rel="noopener noreferrer">
                导航过去
              </a>
              {cur.phone ? (
                <a className="btn btn-secondary btn-sm" href={`tel:${cur.phone}`}>
                  打给客人
                </a>
              ) : null}
              {cur.approx ? (
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void pin(cur.address)}>
                  这只是大概位置 · 手工定位
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* 排班：这才是这张图要回答的问题 */}
        {plan && d ? (
          <div>
            <div style={{ borderBottom: "2px solid var(--color-text)", paddingBottom: 6, marginBottom: 2, fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 17 }}>
              {plan.chefs} 个师傅
              {plan.onePerParty && plan.spread
                ? "（每场一个师傅，不用赶场）"
                : plan.spread
                  ? "（多派，拖满也不迟到）"
                  : plan.key !== "safe"
                    ? `（拖满的话最多迟到 ${Math.max(0, ...plan.links.map((l) => l.worstLate))} 分）`
                    : "（拖满也不迟到）"}
            </div>
            {doubleBooked.length ? <div className="notice" style={{ marginTop: 8 }}>{doubleBooked.join("；")}——确认时间接得上。</div> : null}
            {plan.chains.map((chain, ci) => {
              const cc = chainChef(chain)
              return (
              <div key={ci} style={{ padding: "9px 0", borderBottom: "1px solid var(--color-divider)" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span className="kicker" style={{ width: 52, flex: "none" }}>师傅 {ci + 1}</span>
                  <div style={{ flex: 1, minWidth: 220, fontSize: 14, display: "flex", flexDirection: "column", gap: 4 }}>
                    {chain.map((id, k) => {
                      const s = byId.get(id)
                      if (!s) return null
                      const link = k > 0 ? plan.links.find((l) => l.fromId === chain[k - 1] && l.toId === id) : null
                      const risky = !!link && link.worstLate > 0
                      return (
                        <div key={id}>
                          {link ? (
                            <div style={{ fontSize: 12.5, color: risky ? "var(--color-accent-700)" : "var(--color-neutral-600)", fontWeight: risky ? 700 : 400, padding: "1px 0 3px 10px", borderLeft: `2px ${risky ? "dashed" : "solid"} var(--color-accent)`, marginLeft: 4, lineHeight: 1.6 }}>
                              路上 {link.minutes} 分{link.miles !== null ? `（${link.miles} mi）` : ""} · <Tag cls={risky ? "tag-accent" : "tag-faint"}>{GRADE_LABEL[link.grade]}</Tag>
                              <br />
                              顺利的话{when(link.bestLate)}，拖满的话{when(link.worstLate)}
                              {link.grade === "late_limit" ? "——到这个数按惯例要给客人补偿" : ""}
                              {link.fix ? (
                                <>
                                  <br />
                                  想稳：{s.name} 推到 {link.fix.laterStart}
                                  {link.fix.earlierStart ? `，或者 ${byId.get(link.fromId)?.name ?? "上一场"} 提前到 ${link.fix.earlierStart} 开` : ""}
                                </>
                              ) : null}
                            </div>
                          ) : null}
                          <button type="button" className="btn btn-ghost" style={{ padding: 0, minHeight: 0, fontWeight: 700, fontSize: 14 }} onClick={() => (s.lat !== null ? setOpen(open === id ? null : id) : onOpenOrder(id))}>
                            {s.time} {s.name}
                          </button>
                          <span style={{ color: "var(--color-neutral-600)" }}> · {s.guests} 人</span>
                          {/* 这条线各单派的人不一样时，逐单写出来，别让下拉框的空白骗人 */}
                          {cc.mixed ? <span style={{ color: "var(--color-neutral-600)" }}> · {s.chefIds.length ? `已派 ${namesOf(s.chefIds)}` : "还没派"}</span> : null}
                          {s.lat === null ? <span style={{ color: "var(--color-accent-700)" }}> · 地址定位不到</span> : null}
                          {s.lat !== null && s.approx ? <span style={{ color: "var(--color-neutral-600)" }}> · 只到城市</span> : null}
                          {s.lat === null || s.approx ? (
                            <button type="button" className="wb-chip wb-chip-sm" style={{ marginLeft: 6 }} disabled={busy} onClick={() => void pin(s.address)}>
                              定位
                            </button>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                  <select
                    className="input"
                    aria-label={`师傅 ${ci + 1} 指派给谁`}
                    style={{ flex: "none", width: 150, minHeight: 34, padding: "4px 8px", fontSize: 13, marginLeft: "auto" }}
                    value={cc.id}
                    disabled={assigning !== null}
                    onChange={(e) => void assignChain(ci, chain, e.target.value)}
                  >
                    <option value="">{assigning === ci ? "派单中…" : cc.mixed ? "各单派的人不一样" : "指派师傅…"}</option>
                    {(d.chefs ?? [])
                      .filter((c) => c.active || c.id === cc.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              )
            })}

            <div style={{ marginTop: 14, border: "2px solid var(--color-text)", padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>发 prep sheet 给师傅</div>
                {!sendOpen ? (
                  <button type="button" className="btn btn-primary btn-sm" disabled={!sendGroups.length} onClick={() => setSendOpen(true)}>
                    选师傅发送
                  </button>
                ) : null}
              </div>
              {!sendGroups.length ? (
                <div style={{ fontSize: 13, color: "var(--color-neutral-600)", marginTop: 6 }}>这天还没给师傅指派单子——先在上面每条线右边选师傅。</div>
              ) : null}
              {sendOpen ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                  {sendGroups.map((g) => (
                    <label key={g.chefId} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", fontSize: 14 }}>
                      <input
                        type="checkbox"
                        style={{ marginTop: 3 }}
                        checked={!sendOff.has(g.chefId)}
                        disabled={sending}
                        onChange={() =>
                          setSendOff((prev) => {
                            const next = new Set(prev)
                            if (next.has(g.chefId)) next.delete(g.chefId)
                            else next.add(g.chefId)
                            return next
                          })
                        }
                      />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <b>{g.name}</b>
                        {g.stops.map((s) => {
                          const st = sendState[`${s.id}|${g.chefId}`]
                          return (
                            <span key={s.id} style={{ display: "block", fontSize: 13, color: "var(--color-neutral-700)" }}>
                              {s.time} {s.name} · {cityOf(s.address)} · {s.guests} 人
                              {st === "sending" ? <span style={{ color: "var(--color-neutral-600)" }}> · 发送中…</span> : null}
                              {st === "ok" ? <span style={{ color: "#16a34a", fontWeight: 700 }}> · 已发</span> : null}
                              {st && st !== "sending" && st !== "ok" ? <span style={{ color: "var(--color-accent-700)" }}> · {st}</span> : null}
                            </span>
                          )
                        })}
                      </span>
                    </label>
                  ))}
                  {unassigned.length ? (
                    <div style={{ fontSize: 12.5, color: "var(--color-accent-700)" }}>
                      还没派师傅、发不了：{unassigned.map((s) => `${s.time} ${s.name}`).join("、")}
                    </div>
                  ) : null}
                  <input className="input" placeholder="附言（可选，会写进短信，英文最好）" value={sendNote} maxLength={200} disabled={sending} onChange={(e) => setSendNote(e.target.value)} />
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button type="button" className="btn btn-primary btn-sm" disabled={sending || !msgCount} onClick={() => void sendSheets()}>
                      {sending ? "发送中…" : `发送 ${msgCount} 条`}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" disabled={sending} onClick={() => setSendOpen(false)}>
                      收起
                    </button>
                    <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>每单一条，带这单的备料单链接；同一单重发会用同一个链接</span>
                  </div>
                </div>
              ) : null}
            </div>

            <div style={{ fontSize: 11.5, color: "var(--color-neutral-600)", marginTop: 12, lineHeight: 1.7 }}>
              算法：第一台准时开 → 开场到装车出发 {d.params.busyMin}–{d.params.busyMax} 分 → 路上 → 下一场提前 {d.params.arriveEarly} 分到。迟到 {d.params.lateOk} 分内算还能接受，{d.params.lateLimit} 分是极限。（设置 → 派工 里能改）
              <br />
              车程来源：{SOURCE_LABEL[d.source]} · 底图 © OpenStreetMap contributors
            </div>
          </div>
        ) : null}
      </div>
    </Dialog>
  )
}
