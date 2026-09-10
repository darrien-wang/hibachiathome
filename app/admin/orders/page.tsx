"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ORDER_SOP_STEPS, type OrderSopStage } from "@/lib/order-sop"
import { Car, CreditCard, FileText, Mail, Plus, Tent } from "lucide-react"
import { phone } from "@/config/site"

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

type AdMonth = { month: string; cost: number; clicks: number; impressions: number; conversions: number }

type AdSpendState = {
  status: "idle" | "loading" | "ok" | "error"
  months: AdMonth[]
  stale?: boolean
}

type EventRow = {
  id: string
  actor: string | null
  action: string
  metadata: Record<string, unknown> | null
  created_at: string
}

type UpdateRequestRow = {
  id: string
  status: string
  customer_name: string | null
  customer_message: string | null
  change_summary: Array<{ field: string; label: string; before: string; after: string }> | null
  confirmed_at: string | null
  chef_notified_at: string | null
  created_at: string
}

type PendingUpdateRef = { order_id: string | null; external_order_id: string | null; status: string }

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

// 月份归档键。两套口径的时间基准不一样,必须分开处理:
//   event  = 活动月。event_start 全链路是"墙上时间存成 UTC",取 UTC 年月。
//   booked = 下单月。created_at 是真实时刻,按洛杉矶时间切月才符合"这个月
//            接了几单"的直觉。
function monthKeyOf(iso: string | null, mode: "event" | "booked"): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  if (mode === "event") {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d)
  const y = parts.find((x) => x.type === "year")?.value
  const m = parts.find((x) => x.type === "month")?.value
  return y && m ? `${y}-${m}` : null
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-")
  return `${y} 年 ${Number(m)} 月`
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

// ============================================================
// ✉️ 客户邮件模板
// ============================================================
// 订单侧边栏点邮箱即起草,服务端从 support@realhibachi.com 发出(Resend 已验证
// 的发件人),客户回信也落回 support@ —— 绝不走个人邮箱,否则回复进了没人看的
// 收件箱,单子就这么静悄悄丢了。

// event_start 是"墙上时间存成 UTC"(见 eventLabel),客户邮件里也必须照读 UTC
// 字段,否则发出去的时间会被浏览器时区平移几小时。
function customerEventTime(iso: string | null): string {
  if (!iso) return ""
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return ""
  const d = new Date(ms)
  const day = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" })
  const h24 = d.getUTCHours()
  const mm = String(d.getUTCMinutes()).padStart(2, "0")
  const h12 = h24 % 12 || 12
  return `${day} at ${h12}:${mm}${h24 >= 12 ? "pm" : "am"}`
}

type EmailTemplateId = "details" | "balance" | "thanks"

const EMAIL_TEMPLATES: Array<{ id: EmailTemplateId; label: string }> = [
  { id: "details", label: "收细节" },
  { id: "balance", label: "确认 + 尾款" },
  { id: "thanks", label: "活动后致谢" },
]

const SIGN_OFF = `\n\nBling\nReal Hibachi · www.realhibachi.com\nsupport@realhibachi.com · ${phone.sms.dashed}`

function buildOrderEmail(o: OrderRow, template: EmailTemplateId): { subject: string; body: string } {
  const firstName = (o.customer_name || "").split(" ")[0]
  const hi = `Hi${firstName ? " " + firstName : ""},`
  const when = customerEventTime(o.event_start)
  const guests = (o.guest_adult_count ?? 0) + (o.guest_child_count ?? 0)
  const whereLine = o.event_address ? ` at ${o.event_address}` : ""
  const eventLine = when
    ? `Your hibachi party is set for ${when}${whereLine}${guests > 0 ? ` for ${guests} guests` : ""}.`
    : `Your hibachi party is confirmed${whereLine}${guests > 0 ? ` for ${guests} guests` : ""}.`
  const balance = o.balance_due_cents ?? 0
  const balanceLine =
    balance > 0
      ? `Your remaining balance is ${money(balance)}, due on the day of the event - cash, Zelle, Venmo or card all work.`
      : `Your balance is fully settled - nothing more to pay.`

  if (template === "details") {
    return {
      subject: `Real Hibachi ${o.order_no} - a few details to lock in`,
      body: `${hi}\n\n${eventLine} We're looking forward to cooking for you!\n\nTo finish your order we just need a few things back from you:\n\n1. Protein choice for each guest - chicken, steak, shrimp, salmon or tofu are included; filet mignon and lobster are available as upgrades.\n2. The exact setup spot - backyard, patio, driveway - and where we can park.\n3. Any allergies or dietary restrictions we should cook around.\n\nJust reply to this email with those three and we'll take care of the rest.\n\n${balanceLine}${SIGN_OFF}`,
    }
  }

  if (template === "thanks") {
    const reviewUrl = process.env.NEXT_PUBLIC_GBP_REVIEW_URL
    return {
      subject: `Thank you from Real Hibachi \u{1F64F}`,
      body: `${hi}\n\nThank you for having us${when ? ` on ${when}` : ""} - we had a great time cooking for your group, and we hope the food and the show lived up to it.\n\nIf you enjoyed it, a quick review helps a small family business more than you'd guess:\n${reviewUrl || "https://g.page/r/realhibachi/review"}\n\nAnd whenever the next birthday, graduation or backyard get-together comes around, just reply to this email - we'll hold your date.${SIGN_OFF}`,
    }
  }

  return {
    subject: `Real Hibachi ${o.order_no} - you're confirmed \u{1F389}`,
    body: `${hi}\n\n${eventLine} Everything on our side is confirmed.\n\nHere's what happens next:\n\n1. We confirm your chef by name 48 hours before the event.\n2. Your chef arrives about 15 minutes early to set up - we bring the grill, and clean up everything we bring.\n3. Please have a flat spot roughly 6 x 6 feet outdoors, and let us know if parking is tight.\n\n${balanceLine}\n\nAnything you'd like to change - guest count, menu, timing - just reply to this email and we'll update your order.${SIGN_OFF}`,
  }
}

const inputStyle: React.CSSProperties = { padding: "9px 11px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, width: "100%", boxSizing: "border-box" }
const labelStyle: React.CSSProperties = { fontSize: 12, color: "#6b7280", margin: "12px 0 5px", fontWeight: 600 }
const btnStyle: React.CSSProperties = { padding: "8px 14px", borderRadius: 8, border: "1px solid #111827", background: "#111827", color: "#fff", fontSize: 13.5, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }
const btnGhost: React.CSSProperties = { ...btnStyle, background: "#fff", color: "#111827", border: "1px solid #d1d5db" }

export default function OrdersWorkbench() {
  const [adminKey, setAdminKey] = useState("")
  const [keyInput, setKeyInput] = useState("")
  const [authFailed, setAuthFailed] = useState(false)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(false)
  const [showBoard, setShowBoard] = useState(false)
  const [boardBasis, setBoardBasis] = useState<"event" | "booked">("booked")
  const [adSpend, setAdSpend] = useState<AdSpendState>({ status: "idle", months: [] })
  const [stageFilter, setStageFilter] = useState<Stage | "全部">("全部")
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<{ order: OrderRow; payments: PaymentRow[]; events: EventRow[]; updateRequests: UpdateRequestRow[] } | null>(null)
  const [pendingUpdates, setPendingUpdates] = useState<PendingUpdateRef[]>([])
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
      setPendingUpdates(data.pendingUpdateRequests ?? [])
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
        if (data.ok) setDetail({ order: data.order, payments: data.payments, events: data.events, updateRequests: data.updateRequests ?? [] })
      } catch {}
    },
    [adminKey],
  )

  const hasPendingUpdate = useCallback(
    (o: OrderRow) => pendingUpdates.some((p) => p.order_id === o.id || (o.source_ref && p.external_order_id === o.source_ref)),
    [pendingUpdates],
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

  // 广告花费只在看板真正打开时才拉 —— 平时用不到,不必每次进工作台都去
  // 敲一次 Google Ads API。服务端还有 15 分钟缓存兜着。
  useEffect(() => {
    if (!showBoard || !adminKey) return
    if (adSpend.status === "loading" || adSpend.status === "ok") return
    let cancelled = false
    setAdSpend({ status: "loading", months: [] })
    ;(async () => {
      try {
        const res = await fetch("/api/admin/ads-spend", { headers: { "x-admin-key": adminKey }, cache: "no-store" })
        const data = await res.json()
        if (cancelled) return
        if (data.ok) setAdSpend({ status: "ok", months: data.months ?? [], stale: data.stale })
        else setAdSpend({ status: "error", months: [] })
      } catch {
        if (!cancelled) setAdSpend({ status: "error", months: [] })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showBoard, adminKey, adSpend.status])

  // ============================================================
  // 月度营业额看板
  // ============================================================
  // 按"活动月份"归账,不是按下单月份也不是按收款月份:这门生意按场交付,
  // 9 月办的派对就算 9 月的营业额,哪怕客人 7 月就下了单、尾款 10 月才收。
  // event_start 全链路是"墙上时间存成 UTC",所以这里取 UTC 年月,和表格里
  // 的日期显示保持同一套口径。
  //
  // 三个金额列分开摆,不合并成一个"营业额":
  //   合同额 = quoted_total_cents,这个月接了多少生意
  //   已收   = amount_paid_total_cents,订金+尾款,Stripe 和手工确认都算
  //   待收   = balance_due_cents,还没收回来的
  // 已办完的单实收常常高于合同额(临时加人、小费),所以两列都给,不去猜
  // 哪个才算"真"营业额。取消的单全程不计入。
  const monthlyStats = useMemo(() => {
    const spendByMonth = new Map(adSpend.months.map((m) => [m.month, m]))
    const buckets = new Map<
      string,
      { key: string; label: string; count: number; quoted: number; paid: number; due: number; guests: number }
    >()
    for (const o of orders) {
      if (o.order_status === "cancelled") continue
      const key = monthKeyOf(boardBasis === "event" ? o.event_start : o.created_at, boardBasis) ?? "未排期"
      const label = key === "未排期" ? "未排期" : monthLabel(key)
      const b = buckets.get(key) ?? { key, label, count: 0, quoted: 0, paid: 0, due: 0, guests: 0 }
      b.count += 1
      b.quoted += o.quoted_total_cents ?? 0
      b.paid += o.amount_paid_total_cents ?? 0
      b.due += o.balance_due_cents ?? 0
      b.guests += (o.guest_adult_count ?? 0) + (o.guest_child_count ?? 0)
      buckets.set(key, b)
    }
    // 有花广告但当月一单没成的月份也要出现 —— 那正是最该被看见的月份。
    for (const m of adSpend.months) {
      if (m.cost > 0 && !buckets.has(m.month)) {
        buckets.set(m.month, { key: m.month, label: monthLabel(m.month), count: 0, quoted: 0, paid: 0, due: 0, guests: 0 })
      }
    }
    const rows = [...buckets.values()]
      .sort((a, b) => {
        if (a.key === "未排期") return 1
        if (b.key === "未排期") return -1
        return a.key < b.key ? 1 : -1
      })
      .map((r) => {
        const spend = spendByMonth.get(r.key)?.cost ?? null
        return {
          ...r,
          spendCents: spend === null ? null : Math.round(spend * 100),
        }
      })
    const peak = rows.reduce((max, r) => (r.quoted > max ? r.quoted : max), 0)
    const total = rows.reduce(
      (acc, r) => ({
        count: acc.count + r.count,
        quoted: acc.quoted + r.quoted,
        paid: acc.paid + r.paid,
        due: acc.due + r.due,
        guests: acc.guests + r.guests,
        spendCents: acc.spendCents + (r.spendCents ?? 0),
      }),
      { count: 0, quoted: 0, paid: 0, due: 0, guests: 0, spendCents: 0 }
    )
    return { rows, peak, total }
  }, [orders, boardBasis, adSpend])

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
          <button style={showBoard ? btnStyle : btnGhost} onClick={() => setShowBoard((v) => !v)}>
            📊 月度看板
          </button>
          <button style={btnGhost} onClick={fetchOrders}>
            {loading ? "刷新中…" : "刷新"}
          </button>
          <button style={btnStyle} onClick={() => setShowDeposit(true)}>
            <Plus size={15} /> 手动押金确认
          </button>
        </div>
      </div>

      {showBoard && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", padding: "14px 16px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            <strong style={{ fontSize: 15 }}>月度营业额 · 广告成本</strong>
            <div style={{ display: "flex", gap: 6 }}>
              {([
                { id: "booked", label: "按下单月" },
                { id: "event", label: "按活动月" },
              ] as const).map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBoardBasis(b.id)}
                  style={{
                    padding: "4px 11px",
                    borderRadius: 999,
                    fontSize: 12.5,
                    cursor: "pointer",
                    border: "1px solid " + (boardBasis === b.id ? "#111827" : "#d1d5db"),
                    background: boardBasis === b.id ? "#111827" : "#fff",
                    color: boardBasis === b.id ? "#fff" : "#374151",
                  }}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <p style={{ margin: "0 0 4px", fontSize: 12, color: "#6b7280" }}>
            {boardBasis === "booked"
              ? "按订单成交的月份归账。广告费也是自然月,两者对得上,所以这个口径下的获客成本和 ROAS 才有意义。"
              : "按派对举办的月份归账 —— 看产能和交付节奏用这个。广告费花在成交前,和活动月错位,所以不在这个口径下算获客成本。"}
          </p>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "#6b7280" }}>
            合同额 = 报价总额;已收含订金+尾款(现金/Venmo/Zelle 手工确认的也算);已办完的单实收可能高于合同额(临时加人、小费)。
            获客成本 = 当月广告费 ÷ 当月总单数,是<b>混合</b>口径 —— 只有一单带得上 gclid,分不出哪些单真由广告带来,所以不装作能分。
          </p>

          {adSpend.status === "error" && (
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "#b45309" }}>
              广告数据拉取失败,营业额部分不受影响。广告列显示为 —。
            </p>
          )}
          {adSpend.stale && (
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "#b45309" }}>广告数据是上一次成功拉取的缓存。</p>
          )}

          {monthlyStats.rows.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>还没有订单。</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13, minWidth: 820 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#6b7280", fontSize: 12 }}>
                    <th style={{ padding: "6px 8px", fontWeight: 600 }}>月份</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>单数</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>合同额</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>已收</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>待收</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>客单价</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>广告费</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>获客成本</th>
                    <th style={{ padding: "6px 8px", fontWeight: 600, textAlign: "right" }}>ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyStats.rows.map((r) => {
                    const canAttribute = boardBasis === "booked" && r.spendCents !== null && r.spendCents > 0
                    return (
                      <tr key={r.key} style={{ borderTop: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "7px 8px", whiteSpace: "nowrap" }}>
                          <div style={{ fontWeight: 600 }}>{r.label}</div>
                          {/* 条形按最高月归一,一眼看出哪个月最重 */}
                          <div style={{ height: 4, borderRadius: 2, background: "#f3f4f6", marginTop: 4, width: 110 }}>
                            <div
                              style={{
                                height: 4,
                                borderRadius: 2,
                                background: "#0f766e",
                                width: monthlyStats.peak > 0 ? Math.round((r.quoted / monthlyStats.peak) * 100) + "%" : "0%",
                              }}
                            />
                          </div>
                        </td>
                        <td style={{ padding: "7px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.count || "—"}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{r.quoted ? money(r.quoted) : "—"}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#16a34a" }}>{r.paid ? money(r.paid) : "—"}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: r.due > 0 ? "#b45309" : "#9ca3af" }}>{r.due ? money(r.due) : "—"}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{r.count > 0 ? money(Math.round(r.quoted / r.count)) : "—"}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#dc2626" }}>
                          {r.spendCents === null ? "—" : money(r.spendCents)}
                        </td>
                        <td style={{ padding: "7px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{canAttribute && r.count > 0 ? money(Math.round(r.spendCents! / r.count)) : "—"}</td>
                        <td style={{ padding: "7px 8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{canAttribute && r.quoted > 0 ? (r.quoted / r.spendCents!).toFixed(1) + "x" : "—"}</td>
                      </tr>
                    )
                  })}
                  <tr style={{ borderTop: "2px solid #e5e7eb", fontWeight: 700 }}>
                    <td style={{ padding: "8px" }}>合计</td>
                    <td style={{ padding: "8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{monthlyStats.total.count}</td>
                    <td style={{ padding: "8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{money(monthlyStats.total.quoted)}</td>
                    <td style={{ padding: "8px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#16a34a" }}>{money(monthlyStats.total.paid)}</td>
                    <td style={{ padding: "8px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: monthlyStats.total.due > 0 ? "#b45309" : "#9ca3af" }}>{money(monthlyStats.total.due)}</td>
                    <td style={{ padding: "8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {monthlyStats.total.count > 0 ? money(Math.round(monthlyStats.total.quoted / monthlyStats.total.count)) : "—"}
                    </td>
                    <td style={{ padding: "8px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#dc2626" }}>
                      {monthlyStats.total.spendCents > 0 ? money(monthlyStats.total.spendCents) : "—"}
                    </td>
                    <td style={{ padding: "8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {boardBasis === "booked" && monthlyStats.total.spendCents > 0 && monthlyStats.total.count > 0
                        ? money(Math.round(monthlyStats.total.spendCents / monthlyStats.total.count))
                        : "—"}
                    </td>
                    <td style={{ padding: "8px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      {boardBasis === "booked" && monthlyStats.total.spendCents > 0
                        ? (monthlyStats.total.quoted / monthlyStats.total.spendCents).toFixed(1) + "x"
                        : "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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
                  <td style={{ padding: "10px 14px", fontFamily: "ui-monospace, monospace", fontSize: 12.5, whiteSpace: "nowrap" }}>
                    {o.order_no}
                    {hasPendingUpdate(o) && (
                      <span title="客户提交了修改待处理" style={{ marginLeft: 6, background: "#fef3c7", color: "#92400e", borderRadius: 999, padding: "1px 8px", fontSize: 11, fontFamily: "system-ui, sans-serif" }}>
                        有修改
                      </span>
                    )}
                  </td>
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
  const [finalAmount, setFinalAmount] = useState("")
  const [finalChannel, setFinalChannel] = useState("cash")
  const [finalProof, setFinalProof] = useState("")
  const [finalMsg, setFinalMsg] = useState("")
  const [emailDraft, setEmailDraft] = useState<{ template: EmailTemplateId; to: string; cc: string; subject: string; body: string } | null>(null)
  const [emailSending, setEmailSending] = useState(false)

  useEffect(() => {
    setPlannerUrl("")
    setQuote(null)
    setPayAmount("")
    setPayUrl("")
    setTravelResult("")
    if (detail?.order.event_address) setTravelDest(detail.order.event_address)
    setFinalMsg("")
    setEmailDraft(null)
    setFinalProof("")
    setFinalChannel("cash")
    setFinalAmount(
      typeof detail?.order.balance_due_cents === "number" && detail.order.balance_due_cents > 0
        ? (detail.order.balance_due_cents / 100).toFixed(2)
        : "",
    )
  }, [detail])

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

  // 派对已经办完(或订单取消)后,"确认/标记完成"这两个按钮就藏起来——它们会
  // 经发票 app 给客户发"更新已完成"邮件+短信,事后再发只是打扰。这类残留请求
  // 由 /api/admin/orders 在列表刷新时静默关闭。
  const orderFinished = (() => {
    if (!o) return false
    const stage = stageOf(o, now)
    return stage === "已办完" || stage === "已取消"
  })()

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

  // 默认模板按订单状态选:细节没齐就去要细节,活动过了就致谢,其余是确认+尾款。
  const defaultTemplate = useCallback(
    (order: OrderRow): EmailTemplateId => {
      const ms = order.event_start ? Date.parse(order.event_start) : NaN
      if (Number.isFinite(ms) && ms < now) return "thanks"
      if (order.details_status !== "complete") return "details"
      return "balance"
    },
    [now],
  )

  const openEmailDraft = useCallback(
    (template: EmailTemplateId) => {
      if (!o?.customer_email) return
      const { subject, body } = buildOrderEmail(o, template)
      setEmailDraft({ template, to: o.customer_email, cc: "", subject, body })
    },
    [o],
  )

  const sendOrderEmail = useCallback(async () => {
    if (!emailDraft || !o || emailSending) return
    setEmailSending(true)
    try {
      const res = await fetch("/api/admin/send-followup", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({
          to: emailDraft.to,
          cc: emailDraft.cc,
          subject: emailDraft.subject,
          text: emailDraft.body,
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || "failed")
      const ccSent: string[] = Array.isArray(data.cc) ? data.cc : []
      // 记到订单时间线:共享工作台里别人才看得见这封已经发过了。
      await call("/api/admin/orders/email-sent", {
        orderId: o.id,
        to: emailDraft.to,
        cc: ccSent,
        subject: emailDraft.subject,
        operator: localStorage.getItem("rh_operator_name") ?? "staff",
      })
      setEmailDraft(null)
      onChanged()
      window.alert(`✅ 已从 support@realhibachi.com 发送${ccSent.length > 0 ? `(抄送 ${ccSent.length} 人)` : ""}`)
    } catch (e) {
      window.alert("发送失败: " + e)
    } finally {
      setEmailSending(false)
    }
  }, [emailDraft, emailSending, o, adminKey, call, onChanged])

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
              <b>{o.customer_name || "—"}</b> · {o.customer_phone || "无电话"} ·{" "}
              {o.customer_email ? (
                <button
                  onClick={() => openEmailDraft(defaultTemplate(o))}
                  title="写邮件 — 从 support@realhibachi.com 发送"
                  style={{ border: "none", background: "none", padding: 0, font: "inherit", color: "#1d4ed8", textDecoration: "underline", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <Mail size={13} /> {o.customer_email}
                </button>
              ) : (
                "无邮箱"
              )}
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
                <Tent size={14} /> 布置工具链接{busy === "planner" ? "…" : ""}
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
                <CreditCard size={14} /> 尾款报价{busy === "quote" ? "…" : ""}
              </button>
              <button
                style={btnGhost}
                onClick={() => {
                  const params = new URLSearchParams()
                  if (o.customer_phone) params.set("phone", o.customer_phone.replace(/\D/g, ""))
                  if (o.customer_email) params.set("email", o.customer_email)
                  window.open(`https://invoice.realhibachi.com/?${params.toString()}`, "_blank", "noopener")
                }}
              >
                <FileText size={14} /> 专业表单
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: "#9ca3af", marginBottom: 6 }}>同一份订单数据的两个入口:图形布置(客户用)/ 专业表单(staff 用)。人数、菜单、报价一律在专业表单里改——唯一数据入口,保存后这里自动同步。</div>
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
                    {(() => {
                      // 发票按信用卡计价时 balanceDue 已经含了 4% 卡费,再让 pay-link
                      // 加一次就是重复收费。线索台早就分了这两种情况,工作台以前没分。
                      const feeIncluded = quote.paymentMethod === "credit_card"
                      const typed = Number(payAmount)
                      const charge = Number.isFinite(typed) && typed > 0 ? (feeIncluded ? typed : Math.round(typed * 1.04 * 100) / 100) : null
                      return (
                        <>
                          <div style={{ fontSize: 12, color: "#1d4ed8", marginTop: 4 }}>
                            {feeIncluded ? "发票已按信用卡计(含 4% 卡费),链接不再加费" : "发票按现金计 → 刷卡链接自动 +4%"}
                          </div>
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
                                  amountIsFinal: feeIncluded,
                                  // orderId is what lets the webhook book the money
                                  // onto this order the moment the customer pays.
                                  orderId: o.id,
                                  customerName: o.customer_name ?? "",
                                  note: `Order ${o.order_no}`,
                                })
                                setBusy(null)
                                if (data.ok && data.url) {
                                  setPayUrl(
                                    data.linkedOrderNo
                                      ? `$${data.total?.toFixed?.(2) ?? data.total} · 付款后自动入账到 ${data.linkedOrderNo}\n${data.url}`
                                      : `$${data.total?.toFixed?.(2) ?? data.total} · ⚠️ 未绑定订单(${data.unmatchedReason})付款后需手动入账\n${data.url}`,
                                  )
                                  copy(data.url)
                                } else {
                                  setPayUrl(`失败:${data.error ?? "unknown"}`)
                                }
                              }}
                            >
                              生成收款链接{charge !== null ? `(实收 $${charge.toFixed(2)})` : ""}
                            </button>
                          </div>
                        </>
                      )
                    })()}
                  </>
                )}
              </div>
            )}
            {payUrl && (
              <div style={{ fontSize: 12.5, color: "#065f46", background: "#d1fae5", borderRadius: 8, padding: "7px 10px", marginBottom: 6, wordBreak: "break-all", whiteSpace: "pre-wrap" }}>
                已复制:{payUrl}
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
                      <span style={{ fontSize: 13, width: 18, color: done ? "#16a34a" : isNext ? "#0f766e" : "#9ca3af", fontWeight: 700 }}>{done ? "✓" : isNext ? "▶" : "○"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: isNext ? 700 : 500, color: done ? "#9ca3af" : "#111827", textDecoration: done ? "line-through" : "none" }}>
                          {s.title}
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

            {/* ---------- 客户提交的修改(来自任一入口) ---------- */}
            {detail!.updateRequests.length > 0 && (
              <>
                <div style={labelStyle}>客户提交的修改</div>
                {orderFinished && (
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
                    派对已办完/订单已取消 —— 未结的修改请求已自动关闭,不再给客户发通知。
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                  {detail!.updateRequests.map((r) => {
                    // 真正人工处理完的请求一定带 chef_notified_at;没有它的"已完成"
                    // 是派对办完后自动静默关掉的(客户没收到任何通知),分开显示,
                    // 免得以为这条真被处理过。
                    const autoClosed = r.status === "updated_chef_notified" && !r.chef_notified_at
                    const statusLabel =
                      r.status === "received" ? { t: "待确认", bg: "#fef3c7", fg: "#92400e" }
                      : r.status === "confirmed_in_progress" ? { t: "处理中", bg: "#dbeafe", fg: "#1d4ed8" }
                      : autoClosed ? { t: "已自动关闭", bg: "#f3f4f6", fg: "#6b7280" }
                      : { t: "已完成", bg: "#d1fae5", fg: "#065f46" }
                    return (
                      <div key={r.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "9px 12px", fontSize: 13 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <span>
                            <span style={{ background: statusLabel.bg, color: statusLabel.fg, borderRadius: 999, padding: "1px 9px", fontSize: 11.5, marginRight: 8 }}>{statusLabel.t}</span>
                            <span style={{ color: "#6b7280", fontSize: 12 }}>{new Date(r.created_at).toLocaleString()}</span>
                          </span>
                          {r.status === "received" && !orderFinished && (
                            <button
                              style={{ ...btnStyle, padding: "4px 12px", fontSize: 12 }}
                              disabled={busy === `ur_${r.id}`}
                              onClick={async () => {
                                setBusy(`ur_${r.id}`)
                                const d = await call("/api/admin/orders/update-request-action", {
                                  requestId: r.id, action: "confirm",
                                  operator: localStorage.getItem("rh_operator_name") ?? "staff",
                                })
                                setBusy(null)
                                if (d.ok) onChanged()
                                else alert(`确认失败:${d.error?.message ?? d.error ?? "unknown"}`)
                              }}
                            >
                              {busy === `ur_${r.id}` ? "…" : "确认(通知客户处理中)"}
                            </button>
                          )}
                          {r.status === "confirmed_in_progress" && !orderFinished && (
                            <button
                              style={{ ...btnGhost, padding: "4px 12px", fontSize: 12 }}
                              disabled={busy === `ur_${r.id}`}
                              onClick={async () => {
                                setBusy(`ur_${r.id}`)
                                const d = await call("/api/admin/orders/update-request-action", {
                                  requestId: r.id, action: "complete",
                                  operator: localStorage.getItem("rh_operator_name") ?? "staff",
                                })
                                setBusy(null)
                                if (d.ok) onChanged()
                                else alert(`完成失败:${d.error?.message ?? d.error ?? "unknown"}`)
                              }}
                            >
                              {busy === `ur_${r.id}` ? "…" : "标记完成(通知客户)"}
                            </button>
                          )}
                        </div>
                        {Array.isArray(r.change_summary) && r.change_summary.length > 0 && (
                          <div style={{ marginTop: 6, fontSize: 12.5, color: "#374151" }}>
                            {r.change_summary.map((c, i) => (
                              <div key={i}>
                                <b>{c.label}</b>:{c.before} → <b>{c.after}</b>
                              </div>
                            ))}
                          </div>
                        )}
                        {r.customer_message && <div style={{ marginTop: 4, fontSize: 12.5, color: "#6b7280" }}>留言:{r.customer_message}</div>}
                      </div>
                    )
                  })}
                </div>
              </>
            )}

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
                <Car size={14} /> 算路费{busy === "travel" ? "…" : ""}
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

            {/* ---------- 登记尾款收款(线下) ---------- */}
            {(o.balance_due_cents ?? 0) > 0 && (
              <>
                <div style={labelStyle}>登记尾款收款(线下)</div>
                <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 6 }}>现场现金 / Venmo / Zelle 收到尾款后在这里入账,金额默认为当前尾款。刷卡链接付的会自动入账,只有漏掉的才需要选「信用卡/Stripe」并填付款号。</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 13 }}>$</span>
                  <input style={{ ...inputStyle, width: 100, padding: "6px 9px" }} inputMode="decimal" value={finalAmount} onChange={(e) => setFinalAmount(e.target.value)} />
                  <select style={{ ...inputStyle, width: 110, padding: "6px 9px" }} value={finalChannel} onChange={(e) => setFinalChannel(e.target.value)}>
                    <option value="cash">现金</option>
                    <option value="venmo">Venmo</option>
                    <option value="zelle">Zelle</option>
                    <option value="stripe">信用卡/Stripe</option>
                    <option value="other">其他</option>
                  </select>
                  <input
                    style={{ ...inputStyle, flex: 1, minWidth: 150, padding: "6px 9px" }}
                    value={finalProof}
                    onChange={(e) => setFinalProof(e.target.value)}
                    placeholder={finalChannel === "stripe" ? "Stripe 付款号 pi_… (必填)" : "凭证链接(可选)"}
                  />
                  <button
                    style={btnStyle}
                    disabled={busy === "final" || !Number(finalAmount) || (finalChannel === "stripe" && !/^(pi|ch|py|cs)_/.test(finalProof.trim()))}
                    onClick={async () => {
                      setBusy("final")
                      setFinalMsg("")
                      const data = await call("/api/admin/orders/final-payment-confirm", {
                        orderId: o.id,
                        amount: Number(finalAmount),
                        channel: finalChannel,
                        // Same box, two meanings: a card entry needs the
                        // payment id, everything else takes a proof link.
                        ...(finalChannel === "stripe"
                          ? { paymentRef: finalProof.trim() }
                          : { proofUrl: finalProof || undefined }),
                        operator: localStorage.getItem("rh_operator_name") ?? "staff",
                      })
                      setBusy(null)
                      if (data.ok) {
                        setFinalMsg("✓ 尾款已入账,余额已结算")
                        onChanged()
                      } else {
                        setFinalMsg(`入账失败:${data.error ?? "unknown"}`)
                      }
                    }}
                  >
                    {busy === "final" ? "入账中…" : "确认收款"}
                  </button>
                </div>
                {finalMsg && (
                  <div style={{ fontSize: 12.5, borderRadius: 8, padding: "7px 10px", marginBottom: 6, background: finalMsg.startsWith("✓") ? "#d1fae5" : "#fee2e2", color: finalMsg.startsWith("✓") ? "#065f46" : "#b91c1c" }}>
                    {finalMsg}
                  </div>
                )}
              </>
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

      {/* ---------- ✉️ 写邮件(从 support@ 发出) ---------- */}
      {emailDraft && o && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div style={{ background: "#fff", borderRadius: 14, width: "min(560px, 100%)", maxHeight: "88vh", overflowY: "auto", padding: "18px 20px", boxSizing: "border-box" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <strong style={{ fontSize: 16 }}>✉️ 写邮件 · {o.order_no}</strong>
              <button onClick={() => setEmailDraft(null)} style={{ border: "none", background: "#f3f4f6", borderRadius: 8, width: 30, height: 30, cursor: "pointer" }}>
                ✕
              </button>
            </div>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 10px" }}>
              发件人: <strong>Real Hibachi &lt;support@realhibachi.com&gt;</strong>
              <br />
              收件人: <strong>{emailDraft.to}</strong>(客户回信也进 support@)
            </p>

            <div style={labelStyle}>模板(切换会覆盖下面已改的正文)</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {EMAIL_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    const { subject, body } = buildOrderEmail(o, t.id)
                    setEmailDraft((d) => (d ? { ...d, template: t.id, subject, body } : d))
                  }}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 999,
                    fontSize: 12.5,
                    cursor: "pointer",
                    border: "1px solid " + (emailDraft.template === t.id ? "#111827" : "#d1d5db"),
                    background: emailDraft.template === t.id ? "#111827" : "#fff",
                    color: emailDraft.template === t.id ? "#fff" : "#374151",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div style={labelStyle}>抄送(选填,逗号分隔,最多 5 个)</div>
            <input
              style={inputStyle}
              placeholder="配偶/同事等共同决策人,例如 spouse@gmail.com, boss@company.com"
              value={emailDraft.cc}
              onChange={(e) => setEmailDraft((d) => (d ? { ...d, cc: e.target.value } : d))}
            />
            <div style={labelStyle}>主题</div>
            <input
              style={inputStyle}
              value={emailDraft.subject}
              onChange={(e) => setEmailDraft((d) => (d ? { ...d, subject: e.target.value } : d))}
            />
            <div style={labelStyle}>正文(可直接修改)</div>
            <textarea
              style={{ ...inputStyle, height: 280, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
              value={emailDraft.body}
              onChange={(e) => setEmailDraft((d) => (d ? { ...d, body: e.target.value } : d))}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                onClick={sendOrderEmail}
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
          </div>
        </div>
      )}
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
              background: result.startsWith("✓") ? "#d1fae5" : "#fee2e2",
              color: result.startsWith("✓") ? "#065f46" : "#b91c1c",
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
                setResult(`✓ 已晋升为订单 ${data.orderNo ?? ""}`)
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
