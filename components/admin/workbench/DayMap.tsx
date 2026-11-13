"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { adminJson } from "./api"
import { Dialog, DialogHead, Tag } from "./ui"
import { askConfirm, askPrompt, tell } from "./ask"
import { TileMap } from "@/components/schedule/TileMap"
import { coolerSheetHtml, type CoolerParty } from "@/lib/cooler-sheet"

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
  /** 跟台的帮手（学徒），不算师傅、不拿这场工钱 */
  helperIds?: string[]
  /** 要布置桌椅 */
  tables?: boolean
  /** 派工计划：几位师傅几台灶（lib/dispatch-plan.ts）。派的人比计划少，这一单要标红。 */
  plan?: { chefs: number; grills: number; source: "rule" | "owner" | "promise" }
  /** 名单改了还没通知的人（老板 2026-11-13）：add = 要发备料单，remove = 要告诉他不用去 */
  pending?: { add: string[]; remove: string[] }
}
type Chef = { id: string; name: string; active: boolean; canHelp?: boolean }
type Grade = "solid" | "ontime" | "late_ok" | "late_limit"
type Link = {
  fromId: string
  toId: string
  minutes: number
  /** 因为桌椅多留的分钟数，已经算进下面两个数里 */
  extra?: number
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
  /** 三个方案各存各的人 + 定下来的那版（dispatch_day_plans） */
  dayPlan?: { chosenKey: string | null; drafts: Record<string, Record<string, string[]>>; savedAt: string | null; savedBy: string | null }
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
  // 后勤备货单：这一天所有单一次打出来，或者按备货负责人分开打（老板 2026-10-16：
  // "不要一个一个点进去打印"）。数据和订单弹窗那个按钮同一个接口。
  const [coolers, setCoolers] = useState<CoolerParty[] | null>(null)
  useEffect(() => {
    let dead = false
    void adminJson<{ orders: Array<{ cooler?: CoolerParty }> }>(adminKey, `/api/admin/prep?date=${date}`)
      .then((r) => {
        if (!dead) setCoolers(r.orders.map((o) => o.cooler).filter((c): c is CoolerParty => !!c))
      })
      .catch(() => {
        if (!dead) setCoolers([])
      })
    return () => {
      dead = true
    }
  }, [adminKey, date])
  const coolerGroups = useMemo(() => {
    const by = new Map<string, CoolerParty[]>()
    for (const c of coolers ?? []) {
      const k = c.owner?.trim() || "还没定负责人"
      by.set(k, [...(by.get(k) ?? []), c])
    }
    return Array.from(by.entries())
  }, [coolers])
  const printCoolers = (parties: CoolerParty[], who?: string) => {
    const html = coolerSheetHtml(date, parties, who)
    const w = window.open("", "_blank")
    if (w) {
      w.document.open()
      w.document.write(html)
      w.document.close()
    } else {
      window.location.assign(URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" })))
    }
  }
  // 默认看最稳的那版：冒不冒险得是老板自己点过去看的，不是打开就替他选好。
  const [tier, setTier] = useState<string>("safe")
  const [assigning, setAssigning] = useState<number | null>(null)
  // 单场改人（老板 2026-11-13「我想要调整连台下面的师傅，现在调整不了」）：连台线右边的按钮管整条线，
  // 某一场要多加一个人、换一个人，点那一场后面的"改人"，按钮只管这一场。key = 行号:订单 id
  const [editStop, setEditStop] = useState<string | null>(null)
  // 三个方案各存各的人（老板 2026-11-13「这三个tab 数据之间不能串 而且要保存我最终选择的路线」）：
  // 在一个方案里点名字只改这个方案的草稿（存在 dispatch_day_plans，关掉再开还在），不动订单，也不影响
  // 别的方案。点"保存为最终路线"才把这个方案的人写进订单；再打开默认就是这一版。
  // 定下来的那版没有草稿时，显示的就是订单上现在派的人。
  const [drafts, setDrafts] = useState<Record<string, Record<string, string[]>>>({})
  const [chosenKey, setChosenKey] = useState<string | null>(null)
  const [tierPicked, setTierPicked] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await adminJson<Resp>(adminKey, `/api/admin/day-map?date=${date}`)
      setD(r)
      setDrafts(r.dayPlan?.drafts ?? {})
      setChosenKey(r.dayPlan?.chosenKey ?? null)
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
  // 打开时停在定下来的那版
  useEffect(() => {
    if (tierPicked || !d) return
    const k = d.dayPlan?.chosenKey
    if (k && d.plans.some((p) => p.key === k)) setTier(k)
    setTierPicked(true)
  }, [d, tierPicked])

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
  // ---- 派人（老板 2026-11-13）：直接多选，点一下加上、再点一下拿掉，不再分师傅和帮手。
  // 以前是"一个下拉框只能换成一个人 + 一排帮手"，三厨的大单在下拉框里只显示"各单派的人不一样"，
  // 想换其中一个人改不了。现在每个名字一个按钮，作用于这条线上的每一单。
  /** 订单上现在真派的人（师傅和以前记成帮手的都算） */
  const actualOf = (s: Stop) => Array.from(new Set([...s.chefIds, ...(s.helperIds ?? [])]))
  /** 定下来的那版；一版都没定过时，"稳妥"那版就是订单上现在的样子 */
  const baseKey = chosenKey ?? "safe"
  /** 这个方案里这一单派的人：有草稿看草稿；定下来的那版没草稿看订单；别的方案没草稿就是空的 */
  const teamIn = (key: string, orderId: string): string[] => {
    const dr = drafts[key]
    if (dr) return dr[orderId] ?? []
    if (key === baseKey) {
      const s = byId.get(orderId)
      return s ? actualOf(s) : []
    }
    return []
  }
  const teamOf = (orderId: string) => teamIn(tier, orderId)
  /** 这条线上每个人出现在几单里 */
  const chainPeople = (chain: string[]): Map<string, number> => {
    const n = new Map<string, number>()
    for (const id of chain) for (const p of new Set(teamOf(id))) n.set(p, (n.get(p) ?? 0) + 1)
    return n
  }
  /** 这条线上几单派的人不一样（一单的线永远不算） */
  const chainMixed = (chain: string[]): boolean => {
    const keys = chain.map((id) => [...new Set(teamOf(id))].sort().join(","))
    return keys.some((k) => k !== keys[0])
  }
  // 要两位以上师傅的单占好几条线（lib/dispatch.ts planTiers 的 need，老板 2026-11-13）。
  // 一模一样的线（比如 Kande 64 人一场占 3 条）合成一行"师傅 3–5"；
  // 一个人如果已经跑着另一条更长的、经过这一场的线，就不在这条短的线上再列一遍。
  type Row = { chain: string[]; count: number; from: number }
  const rows: Row[] = (() => {
    if (!plan) return []
    const m = new Map<string, Row>()
    let no = 1
    for (const c of plan.chains) {
      const k = c.join(",")
      const r = m.get(k)
      if (r) r.count++
      else m.set(k, { chain: c, count: 1, from: 0 })
    }
    return Array.from(m.values()).map((r) => {
      const out = { ...r, from: no }
      no += r.count
      return out
    })
  })()
  const rowLabel = (r: Row) => (r.count > 1 ? `师傅 ${r.from}–${r.from + r.count - 1}` : `师傅 ${r.from}`)
  const onStop = (s: Stop | undefined, p: string) => !!s && teamOf(s.id).includes(p)
  const covers = (p: string, chain: string[]) => chain.every((id) => onStop(byId.get(id), p))
  /** 这一行显示谁、各在几单上 */
  const rowPeople = (ri: number): Map<string, number> => {
    const c = rows[ri].chain
    const out = new Map<string, number>()
    for (const [p, n] of chainPeople(c)) {
      const full = n >= c.length
      const elsewhere = rows.some((r, rj) => rj !== ri && r.chain.some((id) => c.includes(id)) && covers(p, r.chain) && (full ? r.chain.length > c.length : true))
      if (!elsewhere) out.set(p, n)
    }
    return out
  }
  /** 在别的行上已经跑着这一场的人：这一行的按钮里不列 */
  const takenElsewhere = (ri: number, p: string) => {
    const c = rows[ri].chain
    return rows.some((r, rj) => rj !== ri && r.chain.some((id) => c.includes(id)) && covers(p, r.chain) && !rowPeople(ri).has(p))
  }
  const writeDraft = async (key: string, draft: Record<string, string[]> | null) => {
    setDrafts((prev) => {
      const next = { ...prev }
      if (draft) next[key] = draft
      else delete next[key]
      return next
    })
    try {
      await adminJson(adminKey, "/api/admin/day-map", { body: { action: "save_draft", date, key, draft } })
    } catch (e) {
      void tell({ title: "方案没存上", message: e instanceof Error ? e.message : "出错了" })
    }
  }
  // 点名字只改当前方案的草稿，不动订单、不发短信。
  const togglePerson = async (_ci: number, chain: string[], personId: string, shownFull: boolean) => {
    const draft: Record<string, string[]> = {}
    for (const s of d?.stops ?? []) draft[s.id] = teamOf(s.id)
    for (const id of chain) {
      const cur = draft[id] ?? []
      draft[id] = shownFull ? cur.filter((x) => x !== personId) : cur.includes(personId) ? cur : [...cur, personId]
    }
    await writeDraft(tier, draft)
  }
  const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))
  /** 当前方案和订单上真派的不一样的单 */
  const diffStops = (d?.stops ?? []).filter((s) => !sameSet(teamOf(s.id), actualOf(s)))
  const isFinal = tier === chosenKey && !drafts[tier]
  // 保存为最终路线：把这个方案的人逐单写进订单（不发短信，发通知走"通知改动"），再记下选的是哪版。
  const saveRoute = async () => {
    if (saving || !plan) return
    const lines = diffStops.map((s) => {
      const was = actualOf(s)
      const now = teamOf(s.id)
      return `${s.time} ${s.name}：${was.length ? namesOf(was) : "没人"} → ${now.length ? namesOf(now) : "没人"}`
    })
    const ok = await askConfirm({
      title: `保存为最终路线：${tierLabel(plan)}`,
      message: [lines.length ? lines.join("\n") : "订单上派的人和这版一样，只记下这版是最终路线。", "", "只改订单上的名单，不发短信。备料单已经发过的场，下面会出现\"通知改动\"，你再点一下通知。"].join("\n"),
      okLabel: "保存",
    })
    if (!ok) return
    setSaving(true)
    try {
      for (const s of diffStops) {
        const want = teamOf(s.id)
        await adminJson(adminKey, "/api/admin/chefs", { body: { action: "assign", quiet: true, order_id: s.id, staff_member_ids: want } })
        if ((s.helperIds ?? []).some((h) => !want.includes(h))) {
          await adminJson(adminKey, "/api/admin/chefs", { body: { action: "assign_helpers", quiet: true, order_id: s.id, staff_member_ids: [] } })
        }
      }
      await adminJson(adminKey, "/api/admin/day-map", { body: { action: "choose", date, key: tier } })
    } catch (e) {
      void tell({ title: "没保存完", message: e instanceof Error ? e.message : "出错了" })
    } finally {
      await load()
      setSaving(false)
    }
  }
  // 同一个师傅被派到了两条线上：线是按"一个人跑得过来"拆的，两条都给他多半接不上
  const doubleBooked = (() => {
    if (!plan) return [] as string[]
    const seen = new Map<string, string[]>()
    rows.forEach((r, ri) => {
      for (const id of rowPeople(ri).keys()) seen.set(id, [...(seen.get(id) ?? []), rowLabel(r)])
    })
    return Array.from(seen.entries())
      .filter(([, v]) => v.length > 1)
      .map(([id, v]) => `${chefName.get(id) ?? "?"} 排在了${v.join("、")}两条线上`)
  })()

  // ---- 通知改动（老板 2026-11-13「我需要有个入口最终通知」）：排班图上悄悄改的名单，一次性通知。
  // 拿着备料单、已经不在名单上的 -> 「那场改给别人了，你不用去」；这单发过备料单、新上来还没拿到的 -> 发备料单。
  const pendingStops = (d?.stops ?? []).filter((s) => (s.pending?.add.length ?? 0) + (s.pending?.remove.length ?? 0) > 0)
  const [notifying, setNotifying] = useState(false)
  const notifyChanges = async () => {
    if (notifying || !pendingStops.length) return
    const ok = await askConfirm({
      title: "通知改动",
      message: [
        ...pendingStops.map((s) =>
          [
            `${s.time} ${s.name}：`,
            s.pending!.add.length ? `发备料单给 ${namesOf(s.pending!.add)}` : "",
            s.pending!.add.length && s.pending!.remove.length ? "；" : "",
            s.pending!.remove.length ? `告诉 ${namesOf(s.pending!.remove)} 不用去了（他的备料单作废）` : "",
          ].join(""),
        ),
        "",
        "都从 213 线发短信。",
      ].join("\n"),
      okLabel: "发送",
    })
    if (!ok) return
    setNotifying(true)
    const out: string[] = []
    try {
      for (const s of pendingStops) {
        try {
          const r = await adminJson<{ notice?: string; sheetNotice?: string }>(adminKey, "/api/admin/chefs", { body: { action: "notify_changes", order_id: s.id } })
          const said = [r.notice, r.sheetNotice].filter(Boolean).join("；")
          out.push(`${s.time} ${s.name}：${said || "已通知"}`)
        } catch (e) {
          out.push(`${s.time} ${s.name}：没发出去（${e instanceof Error ? e.message : "出错了"}）`)
        }
      }
      void tell({ title: "改动已通知", message: out.join("\n") })
    } finally {
      await load()
      setNotifying(false)
    }
  }

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
                {chosenKey === p.key ? "✓ " : ""}
                {tierLabel(p)}
                {drafts[p.key] ? " · 改过" : ""}
              </button>
            ))}
          </div>
        ) : null}

        {d && plan ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
            {isFinal && !diffStops.length ? (
              <span style={{ fontWeight: 700 }}>✓ 这是最终路线，订单上就是这样派的</span>
            ) : (
              <>
                <span style={{ color: "var(--color-accent-700)", fontWeight: 700 }}>
                  {tier === chosenKey ? "这版改过，还没保存" : chosenKey ? "这版不是最终路线" : "还没定最终路线"}
                  {diffStops.length ? `（和订单上不一样的有 ${diffStops.length} 场）` : ""}
                </span>
                {drafts[tier] || tier === baseKey ? (
                  <button type="button" className="btn btn-primary btn-sm" disabled={saving || assigning !== null} onClick={() => void saveRoute()}>
                    {saving ? "保存中…" : "保存为最终路线"}
                  </button>
                ) : (
                  <span style={{ color: "var(--color-neutral-600)" }}>这版还没派人：点下面的名字派好，再保存</span>
                )}
                {drafts[tier] ? (
                  <button type="button" className="btn btn-secondary btn-sm" disabled={saving} onClick={() => void writeDraft(tier, null)}>
                    {tier === baseKey ? "撤销改动" : "清空这版"}
                  </button>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {d && placed.length ? (
          <TileMap
            pins={placed.map((st, i) => ({ id: st.id, lat: st.lat, lng: st.lng, label: String(i + 1), title: `${st.time} ${st.name}`, active: open === st.id }))}
            home={d.home}
            lines={(plan?.links ?? []).map((l) => ({ fromId: l.fromId, toId: l.toId, dashed: l.worstLate > 0, text: `路上 ${l.minutes} 分${l.extra ? ` + 桌椅 ${l.extra} 分` : ""} · 拖满${when(l.worstLate)}` }))}
            onPick={(id) => setOpen(open === id ? null : id)}
          />
        ) : null}

        {cur ? (
          <div style={{ border: "2px solid var(--color-text)", padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 18 }}>
                {numOf(cur.id)}. {cur.time} {cur.name} <Tag cls="tag-neutral">{cur.guests} 人</Tag>
                {cur.plan && (cur.plan.chefs > 1 || cur.plan.grills > 1) ? <Tag cls="tag-accent">{cur.plan.chefs} 厨 · {cur.plan.grills} 灶</Tag> : null}
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
            {rows.map((row, ci) => {
              const chain = row.chain
              const people = rowPeople(ci)
              const mixed = chainMixed(chain)
              const busyHere = assigning === ci
              // 这一行的每一场都已经够人（人派在别的行上）——比如 36 人要 2 位，两位都跑着上一场接过来的那条线
              const filledElsewhere = chain.every((id) => {
                const s = byId.get(id)
                return !!s && teamOf(id).length >= Math.max(1, s.plan?.chefs ?? 1)
              })
              return (
              <div key={chain.join(",")} style={{ padding: "9px 0", borderBottom: "1px solid var(--color-divider)" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span className="kicker" style={{ width: 52, flex: "none" }}>{rowLabel(row)}</span>
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
                              路上 {link.minutes} 分{link.miles !== null ? `（${link.miles} mi）` : ""}{link.extra ? <strong style={{ color: "var(--color-accent-700)" }}> + 桌椅多留 {link.extra} 分</strong> : null} · <Tag cls={risky ? "tag-accent" : "tag-faint"}>{GRADE_LABEL[link.grade]}</Tag>
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
                          {s.tables ? <Tag cls="tag-accent">桌椅</Tag> : null}
                          {/* 两位以上师傅的单（规则 / 老板 / 答应过客人）：图上点名，派少了标红——Eileen 10-17 两台灶答应了没派 */}
                          {s.plan && (s.plan.chefs > 1 || s.plan.grills > 1) ? <Tag cls="tag-accent">{s.plan.chefs} 厨 · {s.plan.grills} 灶{s.plan.source === "promise" ? "（答应过）" : ""}</Tag> : null}
                          <span style={{ color: "var(--color-neutral-600)" }}> · {s.guests} 人</span>
                          {s.plan && teamOf(s.id).length < s.plan.chefs ? <span style={{ color: "var(--color-accent-700)", fontWeight: 700 }}> · 要 {s.plan.chefs} 位师傅，已派 {teamOf(s.id).length}</span> : null}
                          {/* 两位以上师傅的单会出现在好几行：一位从上一场接过来，另一位直接到。写明是同一场，不是重复 */}
                          {(() => {
                            const others = rows.filter((r, rj) => rj !== ci && r.chain.includes(id)).map(rowLabel)
                            return others.length ? <span style={{ color: "var(--color-neutral-600)" }}> · 同一场，另外的师傅在「{others.join("」「")}」那行</span> : null
                          })()}
                          {/* 这条线各单派的人不一样时，逐单写出来，别让下拉框的空白骗人 */}
                          {(s.pending?.add.length ?? 0) + (s.pending?.remove.length ?? 0) > 0 ? (
                            <span style={{ color: "var(--color-accent-700)", fontWeight: 700 }}>
                              {" · 待通知"}
                              {s.pending!.add.length ? ` +${namesOf(s.pending!.add)}` : ""}
                              {s.pending!.remove.length ? ` −${namesOf(s.pending!.remove)}` : ""}
                            </span>
                          ) : null}
                          {mixed ? <span style={{ color: "var(--color-neutral-600)" }}> · {teamOf(s.id).length ? `已派 ${namesOf(teamOf(s.id))}` : "还没派"}</span> : null}
                          {s.lat === null ? <span style={{ color: "var(--color-accent-700)" }}> · 地址定位不到</span> : null}
                          {s.lat !== null && s.approx ? <span style={{ color: "var(--color-neutral-600)" }}> · 只到城市</span> : null}
                          {s.lat === null || s.approx ? (
                            <button type="button" className="wb-chip wb-chip-sm" style={{ marginLeft: 6 }} disabled={busy} onClick={() => void pin(s.address)}>
                              定位
                            </button>
                          ) : null}
                          {chain.length > 1 || rows.some((r, rj) => rj !== ci && r.chain.includes(id)) ? (
                            <button type="button" className="wb-chip wb-chip-sm" style={{ marginLeft: 6 }} aria-pressed={editStop === `${ci}:${id}` ? "true" : "false"} onClick={() => setEditStop(editStop === `${ci}:${id}` ? null : `${ci}:${id}`)}>
                              改这一场的人
                            </button>
                          ) : null}
                          {editStop === `${ci}:${id}` ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, margin: "6px 0 2px", padding: 8, border: "1px dashed var(--color-divider)" }}>
                              <span style={{ fontSize: 12, color: "var(--color-neutral-600)", width: "100%" }}>只改 {s.time} {s.name} 这一场：</span>
                              {(d.chefs ?? [])
                                .filter((c) => c.active || c.canHelp || onStop(s, c.id))
                                .map((c) => {
                                  const on = onStop(s, c.id)
                                  return (
                                    <button key={c.id} type="button" className="wb-chip wb-chip-sm" aria-pressed={on ? "true" : "false"} disabled={assigning !== null} onClick={() => void togglePerson(ci, [id], c.id, on)}>
                                      {c.name}
                                    </button>
                                  )
                                })}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ flex: "none", width: 190, marginLeft: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                  {/* 直接多选：点一下加上、再点一下拿掉。只派了其中几单的人显示成虚线框，点一下补齐。 */}
                  <div role="group" aria-label={`${rowLabel(row)} 派谁`} style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                    {(d.chefs ?? [])
                      .filter((c) => (c.active || c.canHelp || people.has(c.id)) && !takenElsewhere(ci, c.id))
                      .map((c) => {
                        const n = people.get(c.id) ?? 0
                        const all = n > 0 && n >= chain.length
                        const some = n > 0 && !all
                        return (
                          <button
                            key={c.id}
                            type="button"
                            className="wb-chip wb-chip-sm"
                            aria-pressed={all ? "true" : some ? "mixed" : "false"}
                            title={some ? `只派了这条线 ${chain.length} 单里的 ${n} 单，点一下补到每一单` : all ? "点一下拿掉" : "点一下加上"}
                            style={some ? { borderStyle: "dashed", fontWeight: 700 } : undefined}
                            disabled={assigning !== null}
                            onClick={() => void togglePerson(ci, chain, c.id, all)}
                          >
                            {c.name}
                            {some ? ` ${n}/${chain.length}` : ""}
                          </button>
                        )
                      })}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
                    {busyHere
                      ? "派单中…"
                      : !people.size && filledElsewhere
                        ? "这几场的人别的行已经派够了，这一行不用再派"
                        : row.count > 1
                          ? `这一行要 ${row.count} 人，已派 ${people.size}`
                          : people.size
                            ? `已派 ${people.size} 人`
                            : "还没派人"}
                  </div>
                  </div>
                </div>
              </div>
              )
            })}

            {pendingStops.length ? (
              <div style={{ marginTop: 14, border: "2px solid var(--color-accent)", padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>通知改动（{pendingStops.length} 场）</div>
                  <button type="button" className="btn btn-primary btn-sm" disabled={notifying || assigning !== null} onClick={() => void notifyChanges()}>
                    {notifying ? "发送中…" : "通知师傅"}
                  </button>
                </div>
                <div style={{ fontSize: 13, marginTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
                  {pendingStops.map((s) => (
                    <div key={s.id}>
                      {s.time} {s.name}
                      {s.pending!.add.length ? <span> · 发备料单给 <strong>{namesOf(s.pending!.add)}</strong></span> : null}
                      {s.pending!.remove.length ? <span> · 告诉 <strong>{namesOf(s.pending!.remove)}</strong> 不用去</span> : null}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: "var(--color-neutral-600)", marginTop: 6 }}>上面点名字只改名单、不发短信。这几场的备料单已经发出去过，名单改了要在这里通知。还没发过备料单的场不用管，前一天照常一起发。</div>
              </div>
            ) : null}

            <div style={{ marginTop: 14, border: "2px solid var(--color-text)", padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>打印后勤备货单</div>
                {coolers && coolers.length ? (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => printCoolers(coolers)}>
                    全部合成一张（{coolers.length} 场）
                  </button>
                ) : null}
              </div>
              {coolers === null ? <div style={{ fontSize: 13, color: "var(--color-neutral-600)", marginTop: 6 }}>读取中…</div> : null}
              {coolers && !coolers.length ? <div style={{ fontSize: 13, color: "var(--color-neutral-600)", marginTop: 6 }}>这天没有要备的单。</div> : null}
              {coolerGroups.length > 1 || (coolerGroups.length === 1 && coolerGroups[0][0] !== "还没定负责人") ? (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 8, fontSize: 13 }}>
                  <span style={{ color: "var(--color-neutral-600)" }}>按负责人：</span>
                  {coolerGroups.map(([who, list]) => (
                    <button key={who} type="button" className="btn btn-secondary btn-sm" onClick={() => printCoolers(list, who === "还没定负责人" ? undefined : who)}>
                      {who}（{list.length} 场）
                    </button>
                  ))}
                </div>
              ) : null}
              <div style={{ fontSize: 12, color: "var(--color-neutral-600)", marginTop: 6 }}>几场合成一张：切多少肉、菜、豆腐，煮多少饭；每场分多少师傅自己拿。负责人在订单弹窗"备货负责人"里选。</div>
            </div>

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
                    <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>每单一条，带这单的备料单链接；同一单重发会换一条新链接，他之前那条作废</span>
                  </div>
                </div>
              ) : null}
            </div>

            <div style={{ fontSize: 11.5, color: "var(--color-neutral-600)", marginTop: 12, lineHeight: 1.7 }}>
              算法：第一台准时开 → 开场到装车出发 {d.params.busyMin}–{d.params.busyMax} 分 → 路上 → 下一场提前 {d.params.arriveEarly} 分到；两台里有一台要布置桌椅的，中间再多留 30 分。迟到 {d.params.lateOk} 分内算还能接受，{d.params.lateLimit} 分是极限。（设置 → 派工 里能改）
              <br />
              车程来源：{SOURCE_LABEL[d.source]} · 底图 © OpenStreetMap contributors
            </div>
          </div>
        ) : null}
      </div>
    </Dialog>
  )
}
