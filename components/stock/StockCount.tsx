"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { VoiceAssist } from "./VoiceAssist"
import {
  RESTOCK_CHECK,
  RESTOCK_LEVEL_LABEL,
  STOCK_GROUPS,
  STOCK_ITEMS,
  baseUnitOf,
  describeTotal,
  isDue,
  lineText,
  looseUnits,
  specAmountText,
  totalBase,
  unitLabel,
  type AmountUnit,
  type CountLine,
  type CustomSpec,
  type RestockLevel,
  type StockItemDef,
} from "@/lib/stocktake"

// 师傅盘点页（/tools/stock?t=…，老板 2026-11-26）。站在冰箱前用手机点：
// 一样一张卡，按保质期从短到长排；整包点规格加减，拆开的称重或数个数；没见过的包装当场加一个规格。
// 一次提交 = 一次盘点，写进备货系统的「在库」。没提交前刷新也不丢（存在这台手机上）。

type ItemState = { key: string; qty: number | null; countedAt: string | null; countedBy: string | null; lastLines: CountLine[] | null; lastLevel: RestockLevel | null }
type Resp = { ok: boolean; error?: string; me: { name: string; via: string; owner: boolean }; items: ItemState[]; specs: CustomSpec[] }
type Draft = Record<string, CountLine[]>

const r1 = (n: number) => Math.round(n * 10) / 10
const md = (iso: string) => new Date(iso).toLocaleString("zh-CN", { timeZone: "America/Los_Angeles", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })

function store(key: string) {
  return {
    read(): { draft: Draft; levels: Record<string, RestockLevel>; at: number } | null {
      try {
        const v = JSON.parse(localStorage.getItem(key) ?? "null")
        return v && Date.now() - v.at < 12 * 3600_000 ? v : null
      } catch {
        return null
      }
    },
    write(draft: Draft, levels: Record<string, RestockLevel>) {
      try {
        if (!Object.keys(draft).length && !Object.keys(levels).length) localStorage.removeItem(key)
        else localStorage.setItem(key, JSON.stringify({ draft, levels, at: Date.now() }))
      } catch {}
    },
  }
}

export function StockCount() {
  const sp = useSearchParams()
  const token = (sp.get("t") ?? "").trim()
  const api = `/api/tools/stock${token ? `?t=${encodeURIComponent(token)}` : ""}`
  const saved = useMemo(() => store(`stock-draft:${token || "wb"}`), [token])

  const [d, setD] = useState<Resp | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>({})
  const [levels, setLevels] = useState<Record<string, RestockLevel>>({})
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [restored, setRestored] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch(api, { cache: "no-store" })
      const j = (await r.json()) as Resp
      if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`)
      setD(j)
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "打不开")
    }
  }, [api])

  useEffect(() => {
    void load()
    const s = saved.read()
    if (s) {
      setDraft(s.draft ?? {})
      setLevels(s.levels ?? {})
      setRestored(Object.keys(s.draft ?? {}).length + Object.keys(s.levels ?? {}).length > 0)
    }
  }, [load, saved])
  useEffect(() => saved.write(draft, levels), [draft, levels, saved])

  const state = useMemo(() => new Map((d?.items ?? []).map((i) => [i.key, i])), [d])
  const specsOf = useCallback((key: string) => (d?.specs ?? []).filter((s) => s.item_key === key), [d])
  const order = STOCK_ITEMS.map((i) => i.key)
  const touched = Object.keys(draft).length + Object.keys(levels).length
  const dueCount = STOCK_ITEMS.filter((i) => isDue(i.group, state.get(i.key)?.countedAt ?? null) && !draft[i.key]).length

  const setLines = (key: string, lines: CountLine[]) => setDraft((cur) => ({ ...cur, [key]: lines }))
  const clearItem = (key: string) =>
    setDraft((cur) => {
      const n = { ...cur }
      delete n[key]
      return n
    })
  const next = (key: string) => {
    const i = order.indexOf(key)
    setOpen(order[i + 1] ?? null)
    if (order[i + 1]) setTimeout(() => document.getElementById(`stock-${order[i + 1]}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60)
  }

  const addSpec = async (def: StockItemDef, amount: number, unit: AmountUnit, label: string) => {
    const r = await fetch(api, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "add_spec", item_key: def.key, amount, unit, label }) })
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; spec?: CustomSpec; error?: string }
    if (!r.ok || !j.spec) throw new Error(j.error ?? "没加上")
    setD((cur) => (cur && !cur.specs.some((s) => s.id === j.spec!.id) ? { ...cur, specs: [...cur.specs, j.spec!] } : cur))
    return j.spec
  }

  const submit = async () => {
    if (!touched || busy) return
    setBusy(true)
    try {
      const items = [...Object.entries(draft).map(([item_key, lines]) => ({ item_key, lines })), ...Object.entries(levels).map(([item_key, level]) => ({ item_key, level }))]
      const r = await fetch(api, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "submit", items }) })
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; applied?: number; error?: string }
      if (!r.ok || !j.ok) throw new Error(j.error ?? `HTTP ${r.status}`)
      setDraft({})
      setLevels({})
      setOpen(null)
      setRestored(false)
      setDone(`交上去了：${j.applied ?? items.length} 样。备货那边的「在库」已经是这次的数。`)
      window.scrollTo({ top: 0, behavior: "smooth" })
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : "没交上去，再点一次")
    } finally {
      setBusy(false)
    }
  }

  if (err && !d)
    return (
      <main style={{ padding: 20, maxWidth: 560, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24 }}>盘点</h1>
        <div className="notice" style={{ marginTop: 12 }}>
          {err}
        </div>
      </main>
    )
  if (!d) return <main style={{ padding: 20 }}>读取中…</main>

  return (
    <main style={{ padding: "16px 14px 120px", maxWidth: 620, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <h1 style={{ fontSize: 26 }}>盘点</h1>
        <span style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>{d.me.name}</span>
      </header>
      <div style={{ fontSize: 13, color: "var(--color-neutral-700)", lineHeight: 1.55 }}>
        数冰箱里实际有的。整包的点规格加减；拆开的选「散的」，称重或者数个数；没见过的包装点「+ 新规格」加一个。
        {dueCount ? (
          <>
            {" "}
            现在 <b style={{ color: "var(--color-accent-700)" }}>{dueCount} 样该盘</b>。
          </>
        ) : null}
      </div>
      <VoiceAssist
        url={`/api/tools/stock/voice${token ? `?t=${encodeURIComponent(token)}` : ""}`}
        draft={draft}
        levels={levels}
        onApply={({ items, restock, specs }) => {
          if (specs.length) setD((cur) => (cur ? { ...cur, specs: [...cur.specs, ...specs.filter((s) => !cur.specs.some((x) => x.id === s.id))] } : cur))
          setDraft((cur) => {
            const n = { ...cur }
            for (const it of items) n[it.key] = it.mode === "add" ? [...(n[it.key] ?? []), ...it.lines] : it.lines
            return n
          })
          if (restock.length) setLevels((cur) => ({ ...cur, ...Object.fromEntries(restock.map((r) => [r.key, r.level])) }))
          setDone(null)
        }}
      />
      {done ? <div className="notice notice-accent">{done}</div> : null}
      {restored ? <div className="notice">上次没交的已经帮你留着了。</div> : null}
      {err ? <div className="notice notice-accent">{err}</div> : null}

      {STOCK_GROUPS.filter((g) => g.id !== "restock").map((g) => (
        <section key={g.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
            <h2 style={{ fontSize: 17 }}>{g.title}</h2>
            <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>{g.hint}</span>
          </div>
          {STOCK_ITEMS.filter((i) => i.group === g.id).map((def) => (
            <ItemCard
              key={def.key}
              def={def}
              st={state.get(def.key)}
              lines={draft[def.key]}
              specs={specsOf(def.key)}
              open={open === def.key}
              onToggle={() => setOpen((o) => (o === def.key ? null : def.key))}
              onLines={(l) => setLines(def.key, l)}
              onClear={() => clearItem(def.key)}
              onNext={() => next(def.key)}
              onAddSpec={(a, u, l) => addSpec(def, a, u, l)}
            />
          ))}
        </section>
      ))}

      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ marginTop: 6 }}>
          <h2 style={{ fontSize: 17 }}>补货型 · 米油酱</h2>
          <div style={{ fontSize: 12, color: "var(--color-neutral-600)", marginTop: 2 }}>不用数，看一眼够不够；快没了随时来点一下。</div>
        </div>
        {RESTOCK_CHECK.map((r) => {
          const st = state.get(r.key)
          const cur = levels[r.key]
          return (
            <div key={r.key} className="card" style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: "10px 12px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{r.label}</div>
                <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
                  {st?.lastLevel ? `上次：${RESTOCK_LEVEL_LABEL[st.lastLevel]}` : "还没报过"}
                  {st?.countedAt ? ` · ${md(st.countedAt)}${st.countedBy ? ` ${st.countedBy}` : ""}` : ""}
                </div>
              </div>
              <div style={{ display: "flex" }}>
                {(["ok", "low", "out"] as RestockLevel[]).map((lv) => (
                  <button
                    key={lv}
                    type="button"
                    className="wb-chip"
                    aria-pressed={cur === lv ? "true" : "false"}
                    style={{ minHeight: 40, marginLeft: -1, color: cur !== lv && lv !== "ok" ? "var(--color-accent-700)" : undefined }}
                    onClick={() =>
                      setLevels((c) => {
                        const n = { ...c }
                        if (n[r.key] === lv) delete n[r.key]
                        else n[r.key] = lv
                        return n
                      })
                    }
                  >
                    {RESTOCK_LEVEL_LABEL[lv]}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </section>

      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, background: "var(--color-bg)", borderTop: "2px solid var(--color-divider)", padding: "10px 14px calc(10px + env(safe-area-inset-bottom))", zIndex: 30 }}>
        <div style={{ maxWidth: 620, margin: "0 auto", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, fontSize: 13 }}>{touched ? `这次盘了 ${touched} 样` : "点开一样开始盘"}</div>
          <button type="button" className="btn btn-primary" style={{ minHeight: 46, padding: "0 22px", fontSize: 15 }} disabled={!touched || busy} onClick={() => void submit()}>
            {busy ? "提交中…" : "提交"}
          </button>
        </div>
      </div>
    </main>
  )
}

function ItemCard({
  def,
  st,
  lines,
  specs,
  open,
  onToggle,
  onLines,
  onClear,
  onNext,
  onAddSpec,
}: {
  def: StockItemDef
  st: ItemState | undefined
  lines: CountLine[] | undefined
  specs: CustomSpec[]
  open: boolean
  onToggle: () => void
  onLines: (l: CountLine[]) => void
  onClear: () => void
  onNext: () => void
  onAddSpec: (amount: number, unit: AmountUnit, label: string) => Promise<CustomSpec>
}) {
  const due = isDue(def.group, st?.countedAt ?? null)
  const counted = lines !== undefined
  const total = counted ? totalBase(def, lines) : null
  const unit = baseUnitOf(def.key)
  const allSpecs = [...def.specs.map((s) => ({ ...s, custom: false })), ...specs.map((s) => ({ id: s.id, label: s.label, amount: s.amount, unit: s.unit, custom: true }))]
  const cur = lines ?? []
  const [adding, setAdding] = useState(false)

  const addPack = (s: (typeof allSpecs)[number]) => {
    const i = cur.findIndex((l) => l.kind === "pack" && l.specId === s.id)
    if (i >= 0) onLines(cur.map((l, j) => (j === i && l.kind === "pack" ? { ...l, packs: l.packs + 1 } : l)))
    else onLines([...cur, { kind: "pack", specId: s.id, specLabel: s.label, amount: s.amount, unit: s.unit, packs: 1 }])
  }
  const addLoose = () => onLines([...cur, { kind: "loose", amount: 0, unit: looseUnits(def)[0] ?? "oz" }])
  const patch = (i: number, p: Partial<CountLine>) => onLines(cur.map((l, j) => (j === i ? ({ ...l, ...p } as CountLine) : l)))
  const drop = (i: number) => onLines(cur.filter((_, j) => j !== i))

  return (
    <div id={`stock-${def.key}`} className="card" style={{ padding: 0, gap: 0, scrollMarginTop: 12, outline: open ? "2px solid var(--color-text)" : undefined }}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-label={`${def.label}${counted ? "，这次已盘" : due ? "，该盘" : ""}`} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, padding: "12px 12px", minHeight: 56 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>
            {def.label} <span style={{ fontWeight: 500, fontSize: 12, color: "var(--color-neutral-600)" }}>{def.codes[0].toUpperCase().length <= 3 ? def.codes[0].toUpperCase() : def.en}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--color-neutral-600)", marginTop: 2 }}>
            {counted ? (
              <span style={{ color: "var(--color-text)", fontWeight: 600 }}>这次：{cur.length ? describeTotal(def, total ?? 0) : "没有（0）"}</span>
            ) : (
              <>
                账上 {st?.qty != null ? describeTotal(def, st.qty) : "没记过"}
                {st?.countedAt ? ` · ${md(st.countedAt)}${st.countedBy ? ` ${st.countedBy}` : ""}` : ""}
              </>
            )}
          </div>
        </div>
        {counted ? <span className="tag tag-neutral">✓ 已盘</span> : due ? <span className="tag tag-accent">该盘</span> : <span className="tag tag-faint">最近盘过</span>}
      </button>

      {open ? (
        <div style={{ borderTop: "1px solid var(--color-line)", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {!counted && st?.lastLines?.length ? (
            <button type="button" className="btn btn-secondary btn-left" style={{ minHeight: 40, whiteSpace: "normal" }} onClick={() => onLines(st.lastLines!.map((l) => ({ ...l })))}>
              照上次填：{st.lastLines.map((l) => lineText(def, l)).join(" + ")}
            </button>
          ) : null}

          {cur.map((l, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {l.kind === "pack" ? (
                <>
                  <div style={{ flex: "1 1 140px", minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{l.specLabel}</div>
                    <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>每包 {specAmountText(def, l.amount, l.unit)}</div>
                  </div>
                  <Stepper value={l.packs} onChange={(v) => patch(i, { packs: v })} />
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 600, width: 44 }}>散的</div>
                  <input
                    className="input"
                    inputMode="decimal"
                    value={l.amount ? String(l.amount) : ""}
                    placeholder="0"
                    onChange={(e) => patch(i, { amount: Math.max(0, Number(e.target.value.replace(/[^\d.]/g, "")) || 0) })}
                    style={{ width: 96, fontSize: 18, minHeight: 44, textAlign: "right" }}
                  />
                  <div style={{ display: "flex" }}>
                    {looseUnits(def).map((u) => (
                      <button key={u} type="button" className="wb-chip" aria-pressed={l.unit === u ? "true" : "false"} style={{ minHeight: 44, marginLeft: -1 }} onClick={() => patch(i, { unit: u })}>
                        {unitLabel(def, u)}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <button type="button" className="btn btn-ghost" style={{ minHeight: 44, color: "var(--color-neutral-600)" }} aria-label="删掉这一行" onClick={() => drop(i)}>
                ✕
              </button>
            </div>
          ))}

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {allSpecs.map((s) => (
              <button key={s.id} type="button" className="wb-chip" style={{ minHeight: 44 }} onClick={() => addPack(s)}>
                + {s.label}
                {s.custom ? <span style={{ fontSize: 11, opacity: 0.6 }}>（自加）</span> : null}
              </button>
            ))}
            <button type="button" className="wb-chip" style={{ minHeight: 44 }} onClick={addLoose}>
              + 散的（{looseUnits(def).map((u) => unitLabel(def, u)).join(" / ")}）
            </button>
            <button type="button" className="wb-chip" style={{ minHeight: 44, borderStyle: "dashed" }} onClick={() => setAdding((a) => !a)}>
              + 新规格
            </button>
          </div>

          {adding ? <NewSpec def={def} onCancel={() => setAdding(false)} onAdd={async (a, u, lab) => {
            const s = await onAddSpec(a, u, lab)
            onLines([...cur, { kind: "pack", specId: s.id, specLabel: s.label, amount: s.amount, unit: s.unit, packs: 1 }])
            setAdding(false)
          }} /> : null}

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", borderTop: "1px solid var(--color-line)", paddingTop: 10 }}>
            <div style={{ flex: 1, minWidth: 160, fontSize: 14 }}>
              合计 <b>{counted ? (cur.length ? describeTotal(def, total ?? 0) : `0 ${unit}`) : "—"}</b>
            </div>
            <button type="button" className="btn btn-secondary" style={{ minHeight: 44 }} onClick={() => onLines([])}>
              没有了（0）
            </button>
            {counted ? (
              <button type="button" className="btn btn-ghost" style={{ minHeight: 44 }} onClick={onClear}>
                这样不算
              </button>
            ) : null}
            <button type="button" className="btn btn-primary" style={{ minHeight: 44 }} onClick={onNext}>
              下一样 →
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <button type="button" className="wb-chip" style={{ minHeight: 44, minWidth: 44, justifyContent: "center", fontSize: 18 }} onClick={() => onChange(Math.max(0, r1(value - 1)))} aria-label="少一包">
        −
      </button>
      <input
        className="input"
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          const v = Number(e.target.value)
          if (Number.isFinite(v) && v >= 0) onChange(v)
        }}
        style={{ width: 58, minHeight: 44, fontSize: 18, textAlign: "center", marginLeft: -1, marginRight: -1 }}
        aria-label="几包"
      />
      <button type="button" className="wb-chip" style={{ minHeight: 44, minWidth: 44, justifyContent: "center", fontSize: 18 }} onClick={() => onChange(r1(value + 1))} aria-label="多一包">
        +
      </button>
    </div>
  )
}

function NewSpec({ def, onAdd, onCancel }: { def: StockItemDef; onAdd: (amount: number, unit: AmountUnit, label: string) => Promise<void>; onCancel: () => void }) {
  const units = looseUnits(def)
  const [amount, setAmount] = useState("")
  const [unit, setUnit] = useState<AmountUnit>(units.includes("oz") ? "oz" : (units[0] ?? "oz"))
  const [label, setLabel] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const n = Number(amount)
  return (
    <div style={{ background: "var(--color-neutral-100)", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>新规格：一包多少？</div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input className="input" inputMode="decimal" placeholder="16" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} style={{ width: 96, fontSize: 18, minHeight: 44, textAlign: "right" }} />
        <div style={{ display: "flex" }}>
          {units.map((u) => (
            <button key={u} type="button" className="wb-chip" aria-pressed={unit === u ? "true" : "false"} style={{ minHeight: 44, marginLeft: -1 }} onClick={() => setUnit(u)}>
              {unitLabel(def, u)}
            </button>
          ))}
        </div>
      </div>
      <input className="input" placeholder={`叫什么（可不填，比如「Costco ${n > 0 ? `${n} ${unitLabel(def, unit)}` : "16 oz"}/包」）`} value={label} onChange={(e) => setLabel(e.target.value)} style={{ minHeight: 44, fontSize: 16 }} />
      {err ? <div style={{ fontSize: 12, color: "var(--color-accent-700)" }}>{err}</div> : null}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="btn btn-primary"
          style={{ minHeight: 44 }}
          disabled={!(n > 0) || busy}
          onClick={async () => {
            setBusy(true)
            setErr(null)
            try {
              await onAdd(n, unit, label.trim())
            } catch (e) {
              setErr(e instanceof Error ? e.message : "没加上")
            } finally {
              setBusy(false)
            }
          }}
        >
          加上，并记 1 包
        </button>
        <button type="button" className="btn btn-ghost" style={{ minHeight: 44 }} onClick={onCancel}>
          算了
        </button>
      </div>
      <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>加了以后大家都能直接点，下次不用再加。</div>
    </div>
  )
}
