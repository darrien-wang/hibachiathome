// ============================================================
// 工作台 · 基础设置（isomorphic：类型、默认值、校验）
// ============================================================
// Runtime settings the owner edits in /admin → 设置. Stored one row per
// section in `workbench_settings` (key = section name, value = JSON). The
// defaults below are the fallback when a row is missing, so a fresh
// database behaves exactly like today's hard-coded code did.
//
// What lives here vs. in code: prices, the home base ZIP, blackout dates and
// promo windows stay in config/*.ts because the invoice app mirrors them and
// customers see them. This file only holds knobs that change how the
// workbench itself behaves (targets, brakes, watch, quick replies, calendar).
//
// This module must stay free of server-only imports: the settings tab and the
// dialogs import the types and defaults into the browser bundle.

import { phone as sitePhone, siteConfig } from "@/config/site"

export type QuickReply = { id: string; label: string; body: string }

export type WorkbenchSettings = {
  business: {
    brand: string
    /** How the owner signs personal texts ("It's Bling"). */
    agent_name: string
    /** Default chef name for the 48h confirmation text. */
    chef_default_name: string
    support_phone: string
    backup_phone: string
    support_email: string
    review_url: string
    invoice_tool_url: string
    planner_url: string
  }
  targets: {
    /** 看板 CPA colour threshold (cents). */
    cpa_target_cents: number
    /** The long-run goal (cents), shown next to the target. */
    cpa_goal_cents: number
    /** First-response SLA in minutes (turns the 首响 column red). */
    first_response_sla_minutes: number
    /** Weekly spend ceiling (cents), 2026-09-20 review framework. */
    weekly_spend_cap_cents: number
    weekly_deposit_target: number
    /** Any week above this cost per deposit stops the campaign (cents). */
    weekly_cost_per_order_stop_cents: number
    /** A lead only counts as viable at this headcount or more. */
    lead_min_guests: number
  }
  sms_brakes: {
    followup_cap: number
    daily_cap: number
    spacing_hours: number
    reply_window_minutes: number
    reply_burst_cap: number
  }
  lead_watch: {
    enabled: boolean
    auto_first_response: boolean
    grace_minutes: number
    renotify_minutes: number
  }
  quick_replies: QuickReply[]
  calendar: {
    day_start_hour: number
    day_end_hour: number
    evening_from_hour: number
  }
}

export type SettingsSection = keyof WorkbenchSettings

export const SETTINGS_SECTIONS: SettingsSection[] = [
  "business",
  "targets",
  "sms_brakes",
  "lead_watch",
  "quick_replies",
  "calendar",
]

// Placeholders the lead dialog fills in before the text goes into the box.
export const QUICK_REPLY_PLACEHOLDERS = ["{first_name}", "{deposit_link}", "{planner_link}", "{date}"] as const

export const DEFAULT_SETTINGS: WorkbenchSettings = {
  business: {
    brand: "Real Hibachi",
    agent_name: "Bling",
    chef_default_name: "Bling",
    support_phone: sitePhone.sms.dashed,
    backup_phone: sitePhone.backup.dashed,
    support_email: siteConfig.contact.email,
    review_url: process.env.NEXT_PUBLIC_GBP_REVIEW_URL ?? "",
    invoice_tool_url: "https://invoice.realhibachi.com/",
    planner_url: "https://party.realhibachi.com/",
  },
  targets: {
    cpa_target_cents: 15000,
    cpa_goal_cents: 8000,
    first_response_sla_minutes: 10,
    weekly_spend_cap_cents: 155000,
    weekly_deposit_target: 7,
    weekly_cost_per_order_stop_cents: 30000,
    lead_min_guests: 8,
  },
  sms_brakes: {
    followup_cap: 6,
    daily_cap: 2,
    spacing_hours: 3,
    reply_window_minutes: 15,
    reply_burst_cap: 5,
  },
  lead_watch: {
    enabled: true,
    auto_first_response: true,
    grace_minutes: 5,
    renotify_minutes: 120,
  },
  // Texts the owner sends often. Prices here must match config/pricing-rules;
  // the settings tab shows the live values next to the list as a reminder.
  quick_replies: [
    {
      id: "occasion",
      label: "问场合",
      body: "What kind of party is it? Birthday, bachelorette, a family get-together... I'll make sure the show fits the crowd.",
    },
    {
      id: "pricing",
      label: "报价说明",
      body: "It's $59.90 per adult and $29.90 per kid (5-12), kids under 5 eat free, $599 minimum. That covers the chef, grill, all the food, the show, setup and cleanup. Mon-Thu parties are $54.90 per adult and come with a free appetizer platter.",
    },
    {
      id: "deposit",
      label: "押金链接",
      body: "To lock in your date it's a $19.90 deposit and takes a minute: {deposit_link}",
    },
    {
      id: "menu",
      label: "菜单 + 视频",
      body: "Here's the menu: https://www.realhibachi.com/menu and a look at a party: https://www.realhibachi.com/gallery",
    },
    {
      id: "rentals",
      label: "桌椅餐具",
      body: "Tables, chairs and black tablecloths are $10 per guest; plates, napkins and silverware $5 per guest, $15 for both. Chopsticks on request, no charge.",
    },
    {
      id: "discounts",
      label: "优惠说明",
      body: "Party-size discount: $30 off for 10-14 guests, $60 off for 15-24, $90 off for 25-30. Mon-Thu parties also get a free appetizer platter (gyoza, edamame, spring rolls).",
    },
  ],
  calendar: {
    day_start_hour: 10,
    day_end_hour: 22,
    evening_from_hour: 17,
  },
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function str(v: unknown, fallback: string, max = 300): string {
  return typeof v === "string" ? v.trim().slice(0, max) : fallback
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback
}

/**
 * Coerce one section's stored JSON (or a PUT body) into the typed shape.
 * Unknown keys are dropped, bad values fall back to the default, so a
 * hand-edited row can never break the workbench.
 */
export function sanitizeSection<K extends SettingsSection>(section: K, raw: unknown): WorkbenchSettings[K] {
  const d = DEFAULT_SETTINGS
  switch (section) {
    case "business": {
      const r = isObj(raw) ? raw : {}
      const out: WorkbenchSettings["business"] = {
        brand: str(r.brand, d.business.brand, 60) || d.business.brand,
        agent_name: str(r.agent_name, d.business.agent_name, 40) || d.business.agent_name,
        chef_default_name: str(r.chef_default_name, d.business.chef_default_name, 40) || d.business.chef_default_name,
        support_phone: str(r.support_phone, d.business.support_phone, 30),
        backup_phone: str(r.backup_phone, d.business.backup_phone, 30),
        support_email: str(r.support_email, d.business.support_email, 120),
        review_url: str(r.review_url, d.business.review_url, 400),
        invoice_tool_url: str(r.invoice_tool_url, d.business.invoice_tool_url, 200) || d.business.invoice_tool_url,
        planner_url: str(r.planner_url, d.business.planner_url, 200) || d.business.planner_url,
      }
      return out as WorkbenchSettings[K]
    }
    case "targets": {
      const r = isObj(raw) ? raw : {}
      const out: WorkbenchSettings["targets"] = {
        cpa_target_cents: num(r.cpa_target_cents, d.targets.cpa_target_cents, 0, 10_000_00),
        cpa_goal_cents: num(r.cpa_goal_cents, d.targets.cpa_goal_cents, 0, 10_000_00),
        first_response_sla_minutes: num(r.first_response_sla_minutes, d.targets.first_response_sla_minutes, 1, 1440),
        weekly_spend_cap_cents: num(r.weekly_spend_cap_cents, d.targets.weekly_spend_cap_cents, 0, 100_000_00),
        weekly_deposit_target: num(r.weekly_deposit_target, d.targets.weekly_deposit_target, 0, 1000),
        weekly_cost_per_order_stop_cents: num(r.weekly_cost_per_order_stop_cents, d.targets.weekly_cost_per_order_stop_cents, 0, 100_000_00),
        lead_min_guests: num(r.lead_min_guests, d.targets.lead_min_guests, 1, 100),
      }
      return out as WorkbenchSettings[K]
    }
    case "sms_brakes": {
      const r = isObj(raw) ? raw : {}
      const out: WorkbenchSettings["sms_brakes"] = {
        followup_cap: num(r.followup_cap, d.sms_brakes.followup_cap, 1, 50),
        daily_cap: num(r.daily_cap, d.sms_brakes.daily_cap, 1, 20),
        spacing_hours: num(r.spacing_hours, d.sms_brakes.spacing_hours, 0, 72),
        reply_window_minutes: num(r.reply_window_minutes, d.sms_brakes.reply_window_minutes, 1, 240),
        reply_burst_cap: num(r.reply_burst_cap, d.sms_brakes.reply_burst_cap, 1, 20),
      }
      return out as WorkbenchSettings[K]
    }
    case "lead_watch": {
      const r = isObj(raw) ? raw : {}
      const out: WorkbenchSettings["lead_watch"] = {
        enabled: bool(r.enabled, d.lead_watch.enabled),
        auto_first_response: bool(r.auto_first_response, d.lead_watch.auto_first_response),
        grace_minutes: num(r.grace_minutes, d.lead_watch.grace_minutes, 0, 120),
        renotify_minutes: num(r.renotify_minutes, d.lead_watch.renotify_minutes, 10, 1440),
      }
      return out as WorkbenchSettings[K]
    }
    case "quick_replies": {
      const list = Array.isArray(raw) ? raw : d.quick_replies
      const out: QuickReply[] = []
      for (const item of list.slice(0, 30)) {
        if (!isObj(item)) continue
        const label = str(item.label, "", 40)
        const body = str(item.body, "", 1000)
        if (!label || !body) continue
        const id = str(item.id, "", 40) || `qr_${out.length + 1}`
        out.push({ id, label, body })
      }
      return out as WorkbenchSettings[K]
    }
    case "calendar": {
      const r = isObj(raw) ? raw : {}
      const start = num(r.day_start_hour, d.calendar.day_start_hour, 0, 22)
      const out: WorkbenchSettings["calendar"] = {
        day_start_hour: start,
        day_end_hour: Math.max(start + 2, num(r.day_end_hour, d.calendar.day_end_hour, 2, 24)),
        evening_from_hour: num(r.evening_from_hour, d.calendar.evening_from_hour, 0, 23),
      }
      return out as WorkbenchSettings[K]
    }
    default:
      return d[section]
  }
}

/** Overlay stored rows (section → raw JSON) on the defaults. */
export function mergeSettings(rows: Partial<Record<SettingsSection, unknown>>): WorkbenchSettings {
  const out = { ...DEFAULT_SETTINGS }
  for (const section of SETTINGS_SECTIONS) {
    if (section in rows && rows[section] !== undefined) {
      ;(out as Record<string, unknown>)[section] = sanitizeSection(section, rows[section])
    }
  }
  return out
}

export function isSettingsSection(v: unknown): v is SettingsSection {
  return typeof v === "string" && (SETTINGS_SECTIONS as string[]).includes(v)
}
