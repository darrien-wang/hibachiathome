"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSoftphone } from "@/components/admin/SoftphoneProvider"
import { phone } from "@/config/site"

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
type SmsMessage = { sid: string; direction: "inbound" | "outbound"; body: string; at: string; status: string; media: number; peer: string }

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
  // 客户在 party planner 里的动作（D-0917-02）：发出去的链接不再是黑箱
  planner_unlock: "Planner 留资解锁",
  planner_opened: "打开了 planner",
  planner_edited: "正在 planner 里布置派对",
  planner_shared: "把派对分享给了客人",
  planner_guest_joined: "第一位客人加入了派对",
  planner_half_joined: "过半客人已加入",
  planner_menu_complete: "全员选完菜 — 菜单齐了",
  sms_outbound: "发出短信（213 线）",
  agent_first_response: "✓ 首次联系",
  sms_failed: "⚠️ 短信未送达",
  agent_status_change: "状态变更",
  agent_edit: "✏️ 资料修改",
  agent_note: "📝 备注",
  agent_merge: "🔗 合并线索",
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

// A picture or video a customer texted us. Twilio keeps MMS attachments
// behind basic auth, so the bytes come through /api/admin/sms-media with the
// admin key in a header and reach the tag as a blob URL. Same component idea
// as components/admin/sms-thread-panel.tsx, kept local to this page's markup.
function SmsAttachment({ adminKey, sid, index }: { adminKey: string; sid: string; index: number }) {
  const [url, setUrl] = useState<string | null>(null)
  const [type, setType] = useState("")
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let objectUrl: string | null = null
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/admin/sms-media?sid=${encodeURIComponent(sid)}&i=${index}`, {
          headers: { "x-admin-key": adminKey },
        })
        if (!res.ok) throw new Error(String(res.status))
        const blob = await res.blob()
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setType(blob.type)
        setUrl(objectUrl)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [adminKey, sid, index])

  if (failed) return <div style={{ fontSize: 11, color: "#b91c1c" }}>附件打不开</div>
  if (!url) return <div style={{ fontSize: 11, color: "#9ca3af" }}>附件加载中…</div>
  if (type.startsWith("video/") || type.startsWith("audio/")) {
    return <video src={url} controls playsInline style={{ maxWidth: 220, borderRadius: 10, display: "block", marginTop: 6 }} />
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 6 }}>
      <img src={url} alt="客户发来的附件" style={{ maxWidth: 220, borderRadius: 10, display: "block" }} />
    </a>
  )
}

export default function LeadsDashboard() {
  const softphone = useSoftphone()
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
  const [addForm, setAddForm] = useState({ name: "", phone: "", channel: "phone", message: "", adRef: "" })
  const [adding, setAdding] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [historyEvents, setHistoryEvents] = useState<HistoryEvent[]>([])
  const [smsThread, setSmsThread] = useState<SmsMessage[] | null>(null)
  const [smsDraft, setSmsDraft] = useState("")
  const [smsSending, setSmsSending] = useState(false)
  const pendingLeadRef = useRef<string | null>(null)
  const [editForm, setEditForm] = useState({ full_name: "", phone: "", email: "" })
  const [noteDraft, setNoteDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [expandedMsgIds, setExpandedMsgIds] = useState<Set<string>>(new Set())
  const prevNewestRef = useRef<string>("")

  useEffect(() => {
    try {
      // ?key=... in the URL signs in directly (and is then scrubbed from the URL).
      const params = new URLSearchParams(window.location.search)
      // ?lead=<id> (from the SMS alert email) opens that lead once the list loads.
      const leadParam = params.get("lead")?.trim()
      if (leadParam) {
        pendingLeadRef.current = leadParam
        params.delete("lead")
        const rest = params.toString()
        window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`)
      }
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

  // The SMS conversation comes from Twilio (the only complete record - see
  // lib/sms-thread.ts), so replies sent from anywhere show up here.
  const loadSmsThread = useCallback(
    async (lead: { id: string; phone: string | null }) => {
      setSmsThread(null)
      try {
        // By lead, not by phone: a merged second number (Ravi's 213 line)
        // belongs in the same conversation.
        const res = await fetch(`/api/admin/sms-thread?leadId=${encodeURIComponent(lead.id)}${lead.phone ? `&phone=${encodeURIComponent(lead.phone)}` : ""}`, {
          headers: { "x-admin-key": adminKey },
          cache: "no-store",
        })
        const data = await res.json()
        setSmsThread(Array.isArray(data.messages) ? data.messages : [])
      } catch {
        setSmsThread([])
      }
    },
    [adminKey]
  )

  const openDetail = useCallback(
    (l: LeadRow) => {
      setDetailId(l.id)
      setEditForm({ full_name: l.full_name ?? "", phone: l.phone ?? "", email: l.email ?? "" })
      setNoteDraft("")
      setSmsDraft("")
      loadHistory(l.id)
      loadSmsThread(l)
    },
    [loadHistory, loadSmsThread]
  )

  useEffect(() => {
    const id = pendingLeadRef.current
    if (!id || leads.length === 0) return
    const target = leads.find((l) => l.id === id)
    if (!target) return
    pendingLeadRef.current = null
    openDetail(target)
  }, [leads, openDetail])

  // Long customer-facing links (prefilled deposit page ~300 chars, personal
  // planner link, Stripe Checkout) are swapped for /d/<code> short links right
  // before the text leaves the workbench: 30-day life, expired -> homepage.
  // Any failure keeps the long URL - a long link is fine, an unsent one is not.
  const shortenLinks = useCallback(
    async (text: string, leadId?: string): Promise<string> => {
      const found = text.match(
        /https:\/\/(?:www\.realhibachi\.com\/deposit\/pay\?|party\.realhibachi\.com\/order\?|checkout\.stripe\.com\/)\S+/g,
      )
      if (!found) return text
      let out = text
      for (const raw of Array.from(new Set(found))) {
        const url = raw.replace(/[.,)]+$/, "")
        try {
          const res = await fetch("/api/admin/short-link", {
            method: "POST",
            headers: { "x-admin-key": adminKey, "Content-Type": "application/json" },
            body: JSON.stringify({ url, leadId }),
          })
          const d = await res.json()
          if (d.ok && typeof d.shortUrl === "string") out = out.split(url).join(d.shortUrl)
        } catch {}
      }
      return out
    },
    [adminKey],
  )

  const sendSmsReply = useCallback(
    async (l: LeadRow) => {
      const draft = smsDraft.trim()
      if (!l.phone || !draft || smsSending) return
      setSmsSending(true)
      try {
        const body = await shortenLinks(draft, l.id)
        const post = (force: boolean) =>
          fetch("/api/admin/sms-thread", {
            method: "POST",
            headers: { "content-type": "application/json", "x-admin-key": adminKey },
            body: JSON.stringify({ phone: l.phone, body, leadId: l.id, force }),
          })
        let res = await post(false)
        let data = await res.json().catch(() => ({}))
        // Brakes (cap / spacing / dead number) are rules the owner can overrule.
        if (res.status === 409 && data.brake && window.confirm(`${data.error}。\n\n仍然发送？`)) {
          res = await post(true)
          data = await res.json().catch(() => ({}))
        }
        if (!res.ok) {
          if (res.status !== 409) window.alert(`发送失败：${data.error ?? res.status}`)
          return
        }
        setSmsDraft("")
        await Promise.all([loadSmsThread(l), loadHistory(l.id), fetchLeads()])
      } finally {
        setSmsSending(false)
      }
    },
    [adminKey, smsDraft, smsSending, loadSmsThread, loadHistory, fetchLeads, shortenLinks]
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
        // Phone/email ride along so pay-link can bind the link to this lead's
        // order when they have exactly one open balance — that binding is what
        // lets the webhook book the payment the moment the customer pays.
        const data = await mint({
          amount,
          amountIsFinal,
          customerName: l.full_name || undefined,
          phone: l.phone || undefined,
          email: l.email || undefined,
        })
        if (!data.ok) throw new Error(data.error || "failed")
        if (!data.linkedOrderNo) {
          window.alert(
            `⚠️ 链接已生成,但没能绑定到订单(${data.unmatchedReason ?? "unknown"})。\n` +
              "客户付完后不会自动入账,需要到订单工作台手动登记。",
          )
        }
        const firstName = (l.full_name || "").split(" ")[0]
        const text = await shortenLinks(`Hi${firstName ? " " + firstName : ""}! Here's your secure card payment link for your balance: $${data.total.toFixed(2)} ${smsDetail}\n${data.url}\n(Cash, Venmo or Zelle skip the card fee — just let me know!)`, l.id)
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
    [adminKey, act, loadHistory, shortenLinks]
  )

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
          // 点卡片一律看详情;多选走左边的勾选框(它自己 stopPropagation)。
          // 以前 owner 点卡片是选中、agent 是看详情,两边现在都能合并了,再留着
          // 这个分叉只会让人点错。
          return (
            <div
              key={l.id}
              onClick={() => openDetail(l)}
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
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(l.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: 16, height: 16, cursor: "pointer" }}
                  />
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
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: badge.color }}>首响: {badge.text}</span>
              </div>

              <div style={{ fontSize: 13, color: "#374151", margin: "8px 0", display: "flex", gap: 14, flexWrap: "wrap" }}>
                {l.phone && (
                  <span onClick={(e) => e.stopPropagation()}>
                    📞{" "}
                    {/* Prefills the softphone drawer. A tel: link here opens the
                        Windows "choose an app" dialog and dials nothing. */}
                    <button
                      type="button"
                      onClick={() => softphone.prefill(l.phone as string)}
                      title="填入右侧电话面板"
                      style={{
                        background: "none", border: "none", padding: 0, font: "inherit",
                        color: "#111827", textDecoration: "underline dotted", cursor: "pointer",
                      }}
                    >
                      {l.phone}
                    </button>{" "}
                    ·{" "}
                    <button
                      type="button"
                      onClick={() => void softphone.dial(l.phone as string)}
                      disabled={softphone.live.kind !== "none"}
                      title="用网页软电话拨打"
                      style={{
                        background: "none",
                        border: "none",
                        padding: 0,
                        font: "inherit",
                        color: softphone.live.kind !== "none" ? "#9ca3af" : "#2563eb",
                        textDecoration: "underline",
                        cursor: softphone.live.kind !== "none" ? "not-allowed" : "pointer",
                      }}
                    >
                      网页拨号
                    </button>{" "}
                    ·{" "}
                    <button
                      type="button"
                      onClick={() => softphone.prefill(l.phone as string, "sms")}
                      title="在右侧写短信草稿"
                      style={{
                        background: "none", border: "none", padding: 0, font: "inherit",
                        color: "#2563eb", textDecoration: "underline", cursor: "pointer",
                      }}
                    >
                      发短信
                    </button>
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

      {/* ── Bulk action floating bar (merge: anyone; bulk status: owner) ── */}
      {selected.size > 0 && (
        <div style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 40, background: "#111827", color: "#fff", borderRadius: 999, padding: "10px 18px", display: "flex", gap: 10, alignItems: "center", boxShadow: "0 10px 30px rgba(0,0,0,0.35)", maxWidth: "calc(100% - 24px)", flexWrap: "wrap", justifyContent: "center" }}>
          <span style={{ fontSize: 13, whiteSpace: "nowrap" }}>已选 {selected.size} 条</span>
          {viewerRole === "owner" &&
            [
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
          {selected.size >= 2 && (
            <button
              onClick={async () => {
                // Merging rewrites history, so name the survivor before doing it.
                const picked = leads.filter((l) => selected.has(l.id))
                const oldest = [...picked].sort(
                  (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                )[0]
                const keepLabel = oldest?.full_name || oldest?.phone || oldest?.email || "最早的一条"
                if (!window.confirm(`把选中的 ${selected.size} 条合并成一条？

保留：${keepLabel}（最早的一条，首响和归因都挂在它上面）
其余记录会被隐藏，电话/邮箱等空字段补到保留的那条上，触点时间线全部合并过去。

合错了可以恢复。`)) return
                const res = await fetch("/api/admin/leads", {
                  method: "PATCH",
                  headers: { "content-type": "application/json", "x-admin-key": adminKey },
                  body: JSON.stringify({ action: "merge", leadIds: Array.from(selected) }),
                })
                if (!res.ok) {
                  const body = await res.json().catch(() => ({}))
                  alert(`合并失败：${body.error ?? res.status}`)
                  return
                }
                setSelected(new Set())
                fetchLeads()
              }}
              style={{ padding: "6px 14px", borderRadius: 999, border: "1px solid #34d399", background: "transparent", color: "#6ee7b7", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              合并为同一人
            </button>
          )}
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
            <input placeholder="广告码（客户短信里的 [AD-XXXXXX]，没有留空）" value={addForm.adRef} onChange={(e) => setAddForm({ ...addForm, adRef: e.target.value })} style={inputStyle} />
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
                  setAddForm({ name: "", phone: "", channel: addForm.channel, message: "", adRef: "" })
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

          {/* Sales steps (first response, follow-up ladder, scripts, email, agreed
              total, reminders) moved to the leads skill 2026-09-20 (owner: agent
              first). The drawer keeps status, notes, the SMS thread, the audit
              trail, and the money tools that read the invoice. */}
          <button
            onClick={() => sendPayLink(detailLead)}
            style={{ marginTop: 12, width: "100%", padding: "10px 16px", borderRadius: 8, border: "1px solid #0284c7", background: "#f0f9ff", color: "#0369a1", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            💳 生成信用卡收款链接（发票联动）
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

          <div style={sectionLabel}>短信对话 · 213-770-7788 线</div>
          <div style={{ border: "1px solid #eee7db", borderRadius: 12, padding: 10, maxHeight: 340, overflowY: "auto", background: "#fbf8f2" }}>
            {smsThread === null && <div style={{ fontSize: 12, color: "#9ca3af" }}>加载中…</div>}
            {smsThread && smsThread.length === 0 && (
              <div style={{ fontSize: 12, color: "#9ca3af" }}>
                {detailLead.phone ? "这个号码和 213 线之间还没有短信。" : "这条线索没有电话号码。"}
              </div>
            )}
            {smsThread?.map((m) => {
              const mine = m.direction === "outbound"
              const manyNumbers = new Set(smsThread.map((x) => x.peer)).size > 1
              const peerLabel = m.peer.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3")
              return (
                <div key={m.sid} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", margin: "4px 0" }}>
                  <div
                    style={{
                      maxWidth: "80%",
                      padding: "7px 11px",
                      borderRadius: 14,
                      fontSize: 13,
                      lineHeight: 1.45,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      background: mine ? "#fdeee2" : "#fff",
                      border: `1px solid ${mine ? "#fbd7bd" : "#e5e7eb"}`,
                      color: "#1f2937",
                    }}
                  >
                    {m.body}
                    {m.media > 0 &&
                      Array.from({ length: m.media }).map((_, i) => (
                        <SmsAttachment key={`${m.sid}-${i}`} adminKey={adminKey} sid={m.sid} index={i} />
                      ))}
                    <div style={{ fontSize: 10.5, color: "#9ca3af", marginTop: 3, textAlign: mine ? "right" : "left" }}>
                      {manyNumbers ? `${peerLabel} · ` : ""}
                      {new Date(m.at).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      {mine ? ` · ${m.status}` : ""}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {detailLead.phone && (
            <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "flex-end" }}>
              <textarea
                value={smsDraft}
                onChange={(e) => setSmsDraft(e.target.value)}
                placeholder="用 213-770-7788 回复（客户看到的就是这个号）…"
                rows={2}
                style={{ ...inputStyle, resize: "vertical" }}
              />
              <button
                disabled={smsSending || !smsDraft.trim()}
                onClick={() => sendSmsReply(detailLead)}
                style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: smsDraft.trim() ? "#c2410c" : "#d1d5db", color: "#fff", fontSize: 13, fontWeight: 700, cursor: smsDraft.trim() ? "pointer" : "default", whiteSpace: "nowrap" }}
              >
                {smsSending ? "发送中…" : "发送"}
              </button>
            </div>
          )}

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
                  : ev.touchpoint_type === "agent_note" || (ev.touchpoint_type.startsWith("planner_") && p.note)
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

    </div>
  )
}
