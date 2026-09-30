"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { adminJson } from "./api"
import { Dialog, DialogHead, Tag } from "./ui"
import { askPrompt, tell } from "./ask"
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
}
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
type Plan = { key: "safe" | "late_ok" | "late_limit"; tolerance: number; chefs: number; chains: string[][]; links: Link[] }
type Resp = {
  date: string
  stops: Stop[]
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
  const [tier, setTier] = useState<Plan["key"]>("safe")

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
    p.key === "safe" ? `稳妥 · ${p.chefs} 个师傅` : p.key === "late_ok" ? `肯迟到 ${p.tolerance} 分内 · ${p.chefs} 个` : `极限迟到 ${p.tolerance} 分 · ${p.chefs} 个`

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

        {d && d.plans.length > 1 ? (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {d.plans.map((p) => (
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
              {plan.chefs} 个师傅{plan.key !== "safe" ? `（拖满的话最多迟到 ${Math.max(0, ...plan.links.map((l) => l.worstLate))} 分）` : "（拖满也不迟到）"}
            </div>
            {plan.chains.map((chain, ci) => (
              <div key={ci} style={{ padding: "9px 0", borderBottom: "1px solid var(--color-divider)" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                  <span className="kicker" style={{ width: 52, flex: "none" }}>师傅 {ci + 1}</span>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 14, display: "flex", flexDirection: "column", gap: 4 }}>
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
                </div>
              </div>
            ))}

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
