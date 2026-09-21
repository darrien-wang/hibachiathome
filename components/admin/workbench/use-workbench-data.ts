"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { PublicActor } from "@/lib/workbench-perms"
import { adminJson, AdminApiError } from "./api"
import type { LeadRow, LeadStats, OrderRow, UpdateRequest } from "./helpers"
import type { AssignmentMap, ChefSummary } from "./chef-types"
import { EMPTY_PLANNER_LIVE, type PlannerLive } from "./planner-live"
import { DEFAULT_SETTINGS, type WorkbenchSettings } from "@/lib/workbench-settings-shared"

// One place that owns the lists every tab reads. Leads poll every 30 s (a
// new one rings the bell, same as the old lead page), orders every 60 s,
// settings once. Dialogs call refresh* after they write.

export type CodeConfig = Record<string, unknown>
export type Viewer = PublicActor

export type WorkbenchData = {
  leads: LeadRow[]
  stats: LeadStats | null
  viewer: Viewer | null
  orders: OrderRow[]
  pendingUpdates: UpdateRequest[]
  /** 派单：orderId → chefs on that party (from the orders list call). */
  assignments: AssignmentMap
  chefs: ChefSummary[]
  chefAlerts: number
  refreshChefs: () => Promise<void>
  /** Who is in the party planner now / lately (polled every 15 s). */
  planner: PlannerLive
  settings: WorkbenchSettings
  settingsMeta: Record<string, { updated_at: string; updated_by: string | null }>
  code: CodeConfig | null
  loaded: boolean
  authFailed: boolean
  error: string | null
  refreshLeads: () => Promise<void>
  refreshOrders: () => Promise<void>
  refreshSettings: () => Promise<void>
  applySettings: (s: WorkbenchSettings, meta?: Record<string, { updated_at: string; updated_by: string | null }>) => void
}

function beep(times: number) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
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

export function useWorkbenchData(key: string, enabled: boolean): WorkbenchData {
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [stats, setStats] = useState<LeadStats | null>(null)
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [pendingUpdates, setPendingUpdates] = useState<UpdateRequest[]>([])
  const [assignments, setAssignments] = useState<AssignmentMap>({})
  const [chefs, setChefs] = useState<ChefSummary[]>([])
  const [chefAlerts, setChefAlerts] = useState(0)
  const [planner, setPlanner] = useState<PlannerLive>(EMPTY_PLANNER_LIVE)
  const liveRef = useRef(0)
  const [settings, setSettings] = useState<WorkbenchSettings>(DEFAULT_SETTINGS)
  const [settingsMeta, setSettingsMeta] = useState<Record<string, { updated_at: string; updated_by: string | null }>>({})
  const [code, setCode] = useState<CodeConfig | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [authFailed, setAuthFailed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const newestRef = useRef<string | null>(null)
  const titleRef = useRef<string>("")

  const refreshLeads = useCallback(async () => {
    try {
      const d = await adminJson<{ leads: LeadRow[]; stats: LeadStats; viewer: Viewer }>(key, "/api/admin/leads?limit=300")
      const rows = Array.isArray(d.leads) ? d.leads : []
      setLeads(rows)
      setStats(d.stats ?? null)
      setViewer(d.viewer ?? null)
      setAuthFailed(false)
      setError(null)
      // A lead we have not seen at the top of the list = a new enquiry.
      const newest = rows[0]?.id ?? null
      if (newestRef.current && newest && newest !== newestRef.current) {
        const l = rows[0]
        beep(3)
        if (!titleRef.current) titleRef.current = document.title
        document.title = `🔔 新询盘! ${l.full_name ?? l.phone ?? ""}`
        setTimeout(() => {
          if (titleRef.current) document.title = titleRef.current
        }, 15000)
        try {
          if (Notification.permission === "granted") {
            new Notification("新询盘", { body: `${l.full_name ?? l.phone ?? "客户"} · ${l.city_or_zip ?? ""} · ${l.guest_count ?? "?"} 人` })
          }
        } catch {}
      }
      newestRef.current = newest
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 401) setAuthFailed(true)
      else setError(e instanceof Error ? e.message : "load failed")
    }
  }, [key])

  const refreshOrders = useCallback(async () => {
    try {
      const d = await adminJson<{ orders: OrderRow[]; pendingUpdateRequests: UpdateRequest[]; assignments?: AssignmentMap }>(key, "/api/admin/orders")
      setOrders(Array.isArray(d.orders) ? d.orders : [])
      setPendingUpdates(Array.isArray(d.pendingUpdateRequests) ? d.pendingUpdateRequests : [])
      setAssignments(d.assignments && typeof d.assignments === "object" ? d.assignments : {})
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 401) setAuthFailed(true)
      else setError(e instanceof Error ? e.message : "load failed")
    }
  }, [key])

  const refreshPlanner = useCallback(async () => {
    try {
      const d = await adminJson<Omit<PlannerLive, "fetchedAt">>(key, "/api/admin/planner-live?hours=24")
      setPlanner({ ...d, fetchedAt: Date.now() })
      // Someone new started playing: one short beep, no notification spam.
      if (d.liveCount > liveRef.current && liveRef.current >= 0 && document.visibilityState === "visible") beep(1)
      liveRef.current = d.liveCount
    } catch {
      /* the strip just goes stale; the next tick retries */
    }
  }, [key])

  const refreshChefs = useCallback(async () => {
    try {
      const d = await adminJson<{ chefs: ChefSummary[]; alertsCount: number }>(key, "/api/admin/chefs")
      setChefs(Array.isArray(d.chefs) ? d.chefs : [])
      setChefAlerts(Number(d.alertsCount ?? 0))
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 401) setAuthFailed(true)
    }
  }, [key])

  const refreshSettings = useCallback(async () => {
    try {
      const d = await adminJson<{ settings: WorkbenchSettings; meta: Record<string, { updated_at: string; updated_by: string | null }>; code: CodeConfig }>(key, "/api/admin/settings")
      if (d.settings) setSettings(d.settings)
      if (d.meta) setSettingsMeta(d.meta)
      if (d.code) setCode(d.code)
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 401) setAuthFailed(true)
    }
  }, [key])

  const applySettings = useCallback((s: WorkbenchSettings, meta?: Record<string, { updated_at: string; updated_by: string | null }>) => {
    setSettings(s)
    if (meta) setSettingsMeta(meta)
  }, [])

  useEffect(() => {
    // No key is fine: SMS / passkey logins carry a session cookie instead.
    if (!enabled) return
    let alive = true
    ;(async () => {
      await Promise.all([refreshLeads(), refreshOrders(), refreshSettings(), refreshChefs(), refreshPlanner()])
      if (alive) setLoaded(true)
    })()
    const a = setInterval(() => void refreshLeads(), 30_000)
    const b = setInterval(() => {
      void refreshOrders()
      void refreshChefs()
    }, 60_000)
    // 15 s keeps "正在操作" honest without hammering the table; skip hidden tabs.
    const c = setInterval(() => {
      if (document.visibilityState === "visible") void refreshPlanner()
    }, 15_000)
    try {
      if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission()
    } catch {}
    return () => {
      alive = false
      clearInterval(a)
      clearInterval(b)
      clearInterval(c)
    }
  }, [enabled, key, refreshLeads, refreshOrders, refreshSettings, refreshChefs, refreshPlanner])

  return { leads, stats, viewer, orders, pendingUpdates, assignments, chefs, chefAlerts, refreshChefs, planner, settings, settingsMeta, code, loaded, authFailed, error, refreshLeads, refreshOrders, refreshSettings, applySettings }
}
