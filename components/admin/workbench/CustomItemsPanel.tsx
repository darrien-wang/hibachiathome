"use client"

import { useEffect, useMemo, useState } from "react"
import { adminJson } from "./api"
import { Kicker } from "./ui"
import { CUSTOM_ITEM_LIMITS, CUSTOM_ITEMS_MAX, customItemsOf, customUnitZh, type CustomItemLite } from "@/lib/custom-items"

// 订单另加（自定义项，老板 2026-11-21：「那就订单这里加个自定义项，以后可能还有很多新的需求，到时候就
// 从这个地方走」）。菜单上没有的东西按单加在这里：账单上一行（单价 0 = 送的，写 On us），师傅备料单和
// 备货清单上一行（中文名在前，备注写在下面）。存的时候整份交给 /api/admin/orders/custom-items，走发票
// 应用的 save-invoice（和 desk、发票工具同一条路），所以改单通知、审查指纹照常。会改账单，只有老板能改。

type Draft = { name: string; nameZh: string; qty: string; unit: string; price: string; note: string }

const toDraft = (it: CustomItemLite): Draft => ({ name: it.name, nameZh: it.nameZh ?? "", qty: String(it.qty), unit: it.unit, price: String(it.price), note: it.note ?? "" })
const BLANK: Draft = { name: "", nameZh: "", qty: "1", unit: "serving", price: "0", note: "" }
// 空着的数量、单价不能当 0：单价空着交上去会被退回，不会悄悄变成送的。
const num = (s: string) => (s.trim() === "" ? Number.NaN : Number(s))

export function CustomItemsPanel({
  adminKey,
  orderId,
  invoiceData,
  canEdit,
  onSaved,
}: {
  adminKey: string
  orderId: string
  invoiceData: Record<string, unknown> | null | undefined
  canEdit: boolean
  onSaved: () => Promise<void> | void
}) {
  const saved = useMemo(() => customItemsOf(invoiceData), [invoiceData])
  const savedKey = JSON.stringify(saved)
  const [rows, setRows] = useState<Draft[]>(() => saved.map(toDraft))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  // 订单重新读回来（存过、或别处改过）：编辑框跟着换成订单上的那份。
  useEffect(() => {
    setRows((JSON.parse(savedKey) as CustomItemLite[]).map(toDraft))
  }, [savedKey])
  const dirty = JSON.stringify(rows) !== JSON.stringify(saved.map(toDraft))

  const set = (i: number, patch: Partial<Draft>) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const save = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const items = rows.map((r) => ({ name: r.name.trim(), nameZh: r.nameZh.trim(), qty: num(r.qty), unit: r.unit.trim() || "each", price: num(r.price), note: r.note.trim() }))
      const d = await adminJson<{ ok: boolean; unchanged?: boolean; warning?: string }>(adminKey, "/api/admin/orders/custom-items", { body: { orderId, items } })
      setMsg(d.warning ? { text: d.warning, bad: true } : { text: d.unchanged ? "没变，不用存" : "已保存：账单、备料单和备货清单都按这份。72 小时内的派对，系统约 10 分钟后短信告诉师傅改了什么。" })
      await onSaved()
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "没存上", bad: true })
    } finally {
      setBusy(false)
    }
  }

  if (!canEdit && saved.length === 0) return null
  // 一项一行，窄屏（老板手机上的工作台）自动折成两三行。
  const cell = (basis: string) => ({ padding: "6px 8px", flex: basis, minWidth: 0 }) as const
  return (
    <div>
      <Kicker>订单另加（自定义项）</Kicker>
      <div style={{ fontSize: 12, color: "var(--color-neutral-600)", margin: "4px 0 6px", lineHeight: 1.5 }}>
        菜单上没有的东西加在这里。英文名印在客人的账单上（单价 0 = 送的，账单写 On us）；中文名和备注只给师傅和备货看。
      </div>
      {!canEdit ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          {saved.map((it) => (
            <div key={it.name}>
              {it.nameZh ? `${it.nameZh} · ` : ""}
              {it.name} ×{it.qty} {customUnitZh(it.unit)} · {it.price > 0 ? `$${it.price.toFixed(2)} 一${customUnitZh(it.unit)}` : "送的（On us）"}
              {it.note ? <span style={{ color: "var(--color-neutral-600)" }}> · {it.note}</span> : null}
            </div>
          ))}
          <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>只有老板能改。</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", paddingBottom: 6, borderBottom: "1px solid var(--color-line)" }}>
              <input className="input" style={cell("2 1 150px")} value={r.name} maxLength={CUSTOM_ITEM_LIMITS.name} placeholder="英文名（客人看）Plain rice" aria-label="英文名" onChange={(e) => set(i, { name: e.target.value })} />
              <input className="input" style={cell("1 1 90px")} value={r.nameZh} maxLength={CUSTOM_ITEM_LIMITS.nameZh} placeholder="中文名 白米饭" aria-label="中文名" onChange={(e) => set(i, { nameZh: e.target.value })} />
              <input className="input" style={cell("0 0 60px")} value={r.qty} inputMode="decimal" placeholder="数量" aria-label="数量" onChange={(e) => set(i, { qty: e.target.value })} />
              <input className="input" style={cell("0 0 84px")} value={r.unit} maxLength={CUSTOM_ITEM_LIMITS.unit} placeholder="serving" aria-label="单位" onChange={(e) => set(i, { unit: e.target.value })} />
              <input className="input" style={cell("0 0 72px")} value={r.price} inputMode="decimal" placeholder="$ 单价" aria-label="单价（美元，0 = 送的）" title="单价（美元，一个单位）；0 = 送的，账单上写 On us" onChange={(e) => set(i, { price: e.target.value })} />
              <input className="input" style={cell("3 1 180px")} value={r.note} maxLength={CUSTOM_ITEM_LIMITS.note} placeholder="备注（给师傅/备货）生米每份约 3 oz" aria-label="备注" onChange={(e) => set(i, { note: e.target.value })} />
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))} title="去掉这一项（存了才算）">
                删
              </button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy || rows.length >= CUSTOM_ITEMS_MAX} onClick={() => setRows((prev) => [...prev, { ...BLANK }])}>
              + 加一项
            </button>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy || !dirty} onClick={() => void save()}>
              {busy ? "保存中…" : "保存"}
            </button>
            {dirty ? (
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setRows(saved.map(toDraft))}>
                不改了
              </button>
            ) : null}
            {dirty ? <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>没保存</span> : null}
          </div>
        </div>
      )}
      {msg ? <div style={{ fontSize: 12, marginTop: 6, color: msg.bad ? "var(--color-accent-700)" : "var(--color-neutral-600)" }}>{msg.text}</div> : null}
    </div>
  )
}
