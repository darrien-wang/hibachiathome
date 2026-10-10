"use client"

import { useCallback, useEffect, useState } from "react"
import { adminJson } from "./api"
import { Dialog, DialogHead, Tag } from "./ui"
import { askConfirm, askPrompt } from "./ask"

// 下单：常买清单 + 要买的（老板 2026-10-10）。
// 讨论好"以后都买这个"的东西存在这里，带着比过价的链接。缺了点「缺了」，
// 上面"要买的"按店分组，点「去下单」直接打开商品页，买完点「买了」。
// 新东西多半是 agent 在聊天里比完价写进来的（.claude/skills/buy-list），页面也能改。

type Candidate = { title: string; url?: string; price?: number; ship?: number; store?: string; size?: string; note?: string; checked?: string }
type BuyItem = {
  id: string
  label: string
  unit: string
  category: string | null
  item_key: string | null
  candidates: Candidate[]
  chosen_url: string | null
  buy_note: string | null
  note: string | null
  need_qty: number
  need_note: string | null
  needed_at: string | null
  last_bought_at: string | null
}

const INK = "var(--color-text)"
const MUTED = "var(--color-neutral-700)"
const money = (c: number | null | undefined) =>
  c === null || c === undefined ? "—" : `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
// 到手价 = 标价 + 运费，比价只看这个。
const landed = (c: Candidate) => (c.price ?? 0) + (c.ship ?? 0)
const chosenOf = (it: BuyItem): Candidate | undefined =>
  it.candidates.find((c) => c.url && c.url === it.chosen_url) ?? [...it.candidates].sort((a, b) => landed(a) - landed(b))[0]
const storeOf = (it: BuyItem) => chosenOf(it)?.store || "没定在哪买"
const day = (iso: string | null) => (iso ? iso.slice(5, 10) : "")

export default function BuyListTab({ adminKey }: { adminKey: string }) {
  const [items, setItems] = useState<BuyItem[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState<BuyItem | "new" | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await adminJson<{ items: BuyItem[] }>(adminKey, "/api/admin/buy-list")
      setItems(r.items.map((it) => ({ ...it, need_qty: Number(it.need_qty) || 0, candidates: Array.isArray(it.candidates) ? it.candidates : [] })))
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
        await adminJson(adminKey, "/api/admin/buy-list", { body })
        await load()
      } catch (e) {
        setErr(e instanceof Error ? e.message : "没存上")
      } finally {
        setBusy(null)
      }
    },
    [adminKey, load],
  )

  if (!items) return <div style={{ color: MUTED, fontSize: 13 }}>{err ? `读不到：${err}` : "读取中…"}</div>

  const needs = items.filter((it) => it.need_qty > 0)
  const byStore: Record<string, BuyItem[]> = {}
  for (const it of needs) (byStore[storeOf(it)] = byStore[storeOf(it)] ?? []).push(it)
  const byCat: Record<string, BuyItem[]> = {}
  for (const it of items) (byCat[it.category || "其他"] = byCat[it.category || "其他"] ?? []).push(it)

  const markNeed = async (it: BuyItem) => {
    const s = await askPrompt({ title: `缺 ${it.label}`, message: `要买几${it.unit}？`, defaultValue: "1" })
    if (s === null) return
    const n = Number(s)
    if (Number.isFinite(n) && n > 0) void act({ action: "need", id: it.id, qty: n }, `need:${it.id}`)
  }

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 24 }}>下单</div>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 4, lineHeight: 1.6 }}>
          定下来以后都买这个的东西放在下面「常买」，带着比过价的链接。缺了点「缺了」，它就跑到上面按店排好，点「去下单」直接开商品页。
          也可以在聊天里跟 agent 说缺什么。
        </div>
      </div>

      {err ? <div className="notice danger" style={{ marginBottom: 12 }}>{err}</div> : null}

      <div style={{ borderBottom: `2px solid ${INK}`, paddingBottom: 6, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="kicker">要买的 · {needs.length}</span>
      </div>
      {needs.length === 0 ? <div style={{ fontSize: 13, color: MUTED, marginBottom: 20 }}>现在什么都不缺。</div> : null}
      {Object.entries(byStore).map(([store, list]) => {
        const total = list.reduce((a, it) => {
          const c = chosenOf(it)
          return a + (c ? landed(c) * it.need_qty : 0)
        }, 0)
        return (
          <div key={store} style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <span style={{ fontWeight: 800, fontSize: 15 }}>{store}</span>
              {total ? <span style={{ fontSize: 12.5, color: MUTED }}>大约 {money(total)}</span> : null}
            </div>
            {list.map((it) => {
              const c = chosenOf(it)
              return (
                <div key={it.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "9px 0", borderBottom: "1px solid var(--color-divider)" }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {it.label} <span style={{ color: "var(--color-accent-700)" }}>× {it.need_qty} {it.unit}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: MUTED, marginTop: 2 }}>
                      {c ? `${c.title}${c.price !== undefined ? ` · ${money(landed(c))}` : ""}` : "还没定买哪个"}
                      {it.need_note ? ` · ${it.need_note}` : ""}
                    </div>
                  </div>
                  {c?.url ? (
                    <a className="btn btn-primary btn-sm" href={c.url} target="_blank" rel="noopener noreferrer">
                      去下单
                    </a>
                  ) : null}
                  <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => void act({ action: "bought", id: it.id }, `bought:${it.id}`)}>
                    买了
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => void act({ action: "need", id: it.id, qty: 0 }, `need:${it.id}`)}>
                    不买了
                  </button>
                </div>
              )
            })}
          </div>
        )
      })}

      <div style={{ borderBottom: `2px solid ${INK}`, paddingBottom: 6, margin: "26px 0 8px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="kicker">常买 · {items.length}</span>
        <button type="button" className="wb-chip wb-chip-sm" onClick={() => setEditing("new")}>
          + 新加一样
        </button>
      </div>
      {Object.entries(byCat).map(([cat, list]) => (
        <div key={cat} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, color: MUTED, fontWeight: 700, marginTop: 8 }}>{cat}</div>
          {list.map((it) => {
            const c = chosenOf(it)
            return (
              <div key={it.id} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "8px 0", borderBottom: "1px solid var(--color-divider)" }}>
                <button type="button" className="btn btn-ghost btn-sm" style={{ flex: 1, minWidth: 180, padding: 0, textAlign: "left", display: "block" }} onClick={() => setEditing(it)} title="点开看候选、改链接">
                  <span style={{ fontWeight: 700, fontSize: 14.5 }}>{it.label}</span>
                  {c?.store ? <Tag cls="tag-outline">{c.store}</Tag> : null}
                  {it.need_qty > 0 ? <Tag cls="tag-faint">要买</Tag> : null}
                  <span style={{ display: "block", fontSize: 12.5, color: MUTED, fontWeight: 400, marginTop: 2 }}>
                    {c ? `${c.title}${c.size ? ` · ${c.size}` : ""}` : "还没有候选"}
                    {c?.checked ? ` · ${c.checked.slice(5)} 看的价` : ""}
                    {it.last_bought_at ? ` · 上次买 ${day(it.last_bought_at)}` : ""}
                  </span>
                </button>
                <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 15, whiteSpace: "nowrap" }}>{c && c.price !== undefined ? money(landed(c)) : ""}</span>
                {c?.url ? (
                  <a className="btn btn-secondary btn-sm" href={c.url} target="_blank" rel="noopener noreferrer">
                    链接
                  </a>
                ) : null}
                <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy || it.need_qty > 0} onClick={() => void markNeed(it)}>
                  缺了
                </button>
              </div>
            )
          })}
        </div>
      ))}

      {editing ? (
        <BuyItemDialog
          item={editing === "new" ? null : editing}
          busy={!!busy}
          onClose={() => setEditing(null)}
          onArchive={
            editing === "new"
              ? undefined
              : async () => {
                  if (!(await askConfirm({ title: "不再买这个？", message: `「${editing.label}」从常买里拿掉。候选会留在库里。` }))) return
                  await act({ action: "archive", id: editing.id }, `archive:${editing.id}`)
                  setEditing(null)
                }
          }
          onSave={async (patch) => {
            await act({ action: "upsert", ...(editing === "new" ? {} : { id: editing.id }), ...patch }, "save")
            setEditing(null)
          }}
        />
      ) : null}
    </div>
  )
}

function BuyItemDialog({
  item,
  busy,
  onClose,
  onSave,
  onArchive,
}: {
  item: BuyItem | null
  busy: boolean
  onClose: () => void
  onSave: (patch: Record<string, unknown>) => Promise<void>
  onArchive?: () => Promise<void>
}) {
  const [label, setLabel] = useState(item?.label ?? "")
  const [unit, setUnit] = useState(item?.unit ?? "件")
  const [category, setCategory] = useState(item?.category ?? "")
  const [buyNote, setBuyNote] = useState(item?.buy_note ?? "")
  const [chosen, setChosen] = useState(item?.chosen_url ?? "")
  const [cands, setCands] = useState<Candidate[]>(item?.candidates ?? [])

  // 价格按「元」填，存成分。
  const dollars = (c?: number) => (c === undefined || c === null ? "" : (c / 100).toFixed(2))
  const toCents = (v: string) => {
    const n = Number(v)
    return v.trim() !== "" && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined
  }
  const patchCand = (i: number, k: keyof Candidate, v: string) =>
    setCands((prev) => prev.map((c, j) => (j !== i ? c : { ...c, [k]: k === "price" || k === "ship" ? toCents(v) : v || undefined })))

  const field = (text: string, node: React.ReactNode) => (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="kicker">{text}</span>
      {node}
    </label>
  )

  return (
    <Dialog onClose={onClose} width={680}>
      <DialogHead title={item ? item.label : "新加一样常买的"} lines={["候选里选一个当「去下单」的链接"]} onClose={onClose} />
      <div className="dialog-col" style={{ gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
          {field("名称", <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="干蒜粒" />)}
          {field("按什么买", <input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="袋 / 箱 / 瓶" />)}
          {field("分类", <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="调料 / 一次性 / 点火" />)}
        </div>
        {field("怎么买、要注意什么", <textarea className="input" rows={2} value={buyNote} onChange={(e) => setBuyNote(e.target.value)} />)}

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderBottom: `2px solid ${INK}`, paddingBottom: 6, marginBottom: 8 }}>
            <span className="kicker">候选商品</span>
            <button type="button" className="wb-chip wb-chip-sm" onClick={() => setCands((p) => [...p, { title: "" }])}>
              + 加一个
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cands.map((c, i) => {
              const on = !!c.url && c.url === chosen
              return (
                <div key={i} style={{ border: on ? `2px solid ${INK}` : "1px solid var(--color-divider)", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input className="input" style={{ flex: 1 }} value={c.title ?? ""} onChange={(e) => patchCand(i, "title", e.target.value)} placeholder="商品标题" />
                    {c.url ? (
                      <button type="button" className="wb-chip wb-chip-sm" aria-pressed={on} onClick={() => setChosen(on ? "" : c.url ?? "")}>
                        {on ? "已选" : "选它"}
                      </button>
                    ) : null}
                    <button type="button" className="wb-chip wb-chip-sm" onClick={() => setCands((p) => p.filter((_, j) => j !== i))}>
                      删
                    </button>
                  </div>
                  <input className="input" value={c.url ?? ""} onChange={(e) => patchCand(i, "url", e.target.value)} placeholder="商品链接" />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 8 }}>
                    <input className="input" inputMode="decimal" value={dollars(c.price)} onChange={(e) => patchCand(i, "price", e.target.value)} placeholder="标价 $" />
                    <input className="input" inputMode="decimal" value={dollars(c.ship)} onChange={(e) => patchCand(i, "ship", e.target.value)} placeholder="运费 $" />
                    <input className="input" value={c.store ?? ""} onChange={(e) => patchCand(i, "store", e.target.value)} placeholder="哪家店" />
                    <input className="input" value={c.size ?? ""} onChange={(e) => patchCand(i, "size", e.target.value)} placeholder="规格" />
                  </div>
                  <input className="input" value={c.note ?? ""} onChange={(e) => patchCand(i, "note", e.target.value)} placeholder="备注" />
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !label.trim()}
            onClick={() =>
              void onSave({
                label,
                unit,
                category,
                buy_note: buyNote,
                chosen_url: chosen,
                candidates: cands.filter((c) => (c.title ?? "").trim()),
              })
            }
          >
            {busy ? "存着…" : "保存"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
          {onArchive ? (
            <button type="button" className="btn btn-ghost" style={{ marginLeft: "auto" }} disabled={busy} onClick={() => void onArchive()}>
              不再买这个
            </button>
          ) : null}
        </div>
      </div>
    </Dialog>
  )
}
