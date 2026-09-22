"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { adminJson } from "./api"
import { askConfirm, tell } from "./ask"
import { Cell, Chip, Dialog, DialogHead, Field, Kicker, PhoneIcon, Tag } from "./ui"
import { md, prettyPhone, ptToday, relativeTime, type LeadRow } from "./helpers"
import {
  CAMPAIGN_LABELS,
  CONSENT_LABELS,
  OCCASION_KEYS,
  OCCASION_LABELS,
  REMINDER_LEAD_DAYS,
  draftSms,
  normalizePhone10,
  reminderState,
  type Campaign,
  type CustomerEvent,
  type CustomerRow,
  type MarketingTouch,
  type ReminderState,
} from "@/lib/customers"

// 客户 · 老客户主档：谁在什么时候办过、周年提醒队列、发过什么。
// 2026-09-21 老板定：周年提醒提前两周、优惠 $50、每条短信发前都要确认。

type Data = { customers: CustomerRow[]; events: CustomerEvent[]; touches: MarketingTouch[] }
type Filter = "due" | "all" | "phone" | "nocontact" | "optout"
type Row = { c: CustomerRow; rs: ReminderState; lastEvent: CustomerEvent | null; lead: LeadRow | null; replied: boolean }
type Draft = { customer: CustomerRow; lastEvent: CustomerEvent | null; campaign: Campaign; body: string }

const FILTERS: Array<[Filter, string]> = [
  ["due", "到期提醒"],
  ["all", "全部"],
  ["phone", "有手机"],
  ["nocontact", "无联系方式"],
  ["optout", "不联系"],
]

export function CustomersTab({
  adminKey,
  leads,
  isMobile,
  viewerRole,
  onCall,
  onOpenLead,
}: {
  adminKey: string
  leads: LeadRow[]
  isMobile: boolean
  viewerRole: "owner" | "agent" | null
  onCall: (phone: string) => void
  onOpenLead: (id: string) => void
}) {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>("due")
  const [q, setQ] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const today = ptToday()
  const owner = viewerRole === "owner"

  const load = useCallback(
    async (sync = false) => {
      try {
        const d = await adminJson<Data & { ok: boolean; syncedOrders?: number }>(adminKey, `/api/admin/customers${sync ? "?sync=1" : ""}`)
        setData({ customers: d.customers ?? [], events: d.events ?? [], touches: d.touches ?? [] })
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : "读取失败")
      }
    },
    [adminKey],
  )
  useEffect(() => {
    void load(true)
  }, [load])

  const rows = useMemo<Row[]>(() => {
    if (!data) return []
    const leadByPhone = new Map<string, LeadRow>()
    for (const l of leads) {
      const ten = (l as { normalized_phone?: string | null }).normalized_phone ?? normalizePhone10(l.phone)
      if (ten && !leadByPhone.has(ten)) leadByPhone.set(ten, l)
    }
    return data.customers.map((c) => {
      const rs = reminderState(c, data.touches, today)
      const lastEvent = data.events.find((e) => e.customer_id === c.id) ?? null
      const lead = c.normalized_phone ? (leadByPhone.get(c.normalized_phone) ?? null) : null
      const replied = !!(lead && rs.lastTouch && String(lead.last_seen_at ?? lead.created_at) > rs.lastTouch.sent_at)
      return { c, rs, lastEvent, lead, replied }
    })
  }, [data, leads, today])

  const counts = useMemo(
    () => ({
      total: rows.length,
      due: rows.filter((r) => r.rs.status === "due" || r.rs.status === "overdue").length,
      sent: rows.filter((r) => r.rs.status === "sent").length,
      phone: rows.filter((r) => !!r.c.phone).length,
      nocontact: rows.filter((r) => !r.c.phone && !r.c.email).length,
    }),
    [rows],
  )

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase()
    return rows.filter((r) => {
      const c = r.c
      if (filter === "due" && !(r.rs.status === "due" || r.rs.status === "overdue")) return false
      if (filter === "phone" && !c.phone) return false
      if (filter === "nocontact" && (c.phone || c.email)) return false
      if (filter === "optout" && !(c.opted_out_at || c.do_not_contact || c.sms_consent === "no")) return false
      if (!term) return true
      return [c.full_name, c.phone, c.email, c.city, c.address, ...(c.tags ?? [])].some((v) => (v ?? "").toLowerCase().includes(term))
    })
  }, [rows, filter, q])

  const openDraft = (row: Row, campaign: Campaign = "anniversary") => setDraft({ customer: row.c, lastEvent: row.lastEvent, campaign, body: draftSms(campaign, row.c, row.lastEvent) })

  const importCsv = async (file: File) => {
    const text = await file.text()
    const parsed = parseCsv(text)
    if (parsed.length === 0) {
      await tell({ title: "导入", message: "文件里没有读到数据行。第一行要是表头：name, phone, email, address, zip, event_date, event_time, occasion。" })
      return
    }
    const ok = await askConfirm({ title: "导入客户", message: `读到 ${parsed.length} 行。已有的手机号会合并到原客户，只补空白，不覆盖。`, okLabel: "导入" })
    if (!ok) return
    setBusy("import")
    try {
      const r = await adminJson<{ ok: boolean; created: number; merged: number; events: number; skipped: number }>(adminKey, "/api/admin/customers", { body: { action: "import", source: "import", rows: parsed } })
      setMsg(`导入完成：新建 ${r.created}，合并 ${r.merged}，派对记录 ${r.events}，跳过 ${r.skipped}`)
      await load()
    } catch (e) {
      await tell({ title: "导入失败", message: e instanceof Error ? e.message : "失败" })
    } finally {
      setBusy(null)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const statusTag = (r: Row) => {
    if (r.replied) return <Tag cls="tag-ink">已回复</Tag>
    switch (r.rs.status) {
      case "due":
        return <Tag cls="tag-accent">本期到期</Tag>
      case "overdue":
        return <Tag cls="tag-outline">周年已过</Tag>
      case "sent":
        return <Tag cls="tag-ink">已发</Tag>
      case "upcoming":
        return <Tag cls="tag-faint">{md(r.rs.dueFrom)} 起</Tag>
      case "future":
        return <Tag cls="tag-faint">派对还没办</Tag>
      default:
        return <Tag cls="tag-faint">{!r.c.phone ? "无手机" : "不发短信"}</Tag>
    }
  }

  const open = openId ? rows.find((r) => r.c.id === openId) ?? null : null

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 24, letterSpacing: "-0.01em" }}>客户</div>
        <span style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>周年提醒提前 {REMINDER_LEAD_DAYS} 天 · 每条都先确认再发</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => void load(true)}>
            同步订单
          </button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => fileRef.current?.click()}>
            {busy === "import" ? "导入中…" : "导入 CSV"}
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && void importCsv(e.target.files[0])} />
        </div>
      </div>

      {error ? <div className="notice">{error}</div> : null}
      {msg ? (
        <div className="notice" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ flex: 1 }}>{msg}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMsg(null)}>
            关闭
          </button>
        </div>
      ) : null}

      <div className="wb-grid" style={{ gridTemplateColumns: isMobile ? "repeat(2, minmax(0,1fr))" : "repeat(4, minmax(0,1fr))" }}>
        <Cell label="客户" value={counts.total} onClick={() => setFilter("all")} />
        <Cell label="到期提醒" value={counts.due} color={counts.due > 0 ? "var(--color-accent)" : undefined} sub="周年前两周内、还没发" onClick={() => setFilter("due")} />
        <Cell label="本期已发" value={counts.sent} />
        <Cell label="无联系方式" value={counts.nocontact} sub="只有地址，发不了" onClick={() => setFilter("nocontact")} />
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {FILTERS.map(([k, label]) => (
          <Chip key={k} small active={filter === k} onClick={() => setFilter(k)}>
            {label}
            {k === "due" && counts.due ? ` ${counts.due}` : ""}
          </Chip>
        ))}
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜姓名 / 电话 / 城市" style={{ marginLeft: "auto", width: isMobile ? "100%" : 220, height: 34 }} />
      </div>

      {!data ? <div className="empty">读取中…</div> : null}
      {data && rows.length === 0 ? <div className="empty">还没有客户。点右上角"导入 CSV"，或者等订单付押金后自动进来。</div> : null}
      {data && rows.length > 0 && shown.length === 0 ? <div className="empty">{filter === "due" ? "这两周没有到期的周年提醒。" : "没有匹配的客户。"}</div> : null}

      {shown.length > 0 && !isMobile ? (
        <table className="table">
          <thead>
            <tr style={{ whiteSpace: "nowrap" }}>
              <th>客户</th>
              <th>城市</th>
              <th>最近派对</th>
              <th className="r">场次</th>
              <th>周年 · 提醒</th>
              <th>短信许可</th>
              <th>最近触达</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.c.id} className="wb-row" onClick={() => setOpenId(r.c.id)} style={{ opacity: r.c.do_not_contact ? 0.55 : 1 }}>
                <td style={{ whiteSpace: "nowrap" }}>
                  <div style={{ fontWeight: 600 }}>{r.c.full_name || "未留名"}</div>
                  <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>{r.c.phone ? prettyPhone(r.c.phone) : r.c.email || "—"}</div>
                </td>
                <td>{r.c.city ?? "—"}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {r.c.last_event_date ? md(r.c.last_event_date) : "—"}
                  {r.lastEvent?.occasion ? <span style={{ color: "var(--color-neutral-600)" }}> · {OCCASION_LABELS[r.lastEvent.occasion] ?? r.lastEvent.occasion}</span> : null}
                </td>
                <td className="r">{r.c.events_count}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {r.rs.anniversary ? <span style={{ marginRight: 8 }}>{md(r.rs.anniversary)}</span> : null}
                  {statusTag(r)}
                </td>
                <td>{r.c.do_not_contact ? "不联系" : CONSENT_LABELS[r.c.sms_consent]}</td>
                <td style={{ fontSize: 12, color: "var(--color-neutral-600)", whiteSpace: "nowrap" }}>
                  {r.rs.lastTouch ? `${CAMPAIGN_LABELS[r.rs.lastTouch.campaign as Campaign] ?? r.rs.lastTouch.campaign} · ${relativeTime(r.rs.lastTouch.sent_at)}` : "—"}
                </td>
                <td style={{ whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                  {r.c.phone && !r.c.do_not_contact && !r.c.opted_out_at ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => openDraft(r, r.rs.status === "overdue" ? "winback" : "anniversary")}>
                      起草短信
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {shown.length > 0 && isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {shown.map((r) => (
            <article key={r.c.id} className="card wb-row" onClick={() => setOpenId(r.c.id)} style={{ gap: 6, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <strong style={{ flex: 1 }}>{r.c.full_name || "未留名"}</strong>
                {statusTag(r)}
              </div>
              <div style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>
                {r.c.phone ? prettyPhone(r.c.phone) : r.c.email || "无联系方式"} · {r.c.city ?? "城市未知"}
              </div>
              <div style={{ fontSize: 13 }}>
                最近 {r.c.last_event_date ? md(r.c.last_event_date) : "—"}
                {r.lastEvent?.occasion ? ` · ${OCCASION_LABELS[r.lastEvent.occasion] ?? r.lastEvent.occasion}` : ""} · {r.c.events_count} 场
                {r.rs.anniversary ? ` · 周年 ${md(r.rs.anniversary)}` : ""}
              </div>
              {r.c.phone && !r.c.do_not_contact && !r.c.opted_out_at ? (
                <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: "flex-start" }} onClick={(e) => { e.stopPropagation(); openDraft(r, r.rs.status === "overdue" ? "winback" : "anniversary") }}>
                  起草短信
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {open ? (
        <CustomerDialog
          adminKey={adminKey}
          row={open}
          events={data?.events.filter((e) => e.customer_id === open.c.id) ?? []}
          touches={data?.touches.filter((t) => t.customer_id === open.c.id) ?? []}
          owner={owner}
          onClose={() => setOpenId(null)}
          onChanged={() => load()}
          onDraft={(campaign) => openDraft(open, campaign)}
          onCall={onCall}
          onOpenLead={onOpenLead}
        />
      ) : null}

      {draft ? (
        <DraftDialog
          adminKey={adminKey}
          draft={draft}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          onSent={async () => {
            setDraft(null)
            setMsg("已发送，回复会进线索。")
            await load()
          }}
        />
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------- draft + send

function DraftDialog({ adminKey, draft, onChange, onClose, onSent }: { adminKey: string; draft: Draft; onChange: (d: Draft) => void; onClose: () => void; onSent: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const c = draft.customer
  const switchCampaign = (campaign: Campaign) => onChange({ ...draft, campaign, body: campaign === "custom" ? draft.body : draftSms(campaign, c, draft.lastEvent) })
  const send = async () => {
    const body = draft.body.trim()
    if (!body || !c.phone) return
    const ok = await askConfirm({ title: "发送短信", message: `发到 ${prettyPhone(c.phone)}？\n\n${body}`, okLabel: "发送" })
    if (!ok) return
    setBusy(true)
    try {
      await adminJson(adminKey, "/api/admin/customers", { body: { action: "send", id: c.id, campaign: draft.campaign, body, event_id: draft.lastEvent?.id } })
      await onSent()
    } catch (e) {
      await tell({ title: "没发出去", message: e instanceof Error ? e.message : "失败" })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog onClose={onClose} width={560}>
      <DialogHead title={`发短信 · ${c.full_name || "未留名"}`} lines={[c.phone ? prettyPhone(c.phone) : "没有手机号", `${CAMPAIGN_LABELS[draft.campaign]} · 发前会再确认一次`]} onClose={onClose} />
      <div className="dialog-col" style={{ gap: 12 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(Object.keys(CAMPAIGN_LABELS) as Campaign[]).map((k) => (
            <Chip key={k} small active={draft.campaign === k} onClick={() => switchCampaign(k)}>
              {CAMPAIGN_LABELS[k]}
            </Chip>
          ))}
        </div>
        <textarea className="input" rows={7} value={draft.body} onChange={(e) => onChange({ ...draft, body: e.target.value })} style={{ fontSize: 14, lineHeight: 1.55 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "var(--color-neutral-600)", flex: 1 }}>{draft.body.length} 字符{draft.body.length > 320 ? " · 会拆成多条" : ""}</span>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn-primary" disabled={busy || !draft.body.trim() || !c.phone} onClick={() => void send()}>
            {busy ? "发送中…" : "发送"}
          </button>
        </div>
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------- one customer

function CustomerDialog({
  adminKey,
  row,
  events,
  touches,
  owner,
  onClose,
  onChanged,
  onDraft,
  onCall,
  onOpenLead,
}: {
  adminKey: string
  row: Row
  events: CustomerEvent[]
  touches: MarketingTouch[]
  owner: boolean
  onClose: () => void
  onChanged: () => Promise<void> | void
  onDraft: (campaign: Campaign) => void
  onCall: (phone: string) => void
  onOpenLead: (id: string) => void
}) {
  const c = row.c
  const [form, setForm] = useState({ full_name: c.full_name ?? "", phone: c.phone ?? "", email: c.email ?? "", address: c.address ?? "", city: c.city ?? "", zip: c.zip ?? "", notes: c.notes ?? "", sms_consent: c.sms_consent, do_not_contact: c.do_not_contact })
  const [ev, setEv] = useState({ event_date: "", event_time: "", occasion: "", guest_count: "", address: c.address ?? "" })
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const post = async (label: string, body: Record<string, unknown>, ok?: string) => {
    setBusy(label)
    setMsg(null)
    try {
      await adminJson(adminKey, "/api/admin/customers", { body })
      await onChanged()
      if (ok) setMsg(ok)
      return true
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "失败")
      return false
    } finally {
      setBusy(null)
    }
  }
  const save = () => post("save", { action: "update", id: c.id, fields: form }, "已保存")
  const addEvent = async () => {
    if (!ev.event_date) {
      setMsg("先填派对日期")
      return
    }
    const ok = await post("event", { action: "add_event", id: c.id, ...ev, guest_count: ev.guest_count || null }, "已加一场")
    if (ok) setEv({ ...ev, event_date: "", event_time: "", occasion: "", guest_count: "" })
  }
  const removeEvent = async (e: CustomerEvent) => {
    if (!(await askConfirm({ title: "删掉这场记录", message: `${md(e.event_date)}${e.occasion ? ` · ${OCCASION_LABELS[e.occasion] ?? e.occasion}` : ""} 会从这位客户的记录里删除。`, okLabel: "删除", danger: true }))) return
    await post(`del:${e.id}`, { action: "delete_event", event_id: e.id })
  }
  const remove = async () => {
    if (!(await askConfirm({ title: "删除客户", message: `删掉「${c.full_name || "未留名"}」和 TA 的 ${events.length} 场记录、${touches.length} 条触达？不可恢复。`, okLabel: "删除", danger: true }))) return
    if (await post("delete", { action: "delete", id: c.id })) onClose()
  }
  const canText = !!c.phone && !c.do_not_contact && !c.opted_out_at && c.sms_consent !== "no"

  return (
    <Dialog onClose={onClose} width={720}>
      <DialogHead
        title={c.full_name || "未留名"}
        tags={
          <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
            {c.city ?? "城市未知"} · {c.events_count} 场 · 来源 {c.source === "order" ? "订单" : c.source.startsWith("import") ? "导入" : c.source}
          </span>
        }
        lines={[<>{c.phone ? prettyPhone(c.phone) : "没有手机"}{c.email ? ` · ${c.email}` : ""}{row.lead ? <> · <button type="button" className="btn btn-ghost btn-sm" style={{ padding: 0, height: "auto" }} onClick={() => onOpenLead(row.lead!.id)}>打开线索 →</button></> : null}</>]}
        actions={
          <div style={{ display: "flex", gap: 8 }}>
            {c.phone ? (
              <button type="button" className="btn btn-secondary" onClick={() => onCall(c.phone!)}>
                {PhoneIcon} 打电话
              </button>
            ) : null}
            {canText ? (
              <button type="button" className="btn btn-primary" onClick={() => onDraft(row.rs.status === "overdue" ? "winback" : "anniversary")}>
                发短信
              </button>
            ) : null}
          </div>
        }
        onClose={onClose}
      />
      <div className="dialog-col" style={{ gap: 18 }}>
        {msg ? <div className="notice">{msg}</div> : null}

        <div>
          <Kicker>周年提醒</Kicker>
          <div style={{ fontSize: 14, marginTop: 6 }}>
            {row.rs.anniversary ? (
              <>
                下次周年 {md(row.rs.anniversary)}，{row.rs.status === "due" ? "现在就该发" : row.rs.status === "overdue" ? "已经过了，可发唤醒" : row.rs.status === "sent" ? `本期已发（${row.rs.lastTouch ? relativeTime(row.rs.lastTouch.sent_at) : ""}）` : row.rs.status === "upcoming" ? `${md(row.rs.dueFrom)} 起提醒` : "没法发短信"}
                {row.replied ? " · 对方已回复" : ""}
              </>
            ) : (
              "还没有派对记录，加一场之后才会有周年提醒。"
            )}
          </div>
        </div>

        <div>
          <Kicker>资料</Kicker>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
            <Field label="名字">
              <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </Field>
            <Field label="手机">
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(562) 713-4832" />
            </Field>
            <Field label="邮箱">
              <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="邮编">
              <input className="input" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
            </Field>
            <Field label="地址" style={{ gridColumn: "1 / -1" }}>
              <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value, city: "" })} />
            </Field>
            <Field label="城市（留空自动从地址取）">
              <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </Field>
            <Field label="短信许可">
              <select className="input" value={form.sms_consent} onChange={(e) => setForm({ ...form, sms_consent: e.target.value as CustomerRow["sms_consent"] })}>
                {(Object.keys(CONSENT_LABELS) as Array<CustomerRow["sms_consent"]>).map((k) => (
                  <option key={k} value={k}>
                    {CONSENT_LABELS[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="备注" style={{ gridColumn: "1 / -1" }}>
              <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 8 }}>
            <input type="checkbox" checked={form.do_not_contact} onChange={(e) => setForm({ ...form, do_not_contact: e.target.checked })} />
            不再联系（不进任何提醒队列）
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <button type="button" className="btn btn-secondary" disabled={!!busy} onClick={() => void save()}>
              {busy === "save" ? "保存中…" : "保存修改"}
            </button>
            {owner ? (
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: "auto", color: "var(--color-accent-700)" }} disabled={!!busy} onClick={() => void remove()}>
                删除客户
              </button>
            ) : null}
          </div>
        </div>

        <div>
          <Kicker>派对记录</Kicker>
          {events.length === 0 ? <div style={{ fontSize: 13, color: "var(--color-neutral-600)", marginTop: 6 }}>还没有记录。</div> : null}
          {events.map((e) => (
            <div key={e.id} style={{ display: "grid", gridTemplateColumns: "96px 1fr auto auto", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--color-line)", alignItems: "center", fontSize: 13 }}>
              <div style={{ whiteSpace: "nowrap", fontWeight: 600 }}>
                {md(e.event_date)}
                {e.event_time ? <span style={{ fontWeight: 400, color: "var(--color-neutral-600)" }}> {e.event_time}</span> : null}
              </div>
              <div className="clamp1">
                {e.occasion ? <span>{OCCASION_LABELS[e.occasion] ?? e.occasion} · </span> : null}
                {e.address ?? ""}
                {e.guest_count ? ` · ${e.guest_count} 人` : ""}
              </div>
              <span style={{ color: "var(--color-neutral-600)", whiteSpace: "nowrap" }}>{e.order_id ? "订单" : e.source === "manual" ? "手填" : "导入"}</span>
              {!e.order_id ? (
                <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => void removeEvent(e)}>
                  删
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginTop: 10 }}>
            <Field label="日期">
              <input className="input" type="date" value={ev.event_date} onChange={(e) => setEv({ ...ev, event_date: e.target.value })} />
            </Field>
            <Field label="时间">
              <input className="input" value={ev.event_time} placeholder="18:00" onChange={(e) => setEv({ ...ev, event_time: e.target.value })} />
            </Field>
            <Field label="场合">
              <select className="input" value={ev.occasion} onChange={(e) => setEv({ ...ev, occasion: e.target.value })}>
                <option value="">—</option>
                {OCCASION_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {OCCASION_LABELS[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="人数">
              <input className="input" type="number" min={0} value={ev.guest_count} onChange={(e) => setEv({ ...ev, guest_count: e.target.value })} />
            </Field>
            <Field label="地址（默认用客户地址）" style={{ gridColumn: "1 / 4" }}>
              <input className="input" value={ev.address} onChange={(e) => setEv({ ...ev, address: e.target.value })} />
            </Field>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button type="button" className="btn btn-secondary" style={{ width: "100%" }} disabled={!!busy} onClick={() => void addEvent()}>
                加一场
              </button>
            </div>
          </div>
        </div>

        <div>
          <Kicker>触达记录</Kicker>
          {touches.length === 0 ? <div style={{ fontSize: 13, color: "var(--color-neutral-600)", marginTop: 6 }}>还没发过。</div> : null}
          {touches.map((t) => (
            <div key={t.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--color-line)", fontSize: 13 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <strong>{CAMPAIGN_LABELS[t.campaign as Campaign] ?? t.campaign}</strong>
                <span style={{ color: "var(--color-neutral-600)" }}>{t.channel === "sms" ? "短信" : t.channel === "email" ? "邮件" : t.channel === "call" ? "电话" : "备注"} · {relativeTime(t.sent_at)}{t.sent_by ? ` · ${t.sent_by}` : ""}</span>
              </div>
              {t.body ? <div style={{ color: "var(--color-neutral-700)", whiteSpace: "pre-wrap", marginTop: 3 }}>{t.body}</div> : null}
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------- csv

const HEADER_ALIASES: Record<string, string> = {
  name: "name", full_name: "name", 姓名: "name", 名字: "name",
  phone: "phone", 手机: "phone", 电话: "phone", tel: "phone",
  email: "email", 邮箱: "email",
  address: "address", 地址: "address",
  zip: "zip", 邮编: "zip",
  event_date: "event_date", date: "event_date", 日期: "event_date",
  event_time: "event_time", time: "event_time", 时间: "event_time",
  occasion: "occasion", 场合: "occasion",
  notes: "notes", 备注: "notes", guest_count: "guest_count", guests: "guest_count", 人数: "guest_count",
}

function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = []
  let cell = ""
  let row: string[] = []
  let quoted = false
  const src = text.replace(/^﻿/, "")
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ",") {
      row.push(cell)
      cell = ""
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else cell += ch
  }
  if (cell.length || row.length) {
    row.push(cell)
    rows.push(row)
  }
  const header = (rows.shift() ?? []).map((h) => HEADER_ALIASES[h.trim().toLowerCase()] ?? HEADER_ALIASES[h.trim()] ?? "")
  return rows
    .filter((r) => r.some((v) => v.trim()))
    .map((r) => {
      const out: Record<string, string> = {}
      header.forEach((key, i) => {
        if (key) out[key] = (r[i] ?? "").trim()
      })
      return out
    })
    .filter((r) => Object.values(r).some(Boolean))
}
