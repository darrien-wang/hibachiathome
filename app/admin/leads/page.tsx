"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

type LeadRow = {
  id: string
  created_at: string
  full_name: string
  phone: string | null
  email: string | null
  status: string
  lead_source: string
  lead_channel: string
  lead_type: string
  city_or_zip: string | null
  guest_count: number | null
  latest_message: string | null
  utm_source: string | null
  utm_campaign: string | null
  utm_term: string | null
  gclid: string | null
  referral_code: string | null
  hear_about_us: string | null
  first_response_at: string | null
  response_seconds: number | null
}

type Stats = {
  today_leads: number
  open_leads: number
  avg_response_minutes_7d: number | null
  within_5min_rate_7d: number | null
  responded_count_7d: number
  leads_7d: number
}

type HistoryEvent = { touchpoint_type: string; occurred_at: string; raw_payload_json: Record<string, unknown> }

const STATUS_LABELS: Record<string, string> = {
  new: "待联系",
  qualified: "跟进中",
  won: "已成单",
  lost: "流失",
  disqualified: "无效",
}

const STATUS_COLORS: Record<string, string> = {
  new: "#dc2626",
  qualified: "#d97706",
  won: "#16a34a",
  lost: "#6b7280",
  disqualified: "#9ca3af",
}

const EVENT_LABELS: Record<string, string> = {
  agent_first_response: "✓ 首次联系",
  agent_status_change: "状态变更",
  agent_edit: "✏️ 资料修改",
  agent_note: "📝 备注",
  manual_entry: "手动录入",
  contact_form: "表单提交",
  booking_request: "报价提交",
  booking_created: "网站下单",
  sms_inbound: "收到短信",
  call_inbound: "来电",
}

function playBeep(times: number) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.35)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.35 + 0.25)
      osc.start(ctx.currentTime + i * 0.35)
      osc.stop(ctx.currentTime + i * 0.35 + 0.3)
    }
  } catch {}
}

// Custom follow-up reminders (per lead, this device): the anti-nag system.
// Set "remind me at X to do Y", the workbench beeps at X, and sending any
// script clears it - so leads get exactly one touch per beat, never spam.
type Reminder = { at: number; label: string }
function getReminder(leadId: string): Reminder | null {
  try {
    const raw = localStorage.getItem(`remind_${leadId}`)
    if (!raw) return null
    const r = JSON.parse(raw) as Reminder
    return Number.isFinite(r.at) ? r : null
  } catch {
    return null
  }
}
function setReminderStore(leadId: string, r: Reminder) {
  try {
    localStorage.setItem(`remind_${leadId}`, JSON.stringify(r))
  } catch {}
}
function clearReminderStore(leadId: string) {
  try {
    localStorage.removeItem(`remind_${leadId}`)
  } catch {}
}
function fmtReminderTime(at: number): string {
  const d = new Date(at)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const tomorrow = new Date(today.getTime() + 86400000)
  const isTomorrow = d.toDateString() === tomorrow.toDateString()
  const hm = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`
  return sameDay ? `今天 ${hm}` : isTomorrow ? `明天 ${hm}` : `${d.getMonth() + 1}/${d.getDate()} ${hm}`
}

// 45-minute follow-up timer: counts from the first response. Returns null when
// the step no longer applies (not in follow-up, no response yet, or already
// sent on this device — localStorage keeps the list badge quiet cross-poll).
const F45_MS = 45 * 60 * 1000
function f45State(l: { id: string; status: string; first_response_at: string | null }, now: number) {
  if (l.status !== "new" && l.status !== "qualified") return null
  if (!l.first_response_at) return null
  try {
    if (localStorage.getItem(`sop_sent_${l.id}_f45`)) return null
  } catch {}
  const due = new Date(l.first_response_at).getTime() + F45_MS
  return { due, remaining: due - now }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "刚刚"
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

function responseBadge(seconds: number | null): { text: string; color: string } {
  if (seconds === null) return { text: "未响应", color: "#dc2626" }
  const min = seconds / 60
  if (min <= 5) return { text: `${Math.round(min)} 分钟 ⚡`, color: "#16a34a" }
  if (min <= 60) return { text: `${Math.round(min)} 分钟`, color: "#d97706" }
  return { text: `${Math.round(min / 60)} 小时`, color: "#dc2626" }
}

function Modal({ onClose, children, title }: { onClose: () => void; children: React.ReactNode; title: string }) {
  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 500, maxHeight: "85vh", overflowY: "auto", padding: "16px 18px", boxShadow: "0 20px 50px rgba(0,0,0,0.3)" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <strong style={{ fontSize: 16 }}>{title}</strong>
          <button onClick={onClose} style={{ border: "none", background: "#f3f4f6", borderRadius: 8, width: 30, height: 30, fontSize: 15, cursor: "pointer" }}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = { padding: "9px 11px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, width: "100%", boxSizing: "border-box" }
const sectionLabel: React.CSSProperties = { fontSize: 12, color: "#6b7280", margin: "14px 0 6px", fontWeight: 600 }

export default function LeadsDashboard() {
  const [adminKey, setAdminKey] = useState<string>("")
  const [keyInput, setKeyInput] = useState("")
  const [authFailed, setAuthFailed] = useState(false)
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [viewerRole, setViewerRole] = useState<string>("agent")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ name: "", phone: "", channel: "phone", message: "" })
  const [adding, setAdding] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [historyEvents, setHistoryEvents] = useState<HistoryEvent[]>([])
  const [editForm, setEditForm] = useState({ full_name: "", phone: "", email: "" })
  const [noteDraft, setNoteDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [expandedMsgIds, setExpandedMsgIds] = useState<Set<string>>(new Set())
  const prevNewestRef = useRef<string>("")

  useEffect(() => {
    try {
      // ?key=... in the URL signs in directly (and is then scrubbed from the URL).
      const params = new URLSearchParams(window.location.search)
      const fromUrl = params.get("key")?.trim()
      if (fromUrl) {
        window.localStorage.setItem("rh_admin_key", fromUrl)
        window.history.replaceState(null, "", window.location.pathname)
        setAdminKey(fromUrl)
        return
      }
      const saved = window.localStorage.getItem("rh_admin_key")
      if (saved) setAdminKey(saved)
    } catch {}
  }, [])

  const fetchLeads = useCallback(async () => {
    if (!adminKey) return
    setLoading(true)
    try {
      const res = await fetch("/api/admin/leads?limit=200", {
        headers: { "x-admin-key": adminKey },
        cache: "no-store",
      })
      if (res.status === 401) {
        setAuthFailed(true)
        setAdminKey("")
        try {
          window.localStorage.removeItem("rh_admin_key")
        } catch {}
        return
      }
      const data = await res.json()
      const rows: LeadRow[] = data.leads ?? []
      if (rows.length > 0 && prevNewestRef.current && rows[0].id !== prevNewestRef.current) {
        document.title = "🔔 新询盘! - Real Hibachi 工作台"
        // Loud alert: a silent title change cost 15 minutes on the first real
        // lead. Beep three times and fire a browser notification.
        playBeep(3)
        try {
          if (Notification.permission === "granted") {
            const l = rows[0]
            new Notification("🔔 新询盘 — Real Hibachi", {
              body: `${l.full_name || l.phone || "未知"} · ${l.lead_channel || ""} · ${(l.latest_message || "").slice(0, 90)}`,
            })
          }
        } catch {}
      }
      if (rows.length > 0) prevNewestRef.current = rows[0].id
      setLeads(rows)
      setStats(data.stats ?? null)
      if (data.viewer?.role) setViewerRole(data.viewer.role)
      setAuthFailed(false)
    } catch {
      // network hiccup; next poll retries
    } finally {
      setLoading(false)
    }
  }, [adminKey])

  useEffect(() => {
    if (!adminKey) return
    fetchLeads()
    // Ask once for notification permission so new-lead alerts can reach the
    // owner even when this tab is in the background.
    try {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission()
      }
    } catch {}
    const t = setInterval(fetchLeads, 30000)
    return () => clearInterval(t)
  }, [adminKey, fetchLeads])

  // Ticking clock: seconds precision while a detail modal is open (live
  // countdown), 15s otherwise (list badges). Also fires the one-time
  // "45-minute follow-up due" beep per lead.
  const [clock, setClock] = useState(() => Date.now())
  const f45AlertedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), detailId ? 1000 : 15000)
    return () => clearInterval(t)
  }, [detailId])
  const reminderAlertedRef = useRef<Set<string>>(new Set())
  const [reminderTick, setReminderTick] = useState(0)
  useEffect(() => {
    for (const l of leads) {
      const st = f45State(l, clock)
      if (st && st.remaining <= 0 && !f45AlertedRef.current.has(l.id)) {
        f45AlertedRef.current.add(l.id)
        playBeep(2)
        try {
          if (Notification.permission === "granted") {
            new Notification("⏰ 45 分钟跟进到点", {
              body: `${l.full_name || l.phone || "线索"} — 该发选择题+档期稀缺那条了`,
            })
          }
        } catch {}
      }
      const rem = getReminder(l.id)
      if (rem && rem.at <= clock && !reminderAlertedRef.current.has(l.id)) {
        reminderAlertedRef.current.add(l.id)
        playBeep(2)
        try {
          if (Notification.permission === "granted") {
            new Notification("⏰ 跟进提醒到点", {
              body: `${l.full_name || l.phone || "线索"} — ${rem.label}`,
            })
          }
        } catch {}
      }
    }
  }, [clock, leads])

  const act = useCallback(
    async (leadId: string, payload: Record<string, unknown>) => {
      setSaving(true)
      try {
        await fetch("/api/admin/leads", {
          method: "PATCH",
          headers: { "content-type": "application/json", "x-admin-key": adminKey },
          body: JSON.stringify({ leadId, ...payload }),
        })
        await fetchLeads()
      } finally {
        setSaving(false)
      }
    },
    [adminKey, fetchLeads]
  )

  const loadHistory = useCallback(
    async (leadId: string) => {
      setHistoryEvents([])
      const res = await fetch(`/api/admin/leads?detail=${leadId}`, {
        headers: { "x-admin-key": adminKey },
        cache: "no-store",
      })
      const data = await res.json()
      setHistoryEvents(data.events ?? [])
    },
    [adminKey]
  )

  const openDetail = useCallback(
    (l: LeadRow) => {
      setDetailId(l.id)
      setEditForm({ full_name: l.full_name ?? "", phone: l.phone ?? "", email: l.email ?? "" })
      setNoteDraft("")
      loadHistory(l.id)
    },
    [loadHistory]
  )

  // "全部" hides disqualified (junk/test) leads; they live under their own tab.
  const visible = useMemo(
    () =>
      statusFilter === "all"
        ? leads.filter((l) => l.status !== "disqualified")
        : leads.filter((l) => l.status === statusFilter),
    [leads, statusFilter]
  )
  const detailLead = useMemo(() => leads.find((l) => l.id === detailId) ?? null, [leads, detailId])

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const openInvoice = useCallback((l: LeadRow) => {
    const base = process.env.NEXT_PUBLIC_INVOICE_SELF_SERVICE_BASE_URL || "https://invoice.realhibachi.com"
    const params = new URLSearchParams()
    if (l.phone) params.set("phone", l.phone.replace(/\D/g, ""))
    if (l.email) params.set("email", l.email)
    window.open(`${base}/?${params.toString()}`, "_blank", "noopener")
  }, [])

  const setLeadReminder = useCallback(
    async (l: LeadRow) => {
      const hoursRaw = window.prompt(
        "多少小时后提醒？（例：0.5 = 半小时，3 = 今晚，18 ≈ 明天下午）",
        "18"
      )
      if (!hoursRaw) return
      const hours = Number(hoursRaw.replace(/[^0-9.]/g, ""))
      if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 14) {
        window.alert("小时数无效")
        return
      }
      const label = window.prompt("提醒内容（到点显示什么）：", "发 planner 拉回消息") || "跟进"
      const at = Date.now() + hours * 3600000
      setReminderStore(l.id, { at, label })
      reminderAlertedRef.current.delete(l.id)
      setReminderTick((t) => t + 1)
      await act(l.id, { action: "add_note", note: `⏰ 已设跟进提醒：${fmtReminderTime(at)} — ${label}` })
      loadHistory(l.id)
    },
    [act, loadHistory]
  )

  const clearLeadReminder = useCallback((l: LeadRow) => {
    clearReminderStore(l.id)
    reminderAlertedRef.current.delete(l.id)
    setReminderTick((t) => t + 1)
  }, [])

  const sendReviewInvite = useCallback((l: LeadRow) => {
    const reviewUrl = process.env.NEXT_PUBLIC_GBP_REVIEW_URL || "https://g.page/r/REVIEW_LINK"
    const firstName = (l.full_name || "").split(" ")[0]
    const text = `Hi${firstName ? " " + firstName : ""}! Thanks for having Real Hibachi at your party - hope everyone loved the show! If you have 30 seconds, a Google review would mean the world to our small team: ${reviewUrl}`
    try {
      navigator.clipboard.writeText(text)
    } catch {}
    window.location.href = `sms:${l.phone}?&body=${encodeURIComponent(text)}`
  }, [])

  // 从留言里提取活动日期。兼容三种写法：
  // "Date: 2026-09-19" / "Event 2026-09-19"（SMS quote 渠道）/ 兜底取第一个 ISO 日期。
  const extractEventDate = (msg: string): string | undefined =>
    msg.match(/(?:Event )?Date:\s*(\d{4}-\d{2}-\d{2})/i)?.[1] ||
    msg.match(/Event\s+(\d{4}-\d{2}-\d{2})/i)?.[1] ||
    msg.match(/(\d{4}-\d{2}-\d{2})/)?.[1]

  // 生成带预填参数的订金链接（source=workbench 走 /deposit/pay 预填模式）。
  // 客人付完后 Stripe webhook 自动：booking 置 confirmed + 发确认邮件/短信，无需人工。
  // 需要留言里能解析出日期；解析不出返回 null，话术退回"要不要我发链接"的问法。
  const buildDepositLink = (l: LeadRow): string | null => {
    const msg = l.latest_message || ""
    const dateRaw = extractEventDate(msg)
    if (!dateRaw) return null
    // lead_id 随订金链接进 Stripe metadata;付款后 webhook 自动把线索
    // 关联到 CRM 建出的订单并标 won,两个工作台靠外键互跳。
    const params = new URLSearchParams({ source: "workbench", event_date: dateRaw, lead_id: l.id })
    const time = msg.match(/Time:\s*(\d{1,2}:\d{2})/i)?.[1]
    if (time) params.set("event_time", time)
    const zip = l.city_or_zip || msg.match(/(?:Location|ZIP):?\s*(\d{5})/i)?.[1]
    if (zip) params.set("location", zip)
    const adults = Number(msg.match(/(\d+)\s*adults/i)?.[1])
    if (Number.isFinite(adults) && adults > 0) params.set("adults", String(adults))
    const kids = Number(msg.match(/(\d+)\s*kids/i)?.[1])
    if (Number.isFinite(kids)) params.set("kids", String(kids))
    const est = msg.match(/Est(?:imated)?(?:\s+(?:Range|Total))?[:\s]+\$?([\d,]+)(?:\s*-\s*\$?([\d,]+))?/i)
    if (est?.[1]) {
      params.set("estimate_low", est[1].replace(/,/g, ""))
      params.set("estimate_high", (est[2] ?? est[1]).replace(/,/g, ""))
    }
    if (l.full_name) params.set("customer_name", l.full_name)
    if (l.email) params.set("customer_email", l.email)
    return `https://www.realhibachi.com/deposit/pay?${params.toString()}`
  }

  // 首响话术：从线索字段自动拼（名字/日期/人数/金额/邮编），确认档期+推订金。
  // 一键复制+拉起短信+自动标记已联系。发前先确认自己档期真的 OK。
  const buildFirstResponse = (l: LeadRow): string => {
    const first = (l.full_name || "").split(" ")[0]
    const hi = first && !/^\d+$/.test(first) ? ` ${first}` : ""
    const msg = l.latest_message || ""
    const dateRaw = extractEventDate(msg)
    const timeRaw = msg.match(/(?:Event )?Time:\s*(\d{1,2}):(\d{2})/i)
    const guests = l.guest_count || Number(msg.match(/(\d+)\s*adults/i)?.[1]) || null
    const amt = msg.match(/Estimated (?:Range|total):\s*\$?([\d,]+)/i)?.[1]
    const zip = l.city_or_zip || msg.match(/Location:\s*([\w ]{3,20})/i)?.[1]?.trim()
    const depositLink = buildDepositLink(l)

    let prettyDate = ""
    if (dateRaw) {
      const [y, m, d] = dateRaw.split("-").map(Number)
      const dt = new Date(y, m - 1, d)
      if (!Number.isNaN(dt.getTime())) {
        prettyDate = dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
      }
    }
    let prettyTime = ""
    if (timeRaw) {
      const h = Number(timeRaw[1])
      const mm = timeRaw[2]
      const ampm = h >= 12 ? "pm" : "am"
      const h12 = h % 12 || 12
      prettyTime = mm === "00" ? `${h12}${ampm}` : `${h12}:${mm}${ampm}`
    }

    if (prettyDate) {
      return (
        `Hi${hi}! This is Bling from Real Hibachi — got your request for ${prettyDate}` +
        (prettyTime ? ` at ${prettyTime}` : "") +
        (zip ? ` in ${zip}` : "") +
        (guests ? `, ${guests} guests` : "") +
        `. Good news: that date is available! 🎉 ` +
        (amt ? `Your total is $${amt} as quoted — food, live chef show, setup, and travel all included. ` : "") +
        (depositLink
          ? `A $19.90 deposit locks your date and chef — lock it in here: ${depositLink}`
          : `A $19.90 deposit locks your date and chef — want me to send the link?`)
      )
    }
    return `Hi${hi}! This is Bling from Real Hibachi — thanks for reaching out! I'd love to help with your hibachi party. What date are you thinking? 😊`
  }

  const sendFirstResponse = useCallback(
    async (l: LeadRow) => {
      const text = buildFirstResponse(l)
      try {
        navigator.clipboard.writeText(text)
      } catch {}
      if (l.phone) window.location.href = `sms:${l.phone}?&body=${encodeURIComponent(text)}`
      await act(l.id, { action: "mark_contacted" })
      await act(l.id, { action: "add_note", note: "[SOP:first_response] 首响话术已发送" })
      loadHistory(l.id)
    },
    [act, loadHistory]
  )

  // UGC 邀请：派对结束次日发，鼓励客人晒图 tag——真实用户内容一条顶软广一百条。
  const sendUgcInvite = useCallback((l: LeadRow) => {
    const firstName = (l.full_name || "").split(" ")[0]
    const text = `Hi${firstName ? " " + firstName : ""}! Hope everyone loved the show 🔥 If you caught any fun photos or videos at the party, we'd love to see them - tag us @realhibachi on Instagram or just text them here. Our favorites get featured (with your OK, of course)!`
    try {
      navigator.clipboard.writeText(text)
    } catch {}
    if (l.phone) window.location.href = `sms:${l.phone}?&body=${encodeURIComponent(text)}`
  }, [])

  // ---- 线索生命周期 SOP ----
  // 每个阶段的标准动作，一键发送并自动在时间线记录 [SOP:id]，
  // checklist 据此打勾。话术原则：每条都"给东西"，不做干催。
  // build 的 plannerLink：sendSop 发送前实时 mint 的专属 planner 链接
  // （带客户身份，自动接回其历史会话）；mint 失败时为 undefined，回退通用域名。
  type SopStep = { id: string; stage: "followup" | "won"; emoji: string; title: string; when: string; build?: (l: LeadRow, plannerLink?: string) => string }
  const SOP_STEPS: SopStep[] = [
    {
      // 话术原则：具体可用性 > 泛泛稀缺（"周末先到先得"像催单，"周六还开着"像服务）；
      // hold 必须带期限才可信，到期还能名正言顺再跟进一次；
      // "finalize headcount" 给对方体面的犹豫理由，顺便引导报人数（20+ 触发前菜促销）。
      id: "f45", stage: "followup", emoji: "⏰", title: "45分钟跟进：确定性+选择题+限时hold", when: "首响后 45-60 分钟客户没回",
      build: (l) => {
        const dateRaw = extractEventDate(l.latest_message || "")
        if (dateRaw) {
          const [y, m, d] = dateRaw.split("-").map(Number)
          const dt = new Date(y, m - 1, d)
          if (!Number.isNaN(dt.getTime())) {
            const prettyDate = dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
            return `Good news — ${prettyDate} is open on our end. Dinner parties usually kick off at 7:00 or 7:30. I can pencil you in for either and hold it until tomorrow evening while you finalize headcount — which time works better?`
          }
        }
        return "Happy to get you set up! Which date are you looking at? Most dinner parties start at 7:00 or 7:30. Weekends do fill up first, so once you have a date I can hold a slot for 24 hours while you sort out details — no commitment needed."
      },
    },
    {
      id: "f_night", stage: "followup", emoji: "🌙", title: "当晚软锁定：免订金占位", when: "当晚睡前仍未回",
      build: () => "No rush at all! I'll pencil your date in for now — no deposit needed until you confirm. Just don't want you to lose it while you're deciding 🙌",
    },
    {
      id: "f_planner", stage: "followup", emoji: "🎪", title: "次日拉回：发派对组局工具（三合一）", when: "客户在和朋友对时间/人数时——递工具帮他组局，不催单",
      build: (l, plannerLink) => {
        const n = l.guest_count ?? 0
        const hook =
          n >= 20
            ? "And your group already unlocks a FREE appetizer platter (gyoza, edamame & spring rolls, $40 value) — it's on us 🥟"
            : "And heads up: if your group hits 20, a FREE appetizer platter (gyoza, edamame & spring rolls, $40 value) is on us 🥟"
        const intro = plannerLink
          ? `Hi! While you're checking with your group — this might help. I set up a party planner just for you: ${plannerLink} — share it with your friends and everyone grabs a seat & picks their own proteins (takes 2 min each) 🎪`
          : `Hi! While you're checking with your group — this might help: party.realhibachi.com is our party planner. Pick your date, share the link with your friends, and everyone grabs a seat & picks their own proteins (takes 2 min each) 🎪`
        return `${intro}\nYour date is still penciled in — no deposit needed yet. ${hook}`
      },
    },
    {
      id: "f_morning", stage: "followup", emoji: "☀️", title: "次日跟进：亮到场承诺", when: "第二天上午（若组局工具那条已发，这条隔天再用）",
      build: (l) => {
        const link = buildDepositLink(l)
        return (
          `Morning! Still holding your date for your party${l.guest_count ? ` of ${l.guest_count}` : ""}. Your chef is confirmed by name 48h before the event — and if we ever cancel, double your deposit back. ` +
          (link ? `Lock it in with the $19.90 deposit here: ${link}` : `Want me to lock it in?`)
        )
      },
    },
    {
      id: "f_promo", stage: "followup", emoji: "🥟", title: "第3天促销复活钩", when: "3 天无回应（最后一发，之后停）",
      build: (l) => {
        const n = l.guest_count ?? 0
        return n >= 15 && n < 20
          ? `One more thing — parties of 20+ get a FREE appetizer platter (gyoza, edamame & spring rolls, $40 value). You're at ${n}, just ${20 - n} more guests and it's on us! Want me to update your quote?`
          : "Hi again! Your date is still open on our calendar. Anything I can answer about the menu, setup, or pricing? Happy to help you lock it in 😊"
      },
    },
    {
      id: "w_planner", stage: "won", emoji: "🎪", title: "发派对布置工具（专属链接）", when: "订金确认后立刻发（Stripe/Venmo/Zelle 都算）",
      build: (_l, plannerLink) =>
        plannerLink
          ? `You're booked 🎉 Here's your personal party planner: ${plannerLink} — your party's already linked to it. Set up your tables and share the same link with your guests so everyone picks their own proteins. Takes 2 minutes and makes party day seamless!`
          : "You're booked 🎉 Here's your party planner: party.realhibachi.com — set up your tables and share the link with your guests so everyone picks their own proteins. Takes 2 minutes and makes party day seamless!",
    },
    {
      id: "w_confirm48", stage: "won", emoji: "✅", title: "48小时厨师实名确认（承诺兑现！）", when: "开席前 48 小时，广告承诺过的，必发",
      build: () => "Hi! Confirming your hibachi party in 48 hours 🎊 Your chef is Bling, arriving about 10 minutes before start time with the grill and fresh ingredients. Reply to confirm you're all set — see you soon!",
    },
    { id: "w_review", stage: "won", emoji: "⭐", title: "派对次日：邀评", when: "办完派对第二天" },
    { id: "w_ugc", stage: "won", emoji: "📸", title: "派对次日：晒图邀请", when: "邀评后接着发" },
  ]

  const doneSopIds = useMemo(() => {
    const done = new Set<string>()
    for (const ev of historyEvents) {
      const note = typeof ev.raw_payload_json?.note === "string" ? (ev.raw_payload_json.note as string) : ""
      const m = note.match(/^\[SOP:([\w-]+)\]/)
      if (m) done.add(m[1])
    }
    return done
  }, [historyEvents])

  const sendSop = useCallback(
    async (l: LeadRow, step: SopStep) => {
      if (step.id === "w_review") sendReviewInvite(l)
      else if (step.id === "w_ugc") sendUgcInvite(l)
      else if (step.build) {
        // planner 两步：发送前实时 mint 专属链接。key 带客户 email+phone，
        // planner 端锚点注册表会自动接回其历史会话（之前用邮箱或手机号
        // 试过都能对上，全新客户则从零建）。won 阶段带 booked 标——订金
        // 无论 Stripe/Venmo/Zelle 都算已确认，客户端不再显示未付警示。
        let plannerLink: string | undefined
        if (step.id === "f_planner" || step.id === "w_planner") {
          if (l.email || l.phone) {
            try {
              const res = await fetch("/api/admin/planner-link", {
                method: "POST",
                headers: { "x-admin-key": adminKey, "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: l.email || undefined,
                  phone: l.phone || undefined,
                  booked: step.stage === "won",
                }),
              })
              const d = await res.json()
              if (d.ok && typeof d.url === "string") plannerLink = d.url
            } catch {}
          }
          if (!plannerLink && !window.confirm("专属链接生成失败，将发送通用链接 party.realhibachi.com（不带客户身份）。继续？")) {
            return
          }
        }
        const text = step.build(l, plannerLink)
        try {
          navigator.clipboard.writeText(text)
        } catch {}
        if (l.phone) window.location.href = `sms:${l.phone}?&body=${encodeURIComponent(text)}`
      }
      try {
        localStorage.setItem(`sop_sent_${l.id}_${step.id}`, "1")
      } catch {}
      clearReminderStore(l.id)
      await act(l.id, { action: "add_note", note: `[SOP:${step.id}] ${step.title} 已发送` })
      loadHistory(l.id)
    },
    [act, loadHistory, sendReviewInvite, sendUgcInvite, adminKey]
  )

  // 💳 信用卡收尾款：先从发票系统拉客户最新 Balance Due（小费档/订金/卡费
  // 全部实时联动，唯一真源），确认明细后生成 Stripe 链接。查不到发票才回退
  // 手输（并警示核对）。多收少收都不行——金额永远来自最新发票。
  const sendPayLink = useCallback(
    async (l: LeadRow) => {
      const mint = async (payload: Record<string, unknown>) => {
        const res = await fetch("/api/admin/pay-link", {
          method: "POST",
          headers: { "x-admin-key": adminKey, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        return res.json()
      }
      try {
        let amount: number
        let amountIsFinal = false
        let smsDetail = ""
        const q = await mint({ action: "quote", phone: l.phone || undefined, email: l.email || undefined })
        if (q.ok && q.found && Number.isFinite(Number(q.balanceDue)) && Number(q.balanceDue) > 0) {
          const grat = q.gratuityRate ? `${Math.round(q.gratuityRate * 100)}% 小费 $${Number(q.selectedGratuity).toFixed(2)}` : "未选小费档"
          const cardLine =
            q.paymentMethod === "credit_card"
              ? `发票已按信用卡计（含 4% 卡费 $${Number(q.creditCardFee).toFixed(2)}），链接金额不再加费`
              : `发票按现金计 → 刷卡需 +4%（$${(Number(q.balanceDue) * 0.04).toFixed(2)}）`
          const cardTotal =
            q.paymentMethod === "credit_card"
              ? Number(q.balanceDue)
              : Math.round(Number(q.balanceDue) * 1.04 * 100) / 100
          const okGo = window.confirm(
            `📄 已联动最新发票（${q.clientName || "客户"} · ${q.eventDate || "日期未填"} · ${q.guests} 人）\n\n` +
              `发票总额: $${Number(q.finalTotal).toFixed(2)}\n小费档: ${grat}\n已付订金: -$${Number(q.deposit).toFixed(2)}\n` +
              `Balance Due: $${Number(q.balanceDue).toFixed(2)}\n${cardLine}\n\n` +
              `➡️ 信用卡链接金额: $${cardTotal.toFixed(2)}\n\n确认生成？（发票有改动请先在发票系统更新再来）`
          )
          if (!okGo) return
          amount = cardTotal
          amountIsFinal = true
          smsDetail =
            q.paymentMethod === "credit_card"
              ? `per your invoice (incl. ${q.gratuityRate ? Math.round(q.gratuityRate * 100) + "% gratuity and " : ""}card fee, deposit deducted)`
              : `= balance $${Number(q.balanceDue).toFixed(2)} + 4% card processing${q.gratuityRate ? `, incl. ${Math.round(q.gratuityRate * 100)}% gratuity` : ""}`
        } else {
          const raw = window.prompt(
            "⚠️ 没有查到该客户的发票（或余额为 0）——请先核对！\n手动输入要收的最终金额（系统会自动 +4% 卡费）：",
            ""
          )
          if (!raw) return
          const manual = Number(raw.replace(/[^0-9.]/g, ""))
          if (!Number.isFinite(manual) || manual < 1) {
            window.alert("金额无效")
            return
          }
          amount = manual
          amountIsFinal = false
          smsDetail = `$${manual.toFixed(2)} + 4% card processing`
        }
        const data = await mint({ amount, amountIsFinal, customerName: l.full_name || undefined })
        if (!data.ok) throw new Error(data.error || "failed")
        const firstName = (l.full_name || "").split(" ")[0]
        const text = `Hi${firstName ? " " + firstName : ""}! Here's your secure card payment link for your balance: $${data.total.toFixed(2)} ${smsDetail}\n${data.url}\n(Cash, Venmo or Zelle skip the card fee — just let me know!)`
        try {
          navigator.clipboard.writeText(text)
        } catch {}
        await act(l.id, { action: "add_note", note: `💳 已生成尾款链接 $${data.total.toFixed(2)}（${amountIsFinal ? "发票联动" : "手动输入"}）` })
        loadHistory(l.id)
        if (l.phone) window.location.href = `sms:${l.phone}?&body=${encodeURIComponent(text)}`
      } catch (e) {
        window.alert("生成失败: " + e)
      }
    },
    [adminKey, act, loadHistory]
  )

  // ✉️ 邮件跟进：短信不回时的第二通道。工作台内正式预览（可编辑）后由
  // 服务端从 support@realhibachi.com 直发（Resend）——绝不走个人邮箱。
  const [emailDraft, setEmailDraft] = useState<{ leadId: string; to: string; subject: string; body: string } | null>(null)
  const [emailSending, setEmailSending] = useState(false)

  const sendEmailFollowup = useCallback((l: LeadRow) => {
    if (!l.email) return
    const firstName = (l.full_name || "").split(" ")[0]
    // Same prefilled /deposit/pay link the SMS scripts use (parsed from the
    // lead, full auto-confirm webhook flow) - one link, one pipeline, no
    // channel drift. Falls back to the generic page if no date is parsable.
    const depositUrl = buildDepositLink(l) ?? "https://www.realhibachi.com/deposit"
    setEmailDraft({
      leadId: l.id,
      to: l.email,
      subject: "Your Real Hibachi date is held \u{1F389}",
      body: `Hi${firstName ? " " + firstName : ""},\n\nYour booking request is saved and your date is held for you. Lock it in any time with the $19.90 deposit (fully counted toward your total) - this link takes you straight to secure checkout:\n${depositUrl}\n\nOur promises, in writing: your chef is confirmed by name 48 hours before the event - and if we ever cancel, you get double your deposit back.\n\nQuestions? Just reply to this email or text 213-770-7788 - happy to help!\n\nBling\nReal Hibachi · www.realhibachi.com`,
    })
  }, [])

  const dispatchEmailDraft = useCallback(async () => {
    if (!emailDraft || emailSending) return
    setEmailSending(true)
    try {
      const res = await fetch("/api/admin/send-followup", {
        method: "POST",
        headers: { "x-admin-key": adminKey, "Content-Type": "application/json" },
        body: JSON.stringify({ to: emailDraft.to, subject: emailDraft.subject, text: emailDraft.body }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || "failed")
      clearReminderStore(emailDraft.leadId)
      await act(emailDraft.leadId, { action: "add_note", note: `✉️ 已从 support@ 发送跟进邮件（${emailDraft.subject}）` })
      loadHistory(emailDraft.leadId)
      setEmailDraft(null)
      window.alert("✅ 已从 support@realhibachi.com 发送")
    } catch (e) {
      window.alert("发送失败: " + e)
    } finally {
      setEmailSending(false)
    }
  }, [emailDraft, emailSending, adminKey, act, loadHistory])

  // 🌐 西语话术包：拉美裔客户"英语搜索、西语沟通"——客户用西语来信时，
  // 从这里一键取对应场景的西语话术（复制+拉起短信+时间线记录）。
  const [esPackFor, setEsPackFor] = useState<LeadRow | null>(null)
  const ES_SCRIPTS: { id: string; title: string; build: (l: LeadRow) => string }[] = [
    {
      id: "es_first", title: "首响：确认档期+推订金",
      build: (l) => {
        const n = (l.full_name || "").split(" ")[0]
        return `¡Hola${n && !/^\d+$/.test(n) ? " " + n : ""}! Soy Bling de Real Hibachi 🔥 Recibimos tu solicitud. ¡Buenas noticias: tenemos tu fecha disponible! Comida, show del chef en vivo, y todo incluido. ¿Te la aparto? Un depósito de $19.90 asegura tu fecha y tu chef — te mando el link.`
      },
    },
    {
      id: "es_followup", title: "跟进：选择题+档期稀缺",
      build: () => "¡Hola! Los fines de semana se llenan rápido. La mayoría de las cenas empiezan a las 6:30 o 7:30 — ¿cuál te funciona mejor? Te aparto el horario mientras decides 😊",
    },
    {
      id: "es_deposit", title: "发订金链接",
      build: (l) => {
        const link = buildDepositLink(l) ?? "https://www.realhibachi.com/deposit"
        return `¡Perfecto! Aquí está tu link para apartar tu fecha con el depósito de $19.90 (se descuenta de tu total): ${link}`
      },
    },
    {
      id: "es_platter", title: "拼盘促销：20+人送前菜",
      build: (l) => {
        const nGuests = l.guest_count ?? 0
        return nGuests >= 15 && nGuests < 20
          ? `¡Oye! Las fiestas de 20+ personas reciben GRATIS una charola de aperitivos (gyoza, edamame y rollitos, valor $40). Estás en ${nGuests} — ¡solo faltan ${20 - nGuests} invitados y va por nuestra cuenta!`
          : "¡Oye! Las fiestas de 20+ personas reciben GRATIS una charola de aperitivos (gyoza, edamame y rollitos, valor $40). ¿Quieres que actualice tu cotización?"
      },
    },
    {
      id: "es_confirm48", title: "48小时厨师确认",
      build: () => "¡Hola! Confirmando tu fiesta hibachi en 48 horas 🎊 Tu chef es Bling, llega unos 10 minutos antes con la parrilla y los ingredientes frescos. Responde para confirmar — ¡nos vemos pronto!",
    },
    {
      id: "es_review", title: "派对后邀评",
      build: (l) => {
        const n = (l.full_name || "").split(" ")[0]
        const reviewUrl = process.env.NEXT_PUBLIC_GBP_REVIEW_URL || "https://g.page/r/REVIEW_LINK"
        return `¡Hola${n && !/^\d+$/.test(n) ? " " + n : ""}! Gracias por invitarnos a tu fiesta — ¡esperamos que a todos les haya encantado el show! Si tienes 30 segundos, una reseña en Google significaría muchísimo para nuestro pequeño equipo: ${reviewUrl}`
      },
    },
  ]

  const sendEsScript = useCallback(
    async (l: LeadRow, s: { id: string; title: string; build: (l: LeadRow) => string }) => {
      const text = s.build(l)
      try {
        navigator.clipboard.writeText(text)
      } catch {}
      clearReminderStore(l.id)
      await act(l.id, { action: "add_note", note: `🌐 西语话术已发送：${s.title}` })
      loadHistory(l.id)
      setEsPackFor(null)
      if (l.phone) window.location.href = `sms:${l.phone}?&body=${encodeURIComponent(text)}`
    },
    [act, loadHistory]
  )

  // 大单前菜促销：常规话术，任何询价犹豫/人数接近 20 时发。
  const sendPromoScript = useCallback((l: LeadRow) => {
    const firstName = (l.full_name || "").split(" ")[0]
    const text = `Hi${firstName ? " " + firstName : ""}! Quick heads up - parties of 20+ guests currently get a FREE appetizer platter (gyoza, edamame & spring rolls, $40 value) on us. If your group can get to 20, the platter is included. Want me to lock in your date?`
    try {
      navigator.clipboard.writeText(text)
    } catch {}
    if (l.phone) window.location.href = `sms:${l.phone}?&body=${encodeURIComponent(text)}`
  }, [])

  // 关单让步：仅在比价僵持的大单上用，别主动群发。
  const sendCloserScript = useCallback((l: LeadRow) => {
    const firstName = (l.full_name || "").split(" ")[0]
    const text = `Hi${firstName ? " " + firstName : ""}, here is the best I can do for your party: on top of the free appetizer platter, I'll take $100 off tables & chairs for your group. That is our top large-party deal - ready to grab your date before the slot goes?`
    try {
      navigator.clipboard.writeText(text)
    } catch {}
    if (l.phone) window.location.href = `sms:${l.phone}?&body=${encodeURIComponent(text)}`
  }, [])

  if (!adminKey) {
    return (
      <div style={{ maxWidth: 360, margin: "120px auto", fontFamily: "system-ui, sans-serif", padding: 16 }}>
        <h1 style={{ fontSize: 20, marginBottom: 12 }}>Real Hibachi 线索工作台</h1>
        {authFailed && <p style={{ color: "#dc2626", fontSize: 14 }}>密钥不对，再试一次。</p>}
        <input
          type="password"
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && keyInput.trim()) {
              try {
                window.localStorage.setItem("rh_admin_key", keyInput.trim())
              } catch {}
              setAdminKey(keyInput.trim())
            }
          }}
          placeholder="输入管理密钥后回车"
          style={{ width: "100%", padding: "10px 12px", fontSize: 15, border: "1px solid #d1d5db", borderRadius: 8 }}
        />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 16px 90px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ fontSize: 22 }}>线索工作台</h1>
        <span style={{ fontSize: 12, color: "#6b7280" }}>{loading ? "刷新中…" : "每 30 秒自动刷新"}</span>
      </div>

      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, margin: "16px 0 20px" }}>
          {[
            { label: "今日询盘", value: String(stats.today_leads), color: "#111827" },
            { label: "待处理", value: String(stats.open_leads), color: stats.open_leads > 0 ? "#dc2626" : "#16a34a" },
            {
              label: "7天平均首响",
              value: stats.avg_response_minutes_7d === null ? "—" : `${stats.avg_response_minutes_7d} 分钟`,
              color: (stats.avg_response_minutes_7d ?? 0) <= 5 ? "#16a34a" : "#d97706",
            },
            {
              label: "5分钟内响应率",
              value: stats.within_5min_rate_7d === null ? "—" : `${stats.within_5min_rate_7d}%`,
              color: (stats.within_5min_rate_7d ?? 0) >= 70 ? "#16a34a" : "#dc2626",
            },
          ].map((c) => (
            <div key={c.label} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 12, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {["all", "new", "qualified", "won", "lost", "disqualified"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: "5px 12px",
              borderRadius: 999,
              fontSize: 13,
              border: "1px solid " + (statusFilter === s ? "#111827" : "#d1d5db"),
              background: statusFilter === s ? "#111827" : "#fff",
              color: statusFilter === s ? "#fff" : "#374151",
              cursor: "pointer",
            }}
          >
            {s === "all" ? "全部" : STATUS_LABELS[s]}
          </button>
        ))}
        <button
          onClick={() => setShowAdd(true)}
          style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 999, border: "1px dashed #9ca3af", background: "#fff", color: "#374151", fontSize: 13, cursor: "pointer" }}
        >
          ＋ 手动添加
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {visible.map((l) => {
          const badge = responseBadge(l.response_seconds)
          const isAd = l.utm_source === "google" || Boolean(l.gclid)
          const isSelected = selected.has(l.id)
          return (
            <div
              key={l.id}
              onClick={() => (viewerRole === "owner" ? toggleSelect(l.id) : openDetail(l))}
              style={{
                background: isSelected ? "#eff6ff" : "#fff",
                border: "1px solid " + (isSelected ? "#2563eb" : "#e5e7eb"),
                borderRadius: 12,
                padding: "14px 16px",
                cursor: "pointer",
                transition: "border-color .1s, background .1s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {viewerRole === "owner" && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(l.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: 16, height: 16, cursor: "pointer" }}
                    />
                  )}
                  <strong style={{ fontSize: 15 }}>{l.full_name || "（未留名）"}</strong>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, color: "#fff", background: STATUS_COLORS[l.status] ?? "#6b7280" }}>
                    {STATUS_LABELS[l.status] ?? l.status}
                  </span>
                  {isAd && (
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>
                      广告{l.utm_term ? ` · ${l.utm_term}` : ""}
                    </span>
                  )}
                  {l.referral_code && (
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#ecfdf5", color: "#047857", border: "1px solid #6ee7b7", fontWeight: 700 }}>
                      🤝 码 {l.referral_code} · 记台账
                    </span>
                  )}
                  {!l.referral_code && l.hear_about_us && ["friend_family", "vendor", "host_planner", "past_party"].includes(l.hear_about_us) && (
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#fef9c3", color: "#854d0e", border: "1px solid #fde047" }}>
                      🤝 转介绍 · 问是谁介绍的
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: "#6b7280" }}>{relativeTime(l.created_at)}</span>
                  {(() => {
                    const rem = getReminder(l.id)
                    if (!rem) return null
                    const overdue = rem.at <= clock
                    return (
                      <span
                        style={{
                          fontSize: 11, padding: "2px 8px", borderRadius: 999, fontWeight: 700,
                          background: overdue ? "#fee2e2" : "#ede9fe",
                          color: overdue ? "#dc2626" : "#6d28d9",
                          border: "1px solid " + (overdue ? "#fca5a5" : "#c4b5fd"),
                        }}
                      >
                        {overdue ? `⏰ 到点: ${rem.label.slice(0, 12)}` : `⏰ ${fmtReminderTime(rem.at)} ${rem.label.slice(0, 10)}`}
                      </span>
                    )
                  })()}
                  {(() => {
                    const st = f45State(l, clock)
                    if (!st) return null
                    const overdue = st.remaining <= 0
                    const mins = Math.max(0, Math.ceil(st.remaining / 60000))
                    return (
                      <span
                        style={{
                          fontSize: 11, padding: "2px 8px", borderRadius: 999, fontWeight: 700,
                          background: overdue ? "#fee2e2" : "#fef3c7",
                          color: overdue ? "#dc2626" : "#b45309",
                          border: "1px solid " + (overdue ? "#fca5a5" : "#fcd34d"),
                        }}
                      >
                        {overdue ? "⏰ 45min跟进到点!" : `⏰ 45min跟进 剩 ${mins} 分钟`}
                      </span>
                    )
                  })()}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: badge.color }}>首响: {badge.text}</span>
              </div>

              <div style={{ fontSize: 13, color: "#374151", margin: "8px 0", display: "flex", gap: 14, flexWrap: "wrap" }}>
                {l.phone && (
                  <span onClick={(e) => e.stopPropagation()}>
                    📞 <a href={`tel:${l.phone}`}>{l.phone}</a> · <a href={`sms:${l.phone}`}>发短信</a>
                  </span>
                )}
                {l.hear_about_us && <span>👂 {l.hear_about_us}</span>}
                {l.email && <span>✉️ {l.email}</span>}
                {l.city_or_zip && <span>📍 {l.city_or_zip}</span>}
                {l.guest_count !== null && <span>👥 {l.guest_count} 人</span>}
              </div>

              {l.latest_message && (() => {
                const msgExpanded = expandedMsgIds.has(l.id)
                const clampable = l.latest_message.length > 120 || l.latest_message.includes("\n")
                return (
                  <div
                    onClick={(e) => {
                      if (!clampable) return
                      e.stopPropagation()
                      setExpandedMsgIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(l.id)) next.delete(l.id)
                        else next.add(l.id)
                        return next
                      })
                    }}
                    style={{
                      fontSize: 13, color: "#6b7280", background: "#f9fafb", borderRadius: 8, padding: "8px 10px", marginBottom: 10, whiteSpace: "pre-wrap",
                      ...(msgExpanded ? {} : { maxHeight: 72, overflow: "hidden" }),
                      position: "relative",
                      cursor: clampable ? "pointer" : undefined,
                    }}
                    title={clampable ? (msgExpanded ? "点击收起" : "点击展开全文") : undefined}
                  >
                    {l.latest_message}
                    {clampable && !msgExpanded && (
                      <div style={{ position: "absolute", right: 0, bottom: 0, left: 0, padding: "16px 10px 4px", textAlign: "right", fontSize: 12, fontWeight: 600, color: "#2563eb", background: "linear-gradient(to bottom, rgba(249,250,251,0), #f9fafb 60%)" }}>
                        展开全文 ▾
                      </div>
                    )}
                    {clampable && msgExpanded && (
                      <div style={{ marginTop: 6, textAlign: "right", fontSize: 12, fontWeight: 600, color: "#2563eb" }}>收起 ▴</div>
                    )}
                  </div>
                )
              })()}

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
                {l.status === "won" ? (
                  <>
                    <a
                      href={`/admin/orders?lead=${l.id}`}
                      style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#111827", color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none" }}
                    >
                      去订单工作台
                    </a>
                    <button
                      onClick={() => openInvoice(l)}
                      style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#0f766e", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                    >
                      📄 添加/修改 Invoice
                    </button>
                  </>
                ) : (
                  l.response_seconds === null && (
                    <button
                      onClick={() => act(l.id, { action: "mark_contacted" })}
                      style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                    >
                      ✓ 已联系
                    </button>
                  )
                )}
                <button
                  onClick={() => openDetail(l)}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", fontSize: 14, color: "#374151", cursor: "pointer" }}
                >
                  ⋯ 操作
                </button>
              </div>
            </div>
          )
        })}
        {visible.length === 0 && !loading && (
          <div style={{ textAlign: "center", color: "#9ca3af", padding: 40 }}>没有符合条件的线索</div>
        )}
      </div>

      {/* ── Bulk action floating bar (owner) ── */}
      {viewerRole === "owner" && selected.size > 0 && (
        <div style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 40, background: "#111827", color: "#fff", borderRadius: 999, padding: "10px 18px", display: "flex", gap: 10, alignItems: "center", boxShadow: "0 10px 30px rgba(0,0,0,0.35)", maxWidth: "calc(100% - 24px)", flexWrap: "wrap", justifyContent: "center" }}>
          <span style={{ fontSize: 13, whiteSpace: "nowrap" }}>已选 {selected.size} 条</span>
          {[
            { s: "disqualified", label: "标无效" },
            { s: "lost", label: "标流失" },
          ].map(({ s, label }) => (
            <button
              key={s}
              onClick={async () => {
                await fetch("/api/admin/leads", {
                  method: "PATCH",
                  headers: { "content-type": "application/json", "x-admin-key": adminKey },
                  body: JSON.stringify({ action: "bulk_status", status: s, leadIds: Array.from(selected) }),
                })
                setSelected(new Set())
                fetchLeads()
              }}
              style={{ padding: "6px 14px", borderRadius: 999, border: "1px solid #6b7280", background: "transparent", color: "#fff", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              {label}
            </button>
          ))}
          <button onClick={() => setSelected(new Set())} style={{ padding: "6px 10px", borderRadius: 999, border: "none", background: "transparent", color: "#9ca3af", fontSize: 13, cursor: "pointer" }}>
            取消
          </button>
        </div>
      )}

      {/* ── Manual add modal ── */}
      {showAdd && (
        <Modal title="手动添加线索" onClose={() => setShowAdd(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input placeholder="姓名" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} style={inputStyle} />
            <input placeholder="电话" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} style={inputStyle} />
            <select value={addForm.channel} onChange={(e) => setAddForm({ ...addForm, channel: e.target.value })} style={inputStyle}>
              <option value="phone">来电</option>
              <option value="sms">短信</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="wechat">微信</option>
              <option value="referral">转介绍</option>
              <option value="other">其他</option>
            </select>
            <input placeholder="需求备注（日期/人数/地区）" value={addForm.message} onChange={(e) => setAddForm({ ...addForm, message: e.target.value })} style={inputStyle} />
            <button
              disabled={adding || (!addForm.name.trim() && !addForm.phone.trim())}
              onClick={async () => {
                setAdding(true)
                try {
                  await fetch("/api/admin/leads", {
                    method: "POST",
                    headers: { "content-type": "application/json", "x-admin-key": adminKey },
                    body: JSON.stringify(addForm),
                  })
                  setAddForm({ name: "", phone: "", channel: addForm.channel, message: "" })
                  setShowAdd(false)
                  fetchLeads()
                } finally {
                  setAdding(false)
                }
              }}
              style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: "#111827", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: adding ? 0.6 : 1 }}
            >
              {adding ? "添加中…" : "添加线索"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Lead detail / actions modal ── */}
      {detailLead && (
        <Modal title={detailLead.full_name || detailLead.phone || "线索详情"} onClose={() => setDetailId(null)}>
          <div style={{ fontSize: 13, color: "#6b7280", display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
            <span>{STATUS_LABELS[detailLead.status]}</span>
            <span>{relativeTime(detailLead.created_at)}</span>
            {detailLead.utm_term && <span style={{ color: "#1d4ed8" }}>广告 · {detailLead.utm_term}</span>}
          </div>

          {detailLead.latest_message && (
            <>
              <div style={sectionLabel}>客户留言</div>
              <div style={{ fontSize: 13, color: "#374151", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 12px", whiteSpace: "pre-wrap", maxHeight: 240, overflowY: "auto" }}>
                {detailLead.latest_message}
              </div>
            </>
          )}

          <div style={sectionLabel}>状态</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.entries(STATUS_LABELS).map(([v, label]) => (
              <button
                key={v}
                disabled={saving}
                onClick={() => act(detailLead.id, { action: "set_status", status: v })}
                style={{
                  padding: "7px 14px",
                  borderRadius: 999,
                  fontSize: 13,
                  cursor: "pointer",
                  border: "1px solid " + (detailLead.status === v ? STATUS_COLORS[v] : "#d1d5db"),
                  background: detailLead.status === v ? STATUS_COLORS[v] : "#fff",
                  color: detailLead.status === v ? "#fff" : "#374151",
                  fontWeight: detailLead.status === v ? 700 : 400,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ---- 生命周期 + 标准操作 ---- */}
          {(() => {
            const stage: "followup" | "won" | null =
              detailLead.status === "new" || detailLead.status === "qualified"
                ? "followup"
                : detailLead.status === "won"
                  ? "won"
                  : null
            const stages = [
              { key: "new", label: "🆕 新询盘" },
              { key: "followup", label: "💬 跟进中" },
              { key: "won", label: "✅ 已订" },
              { key: "post", label: "🎉 派对后" },
            ]
            const activeIdx = detailLead.status === "new" ? 0 : stage === "followup" ? 1 : stage === "won" ? (doneSopIds.has("w_review") || doneSopIds.has("w_ugc") ? 3 : 2) : -1
            // 成单之后的 SOP(布置工具/48h确认/邀评/晒图)已迁入订单工作台——
            // 线索台只管成单之前;won 线索在这里只留一个跳转入口。
            const steps = stage === "followup" ? SOP_STEPS.filter((s) => s.stage === "followup") : []
            const responded = detailLead.response_seconds !== null
            const nextId = !responded && stage === "followup" ? "__respond" : steps.find((s) => !doneSopIds.has(s.id))?.id
            return (
              <div style={{ marginTop: 14, border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 14px", background: "#fafafa" }}>
                <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
                  {stages.map((s, i) => (
                    <span key={s.key} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <span
                        style={{
                          padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: i === activeIdx ? 700 : 400,
                          background: i === activeIdx ? "#0f766e" : i < activeIdx ? "#d1fae5" : "#f3f4f6",
                          color: i === activeIdx ? "#fff" : i < activeIdx ? "#047857" : "#9ca3af",
                        }}
                      >
                        {s.label}
                      </span>
                      {i < stages.length - 1 && <span style={{ color: "#d1d5db" }}>→</span>}
                    </span>
                  ))}
                  {stage === null && <span style={{ fontSize: 12, color: "#9ca3af" }}>（已归档）</span>}
                </div>
                {stage === "followup" && (
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 13, color: responded ? "#047857" : "#dc2626", fontWeight: 600 }}>
                      {responded
                        ? `✓ 已首响（${detailLead.response_seconds! < 3600 ? Math.round(detailLead.response_seconds! / 60) + " 分钟" : Math.round(detailLead.response_seconds! / 3600) + " 小时"}）`
                        : "▶ 立即回复！目标 5 分钟内首响"}
                    </div>
                    {!responded && detailLead.phone && (
                      <button
                        onClick={() => sendFirstResponse(detailLead)}
                        style={{ marginTop: 6, width: "100%", padding: "9px 14px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}
                      >
                        📨 一键首响：自动带日期/人数/金额 + 推 $19.90 订金（先确认你档期 OK 再点）
                      </button>
                    )}
                  </div>
                )}
                {steps.map((s) => {
                  const done = doneSopIds.has(s.id)
                  const isNext = s.id === nextId
                  return (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: "1px solid #f3f4f6" }}>
                      <span style={{ fontSize: 13, width: 18 }}>{done ? "✅" : isNext ? "▶" : "○"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: isNext ? 700 : 500, color: done ? "#9ca3af" : "#111827", textDecoration: done ? "line-through" : "none" }}>
                          {s.emoji} {s.title}
                        </p>
                        <p style={{ margin: 0, fontSize: 11.5, color: "#6b7280" }}>
                          {s.when}
                          {s.id === "f45" && !done && (() => {
                            const st = f45State(detailLead, clock)
                            if (!st) return null
                            if (st.remaining <= 0)
                              return <span style={{ color: "#dc2626", fontWeight: 700 }}> · ⏰ 已到点，现在发！</span>
                            const mm = Math.floor(st.remaining / 60000)
                            const ss = Math.floor((st.remaining % 60000) / 1000)
                            return (
                              <span style={{ color: "#b45309", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                                {" "}· 倒计时 {mm}:{String(ss).padStart(2, "0")}
                              </span>
                            )
                          })()}
                        </p>
                      </div>
                      <button
                        onClick={() => sendSop(detailLead, s)}
                        disabled={done}
                        style={{
                          padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: done ? "default" : "pointer",
                          border: "1px solid " + (done ? "#e5e7eb" : isNext ? "#0f766e" : "#d1d5db"),
                          background: done ? "#f9fafb" : isNext ? "#0f766e" : "#fff",
                          color: done ? "#c0c4cc" : isNext ? "#fff" : "#374151",
                        }}
                      >
                        {done ? "已发" : "发送"}
                      </button>
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {detailLead.status === "won" && (
            <>
              <a
                href={`/admin/orders?lead=${detailLead.id}`}
                style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: 12, width: "100%", padding: "11px 16px", borderRadius: 8, border: "none", background: "#111827", color: "#fff", fontSize: 14, fontWeight: 700, boxSizing: "border-box" }}
              >
                已成单 → 去订单工作台操作（布置工具 / 48h确认 / 邀评 / 晒图已迁入）
              </a>
              <button
                onClick={() => openInvoice(detailLead)}
                style={{ marginTop: 8, width: "100%", padding: "10px 16px", borderRadius: 8, border: "none", background: "#0f766e", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                📄 添加/修改 Invoice（跳转发票系统，自动带客户信息）
              </button>
            </>
          )}

          {(() => {
            const rem = getReminder(detailLead.id)
            return (
              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  onClick={() => setLeadReminder(detailLead)}
                  style={{ flex: 1, padding: "10px 16px", borderRadius: 8, border: "1px solid #7c3aed", background: "#faf5ff", color: "#6d28d9", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                >
                  ⏰ {rem ? `提醒: ${fmtReminderTime(rem.at)} — ${rem.label}（点击改时间）` : "设跟进提醒（防忘 + 防过度骚扰）"}
                </button>
                {rem && (
                  <button
                    onClick={() => clearLeadReminder(detailLead)}
                    style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#6b7280", fontSize: 13, cursor: "pointer" }}
                  >
                    清除
                  </button>
                )}
              </div>
            )
          })()}

          {/* 通用弹药：任何阶段可用（此前误锁在 won 块里，跟进中的线索看不到） */}
          <button
            onClick={() => sendPromoScript(detailLead)}
            style={{ marginTop: 8, width: "100%", padding: "10px 16px", borderRadius: 8, border: "1px solid #059669", background: "#ecfdf5", color: "#047857", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            🥟 大单促销话术：20+ 人送前菜拼盘（自动复制）
          </button>
          <button
            onClick={() => sendPayLink(detailLead)}
            style={{ marginTop: 8, width: "100%", padding: "10px 16px", borderRadius: 8, border: "1px solid #0284c7", background: "#f0f9ff", color: "#0369a1", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            💳 生成信用卡收款链接（发票联动）
          </button>
          {detailLead.email && (
            <button
              onClick={() => sendEmailFollowup(detailLead)}
              style={{ marginTop: 8, width: "100%", padding: "10px 16px", borderRadius: 8, border: "1px solid #64748b", background: "#f8fafc", color: "#334155", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              ✉️ 邮件跟进（短信不回时的第二通道，正文自动复制）
            </button>
          )}
          <button
            onClick={() => sendCloserScript(detailLead)}
            style={{ marginTop: 8, width: "100%", padding: "10px 16px", borderRadius: 8, border: "1px solid #7c3aed", background: "#f5f3ff", color: "#6d28d9", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            🪑 关单让步话术：再减 $100 桌椅（比价僵持时才用）
          </button>
          <button
            onClick={() => setEsPackFor(detailLead)}
            style={{ marginTop: 8, width: "100%", padding: "10px 16px", borderRadius: 8, border: "1px solid #ca8a04", background: "#fefce8", color: "#a16207", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            🌐 西语话术包（客户用西语来信时用）
          </button>

          <div style={sectionLabel}>跟进备注</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && noteDraft.trim()) {
                  await act(detailLead.id, { action: "add_note", note: noteDraft.trim() })
                  setNoteDraft("")
                  loadHistory(detailLead.id)
                }
              }}
              placeholder="例：已报价 $599，周四再跟。回车保存"
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>

          <div style={sectionLabel}>修改资料（留痕）</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} placeholder="姓名" style={inputStyle} />
            <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="电话" style={inputStyle} />
            <input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="邮箱" style={inputStyle} />
            <button
              disabled={saving}
              onClick={async () => {
                await act(detailLead.id, { action: "update_fields", fields: editForm })
                loadHistory(detailLead.id)
              }}
              style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: "#374151", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              {saving ? "保存中…" : "保存修改"}
            </button>
          </div>

          <div style={sectionLabel}>操作历史</div>
          <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 6 }}>
            {historyEvents.length === 0 && <div style={{ fontSize: 12, color: "#9ca3af" }}>加载中…</div>}
            {historyEvents.map((ev, i) => {
              const p = ev.raw_payload_json ?? {}
              const who = typeof p.actor === "string" ? p.actor : "系统"
              const FIELD_CN: Record<string, string> = { full_name: "姓名", phone: "电话", email: "邮箱", city_or_zip: "地区", guest_count: "人数" }
              const editDiff = () => {
                const before = (p.before as Record<string, unknown>) ?? {}
                const after = (p.after as Record<string, unknown>) ?? {}
                const parts = Object.keys(after)
                  .filter((k) => String(before[k] ?? "") !== String(after[k] ?? ""))
                  .map((k) => `${FIELD_CN[k] ?? k}: ${String(before[k] ?? "空") || "空"} → ${String(after[k] ?? "空") || "空"}`)
                return parts.length ? `：${parts.join("；")}` : "：无实际变更"
              }
              const extra =
                ev.touchpoint_type === "agent_status_change"
                  ? ` → ${STATUS_LABELS[String(p.status)] ?? p.status}${p.bulk ? "（批量）" : ""}`
                  : ev.touchpoint_type === "agent_note"
                    ? `：${p.note}`
                    : ev.touchpoint_type === "agent_edit"
                      ? editDiff()
                      : ""
              return (
                <div key={i} style={{ fontSize: 12, color: "#4b5563", padding: "4px 0", display: "flex", gap: 8 }}>
                  <span style={{ color: "#9ca3af", whiteSpace: "nowrap" }}>
                    {new Date(ev.occurred_at).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span style={{ color: "#6b7280", whiteSpace: "nowrap" }}>[{who}]</span>
                  <span style={{ wordBreak: "break-word" }}>
                    {EVENT_LABELS[ev.touchpoint_type] ?? ev.touchpoint_type}
                    {extra}
                  </span>
                </div>
              )
            })}
          </div>
        </Modal>
      )}

      {esPackFor && (
        <Modal onClose={() => setEsPackFor(null)} title="🌐 西语话术包">
          <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 10px" }}>
            选一条发送给 {esPackFor.full_name || esPackFor.phone}（自动复制+拉起短信+记时间线）：
          </p>
          {ES_SCRIPTS.map((sc) => (
            <div key={sc.id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <strong style={{ fontSize: 13 }}>{sc.title}</strong>
                <button
                  onClick={() => sendEsScript(esPackFor, sc)}
                  style={{ padding: "5px 14px", borderRadius: 6, border: "none", background: "#0f766e", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
                >
                  发送
                </button>
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#4b5563", lineHeight: 1.5 }}>{sc.build(esPackFor)}</p>
            </div>
          ))}
        </Modal>
      )}

      {emailDraft && (
        <Modal onClose={() => setEmailDraft(null)} title="✉️ 邮件跟进预览">
          <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 10px" }}>
            发件人: <strong>Real Hibachi &lt;support@realhibachi.com&gt;</strong>
            <br />
            收件人: <strong>{emailDraft.to}</strong>（客户回信也进 support@）
          </p>
          <div style={sectionLabel}>主题</div>
          <input
            style={inputStyle}
            value={emailDraft.subject}
            onChange={(e) => setEmailDraft((d) => (d ? { ...d, subject: e.target.value } : d))}
          />
          <div style={sectionLabel}>正文（可直接修改）</div>
          <textarea
            style={{ ...inputStyle, height: 260, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
            value={emailDraft.body}
            onChange={(e) => setEmailDraft((d) => (d ? { ...d, body: e.target.value } : d))}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              onClick={dispatchEmailDraft}
              disabled={emailSending}
              style={{ flex: 1, padding: "11px 16px", borderRadius: 8, border: "none", background: emailSending ? "#9ca3af" : "#0f766e", color: "#fff", fontSize: 14, fontWeight: 700, cursor: emailSending ? "default" : "pointer" }}
            >
              {emailSending ? "发送中…" : "从 support@ 发送"}
            </button>
            <button
              onClick={() => setEmailDraft(null)}
              style={{ padding: "11px 16px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fff", color: "#374151", fontSize: 14, cursor: "pointer" }}
            >
              取消
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
