"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { adminJson, AdminApiError } from "./api"
import { Chip, Dialog, DialogHead, Field, Kicker, Lines, PhoneIcon, Tag } from "./ui"
import { askConfirm } from "./ask"
import {
  copyText,
  digits10,
  displayName,
  dowZh,
  eventParts,
  firstName,
  inDaysLabel,
  invoiceTravelFee,
  leadForOrder,
  md,
  money,
  operatorName,
  ORDER_EVENT_LABELS,
  prettyPhone,
  stageOf,
  STAGE_TAG_CLASS,
  stamp,
  type LeadRow,
  type OrderDetail,
  type OrderRow,
  type UpdateRequest,
} from "./helpers"
import type { ChefSummary, OrderAssignment } from "./chef-types"
import { PlannerPill, stepLabel, type PlannerSession } from "./planner-live"
import { SmsThreadPanel } from "@/components/admin/sms-thread-panel"
import { InvoiceArchivePanel } from "@/components/admin/invoice-archive-panel"
import { OrderPhotosPanel } from "@/components/admin/order-photos-panel"
import { ORDER_SOP_STEPS } from "@/lib/order-sop"
import type { WorkbenchSettings } from "@/lib/workbench-settings-shared"

// 订单弹窗 · 售后：金额·收款 / Planner·派单 / 短信 / 记录.
// Orders are owned by the invoice app; this dialog reads them and acts
// through the admin routes (pay link, final payment, SOP, travel fee,
// update-request confirm/complete, chef assignment) and the SMS line.

const OPEN_REQUEST = new Set(["received", "confirmed_in_progress"])
type OTab = "money" | "planner" | "sms" | "records"
const OTABS: Array<[OTab, string]> = [
  ["money", "金额 · 收款"],
  ["planner", "Planner · 派单"],
  ["sms", "短信"],
  ["records", "记录"],
]

function plannerState(o: OrderRow, events: OrderDetail["events"] | null): { text: string; accent: boolean; at: string } {
  const saves = (events ?? []).filter((e) => e.action === "invoice_saved" || e.action === "invoice_update_submitted")
  const last = saves[0]
  const at = last ? stamp(last.created_at) : ""
  if (o.details_status !== "complete") return { text: "Planner 未填 · 客人还没选", accent: true, at }
  if (last) return { text: `细节已填 · 最后改动 ${at}`, accent: false, at }
  return { text: "细节已填", accent: false, at }
}

function renderChanges(summary: unknown): Array<{ field: string; from: string; to: string }> {
  if (Array.isArray(summary)) {
    return summary
      .map((c) => {
        if (c && typeof c === "object") {
          const r = c as Record<string, unknown>
          return { field: String(r.field ?? r.label ?? r.key ?? "—"), from: String(r.from ?? r.before ?? r.old ?? "—"), to: String(r.to ?? r.after ?? r.new ?? "—") }
        }
        return { field: String(c), from: "", to: "" }
      })
      .slice(0, 20)
  }
  if (summary && typeof summary === "object") {
    return Object.entries(summary as Record<string, unknown>)
      .map(([k, v]) => {
        if (v && typeof v === "object" && !Array.isArray(v)) {
          const r = v as Record<string, unknown>
          return { field: k, from: String(r.from ?? r.before ?? "—"), to: String(r.to ?? r.after ?? JSON.stringify(v)) }
        }
        return { field: k, from: "", to: typeof v === "string" ? v : JSON.stringify(v) }
      })
      .slice(0, 20)
  }
  return summary ? [{ field: "改动", from: "", to: String(summary) }] : []
}

function customerEventTime(iso: string | null): string {
  const p = eventParts(iso)
  if (!p) return ""
  const d = new Date(p.ms)
  const day = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })
  const h12 = p.hour % 12 || 12
  return `${day} at ${h12}:${String(p.minute).padStart(2, "0")}${p.hour >= 12 ? "pm" : "am"}`
}

type EmailTemplate = "details" | "balance" | "thanks"
const EMAIL_TEMPLATES: Array<{ id: EmailTemplate; label: string }> = [
  { id: "details", label: "收细节" },
  { id: "balance", label: "确认 + 尾款" },
  { id: "thanks", label: "活动后致谢" },
]

function buildEmail(o: OrderRow, t: EmailTemplate, s: WorkbenchSettings): { subject: string; body: string } {
  const first = firstName(o.customer_name)
  const hi = `Hi${first ? " " + first : ""},`
  const when = customerEventTime(o.event_start)
  const guests = (o.guest_adult_count ?? 0) + (o.guest_child_count ?? 0)
  const where = o.event_address ? ` at ${o.event_address}` : ""
  const line = when ? `Your hibachi party is set for ${when}${where}${guests ? ` for ${guests} guests` : ""}.` : `Your hibachi party is confirmed${where}.`
  const bal = o.balance_due_cents ?? 0
  const sign = `\n\n${s.business.agent_name}\n${s.business.brand} · www.realhibachi.com\n${s.business.support_email} · ${s.business.support_phone}`
  if (t === "details")
    return {
      subject: `Your hibachi party - a few details to lock in (${o.order_no ?? ""})`,
      body: `${hi}\n\n${line}\n\nTo get everything ready, could you send me:\n- the exact address (and gate code / parking notes if any)\n- final headcount, adults and kids\n- each guest's two proteins (chicken, steak, shrimp, salmon, scallops, tofu...) - or use the party planner link and let everyone pick their own\n- any allergies\n\nReply here or text ${s.business.support_phone} anytime.${sign}`,
    }
  if (t === "balance")
    return {
      subject: `You're confirmed - ${md(eventParts(o.event_start)?.ymd ?? "")} hibachi party (${o.order_no ?? ""})`,
      body: `${hi}\n\n${line}\n\n${bal > 0 ? `Your remaining balance is ${money(bal)}, due on the day of the party - cash, Zelle, Venmo or card all work (card adds 4%).` : "Your balance is settled - nothing more to pay."}\n\nYour chef will be confirmed by name before the party and arrives about 10 minutes before start time with the grill and fresh ingredients. See you soon!${sign}`,
    }
  return {
    subject: `Thank you from ${s.business.brand}!`,
    body: `${hi}\n\nThank you for having us at your party - we hope everyone loved the show! If you have 30 seconds, a Google review would mean the world to our small team: ${s.business.review_url || "https://www.realhibachi.com"}\n\nAnd if you caught any photos or videos, we'd love to see them - just reply here.${sign}`,
  }
}

export function OrderDialog({
  adminKey,
  orderId,
  orders,
  leads,
  chefs,
  assignments,
  live,
  clarityProject,
  settings,
  viewerRole,
  onClose,
  onChanged,
  onOpenLead,
  onOpenChef,
  onCall,
}: {
  adminKey: string
  orderId: string
  orders: OrderRow[]
  leads: LeadRow[]
  chefs: ChefSummary[]
  assignments: OrderAssignment[]
  /** This order's planner session, if anyone touched it lately. */
  live?: PlannerSession
  clarityProject: string
  settings: WorkbenchSettings
  viewerRole: "owner" | "agent" | null
  onClose: () => void
  onChanged: () => Promise<void> | void
  onOpenLead: (leadId: string) => void
  onOpenChef: (id: string) => void
  onCall: (phone: string) => void
}) {
  const [detail, setDetail] = useState<OrderDetail | null>(null)
  const [tab, setTab] = useState<OTab | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [insert, setInsert] = useState<{ text: string; nonce: number } | null>(null)
  const [payAmount, setPayAmount] = useState("")
  const [payPhone, setPayPhone] = useState("")
  const [payFinal, setPayFinal] = useState(false)
  const [payUrl, setPayUrl] = useState<string | null>(null)
  const [finalAmount, setFinalAmount] = useState("")
  const [finalChannel, setFinalChannel] = useState<"cash" | "venmo" | "zelle" | "stripe" | "other">("zelle")
  const [finalRef, setFinalRef] = useState("")
  const [emailTpl, setEmailTpl] = useState<EmailTemplate | null>(null)
  const [emailDraft, setEmailDraft] = useState({ subject: "", body: "" })
  const [team, setTeam] = useState<string[] | null>(null)

  const load = useCallback(async () => {
    try {
      const d = await adminJson<OrderDetail & { ok: boolean }>(adminKey, `/api/admin/orders?id=${encodeURIComponent(orderId)}`)
      setDetail({ order: d.order, payments: d.payments ?? [], events: d.events ?? [], updateRequests: d.updateRequests ?? [] })
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "读取失败")
    }
  }, [adminKey, orderId])

  useEffect(() => {
    void load()
  }, [load])

  const o = detail?.order ?? orders.find((x) => x.id === orderId) ?? null
  const openReqs = (detail?.updateRequests ?? []).filter((r) => OPEN_REQUEST.has(r.status))
  useEffect(() => {
    if (!o) return
    setPayAmount(o.balance_due_cents && o.balance_due_cents > 0 ? (o.balance_due_cents / 100).toFixed(2) : "")
    setPayPhone(o.customer_phone ?? "")
    setFinalAmount(o.balance_due_cents && o.balance_due_cents > 0 ? (o.balance_due_cents / 100).toFixed(2) : "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o?.id, o?.balance_due_cents])
  // Land on 派单/Planner when the customer changed something (comp: orderTab = changed ? 'planner' : 'money').
  useEffect(() => {
    if (detail && tab === null) setTab(openReqs.length > 0 ? "planner" : "money")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail])
  useEffect(() => {
    setTeam(assignments.map((a) => a.staffId))
  }, [assignments])

  const lead = useMemo(() => (o ? leadForOrder(o, leads) : null), [o, leads])
  const now = Date.now()

  if (!o) {
    return (
      <Dialog onClose={onClose} width={920}>
        <DialogHead title="订单" onClose={onClose} />
        <div className="dialog-col">{msg ? <div className="notice danger">{msg}</div> : <div className="empty">读取中…</div>}</div>
      </Dialog>
    )
  }

  const ev = eventParts(o.event_start)
  const stage = stageOf(o, now)
  const pstate = plannerState(o, detail?.events ?? null)
  const first = firstName(o.customer_name)
  const deposit = (detail?.payments ?? []).find((p) => p.type === "deposit")
  const otherPaid = Math.max(0, (o.amount_paid_total_cents ?? 0) - (o.deposit_paid_total_cents ?? 0))
  const guests = (o.guest_adult_count ?? 0) + (o.guest_child_count ?? 0)
  const chefLabel = assignments.length ? assignments.map((a) => a.name).join(" + ") : "未派"
  const chefNote = assignments.length > 1 ? `${assignments.length} 位师傅 · 人头平分 ${Math.round(guests / assignments.length)} 人/位` : ""
  const teamDirty = team !== null && (team.length !== assignments.length || team.some((id) => !assignments.find((a) => a.staffId === id)))
  const curTab: OTab = tab ?? "money"
  const goTab = (t: OTab) => {
    if (t !== "sms") setInsert(null)
    setTab(t)
  }
  const toSms = (text: string) => {
    setInsert({ text, nonce: Date.now() })
    setTab("sms")
  }

  const call = async <T,>(label: string, fn: () => Promise<T>): Promise<T | null> => {
    setBusy(label)
    setMsg(null)
    try {
      return await fn()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "操作失败")
      return null
    } finally {
      setBusy(null)
    }
  }

  const sendSms = async (phone: string, body: string) => {
    const leadId = lead && digits10(lead.phone) === digits10(phone) ? lead.id : undefined
    try {
      await adminJson(adminKey, "/api/admin/sms-thread", { body: { phone, body, leadId } })
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 409 && e.data.brake && (await askConfirm({ title: "短信刹车", message: `${e.message}。\n\n仍然发送？`, okLabel: "仍然发送" }))) {
        await adminJson(adminKey, "/api/admin/sms-thread", { body: { phone, body, leadId, force: true } })
      } else throw e
    }
  }

  const plannerLink = async (): Promise<string> => {
    const d = await adminJson<{ ok: boolean; url?: string; error?: string }>(adminKey, "/api/admin/planner-link", { body: { email: o.customer_email ?? "", phone: o.customer_phone ?? "", booked: true } })
    if (!d.ok || !d.url) throw new Error(d.error ?? "planner 链接失败")
    return d.url
  }

  const genPayLink = () =>
    call("pay", async () => {
      const amount = Number(payAmount)
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("金额不对")
      const d = await adminJson<{ ok: boolean; url?: string; total?: number; error?: string }>(adminKey, "/api/admin/pay-link", {
        body: { orderId: o.id, amount, amountIsFinal: payFinal, customerName: o.customer_name ?? undefined, phone: payPhone || undefined, note: `workbench ${o.order_no ?? ""}` },
      })
      if (!d.ok || !d.url) throw new Error(d.error ?? "链接生成失败")
      setPayUrl(d.url)
      const to = payPhone.trim()
      const total = Number(d.total ?? amount)
      const body = `${settings.business.brand}: here's the card link for your ${ev ? md(ev.ymd) : ""} party balance, $${total.toFixed(2)}${payFinal ? "" : " (includes the 4% card fee)"}: ${d.url}`
      if (to && (await askConfirm({ title: "发付款链接", message: `发到 ${prettyPhone(to)}？\n\n${body}`, okLabel: "发送" }))) {
        await sendSms(to, body)
        await adminJson(adminKey, "/api/admin/orders/email-sent", { body: { orderId: o.id, to, subject: `pay link $${total.toFixed(2)} via SMS`, operator: operatorName() } }).catch(() => null)
      } else copyText(d.url)
      await load()
    })

  const confirmFinal = () =>
    call("final", async () => {
      const amount = Number(finalAmount)
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("金额不对")
      if (finalChannel === "stripe" && !/^(pi|ch|py|cs)_[A-Za-z0-9_]{8,}$/.test(finalRef.trim())) throw new Error("Stripe 收款要填 pi_/ch_/cs_ 开头的 ID")
      if (!(await askConfirm({ title: "登记尾款", message: `登记尾款 $${amount.toFixed(2)}（${finalChannel}）？发票系统会同步为已收。`, okLabel: "登记" }))) return
      const d = await adminJson<{ ok: boolean; error?: string }>(adminKey, "/api/admin/orders/final-payment-confirm", {
        body: { orderId: o.id, amount, channel: finalChannel, paymentRef: finalChannel === "stripe" ? finalRef.trim() : undefined, proofUrl: finalChannel !== "stripe" && finalRef.trim() ? finalRef.trim() : undefined, operator: operatorName() },
      })
      if (!d.ok) throw new Error(d.error ?? "登记失败")
      await Promise.all([load(), onChanged()])
    })

  const requestAction = (r: UpdateRequest, action: "confirm" | "complete") =>
    call(`${action}:${r.id}`, async () => {
      if (action === "complete" && !(await askConfirm({ title: "完成改单", message: "标记为已更新并通知师傅？发票系统会给客人发确认。", okLabel: "标记并通知" }))) return
      const d = await adminJson<{ ok?: boolean; error?: string }>(adminKey, "/api/admin/orders/update-request-action", { body: { requestId: r.id, action, operator: operatorName() } })
      if (d.ok === false) throw new Error(d.error ?? "失败")
      await Promise.all([load(), onChanged()])
    })

  const travel = invoiceTravelFee(o.invoice_data)

  const saveTeam = () =>
    call("assign", async () => {
      const d = await adminJson<{ ok: boolean; error?: string }>(adminKey, "/api/admin/chefs", { body: { action: "assign", order_id: o.id, staff_member_ids: team ?? [] } })
      if (!d.ok) throw new Error(d.error ?? "派单失败")
      await Promise.all([load(), onChanged()])
      setMsg("派单已保存")
    })

  const sendEmail = () =>
    call("email", async () => {
      if (!o.customer_email) throw new Error("没有邮箱")
      if (!(await askConfirm({ title: "发邮件", message: `从 ${settings.business.support_email} 发给 ${o.customer_email}？\n\n${emailDraft.subject}`, okLabel: "发送" }))) return
      const d = await adminJson<{ ok: boolean; error?: string }>(adminKey, "/api/admin/send-followup", { body: { to: o.customer_email, subject: emailDraft.subject, text: emailDraft.body, leadId: lead?.id } })
      if (!d.ok) throw new Error(d.error ?? "发送失败")
      await adminJson(adminKey, "/api/admin/orders/email-sent", { body: { orderId: o.id, to: o.customer_email, subject: emailDraft.subject, operator: operatorName() } })
      setEmailTpl(null)
      await load()
    })

  const openInvoiceTool = () => {
    const p = new URLSearchParams()
    if (o.customer_phone) p.set("phone", o.customer_phone.replace(/\D/g, ""))
    if (o.customer_email) p.set("email", o.customer_email)
    window.open(`${settings.business.invoice_tool_url.replace(/\/$/, "")}/?${p.toString()}`, "_blank", "noopener")
  }

  const payOther = digits10(payPhone) !== digits10(o.customer_phone)
  const smsChips = [
    { id: "confirm", label: "开席前确认", body: ORDER_SOP_STEPS.find((s) => s.id === "w_confirm48")!.build({ chefName: assignments[0]?.name ?? settings.business.chef_default_name }) },
    { id: "balance", label: "尾款提醒", body: `${settings.business.brand}: quick reminder for ${ev ? md(ev.ymd) : "your party"} - the balance is ${money(o.balance_due_cents)} and is due on the day (cash, Zelle, Venmo, or card with 4%). Text here if you'd like a card link.` },
    { id: "review", label: "邀评", body: ORDER_SOP_STEPS.find((s) => s.id === "w_review")!.build({ firstName: first || undefined, reviewUrl: settings.business.review_url || undefined }) },
    { id: "ugc", label: "晒图邀请", body: ORDER_SOP_STEPS.find((s) => s.id === "w_ugc")!.build({ firstName: first || undefined }) },
  ]

  return (
    <Dialog onClose={onClose} width={960}>
      <DialogHead
        title={ev ? `${md(ev.ymd)} ${dowZh(ev.ymd)} ${ev.hm}` : "日期未定"}
        tags={
          <>
            <Tag cls={STAGE_TAG_CLASS[stage]}>{stage}</Tag>
            {openReqs.length > 0 ? <Tag cls="tag-outline">客人改了 {openReqs.length} 项</Tag> : null}
            <span className="mono" style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
              {o.order_no}
            </span>
            {ev ? <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>{inDaysLabel(ev.ymd)}</span> : null}
          </>
        }
        lines={[
          <>
            <strong style={{ color: "var(--color-text)" }}>{displayName(o.customer_name, o.customer_phone)}</strong> · {prettyPhone(o.customer_phone)} · {o.customer_email ?? "—"}
          </>,
          <>
            {o.event_address ?? "地址未填"} · 大人 {o.guest_adult_count ?? 0} / 小孩 {o.guest_child_count ?? 0}
          </>,
          <span style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, alignItems: "center" }}>
            <PlannerPill s={live} project={clarityProject} />
            <span style={{ fontWeight: 600, color: pstate.accent ? "var(--color-accent-700)" : "var(--color-neutral-600)" }}>{pstate.text}</span>
            <span style={{ color: assignments.length ? "var(--color-neutral-600)" : "var(--color-accent-700)" }}>
              师傅 {chefLabel}
              {chefNote ? ` · ${chefNote}` : ""}
            </span>
          </span>,
        ]}
        actions={
          o.customer_phone ? (
            <button type="button" className="btn btn-primary" onClick={() => onCall(o.customer_phone!)}>
              {PhoneIcon} 打电话
            </button>
          ) : null
        }
        onClose={onClose}
      />
      <div style={{ display: "flex", padding: "0 20px", borderBottom: "2px solid var(--color-divider)", overflowX: "auto" }}>
        {OTABS.map(([k, label]) => (
          <button key={k} type="button" className="wb-tab" aria-current={curTab === k ? "page" : undefined} onClick={() => goTab(k)} style={{ marginRight: 20 }}>
            {label}
            {k === "planner" && openReqs.length ? <span className="wb-badge">●</span> : null}
          </button>
        ))}
      </div>
      {msg ? <div className="notice" style={{ margin: "12px 20px 0" }}>{msg}</div> : null}

      {curTab === "money" ? (
        <div className="dialog-grid">
          <div className="dialog-col">
            <div>
              <Kicker>核对金额</Kicker>
              <Lines
                rows={[
                  { label: "总报价（发票）", value: money(o.quoted_total_cents), strong: true },
                  { label: `已收押金${deposit?.paid_at ? ` · ${stamp(deposit.paid_at)}` : ""}`, value: `− ${money(o.deposit_paid_total_cents)}` },
                  ...(otherPaid > 0 ? [{ label: "其他已收", value: `− ${money(otherPaid)}` }] : []),
                  ...(travel ? [{ label: `含路费（发票）${travel.manual ? " · 手动" : travel.miles != null ? ` · ${Math.round(travel.miles)} 英里` : ""}`, value: `$${travel.fee}`, muted: true }] : []),
                ]}
                total={{ label: "尾款应收", value: money(o.balance_due_cents), color: stage === "待尾款" ? "var(--color-accent-700)" : undefined }}
              />
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-secondary btn-left" onClick={openInvoiceTool}>
                发 / 改 Invoice（专业表单）
              </button>
              <button type="button" className="btn btn-secondary btn-left" disabled={!lead} onClick={() => lead && onOpenLead(lead.id)} title={lead ? "打开线索期的对话和承诺" : "没找到对应线索"}>
                线索期承诺 / 优惠
              </button>
            </div>
            <div style={{ fontSize: 12, color: "var(--color-neutral-600)", marginTop: -10 }}>人数、菜单、路费、报价一律在专业表单里算和改，保存后这里自动同步。</div>
          </div>
          <div className="dialog-col dialog-side" style={{ gap: 14 }}>
            <div>
              <Kicker>信用卡收款链接</Kicker>
              <div style={{ fontSize: 13, color: "var(--color-neutral-700)" }}>金额默认尾款；付款人默认客人，别人付就换手机号。链接发出后记在这一单上。</div>
            </div>
            <Field label="金额 $">
              <input className="input num" style={{ fontSize: 18 }} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </Field>
            <Field label="付款人手机号">
              <input className="input" value={payPhone} onChange={(e) => setPayPhone(e.target.value)} />
            </Field>
            {payOther ? <div style={{ fontSize: 12, color: "var(--color-accent-700)" }}>与客人电话不同 · 将发给新号码</div> : null}
            <label className="check">
              <input type="checkbox" checked={payFinal} onChange={(e) => setPayFinal(e.target.checked)} /> 金额已含卡费（不再 +4%）
            </label>
            <button type="button" className="btn btn-primary btn-block" style={{ margin: 0 }} disabled={!!busy || !payAmount} onClick={() => void genPayLink()}>
              {busy === "pay" ? "生成中…" : "生成并发送链接"}
            </button>
            {payUrl ? (
              <div style={{ fontSize: 12, wordBreak: "break-all" }}>
                <a href={payUrl} target="_blank" rel="noreferrer">
                  {payUrl}
                </a>{" "}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => copyText(payUrl)}>
                  复制
                </button>
              </div>
            ) : null}
            <div className="hr" style={{ margin: "4px 0" }} />
            <div>
              <Kicker>现金 / Venmo / Zelle / Stripe 已收，登记</Kicker>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Field label="金额 $">
                  <input className="input" value={finalAmount} onChange={(e) => setFinalAmount(e.target.value)} />
                </Field>
                <Field label="方式">
                  <select className="input" value={finalChannel} onChange={(e) => setFinalChannel(e.target.value as typeof finalChannel)}>
                    <option value="zelle">Zelle</option>
                    <option value="venmo">Venmo</option>
                    <option value="cash">现金</option>
                    <option value="stripe">Stripe</option>
                    <option value="other">其他</option>
                  </select>
                </Field>
              </div>
              <Field label={finalChannel === "stripe" ? "Stripe 付款 ID（pi_… / ch_…）" : "凭证链接（可选）"} style={{ marginTop: 8 }}>
                <input className="input" value={finalRef} onChange={(e) => setFinalRef(e.target.value)} />
              </Field>
              <button type="button" className="btn btn-secondary btn-block" disabled={!!busy || !finalAmount} onClick={() => void confirmFinal()}>
                {busy === "final" ? "登记中…" : "登记尾款已收"}
              </button>
              {assignments.length ? <div style={{ fontSize: 12, color: "var(--color-neutral-600)", marginTop: 6 }}>师傅现场代收的尾款在厨师 → 结算里登记，才能从他的工钱里扣。</div> : null}
            </div>
            <div style={{ fontSize: 12, color: "var(--color-neutral-600)", borderTop: "1px solid var(--color-line)", paddingTop: 10 }}>
              <div className="kicker" style={{ marginBottom: 4 }}>已收</div>
              {(detail?.payments ?? []).length === 0 ? <div>还没有收款记录</div> : null}
              {(detail?.payments ?? []).map((p) => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "3px 0" }}>
                  <span>
                    {p.type === "deposit" ? "押金" : p.type === "final" ? "尾款" : p.type ?? "收款"} · {p.provider ?? "—"}
                    {p.status && p.status !== "paid" ? ` · ${p.status}` : ""}
                  </span>
                  <span style={{ whiteSpace: "nowrap" }}>
                    {money(p.amount_cents)} · {stamp(p.paid_at ?? p.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {curTab === "planner" ? (
        <div className="dialog-col">
          {openReqs.map((r) => (
            <div key={r.id} className="notice notice-accent" style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <h6 style={{ margin: 0, color: "var(--color-accent)" }}>客人在 Planner 改了 · {stamp(r.created_at)}</h6>
                <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>{r.status === "received" ? "未核对" : "已核对，待通知师傅"}</span>
              </div>
              <div style={{ fontSize: 13 }}>
                {renderChanges(r.change_summary).map((c, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "88px 1fr", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--color-line)" }}>
                    <span style={{ color: "var(--color-neutral-600)" }}>{c.field}</span>
                    <span>
                      {c.from ? (
                        <>
                          <span style={{ textDecoration: "line-through", color: "var(--color-neutral-500)" }}>{c.from}</span> →{" "}
                        </>
                      ) : null}
                      <strong>{c.to}</strong>
                    </span>
                  </div>
                ))}
                {r.customer_message ? <div style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>客人留言：{r.customer_message}</div> : null}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {r.status === "received" ? (
                  <button type="button" className="btn btn-primary btn-left" disabled={!!busy} onClick={() => void requestAction(r, "confirm")}>
                    已核对
                  </button>
                ) : null}
                <button type="button" className="btn btn-secondary btn-left" disabled={!!busy} onClick={() => void requestAction(r, "complete")}>
                  已更新 · 通知师傅
                </button>
                <button type="button" className="btn btn-secondary btn-left" onClick={() => toSms(`${settings.business.brand}: got your update for the ${ev ? md(ev.ymd) : ""} party - I've updated the invoice, you'll get the new copy by email. Anything else, just text here.`)}>
                  发短信确认新金额
                </button>
              </div>
            </div>
          ))}
          <div>
            <Kicker>Planner 当前</Kicker>
            <div style={{ fontSize: 13, display: "grid", gridTemplateColumns: "72px 1fr", gap: 8, borderTop: "2px solid var(--color-divider)", paddingTop: 8 }}>
              <span style={{ color: "var(--color-neutral-600)" }}>人数</span>
              <span>
                大人 {o.guest_adult_count ?? 0} · 小孩 {o.guest_child_count ?? 0}
              </span>
              <span style={{ color: "var(--color-neutral-600)" }}>状态</span>
              <span style={{ color: pstate.accent ? "var(--color-accent-700)" : undefined }}>{pstate.text}</span>
              <span style={{ color: "var(--color-neutral-600)" }}>最后改动</span>
              <span>{pstate.at || "—"}</span>
              {live && live.state !== "earlier" ? (
                <>
                  <span style={{ color: "var(--color-neutral-600)" }}>此刻</span>
                  <span>
                    <PlannerPill s={live} project={clarityProject} />
                    <div style={{ fontSize: 12, color: "var(--color-neutral-600)", marginTop: 2 }}>
                      {live.events} 步：{live.steps.slice(0, 5).reverse().map(stepLabel).join(" → ")}
                      {live.guests != null ? ` · ${live.guests} 人${live.picked != null ? `，选菜 ${live.picked}/${live.guests}` : ""}` : ""}
                    </div>
                  </span>
                </>
              ) : null}
            </div>
          </div>
          <div>
            <Kicker>派单</Kicker>
            <div style={{ fontSize: 13, borderTop: "2px solid var(--color-divider)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span>
                  <strong style={{ color: assignments.length ? undefined : "var(--color-accent-700)" }}>{chefLabel}</strong>
                  {chefNote ? <span style={{ color: "var(--color-neutral-600)" }}> · {chefNote}</span> : null}
                </span>
                {assignments.length ? (
                  <span style={{ display: "flex", gap: 4 }}>
                    {assignments.map((a) => (
                      <button key={a.assignmentId} type="button" className="btn btn-ghost btn-sm" onClick={() => onOpenChef(a.staffId)}>
                        {a.name} →
                      </button>
                    ))}
                  </span>
                ) : null}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {chefs
                  .filter((c) => c.status === "active" || (team ?? []).includes(c.id))
                  .map((c) => {
                    const on = (team ?? []).includes(c.id)
                    const dayLoad = ev ? c.shifts.filter((s) => s.date === ev.ymd && s.orderId !== o.id).length : 0
                    return (
                      <Chip key={c.id} small active={on} onClick={() => setTeam((t) => (t ?? []).includes(c.id) ? (t ?? []).filter((x) => x !== c.id) : [...(t ?? []), c.id])} title={`${c.areas.join("/")} · ${c.skills.join("、")}`}>
                        {c.name}
                        {dayLoad ? <span style={{ opacity: 0.7 }}> · 当天已有 {dayLoad} 场</span> : null}
                      </Chip>
                    )
                  })}
                {chefs.length === 0 ? <span style={{ color: "var(--color-neutral-600)" }}>还没有厨师，去"厨师"页添加。</span> : null}
              </div>
              {teamDirty ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" className="btn btn-primary btn-sm" disabled={!!busy} onClick={() => void saveTeam()}>
                    {busy === "assign" ? "保存中…" : `保存派单（${(team ?? []).length} 位）`}
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setTeam(assignments.map((a) => a.staffId))}>
                    还原
                  </button>
                </div>
              ) : null}
              <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>多位师傅同场时人头平均分，每位按自己那份算工钱；改人数后自动重分。备料单仍从发票工具的 Send to Chef 发。</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-secondary btn-left" onClick={openInvoiceTool}>
              改日期 / 时段（专业表单）
            </button>
            <button type="button" className="btn btn-secondary btn-left" onClick={openInvoiceTool}>
              改人数 / 菜单
            </button>
            <button type="button" className="btn btn-secondary btn-left" disabled={!!busy} onClick={() => void call("planner", async () => toSms(`Here's your party planner - set up the tables and share it with your guests so everyone picks their own proteins: ${await plannerLink()}`))}>
              {busy === "planner" ? "生成中…" : "给客人发 Planner 链接"}
            </button>
          </div>
        </div>
      ) : null}

      {curTab === "sms" ? (
        <div className="dialog-col" style={{ paddingTop: 0 }}>
          <SmsThreadPanel adminKey={adminKey} phone={o.customer_phone} leadId={lead?.id ?? null} peerLabel={first || "客户"} insert={insert} quickReplies={smsChips} header={<div className="kicker" style={{ padding: "10px 0", borderBottom: "1px solid var(--color-line)" }}>短信 · {settings.business.support_phone}{lead ? " · 记进线索时间线" : ""}</div>} />
        </div>
      ) : null}

      {curTab === "records" ? (
        <div className="dialog-col">
          <div>
            <Kicker>邮件 · {settings.business.support_email}</Kicker>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {EMAIL_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="wb-chip wb-chip-sm"
                  aria-pressed={emailTpl === t.id ? "true" : "false"}
                  disabled={!o.customer_email}
                  onClick={() => {
                    setEmailTpl(t.id)
                    setEmailDraft(buildEmail(o, t.id, settings))
                  }}
                >
                  {t.label}
                </button>
              ))}
              {!o.customer_email ? <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>没有邮箱</span> : null}
            </div>
            {emailTpl ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                <input className="input" value={emailDraft.subject} onChange={(e) => setEmailDraft({ ...emailDraft, subject: e.target.value })} />
                <textarea className="input" rows={8} value={emailDraft.body} onChange={(e) => setEmailDraft({ ...emailDraft, body: e.target.value })} />
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => void sendEmail()}>
                    {busy === "email" ? "发送中…" : `发给 ${o.customer_email}`}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setEmailTpl(null)}>
                    取消
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div>
            <Kicker>派对照片（师傅端上传）</Kicker>
            <OrderPhotosPanel adminKey={adminKey} orderId={o.id} />
          </div>
          <div>
            <Kicker>已发送的发票（存档）</Kicker>
            <InvoiceArchivePanel adminKey={adminKey} orderNo={o.order_no} orderId={o.id} />
          </div>
          <div>
            <Kicker>时间线（{detail?.events.length ?? "…"}）</Kicker>
            <div style={{ fontSize: 12.5, borderTop: "2px solid var(--color-divider)" }}>
              {(detail?.events ?? []).map((e) => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--color-line)" }}>
                  <span>
                    <strong>{ORDER_EVENT_LABELS[e.action] ?? e.action}</strong>
                    {e.metadata && typeof e.metadata.title === "string" ? <span style={{ color: "var(--color-neutral-600)" }}> · {e.metadata.title}</span> : null}
                    {e.action === "chef_assigned" && Array.isArray(e.metadata?.names) ? <span style={{ color: "var(--color-neutral-600)" }}> · {(e.metadata!.names as string[]).join(" + ") || "清空"}</span> : null}
                    <span style={{ color: "var(--color-neutral-500)" }}> · {e.actor}</span>
                  </span>
                  <span style={{ color: "var(--color-neutral-600)", whiteSpace: "nowrap" }}>{stamp(e.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
          {o.internal_notes || o.customer_notes || o.notes ? (
            <div>
              <Kicker>备注</Kicker>
              <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{[o.customer_notes, o.internal_notes, o.notes].filter(Boolean).join("\n\n")}</div>
            </div>
          ) : null}
          {viewerRole === "owner" ? (
            <div style={{ fontSize: 11, color: "var(--color-neutral-500)" }}>
              订单 ID <span className="mono">{o.id}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </Dialog>
  )
}
