"use client"

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react"
import { adminJson } from "./api"
import { Dialog, DialogHead, Tag } from "./ui"
import { askPrompt } from "./ask"
import { PREP_GROUP_TITLES, type PrepGroup } from "@/lib/prep-bom"

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
type Pack = { item_key: string; idx: number; value: number; source_label: string | null }
type Hold = { item_key: string; holder_key: string; holder_kind: "chef" | "event" | "misc"; holder_name: string; qty: number; size_note: string | null }
type LogRow = { id: string; item_key: string; body: string; via: string; quote: string | null; created_at: string; batch_id: string | null }
type Record_ = { id: string; date: string; channel: string; store: string; meta: string; lines: Array<{ item_key: string; n: number; raw: string }> }
type Holder = { key: string; name: string }
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

type Tab = "stock" | "prep" | "in" | "out" | "chef" | "re"
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
          title={`第 ${p.idx} 包 · ${p.value === 1 ? "整包" : p.value === 0.5 ? "剩半包" : "已划掉"}${p.source_label ? ` · ${p.source_label}` : ""}`}
          onClick={() => onTap(p.idx)}
          style={{ width: cell, height: cell, border: `2px solid ${p.value === 0 ? "var(--color-divider)" : INK}`, position: "relative", overflow: "hidden", cursor: "pointer", flex: "none", background: "var(--color-bg)", padding: 0 }}
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
}

function buildVm(item: Item, packs: Pack[], hold: Hold[]): Vm {
  const base = { item, id: item.item_key, name: item.name, catLabel: CAT_LABELS[item.category] ?? item.category }
  if (item.kind === "cons") {
    const remain = packs.reduce((a, p) => a + Number(p.value), 0)
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

  const tap = (key: string, idx: number) => void post({ action: "tap_pack", item_key: key, idx })
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
    ["stock", "库存", ""],
    ["prep", "备货", ""],
    ["in", "入库记录", ""],
    ["out", "出库 · 归还", outCount ? String(outCount) : ""],
    ["chef", "厨师", ""],
    ["re", "补货清单", needs.length ? String(needs.length) : ""],
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
                  <div style={{ fontSize: 11.5, color: MUTED }}>{p.source_label ?? "期初库存"}</div>
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

type BuyPack = { per: number; noun: string; desc: string }
type PlanRow = { id: string; label: string; qty: number; unit: string; alt?: string; group: string; pack?: BuyPack | null }
type PlanResp = {
  orders: Array<{ id: string; dateLabel: string; orderNo: string; name: string; timeLabel: string; adults: number; kids: number; menuKnown: boolean }>
  totals: PlanRow[]
  pantry: Record<string, number>
  stores: Record<string, { channel: string | null; pack: string | null }>
  warnings: string[]
  guestTotal: number
}

// 采购只能整包买，向上取整本身就是"宁多勿少"——所以这里不再额外乘缓冲系数。
// （而且像牛排"一盒管 4 人"这种规则，余量早就写在 BUY_UNITS 的 per 里了，
// 两层叠加会无缘无故多买一整盒。用户 2026-09-25 定。）
const buyCount = (short: number, pack: BuyPack | null | undefined) =>
  pack && pack.per > 0 ? Math.max(1, Math.ceil(short / pack.per)) : null

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

  const groups = (() => {
    if (!resp) return null
    type Line = { row: PlanRow; have: number; short: number; buy: number | null }
    const buy: Record<string, Line[]> = {}
    const byGroup: Record<string, Line[]> = {}
    const setup: PlanRow[] = []
    for (const row of resp.totals) {
      if (row.group === "setup") {
        setup.push(row)
        continue
      }
      const have = Math.round((resp.pantry[row.id] ?? 0) * 10) / 10
      const short = Math.round(Math.max(0, row.qty - have) * 10) / 10
      const line = { row, have, short, buy: buyCount(short, row.pack) }
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
    const groupKeys = GROUP_ORDER.filter((g) => byGroup[g]?.length)
    return { buy, storeKeys, byGroup, groupKeys, setup }
  })()

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 24 }}>备货</div>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>勾上要备的订单，一键算出"买什么、买几瓶、去哪买"。差多少一律往上取整到整瓶整盒——最小采购单位就是一瓶，剩多少是师傅现场的事。</div>
      </div>

      {events.length === 0 ? <div style={{ color: MUTED, fontSize: 13 }}>未来 10 天没有订单。</div> : null}
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
                      要 {Math.round(row.qty * 10) / 10} {row.unit} · 在库 {have} {row.unit}
                      {row.pack?.desc ? ` · ${row.pack.desc}` : ""}
                    </div>
                  </div>
                  <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 20, color: "var(--color-accent-700)", whiteSpace: "nowrap" }}>
                    {buy === null ? `补 ${short} ${row.unit}` : `买 ${buy} ${row.pack!.noun}`}
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

          {groups.groupKeys.length ? (
            <section>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `2px solid ${INK}`, paddingBottom: 8 }}>
                <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 19 }}>需求 vs 在库（核对用）</div>
                <div style={{ fontSize: 12.5, color: MUTED }}>数字不对就去"库存"页签点格子改</div>
              </div>
              {groups.groupKeys.map((g) => (
                <div key={g} style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, letterSpacing: "0.04em", marginBottom: 4 }}>{PREP_GROUP_TITLES[g]}</div>
                  {groups.byGroup[g].map(({ row, have, short, buy }) => (
                    <div key={row.id} style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) auto auto auto", gap: 14, alignItems: "baseline", padding: "8px 0", borderBottom: "1px solid var(--color-divider)" }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{row.label}</div>
                      <div style={{ fontSize: 13, color: MUTED, whiteSpace: "nowrap" }}>要 {Math.round(row.qty * 10) / 10} {row.unit}</div>
                      <div style={{ fontSize: 13, color: MUTED, whiteSpace: "nowrap" }}>在库 {have} {row.unit}</div>
                      <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 14, whiteSpace: "nowrap", color: short > 0 ? "var(--color-accent-700)" : "#16a34a" }}>
                        {short > 0 ? (buy === null ? `补 ${short} ${row.unit}` : `买 ${buy} ${row.pack!.noun}`) : "够"}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
