"use client"

import { Kicker } from "./ui"
import { dowZh, md, money, stamp } from "./helpers"
import type { ChefFile, LogisticsLedger, LogisticsRow, Settlement } from "./chef-types"

// 后勤的结算页：没有代收、小费、桌椅路费。她是兼职、不是每单都做，所以先在
// 下面的单子里勾出她做了哪几单；勾上的单 × 人头单价，加上已批准的报销。
// 每周日结一次；一单只结一次。

const COLS = "22px 92px minmax(0,1fr) 110px 60px 68px"
const headsText = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

function Rows({ rows, checked, canEdit, busy, onToggle, onOpenOrder, faded }: { rows: LogisticsRow[]; checked: boolean; canEdit: boolean; busy: boolean; onToggle: (orderId: string, on: boolean) => void; onOpenOrder: (id: string) => void; faded?: boolean }) {
  return (
    <>
      {rows.map((r) => (
        <div key={r.orderId} className="wb-row" onClick={() => onOpenOrder(r.orderId)} style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, padding: "8px 0", borderBottom: "1px solid var(--color-line)", alignItems: "center", fontSize: 13, opacity: faded ? 0.65 : 1 }}>
          <input type="checkbox" checked={checked} disabled={!canEdit || busy} aria-label={checked ? "不是她做的" : "她做的"} onClick={(e) => e.stopPropagation()} onChange={(e) => onToggle(r.orderId, e.target.checked)} style={{ width: 16, height: 16 }} />
          <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
            {md(r.date)} {dowZh(r.date)}
          </span>
          <span className="clamp1">
            <strong>{r.customer ?? "客户"}</strong> <span className="mono" style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>{r.orderNo}</span>
          </span>
          <span style={{ fontSize: 12, color: "var(--color-neutral-700)", whiteSpace: "nowrap" }}>
            {r.adults} 大人{r.kids ? ` + ${r.kids} 小孩` : ""}
            {r.littles ? <span style={{ color: "var(--color-neutral-600)" }}> · {r.littles} 免费</span> : null}
          </span>
          <span className="r" style={{ whiteSpace: "nowrap" }}>{headsText(r.heads)} 人</span>
          <span className="r" style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{money(r.cents)}</span>
        </div>
      ))}
    </>
  )
}

export function LogisticsSettle({
  ledger,
  settlements,
  approvedReimb,
  lastSettledAt,
  owner,
  busy,
  onToggle,
  onSettle,
  onUnsettle,
  onOpenOrder,
}: {
  ledger: LogisticsLedger
  settlements: Settlement[]
  approvedReimb: ChefFile[]
  lastSettledAt: string | null
  owner: boolean
  busy: boolean
  onToggle: (orderId: string, on: boolean) => void
  onSettle: () => void
  onUnsettle: (settlementId: string) => void
  onOpenOrder: (id: string) => void
}) {
  const pay = ledger.open.reduce((a, r) => a + r.cents, 0)
  const heads = ledger.open.reduce((a, r) => a + r.heads, 0)
  const reimb = approvedReimb.reduce((a, f) => a + (f.amount_cents ?? 0), 0)
  const net = pay + reimb
  const upCents = ledger.upcoming.reduce((a, r) => a + r.cents, 0)
  const rowProps = { canEdit: owner, busy, onToggle, onOpenOrder }
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <Kicker style={{ margin: 0 }}>本期结算 · 每周日结（周一–周日）</Kicker>
        <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
          每人头 {money(ledger.perHeadCents)} · 大人 1、小孩 0.5 · 只算勾上的单 · 上次结清 {lastSettledAt ? md(lastSettledAt) : "—"}
        </span>
      </div>
      <div style={{ borderTop: "2px solid var(--color-divider)" }}>
        {ledger.open.length === 0 ? <div style={{ padding: "16px 0", fontSize: 13, color: "var(--color-neutral-600)" }}>没有待结的单。她做了哪几单，在下面勾上。</div> : null}
        <Rows rows={ledger.open} checked {...rowProps} />
        {ledger.open.length ? (
          <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, padding: "8px 0", fontSize: 13, fontWeight: 700 }}>
            <span />
            <span>小计</span>
            <span>{ledger.open.length} 单</span>
            <span />
            <span className="r">{headsText(heads)} 人</span>
            <span className="r">{money(pay)}</span>
          </div>
        ) : null}
      </div>
      {approvedReimb.length ? (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <span>已批准的报销 · {approvedReimb.length} 张</span>
          <strong>{money(reimb)}</strong>
        </div>
      ) : null}
      {owner ? (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-primary" disabled={busy || (ledger.open.length === 0 && approvedReimb.length === 0)} onClick={onSettle}>
            {busy ? "处理中…" : net > 0 ? `付 ${money(net)} 并结清` : "没有要结的"}
          </button>
        </div>
      ) : null}
      {ledger.upcoming.length ? (
        <div>
          <Kicker>她做的 · 还没办 · {ledger.upcoming.length} 单 · 约 {money(upCents)}</Kicker>
          <div style={{ fontSize: 12, color: "var(--color-neutral-600)", marginBottom: 4 }}>派对办了才进结算；人数以办的那天发票为准。</div>
          <Rows rows={ledger.upcoming} checked faded {...rowProps} />
        </div>
      ) : null}
      <div>
        <Kicker>没勾的单 · 她做了就勾上</Kicker>
        {ledger.candidates.length === 0 ? <div style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>最近两周到下周日没有别的单了。</div> : null}
        <Rows rows={ledger.candidates} checked={false} faded {...rowProps} />
      </div>
      {settlements.length ? (
        <details>
          <summary>结算记录（{settlements.length}）</summary>
          <div style={{ fontSize: 12.5, marginTop: 6 }}>
            {settlements.map((s) => {
              const voided = (s.note ?? "").startsWith("已撤销")
              return (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--color-line)", opacity: voided ? 0.5 : 1 }}>
                  <span>
                    {stamp(s.created_at)} · {s.shifts} 单{s.period_start ? ` · ${md(s.period_start)}–${s.period_end ? md(s.period_end) : ""}` : ""} · {voided ? "已撤销" : s.method ?? "—"}
                  </span>
                  <span style={{ whiteSpace: "nowrap" }}>
                    {money(s.net_cents)}
                    {owner && !voided ? (
                      <button type="button" className="btn btn-ghost btn-sm" style={{ padding: "0 4px", fontSize: 11 }} disabled={busy} onClick={() => onUnsettle(s.id)}>
                        撤销
                      </button>
                    ) : null}
                  </span>
                </div>
              )
            })}
          </div>
        </details>
      ) : null}
    </>
  )
}
