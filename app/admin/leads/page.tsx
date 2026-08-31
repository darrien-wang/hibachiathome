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
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
          for (let i = 0; i < 3; i++) {
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

  const sendReviewInvite = useCallback((l: LeadRow) => {
    const reviewUrl = process.env.NEXT_PUBLIC_GBP_REVIEW_URL || "https://g.page/r/REVIEW_LINK"
    const firstName = (l.full_name || "").split(" ")[0]
    const text = `Hi${firstName ? " " + firstName : ""}! Thanks for having Real Hibachi at your party - hope everyone loved the show! If you have 30 seconds, a Google review would mean the world to our small team: ${reviewUrl}`
    try {
      navigator.clipboard.writeText(text)
    } catch {}
    window.location.href = `sms:${l.phone}?&body=${encodeURIComponent(text)}`
  }, [])

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
  type SopStep = { id: string; stage: "followup" | "won"; emoji: string; title: string; when: string; build?: (l: LeadRow) => string }
  const SOP_STEPS: SopStep[] = [
    {
      id: "f45", stage: "followup", emoji: "⏰", title: "45分钟跟进：选择题+档期稀缺", when: "首响后 45-60 分钟客户没回",
      build: () => "Quick heads up — weekend slots go first. Most dinner parties start at 5:30 or 6:30, either work for you? I can hold one while you decide 😊",
    },
    {
      id: "f_night", stage: "followup", emoji: "🌙", title: "当晚软锁定：免订金占位", when: "当晚睡前仍未回",
      build: () => "No rush at all! I'll pencil your date in for now — no deposit needed until you confirm. Just don't want you to lose it while you're deciding 🙌",
    },
    {
      id: "f_morning", stage: "followup", emoji: "☀️", title: "次日跟进：亮到场承诺", when: "第二天上午",
      build: (l) => `Morning! Still holding your date for your party${l.guest_count ? ` of ${l.guest_count}` : ""}. Your chef is confirmed by name 48h before the event — and if we ever cancel, double your deposit back. Want me to lock it in?`,
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
      id: "w_planner", stage: "won", emoji: "🎪", title: "发派对布置工具", when: "订金确认后立刻发",
      build: () => "You're booked 🎉 Here's your party planner: party.realhibachi.com — set up your tables and share the link with your guests so everyone picks their own proteins. Takes 2 minutes and makes party day seamless!",
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
        const text = step.build(l)
        try {
          navigator.clipboard.writeText(text)
        } catch {}
        if (l.phone) window.location.href = `sms:${l.phone}?&body=${encodeURIComponent(text)}`
      }
      await act(l.id, { action: "add_note", note: `[SOP:${step.id}] ${step.title} 已发送` })
      loadHistory(l.id)
    },
    [act, loadHistory, sendReviewInvite, sendUgcInvite]
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
                  <span style={{ fontSize: 12, color: "#6b7280" }}>{relativeTime(l.created_at)}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: badge.color }}>首响: {badge.text}</span>
              </div>

              <div style={{ fontSize: 13, color: "#374151", margin: "8px 0", display: "flex", gap: 14, flexWrap: "wrap" }}>
                {l.phone && (
                  <span onClick={(e) => e.stopPropagation()}>
                    📞 <a href={`tel:${l.phone}`}>{l.phone}</a> · <a href={`sms:${l.phone}`}>发短信</a>
                  </span>
                )}
                {l.email && <span>✉️ {l.email}</span>}
                {l.city_or_zip && <span>📍 {l.city_or_zip}</span>}
                {l.guest_count !== null && <span>👥 {l.guest_count} 人</span>}
              </div>

              {l.latest_message && (
                <div style={{ fontSize: 13, color: "#6b7280", background: "#f9fafb", borderRadius: 8, padding: "8px 10px", marginBottom: 10, whiteSpace: "pre-wrap", maxHeight: 72, overflow: "hidden" }}>
                  {l.latest_message.slice(0, 200)}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
                {l.status === "won" ? (
                  <>
                    <button
                      onClick={() => openInvoice(l)}
                      style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#0f766e", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                    >
                      📄 添加/修改 Invoice
                    </button>
                    {l.phone && (
                      <button
                        onClick={() => sendReviewInvite(l)}
                        style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #d97706", background: "#fffbeb", color: "#b45309", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                      >
                        ⭐ 邀评
                      </button>
                    )}
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
            const steps = stage ? SOP_STEPS.filter((s) => s.stage === stage) : []
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
                  <div style={{ fontSize: 13, marginBottom: 6, color: responded ? "#047857" : "#dc2626", fontWeight: 600 }}>
                    {responded
                      ? `✓ 已首响（${detailLead.response_seconds! < 3600 ? Math.round(detailLead.response_seconds! / 60) + " 分钟" : Math.round(detailLead.response_seconds! / 3600) + " 小时"}）`
                      : "▶ 立即回复！目标 5 分钟内首响（回完点上面的“标记已联系”）"}
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
                        <p style={{ margin: 0, fontSize: 11.5, color: "#6b7280" }}>{s.when}</p>
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
              <button
                onClick={() => openInvoice(detailLead)}
                style={{ marginTop: 12, width: "100%", padding: "10px 16px", borderRadius: 8, border: "none", background: "#0f766e", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                📄 添加/修改 Invoice（跳转发票系统，自动带客户信息）
              </button>
              {detailLead.phone && (
                <button
                  onClick={() => sendReviewInvite(detailLead)}
                  style={{ marginTop: 8, width: "100%", padding: "10px 16px", borderRadius: 8, border: "1px solid #d97706", background: "#fffbeb", color: "#b45309", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                >
                  ⭐ 发送邀评短信（文案自动复制）
                </button>
              )}
              <button
                onClick={() => sendPromoScript(detailLead)}
                style={{ marginTop: 8, width: "100%", padding: "10px 16px", borderRadius: 8, border: "1px solid #059669", background: "#ecfdf5", color: "#047857", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                🥟 大单促销话术：20+ 人送前菜拼盘（自动复制）
              </button>
              <button
                onClick={() => sendUgcInvite(detailLead)}
                style={{ marginTop: 8, width: "100%", padding: "10px 16px", borderRadius: 8, border: "1px solid #2563eb", background: "#eff6ff", color: "#1d4ed8", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                📸 晒图邀请（UGC）：派对次日发，求 tag @realhibachi
              </button>
              <button
                onClick={() => sendCloserScript(detailLead)}
                style={{ marginTop: 8, width: "100%", padding: "10px 16px", borderRadius: 8, border: "1px solid #7c3aed", background: "#f5f3ff", color: "#6d28d9", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                🪑 关单让步话术：再减 $100 桌椅（比价僵持时才用）
              </button>
            </>
          )}

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
    </div>
  )
}
