"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useSoftphone } from "@/components/admin/SoftphoneProvider"
import { useIsMobile } from "@/components/admin/SoftphoneMobileDrawer"
import { adminJson, loginUrl, useAdminKey } from "./api"
import { useWorkbenchData } from "./use-workbench-data"
import { BoardTab } from "./BoardTab"
import { LeadsTab } from "./LeadsTab"
import { OrdersTab, changedOrderIds, type OrderFilter } from "./OrdersTab"
import { CalendarTab } from "./CalendarTab"
import { SettingsTab } from "./SettingsTab"
import { ChefsTab, type ChefTabKey } from "./ChefsTab"
import { CustomersTab } from "./CustomersTab"
import { PlannerTab } from "./planner-live"
import { ChefDialog } from "./ChefDialog"
import { LeadDialog } from "./LeadDialog"
import { OrderDialog } from "./OrderDialog"
import { DepositDialog } from "./DepositDialog"
import { PhoneIcon, SearchIcon, Tag } from "./ui"
import { AskHost } from "./ask"
import { displayName, eventParts, LEAD_STATUS_LABELS, LEAD_TAG_CLASS, leadUnreplied, md, prettyPhone, relativeTime, stageOf, STAGE_TAG_CLASS, type LeadRow } from "./helpers"

// ============================================================
// 工作台 · one shell, four tabs (看板 · 线索 · 订单 · 日历) + 设置
// ============================================================
// Everything is addressable: /admin?tab=leads&lead=<id> opens the lead
// dialog (this is what the SMS / landing / planner alerts link to),
// ?order=<id> the order dialog, ?lead_order=<leadId> the order that came
// out of that lead, ?since=YYYY-MM-DD scopes the lead list (from the board).
// The old /admin/leads, /admin/orders, /admin/channels URLs redirect here.

type Tab = "board" | "leads" | "orders" | "planner" | "chefs" | "customers" | "cal" | "settings"
const TAB_TITLES: Record<Tab, string> = { board: "看板", leads: "线索", orders: "订单", planner: "Planner", chefs: "厨师", customers: "客户", cal: "日历", settings: "设置" }
const CHEF_TABS = new Set(["shifts", "profile", "perf", "docs", "settle", "files"])

type SearchHit = {
  key: string
  name: string | null
  phone: string | null
  email: string | null
  leads: Array<{ id: string; full_name: string | null; phone: string | null; status: string; city_or_zip: string | null; guest_count: number | null; created_at: string; last_seen_at: string | null }>
  orders: Array<{ id: string; order_no: string; customer_name: string | null; customer_phone: string | null; event_start: string | null; event_address: string | null; order_status: string | null; balance_due_cents: number | null }>
}

export default function Workbench() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  // A key in localStorage (scripts, old links) or a login-session cookie
  // (SMS / passkey login, see /admin/login): either way the APIs decide.
  const { key, ready, clearKey } = useAdminKey()
  const data = useWorkbenchData(key, ready)
  const isMobile = useIsMobile("(max-width: 760px)")
  const phone = useSoftphone()

  const tab = ((sp.get("tab") as Tab) || "leads") as Tab
  const leadId = sp.get("lead")
  const orderId = sp.get("order")
  const leadOrder = sp.get("lead_order")
  const since = sp.get("since")
  const filter = sp.get("filter") as OrderFilter | null
  const chefId = sp.get("chef")
  const ctabRaw = sp.get("ctab")
  const ctab = ctabRaw && CHEF_TABS.has(ctabRaw) ? (ctabRaw as ChefTabKey) : null
  const chefView = sp.get("view") === "media" ? "media" : "list"

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(sp.toString())
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k)
        else next.set(k, v)
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    },
    [router, pathname, sp],
  )
  const go = (t: Tab) => setParams({ tab: t, since: null, filter: null, view: null })
  const openLead = useCallback((id: string) => setParams({ lead: id, order: null, lead_order: null, chef: null, ctab: null }), [setParams])
  const openOrder = useCallback((id: string) => setParams({ order: id, lead: null, lead_order: null, chef: null, ctab: null }), [setParams])
  const openChef = useCallback((id: string, t?: ChefTabKey) => setParams({ chef: id, ctab: t ?? null, lead: null, order: null, lead_order: null }), [setParams])
  const closeDialogs = useCallback(() => setParams({ lead: null, order: null, lead_order: null, chef: null, ctab: null }), [setParams])

  // ?lead_order=<leadId> (old /admin/orders?lead=) → the order that lead became.
  useEffect(() => {
    if (!leadOrder || !data.loaded) return
    const o = data.orders.find((x) => ((x.source_metadata ?? {}) as Record<string, unknown>).lead_id === leadOrder)
    if (o) setParams({ order: o.id, lead_order: null })
    else setParams({ lead: leadOrder, lead_order: null, tab: "leads" })
  }, [leadOrder, data.loaded, data.orders, setParams])

  // ?phone=1 (old /admin/phone) → open the softphone drawer once.
  const phoneOpened = useRef(false)
  useEffect(() => {
    if (sp.get("phone") === "1" && !phoneOpened.current) {
      phoneOpened.current = true
      phone.setDrawerOpen(true)
      setParams({ phone: null })
    }
  }, [sp, phone, setParams])

  const [deposit, setDeposit] = useState<LeadRow | null>(null)
  const [q, setQ] = useState("")
  const [hits, setHits] = useState<SearchHit[] | null>(null)
  const seq = useRef(0)
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setHits(null)
      return
    }
    const mine = ++seq.current
    const t = setTimeout(async () => {
      try {
        const d = await adminJson<{ ok: boolean; customers: SearchHit[] }>(key, `/api/admin/search?q=${encodeURIComponent(term)}`)
        if (mine === seq.current) setHits(Array.isArray(d.customers) ? d.customers : [])
      } catch {
        if (mine === seq.current) setHits([])
      }
    }, 250)
    return () => clearTimeout(t)
  }, [q, key])

  // "/" focuses search, Esc clears it.
  const searchRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)
      if (e.key === "/" && !typing) {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === "Escape" && document.activeElement === searchRef.current) {
        setQ("")
        searchRef.current?.blur()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const pendingCount = useMemo(() => data.leads.filter((l) => leadUnreplied(l) || l.status === "new").length, [data.leads])
  const changedCount = useMemo(() => changedOrderIds(data.pendingUpdates, data.orders).size, [data.pendingUpdates, data.orders])
  useEffect(() => {
    document.title = `${pendingCount ? `(${pendingCount}) ` : ""}${TAB_TITLES[tab] ?? "工作台"} · Real Hibachi`
  }, [tab, pendingCount])

  // No key and no live session: go to the login page. A stale key in
  // localStorage is dropped so it cannot shadow a fresh SMS login.
  useEffect(() => {
    if (!data.authFailed) return
    clearKey()
    window.location.replace(loginUrl())
  }, [data.authFailed, clearKey])

  const logout = useCallback(async () => {
    try {
      await fetch("/api/admin/auth/logout", { method: "POST", credentials: "same-origin" })
    } catch {}
    clearKey()
    window.location.replace("/admin/login")
  }, [clearKey])

  const lead = leadId ? data.leads.find((l) => l.id === leadId) ?? null : null
  const onCall = useCallback(
    (num: string) => {
      // Inside the Android shell the call goes through the native Twilio
      // client (rhapp:// is intercepted by the app); browsers use the softphone.
      if (typeof navigator !== "undefined" && /RealHibachiWorkbenchAndroid/.test(navigator.userAgent)) {
        window.location.assign(`rhapp://call?to=${encodeURIComponent(num)}`)
        return
      }
      phone.setDrawerOpen(true)
      if (phone.status !== "ready") phone.goOnline()
      phone.dial(num)
    },
    [phone],
  )
  const phoneOn = phone.status === "ready" || phone.live.kind !== "none"

  // The phone's collapsed bar and the tab bar both live at the bottom edge on
  // phones; the bar reads these so it stacks above the tabs instead of over them
  // (2026-09-21: the tabs were hidden under it, the boss saw only 线索).
  useEffect(() => {
    if (!isMobile) return
    const root = document.documentElement
    root.style.setProperty("--rh-mobile-nav", "calc(46px + env(safe-area-inset-bottom))")
    root.style.setProperty("--rh-mobile-nav-pad", "0px")
    return () => {
      root.style.removeProperty("--rh-mobile-nav")
      root.style.removeProperty("--rh-mobile-nav-pad")
    }
  }, [isMobile])
  const phoneLabel = phone.status === "connecting" ? "客服电话 · 连接中" : phoneOn ? "客服电话 · 已上线" : "客服电话 · 未上线"
  // The line is on by default and a tap must never take it down (2026-09-22,
  // 用户定): the chip only brings it up if it is not, and opens the panel.
  // Inside the Android app the native side owns the line, so no chip at all.
  const togglePhone = () => {
    if (!phoneOn) void phone.goOnline()
    phone.setDrawerOpen(true)
  }
  const showPhoneChip = !phone.inApp

  if (!ready || data.authFailed) return <div className="wb" />

  // What this person may see. Until the first response lands nobody gets the
  // board, so an agent never glimpses it while the page loads.
  const canBoard = data.viewer?.perms.board === true
  const canChefMoney = data.viewer?.perms.chef_sensitive === true

  const searching = q.trim().length >= 2
  const allTabs: Array<[Tab, React.ReactNode]> = [
    ["board", "看板"],
    ["leads", <>线索{pendingCount ? <span className="wb-badge">{pendingCount}</span> : null}</>],
    ["orders", <>订单{changedCount ? <span className="wb-badge">{changedCount}</span> : null}</>],
    ["planner", <>Planner{data.planner.liveCount ? <span className="wb-live" title={`${data.planner.liveCount} 人正在操作 Planner`} /> : null}</>],
    ["chefs", <>厨师{data.chefAlerts ? <span className="wb-badge">{data.chefAlerts}</span> : null}</>],
    ["customers", "客户"],
    ["cal", "日历"],
    ["settings", "设置"],
  ]
  const tabs = allTabs.filter(([t]) => t !== "board" || canBoard)
  const refreshOrdersAndChefs = async () => {
    await Promise.all([data.refreshOrders(), data.refreshChefs()])
  }

  return (
    <div className="wb">
      {!isMobile ? (
        <header style={{ display: "flex", alignItems: "center", gap: 24, padding: "0 24px", borderBottom: "2px solid var(--color-divider)", background: "var(--color-bg)", position: "sticky", top: 0, zIndex: 20 }}>
          <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 16, letterSpacing: "-0.01em", whiteSpace: "nowrap", flex: "none" }}>Real Hibachi</div>
          <nav style={{ display: "flex", gap: 20, flex: "none" }}>
            {tabs.map(([t, label]) => (
              <button key={t} type="button" className="wb-tab" aria-current={tab === t && !searching ? "page" : undefined} onClick={() => go(t)}>
                {label}
              </button>
            ))}
          </nav>
          <label className="wb-search" style={{ marginLeft: "auto", flex: "1 1 200px", maxWidth: 380 }}>
            {SearchIcon}
            <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜姓名 / 电话 / 单号 / 城市 · 订单+线索（按 / 聚焦）" />
            {q ? (
              <button type="button" onClick={() => setQ("")} style={{ border: 0, background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--color-accent-700)", padding: 0 }}>
                清除
              </button>
            ) : null}
          </label>
          {showPhoneChip ? (
            <button type="button" className="wb-chip" aria-pressed={phoneOn ? "true" : "false"} onClick={togglePhone} style={{ height: 36, flex: "none" }} title={phone.message ?? undefined}>
              {PhoneIcon} {phoneLabel}
            </button>
          ) : null}
        </header>
      ) : (
        <header style={{ display: "flex", flexDirection: "column", gap: 10, padding: "12px 16px 10px", borderBottom: "2px solid var(--color-divider)", background: "var(--color-bg)", position: "sticky", top: 0, zIndex: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 16 }}>Real Hibachi · {searching ? "搜索" : TAB_TITLES[tab]}</div>
            {showPhoneChip ? (
              <button type="button" className="wb-chip" aria-pressed={phoneOn ? "true" : "false"} onClick={togglePhone} style={{ height: 32, padding: "0 10px", fontSize: 12 }}>
                {phoneLabel}
              </button>
            ) : null}
          </div>
          <label className="wb-search" style={{ height: 40 }}>
            {SearchIcon}
            <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜姓名 / 电话 / 单号 / 城市" style={{ fontSize: 14 }} />
            {q ? (
              <button type="button" onClick={() => setQ("")} style={{ border: 0, background: "transparent", cursor: "pointer", fontSize: 12, color: "var(--color-accent-700)", padding: 0 }}>
                清除
              </button>
            ) : null}
          </label>
        </header>
      )}

      {/* Desktop keeps a right gutter so the softphone handle never sits on a table's last column. */}
      <main style={{ flex: 1, minWidth: 0, padding: isMobile ? `16px 16px ${phone.inApp ? 88 : 148}px` : "20px 52px 72px 24px" }}>
        {data.error ? <div className="notice danger" style={{ marginBottom: 12 }}>{data.error}</div> : null}
        {searching ? (
          <SearchResults q={q.trim()} hits={hits} isMobile={isMobile} onOpenLead={openLead} onOpenOrder={openOrder} />
        ) : tab === "board" && canBoard ? (
          <BoardTab adminKey={key} settings={data.settings} leads={data.leads} orders={data.orders} isMobile={isMobile} viewerRole={data.viewer?.role ?? null} onGoLeads={(s) => setParams({ tab: "leads", since: s })} onGoOrders={() => setParams({ tab: "orders", filter: "all" })} />
        ) : tab === "orders" ? (
          <OrdersTab key={filter ?? "orders"} adminKey={key} viewerRole={data.viewer?.role ?? null} orders={data.orders} pendingUpdates={data.pendingUpdates} assignments={data.assignments} planner={data.planner} isMobile={isMobile} initialFilter={filter} onOpenOrder={openOrder} />
        ) : tab === "planner" ? (
          <PlannerTab adminKey={key} live={data.planner} isMobile={isMobile} onOpenLead={openLead} onOpenOrder={openOrder} />
        ) : tab === "chefs" ? (
          <ChefsTab key={chefView} adminKey={key} chefs={data.chefs} settings={data.settings} isMobile={isMobile} viewerRole={data.viewer?.role ?? null} sensitive={canChefMoney} initialView={chefView} onOpenChef={openChef} onChanged={data.refreshChefs} />
        ) : tab === "customers" ? (
          <CustomersTab adminKey={key} leads={data.leads} isMobile={isMobile} viewerRole={data.viewer?.role ?? null} onCall={onCall} onOpenLead={openLead} />
        ) : tab === "cal" ? (
          <CalendarTab orders={data.orders} settings={data.settings.calendar} isMobile={isMobile} onOpenOrder={openOrder} />
        ) : tab === "settings" ? (
          <SettingsTab adminKey={key} settings={data.settings} meta={data.settingsMeta} code={data.code} viewerRole={data.viewer?.role ?? null} viewer={data.viewer} onSaved={data.applySettings} onLogout={() => void logout()} />
        ) : (
          <LeadsTab adminKey={key} leads={data.leads} stats={data.stats} settings={data.settings} viewerRole={data.viewer?.role ?? null} isMobile={isMobile} since={since} planner={data.planner} onClearSince={() => setParams({ since: null })} onOpenLead={openLead} onOpenOrder={openOrder} onCall={onCall} onChanged={data.refreshLeads} />
        )}
        {!data.loaded && !searching ? <div className="empty">读取中…</div> : null}
      </main>

      {isMobile ? (
        <nav style={{ position: "fixed", left: 0, right: 0, bottom: 0, display: "flex", borderTop: "2px solid var(--color-divider)", background: "var(--color-bg)", zIndex: 20, paddingBottom: "env(safe-area-inset-bottom)" }}>
          {tabs.map(([t, label]) => (
            <button key={t} type="button" className="wb-mtab" aria-current={tab === t && !searching ? "page" : undefined} onClick={() => go(t)}>
              {label}
            </button>
          ))}
        </nav>
      ) : null}

      {leadId && lead ? (
        <LeadDialog
          adminKey={key}
          lead={lead}
          orders={data.orders}
          settings={data.settings}
          viewerRole={data.viewer?.role ?? null}
          isMobile={isMobile}
          live={data.planner.byLead[lead.id]}
          clarityProject={data.planner.clarityProject}
          onClose={closeDialogs}
          onChanged={data.refreshLeads}
          onOpenOrder={openOrder}
          onDeposit={(l) => setDeposit(l)}
          onCall={onCall}
        />
      ) : leadId && data.loaded && !lead ? (
        <div className="dialog-backdrop" onClick={closeDialogs}>
          <div className="dialog" style={{ width: "min(420px,100%)", padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div className="dialog-title">找不到这条线索</div>
            <div style={{ fontSize: 13, marginTop: 8 }}>它不在最近 300 条里，或者已经并入了别的线索。用上面的搜索按电话找。</div>
            <button type="button" className="btn btn-secondary" style={{ marginTop: 12, alignSelf: "flex-start" }} onClick={closeDialogs}>
              关闭
            </button>
          </div>
        </div>
      ) : null}
      {orderId ? (
        <OrderDialog
          adminKey={key}
          orderId={orderId}
          orders={data.orders}
          leads={data.leads}
          chefs={data.chefs}
          assignments={data.assignments[orderId] ?? []}
          live={data.planner.byOrder[orderId]}
          clarityProject={data.planner.clarityProject}
          settings={data.settings}
          viewerRole={data.viewer?.role ?? null}
          onClose={closeDialogs}
          onChanged={refreshOrdersAndChefs}
          onOpenLead={openLead}
          onOpenChef={(id) => openChef(id, "shifts")}
          onCall={onCall}
        />
      ) : null}
      {chefId ? (
        <ChefDialog
          key={chefId}
          adminKey={key}
          chefId={chefId}
          initialTab={ctab}
          settings={data.settings}
          viewerRole={data.viewer?.role ?? null}
          sensitive={canChefMoney}
          onClose={closeDialogs}
          onChanged={refreshOrdersAndChefs}
          onOpenOrder={openOrder}
          onCall={onCall}
        />
      ) : null}
      {deposit ? (
        <DepositDialog
          adminKey={key}
          lead={deposit}
          onClose={() => setDeposit(null)}
          onDone={async (id) => {
            setDeposit(null)
            await Promise.all([data.refreshLeads(), data.refreshOrders()])
            setParams({ tab: "orders", order: id, lead: null })
          }}
        />
      ) : null}
      <AskHost />
    </div>
  )
}

function SearchResults({ q, hits, isMobile, onOpenLead, onOpenOrder }: { q: string; hits: SearchHit[] | null; isMobile: boolean; onOpenLead: (id: string) => void; onOpenOrder: (id: string) => void }) {
  const orders = (hits ?? []).flatMap((h) => h.orders.map((o) => ({ ...o, who: h.name ?? o.customer_name })))
  const leads = (hits ?? []).flatMap((h) => h.leads.map((l) => ({ ...l, who: h.name ?? l.full_name })))
  const cols = isMobile ? "1fr" : "150px 1fr auto"
  const now = Date.now()
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 22 }}>搜索 “{q}”</h2>
        <span style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>{hits === null ? "搜索中…" : `${orders.length} 单 · ${leads.length} 线索`}</span>
      </div>
      <div className="wb-list">
        <h6 style={{ margin: "12px 0 6px" }}>订单</h6>
        {hits !== null && orders.length === 0 ? <div className="empty">无匹配订单</div> : null}
        {orders.map((o) => {
          const ev = eventParts(o.event_start)
          const st = stageOf({ ...o, source_metadata: null, created_at: "", updated_at: null, deposit_status: null, deposit_required_cents: null, deposit_paid_total_cents: null, details_status: "complete", quoted_total_cents: null, amount_paid_total_cents: null, source: null, source_ref: null, guest_adult_count: null, guest_child_count: null, customer_email: null }, now)
          return (
            <div key={o.id} className="wb-row" onClick={() => onOpenOrder(o.id)} style={{ display: "grid", gridTemplateColumns: cols, gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--color-line)" }}>
              <span className="mono" style={{ fontSize: 12 }}>
                {o.order_no}
              </span>
              <span>
                <strong>{displayName(o.who, o.customer_phone)}</strong> <span style={{ color: "var(--color-neutral-600)", fontSize: 13 }}>· {prettyPhone(o.customer_phone)} · {o.event_address ?? "—"}</span>
              </span>
              <span style={{ fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
                {ev ? `${md(ev.ymd)} ${ev.hm}` : "—"} <Tag cls={STAGE_TAG_CLASS[st]}>{st}</Tag>
              </span>
            </div>
          )
        })}
      </div>
      <div className="wb-list">
        <h6 style={{ margin: "12px 0 6px" }}>线索</h6>
        {hits !== null && leads.length === 0 ? <div className="empty">无匹配线索</div> : null}
        {leads.map((l) => (
          <div key={l.id} className="wb-row" onClick={() => onOpenLead(l.id)} style={{ display: "grid", gridTemplateColumns: cols, gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--color-line)" }}>
            <Tag cls={LEAD_TAG_CLASS[l.status] ?? "tag-neutral"} style={{ justifySelf: "start" }}>
              {LEAD_STATUS_LABELS[l.status] ?? l.status}
            </Tag>
            <span>
              <strong>{displayName(l.who, l.phone)}</strong> <span style={{ color: "var(--color-neutral-600)", fontSize: 13 }}>· {prettyPhone(l.phone)} · {l.city_or_zip ?? "—"} · {l.guest_count ?? "?"} 人</span>
            </span>
            <span style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>{relativeTime(l.last_seen_at ?? l.created_at, now)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
