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

export default function LeadsDashboard() {
  const [adminKey, setAdminKey] = useState<string>("")
  const [keyInput, setKeyInput] = useState("")
  const [authFailed, setAuthFailed] = useState(false)
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>("all")
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
      }
      if (rows.length > 0) prevNewestRef.current = rows[0].id
      setLeads(rows)
      setStats(data.stats ?? null)
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
    const t = setInterval(fetchLeads, 30000)
    return () => clearInterval(t)
  }, [adminKey, fetchLeads])

  const act = useCallback(
    async (leadId: string, payload: Record<string, string>) => {
      await fetch("/api/admin/leads", {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ leadId, ...payload }),
      })
      fetchLeads()
    },
    [adminKey, fetchLeads]
  )

  const visible = useMemo(
    () => (statusFilter === "all" ? leads : leads.filter((l) => l.status === statusFilter)),
    [leads, statusFilter]
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
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 16px", fontFamily: "system-ui, sans-serif" }}>
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

      <div style={{ marginBottom: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {["all", "new", "qualified", "won", "lost"].map((s) => (
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
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {visible.map((l) => {
          const badge = responseBadge(l.response_seconds)
          const isAd = l.utm_source === "google" || Boolean(l.gclid)
          return (
            <div key={l.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 15 }}>{l.full_name || "（未留名）"}</strong>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 999,
                      color: "#fff",
                      background: STATUS_COLORS[l.status] ?? "#6b7280",
                    }}
                  >
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
                  <span>
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

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {l.response_seconds === null && (
                  <button
                    onClick={() => act(l.id, { action: "mark_contacted" })}
                    style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                  >
                    ✓ 已联系
                  </button>
                )}
                {l.status === "won" && l.phone && (
                  <button
                    onClick={() => {
                      const reviewUrl = process.env.NEXT_PUBLIC_GBP_REVIEW_URL || "https://g.page/r/REVIEW_LINK"
                      const firstName = (l.full_name || "").split(" ")[0]
                      const text = `Hi${firstName ? " " + firstName : ""}! Thanks for having Real Hibachi at your party - hope everyone loved the show! If you have 30 seconds, a Google review would mean the world to our small team: ${reviewUrl}`
                      try {
                        navigator.clipboard.writeText(text)
                      } catch {}
                      window.location.href = `sms:${l.phone}?&body=${encodeURIComponent(text)}`
                    }}
                    style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid #d97706", background: "#fffbeb", color: "#b45309", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                    title="文案已复制到剪贴板；手机上会直接打开短信"
                  >
                    ⭐ 发送邀评短信
                  </button>
                )}
                <select
                  value={l.status}
                  onChange={(e) => act(l.id, { action: "set_status", status: e.target.value })}
                  style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13 }}
                >
                  {Object.entries(STATUS_LABELS).map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )
        })}
        {visible.length === 0 && !loading && (
          <div style={{ textAlign: "center", color: "#9ca3af", padding: 40 }}>没有符合条件的线索</div>
        )}
      </div>
    </div>
  )
}
