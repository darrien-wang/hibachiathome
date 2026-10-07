"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { adminJson } from "./api"
import { Dialog, DialogHead, Kicker, PhoneIcon, Tag } from "./ui"
import { askConfirm, askPrompt } from "./ask"
import {
  leadOnHold,
  copyText,
  displayName,
  EVENT_LABELS,
  eventParts,
  firstName,
  firstRespText,
  isPlaceholderName,
  LEAD_STATUS_LABELS,
  LEAD_TAG_CLASS,
  leadKeyword,
  customerSpokeLast,
  leadUnreplied,
  md,
  ordersForLead,
  parseYmd,
  prettyPhone,
  relativeTime,
  stageOf,
  STAGE_TAG_CLASS,
  stamp,
  type LeadEvent,
  type LeadRow,
  type OrderRow,
  guestLabel,
} from "./helpers"
import { SmsThreadPanel } from "@/components/admin/sms-thread-panel"
import { PlannerPill, type PlannerSession } from "./planner-live"
import type { WorkbenchSettings } from "@/lib/workbench-settings-shared"
import { WEEKDAY_SPECIAL, WEEKDAY_SPECIAL_BLACKOUTS, normalizePricingTerms } from "@/config/pricing-rules"
import { formatTaxRate } from "@/lib/sales-tax-rate"
import { computeQuote, quoteDateLabel, quotePromiseNote, quoteSms, QUOTE_APPETIZERS, usd, type QuoteAppetizer } from "./quote-tool"

// 线索弹窗 · 客服：对话 + 承诺 + 操作. Everything a person does with a lead
// before the deposit lands. Writes go through /api/admin/leads (PATCH) and
// the SMS route; the list behind the dialog refreshes through onChanged.

const PROMISE_PREFIX = "[承诺]"
const STATUS_OPTS = ["new", "qualified", "lost", "disqualified"] as const

function isWeekdaySpecialDate(ymd: string | null | undefined): boolean {
  if (!ymd) return false
  const d = parseYmd(ymd)
  if (!(WEEKDAY_SPECIAL.eligibleWeekdays as readonly number[]).includes(d.getUTCDay())) return false
  return !WEEKDAY_SPECIAL_BLACKOUTS.some((b) => ymd >= b.start && ymd <= b.end)
}

type LTab = "chat" | "deal" | "info"

export function LeadDialog({
  adminKey,
  lead,
  orders,
  settings,
  viewerRole,
  isMobile,
  live,
  clarityProject,
  onClose,
  onChanged,
  onOpenOrder,
  onDeposit,
  onCall,
}: {
  adminKey: string
  lead: LeadRow
  orders: OrderRow[]
  settings: WorkbenchSettings
  viewerRole: "owner" | "agent" | null
  isMobile: boolean
  live?: PlannerSession
  clarityProject: string
  onClose: () => void
  onChanged: () => Promise<void> | void
  onOpenOrder: (orderId: string) => void
  onDeposit: (lead: LeadRow) => void
  onCall: (phone: string) => void
}) {
  // Desktop: 对话 + 成交 side by side, 资料 separate. Phone: one at a time.
  const [ltab, setLtab] = useState<LTab>("chat")
  const tabs: Array<[LTab, string]> = isMobile ? [["chat", "对话"], ["deal", "状态 · 承诺 · 报价"], ["info", "资料"]] : [["chat", "对话 + 成交"], ["info", "资料"]]
  const effTab: LTab = !isMobile && ltab === "deal" ? "chat" : ltab
  const showChat = effTab !== "info" && (!isMobile || effTab === "chat")
  const showDeal = effTab !== "info" && (!isMobile || effTab === "deal")
  const [events, setEvents] = useState<LeadEvent[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [promiseDraft, setPromiseDraft] = useState("")
  const [noteDraft, setNoteDraft] = useState("")
  const [adults, setAdults] = useState(String(lead.guest_count ?? 10))
  const [kids, setKids] = useState("0")
  // 报价工具（老板 2026-10-04）：电话里给的让价写成规则、签进押金链接、短信一键生成。
  // 原来的「协议总价」是 09-28 就停用的冻结总价机制，这里改用 custom-deal 规则。
  const [qDate, setQDate] = useState(lead.event_hint ?? "")
  const [qTime, setQTime] = useState("")
  const [rate, setRate] = useState("")
  const [flatOff, setFlatOff] = useState("")
  const [appId, setAppId] = useState<"" | QuoteAppetizer>("")
  const [appTrays, setAppTrays] = useState("")
  const [freeTables, setFreeTables] = useState(false)
  const [freeUtensils, setFreeUtensils] = useState(false)
  // Below the owner's floor (D-1006-06) the quote only goes out once the owner has said yes.
  const [floorOk, setFloorOk] = useState(false)
  // The last generated quote: it goes into 承诺 only once a text carrying its link is sent.
  const [pendingQuote, setPendingQuote] = useState<{ link: string; note: string } | null>(null)
  const [travel, setTravel] = useState<{ miles: number | null; fee: number } | null>(null)
  const [insert, setInsert] = useState<{ text: string; nonce: number } | null>(null)
  const [edit, setEdit] = useState({ full_name: lead.full_name ?? "", phone: lead.phone ?? "", email: lead.email ?? "", city_or_zip: lead.city_or_zip ?? "", guest_count: String(lead.guest_count ?? "") })

  const loadEvents = useCallback(async () => {
    try {
      const d = await adminJson<{ events: LeadEvent[] }>(adminKey, `/api/admin/leads?detail=${encodeURIComponent(lead.id)}`)
      setEvents(Array.isArray(d.events) ? d.events : [])
    } catch {
      setEvents([])
    }
  }, [adminKey, lead.id])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  // On a phone the composer sits on the 对话 tab: bring it up when a quote or link lands in it.
  useEffect(() => {
    if (insert && isMobile) setLtab("chat")
  }, [insert, isMobile])

  // Travel fee from the site's own service (never hand-computed: base ZIP config).
  useEffect(() => {
    const dest = (lead.city_or_zip ?? "").trim()
    if (!dest) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/quote/travel-fee?destination=${encodeURIComponent(dest)}`, { cache: "no-store" })
        const d = await res.json()
        if (cancelled) return
        const fee = Number(d?.travel_fee_range?.high ?? 0)
        setTravel({ miles: typeof d?.distance_miles === "number" ? d.distance_miles : null, fee: Number.isFinite(fee) ? fee : 0 })
      } catch {
        if (!cancelled) setTravel(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [lead.city_or_zip])

  const patch = useCallback(
    async (body: Record<string, unknown>, label: string) => {
      setBusy(label)
      setMsg(null)
      try {
        await adminJson(adminKey, "/api/admin/leads", { method: "PATCH", body: { leadId: lead.id, ...body } })
        await Promise.all([loadEvents(), onChanged()])
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "操作失败")
      } finally {
        setBusy(null)
      }
    },
    [adminKey, lead.id, loadEvents, onChanged],
  )

  const promises = useMemo(
    () =>
      (events ?? [])
        .filter((e) => e.touchpoint_type === "agent_note" && typeof e.raw_payload_json?.note === "string" && String(e.raw_payload_json.note).startsWith(PROMISE_PREFIX))
        .map((e) => ({ text: String(e.raw_payload_json?.note).slice(PROMISE_PREFIX.length).trim(), at: e.occurred_at })),
    [events],
  )

  const weekday = isWeekdaySpecialDate(qDate || lead.event_hint)
  const quote = useMemo(
    () =>
      computeQuote({
        adults: Number(adults) || 0,
        kids: Number(kids) || 0,
        weekdaySpecial: weekday,
        eventDate: qDate || lead.event_hint,
        // null = no address yet: the quote text then leaves travel out instead of promising none.
        travelFee: travel ? travel.fee : null,
        adultRate: Number(rate) || null,
        flatOff: Number(flatOff) || null,
        freeAppetizer: appId && Number(appTrays) > 0 ? { id: appId, trays: Math.floor(Number(appTrays)) } : null,
        freeTables,
        freeUtensils,
      }),
    [adults, kids, weekday, qDate, lead.event_hint, travel, rate, flatOff, appId, appTrays, freeTables, freeUtensils],
  )
  const qLabel = quoteDateLabel(qDate || lead.event_hint, qTime)
  const linked = useMemo(() => ordersForLead(lead, orders), [lead, orders])
  const unreplied = leadUnreplied(lead)
  // 顶栏那颗「不用回」跟着对话走，不跟着漏斗走：成单和流失的客人也会发消息，
  // 手机也会为他们响（老板 2026-09-29）。
  const spokeLast = customerSpokeLast(lead)
  const onHold = leadOnHold(lead)
  const acked = Boolean(lead.acked_until && Date.parse(lead.acked_until) > 0 &&
    (!lead.last_inbound_at || Date.parse(lead.last_inbound_at) <= Date.parse(lead.acked_until)))
  const resp = firstRespText(lead.response_seconds, settings.targets.first_response_sla_minutes)
  const fname = firstName(lead.full_name)

  // ---- links the owner sends ------------------------------------------
  const depositLink = useCallback(async (): Promise<string> => {
    const u = new URL("https://www.realhibachi.com/deposit/pay")
    u.searchParams.set("source", "workbench")
    u.searchParams.set("lead_id", lead.id)
    if (!isPlaceholderName(lead.full_name)) u.searchParams.set("customer_name", lead.full_name ?? "")
    if (lead.email) u.searchParams.set("customer_email", lead.email)
    if (Number(adults) > 0) u.searchParams.set("adults", String(Number(adults)))
    if (Number(kids) > 0) u.searchParams.set("kids", String(Number(kids)))
    if (lead.city_or_zip) u.searchParams.set("location", lead.city_or_zip)
    const date = qDate || lead.event_hint
    if (date) u.searchParams.set("event_date", date)
    if (qTime) u.searchParams.set("event_time", qTime)
    if (quote.total > 0) {
      // Display only on the deposit page; the order re-prices from the rules below.
      u.searchParams.set("estimate_low", String(Math.round(quote.total)))
      u.searchParams.set("estimate_high", String(Math.round(quote.total)))
    }
    let url = u.toString()
    if (quote.deal) {
      // Signed rules, not a frozen total (owner 2026-09-28): the order and the
      // invoice re-price them when the headcount moves.
      const d = await adminJson<{ ok: boolean; query?: string }>(adminKey, "/api/admin/custom-deal", { body: { leadId: lead.id, ...quote.deal } })
      if (d.ok && d.query) url += `&${d.query}`
    }
    try {
      const s = await adminJson<{ ok: boolean; shortUrl?: string }>(adminKey, "/api/admin/short-link", { body: { url, leadId: lead.id } })
      if (s.ok && s.shortUrl) return s.shortUrl
    } catch {}
    return url
  }, [adminKey, lead, adults, kids, qDate, qTime, quote])

  const plannerLink = useCallback(async (): Promise<string> => {
    const d = await adminJson<{ ok: boolean; url?: string; error?: string }>(adminKey, "/api/admin/planner-link", {
      body: { email: lead.email ?? "", phone: lead.phone ?? "", leadId: lead.id, booked: false },
    })
    if (!d.ok || !d.url) throw new Error(d.error ?? "planner 链接生成失败")
    try {
      const s = await adminJson<{ ok: boolean; shortUrl?: string }>(adminKey, "/api/admin/short-link", { body: { url: d.url, leadId: lead.id } })
      if (s.ok && s.shortUrl) return s.shortUrl
    } catch {}
    return d.url
  }, [adminKey, lead])

  const fillTemplate = useCallback(
    async (body: string) => {
      let out = body.replaceAll("{first_name}", fname).replaceAll("{date}", lead.event_hint ? md(lead.event_hint) : "your date")
      if (out.includes("{deposit_link}")) out = out.replaceAll("{deposit_link}", await depositLink())
      if (out.includes("{planner_link}")) out = out.replaceAll("{planner_link}", await plannerLink())
      return out.replace(/^Hi\s*,/, "Hi,").replace(/\s{2,}/g, " ")
    },
    [fname, lead.event_hint, depositLink, plannerLink],
  )

  const pushDepositLink = async () => {
    setBusy("deposit")
    try {
      const link = await depositLink()
      const tpl = settings.quick_replies.find((q) => q.body.includes("{deposit_link}"))
      const text = tpl ? await fillTemplate(tpl.body) : `Here's the link to lock in your date - it saves a card and nothing is charged today: ${link}`
      setInsert({ text, nonce: Date.now() })
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "押金链接失败")
    } finally {
      setBusy(null)
    }
  }

  // 报价工具的主按钮：英文报价 + 签好让价的押金链接，落到短信输入框，看一眼再发。
  // 真发出去了（发出的短信里带着这条链接）才记进「承诺」，见 onSent。
  const pushQuote = async () => {
    setBusy("quote")
    setMsg(null)
    try {
      const link = await depositLink()
      setInsert({ text: quoteSms(quote, { dateLabel: qLabel, depositLink: link }), nonce: Date.now() })
      setPendingQuote({ link, note: quotePromiseNote(quote, qLabel) })
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "报价生成失败")
    } finally {
      setBusy(null)
    }
  }

  const pushPlannerLink = async () => {
    setBusy("planner")
    try {
      const link = await plannerLink()
      setInsert({ text: `Here's your party planner - set up the tables and share it with your guests so everyone picks their own proteins: ${link}`, nonce: Date.now() })
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "planner 链接失败")
    } finally {
      setBusy(null)
    }
  }

  // 信用卡收款链接：先从发票系统拉最新 Balance Due（唯一真源），确认后生成
  // Stripe 链接；查不到发票才允许手输金额。
  const pushPayLink = async () => {
    setBusy("pay")
    try {
      const q = await adminJson<Record<string, unknown>>(adminKey, "/api/admin/pay-link", { body: { action: "quote", phone: lead.phone || undefined, email: lead.email || undefined } })
      let amount: number
      if (q.ok && q.found && Number(q.balanceDue) > 0) {
        // The link is a card payment, so it collects the card bill: v2 (D-1006-05)
        // = cash balance + the party's sales tax + card processing, v1 = +4%. All
        // figures are the invoice engine's; nothing is recomputed here.
        const bal = Number(q.cardBalanceDue ?? q.balanceDue)
        const cash = Number(q.cashBalanceDue ?? q.balanceDue)
        const v2 = normalizePricingTerms(typeof q.pricingTerms === "string" ? q.pricingTerms : null) === "v2_by_method"
        const detail = v2
          ? `含消费税${typeof q.salesTaxRate === "number" ? ` ${formatTaxRate(q.salesTaxRate)}` : ""} $${Number(q.salesTax ?? 0).toFixed(2)} + 刷卡手续费 $${Number(q.cardProcessingFee ?? 0).toFixed(2)}；现金尾款 $${cash.toFixed(2)}${typeof q.zelleVenmoBalanceDue === "number" ? ` · Venmo/Zelle $${q.zelleVenmoBalanceDue.toFixed(2)}` : ""}${q.salesTaxRateSource !== "address" ? "\n⚠ 税率是估的——先在发票里按派对地址 Re-rate" : ""}`
          : `含 4%；现金尾款 $${cash.toFixed(2)}`
        if (!(await askConfirm({ title: "生成收款链接", message: `已联动最新发票（${q.clientName ?? "客户"} · ${q.eventDate ?? "日期未填"} · ${q.guests ?? "?"} 人）\n刷卡尾款 $${bal.toFixed(2)}（${detail}），链接就收这个数\n\n生成这个金额的收款链接？`, okLabel: "生成" }))) return
        amount = bal
      } else {
        const raw = await askPrompt({ title: "手输金额", message: "发票系统里没有这位客人的尾款。手输金额（美元，链接就收这个数）：", defaultValue: quote.total.toFixed(2), placeholder: "0.00", inputMode: "decimal", okLabel: "生成链接" })
        if (!raw) return
        amount = Number(raw)
        if (!Number.isFinite(amount) || amount <= 0) throw new Error("金额不对")
      }
      const d = await adminJson<{ ok: boolean; url?: string; total?: number; error?: string }>(adminKey, "/api/admin/pay-link", {
        body: { phone: lead.phone || undefined, email: lead.email || undefined, amount, customerName: isPlaceholderName(lead.full_name) ? undefined : lead.full_name, note: "workbench lead" },
      })
      if (!d.ok || !d.url) throw new Error(d.error ?? "链接生成失败")
      let link = d.url
      try {
        const s = await adminJson<{ ok: boolean; shortUrl?: string }>(adminKey, "/api/admin/short-link", { body: { url: d.url, leadId: lead.id } })
        if (s.ok && s.shortUrl) link = s.shortUrl
      } catch {}
      setInsert({ text: `Here's the card link for $${Number(d.total ?? amount).toFixed(2)}: ${link}`, nonce: Date.now() })
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "收款链接失败")
    } finally {
      setBusy(null)
    }
  }

  const saveEdit = async () => {
    const fields: Record<string, unknown> = {}
    if (edit.full_name.trim() !== (lead.full_name ?? "")) fields.full_name = edit.full_name.trim()
    if (edit.phone.trim() !== (lead.phone ?? "")) fields.phone = edit.phone.trim()
    if (edit.email.trim() !== (lead.email ?? "")) fields.email = edit.email.trim()
    if (edit.city_or_zip.trim() !== (lead.city_or_zip ?? "")) fields.city_or_zip = edit.city_or_zip.trim()
    if (edit.guest_count.trim() !== String(lead.guest_count ?? "")) fields.guest_count = Number(edit.guest_count) || null
    if (Object.keys(fields).length === 0) return
    await patch({ action: "update_fields", fields }, "edit")
  }

  const onSent = useCallback(
    async (body: string) => {
      // The first personal text is the first response: the list's 首响 column
      // and the auto-watch both key off this touchpoint.
      if (!lead.first_response_at) await adminJson(adminKey, "/api/admin/leads", { method: "PATCH", body: { leadId: lead.id, action: "mark_contacted", via: "sms", note: body.slice(0, 120) } })
      // The quote went out (edited or not, the link is the deal): now it is a promise.
      if (pendingQuote && body.includes(pendingQuote.link)) {
        setPendingQuote(null)
        await adminJson(adminKey, "/api/admin/leads", { method: "PATCH", body: { leadId: lead.id, action: "add_note", note: `${PROMISE_PREFIX} ${pendingQuote.note}` } }).catch(() => {})
      }
      await Promise.all([loadEvents(), onChanged()])
    },
    [adminKey, lead.id, lead.first_response_at, loadEvents, onChanged, pendingQuote],
  )

  const cityLine = [lead.city_or_zip, guestLabel(lead)?.text ?? null, lead.event_hint ? `想订 ${md(lead.event_hint)} ${weekday ? "(周中价)" : ""}` : null].filter(Boolean).join(" · ")

  return (
    <Dialog onClose={onClose} width={1000}>
      <DialogHead
        title={displayName(lead.full_name, lead.phone)}
        tags={
          <>
            <Tag cls={LEAD_TAG_CLASS[lead.status] ?? "tag-neutral"}>{LEAD_STATUS_LABELS[lead.status] ?? lead.status}</Tag>
            <PlannerPill s={live} project={clarityProject} />
            <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
              {leadKeyword(lead)} · 首响 <span style={{ color: resp.late ? "var(--color-accent-700)" : undefined }}>{resp.text}</span> · 收到 {relativeTime(lead.created_at)}
            </span>
          </>
        }
        lines={[
          <>
            {prettyPhone(lead.phone)} · {lead.email ?? "—"}
            {cityLine ? ` · ${cityLine}` : ""}
          </>,
        ]}
        actions={
          lead.phone ? (
            <button type="button" className="btn btn-primary" onClick={() => onCall(lead.phone!)}>
              {PhoneIcon} 打电话
            </button>
          ) : null
        }
        onClose={onClose}
      />
      <div style={{ display: "flex", padding: "0 20px", borderBottom: "2px solid var(--color-divider)", overflowX: "auto" }}>
        {tabs.map(([k, label]) => (
          <button key={k} type="button" className="wb-tab" aria-current={effTab === k ? "page" : undefined} onClick={() => setLtab(k)} style={{ marginRight: 20 }}>
            {label}
          </button>
        ))}
      </div>
      {effTab === "info" ? (
        <div className="dialog-col" style={{ gap: 14 }}>
          {msg ? <div className="notice danger">{msg}</div> : null}
          <Kicker style={{ margin: 0 }}>修改资料（留痕）</Kicker>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label className="field">
              <span className="label">姓名</span>
              <input className="input" value={edit.full_name} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} />
            </label>
            <label className="field">
              <span className="label">电话</span>
              <input className="input" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
            </label>
            <label className="field">
              <span className="label">邮箱</span>
              <input className="input" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
            </label>
            <label className="field">
              <span className="label">城市 / ZIP</span>
              <input className="input" value={edit.city_or_zip} onChange={(e) => setEdit({ ...edit, city_or_zip: e.target.value })} />
            </label>
            <label className="field">
              <span className="label">人数</span>
              <input className="input" type="number" value={edit.guest_count} onChange={(e) => setEdit({ ...edit, guest_count: e.target.value })} />
            </label>
          </div>
          <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
            来源 {leadKeyword(lead)} · {lead.lead_channel ?? "—"} · 首响 {resp.text} · 收到 {stamp(lead.created_at)}
            {lead.utm_campaign ? ` · 系列 ${lead.utm_campaign}` : ""}
            {lead.gclid ? " · 广告点击" : ""}
          </div>
          <button type="button" className="btn btn-secondary" style={{ alignSelf: "flex-start" }} disabled={!!busy} onClick={() => void saveEdit()}>
            保存修改
          </button>
          {viewerRole === "owner" ? (
            <div style={{ fontSize: 11, color: "var(--color-neutral-500)" }}>
              线索 ID <span className="mono">{lead.id}</span>{" "}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => copyText(lead.id)}>
                复制
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="dialog-grid" style={{ display: effTab === "info" ? "none" : undefined, gridTemplateColumns: isMobile ? "1fr" : undefined }}>
        {/* ── left: the conversation ── */}
        <div className="dialog-col" style={{ gap: 0, paddingTop: 0, display: showChat ? undefined : "none" }}>
          <SmsThreadPanel
            adminKey={adminKey}
            phone={lead.phone}
            leadId={lead.id}
            peerLabel={fname || "客户"}
            quickReplies={settings.quick_replies}
            fillTemplate={fillTemplate}
            insert={insert}
            onSent={onSent}
            header={
              <div className="kicker" style={{ padding: "10px 0", borderBottom: "1px solid var(--color-line)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span>短信对话 · {settings.business.support_phone}</span>
                {/* 报警在哪，关掉它的开关就在哪（老板 2026-09-27）。右栏那颗
                    「不用回」一直都在，但决定"这条我不回了"的那一秒，人看的是
                    这行红字，不是右栏。同一个动作，同一条水位线。 */}
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {spokeLast ? (
                    <button
                      type="button"
                      className="wb-chip wb-chip-sm"
                      disabled={!!busy}
                      title="到此为止：手机和巡检都不再提醒这条。客人再发新消息照样响。"
                      onClick={() => void patch({ action: "ack_replies" }, "ack")}
                    >
                      {busy === "ack" ? "…" : "不用回"}
                    </button>
                  ) : null}
                  <span style={{ color: spokeLast ? "var(--color-accent-700)" : "var(--color-neutral-600)", textTransform: "none", letterSpacing: 0, fontWeight: 600 }}>
                    {spokeLast ? "客人在等回复" : acked ? "已标不用回" : lead.last_outbound_at ? "已回复" : "还没联系"}
                  </span>
                </span>
              </div>
            }
          />
          {lead.latest_message ? (
            <details style={{ marginTop: 12 }}>
              <summary>客户最初留言 / 最近一条</summary>
              <div style={{ fontSize: 13, whiteSpace: "pre-wrap", marginTop: 6, color: "var(--color-neutral-700)" }}>{lead.latest_message}</div>
            </details>
          ) : null}
        </div>

        {/* ── right: state, promises, quote, actions ── */}
        <div className="dialog-col" style={{ display: showDeal ? undefined : "none" }}>
          {msg ? <div className="notice danger">{msg}</div> : null}
          <div>
            <Kicker>状态</Kicker>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {STATUS_OPTS.map((s) => (
                <button key={s} type="button" className="wb-chip wb-chip-sm" aria-pressed={lead.status === s ? "true" : "false"} disabled={!!busy} onClick={() => void patch({ action: "set_status", status: s }, "status")}>
                  {LEAD_STATUS_LABELS[s]}
                </button>
              ))}
              {lead.status === "won" ? <Tag cls="tag-ink">已成单</Tag> : null}
            </div>
          </div>

          {/* 球在谁那边——和状态是两回事（老板 2026-09-23 定）。客人说"我回头
              告诉你"的，挂起期间不算我们欠回复，也不进巡检提醒。客人在挂起之后
              又说话，挂起自动失效。 */}
          <div>
            <Kicker>等客户回（不是我们没回）</Kicker>
            {onHold ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 13 }}>
                <Tag cls="tag-ink">等客户回 · 到 {stamp(lead.hold_until!)}</Tag>
                <button type="button" className="wb-chip wb-chip-sm" disabled={!!busy} onClick={() => void patch({ action: "set_hold", days: 0 }, "hold")}>
                  撤销
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                {[
                  [2, "2 天"],
                  [5, "5 天"],
                  [14, "2 周"],
                ].map(([d, label]) => (
                  <button key={String(d)} type="button" className="wb-chip wb-chip-sm" disabled={!!busy} onClick={() => void patch({ action: "set_hold", days: d }, "hold")}>
                    {label}
                  </button>
                ))}
                <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>客人说他会回头找我们时点一下</span>
              </div>
            )}
            {/* 「不用回」：一句道谢、一个赞，不是在等我们答复（老板 2026-09-24：
                免得一直提醒）。和挂起不同——它只管这一刻之前，新消息照样响。 */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 6 }}>
              {acked ? (
                <>
                  <Tag cls="tag-ink">不用回 · {stamp(lead.acked_until!)} 之前</Tag>
                  <button type="button" className="wb-chip wb-chip-sm" disabled={!!busy} onClick={() => void patch({ action: "ack_replies", clear: true }, "ack")}>
                    撤销
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="wb-chip wb-chip-sm" disabled={!!busy} onClick={() => void patch({ action: "ack_replies" }, "ack")}>
                    不用回
                  </button>
                  <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>道谢、点赞、聊完了的收尾这种——这条我处理完了；标了手机和巡检都不再提醒，客人再发新消息照样响</span>
                </>
              )}
            </div>
          </div>

          {linked.length > 0 ? (
            <div>
              <Kicker>这位客人的订单</Kicker>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {linked.map((o) => {
                  const ev = eventParts(o.event_start)
                  const st = stageOf(o, Date.now())
                  return (
                    <button key={o.id} type="button" className="btn btn-secondary btn-left" onClick={() => onOpenOrder(o.id)}>
                      <span className="mono" style={{ fontSize: 11 }}>{o.order_no}</span>
                      <span>{ev ? `${md(ev.ymd)} ${ev.hm}` : "—"}</span>
                      <Tag cls={STAGE_TAG_CLASS[st]}>{st}</Tag>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          <div>
            <Kicker>已给客人的承诺 / 优惠</Kicker>
            {events === null ? <div className="empty">读取中…</div> : null}
            {events !== null && promises.length === 0 ? <div style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>暂无。报价或优惠一发出就记在这里，转入订单后照样能看到。</div> : null}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {promises.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--color-line)", fontSize: 13 }}>
                  <span style={{ color: "var(--color-accent)", fontWeight: 800 }}>✓</span>
                  <span style={{ flex: 1 }}>{p.text}</span>
                  <span style={{ color: "var(--color-neutral-600)", whiteSpace: "nowrap" }}>{stamp(p.at).split(" ")[0]}</span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input className="input" placeholder="记一条承诺，如：桌椅半价，10/15 前订" value={promiseDraft} onChange={(e) => setPromiseDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && promiseDraft.trim() && void patch({ action: "add_note", note: `${PROMISE_PREFIX} ${promiseDraft.trim()}` }, "promise").then(() => setPromiseDraft(""))} />
              <button type="button" className="btn btn-secondary" disabled={!promiseDraft.trim() || !!busy} onClick={() => void patch({ action: "add_note", note: `${PROMISE_PREFIX} ${promiseDraft.trim()}` }, "promise").then(() => setPromiseDraft(""))}>
                记下
              </button>
            </div>
          </div>

          <div>
            <Kicker>报价 {weekday ? "· 周中价" : ""}</Kicker>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 8, fontSize: 13 }}>
              <label className="field">
                <span className="label">大人 × ${quote.listAdultPrice.toFixed(2)}</span>
                <input className="input" type="number" min={0} value={adults} onChange={(e) => setAdults(e.target.value)} />
              </label>
              <label className="field">
                <span className="label">小孩 × ${quote.childPrice.toFixed(2)}</span>
                <input className="input" type="number" min={0} value={kids} onChange={(e) => setKids(e.target.value)} />
              </label>
              <label className="field">
                <span className="label">日期</span>
                <input className="input" type="date" value={qDate} onChange={(e) => setQDate(e.target.value)} />
              </label>
              <label className="field">
                <span className="label">开始时间</span>
                <input className="input" type="time" value={qTime} onChange={(e) => setQTime(e.target.value)} />
              </label>
              <label className="field">
                <span className="label">每人特价（可选）</span>
                <input className="input" type="number" min={0} step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder={quote.listAdultPrice.toFixed(2)} />
              </label>
              <label className="field">
                <span className="label">再减 $（可选）</span>
                <input className="input" type="number" min={0} step="1" value={flatOff} onChange={(e) => setFlatOff(e.target.value)} placeholder="0" />
              </label>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 8, fontSize: 13 }}>
              <span style={{ color: "var(--color-neutral-600)" }}>送</span>
              <select className="input" style={{ width: "auto" }} value={appId} onChange={(e) => setAppId(e.target.value as "" | QuoteAppetizer)}>
                <option value="">不送前菜</option>
                {(Object.keys(QUOTE_APPETIZERS) as QuoteAppetizer[]).map((id) => (
                  <option key={id} value={id}>{QUOTE_APPETIZERS[id].zh}（${QUOTE_APPETIZERS[id].price}/盘）</option>
                ))}
              </select>
              {appId ? (
                <input className="input" style={{ width: 80 }} type="number" min={1} value={appTrays} onChange={(e) => setAppTrays(e.target.value)} placeholder="盘数" aria-label="盘数" />
              ) : null}
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input type="checkbox" checked={freeTables} onChange={(e) => setFreeTables(e.target.checked)} />
                桌椅
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input type="checkbox" checked={freeUtensils} onChange={(e) => setFreeUtensils(e.target.checked)} />
                餐具
              </label>
              {quote.autoAppetizerTrays ? <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>{weekday ? "周中" : "20 人以上"}本来就送 {quote.autoAppetizerTrays} 盘前菜（每 10 人 1 盘）</span> : null}
            </div>
            <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.65, color: "var(--color-neutral-700)" }}>
              <div>
                {quote.adults} 大人 × ${quote.listAdultPrice.toFixed(2)}
                {quote.kids ? ` + ${quote.kids} 小孩 × $${quote.childPrice.toFixed(2)}` : ""}
                {` = ${usd(quote.foodSubtotal)}`}
              </div>
              <div>
                {[
                  quote.partySize > 0 ? `人数折扣${quote.partySizeTier ? `（${quote.partySizeTier}）` : ""} −$${quote.partySize}` : null,
                  quote.rateCut > 0 ? `每人 $${quote.adultPrice.toFixed(2)} 让 −${usd(quote.rateCut)}` : null,
                  quote.flatOff > 0 ? `再减 −${usd(quote.flatOff)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "没有折扣"}
                {quote.minApplied ? " → 不到 $599，按 $599 起订" : ""}
              </div>
              {quote.adults + quote.kids > 0 ? (
                <div style={{ color: quote.belowFloor ? "var(--color-danger-600, #b91c1c)" : undefined, fontWeight: quote.belowFloor ? 600 : undefined }}>
                  人均实收 ${quote.effectivePerHead.toFixed(2)}（底线 {weekday ? "周一–四" : "周五–日"} ${quote.floorRate}
                  {quote.kids ? "，小孩算半个" : ""}
                  {freeTables ? "，桌椅按 $4/人计入" : ""}）
                  {quote.belowFloor ? (
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 4, marginLeft: 8 }}>
                      <input type="checkbox" checked={floorOk} onChange={(e) => setFloorOk(e.target.checked)} />
                      低于底线，老板已点头
                    </label>
                  ) : null}
                </div>
              ) : null}
              {quote.freebiesZh.length ? <div>送：{quote.freebiesZh.join("、")}，共值 ${quote.freeValue}，不进总价</div> : null}
              {appId ? <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>前菜不签进押金链接，付押金后发票里按盘数加上（发出后记在承诺里）</div> : null}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 6, fontSize: 13 }}>
              <span style={{ color: "var(--color-neutral-600)" }}>
                合计（{quote.travelKnown ? `含路费 $${quote.travelFee}` : "路费按地址再算"}
                {travel?.miles != null ? ` · ${Math.round(travel.miles)} 英里` : ""}
                {quote.adults + quote.kids > 0 ? ` · 人均 $${quote.perPerson.toFixed(2)}` : ""}）
              </span>
              <strong className="num" style={{ fontSize: 18 }}>
                {usd(quote.total)}
              </strong>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-left"
              style={{ width: "100%", marginTop: 8 }}
              disabled={!!busy || !lead.phone || quote.adults + quote.kids === 0 || (quote.belowFloor && !floorOk)}
              onClick={() => void pushQuote()}
            >
              {busy === "quote" ? "生成中…" : quote.belowFloor && !floorOk ? "低于底线 — 先问老板" : "生成报价短信（带押金链接）"}
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <button type="button" className="btn btn-secondary btn-left" disabled={!!busy || !lead.phone} onClick={() => void pushDepositLink()}>
              {busy === "deposit" ? "生成中…" : "发押金链接"}
            </button>
            <button type="button" className="btn btn-secondary btn-left" disabled={!!busy || !lead.phone} onClick={() => void pushPayLink()}>
              {busy === "pay" ? "生成中…" : "发信用卡收款链接"}
            </button>
            <button type="button" className="btn btn-secondary btn-left" disabled={!!busy || (!lead.phone && !lead.email)} onClick={() => void pushPlannerLink()}>
              {busy === "planner" ? "生成中…" : "发 Planner 链接"}
            </button>
            <button type="button" className="btn btn-primary btn-left" disabled={!!busy || lead.status === "won"} onClick={() => onDeposit(lead)}>
              押金已付 → 转入订单
            </button>
          </div>
          <div style={{ fontSize: 12, color: "var(--color-neutral-600)", marginTop: -8 }}>链接先落到左边的输入框，看一眼再发。转入后线索从线索页消失，对话和承诺跟着进订单；看板仍按线索统计。</div>

          <div>
            <Kicker>备注</Kicker>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="input" placeholder="内部备注（[occasion] / [why] 也记这里）" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && noteDraft.trim() && void patch({ action: "add_note", note: noteDraft.trim() }, "note").then(() => setNoteDraft(""))} />
              <button type="button" className="btn btn-secondary" disabled={!noteDraft.trim() || !!busy} onClick={() => void patch({ action: "add_note", note: noteDraft.trim() }, "note").then(() => setNoteDraft(""))}>
                记下
              </button>
            </div>
          </div>

          <details>
            <summary>操作历史（{events?.length ?? "…"}）</summary>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", fontSize: 12.5 }}>
              {(events ?? []).map((e, i) => {
                const p = e.raw_payload_json ?? {}
                const detail = typeof p.note === "string" ? p.note : typeof p.body === "string" ? p.body : typeof p.message === "string" ? p.message : typeof p.status === "string" && e.touchpoint_type === "agent_status_change" ? `→ ${LEAD_STATUS_LABELS[p.status] ?? p.status}` : ""
                return (
                  <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid var(--color-line)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <strong>{EVENT_LABELS[e.touchpoint_type] ?? e.touchpoint_type}</strong>
                      <span style={{ color: "var(--color-neutral-600)", whiteSpace: "nowrap" }}>{stamp(e.occurred_at)}</span>
                    </div>
                    {detail ? <div style={{ color: "var(--color-neutral-700)", whiteSpace: "pre-wrap" }}>{String(detail).slice(0, 400)}</div> : null}
                  </div>
                )
              })}
            </div>
          </details>
        </div>
      </div>
    </Dialog>
  )
}
