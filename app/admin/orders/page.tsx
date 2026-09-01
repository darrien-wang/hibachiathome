"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ORDER_SOP_STEPS, type OrderSopStage } from "@/lib/order-sop"

// ============================================================
// 订单工作台 · V1
// ============================================================
// 押金到账即晋升为订单(不分渠道),此页是 orders 表(共享 Supabase、
// invoice app 所有)的运营视图:读直连、写走 integration 事件。
// 线索工作台只管成单之前;成单之后的一切在这里。

type OrderRow = {
  id: string
  order_no: string
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  event_start: string | null
  event_address: string | null
  guest_adult_count: number | null
  guest_child_count: number | null
  order_status: string | null
  deposit_status: string | null
  deposit_required_cents: number | null
  deposit_paid_total_cents: number | null
  details_status: string | null
  quoted_total_cents: number | null
  amount_paid_total_cents: number | null
  balance_due_cents: number | null
  source: string | null
  source_ref: string | null
  source_metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

type PaymentRow = {
  id: string
  provider: string
  external_payment_id: string
  type: string
  status: string
  amount_cents: number
  paid_at: string | null
  transaction_ref: string | null
  created_at: string
}

type EventRow = {
  id: string
  actor: string | null
  action: string
  metadata: Record<string, unknown> | null
  created_at: string
}

type LeadOption = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  guest_count: number | null
  status: string
}

type Stage = "待细节" | "本周执行" | "已订" | "待尾款" | "已办完" | "已取消"

const STAGE_STYLES: Record<Stage, { bg: string; fg: string }> = {
  待细节: { bg: "#fef3c7", fg: "#92400e" },
  本周执行: { bg: "#fee2e2", fg: "#b91c1c" },
  已订: { bg: "#e0e7ff", fg: "#3730a3" },
  待尾款: { bg: "#dbeafe", fg: "#1d4ed8" },
  已办完: { bg: "#d1fae5", fg: "#065f46" },
  已取消: { bg: "#f3f4f6", fg: "#6b7280" },
}

const STAGE_FILTERS: Array<Stage | "全部"> = ["全部", "待细节", "本周执行", "已订", "待尾款", "已办完", "已取消"]

function money(cents: number | null | undefined): string {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "—"
  return `$${(cents / 100).toFixed(2)}`
}

function stageOf(o: OrderRow, now: number): Stage {
  if (o.order_status === "cancelled") return "已取消"
  const eventMs = o.event_start ? Date.parse(o.event_start) : NaN
  const passed = Number.isFinite(eventMs) && eventMs < now
  if (passed) {
    if (o.balance_due_cents === 0) return "已办完"
    return "待尾款"
  }
  if (o.details_status !== "complete") return "待细节"
  if (Number.isFinite(eventMs) && eventMs - now <= 7 * 86400_000) return "本周执行"
  return "已订"
}

// 订单阶段 → SOP 阶段:当前该发的那组高亮,其余照常可发
function sopStageOf(stage: Stage): OrderSopStage | null {
  if (stage === "待细节" || stage === "已订") return "booked"
  if (stage === "本周执行") return "exec"
  if (stage === "待尾款" || stage === "已办完") return "post"
  return null
}

function eventLabel(iso: string | null, now: number): string {
  if (!iso) return "—"
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return "—"
  const d = new Date(ms)
  // event_start is wall-clock time stored as UTC across the whole pipeline
  // (webhook envelope builder + invoice app both treat it that way), so render
  // the UTC fields verbatim instead of shifting into the browser's zone.
  const date = `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`
  const days = Math.round((ms - now) / 86400_000)
  if (days === 0) return `${date} · 今天`
  return days > 0 ? `${date} · ${days} 天后` : `${date} · ${-days} 天前`
}

const inputStyle: React.CSSProperties = { padding: "9px 11px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, width: "100%", boxSizing: "border-box" }
const labelStyle: React.CSSProperties = { fontSize: 12, color: "#6b7280", margin: "12px 0 5px", fontWeight: 600 }
const btnStyle: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "1px solid #111827", background: "#111827", color: "#fff", fontSize: 13.5, cursor: "pointer" }
const btnGhost: React.CSSProperties = { ...btnStyle, background: "#fff", color: "#111827", border: "1px solid #d1d5db" }

export default function OrdersWorkbench() {
  const [adminKey, setAdminKey] = useState("")
  const [keyInput, setKeyInput] = useState("")
  const [authFailed, setAuthFailed] = useState(false)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(false)
  const [stageFilter, setStageFilter] = useState<Stage | "全部">("全部")
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<{ order: OrderRow; payments: PaymentRow[]; events: EventRow[] } | null>(null)
  const [showDeposit, setShowDeposit] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    document.title = "订单工作台 — Real Hibachi"
    try {
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

  const fetchOrders = useCallback(async () => {
    if (!adminKey) return
    setLoading(true)
    try {
      const res = await fetch("/api/admin/orders", { headers: { "x-admin-key": adminKey }, cache: "no-store" })
      if (res.status === 401) {
        setAuthFailed(true)
        setAdminKey("")
        try {
          window.localStorage.removeItem("rh_admin_key")
        } catch {}
        return
      }
      const data = await res.json()
      setOrders(data.orders ?? [])
      setAuthFailed(false)
    } catch {
      // 网络抖动,下轮重试
    } finally {
      setLoading(false)
    }
  }, [adminKey])

  useEffect(() => {
    if (!adminKey) return
    fetchOrders()
    const t = setInterval(() => {
      fetchOrders()
      setNow(Date.now())
    }, 60000)
    return () => clearInterval(t)
  }, [adminKey, fetchOrders])

  const openDetail = useCallback(
    async (id: string) => {
      setDetailId(id)
      setDetail(null)
      try {
        const res = await fetch(`/api/admin/orders?id=${encodeURIComponent(id)}`, {
          headers: { "x-admin-key": adminKey },
          cache: "no-store",
        })
        const data = await res.json()
        if (data.ok) setDetail({ order: data.order, payments: data.payments, events: data.events })
      } catch {}
    },
    [adminKey],
  )

  // 深链:/admin/orders?lead=<lead_id> 自动打开该线索关联的订单;
  // ?stage=<阶段名> 预选阶段筛选。只在首次数据到位时消费一次。
  const deepLinkDone = useRef(false)
  useEffect(() => {
    if (deepLinkDone.current || orders.length === 0) return
    deepLinkDone.current = true
    try {
      const params = new URLSearchParams(window.location.search)
      const stageParam = params.get("stage")
      if (stageParam && (STAGE_FILTERS as string[]).includes(stageParam)) {
        setStageFilter(stageParam as Stage)
      }
      const leadParam = params.get("lead")?.trim()
      if (leadParam) {
        const match = orders.find((o) => (o.source_metadata as Record<string, unknown> | null)?.lead_id === leadParam)
        if (match) openDetail(match.id)
      }
    } catch {}
  }, [orders, openDetail])

  const filtered = useMemo(() => {
    const withStage = orders.map((o) => ({ o, stage: stageOf(o, now) }))
    const rows = stageFilter === "全部" ? withStage.filter((r) => r.stage !== "已取消") : withStage.filter((r) => r.stage === stageFilter)
    // 未办的按活动日期升序(最紧急在前),已办/取消的沉底按日期倒序
    return rows.sort((a, b) => {
      const doneA = a.stage === "已办完" || a.stage === "已取消" ? 1 : 0
      const doneB = b.stage === "已办完" || b.stage === "已取消" ? 1 : 0
      if (doneA !== doneB) return doneA - doneB
      const ta = a.o.event_start ? Date.parse(a.o.event_start) : Infinity
      const tb = b.o.event_start ? Date.parse(b.o.event_start) : Infinity
      return doneA ? tb - ta : ta - tb
    })
  }, [orders, stageFilter, now])

  const stageCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const o of orders) {
      const s = stageOf(o, now)
      counts.set(s, (counts.get(s) ?? 0) + 1)
    }
    return counts
  }, [orders, now])

  if (!adminKey) {
    return (
      <div style={{ maxWidth: 360, margin: "120px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h2 style={{ marginBottom: 6 }}>订单工作台</h2>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>{authFailed ? "密钥不对,再试一次。" : "输入工作台密钥。"}</p>
        <input
          style={inputStyle}
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
          placeholder="admin key"
        />
      </div>
    )
  }

  return (
    <div style={{ padding: "18px 20px 80px", fontFamily: "system-ui, sans-serif", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {STAGE_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStageFilter(s)}
              style={{
                padding: "5px 12px",
                borderRadius: 999,
                fontSize: 13,
                cursor: "pointer",
                border: "1px solid " + (stageFilter === s ? "#111827" : "#d1d5db"),
                background: stageFilter === s ? "#111827" : "#fff",
                color: stageFilter === s ? "#fff" : "#374151",
              }}
            >
              {s}
              {s !== "全部" && stageCounts.get(s) ? ` ${stageCounts.get(s)}` : ""}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btnGhost} onClick={fetchOrders}>
            {loading ? "刷新中…" : "刷新"}
          </button>
          <button style={btnStyle} onClick={() => setShowDeposit(true)}>
            ➕ 手动押金确认
          </button>
        </div>
      </div>

      <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13.5, minWidth: 760 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#6b7280", fontSize: 12 }}>
              <th style={{ padding: "10px 14px" }}>单号</th>
              <th style={{ padding: "10px 14px" }}>客户</th>
              <th style={{ padding: "10px 14px" }}>活动时间</th>
              <th style={{ padding: "10px 14px" }}>人数</th>
              <th style={{ padding: "10px 14px" }}>押金</th>
              <th style={{ padding: "10px 14px" }}>尾款</th>
              <th style={{ padding: "10px 14px" }}>阶段</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ o, stage }) => {
              const st = STAGE_STYLES[stage]
              return (
                <tr
                  key={o.id}
                  onClick={() => openDetail(o.id)}
                  style={{ borderTop: "1px solid #f3f4f6", cursor: "pointer" }}
                >
                  <td style={{ padding: "10px 14px", fontFamily: "ui-monospace, monospace", fontSize: 12.5, whiteSpace: "nowrap" }}>{o.order_no}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ fontWeight: 600 }}>{o.customer_name || "—"}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{o.customer_phone || o.customer_email || ""}</div>
                  </td>
                  <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{eventLabel(o.event_start, now)}</td>
                  <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                    {(o.guest_adult_count ?? 0) + (o.guest_child_count ?? 0) || "—"}
                  </td>
                  <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                    {money(o.deposit_paid_total_cents)}
                    {o.deposit_status === "paid_verified" ? " ✓" : o.deposit_status === "paid_manual" ? " ✓⁽手⁾" : ""}
                  </td>
                  <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{money(o.balance_due_cents)}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ background: st.bg, color: st.fg, borderRadius: 999, padding: "2px 10px", fontSize: 12, whiteSpace: "nowrap" }}>{stage}</span>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 28, textAlign: "center", color: "#9ca3af" }}>
                  {loading ? "加载中…" : "这个阶段没有订单"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detailId && (
        <OrderDrawer
          adminKey={adminKey}
          detail={detail}
          now={now}
          onClose={() => {
            setDetailId(null)
            setDetail(null)
          }}
          onChanged={() => {
            fetchOrders()
            openDetail(detailId)
          }}
        />
      )}

      {showDeposit && (
        <ManualDepositModal
          adminKey={adminKey}
          onClose={() => setShowDeposit(false)}
          onCreated={() => {
            setShowDeposit(false)
            fetchOrders()
          }}
        />
      )}
    </div>
  )
}

// ============================================================
// 订单详情抽屉
// ============================================================
function OrderDrawer({
  adminKey,
  detail,
  now,
  onClose,
  onChanged,
}: {
  adminKey: string
  detail: { order: OrderRow; payments: PaymentRow[]; events: EventRow[] } | null
  now: number
  onClose: () => void
  onChanged: () => void
}) {
  const [plannerUrl, setPlannerUrl] = useState("")
  const [quote, setQuote] = useState<{ balanceDue?: number; deposit?: number; finalTotal?: number; found?: boolean } | null>(null)
  const [payAmount, setPayAmount] = useState("")
  const [payUrl, setPayUrl] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [travelDest, setTravelDest] = useState("")
  const [travelResult, setTravelResult] = useState<string>("")
  const [chefName, setChefName] = useState("Bling")
  const [sopBusy, setSopBusy] = useState<string | null>(null)
  // 人数/报价调整:客人的人数到活动前一天都可能变,这里随时改、随时重算
  const [adjOpen, setAdjOpen] = useState(false)
  const [adjAdults, setAdjAdults] = useState("0")
  const [adjKids, setAdjKids] = useState("0")
  const [adjTableware, setAdjTableware] = useState(false)
  const [adjTravel, setAdjTravel] = useState("0")
  const [adjAdultPrice, setAdjAdultPrice] = useState("59.9")
  const [adjKidPrice, setAdjKidPrice] = useState("29.9")
  const [adjNote, setAdjNote] = useState("")
  const [adjError, setAdjError] = useState("")

  useEffect(() => {
    setPlannerUrl("")
    setQuote(null)
    setPayAmount("")
    setPayUrl("")
    setTravelResult("")
    if (detail?.order.event_address) setTravelDest(detail.order.event_address)
    setAdjOpen(false)
    setAdjError("")
    setAdjNote("")
    setAdjAdults(String(detail?.order.guest_adult_count ?? 0))
    setAdjKids(String(detail?.order.guest_child_count ?? 0))
    // 差旅费预填:抽屉事件流里最近一次算出的客户侧差旅费
    const travelEvent = (detail?.events ?? []).find(
      (e) => e.action === "travel_distance_calculated" && typeof e.metadata?.customer_fee === "number",
    )
    setAdjTravel(travelEvent ? String(travelEvent.metadata?.customer_fee) : "0")
    setAdjTableware(false)
  }, [detail])

  const adj = useMemo(() => {
    const adults = Math.max(0, Math.floor(Number(adjAdults) || 0))
    const kids = Math.max(0, Math.floor(Number(adjKids) || 0))
    const meal = adults * (Number(adjAdultPrice) || 0) + kids * (Number(adjKidPrice) || 0)
    const mealFloored = adults + kids > 0 ? Math.max(meal, 599) : 0
    const tableware = adjTableware ? (adults + kids) * 15 : 0
    const travel = Number(adjTravel) || 0
    const total = Math.round((mealFloored + tableware + travel) * 100) / 100
    return { adults, kids, meal, mealFloored, minApplied: mealFloored > meal, tableware, travel, total }
  }, [adjAdults, adjKids, adjAdultPrice, adjKidPrice, adjTableware, adjTravel])

  const call = useCallback(
    async (path: string, body: Record<string, unknown>) => {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify(body),
      })
      return res.json()
    },
    [adminKey],
  )

  const copy = (text: string) => {
    try {
      navigator.clipboard.writeText(text)
    } catch {}
  }

  const o = detail?.order

  // SOP 已发状态:order_events 里的 sop_sent 记录
  const doneSopIds = useMemo(() => {
    const done = new Set<string>()
    for (const e of detail?.events ?? []) {
      if (e.action === "sop_sent" && typeof e.metadata?.sop_id === "string") done.add(e.metadata.sop_id as string)
    }
    return done
  }, [detail])

  const sendSop = useCallback(
    async (step: (typeof ORDER_SOP_STEPS)[number]) => {
      if (!o) return
      setSopBusy(step.id)
      try {
        let plannerLink: string | undefined
        if (step.id === "w_planner" && (o.customer_email || o.customer_phone)) {
          const d = await call("/api/admin/planner-link", {
            email: o.customer_email ?? "",
            phone: o.customer_phone ?? "",
            booked: true,
          })
          if (d.ok && typeof d.url === "string") plannerLink = d.url
        }
        const text = step.build({
          firstName: (o.customer_name || "").split(" ")[0] || undefined,
          plannerLink,
          chefName,
          reviewUrl: process.env.NEXT_PUBLIC_GBP_REVIEW_URL,
        })
        copy(text)
        if (o.customer_phone) window.location.href = `sms:${o.customer_phone}?&body=${encodeURIComponent(text)}`
        await call("/api/admin/orders/sop-sent", {
          orderId: o.id,
          sopId: step.id,
          title: step.title,
          operator: localStorage.getItem("rh_operator_name") ?? "staff",
        })
        onChanged()
      } finally {
        setSopBusy(null)
      }
    },
    [o, call, chefName, onChanged],
  )

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 100, display: "flex", justifyContent: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(560px, 100%)", background: "#fff", height: "100%", overflowY: "auto", padding: "20px 22px 60px", boxSizing: "border-box" }}
      >
        {!o ? (
          <p style={{ color: "#9ca3af" }}>加载中…</p>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <strong style={{ fontSize: 17, fontFamily: "ui-monospace, monospace" }}>{o.order_no}</strong>
              <button onClick={onClose} style={{ border: "none", background: "#f3f4f6", borderRadius: 8, width: 30, height: 30, cursor: "pointer" }}>
                ✕
              </button>
            </div>
            <div style={{ fontSize: 14, marginBottom: 2 }}>
              <b>{o.customer_name || "—"}</b> · {o.customer_phone || "无电话"} · {o.customer_email || "无邮箱"}
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>
              {eventLabel(o.event_start, now)} · {o.event_address || "地址未填"} · 大人 {o.guest_adult_count ?? 0} / 小孩 {o.guest_child_count ?? 0}
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13, background: "#f9fafb", border: "1px solid #f3f4f6", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
              <span>押金 <b>{money(o.deposit_paid_total_cents)}</b>{o.deposit_status === "paid_verified" ? " ✓" : ""}</span>
              <span>总报价 <b>{money(o.quoted_total_cents)}</b></span>
              <span>已收 <b>{money(o.amount_paid_total_cents)}</b></span>
              <span>尾款 <b>{money(o.balance_due_cents)}</b></span>
              <span>细节 <b>{o.details_status === "complete" ? "已齐" : "未齐"}</b></span>
              {typeof o.source_metadata?.lead_id === "string" && (
                <a href="/admin/leads" style={{ color: "#1d4ed8" }}>
                  来源线索 →
                </a>
              )}
            </div>

            {/* ---------- 快捷动作 ---------- */}
            <div style={labelStyle}>快捷动作</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
              <button
                style={btnGhost}
                disabled={busy === "planner"}
                onClick={async () => {
                  setBusy("planner")
                  const data = await call("/api/admin/planner-link", { email: o.customer_email ?? "", phone: o.customer_phone ?? "", booked: true })
                  setBusy(null)
                  if (data.ok && data.url) {
                    setPlannerUrl(data.url)
                    copy(data.url)
                  } else {
                    setPlannerUrl(`失败:${data.error ?? "unknown"}`)
                  }
                }}
              >
                🎪 布置工具链接{busy === "planner" ? "…" : ""}
              </button>
              <button
                style={btnGhost}
                disabled={busy === "quote"}
                onClick={async () => {
                  setBusy("quote")
                  const data = await call("/api/admin/pay-link", { action: "quote", email: o.customer_email ?? "", phone: o.customer_phone ?? "" })
                  setBusy(null)
                  setQuote(data)
                  if (typeof data.balanceDue === "number") setPayAmount(String(data.balanceDue))
                }}
              >
                💳 尾款报价{busy === "quote" ? "…" : ""}
              </button>
            </div>
            {plannerUrl && (
              <div style={{ fontSize: 12.5, color: "#065f46", background: "#d1fae5", borderRadius: 8, padding: "7px 10px", marginBottom: 6, wordBreak: "break-all" }}>
                已复制:{plannerUrl}
              </div>
            )}
            {quote && (
              <div style={{ fontSize: 13, background: "#eff6ff", border: "1px solid #dbeafe", borderRadius: 8, padding: "10px 12px", marginBottom: 6 }}>
                {quote.found === false ? (
                  "invoice 系统查不到这单的报价"
                ) : (
                  <>
                    实时尾款 <b>${quote.balanceDue?.toFixed?.(2) ?? quote.balanceDue}</b>(总额 ${quote.finalTotal?.toFixed?.(2) ?? "—"} − 已付订金 $
                    {quote.deposit?.toFixed?.(2) ?? "—"})
                    <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 12.5 }}>收款 $</span>
                      <input style={{ ...inputStyle, width: 110, padding: "6px 9px" }} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                      <button
                        style={{ ...btnStyle, padding: "6px 12px" }}
                        disabled={busy === "mint"}
                        onClick={async () => {
                          const amount = Number(payAmount)
                          if (!Number.isFinite(amount) || amount <= 0) return
                          setBusy("mint")
                          const data = await call("/api/admin/pay-link", {
                            amount,
                            customerName: o.customer_name ?? "",
                            note: `Order ${o.order_no}`,
                          })
                          setBusy(null)
                          if (data.ok && data.url) {
                            setPayUrl(data.url)
                            copy(data.url)
                          } else {
                            setPayUrl(`失败:${data.error ?? "unknown"}`)
                          }
                        }}
                      >
                        生成收款链接(+4% 卡费)
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {payUrl && (
              <div style={{ fontSize: 12.5, color: "#065f46", background: "#d1fae5", borderRadius: 8, padding: "7px 10px", marginBottom: 6, wordBreak: "break-all" }}>
                已复制:{payUrl}
              </div>
            )}

            {/* ---------- 人数/报价调整:人数到活动前一天都可能变 ---------- */}
            <div style={labelStyle}>人数 / 报价调整</div>
            {!adjOpen ? (
              <button style={btnGhost} onClick={() => setAdjOpen(true)}>
                ✏️ 调整人数或金额
              </button>
            ) : (
              <div style={{ border: "1px solid #fcd34d", borderRadius: 10, padding: "10px 12px", background: "#fffbeb", marginBottom: 6 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))", gap: 8 }}>
                  <label style={{ fontSize: 12, color: "#6b7280" }}>
                    大人
                    <input style={{ ...inputStyle, marginTop: 3, padding: "6px 9px" }} inputMode="numeric" value={adjAdults} onChange={(e) => setAdjAdults(e.target.value)} />
                  </label>
                  <label style={{ fontSize: 12, color: "#6b7280" }}>
                    小孩 5-12
                    <input style={{ ...inputStyle, marginTop: 3, padding: "6px 9px" }} inputMode="numeric" value={adjKids} onChange={(e) => setAdjKids(e.target.value)} />
                  </label>
                  <label style={{ fontSize: 12, color: "#6b7280" }}>
                    大人单价 $
                    <input style={{ ...inputStyle, marginTop: 3, padding: "6px 9px" }} inputMode="decimal" value={adjAdultPrice} onChange={(e) => setAdjAdultPrice(e.target.value)} />
                  </label>
                  <label style={{ fontSize: 12, color: "#6b7280" }}>
                    小孩单价 $
                    <input style={{ ...inputStyle, marginTop: 3, padding: "6px 9px" }} inputMode="decimal" value={adjKidPrice} onChange={(e) => setAdjKidPrice(e.target.value)} />
                  </label>
                  <label style={{ fontSize: 12, color: "#6b7280" }}>
                    差旅费 $
                    <input style={{ ...inputStyle, marginTop: 3, padding: "6px 9px" }} inputMode="decimal" value={adjTravel} onChange={(e) => setAdjTravel(e.target.value)} />
                  </label>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#374151", marginTop: 8 }}>
                  <input type="checkbox" checked={adjTableware} onChange={(e) => setAdjTableware(e.target.checked)} />
                  桌椅餐具租赁(×$15/人)
                </label>
                <div style={{ fontSize: 13, marginTop: 8, background: "#fff", border: "1px solid #fde68a", borderRadius: 8, padding: "8px 10px" }}>
                  餐费 ${adj.mealFloored.toFixed(2)}
                  {adj.minApplied ? "(已按 $599 起步价)" : ""}
                  {adj.tableware > 0 ? ` + 桌椅 $${adj.tableware.toFixed(2)}` : ""}
                  {adj.travel > 0 ? ` + 差旅 $${adj.travel.toFixed(2)}` : ""}
                  {" = "}
                  <b>总报价 ${adj.total.toFixed(2)}</b>
                  <span style={{ color: "#6b7280" }}>
                    {" "}· 已付 {money((o.deposit_paid_total_cents ?? 0) + (o.amount_paid_total_cents ?? 0))} · 尾款约{" "}
                    {money(Math.max(0, Math.round(adj.total * 100) - (o.deposit_paid_total_cents ?? 0) - (o.amount_paid_total_cents ?? 0)))}
                  </span>
                </div>
                <input
                  style={{ ...inputStyle, marginTop: 8, padding: "6px 9px", fontSize: 12.5 }}
                  value={adjNote}
                  onChange={(e) => setAdjNote(e.target.value)}
                  placeholder="备注(例:客人预计 17 人,待活动前确认)"
                />
                {adjError && <div style={{ fontSize: 12.5, color: "#b91c1c", marginTop: 6 }}>{adjError}</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    style={btnStyle}
                    disabled={busy === "adjust"}
                    onClick={async () => {
                      setBusy("adjust")
                      setAdjError("")
                      const data = await call("/api/admin/orders/adjust", {
                        orderId: o.id,
                        adults: adj.adults,
                        kids: adj.kids,
                        quotedTotalCents: Math.round(adj.total * 100),
                        breakdown: {
                          adult_price: Number(adjAdultPrice) || 0,
                          kid_price: Number(adjKidPrice) || 0,
                          meal: adj.mealFloored,
                          minimum_applied: adj.minApplied,
                          tableware: adj.tableware,
                          travel: adj.travel,
                        },
                        note: adjNote,
                        operator: localStorage.getItem("rh_operator_name") ?? "staff",
                      })
                      setBusy(null)
                      if (data.ok) {
                        setAdjOpen(false)
                        onChanged()
                      } else {
                        setAdjError(`保存失败:${data.error ?? "unknown"}`)
                      }
                    }}
                  >
                    {busy === "adjust" ? "保存中…" : "保存调整"}
                  </button>
                  <button style={btnGhost} onClick={() => setAdjOpen(false)}>
                    取消
                  </button>
                </div>
              </div>
            )}

            {/* ---------- 成单 SOP(从线索台 won 阶段迁入) ---------- */}
            <div style={labelStyle}>成单 SOP</div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "8px 12px", background: "#fafafa", marginBottom: 10 }}>
              {(() => {
                const currentSopStage = sopStageOf(stageOf(o, now))
                const nextId = ORDER_SOP_STEPS.find((s) => !doneSopIds.has(s.id) && s.stage === currentSopStage)?.id
                return ORDER_SOP_STEPS.map((s) => {
                  const done = doneSopIds.has(s.id)
                  const isNext = s.id === nextId
                  return (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid #f3f4f6" }}>
                      <span style={{ fontSize: 13, width: 18 }}>{done ? "✅" : isNext ? "▶" : "○"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: isNext ? 700 : 500, color: done ? "#9ca3af" : "#111827", textDecoration: done ? "line-through" : "none" }}>
                          {s.emoji} {s.title}
                        </p>
                        <p style={{ margin: 0, fontSize: 11.5, color: "#6b7280" }}>{s.when}</p>
                        {s.id === "w_confirm48" && !done && (
                          <input
                            style={{ ...inputStyle, marginTop: 4, padding: "5px 8px", fontSize: 12.5, width: 160 }}
                            value={chefName}
                            onChange={(e) => setChefName(e.target.value)}
                            placeholder="厨师实名"
                          />
                        )}
                      </div>
                      <button
                        onClick={() => sendSop(s)}
                        disabled={done || sopBusy === s.id}
                        style={{
                          padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: done ? "default" : "pointer",
                          border: "1px solid " + (done ? "#e5e7eb" : isNext ? "#0f766e" : "#d1d5db"),
                          background: done ? "#f9fafb" : isNext ? "#0f766e" : "#fff",
                          color: done ? "#c0c4cc" : isNext ? "#fff" : "#374151",
                        }}
                      >
                        {done ? "已发" : sopBusy === s.id ? "…" : "发送"}
                      </button>
                    </div>
                  )
                })
              })()}
            </div>

            {/* ---------- 算路费 ---------- */}
            <div style={labelStyle}>算路费(驾车距离)</div>
            <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 6 }}>基地出发,一次算两侧:客户按共享政策计费,师傅按同程里程结。目的地默认活动地址。</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <input style={{ ...inputStyle, flex: 1 }} value={travelDest} onChange={(e) => setTravelDest(e.target.value)} placeholder="目的地(活动地址 / zip)" />
              <button
                style={{ ...btnGhost, whiteSpace: "nowrap" }}
                disabled={busy === "travel" || !travelDest.trim()}
                onClick={async () => {
                  setBusy("travel")
                  const data = await call("/api/admin/orders/travel-fee", {
                    orderId: o.id,
                    destination: travelDest,
                    operator: localStorage.getItem("rh_operator_name") ?? "staff",
                  })
                  setBusy(null)
                  setTravelResult(
                    data.ok
                      ? `${data.miles} mi(${data.origin} → ${data.destination},${data.provider})· 客户路费 $${data.customerFee}(免 ${data.freeRadiusMiles} mi,$${data.ratePerMile}/mi)· 师傅同程 ${data.miles} mi`
                      : `失败:${data.error}`,
                  )
                }}
              >
                🚗 算路费{busy === "travel" ? "…" : ""}
              </button>
            </div>
            {travelResult && (
              <div style={{ fontSize: 12.5, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: "7px 10px", marginBottom: 6 }}>
                {travelResult}
                {travelResult.startsWith("失败") ? "" : " · 已记入时间线"}
              </div>
            )}
            {travelResult && !travelResult.startsWith("失败") && (
              <button style={{ ...btnGhost, padding: "5px 10px", fontSize: 12.5, marginBottom: 6 }} onClick={onChanged}>
                刷新时间线
              </button>
            )}

            {/* ---------- 收款记录 ---------- */}
            <div style={labelStyle}>收款记录</div>
            {detail!.payments.length === 0 ? (
              <p style={{ fontSize: 13, color: "#9ca3af", margin: "4px 0 10px" }}>还没有收款记录</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                {detail!.payments.map((p) => (
                  <div key={p.id} style={{ fontSize: 13, border: "1px solid #f3f4f6", borderRadius: 8, padding: "8px 10px", display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span>
                      {p.type === "deposit" ? "押金" : "尾款"} · {p.provider}
                      {p.transaction_ref ? ` · ${p.transaction_ref}` : ""}
                    </span>
                    <span style={{ whiteSpace: "nowrap" }}>
                      <b>{money(p.status === "refunded" ? -p.amount_cents : p.amount_cents)}</b>
                      {p.status === "refunded" ? " 已退" : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* ---------- 时间线 ---------- */}
            <div style={labelStyle}>时间线</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {detail!.events.map((e) => (
                <div key={e.id} style={{ borderLeft: "2px solid #e5e7eb", padding: "6px 0 6px 12px", marginLeft: 4 }}>
                  <div style={{ fontSize: 13 }}>
                    <b>{e.action}</b> <span style={{ color: "#9ca3af" }}>· {e.actor}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {new Date(e.created_at).toLocaleString()}
                    {e.metadata && Object.keys(e.metadata).length > 0 ? ` · ${JSON.stringify(e.metadata).slice(0, 160)}` : ""}
                  </div>
                </div>
              ))}
              {detail!.events.length === 0 && <p style={{ fontSize: 13, color: "#9ca3af" }}>暂无事件</p>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ============================================================
// 手动押金确认(Venmo / Zelle / 现金 → 晋升为订单)
// ============================================================
function ManualDepositModal({ adminKey, onClose, onCreated }: { adminKey: string; onClose: () => void; onCreated: () => void }) {
  const [wonLeads, setWonLeads] = useState<LeadOption[]>([])
  const [form, setForm] = useState({
    leadId: "",
    customerName: "",
    email: "",
    phone: "",
    eventDate: "",
    eventTime: "18:00",
    eventAddress: "",
    adults: "",
    kids: "",
    amount: "",
    channel: "venmo",
    proofUrl: "",
    operator: "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState("")

  useEffect(() => {
    try {
      const op = window.localStorage.getItem("rh_operator_name")
      if (op) setForm((f) => ({ ...f, operator: op }))
    } catch {}
    fetch("/api/admin/leads?limit=200", { headers: { "x-admin-key": adminKey }, cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        const rows: LeadOption[] = (data.leads ?? []).filter((l: LeadOption) => l.status === "won" || l.status === "qualified")
        setWonLeads(rows)
      })
      .catch(() => {})
  }, [adminKey])

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 12, width: "min(480px, 100%)", maxHeight: "92vh", overflowY: "auto", padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <strong style={{ fontSize: 16 }}>手动押金确认</strong>
          <button onClick={onClose} style={{ border: "none", background: "#f3f4f6", borderRadius: 8, width: 30, height: 30, cursor: "pointer" }}>
            ✕
          </button>
        </div>
        <p style={{ fontSize: 12.5, color: "#6b7280", margin: "0 0 8px" }}>
          Venmo / Zelle / 现金收到押金后在这里确认 —— 立即晋升为正式订单(铸 RH- 单号),与 Stripe 同一条链路。记操作人 + 凭证链接,先审计后审批。
        </p>

        {wonLeads.length > 0 && (
          <>
            <div style={labelStyle}>从线索快速填入(可选)</div>
            <select
              style={inputStyle}
              value={form.leadId}
              onChange={(e) => {
                const lead = wonLeads.find((l) => l.id === e.target.value)
                if (!lead) {
                  set("leadId", "")
                  return
                }
                setForm((f) => ({
                  ...f,
                  leadId: lead.id,
                  customerName: lead.full_name ?? f.customerName,
                  email: lead.email ?? f.email,
                  phone: lead.phone ?? f.phone,
                  adults: lead.guest_count ? String(lead.guest_count) : f.adults,
                }))
              }}
            >
              <option value="">— 不关联线索 —</option>
              {wonLeads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.full_name || l.phone || l.email} ({l.status})
                </option>
              ))}
            </select>
          </>
        )}

        <div style={labelStyle}>客户姓名 *</div>
        <input style={inputStyle} value={form.customerName} onChange={(e) => set("customerName", e.target.value)} />
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>电话</div>
            <input style={inputStyle} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>邮箱</div>
            <input style={inputStyle} value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>活动日期 *</div>
            <input style={inputStyle} type="date" value={form.eventDate} onChange={(e) => set("eventDate", e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>时间</div>
            <input style={inputStyle} type="time" value={form.eventTime} onChange={(e) => set("eventTime", e.target.value)} />
          </div>
        </div>
        <div style={labelStyle}>活动地址 / zip</div>
        <input style={inputStyle} value={form.eventAddress} onChange={(e) => set("eventAddress", e.target.value)} />
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>大人</div>
            <input style={inputStyle} inputMode="numeric" value={form.adults} onChange={(e) => set("adults", e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>小孩</div>
            <input style={inputStyle} inputMode="numeric" value={form.kids} onChange={(e) => set("kids", e.target.value)} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>押金金额 $ *</div>
            <input style={inputStyle} inputMode="decimal" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>渠道 *</div>
            <select style={inputStyle} value={form.channel} onChange={(e) => set("channel", e.target.value)}>
              <option value="venmo">Venmo</option>
              <option value="zelle">Zelle</option>
              <option value="cash">现金</option>
              <option value="other">其他</option>
            </select>
          </div>
        </div>
        <div style={labelStyle}>凭证截图链接(收款截图,建议填)</div>
        <input style={inputStyle} value={form.proofUrl} onChange={(e) => set("proofUrl", e.target.value)} placeholder="https://…" />
        <div style={labelStyle}>操作人 *</div>
        <input
          style={inputStyle}
          value={form.operator}
          onChange={(e) => {
            set("operator", e.target.value)
            try {
              window.localStorage.setItem("rh_operator_name", e.target.value)
            } catch {}
          }}
          placeholder="你的名字"
        />

        {result && (
          <div
            style={{
              marginTop: 12,
              fontSize: 13,
              borderRadius: 8,
              padding: "9px 12px",
              background: result.startsWith("✅") ? "#d1fae5" : "#fee2e2",
              color: result.startsWith("✅") ? "#065f46" : "#b91c1c",
            }}
          >
            {result}
          </div>
        )}

        <button
          style={{ ...btnStyle, width: "100%", marginTop: 14, padding: "11px 0", opacity: submitting ? 0.6 : 1 }}
          disabled={submitting}
          onClick={async () => {
            if (!form.customerName.trim() || !form.eventDate || !form.amount || !form.operator.trim()) {
              setResult("姓名、活动日期、金额、操作人是必填的")
              return
            }
            if (!form.phone.trim() && !form.email.trim()) {
              setResult("电话或邮箱至少填一个(布置工具和查单都靠它)")
              return
            }
            setSubmitting(true)
            setResult("")
            try {
              const res = await fetch("/api/admin/orders/deposit-confirm", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
                body: JSON.stringify({
                  leadId: form.leadId || undefined,
                  customerName: form.customerName,
                  email: form.email || undefined,
                  phone: form.phone || undefined,
                  eventDate: form.eventDate,
                  eventTime: form.eventTime || undefined,
                  eventAddress: form.eventAddress || undefined,
                  adults: form.adults ? Number(form.adults) : undefined,
                  kids: form.kids ? Number(form.kids) : undefined,
                  amount: Number(form.amount),
                  channel: form.channel,
                  proofUrl: form.proofUrl || undefined,
                  operator: form.operator,
                }),
              })
              const data = await res.json()
              if (data.ok) {
                setResult(`✅ 已晋升为订单 ${data.orderNo ?? ""}`)
                setTimeout(onCreated, 1200)
              } else {
                setResult(`失败:${data.error ?? res.status}`)
              }
            } catch (err) {
              setResult(`失败:${String(err)}`)
            } finally {
              setSubmitting(false)
            }
          }}
        >
          {submitting ? "确认中…" : "确认押金 → 晋升为订单"}
        </button>
      </div>
    </div>
  )
}
