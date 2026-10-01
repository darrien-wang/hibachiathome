"use client"

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react"
import { adminJson } from "./api"
import { Dialog, DialogHead, Tag } from "./ui"
import { askConfirm, askPrompt, tell } from "./ask"
import type { PrepGroup } from "@/lib/prep-bom"
import { bulkName, isBulkItem } from "@/lib/pantry"
import { DressingCalc } from "./DressingCalc"

// 虚拟仓库。两种东西两种记法，混在一起记只会两边都不准：
//   消耗品 —— 按包记。一格 = 一个实物包装，点一下：整包 → 剩半 → 划掉。
//   周转品 —— 按件记，外加"在谁手上"。出去了会回来，包括发给师傅的工服。
// 入库只有 agent 一条路（读小票 / 网购订单 → supply_purchases + 加包），
// 页面上没有入库表单是故意的：账和物分开，账能补录，物只能靠人看一眼。

// 设计稿自带 45 个 SVG 图标（assets/icons/*.svg）。文件进 public/warehouse/icons/
// 之后把这个改成 true，全站图标就出来了，不用动别的代码。
const HAS_ICONS = false
const ICON_BASE = "/warehouse/icons"

type Item = {
  item_key: string
  name: string
  category: string
  kind: "cons" | "ret"
  pack_label: string
  unit: string
  min_qty: number
  par_qty: number
  buy_channel: string | null
  total_qty: number
  whole_only: boolean
  image_url: string | null
  counted_at: string | null
}
type Pack = { item_key: string; idx: number; value: number; source_label: string | null; covers?: number | null; size_note?: string | null; arrived_at?: string | null }
type Hold = { item_key: string; holder_key: string; holder_kind: "chef" | "event" | "misc"; holder_name: string; qty: number; size_note: string | null }
type LogRow = { id: string; item_key: string; body: string; via: string; quote: string | null; created_at: string; batch_id: string | null }
type Record_ = { id: string; date: string; channel: string; store: string; meta: string; lines: Array<{ item_key: string; n: number; raw: string }> }
type Holder = { key: string; name: string; date?: string; guests?: number }
type Resp = {
  today: string
  canWrite: boolean
  items: Item[]
  packs: Record<string, Pack[]>
  holdings: Record<string, Hold[]>
  log: LogRow[]
  records: Record_[]
  chefs: Holder[]
  events: Holder[]
}

const CAT_LABELS: Record<string, string> = {
  protein: "蛋白",
  veg: "蔬菜",
  side: "主食 · 前菜",
  sauce: "酱料 · 调味",
  disposable: "一次性用品",
  equipment: "器材 · 周转",
  uniform: "工服 · 厨具",
}
const CAT_ORDER = ["protein", "veg", "side", "sauce", "disposable", "equipment", "uniform"]
const KIND_NOTE: Record<string, string> = { uniform: "发给厨师，会归还", equipment: "出库后会归还" }
const UNIFORM_SET = ["cap", "chef_coat", "apron"]
const INK = "var(--color-text)"
const MUTED = "var(--color-neutral-700)"
const fmt = (n: number) => String(Math.round(n * 10) / 10)

type Tab = "stock" | "prep" | "sauce" | "in" | "out" | "chef" | "re" | "kit"
type Layout = "A" | "B" | "C"

/* ---------- 小件 ---------- */

function ItemImage({ item, size }: { item: Item; size: number }) {
  const src = item.image_url || (HAS_ICONS ? `${ICON_BASE}/${item.item_key}.svg` : "")
  return (
    <div style={{ width: size, height: size, flex: "none", border: `2px solid ${INK}`, overflow: "hidden", background: "var(--color-surface)", display: "grid", placeItems: "center" }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" style={{ width: "76%", height: "76%", objectFit: "contain", display: "block" }} />
      ) : (
        <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: Math.round(size * 0.34), color: "var(--color-neutral-500)", lineHeight: 1 }}>{item.name.slice(0, 1)}</span>
      )}
    </div>
  )
}

/** 一格 = 一个包装。整包填满，剩半填一半，用完了打个叉但格子还在（今天用了什么一眼看得出）。 */
function PackGrid({ packs, cell, onTap, showCrossed }: { packs: Pack[]; cell: number; onTap: (idx: number) => void; showCrossed: boolean }) {
  const shown = showCrossed ? packs : packs.filter((p) => p.value > 0)
  if (!shown.length) return <div style={{ fontSize: 12.5, color: MUTED }}>库里没有了</div>
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {shown.map((p) => (
        <button
          key={p.idx}
          type="button"
          title={`第 ${p.idx} 包 · ${p.arrived_at === null ? "在途（还没送到）" : p.value === 1 ? "整包" : p.value === 0.5 ? "剩半包" : "已划掉"}${p.size_note ? ` · ${p.size_note}` : ""}${p.source_label ? ` · ${p.source_label}` : ""}`}
          onClick={() => onTap(p.idx)}
          style={{ width: cell, height: cell, border: `2px ${p.arrived_at === null ? "dashed" : "solid"} ${p.value === 0 ? "var(--color-divider)" : INK}`, position: "relative", overflow: "hidden", cursor: "pointer", flex: "none", background: "var(--color-bg)", padding: 0, opacity: p.arrived_at === null ? 0.45 : 1 }}
        >
          <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: p.value === 1 ? "100%" : p.value === 0.5 ? "50%" : "0%", background: INK }} />
          {p.value === 0 ? <span style={{ position: "absolute", left: "-30%", top: "calc(50% - 1px)", width: "160%", height: 2, background: "var(--color-accent)", transform: "rotate(-45deg)" }} /> : null}
        </button>
      ))}
    </div>
  )
}

function Legend() {
  const box: CSSProperties = { width: 14, height: 14, border: `2px solid ${INK}`, flex: "none" }
  const row: CSSProperties = { display: "flex", gap: 6, alignItems: "center" }
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", fontSize: 12.5, color: MUTED, flexWrap: "wrap" }}>
      <span style={row}>
        <span style={{ ...box, background: INK }} />整包
      </span>
      <span style={row}>
        <span style={{ ...box, background: `linear-gradient(to top, ${INK} 50%, transparent 50%)` }} />剩半包
      </span>
      <span style={row}>
        <span style={{ ...box, border: "2px solid var(--color-divider)", position: "relative", overflow: "hidden" }}>
          <span style={{ position: "absolute", left: "-30%", top: "calc(50% - 1px)", width: "160%", height: 2, background: "var(--color-accent)", transform: "rotate(-45deg)", display: "block" }} />
        </span>
        已划掉
      </span>
      <span style={row}>
        <span style={{ ...box, border: "2px dashed var(--color-text)", opacity: 0.45 }} />在途
      </span>
      <span style={{ whiteSpace: "nowrap" }}>点格子：整包 → 半包 → 划掉</span>
    </div>
  )
}

function Big({ value, unit, color }: { value: string; unit: string; color?: string }) {
  return (
    <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 22, lineHeight: 1, color: color ?? INK, fontVariantNumeric: "tabular-nums" }}>
      {value}
      <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 4, color: MUTED }}>{unit}</span>
    </div>
  )
}

/* ---------- 视图模型 ---------- */

type Vm = {
  item: Item
  id: string
  name: string
  catLabel: string
  sub: string
  isCons: boolean
  packs: Pack[]
  remain: number
  need: boolean
  hold: Hold[]
  out: number
  inStock: number
  big: string
  bigUnit: string
  tag: string
  tagCls: string
  numColor: string
  stripe: string
  cellBg: string
  ratio: number
  outNote: string
  /** 已下单还没送到的包数。不算在库，但页面要显示，免得重复买。 */
  inTransit: number
}

function buildVm(item: Item, packs: Pack[], hold: Hold[]): Vm {
  const base = { item, id: item.item_key, name: item.name, catLabel: CAT_LABELS[item.category] ?? item.category }
  if (item.kind === "cons") {
    // 在途的不算在库：已下单没送到的东西，冰箱里没有。但要看得见它在路上，
    // 不然会重复买一遍（2026-09-25 RD 那单差点这样）。
    const remain = packs.filter((p) => p.arrived_at !== null).reduce((a, p) => a + Number(p.value), 0)
    const inTransit = packs.filter((p) => p.arrived_at === null).reduce((a, p) => a + Number(p.value), 0)
    const need = remain < item.min_qty
    const zero = remain === 0
    return {
      ...base,
      sub: item.pack_label,
      isCons: true,
      packs,
      remain,
      need,
      hold: [],
      out: 0,
      inStock: 0,
      big: fmt(remain),
      bigUnit: item.unit,
      tag: zero ? "缺货" : need ? "需补货" : remain === item.min_qty ? "到安全线" : "充足",
      tagCls: zero || need ? "tag-accent" : remain === item.min_qty ? "tag-outline" : "tag-neutral",
      numColor: need ? "var(--color-accent-700)" : INK,
      stripe: need ? "var(--color-accent)" : remain === item.min_qty ? INK : "transparent",
      cellBg: need ? "var(--color-accent-100)" : "var(--color-bg)",
      ratio: item.min_qty > 0 ? remain / item.min_qty : remain > 0 ? 99 : 0,
      outNote: "",
      inTransit,
    }
  }
  const out = hold.reduce((a, h) => a + h.qty, 0)
  const inStock = item.total_qty - out
  const uni = item.category === "uniform"
  return {
    ...base,
    sub: `共 ${item.total_qty} ${item.unit}`,
    isCons: false,
    packs: [],
    remain: inStock,
    need: false,
    hold,
    out,
    inStock,
    big: `${inStock}/${item.total_qty}`,
    bigUnit: item.unit,
    tag: out ? (uni ? `在厨师手上 ${out}` : `外出 ${out}`) : item.counted_at ? "全部在库" : "待实盘",
    tagCls: out ? "tag-outline" : item.counted_at ? "tag-neutral" : "tag-faint",
    numColor: INK,
    stripe: "transparent",
    cellBg: "var(--color-bg)",
    ratio: 99,
    outNote: out ? hold.map((h) => `${h.holder_name} ${h.qty}`).join(" · ") : "全部在库",
    inTransit: 0,
  }
}

/* ---------- 主体 ---------- */

export default function WarehouseTab({ adminKey, isMobile }: { adminKey: string; isMobile: boolean }) {
  const [d, setD] = useState<Resp | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<Tab>("stock")
  const [layout, setLayout] = useState<Layout>("A")
  const [showCrossed, setShowCrossed] = useState(true)
  const [detail, setDetail] = useState<string | null>(null)
  const [toast, setToast] = useState<{ text: string; batch: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    try {
      setD(await adminJson<Resp>(adminKey, "/api/admin/warehouse"))
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "读取失败")
    }
  }, [adminKey])
  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  const post = useCallback(
    async (body: Record<string, unknown>) => {
      if (busy) return
      setBusy(true)
      try {
        const r = await adminJson<{ toast?: string; batch_id?: string }>(adminKey, "/api/admin/warehouse", { body })
        await load()
        if (r.toast && r.batch_id) setToast({ text: r.toast, batch: r.batch_id })
        setErr(null)
      } catch (e) {
        setErr(e instanceof Error ? e.message : "操作失败")
      } finally {
        setBusy(false)
      }
    },
    [adminKey, busy, load],
  )

  const vms = useMemo(() => {
    if (!d) return [] as Vm[]
    return d.items.map((it) => buildVm(it, d.packs[it.item_key] ?? [], d.holdings[it.item_key] ?? []))
  }, [d])
  const byId = useMemo(() => Object.fromEntries(vms.map((v) => [v.id, v])), [vms])
  const cons = vms.filter((v) => v.isCons)
  const rets = vms.filter((v) => !v.isCons)
  const needs = cons.filter((v) => v.need)
  const outCount = rets.reduce((a, v) => a + v.out, 0)
  const todayCross = (d?.log ?? []).filter((l) => l.body.startsWith("划掉") && l.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10)).length

  if (!d) return <div style={{ color: MUTED, fontSize: 13 }}>{err ?? "读取中…"}</div>

  // 消耗品的格子改成只读（老板 2026-09-29 定）。数量在「备货 → 对货」里改：
  // 库存不再是一本要天天记的账，而是每次备货时顺手记下的一次观察。
  // 周转品那边（桌椅、工服借还）不受影响——那是另一件事，还得手动记。
  const tap = (_key: string, _idx: number) => {
    void tell({
      title: "库存改到备货里了",
      message: "勾上要备的订单 →「对货」那一段点一下实际还有几瓶。只问这几单用得到的东西，够的不用管。",
    })
  }
  const move = (moves: Array<Partial<Hold> & { delta: number }>) =>
    void post({ action: "move", moves: moves.map((m) => ({ item_key: m.item_key, holder_key: m.holder_key, holder_kind: m.holder_kind, holder_name: m.holder_name, delta: m.delta, size_note: m.size_note })) })

  const defaultEvent = d.events[0] ?? null
  const cats = CAT_ORDER.map((k) => ({ key: k, label: CAT_LABELS[k], note: KIND_NOTE[k] ?? "消耗掉要补货", items: vms.filter((v) => v.item.category === k) })).filter((c) => c.items.length)

  const restockGroups = (() => {
    const by: Record<string, Vm[]> = {}
    for (const v of needs) (by[v.item.buy_channel ?? "未定渠道"] = by[v.item.buy_channel ?? "未定渠道"] ?? []).push(v)
    return Object.entries(by).map(([store, list]) => ({ store, channel: store === "Instacart" ? "网购" : "线下", items: list }))
  })()
  const copyText = restockGroups
    .map((g) => `【${g.store}】\n` + g.items.map((v) => `${v.name} ${Math.ceil(v.item.par_qty - v.remain)} ${v.item.unit}`).join("\n"))
    .join("\n\n")

  const tabs: Array<[Tab, string, string]> = [
    ["prep", "备货", ""],
    ["sauce", "姜汁酱", ""],
    ["stock", "库存 · 只读", ""],
    ["in", "入库记录", ""],
    ["out", "出库 · 归还", outCount ? String(outCount) : ""],
    ["chef", "厨师", ""],
    ["re", "补货清单", needs.length ? String(needs.length) : ""],
    ["kit", "学员套装", ""],
  ]

  /* --- 周转品的两个按钮 --- */
  const RetControls = ({ v, block }: { v: Vm; block?: boolean }) => {
    const uni = v.item.category === "uniform"
    const openIt = () => setDetail(v.id)
    const onOut = uni || !defaultEvent ? openIt : () => move([{ item_key: v.id, holder_key: defaultEvent.key, holder_kind: "event", holder_name: defaultEvent.name, delta: 1 }])
    const first = v.hold[0]
    const onBack = uni ? openIt : first ? () => move([{ item_key: v.id, holder_key: first.holder_key, holder_kind: first.holder_kind, holder_name: first.holder_name, delta: -1 }]) : openIt
    return (
      <div style={{ display: block ? "grid" : "flex", gridTemplateColumns: block ? "1fr 1fr" : undefined, border: `2px solid ${INK}` }}>
        <button type="button" disabled={busy || v.inStock === 0} onClick={onOut} className="wh-seg" style={{ borderRight: `2px solid ${INK}` }}>
          {uni ? "发给…" : "出库 1"}
        </button>
        <button type="button" disabled={busy || v.out === 0} onClick={onBack} className="wh-seg">
          {uni ? "归还…" : "归还 1"}
        </button>
      </div>
    )
  }

  const StatStrip = (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${isMobile ? 130 : 150}px, 1fr))`, border: `2px solid ${INK}`, marginBottom: 24 }}>
      {[
        { label: "需补货", value: String(needs.length), color: needs.length ? "var(--color-accent-700)" : INK },
        { label: "外出 / 在厨师手上", value: `${outCount} 件`, color: INK },
        { label: "今日划掉", value: `${todayCross} 次`, color: INK },
        { label: "最近入库", value: d.records[0]?.date ?? "—", color: INK },
      ].map((s) => (
        <div key={s.label} style={{ padding: 16, borderRight: `2px solid ${INK}`, marginRight: -2, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 12, letterSpacing: "0.06em", color: MUTED }}>{s.label}</div>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: isMobile ? 28 : 36, lineHeight: 1, color: s.color }}>{s.value}</div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="wh">
      <style>{`
        .wh .wh-seg { border: 0; background: var(--color-bg); color: var(--color-text); font: inherit; font-size: 13px; font-weight: 600; padding: 0 12px; min-height: 44px; cursor: pointer; text-align: left; white-space: nowrap; }
        .wh .wh-seg:hover:not(:disabled) { background: var(--color-accent-100); }
        .wh .wh-seg:disabled { opacity: .4; cursor: not-allowed; }
        .wh .wh-seg.ink { background: var(--color-text); color: var(--color-bg); }
        .wh .wh-seg.ink:hover:not(:disabled) { background: var(--color-accent-600); }
        .wh .wh-nav { flex: none; background: transparent; border: 0; padding: 10px 0; margin-right: 24px; font: inherit; font-size: 15px; cursor: pointer; display: flex; gap: 6px; align-items: baseline; white-space: nowrap; color: var(--color-text); border-bottom: 4px solid transparent; }
        .wh .wh-nav[data-on="1"] { border-bottom-color: var(--color-accent); font-weight: 700; }
        .wh .wh-nav:hover { color: var(--color-accent-700); }
        .wh .wh-row { display: grid; grid-template-columns: minmax(170px, 1.3fr) minmax(0, 2.4fr) auto; gap: 16px; align-items: center; padding: 12px 0; border-bottom: 1px solid var(--color-divider); }
        @media (max-width: 720px) { .wh .wh-row { grid-template-columns: 1fr; gap: 10px; } }
      `}</style>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 26, margin: 0 }}>虚拟仓库</h2>
          <span style={{ fontSize: 13, color: MUTED }}>{d.today}</span>
        </div>
        <div style={{ fontSize: 12.5, color: MUTED, maxWidth: 430 }}>入库由 agent 按小票和网购订单录入。用掉的可以在这里点格子划掉，也可以直接在聊天里告诉 agent。</div>
      </div>

      <nav style={{ display: "flex", overflowX: "auto", borderBottom: `2px solid ${INK}`, marginBottom: 20 }}>
        {tabs.map(([k, label, badge]) => (
          <button key={k} type="button" className="wh-nav" data-on={tab === k ? "1" : "0"} style={{ marginBottom: -2 }} onClick={() => { setTab(k); setCopied(false) }}>
            {label}
            {badge ? <span style={{ fontSize: 12, color: "var(--color-accent-700)", fontWeight: 700 }}>{badge}</span> : null}
          </button>
        ))}
      </nav>

      {err ? <div className="notice danger" style={{ marginBottom: 12 }}>{err}</div> : null}

      {tab === "stock" ? (
        <>
          {StatStrip}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ display: "flex", border: `2px solid ${INK}` }}>
              {([["A", "清单"], ["B", "货架"], ["C", "分区"]] as Array<[Layout, string]>).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setLayout(k)} className="wh-seg" style={{ borderRight: k === "C" ? 0 : `2px solid ${INK}`, minHeight: 40, background: layout === k ? INK : "var(--color-bg)", color: layout === k ? "var(--color-bg)" : INK }}>
                  {k} · {l}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              <Legend />
              <label style={{ fontSize: 12.5, color: MUTED, display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
                <input type="checkbox" checked={showCrossed} onChange={(e) => setShowCrossed(e.target.checked)} />
                显示划掉的
              </label>
            </div>
          </div>

          {layout === "A" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              {cats.map((c) => (
                <section key={c.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `2px solid ${INK}`, paddingBottom: 8 }}>
                    <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 19 }}>{c.label}</div>
                    <div style={{ fontSize: 12.5, color: MUTED }}>{c.note}</div>
                  </div>
                  {c.items.map((v) => (
                    <div key={v.id} className="wh-row">
                      <button type="button" onClick={() => setDetail(v.id)} style={{ background: "transparent", border: 0, padding: 0, cursor: "pointer", display: "flex", gap: 12, alignItems: "center", textAlign: "left", color: "inherit", font: "inherit" }}>
                        <ItemImage item={v.item} size={56} />
                        <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                          <span style={{ fontWeight: 700, fontSize: 15 }}>{v.name}</span>
                          <span style={{ fontSize: 12, color: MUTED }}>{v.sub}</span>
                        </span>
                      </button>
                      {v.isCons ? (
                        <PackGrid packs={v.packs} cell={40} showCrossed={showCrossed} onTap={(i) => tap(v.id, i)} />
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                          <RetControls v={v} />
                          <div title={v.outNote} style={{ flex: 1, minWidth: 110, height: 12, border: `2px solid ${INK}`, position: "relative" }}>
                            <div style={{ position: "absolute", inset: 0, width: `${v.item.total_qty ? (v.inStock / v.item.total_qty) * 100 : 0}%`, background: INK }} />
                          </div>
                        </div>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                        <Big value={v.big} unit={v.bigUnit} color={v.numColor} />
                        <Tag cls={v.tagCls}>{v.tag}</Tag>
                        {v.inTransit > 0 ? <Tag cls="tag-outline">在途 {fmt(v.inTransit)} {v.bigUnit}</Tag> : null}
                      </div>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          ) : null}

          {layout === "B" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              {cats.map((c) => (
                <section key={c.key}>
                  <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 19, marginBottom: 8 }}>{c.label}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 2, background: INK, border: `2px solid ${INK}` }}>
                    {c.items.map((v) => (
                      <div key={v.id} style={{ background: v.cellBg, padding: 16, display: "flex", flexDirection: "column", gap: 12, minHeight: 172 }}>
                        <button type="button" onClick={() => setDetail(v.id)} style={{ background: "transparent", border: 0, padding: 0, cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start", textAlign: "left", color: "inherit", font: "inherit" }}>
                          <span style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                            <ItemImage item={v.item} size={40} />
                            <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                              <span style={{ fontWeight: 700, fontSize: 15 }}>{v.name}</span>
                              <span style={{ fontSize: 12, color: MUTED }}>{v.sub}</span>
                            </span>
                          </span>
                        </button>
                        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 38, lineHeight: 1, letterSpacing: "-0.02em", color: v.numColor }}>
                          {v.big}
                          <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 6, color: MUTED, letterSpacing: 0 }}>{v.bigUnit}</span>
                        </div>
                        <div style={{ marginTop: "auto" }}>
                          {v.isCons ? <PackGrid packs={v.packs} cell={36} showCrossed={showCrossed} onTap={(i) => tap(v.id, i)} /> : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              <div style={{ fontSize: 12.5, color: MUTED }}>{v.outNote}</div>
                              <RetControls v={v} block />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : null}

          {layout === "C" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: 32 }}>
              <section>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `2px solid ${INK}`, paddingBottom: 8 }}>
                  <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 19 }}>消耗品 · 用完要补</div>
                  <div style={{ fontSize: 12.5, color: MUTED }}>按剩余量排序</div>
                </div>
                {cons
                  .slice()
                  .sort((a, b) => a.ratio - b.ratio)
                  .map((v) => (
                    <div key={v.id} style={{ display: "grid", gridTemplateColumns: "4px 56px minmax(0,1fr) auto", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--color-divider)", alignItems: "start" }}>
                      <div style={{ alignSelf: "stretch", background: v.stripe }} />
                      <ItemImage item={v.item} size={56} />
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                        <button type="button" onClick={() => setDetail(v.id)} style={{ background: "transparent", border: 0, padding: 0, cursor: "pointer", display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", textAlign: "left", color: "inherit", font: "inherit" }}>
                          <span style={{ fontWeight: 700, fontSize: 15 }}>{v.name}</span>
                          <span style={{ fontSize: 12, color: MUTED }}>{v.catLabel} · {v.sub}</span>
                        </button>
                        <PackGrid packs={v.packs} cell={36} showCrossed={showCrossed} onTap={(i) => tap(v.id, i)} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, minWidth: 76 }}>
                        <Big value={v.big} unit={v.bigUnit} color={v.numColor} />
                        <Tag cls={v.tagCls}>{v.tag}</Tag>
                      </div>
                    </div>
                  ))}
              </section>
              <section>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `2px solid ${INK}`, paddingBottom: 8 }}>
                  <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 19 }}>周转品 · 出去会回来</div>
                  <div style={{ fontSize: 12.5, color: MUTED }}>在库 / 总数</div>
                </div>
                {rets.map((v) => (
                  <div key={v.id} style={{ padding: "16px 0", borderBottom: "1px solid var(--color-divider)", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <button type="button" onClick={() => setDetail(v.id)} style={{ background: "transparent", border: 0, padding: 0, cursor: "pointer", fontWeight: 700, fontSize: 15, display: "flex", gap: 12, alignItems: "center", color: "inherit", font: "inherit" }}>
                        <ItemImage item={v.item} size={48} />
                        {v.name}
                      </button>
                      <Big value={v.big} unit={v.bigUnit} />
                    </div>
                    <div style={{ display: "flex", height: 18, border: `2px solid ${INK}` }}>
                      <div style={{ width: `${v.item.total_qty ? (v.inStock / v.item.total_qty) * 100 : 0}%`, background: INK }} />
                      <div style={{ flex: 1, background: "repeating-linear-gradient(-45deg, var(--color-accent-200) 0 4px, var(--color-bg) 4px 8px)" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 12.5, color: MUTED }}>{v.outNote}</div>
                      <RetControls v={v} />
                    </div>
                  </div>
                ))}
              </section>
            </div>
          ) : null}
        </>
      ) : null}

      {tab === "prep" ? <PrepPlanner adminKey={adminKey} events={d.events} /> : null}

      {tab === "sauce" ? <DressingCalc events={d.events} /> : null}

      {tab === "kit" ? <TraineeKits adminKey={adminKey} /> : null}

      {tab === "in" ? (
        <>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 24 }}>入库记录</div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>agent 从线下小票和网购订单里读出的内容，按包装记进库存。</div>
          </div>
          {d.records.length === 0 ? (
            <div style={{ padding: "24px 0", color: MUTED, fontSize: 13 }}>还没有带行项目的采购记录。把小票发给 agent，它会记成本、拆行项目并加进仓库。</div>
          ) : (
            <div style={{ borderTop: `2px solid ${INK}` }}>
              {d.records.map((r) => (
                <div key={r.id} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))", gap: 24, padding: "24px 0", borderBottom: `2px solid ${INK}` }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Tag cls={r.channel === "网购订单" ? "tag-outline" : "tag-neutral"}>{r.channel}</Tag>
                      <Tag cls="tag-outline">{r.date}</Tag>
                    </div>
                    <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 20 }}>{r.store}</div>
                    <div style={{ fontSize: 12.5, color: MUTED }}>{r.meta}</div>
                  </div>
                  <div>
                    {r.lines.map((ln, i) => {
                      const v = byId[ln.item_key]
                      return (
                        <button key={`${ln.item_key}-${i}`} type="button" onClick={() => v && setDetail(ln.item_key)} style={{ width: "100%", background: "transparent", border: 0, borderBottom: "1px solid var(--color-divider)", padding: "8px 0", display: "grid", gridTemplateColumns: "40px minmax(0,1fr) auto", gap: 12, alignItems: "center", cursor: v ? "pointer" : "default", textAlign: "left", color: "inherit", font: "inherit" }}>
                          {v ? <ItemImage item={v.item} size={40} /> : <span />}
                          <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                            <span style={{ fontWeight: 600, fontSize: 14 }}>{v?.name ?? ln.item_key}</span>
                            <span style={{ fontSize: 11.5, color: MUTED, fontFamily: "ui-monospace, monospace", overflowWrap: "anywhere" }}>{ln.raw}</span>
                          </span>
                          <span style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}>+{ln.n} {v?.item.unit ?? ""}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}

      {tab === "out" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: 32 }}>
          <section>
            <div style={{ borderBottom: `2px solid ${INK}`, paddingBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 19 }}>外出中</div>
              <div style={{ fontSize: 12.5, color: MUTED }}>{outCount} 件</div>
            </div>
            {outCount === 0 ? (
              <div style={{ padding: "24px 0", color: MUTED, fontSize: 13 }}>周转品都已在库。</div>
            ) : (
              Object.entries(
                rets.reduce<Record<string, { name: string; kind: string; rows: Array<{ v: Vm; h: Hold }> }>>((acc, v) => {
                  for (const h of v.hold) {
                    acc[h.holder_key] = acc[h.holder_key] ?? { name: h.holder_name, kind: h.holder_kind, rows: [] }
                    acc[h.holder_key].rows.push({ v, h })
                  }
                  return acc
                }, {}),
              ).map(([hk, g]) => (
                <div key={hk} style={{ paddingTop: 16 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", paddingBottom: 8 }}>
                    <Tag cls={g.kind === "event" ? "tag-accent" : "tag-neutral"}>{g.kind === "event" ? "活动" : "厨师"}</Tag>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{g.name}</span>
                    <span style={{ fontSize: 12.5, color: MUTED }}>{g.rows.reduce((a, r) => a + r.h.qty, 0)} 件</span>
                  </div>
                  {g.rows.map(({ v, h }) => (
                    <div key={v.id} style={{ display: "grid", gridTemplateColumns: "40px minmax(0,1fr) auto", gap: 12, alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--color-divider)" }}>
                      <ItemImage item={v.item} size={40} />
                      <button type="button" onClick={() => setDetail(v.id)} style={{ background: "transparent", border: 0, padding: 0, cursor: "pointer", display: "flex", flexDirection: "column", gap: 2, minWidth: 0, textAlign: "left", color: "inherit", font: "inherit" }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>
                          {v.name} <span style={{ color: "var(--color-accent-700)" }}>× {h.qty}</span>
                        </span>
                        <span style={{ fontSize: 11.5, color: MUTED }}>{[h.size_note, v.catLabel].filter(Boolean).join(" · ")}</span>
                      </button>
                      <div style={{ display: "flex", border: `2px solid ${INK}` }}>
                        <button type="button" disabled={busy} className="wh-seg" style={{ borderRight: `2px solid ${INK}` }} onClick={() => move([{ item_key: v.id, holder_key: h.holder_key, holder_kind: h.holder_kind, holder_name: h.holder_name, delta: -1 }])}>
                          归还 1
                        </button>
                        <button type="button" disabled={busy} className="wh-seg ink" onClick={() => move([{ item_key: v.id, holder_key: h.holder_key, holder_kind: h.holder_kind, holder_name: h.holder_name, delta: -h.qty }])}>
                          全部归还
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </section>
          <section>
            <div style={{ borderBottom: `2px solid ${INK}`, paddingBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 19 }}>出入流水</div>
              <div style={{ fontSize: 12.5, color: MUTED, textAlign: "right" }}>手动点的和 agent 划的都在这里</div>
            </div>
            {d.log.length === 0 ? <div style={{ padding: "24px 0", color: MUTED, fontSize: 13 }}>还没有动静。</div> : null}
            {d.log.map((l) => (
              <div key={l.id} style={{ display: "grid", gridTemplateColumns: "56px minmax(0,1fr) auto", gap: 12, alignItems: "baseline", padding: "12px 0", borderBottom: "1px solid var(--color-divider)" }}>
                <div style={{ fontSize: 12.5, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{new Date(l.created_at).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(/\//g, "-")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <div style={{ fontSize: 14 }}>
                    <button type="button" onClick={() => byId[l.item_key] && setDetail(l.item_key)} style={{ fontWeight: 700, cursor: "pointer", background: "transparent", border: 0, padding: 0, color: "inherit", font: "inherit" }}>
                      {byId[l.item_key]?.name ?? l.item_key}
                    </button>
                    {"　"}
                    {l.body}
                  </div>
                  {l.quote ? <div style={{ fontSize: 11.5, color: MUTED }}>“{l.quote}”</div> : null}
                </div>
                <Tag cls={l.via === "agent" ? "tag-accent" : "tag-outline"}>{l.via === "agent" ? "聊天 · agent" : "手动"}</Tag>
              </div>
            ))}
          </section>
        </div>
      ) : null}

      {tab === "chef" ? (
        <>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 24 }}>厨师</div>
            <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>每位师傅手上的工服、刀具和带走的器材。可以在这里点，也可以跟 agent 说“Blu 领走了一套工服”。</div>
          </div>
          {d.chefs.length === 0 ? (
            <div style={{ color: MUTED, fontSize: 13 }}>厨师页签里还没有在职师傅。</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 330px), 1fr))", gap: 2, background: INK, border: `2px solid ${INK}` }}>
              {d.chefs.map((c) => {
                const held = rets.map((v) => ({ v, h: v.hold.find((x) => x.holder_key === c.key) })).filter((x) => x.h) as Array<{ v: Vm; h: Hold }>
                const sets = Math.min(...UNIFORM_SET.map((id) => byId[id]?.hold.find((h) => h.holder_key === c.key)?.qty ?? 0))
                const noSet = UNIFORM_SET.some((id) => (byId[id]?.inStock ?? 0) < 1)
                return (
                  <section key={c.key} style={{ background: "var(--color-bg)", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 24, lineHeight: 1 }}>{c.name}</div>
                      <div style={{ fontSize: 12.5, color: MUTED }}>工服 {Number.isFinite(sets) ? sets : 0} 套 · 共 {held.reduce((a, x) => a + x.h.qty, 0)} 件</div>
                    </div>
                    <div style={{ borderTop: `2px solid ${INK}` }}>
                      {held.length === 0 ? <div style={{ padding: "12px 0", fontSize: 13, color: MUTED }}>手上没有东西。</div> : null}
                      {held.map(({ v, h }) => (
                        <div key={v.id} style={{ display: "grid", gridTemplateColumns: "40px minmax(0,1fr) auto", gap: 12, alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--color-divider)" }}>
                          <ItemImage item={v.item} size={40} />
                          <button type="button" onClick={() => setDetail(v.id)} style={{ background: "transparent", border: 0, padding: 0, cursor: "pointer", display: "flex", flexDirection: "column", gap: 2, minWidth: 0, textAlign: "left", color: "inherit", font: "inherit" }}>
                            <span style={{ fontWeight: 700, fontSize: 14 }}>
                              {v.name} <span style={{ color: MUTED, fontWeight: 600 }}>× {h.qty}</span>
                            </span>
                            <span style={{ fontSize: 11.5, color: MUTED }}>{[h.size_note, v.catLabel].filter(Boolean).join(" · ")}</span>
                          </button>
                          <div style={{ display: "flex", border: `2px solid ${INK}` }}>
                            <button type="button" disabled={busy} className="wh-seg" onClick={() => move([{ item_key: v.id, holder_key: c.key, holder_kind: "chef", holder_name: c.name, delta: -1 }])}>
                              归还 1
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: "auto" }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={busy || noSet}
                        onClick={() => move(UNIFORM_SET.map((id) => ({ item_key: id, holder_key: c.key, holder_kind: "chef" as const, holder_name: c.name, delta: 1 })))}
                      >
                        发一套工服（帽子 + 厨师服 + 围裙）
                      </button>
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </>
      ) : null}

      {tab === "re" ? (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 24 }}>补货清单</div>
              <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>剩余低于安全线的消耗品，建议补到常备量。</div>
            </div>
            {restockGroups.length ? (
              <button type="button" className="btn btn-primary" onClick={() => { void navigator.clipboard?.writeText(copyText); setCopied(true) }}>
                {copied ? "已复制" : "复制清单"}
              </button>
            ) : null}
          </div>
          {restockGroups.length === 0 ? (
            <div style={{ padding: "24px 0", color: MUTED, fontSize: 13 }}>暂时都在安全线以上。</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 330px), 1fr))", gap: 2, background: INK, border: `2px solid ${INK}` }}>
              {restockGroups.map((g) => (
                <section key={g.store} style={{ background: "var(--color-bg)", padding: "16px 24px 24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `2px solid ${INK}`, paddingBottom: 8 }}>
                    <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 19 }}>{g.store}</div>
                    <div style={{ fontSize: 12.5, color: MUTED }}>{g.channel} · {g.items.length} 项</div>
                  </div>
                  {g.items.map((v) => (
                    <button key={v.id} type="button" onClick={() => setDetail(v.id)} style={{ width: "100%", background: "transparent", border: 0, borderBottom: "1px solid var(--color-divider)", display: "grid", gridTemplateColumns: "48px minmax(0,1fr) auto", gap: 12, alignItems: "center", padding: "12px 0", cursor: "pointer", textAlign: "left", color: "inherit", font: "inherit" }}>
                      <ItemImage item={v.item} size={48} />
                      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{v.name}</span>
                        <span style={{ fontSize: 11.5, color: MUTED }}>剩 {fmt(v.remain)} {v.item.unit} · 安全线 {v.item.min_qty} · 常备 {v.item.par_qty} · {v.item.pack_label}</span>
                      </span>
                      <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 20, color: "var(--color-accent-700)", whiteSpace: "nowrap" }}>
                        +{Math.ceil(v.item.par_qty - v.remain)}
                        <span style={{ fontSize: 12.5, fontWeight: 600, marginLeft: 4, color: MUTED }}>{v.item.unit}</span>
                      </span>
                    </button>
                  ))}
                </section>
              ))}
            </div>
          )}
        </>
      ) : null}

      {detail && byId[detail] ? (
        <DetailDialog
          v={byId[detail]}
          d={d}
          busy={busy}
          onClose={() => setDetail(null)}
          onTap={(i) => tap(detail, i)}
          onMove={move}
          onSetItem={(patch) => void post({ action: "set_item", item_key: detail, ...patch })}
          showCrossed={showCrossed}
        />
      ) : null}

      {toast ? (
        <div style={{ position: "fixed", left: 24, bottom: 24, zIndex: 60, background: INK, color: "var(--color-bg)", display: "flex", alignItems: "center", gap: 16, padding: "10px 16px", maxWidth: "calc(100vw - 48px)" }}>
          <div style={{ fontSize: 13.5 }}>{toast.text}</div>
          <button type="button" onClick={() => { const b = toast.batch; setToast(null); void post({ action: "undo", batch_id: b }) }} style={{ border: 0, background: "transparent", color: "var(--color-accent-300)", font: "inherit", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
            撤销
          </button>
        </div>
      ) : null}
    </div>
  )
}

/* ---------- 详情 ---------- */

function DetailDialog({
  v,
  d,
  busy,
  onClose,
  onTap,
  onMove,
  onSetItem,
  showCrossed,
}: {
  v: Vm
  d: Resp
  busy: boolean
  onClose: () => void
  onTap: (idx: number) => void
  onMove: (moves: Array<Partial<Hold> & { delta: number }>) => void
  onSetItem: (patch: Record<string, unknown>) => void
  showCrossed: boolean
}) {
  const uni = v.item.category === "uniform"
  const candidates: Array<{ key: string; name: string; kind: "chef" | "event" }> = uni
    ? d.chefs.map((c) => ({ ...c, kind: "chef" as const }))
    : [...d.events.map((e) => ({ ...e, kind: "event" as const })), ...d.chefs.map((c) => ({ ...c, kind: "chef" as const }))]
  const flow = d.log.filter((l) => l.item_key === v.id)
  const facts: Array<{ label: string; value: string }> = v.isCons
    ? [
        { label: "剩余", value: `${fmt(v.remain)} ${v.item.unit}` },
        { label: "安全线", value: `${v.item.min_qty} ${v.item.unit}` },
        { label: "补货渠道", value: v.item.buy_channel ?? "—" },
      ]
    : [
        { label: "在库", value: String(v.inStock) },
        { label: uni ? "在厨师手上" : "外出", value: String(v.out) },
        { label: "总数", value: String(v.item.total_qty) },
      ]

  return (
    <Dialog onClose={onClose} width={560}>
      <DialogHead
        title={v.name}
        tags={<Tag cls={v.tagCls}>{v.tag}</Tag>}
        lines={[`${v.catLabel} · ${v.isCons ? "消耗品" : uni ? "发给厨师" : "周转品"}`, v.sub]}
        onClose={onClose}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", borderBottom: `2px solid ${INK}` }}>
        {facts.map((f) => (
          <div key={f.label} style={{ padding: "14px 16px", borderRight: `2px solid ${INK}`, marginRight: -2, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 11.5, color: MUTED }}>{f.label}</div>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 21, lineHeight: 1 }}>{f.value}</div>
          </div>
        ))}
      </div>

      {v.isCons ? (
        <div style={{ padding: 16, borderBottom: `2px solid ${INK}`, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>每一包</div>
          {v.packs.length === 0 ? (
            <div style={{ fontSize: 13, color: MUTED }}>库里没有了。下次 agent 录小票时会自动加回来。</div>
          ) : (
            (showCrossed ? v.packs : v.packs.filter((p) => p.value > 0)).map((p) => (
              <div key={p.idx} style={{ display: "grid", gridTemplateColumns: "48px minmax(0,1fr)", gap: 12, alignItems: "center" }}>
                <PackGrid packs={[p]} cell={44} showCrossed onTap={() => onTap(p.idx)} />
                <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>第 {p.idx} {v.item.unit} · {p.value === 1 ? "整包" : p.value === 0.5 ? "剩半包" : "已划掉"}</div>
                  <div style={{ fontSize: 11.5, color: MUTED }}>{[p.size_note, p.source_label ?? "期初库存"].filter(Boolean).join(" · ")}</div>
                </div>
              </div>
            ))
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 4 }}>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={async () => { const s = await askPrompt({ title: "安全线", message: `低于几${v.item.unit}就算需补货？`, defaultValue: String(v.item.min_qty), inputMode: "decimal" }); if (s !== null && s.trim()) onSetItem({ min_qty: Number(s) }) }}>
              改安全线
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={async () => { const s = await askPrompt({ title: "常备量", message: `补货时补到几${v.item.unit}？`, defaultValue: String(v.item.par_qty), inputMode: "decimal" }); if (s !== null && s.trim()) onSetItem({ par_qty: Number(s) }) }}>
              改常备量
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={async () => { const s = await askPrompt({ title: "补货渠道", message: "去哪买？", defaultValue: v.item.buy_channel ?? "" }); if (s !== null) onSetItem({ buy_channel: s }) }}>
              改渠道
            </button>
          </div>
        </div>
      ) : (
        <div style={{ padding: 16, borderBottom: `2px solid ${INK}`, display: "flex", flexDirection: "column" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>在谁手上</div>
          {candidates.length === 0 ? <div style={{ fontSize: 13, color: MUTED }}>没有在职师傅，也没有近期的活动。</div> : null}
          {candidates.map((c) => {
            const h = v.hold.find((x) => x.holder_key === c.key)
            const n = h?.qty ?? 0
            return (
              <div key={c.key} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--color-divider)" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                  <div style={{ fontSize: 11.5, color: MUTED }}>{c.kind === "chef" ? "厨师" : "活动"}{h?.size_note ? ` · ${h.size_note}` : ""}</div>
                </div>
                <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 21, lineHeight: 1, minWidth: 26, textAlign: "right" }}>{n}</div>
                <div style={{ display: "flex", border: `2px solid ${INK}` }}>
                  <button type="button" className="wh-seg" style={{ borderRight: `2px solid ${INK}` }} disabled={busy || n === 0} onClick={() => onMove([{ item_key: v.id, holder_key: c.key, holder_kind: c.kind, holder_name: c.name, delta: -1 }])}>
                    归还 1
                  </button>
                  <button type="button" className="wh-seg ink" disabled={busy || v.inStock < 1} onClick={() => onMove([{ item_key: v.id, holder_key: c.key, holder_kind: c.kind, holder_name: c.name, delta: 1 }])}>
                    {c.kind === "chef" ? "发给 1" : "出库 1"}
                  </button>
                </div>
              </div>
            )
          })}
          <div style={{ paddingTop: 12 }}>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={async () => { const s = await askPrompt({ title: "实盘总数", message: `${v.name}一共有几${v.item.unit}？（含外出的）`, defaultValue: String(v.item.total_qty), inputMode: "decimal" }); if (s !== null && s.trim()) onSetItem({ total_qty: Number(s) }) }}>
              {v.item.counted_at ? "重新盘点总数" : "第一次盘点总数"}
            </button>
            {!v.item.counted_at ? <div style={{ fontSize: 11.5, color: MUTED, marginTop: 6 }}>这个总数还是设计稿里的数，没实盘过。</div> : null}
          </div>
        </div>
      )}

      <div style={{ padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>流水</div>
        {flow.length === 0 ? <div style={{ fontSize: 13, color: MUTED }}>还没有动静。</div> : null}
        {flow.map((l) => (
          <div key={l.id} style={{ display: "grid", gridTemplateColumns: "84px minmax(0,1fr) auto", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--color-divider)", alignItems: "baseline" }}>
            <div style={{ fontSize: 12, color: MUTED, fontVariantNumeric: "tabular-nums" }}>{new Date(l.created_at).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(/\//g, "-")}</div>
            <div style={{ fontSize: 13.5 }}>{l.body}</div>
            <Tag cls={l.via === "agent" ? "tag-accent" : "tag-outline"}>{l.via === "agent" ? "agent" : "手动"}</Tag>
          </div>
        ))}
      </div>
    </Dialog>
  )
}


/* ---------- 备货：勾订单，算"要补什么、去哪买" ---------- */

type BuyPack = { per: number; noun: string; desc: string; big?: { noun: string; count: number } }
type Occupant = { orderId: string; name: string; date: string; time: string; qty: number }
type PlanRow = { id: string; label: string; qty: number; unit: string; alt?: string; group: string; pack?: BuyPack | null }
type PlanResp = {
  orders: Array<{ id: string; dateLabel: string; orderNo: string; name: string; timeLabel: string; adults: number; kids: number; menuKnown: boolean }>
  totals: PlanRow[]
  pantry: Record<string, number>
  /** 别的单还占着的量。可用 = 在库 − 这个（老板 2026-09-29）。 */
  committed: Record<string, number>
  /** 占着的是哪几单、各占多少（老板 2026-09-30："我怎么知道是哪一单占用的"） */
  committedBy?: Record<string, Occupant[]>
  pantryDetail: Array<{ item_key: string; qty: number; counted_at: string | null }>
  stores: Record<string, { channel: string | null; pack: string | null }>
  warnings: string[]
  guestTotal: number
}

// 多久没盘就该再看一眼。生鲜一周内进出好几轮，超过这个数的"在库"不值得信。
const STALE_DAYS = 7

// 采购只能整包买，向上取整本身就是"宁多勿少"——所以这里不再额外乘缓冲系数。
// （而且像牛排"一盒管 4 人"这种规则，余量早就写在 BUY_UNITS 的 per 里了，
// 两层叠加会无缘无故多买一整盒。用户 2026-09-25 定。）
// 两级单位（老板 2026-09-30）：per/noun 是最小单位（三文鱼、龙虾按个），big 是整包买的（盒/袋）。
// 要买按大单位；没有大单位就按最小单位。
const bigOf = (pack: BuyPack | null | undefined) => (pack?.big && pack.big.count > 1 ? pack.big : null)
const buyPer = (pack: BuyPack | null | undefined) => (pack && pack.per > 0 ? pack.per * (bigOf(pack)?.count ?? 1) : 0)
const buyNoun = (pack: BuyPack | null | undefined) => bigOf(pack)?.noun ?? pack?.noun ?? ""
const buyCount = (short: number, pack: BuyPack | null | undefined) => {
  const p = buyPer(pack)
  return p > 0 ? Math.max(1, Math.ceil(short / p)) : null
}
const r1 = (n: number) => Math.round(n * 10) / 10
/** 实物的写法（在库、占用、可用）："3 个" / "1 盒 1 个" / "2 袋"；没有大单位就是"1.5 瓶"。 */
function fmtCount(qty: number, pack: BuyPack | null | undefined, unit: string): string {
  if (!pack || pack.per <= 0) return `${r1(qty)} ${unit}`
  const small = qty / pack.per
  const big = bigOf(pack)
  if (!big) return `${r1(small)} ${pack.noun}`
  const b = Math.floor(small / big.count + 1e-9)
  const rest = r1(small - b * big.count)
  if (b === 0) return `${rest} ${pack.noun}`
  return rest > 0 ? `${b} ${big.noun} ${rest} ${pack.noun}` : `${b} ${big.noun}`
}
/** 需求的写法："4 个 ≈ 2 盒" / "76.5 只 ≈ 1.8 袋"；没有大单位就是"1.5 瓶"。 */
function fmtNeed(qty: number, pack: BuyPack | null | undefined, unit: string): string {
  if (!pack || pack.per <= 0) return `${r1(qty)} ${unit}`
  const small = qty / pack.per
  const big = bigOf(pack)
  return big ? `${r1(small)} ${pack.noun} ≈ ${r1(small / big.count)} ${big.noun}` : `${r1(small)} ${pack.noun}`
}

function PrepPlanner({ adminKey, events }: { adminKey: string; events: Holder[] }) {
  const [sel, setSel] = useState<Set<string>>(() => new Set(events.map((e) => e.key.replace(/^order:/, ""))))
  const [resp, setResp] = useState<PlanResp | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const toggle = (id: string) =>
    setSel((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const run = async () => {
    if (busy || sel.size === 0) return
    setBusy(true)
    setErr(null)
    try {
      setResp(await adminJson<PlanResp>(adminKey, `/api/admin/prep?orders=${Array.from(sel).join(",")}`))
    } catch (e) {
      setErr(e instanceof Error ? e.message : "计算失败")
    } finally {
      setBusy(false)
    }
  }

  // 改在库：就地写 pantry_stock，然后重算。对货和买什么在同一屏，改完立刻看到结果。
  const setHave = useCallback(
    async (itemKey: string, qty: number) => {
      setBusy(true)
      try {
        await adminJson(adminKey, "/api/admin/prep", { body: { action: "set_pantry", item_key: itemKey, qty } })
        await run()
      } catch (e) {
        setErr(e instanceof Error ? e.message : "没存上")
      } finally {
        setBusy(false)
      }
    },
    [adminKey, run],
  )

  // 释放一单的占用：这单没备，就别占着料（老板 2026-09-30）
  const release = async (h: Occupant) => {
    const ok = await askConfirm({
      title: "释放占用",
      message: `${h.date} ${h.name} 这单占着的料全部放出来？
以后勾上这单再算缺口，会重新占。`,
      okLabel: "释放",
    })
    if (!ok) return
    setBusy(true)
    try {
      await adminJson(adminKey, "/api/admin/prep", { body: { action: "release", order_id: h.orderId } })
      await run()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "没释放成")
    } finally {
      setBusy(false)
    }
  }

  const groups = (() => {
    if (!resp) return null
    type Line = { row: PlanRow; have: number; committed: number; holders: Occupant[]; avail: number; short: number; buy: number | null; stale: boolean; ask: boolean }
    const buy: Record<string, Line[]> = {}
    const byGroup: Record<string, Line[]> = {}
    const setup: PlanRow[] = []
    const countedAt = new Map(resp.pantryDetail?.map((r) => [r.item_key, r.counted_at]) ?? [])
    const staleBefore = Date.now() - STALE_DAYS * 86400_000
    const bulk: string[] = []
    for (const row of resp.totals) {
      if (row.group === "setup") {
        setup.push(row)
        continue
      }
      // 米、油、酱油是大宗，一次买很多、缺了直接买，不进备货清单（老板 2026-09-30）
      if (isBulkItem(row.id)) {
        bulk.push(bulkName(row.id))
        continue
      }
      const have = Math.round((resp.pantry[row.id] ?? 0) * 10) / 10
      // 别的单占着的先扣掉：冰箱里那 2 瓶已经许给周五那单了，这单不能再当它是自己的。
      const committed = Math.round((resp.committed?.[row.id] ?? 0) * 10) / 10
      const avail = Math.round(Math.max(0, have - committed) * 10) / 10
      const short = Math.round(Math.max(0, row.qty - avail) * 10) / 10
      const c = countedAt.get(row.id)
      const stale = !c || Date.parse(c) < staleBefore
      // 要不要麻烦你走一趟冰箱：不够的必须看，太久没盘的也该看一眼。
      // 够、而且最近盘过的，默认信它——这正是"我不在乎有什么"。
      const ask = short > 0 || stale
      const line = { row, have, committed, holders: resp.committedBy?.[row.id] ?? [], avail, short, buy: buyCount(short, row.pack), stale, ask }
      // 全量核对表要看到每一样东西，不管够不够 —— 老板要的就是能发现"账上说够、
      // 实际早没了"这种漏更新，只显示缺口栏会把这类问题挡在外面。
      ;(byGroup[row.group] = byGroup[row.group] ?? []).push(line)
      if (short > 0) {
        const store = resp.stores[row.id]?.channel ?? "Walmart"
        ;(buy[store] = buy[store] ?? []).push(line)
      }
    }
    const order = ["Walmart", "Restaurant Depot", "Instacart", "Amazon"]
    const storeKeys = Object.keys(buy).sort((a, b) => (order.indexOf(a) + 99) - (order.indexOf(b) + 99) || a.localeCompare(b))
    const GROUP_ORDER: PrepGroup[] = ["protein", "produce", "frozen", "pantry"]
    const all = GROUP_ORDER.flatMap((g) => byGroup[g] ?? [])
    return { buy, storeKeys, setup, bulk, ask: all.filter((l) => l.ask), trusted: all.filter((l) => !l.ask) }
  })()

  // 全选 / 反选（老板 2026-09-30）
  const allIds = events.map((e) => e.key.replace(/^order:/, ""))
  const selCount = allIds.filter((id) => sel.has(id)).length
  const selectAll = () => setSel(new Set(allIds))
  const invert = () => setSel((prev) => new Set(allIds.filter((id) => !prev.has(id))))

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 24 }}>备货</div>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>勾上要备的订单，一键算出"买什么、买几瓶、去哪买"。差多少一律往上取整到整瓶整盒——最小采购单位就是一瓶，剩多少是师傅现场的事。</div>
      </div>

      {events.length === 0 ? <div style={{ color: MUTED, fontSize: 13 }}>未来 10 天没有订单。</div> : null}
      {events.length > 1 ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy || selCount === allIds.length} onClick={selectAll}>
            全选
          </button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={invert}>
            反选
          </button>
          <span style={{ fontSize: 12.5, color: MUTED }}>
            已选 {selCount} / {allIds.length} 单
          </span>
        </div>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", border: events.length ? `2px solid ${INK}` : "none", marginBottom: 12 }}>
        {events.map((e) => {
          const id = e.key.replace(/^order:/, "")
          return (
            <label key={e.key} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--color-divider)", cursor: "pointer", fontSize: 14 }}>
              <input type="checkbox" checked={sel.has(id)} onChange={() => toggle(id)} />
              <span style={{ fontWeight: 600 }}>{e.name}</span>
            </label>
          )
        })}
      </div>
      <button type="button" className="btn btn-primary" disabled={busy || sel.size === 0} onClick={() => void run()}>
        {busy ? "算着…" : `算这 ${sel.size} 单的缺口`}
      </button>
      {err ? <div className="notice danger" style={{ marginTop: 10 }}>{err}</div> : null}

      {resp && groups ? (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 24 }}>
          {resp.warnings.map((w, i) => (
            <div key={i} className="notice danger">{w}</div>
          ))}
          <div style={{ fontSize: 13, color: MUTED }}>
            共 {resp.orders.length} 单 · {resp.guestTotal} 人：{resp.orders.map((o) => `${o.dateLabel} ${o.name}（${o.adults + o.kids}）`).join(" · ")}
          </div>

          {groups.storeKeys.length === 0 ? <div className="notice">都够，不用买。</div> : null}
          {groups.storeKeys.map((store) => (
            <section key={store}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `2px solid ${INK}`, paddingBottom: 8 }}>
                <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 19 }}>{store}</div>
                <div style={{ fontSize: 12.5, color: MUTED }}>{groups.buy[store].length} 项</div>
              </div>
              {groups.buy[store].map(({ row, have, short, buy }) => (
                <div key={row.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) auto", gap: 14, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--color-divider)" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{row.label}</div>
                    <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                      要 {fmtNeed(row.qty, row.pack, row.unit)} · 在库 {fmtCount(have, row.pack, row.unit)}
                      {row.pack?.desc ? ` · ${row.pack.desc}` : ""}
                    </div>
                  </div>
                  <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 20, color: "var(--color-accent-700)", whiteSpace: "nowrap" }}>
                    {buy === null ? `补 ${short} ${row.unit}` : `买 ${buy} ${buyNoun(row.pack)}`}
                  </div>
                </div>
              ))}
            </section>
          ))}

          {groups.setup.length ? (
            <section>
              <div style={{ borderBottom: `2px solid ${INK}`, paddingBottom: 8, fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 19 }}>装车（周转品，对照库存页签）</div>
              {groups.setup.map((r) => (
                <div key={r.id + r.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--color-divider)", fontSize: 14 }}>
                  <span style={{ fontWeight: 600 }}>{r.label}</span>
                  <span>{Math.round(r.qty * 10) / 10} {r.unit}</span>
                </div>
              ))}
            </section>
          ) : null}

          {/* 对货：只问需要问的。够、而且最近盘过的默认信它——老板 2026-09-29 定的口径是
              "我不在乎有什么，我在乎缺什么"，所以别拿 30 行东西占你的屏幕。 */}
          {groups.ask.length > 0 ? (
            <section>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `2px solid ${INK}`, paddingBottom: 8 }}>
                <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 19 }}>去看一眼（{groups.ask.length} 项）</div>
                <div style={{ fontSize: 12.5, color: MUTED }}>点一下实际还有几瓶，下面的"要买"立刻重算</div>
              </div>
              {groups.ask.map((l) => (
                <CountRow key={l.row.id} line={l} busy={busy} onSet={(qty) => void setHave(l.row.id, qty)} onRelease={(h) => void release(h)} />
              ))}
            </section>
          ) : null}

          {groups.trusted.length > 0 ? (
            <details>
              <summary style={{ cursor: "pointer", fontSize: 13, color: MUTED }}>
                这 {groups.trusted.length} 项按上次盘的够用，不用去看 · 展开核对
              </summary>
              <div style={{ marginTop: 8 }}>
                {groups.trusted.map((l) => (
                  <CountRow key={l.row.id} line={l} busy={busy} onSet={(qty) => void setHave(l.row.id, qty)} onRelease={(h) => void release(h)} />
                ))}
              </div>
            </details>
          ) : null}

          {groups.bulk.length > 0 ? (
            <div style={{ fontSize: 12.5, color: MUTED }}>{groups.bulk.join("、")}是大宗，缺了直接买，不在这里算。</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}


/* ---------- 学员套装：一套要买什么 + 手上这几套现在怎么样 ---------- */

type Candidate = { title: string; url?: string; price?: number; ship?: number; store?: string; note?: string }
type KitItem = {
  id: string
  label: string
  qty: number
  unit: string
  item_key: string | null
  buy_channel: string | null
  est_cost_cents: number | null
  note: string | null
  candidates: Candidate[]
  chosen_url: string | null
  buy_note: string | null
}
type Kit = {
  id: string
  kit_no: string
  status: "in_stock" | "on_loan" | "sold" | "retired"
  holder_staff_id: string | null
  holder_name: string | null
  cost_cents: number
  sold_price_cents: number | null
  bought_on: string | null
  loaned_on: string | null
  sold_on: string | null
  note: string | null
}
type KitResp = {
  items: KitItem[]
  kits: Kit[]
  staff: Array<{ id: string; name: string }>
  /** 坐席看不到套装的钱（和厨师工资一个口径），这时台账页整个不给。 */
  canSeeMoney?: boolean
  summary: { inStock: number; onLoan: number; sold: number; spentCents: number; recoveredCents: number }
}

const KIT_STATUS: Record<Kit["status"], string> = {
  in_stock: "在库",
  on_loan: "学员试用中",
  sold: "已卖出",
  retired: "拆了",
}

const money = (c: number | null | undefined) =>
  c === null || c === undefined ? "—" : `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// 到手价 = 标价 + 运费。$0.89 的东西加 $3.90 运费比 $3.32 的贵，按标价排会选错。
const landed = (c: Candidate) => (c.price ?? 0) + (c.ship ?? 0)

function TraineeKits({ adminKey }: { adminKey: string }) {
  const [d, setD] = useState<KitResp | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [view, setView] = useState<"buy" | "ledger">("buy")
  const [editing, setEditing] = useState<KitItem | null>(null)

  const load = useCallback(async () => {
    try {
      setD(await adminJson<KitResp>(adminKey, "/api/admin/trainee-kits"))
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "读不到")
    }
  }, [adminKey])
  useEffect(() => {
    void load()
  }, [load])

  const act = useCallback(
    async (body: Record<string, unknown>, label: string) => {
      setBusy(label)
      try {
        await adminJson(adminKey, "/api/admin/trainee-kits", { body })
        await load()
      } catch (e) {
        setErr(e instanceof Error ? e.message : "没存上")
      } finally {
        setBusy(null)
      }
    },
    [adminKey, load],
  )

  if (!d) return <div style={{ color: MUTED, fontSize: 13 }}>{err ? `读不到：${err}` : "读取中…"}</div>

  // 一套大概多少钱：选定的那个优先，没选就用最便宜的候选，都没有就不算。
  let known = 0
  let unknown = 0
  for (const it of d.items) {
    const picked = it.candidates.find((c) => c.url && c.url === it.chosen_url)
    const cheapest = [...it.candidates].sort((a, b) => landed(a) - landed(b))[0]
    const c = picked ?? cheapest
    if (c) known += landed(c)
    else if (it.est_cost_cents) known += it.est_cost_cents
    else unknown += 1
  }

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 24 }}>学员套装</div>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 4, lineHeight: 1.6 }}>
          自己垫一套给学员跑一两场，他要长干就把这套卖给他，你再配一套。所以它不算消耗品也不算周转品——
          卖出去就是它的归宿。成本不进采购流水，不会污染看板上的每人食材成本。
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {(d.canSeeMoney === false ? ([["buy", "一套买什么"]] as const) : ([["buy", "一套买什么"], ["ledger", "我的套装"]] as const)).map(([k, label]) => (
          <button key={k} type="button" className="wb-chip wb-chip-sm" aria-pressed={view === k} onClick={() => setView(k)}>
            {label}
          </button>
        ))}
      </div>

      {err ? <div className="notice danger" style={{ marginBottom: 12 }}>{err}</div> : null}

      {view === "buy" ? (
        <div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "baseline", borderBottom: `2px solid ${INK}`, paddingBottom: 10, marginBottom: 4 }}>
            <div>
              <div className="kicker">配一套（已定价的部分）</div>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 26 }}>{money(known)}</div>
            </div>
            <div style={{ fontSize: 12.5, color: MUTED }}>
              {d.items.length} 项 · 还有 {unknown} 项没找价（合计只算已有价的，所以这个数只会往上走）
            </div>
          </div>

          {d.items.map((it) => {
            const cheapest = [...it.candidates].sort((a, b) => landed(a) - landed(b))[0]
            return (
              <div key={it.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--color-divider)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontWeight: 700, fontSize: 15, padding: 0, textAlign: "left" }}
                    onClick={() => setEditing(it)}
                    title="点开改名字、数量、在哪买，以及粘一个商品进来"
                  >
                    {it.label}
                    <span style={{ color: MUTED, fontWeight: 600 }}> ×{it.qty}</span>
                    {it.item_key ? <Tag cls="tag-faint">仓库有</Tag> : null}
                    {it.buy_channel ? <Tag cls="tag-outline">{it.buy_channel}</Tag> : null}
                    <span style={{ color: MUTED, fontWeight: 600, fontSize: 12 }}> 改</span>
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {/* 数量在行上直接加减：配套装时常要临时改「这个拿两个」，
                        为一个数字开弹窗太重。 */}
                    <span style={{ display: "flex", gap: 2 }}>
                      <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy || it.qty <= 1} title="少一个"
                        onClick={() => void act({ action: "set_item", id: it.id, qty: it.qty - 1 }, `qty:${it.id}`)}>−</button>
                      <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy} title="多一个"
                        onClick={() => void act({ action: "set_item", id: it.id, qty: it.qty + 1 }, `qty:${it.id}`)}>+</button>
                    </span>
                    <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 16, whiteSpace: "nowrap" }}>
                      {cheapest ? money(landed(cheapest)) : <span style={{ color: MUTED, fontSize: 13, fontWeight: 600 }}>还没找</span>}
                    </div>
                  </div>
                </div>

                {it.buy_note ? (
                  <div style={{ fontSize: 12.5, color: "var(--color-accent-700)", marginTop: 4, lineHeight: 1.5 }}>{it.buy_note}</div>
                ) : null}
                {it.note ? <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3, lineHeight: 1.5 }}>{it.note}</div> : null}

                {it.candidates.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                    {it.candidates.map((c, i) => {
                      const chosen = !!c.url && c.url === it.chosen_url
                      return (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "baseline",
                            flexWrap: "wrap",
                            padding: "7px 10px",
                            border: chosen ? `2px solid ${INK}` : "1px solid var(--color-divider)",
                            background: chosen ? "var(--color-surface-2)" : undefined,
                          }}
                        >
                          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 14, whiteSpace: "nowrap" }}>
                            {money(landed(c))}
                          </span>
                          {c.ship ? <span style={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap" }}>（含运费 {money(c.ship)}）</span> : null}
                          <span style={{ fontSize: 13, minWidth: 0, flex: 1 }}>
                            {c.url ? (
                              <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline" }}>
                                {c.title}
                              </a>
                            ) : (
                              c.title
                            )}
                            {c.note ? <span style={{ color: MUTED }}> · {c.note}</span> : null}
                          </span>
                          {c.url ? (
                            <button
                              type="button"
                              className="wb-chip wb-chip-sm"
                              disabled={!!busy}
                              onClick={() => void act({ action: "set_item", id: it.id, chosen_url: chosen ? "" : c.url }, `pick:${it.id}`)}
                            >
                              {chosen ? "已选" : "选它"}
                            </button>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : d.canSeeMoney === false ? (
        <div style={{ color: MUTED, fontSize: 13 }}>套装台账带成本和卖价，只有 owner 能看。</div>
      ) : (
        <KitLedger d={d} busy={busy} act={act} />
      )}

      {editing ? (
        <KitItemDialog
          item={editing}
          busy={!!busy}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            await act({ action: "set_item", id: editing.id, ...patch }, `edit:${editing.id}`)
            setEditing(null)
          }}
        />
      ) : null}
    </div>
  )
}

/* 一项的编辑弹窗：改清单那一行，以及往里粘商品。
   粘商品是这里的主要动作——老板在 Walmart 找到东西，回来把标题、价格、链接填进去，
   下次配套装就不用再找一遍。 */
function KitItemDialog({
  item,
  busy,
  onClose,
  onSave,
}: {
  item: KitItem
  busy: boolean
  onClose: () => void
  onSave: (patch: Record<string, unknown>) => Promise<void>
}) {
  const [label, setLabel] = useState(item.label)
  const [qty, setQty] = useState(String(item.qty))
  const [unit, setUnit] = useState(item.unit)
  const [channel, setChannel] = useState(item.buy_channel ?? "")
  const [buyNote, setBuyNote] = useState(item.buy_note ?? "")
  const [note, setNote] = useState(item.note ?? "")
  const [cands, setCands] = useState<Candidate[]>(item.candidates ?? [])

  // 价格在界面上按「元」填，存的时候换成分——库里一律用分，别让浮点数进数据库。
  const dollars = (c?: number) => (c === undefined || c === null ? "" : (c / 100).toFixed(2))
  const toCents = (v: string) => {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined
  }
  const patchCand = (i: number, k: keyof Candidate, v: string) =>
    setCands((prev) =>
      prev.map((c, j) =>
        j !== i ? c : { ...c, [k]: k === "price" || k === "ship" ? toCents(v) : v || undefined },
      ),
    )

  const field = (labelText: string, node: React.ReactNode) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="kicker">{labelText}</span>
      {node}
    </label>
  )

  return (
    <Dialog onClose={onClose} width={680}>
      <DialogHead title={item.label} lines={[item.item_key ? `仓库目录里对应 ${item.item_key}` : "仓库目录里没有这一项"]} onClose={onClose} />
      <div className="dialog-col" style={{ gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
          {field("名称", <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} />)}
          {field(
            "数量",
            <div style={{ display: "flex", gap: 4 }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQty((q) => String(Math.max(1, (Number(q) || 1) - 1)))}>
                −
              </button>
              <input className="input" inputMode="decimal" style={{ width: 56, textAlign: "center" }} value={qty} onChange={(e) => setQty(e.target.value)} />
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setQty((q) => String((Number(q) || 0) + 1))}>
                +
              </button>
            </div>,
          )}
          {field("单位", <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} />)}
          {field("在哪买", <input className="input" value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="Walmart / Amazon / Restaurant Depot…" />)}
        </div>
        {field(
          "采购备注（怎么买、要注意什么）",
          <textarea className="input" rows={2} value={buyNote} onChange={(e) => setBuyNote(e.target.value)} placeholder="例：Restaurant Depot 的走 Instacart 下单；易燃品不能快递只能门店拿" />,
        )}
        {field("备注", <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />)}

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `2px solid ${INK}`, paddingBottom: 6, marginBottom: 8 }}>
            <span className="kicker">候选商品</span>
            <button type="button" className="wb-chip wb-chip-sm" onClick={() => setCands((p) => [...p, { title: "" }])}>
              + 加一个
            </button>
          </div>
          {cands.length === 0 ? <div style={{ fontSize: 13, color: MUTED }}>还没有。找到东西就点「+ 加一个」把标题、价格、链接粘进来。</div> : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cands.map((c, i) => (
              <div key={i} style={{ border: "1px solid var(--color-divider)", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="input" style={{ flex: 1 }} value={c.title ?? ""} onChange={(e) => patchCand(i, "title", e.target.value)} placeholder="商品标题" />
                  <button type="button" className="wb-chip wb-chip-sm" onClick={() => setCands((p) => p.filter((_, j) => j !== i))}>
                    删
                  </button>
                </div>
                <input className="input" value={c.url ?? ""} onChange={(e) => patchCand(i, "url", e.target.value)} placeholder="商品链接（从浏览器地址栏粘过来）" />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 8 }}>
                  <input className="input" inputMode="decimal" value={dollars(c.price)} onChange={(e) => patchCand(i, "price", e.target.value)} placeholder="标价 $" />
                  <input className="input" inputMode="decimal" value={dollars(c.ship)} onChange={(e) => patchCand(i, "ship", e.target.value)} placeholder="运费 $（免运留空）" />
                  <input className="input" value={c.store ?? ""} onChange={(e) => patchCand(i, "store", e.target.value)} placeholder="哪家店" />
                </div>
                <input className="input" value={c.note ?? ""} onChange={(e) => patchCand(i, "note", e.target.value)} placeholder="备注（尺寸、够不够用、为什么选它）" />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() =>
              void onSave({
                label,
                qty: Number(qty) > 0 ? Number(qty) : 1,
                unit,
                buy_channel: channel,
                buy_note: buyNote,
                note,
                candidates: cands.filter((c) => (c.title ?? "").trim()),
              })
            }
          >
            {busy ? "存着…" : "保存"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </Dialog>
  )
}

function KitLedger({
  d,
  busy,
  act,
}: {
  d: KitResp
  busy: string | null
  act: (body: Record<string, unknown>, label: string) => Promise<void>
}) {
  const s = d.summary
  const cell = (label: string, value: string, hint?: string) => (
    <div className="wb-cell">
      <div className="kicker">{label}</div>
      <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 24 }}>{value}</div>
      {hint ? <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{hint}</div> : null}
    </div>
  )

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 18 }}>
        {cell("在库能给出去", String(s.inStock), "配齐了放着的")}
        {cell("学员试用中", String(s.onLoan), "")}
        {cell("已卖出", String(s.sold), "")}
        {cell("垫出去 / 收回来", `${money(s.spentCents)} / ${money(s.recoveredCents)}`, "收回来的只算已卖出的")}
      </div>

      <button
        type="button"
        className="btn btn-primary"
        disabled={!!busy}
        onClick={() => void act({ action: "add_kit" }, "add")}
        style={{ marginBottom: 14 }}
      >
        {busy === "add" ? "加着…" : "+ 配了新的一套"}
      </button>

      {d.kits.length === 0 ? (
        <div style={{ color: MUTED, fontSize: 13 }}>还没有记过套装。买齐一套之后点上面那个按钮。</div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {d.kits.map((k) => (
          <div key={k.id} style={{ border: `2px solid ${INK}`, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 18 }}>
                {k.kit_no} <Tag cls={k.status === "sold" ? "tag-accent" : k.status === "on_loan" ? "tag-ink" : "tag-neutral"}>{KIT_STATUS[k.status]}</Tag>
              </div>
              <div style={{ fontSize: 13, color: MUTED }}>
                成本 {money(k.cost_cents)}
                {k.sold_price_cents !== null ? ` · 卖了 ${money(k.sold_price_cents)}` : ""}
                {k.status === "sold" ? (
                  <b style={{ color: k.sold_price_cents !== null && k.sold_price_cents >= k.cost_cents ? "var(--color-accent-700)" : undefined }}>
                    {" "}
                    · {k.sold_price_cents !== null && k.sold_price_cents >= k.cost_cents ? "回本了" : "还差 " + money(k.cost_cents - (k.sold_price_cents ?? 0))}
                  </b>
                ) : null}
              </div>
            </div>
            {k.holder_name ? <div style={{ fontSize: 13, marginTop: 4 }}>在 {k.holder_name} 手上</div> : null}

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {k.status !== "on_loan" && k.status !== "sold" ? (
                <>
                  {d.staff.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      className="wb-chip wb-chip-sm"
                      disabled={!!busy}
                      onClick={() =>
                        void act({ action: "set_kit", id: k.id, status: "on_loan", holder_staff_id: st.id, holder_name: st.name }, `loan:${k.id}`)
                      }
                    >
                      借给 {st.name}
                    </button>
                  ))}
                </>
              ) : null}
              {k.status === "on_loan" ? (
                <>
                  <button
                    type="button"
                    className="wb-chip wb-chip-sm"
                    disabled={!!busy}
                    onClick={async () => {
                      const v = await askPrompt({ title: `${k.kit_no} 卖给 ${k.holder_name ?? "学员"}`, message: "卖了多少钱？（只填数字，美元）", placeholder: "例如 650", inputMode: "decimal" })
                      if (v === null) return
                      const n = Math.round(Number(v) * 100)
                      if (!Number.isFinite(n) || n < 0) return
                      await act({ action: "set_kit", id: k.id, status: "sold", sold_price_cents: n }, `sell:${k.id}`)
                    }}
                  >
                    卖给他了
                  </button>
                  <button type="button" className="wb-chip wb-chip-sm" disabled={!!busy} onClick={() => void act({ action: "set_kit", id: k.id, status: "in_stock" }, `back:${k.id}`)}>
                    还回来了
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="wb-chip wb-chip-sm"
                disabled={!!busy}
                onClick={async () => {
                  const v = await askPrompt({ title: `${k.kit_no} 配齐花了多少`, message: "只填数字，美元", placeholder: "例如 420", inputMode: "decimal" })
                  if (v === null) return
                  const n = Math.round(Number(v) * 100)
                  if (!Number.isFinite(n) || n < 0) return
                  await act({ action: "set_kit", id: k.id, cost_cents: n }, `cost:${k.id}`)
                }}
              >
                改成本
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


/* 对货的一行：按「瓶/袋/盒」点，不按 oz 填。
   站在冰箱前你能数出"还有 2 瓶"，数不出"还有 32 tbsp"——换算让系统做。
   两级单位（老板 2026-09-30）：拆开的按最小单位数（个），整包的按大单位（盒/袋），
   写出来是"1 盒 1 个"；一包里个数少的（龙虾 2 个/盒）两级都有快捷按钮，个数多的
   （虾 43 只/袋）按包点，零头在"更多…"里填。 */
function CountRow({
  line,
  busy,
  onSet,
  onRelease,
}: {
  line: { row: PlanRow; have: number; committed: number; holders: Occupant[]; avail: number; short: number; buy: number | null; stale: boolean }
  busy: boolean
  onSet: (qty: number) => void
  onRelease?: (h: Occupant) => void
}) {
  const { row, have, committed, holders, avail, short, buy, stale } = line
  const pack = row.pack ?? null
  const per = pack?.per ?? 0
  const noun = pack?.noun ?? ""
  const big = bigOf(pack)
  const [showHolders, setShowHolders] = useState(false)
  const [editing, setEditing] = useState(false)
  const [bigIn, setBigIn] = useState("")
  const [smallIn, setSmallIn] = useState("")
  const count = (q: number) => fmtCount(q, pack, row.unit)

  // 快捷按钮，值都换回 BOM 单位（oz / 只 / tbsp）存
  const chips: Array<{ label: string; qty: number }> =
    per <= 0
      ? []
      : big
        ? big.count <= 12
          ? [
              { label: "没了", qty: 0 },
              ...Array.from({ length: Math.min(big.count - 1, 4) }, (_, i) => ({ label: `${i + 1} ${noun}`, qty: (i + 1) * per })),
              ...[1, 2, 3].map((n) => ({ label: `${n} ${big.noun}`, qty: n * big.count * per })),
            ]
          : [
              { label: "没了", qty: 0 },
              { label: `半${big.noun}`, qty: (big.count * per) / 2 },
              ...[1, 2, 3, 4].map((n) => ({ label: `${n} ${big.noun}`, qty: n * big.count * per })),
            ]
        : [0, 0.5, 1, 2, 3, 4].map((n) => ({ label: n === 0 ? "没了" : n === 0.5 ? `半${noun}` : `${n} ${noun}`, qty: n * per }))
  const pressed = (q: number) => per > 0 && Math.abs(have - q) < per * 0.25

  const openEdit = () => {
    const small = per > 0 ? have / per : 0
    const b = big ? Math.floor(small / big.count + 1e-9) : 0
    setBigIn(big ? String(b) : "")
    setSmallIn(String(r1(small - (big ? b * big.count : 0))))
    setEditing(true)
  }
  const saveEdit = () => {
    const b = big ? Number(bigIn || 0) : 0
    const sm = Number(smallIn || 0)
    if (!Number.isFinite(b) || !Number.isFinite(sm) || b < 0 || sm < 0) return
    onSet(Math.round(((big ? b * big.count : 0) + sm) * per * 100) / 100)
    setEditing(false)
  }

  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid var(--color-divider)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>
          {row.label}
          {stale ? <span style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}> · 有阵子没盘了</span> : null}
        </div>
        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 15, whiteSpace: "nowrap", color: short > 0 ? "var(--color-accent-700)" : "#16a34a" }}>
          {short > 0 ? (buy === null ? `补 ${short} ${row.unit}` : `买 ${buy} ${buyNoun(pack)}`) : "够"}
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>
        {/* 记账单位就是最小单位（只、个）时不重复写一遍 */}
        要 {per === 1 ? fmtNeed(row.qty, pack, row.unit) : `${r1(row.qty)} ${row.unit}${per > 0 ? `（≈${fmtNeed(row.qty, pack, row.unit)}）` : ""}`} · 在库 {count(have)}
        {committed > 0 ? (
          <>
            {" · "}
            {/* 点开看是哪几单占着；只有一单就直接写名字 */}
            <button
              type="button"
              aria-expanded={showHolders}
              onClick={() => setShowHolders((v) => !v)}
              style={{ all: "unset", cursor: "pointer", textDecoration: "underline dotted", textUnderlineOffset: 3 }}
            >
              别的单占了 {count(committed)}
              {holders.length === 1 ? `（${holders[0].date} ${holders[0].name} ${showHolders ? "▴" : "▾"}）` : holders.length > 1 ? `（${holders.length} 单 ${showHolders ? "▴" : "▾"}）` : ""}
            </button>
            ，可用 {count(avail)}
          </>
        ) : null}
      </div>
      {showHolders && holders.length > 0 ? (
        <div style={{ fontSize: 12, color: MUTED, margin: "4px 0 2px 4px", paddingLeft: 10, borderLeft: "2px solid var(--color-divider)", lineHeight: 1.7 }}>
          {holders.map((h) => (
            <div key={h.orderId} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span>
                {h.date} {h.time} · {h.name} · 占 {count(h.qty)}
              </span>
              {onRelease ? (
                <button type="button" className="wb-chip wb-chip-sm" disabled={busy} onClick={() => onRelease(h)}>
                  释放
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {per > 0 ? (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
          {chips.map((c) => (
            <button key={c.label} type="button" className="wb-chip wb-chip-sm" aria-pressed={pressed(c.qty)} disabled={busy} onClick={() => onSet(Math.round(c.qty * 100) / 100)}>
              {c.label}
            </button>
          ))}
          <button type="button" className="wb-chip wb-chip-sm" aria-pressed={editing} disabled={busy} onClick={() => (editing ? setEditing(false) : openEdit())}>
            更多…
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="wb-chip wb-chip-sm"
          disabled={busy}
          style={{ marginTop: 6 }}
          onClick={async () => {
            const v = await askPrompt({ title: row.label, message: `实际还有多少 ${row.unit}？`, placeholder: "例如 20", inputMode: "decimal" })
            if (v === null) return
            const n = Number(v)
            if (!Number.isFinite(n) || n < 0) return
            onSet(Math.round(n * 100) / 100)
          }}
        >
          改在库（{have} {row.unit}）
        </button>
      )}
      {editing && per > 0 ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 8, fontSize: 13 }}>
          实际还有
          {big ? (
            <>
              <input className="input" inputMode="numeric" aria-label={big.noun} style={{ width: 64, textAlign: "center" }} value={bigIn} onChange={(e) => setBigIn(e.target.value.replace(/[^\d]/g, ""))} />
              {big.noun} +
            </>
          ) : null}
          <input className="input" inputMode="decimal" aria-label={noun} style={{ width: 64, textAlign: "center" }} value={smallIn} onChange={(e) => setSmallIn(e.target.value.replace(/[^\d.]/g, ""))} />
          {noun}
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={saveEdit}>
            存
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
            取消
          </button>
        </div>
      ) : null}
    </div>
  )
}
