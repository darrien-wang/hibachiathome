"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { adminJson } from "./api"
import { Chip, Dialog, DialogHead, Kicker, Notice, Spinner, Tag } from "./ui"
import { askConfirm, askPrompt, tell } from "./ask"
import { dowZh, md, money, stamp } from "./helpers"
import { netText, ratePct, statementText, type PartnerLine } from "@/lib/partner-settlement"

// 外包结算（老板 2026-11-23）：外包出去的单给了哪家合作公司、谁该付谁多少、结没结。只有老板看得到。
// 规则在 lib/partner-settlement.ts：我们拿订单总价（含路费）的 30%；只有刷卡的钱在我们手上，Zelle / 现金都是合作方收；
// 净额 = 我们手上的 − 我们该拿的，正数我们付对方，负数对方付我们。办完的单才能结，一次结一家。

type Partner = { id: string; name: string; default_rate_bps: number; active: boolean; notes?: string | null }
type Row = {
  orderId: string
  orderNo: string
  customer: string
  date: string | null
  time: string | null
  started: boolean
  city: string
  adults: number
  kids: number
  cancelled: boolean
  outsourced: boolean
  note: string | null
  invoiceUrl: string | null
  balanceDueCents: number
  offlineCents: number
  live: PartnerLine
  allocation: null | {
    partnerId: string
    rateBps: number
    status: string
    settled: boolean
    settledAt: string | null
    settledBy: string | null
    method: string | null
    note: string | null
    netCents: number | null
    totalCents: number | null
    cutCents: number | null
    collectedCents: number | null
  }
}
type Resp = { ok: boolean; partners: Partner[]; rows: Row[] }

const NONE = "none"
const COLS = "22px 84px minmax(160px,1fr) 140px 76px 96px 84px 190px"
const METHOD_LABEL: Record<string, string> = { zelle: "Zelle", cash: "现金", check: "支票", other: "其他" }
const guestsText = (r: Pick<Row, "adults" | "kids">) => `${r.adults} 大${r.kids ? ` ${r.kids} 小` : ""}`
const netColor = (c: number) => (c > 0 ? "var(--color-accent-700)" : c < 0 ? "#1f7a4d" : "var(--color-neutral-600)")

export default function PartnersTab({ adminKey, isMobile, onOpenOrder, initial }: { adminKey: string; isMobile: boolean; onOpenOrder: (id: string) => void; initial?: Resp }) {
  // initial: render tests only (SSR has no effects to load with).
  const [d, setD] = useState<Resp | null>(initial ?? null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>("all")
  const [picked, setPicked] = useState<Set<string>>(() => new Set())
  const [settleOpen, setSettleOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      setD(await adminJson<Resp>(adminKey, "/api/admin/partners"))
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : "读不出来")
    }
  }, [adminKey])
  useEffect(() => {
    void load()
  }, [load])

  const post = async (key: string, body: Record<string, unknown>) => {
    setBusy(key)
    try {
      const r = await adminJson<{ ok: boolean; error?: string }>(adminKey, "/api/admin/partners", { body })
      if (!r.ok) throw new Error(r.error ?? "没成功")
      return true
    } catch (e) {
      void tell({ title: "没成功", message: e instanceof Error ? e.message : "出错了" })
      return false
    } finally {
      await load()
      setBusy(null)
    }
  }

  const partners = useMemo(() => d?.partners ?? [], [d])
  const nameOf = useMemo(() => new Map(partners.map((p) => [p.id, p.name])), [partners])
  const pidOf = (r: Row) => r.allocation?.partnerId ?? NONE
  const rows = (d?.rows ?? []).filter((r) => filter === "all" || pidOf(r) === filter)
  const open = rows.filter((r) => !r.allocation?.settled && !r.cancelled && r.outsourced)
  const due = open.filter((r) => r.started)
  const upcoming = open.filter((r) => !r.started)
  const settled = rows.filter((r) => r.allocation?.settled)

  // 一家公司一张卡：待结几单、净额、还没办几单。
  const cards = useMemo(() => {
    const all = (d?.rows ?? []).filter((r) => !r.allocation?.settled && !r.cancelled && r.outsourced)
    const keys = [...partners.filter((p) => p.active || all.some((r) => pidOf(r) === p.id)).map((p) => p.id), ...(all.some((r) => pidOf(r) === NONE) ? [NONE] : [])]
    return keys.map((k) => {
      const mine = all.filter((r) => pidOf(r) === k)
      const done = mine.filter((r) => r.started)
      return { key: k, name: k === NONE ? "未选公司" : nameOf.get(k) ?? "?", done: done.length, net: done.reduce((a, r) => a + r.live.netCents, 0), later: mine.length - done.length, rate: partners.find((p) => p.id === k)?.default_rate_bps ?? null }
    })
  }, [d, partners, nameOf])

  // 勾选：只能同一家公司、已选公司、办完的。
  const pickedRows = due.filter((r) => picked.has(r.orderId))
  const pickedPartner = pickedRows[0]?.allocation?.partnerId ?? null
  const canPick = (r: Row) => !!r.allocation && (!pickedPartner || r.allocation.partnerId === pickedPartner)
  const toggle = (id: string, on: boolean) =>
    setPicked((p) => {
      const n = new Set(p)
      if (on) n.add(id)
      else n.delete(id)
      return n
    })
  const pickedNet = pickedRows.reduce((a, r) => a + r.live.netCents, 0)

  const statementOf = (pid: string, list: Row[]) =>
    statementText(
      nameOf.get(pid) ?? "合作方",
      list.map((r) => ({ date: r.date ? md(r.date) : "", orderNo: r.orderNo, customer: r.customer, guests: guestsText(r), city: r.city, line: r.live })),
    )
  const copyStatement = async (pid: string, list: Row[]) => {
    const text = statementOf(pid, list)
    try {
      await navigator.clipboard.writeText(text)
      void tell({ title: "对账单已复制", message: text })
    } catch {
      void tell({ title: "复制不了，手动复制下面这段", message: text })
    }
  }

  const assign = (r: Row, partnerId: string) => void post(`assign:${r.orderId}`, { action: "assign", order_id: r.orderId, partner_id: partnerId === NONE ? null : partnerId })
  const changeRate = async (r: Row) => {
    if (!r.allocation) return
    const v = await askPrompt({ title: `${r.customer} · 我们拿几成`, message: "这一单我们拿订单总价（含路费）的百分之几。只改这一单。", defaultValue: String(r.allocation.rateBps / 100), inputMode: "decimal", okLabel: "改" })
    if (v === null) return
    await post(`rate:${r.orderId}`, { action: "set_rate", order_id: r.orderId, rate: v })
  }
  const unsettle = async (r: Row) => {
    if (!(await askConfirm({ title: `撤销结清：${r.customer}`, message: "这单回到待结，结清记录（金额、方式）清掉。钱已经过手的话，记得再结一次。", okLabel: "撤销", danger: true }))) return
    await post(`unsettle:${r.orderId}`, { action: "unsettle", order_id: r.orderId })
  }
  const addPartner = async () => {
    const name = await askPrompt({ title: "加一家合作公司", message: "公司名字", placeholder: "比如 Meet Hibachi", okLabel: "下一步" })
    if (!name?.trim()) return
    const rate = await askPrompt({ title: `${name.trim()} · 我们拿几成`, message: "外包给这家时，我们拿订单总价（含路费）的百分之几。", defaultValue: "30", inputMode: "decimal", okLabel: "加上" })
    if (rate === null) return
    await post("add", { action: "add_partner", name: name.trim(), rate })
  }
  const editPartner = async (p: Partner) => {
    const rate = await askPrompt({ title: `${p.name} · 我们拿几成`, message: "以后指派给这家的单按这个比例；已经指派的单不变（要改到单子那行点比例）。", defaultValue: String(p.default_rate_bps / 100), inputMode: "decimal", okLabel: "改" })
    if (rate === null) return
    await post(`p:${p.id}`, { action: "update_partner", id: p.id, rate })
  }
  const togglePartner = async (p: Partner) => {
    if (p.active && !(await askConfirm({ title: `停用 ${p.name}`, message: "停用后派单地图的下拉里不再出现这家；已经指派的单和结算记录不受影响。", okLabel: "停用" }))) return
    await post(`p:${p.id}`, { action: "update_partner", id: p.id, active: !p.active })
  }

  if (err) return <div style={{ padding: 24 }}><Notice accent>{err}</Notice></div>
  if (!d) return <div style={{ padding: 24 }}><Spinner /></div>

  const PartnerSelect = ({ r }: { r: Row }) => (
    <select
      aria-label="合作公司"
      value={pidOf(r)}
      disabled={busy !== null || r.allocation?.settled}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => assign(r, e.target.value)}
      style={{ fontSize: 13, padding: "2px 4px", maxWidth: 150, fontWeight: r.allocation ? 700 : 400, color: r.allocation ? undefined : "var(--color-accent-700)" }}
    >
      <option value={NONE}>未选公司</option>
      {partners.filter((p) => p.active || p.id === r.allocation?.partnerId).map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  )

  const OrderRowView = ({ r, pick, provisional }: { r: Row; pick?: boolean; provisional?: boolean }) => {
    const line = r.live
    const partner = r.allocation ? nameOf.get(r.allocation.partnerId) ?? "?" : "合作方"
    const flags: string[] = []
    if (!provisional && r.balanceDueCents > 0 && line.collectedCents === 0 && r.offlineCents === 0) flags.push("尾款没登记，按客人付给合作方算")
    if (r.cancelled) flags.push("已取消")
    const check = pick ? (
      <input
        type="checkbox"
        checked={picked.has(r.orderId)}
        disabled={!canPick(r) || busy !== null}
        title={!r.allocation ? "先选合作公司" : !canPick(r) ? "一次只结一家公司的单" : "勾上一起结"}
        aria-label="勾上一起结"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => toggle(r.orderId, e.target.checked)}
        style={{ width: 16, height: 16 }}
      />
    ) : (
      <span />
    )
    const when = r.date ? `${md(r.date)} ${dowZh(r.date)}` : "日期未定"
    const who = (
      <>
        <strong>{r.customer}</strong> <span style={{ color: "var(--color-neutral-600)" }}>· {r.city || "—"} · {guestsText(r)}</span>{" "}
        <span className="mono" style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>{r.orderNo}</span>
        {flags.length ? <div style={{ fontSize: 12, color: "var(--color-accent-700)" }}>{flags.join(" · ")}</div> : null}
      </>
    )
    const rateBtn = (
      <button
        type="button"
        className="btn btn-ghost"
        disabled={!r.allocation || busy !== null}
        title={r.allocation ? "改这一单的比例" : "先选合作公司"}
        onClick={(e) => {
          e.stopPropagation()
          void changeRate(r)
        }}
        style={{ padding: 0, minHeight: 0, fontSize: 11, color: "var(--color-neutral-600)" }}
      >
        {ratePct(line.rateBps)}
      </button>
    )
    const net = (
      <span style={{ fontWeight: 700, color: netColor(line.netCents) }}>
        {provisional ? <span style={{ fontWeight: 400, fontSize: 11, color: "var(--color-neutral-600)" }}>预计 </span> : null}
        {netText(partner, line.netCents)}
      </span>
    )
    if (isMobile)
      return (
        <div className="wb-row" onClick={() => onOpenOrder(r.orderId)} style={{ display: "grid", gridTemplateColumns: "22px minmax(0,1fr)", gap: "4px 8px", padding: "10px 0", borderBottom: "1px solid var(--color-line)", fontSize: 13 }}>
          {check}
          <div>
            <span style={{ fontWeight: 700 }}>{when}</span> {who}
          </div>
          <span />
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", alignItems: "center" }}>
            <span onClick={(e) => e.stopPropagation()}>
              <PartnerSelect r={r} />
            </span>
            <span>总价 {money(line.totalCents)}</span>
            <span>
              我们拿 {money(line.cutCents)} {rateBtn}
            </span>
            <span style={{ color: "var(--color-neutral-600)" }}>刷卡已收 {money(line.collectedCents)}</span>
          </div>
          <span />
          {net}
        </div>
      )
    return (
      <div className="wb-row" onClick={() => onOpenOrder(r.orderId)} style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, padding: "9px 0", borderBottom: "1px solid var(--color-line)", alignItems: "center", fontSize: 13 }}>
        {check}
        <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{when}</span>
        <span>{who}</span>
        <span onClick={(e) => e.stopPropagation()}>
          <PartnerSelect r={r} />
        </span>
        <span className="r" title="订单总价（现金价，含路费）" style={{ whiteSpace: "nowrap" }}>
          {money(line.totalCents)}
        </span>
        <span className="r" style={{ whiteSpace: "nowrap" }}>
          {money(line.cutCents)} {rateBtn}
        </span>
        <span className="r" title="客人刷卡付给我们的钱（Zelle、现金都是合作方收）" style={{ whiteSpace: "nowrap", color: line.collectedCents ? undefined : "var(--color-neutral-600)" }}>
          {money(line.collectedCents)}
        </span>
        <span className="r">{net}</span>
      </div>
    )
  }

  const Head = () =>
    isMobile ? null : (
      <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, padding: "6px 0", fontSize: 11, color: "var(--color-neutral-600)", borderBottom: "2px solid var(--color-divider)" }}>
        <span />
        <span>日期</span>
        <span>客人</span>
        <span>合作公司</span>
        <span className="r">总价</span>
        <span className="r">我们拿</span>
        <span className="r">刷卡已收</span>
        <span className="r">净额</span>
      </div>
    )

  // 已结清：按「同一次结清」（同一家、同一时间）分组。
  const batches = (() => {
    const m = new Map<string, Row[]>()
    for (const r of settled) {
      const k = `${r.allocation!.settledAt}|${r.allocation!.partnerId}`
      m.set(k, [...(m.get(k) ?? []), r])
    }
    return Array.from(m.entries())
      .map(([k, list]) => ({ key: k, at: list[0].allocation!.settledAt, partnerId: list[0].allocation!.partnerId, method: list[0].allocation!.method, note: list[0].allocation!.note, list, net: list.reduce((a, r) => a + (r.allocation!.netCents ?? 0), 0) }))
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
  })()

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: isMobile ? 12 : 24, maxWidth: 1080 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>外包结算</h2>
        <span style={{ fontSize: 12, color: "var(--color-neutral-600)", minWidth: 0 }}>我们拿订单总价（含路费）的比例；客人刷卡的钱在我们这，Zelle、现金都是合作方收，两边一减就是谁付谁。</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(230px, 1fr))", gap: 10 }}>
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilter(filter === c.key ? "all" : c.key)}
            aria-pressed={filter === c.key}
            style={{ textAlign: "left", border: filter === c.key ? "2px solid var(--color-text)" : "1px solid var(--color-line)", background: "var(--color-bg)", padding: 12, cursor: "pointer", borderRadius: 8 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
              <strong style={{ fontSize: 15, color: c.key === NONE ? "var(--color-accent-700)" : undefined }}>{c.name}</strong>
              {c.rate !== null ? <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>我们拿 {ratePct(c.rate)}</span> : null}
            </div>
            <div style={{ fontSize: 13, marginTop: 6 }}>
              待结 {c.done} 单{c.done ? <> · <span style={{ fontWeight: 700, color: netColor(c.net) }}>{netText(c.key === NONE ? "合作方" : c.name, c.net)}</span></> : null}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-neutral-600)", marginTop: 2 }}>{c.later ? `还没办 ${c.later} 单` : "没有还没办的单"}</div>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Chip small active={filter === "all"} onClick={() => setFilter("all")}>全部</Chip>
        {cards.map((c) => (
          <Chip key={c.key} small active={filter === c.key} onClick={() => setFilter(c.key)}>
            {c.name}
          </Chip>
        ))}
      </div>

      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Kicker style={{ margin: 0 }}>待结算 · 已办完 {due.length} 单</Kicker>
          <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {pickedRows.length ? (
              <span style={{ fontSize: 13 }}>
                已勾 {pickedRows.length} 单 · <strong style={{ color: netColor(pickedNet) }}>{netText(nameOf.get(pickedPartner ?? "") ?? "合作方", pickedNet)}</strong>
              </span>
            ) : null}
            <button type="button" className="btn btn-secondary btn-sm" disabled={!pickedRows.length} onClick={() => void copyStatement(pickedPartner!, pickedRows)}>
              复制对账单
            </button>
            <button type="button" className="btn btn-primary btn-sm" disabled={!pickedRows.length || busy !== null} onClick={() => setSettleOpen(true)}>
              结清所选
            </button>
          </span>
        </div>
        <Head />
        {due.length === 0 ? <div style={{ padding: "14px 0", fontSize: 13, color: "var(--color-neutral-600)" }}>没有待结的单。</div> : due.map((r) => <OrderRowView key={r.orderId} r={r} pick />)}
      </section>

      {upcoming.length ? (
        <section>
          <Kicker style={{ margin: 0 }}>还没办 · {upcoming.length} 单（办完才能结；净额按现在收到的钱预计）</Kicker>
          <Head />
          {upcoming.map((r) => <OrderRowView key={r.orderId} r={r} provisional />)}
        </section>
      ) : null}

      <section>
        <Kicker style={{ margin: 0 }}>已结清</Kicker>
        {batches.length === 0 ? <div style={{ padding: "10px 0", fontSize: 13, color: "var(--color-neutral-600)" }}>还没有结过。</div> : null}
        {batches.map((b) => (
          <div key={b.key} style={{ borderTop: "2px solid var(--color-divider)", padding: "8px 0" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", fontSize: 13 }}>
              <strong>{nameOf.get(b.partnerId) ?? "?"}</strong>
              <span>{stamp(b.at)}</span>
              <span>· {b.list.length} 单 · {METHOD_LABEL[b.method ?? ""] ?? b.method ?? ""}</span>
              <strong style={{ color: netColor(b.net) }}>{netText(nameOf.get(b.partnerId) ?? "合作方", b.net)}</strong>
              {b.note ? <span style={{ color: "var(--color-neutral-600)" }}>· {b.note}</span> : null}
            </div>
            {b.list.map((r) => (
              <div key={r.orderId} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, padding: "3px 0 3px 12px", flexWrap: "wrap" }}>
                <button type="button" className="btn btn-ghost" style={{ padding: 0, minHeight: 0, fontSize: 12 }} onClick={() => onOpenOrder(r.orderId)}>
                  {r.date ? md(r.date) : ""} {r.customer}
                </button>
                <span style={{ color: "var(--color-neutral-600)" }}>
                  总价 {money(r.allocation!.totalCents)} · 我们拿 {money(r.allocation!.cutCents)} · 我们已收 {money(r.allocation!.collectedCents)} →
                </span>
                <span style={{ fontWeight: 700, color: netColor(r.allocation!.netCents ?? 0) }}>{netText(nameOf.get(b.partnerId) ?? "合作方", r.allocation!.netCents ?? 0)}</span>
                <button type="button" className="btn btn-ghost" disabled={busy !== null} onClick={() => void unsettle(r)} style={{ padding: 0, minHeight: 0, fontSize: 12, color: "var(--color-accent-700)" }}>
                  撤销
                </button>
              </div>
            ))}
          </div>
        ))}
      </section>

      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Kicker style={{ margin: 0 }}>合作公司</Kicker>
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy !== null} onClick={() => void addPartner()}>
            加一家
          </button>
        </div>
        {partners.map((p) => (
          <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--color-line)", fontSize: 13, opacity: p.active ? 1 : 0.55 }}>
            <strong style={{ minWidth: 140 }}>{p.name}</strong>
            <span>我们拿 {ratePct(p.default_rate_bps)}</span>
            {!p.active ? <Tag cls="tag-faint">已停用</Tag> : null}
            <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => void editPartner(p)}>
                改比例
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy !== null} onClick={() => void togglePartner(p)}>
                {p.active ? "停用" : "恢复"}
              </button>
            </span>
          </div>
        ))}
      </section>

      {settleOpen && pickedPartner ? (
        <SettleDialog
          partner={nameOf.get(pickedPartner) ?? "合作方"}
          rows={pickedRows}
          onClose={() => setSettleOpen(false)}
          onDone={async (items, method, note) => {
            const ok = await post("settle", { action: "settle", items, method, note })
            if (ok) {
              setPicked(new Set())
              setSettleOpen(false)
            }
          }}
        />
      ) : null}
    </div>
  )
}

/** 结清：每单的金额可以改（扣刷卡手续费、补差价之类），方向默认按算出来的。 */
function SettleDialog({
  partner,
  rows,
  onClose,
  onDone,
}: {
  partner: string
  rows: Row[]
  onClose: () => void
  onDone: (items: Array<{ order_id: string; amount_cents: number }>, method: string, note: string) => Promise<void>
}) {
  const [amt, setAmt] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.orderId, (Math.abs(r.live.netCents) / 100).toFixed(2)])))
  const [dir, setDir] = useState<Record<string, "us" | "them">>(() => Object.fromEntries(rows.map((r) => [r.orderId, r.live.netCents > 0 ? "us" : "them"])))
  const [method, setMethod] = useState("zelle")
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const signed = (id: string) => {
    const v = Math.round(Number(amt[id]) * 100)
    if (!Number.isFinite(v) || v < 0) return null
    return dir[id] === "us" ? v : -v
  }
  const vals = rows.map((r) => signed(r.orderId))
  const bad = vals.some((v) => v === null)
  const total = vals.reduce<number>((a, v) => a + (v ?? 0), 0)
  return (
    <Dialog onClose={onClose} width={620}>
      <DialogHead title={`结清 ${partner} · ${rows.length} 单`} lines={["金额默认是算出来的净额，实际过手的不一样就改。"]} onClose={onClose} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
        {rows.map((r) => (
          <div key={r.orderId} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid var(--color-line)", paddingBottom: 8 }}>
            <span style={{ flex: "1 1 200px" }}>
              <strong>{r.date ? md(r.date) : ""} {r.customer}</strong>
              <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
                总价 {money(r.live.totalCents)} · 我们拿 {money(r.live.cutCents)}（{ratePct(r.live.rateBps)}）· 我们已收 {money(r.live.collectedCents)}
              </div>
            </span>
            <select value={dir[r.orderId]} onChange={(e) => setDir((p) => ({ ...p, [r.orderId]: e.target.value as "us" | "them" }))} style={{ fontSize: 13 }}>
              <option value="them">{partner} 付我们</option>
              <option value="us">我们付 {partner}</option>
            </select>
            <input value={amt[r.orderId]} inputMode="decimal" onChange={(e) => setAmt((p) => ({ ...p, [r.orderId]: e.target.value }))} style={{ width: 90, fontSize: 13, textAlign: "right" }} aria-label="金额" />
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span>怎么付的</span>
          <select value={method} onChange={(e) => setMethod(e.target.value)} style={{ fontSize: 13 }}>
            {Object.entries(METHOD_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="备注（可不填）" style={{ flex: "1 1 160px", fontSize: 13 }} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: netColor(total) }}>合计：{bad ? "金额填得不对" : netText(partner, total)}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={bad || saving}
            onClick={async () => {
              setSaving(true)
              await onDone(rows.map((r, i) => ({ order_id: r.orderId, amount_cents: vals[i] ?? 0 })), method, note.trim())
              setSaving(false)
            }}
          >
            {saving ? "结清中…" : "结清"}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
