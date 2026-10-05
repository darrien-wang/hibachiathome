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
import { PARTY_SIZE_DISCOUNT_TIERS } from "@/config/pricing-rules"

// Built from the tier table: written out by hand, the 优惠说明 text still
// stopped at 25-30 after the ladder was extended to 60 (2026-10-03).
const PARTY_SIZE_TEXT = PARTY_SIZE_DISCOUNT_TIERS.map((t, i) => `$${t.amount} off for ${t.minGuests}-${t.maxGuests}${i === 0 ? " adults" : ""}`).join(", ")

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
    // 派对时段转接：老板在场上时，等太久的客人由备份号码接手（2026-10-04）。
    escalate_mode: "off" | "party_hours" | "always"
    escalate_phone: string
    escalate_after_minutes: number
  }
  quick_replies: QuickReply[]
  calendar: {
    day_start_hour: number
    day_end_hour: number
    evening_from_hour: number
  }
  dispatch: {
    /**
     * 照的是老板他们人工排班的口径（2026-09-29 口述，见 lib/dispatch.ts）。
     * 占用时长是一个范围：开场到装车能出发，顺利 90 分钟、拖满 120 分钟。
     * 订单表里的 service_duration_minutes 全是默认值，派工不读它。
     */
    busy_min_minutes: number
    busy_max_minutes: number
    /** 目标：下一场开场前多久到。 */
    arrive_early_minutes: number
    /** 迟到多久以内算"最差还能接受"。 */
    late_ok_minutes: number
    /** 迟到的极限——到这个数就要给客人补偿了。 */
    late_limit_minutes: number
    /**
     * 车程用 Google 按出发时刻预测路况，而不是 OSRM 的不堵车理想值。
     * 默认关：带出发时刻的调用走 Google 更贵的计费档，花的是老板账户的钱，
     * 得他自己点开。
     */
    google_traffic: boolean
  }
  notifications: {
    /**
     * Copy every inbound customer text to the ops mailbox.
     *
     * It existed because nothing surfaced a text unless someone had the
     * workbench open on a laptop. The phone app rings for them now, so the
     * owner turned it off (2026-09-28). Turn it back on here if the app ever
     * goes quiet - the 2026-09-14 gap (six leads, five unanswered) is what
     * this belt was for.
     */
    sms_to_email: boolean
    /**
     * Pictures and video are a separate switch on purpose: a
     * carrier-transcoded 3GPP clip will not play in any browser, so the
     * mailbox is the only place that attachment opens at all.
     */
    mms_to_email: boolean
  }
  chefs: {
    /** Defaults for a newly added chef (cents / head count). */
    default_base_pay_cents: number
    default_head_from: number
    default_per_head_cents: number
    skill_options: string[]
    area_options: string[]
  }
}

export type SettingsSection = keyof WorkbenchSettings

export const SETTINGS_SECTIONS: SettingsSection[] = [
  "business",
  "targets",
  "sms_brakes",
  "lead_watch",
  "dispatch",
  "notifications",
  "quick_replies",
  "calendar",
  "chefs",
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
    // Was 6 until the 2026-09-27 audit: after our third unanswered text the
    // reply rate fell to 15%, and every "Last note from me" got zero replies.
    // Three total (the instant quote, one personal first message, one
    // follow-up with a real reason) - then the lead is held, not chased.
    followup_cap: 3,
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
    escalate_mode: "party_hours",
    escalate_phone: "",
    escalate_after_minutes: 15,
  },
  dispatch: {
    busy_min_minutes: 90,
    busy_max_minutes: 120,
    arrive_early_minutes: 10,
    late_ok_minutes: 30,
    late_limit_minutes: 60,
    google_traffic: false,
  },
  notifications: {
    sms_to_email: false,
    mms_to_email: true,
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
      body: "It's $59.90 per adult and $29.90 per kid (5-12), kids under 5 eat free, $599 minimum. That covers the chef, grill, all the food, the show, setup and cleanup. Mon-Thu parties are $54.90 per adult and come with a free appetizer of your choice (gyoza, edamame or spring rolls).",
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
      body: `Party-size discount: ${PARTY_SIZE_TEXT}. Mon-Thu parties also get a free appetizer of your choice (gyoza, edamame or spring rolls).`,
    },
  ],
  calendar: {
    day_start_hour: 10,
    day_end_hour: 22,
    evening_from_hour: 17,
  },
  chefs: {
    default_base_pay_cents: 20000,
    default_head_from: 16,
    default_per_head_cents: 600,
    skill_options: ["英文流利", "中文", "西语", "大场 30+", "素食 / 过敏处理", "表演火焰", "日式刀工"],
    area_options: ["LA", "OC", "SD", "IE", "PS", "SB"],
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
        escalate_mode: r.escalate_mode === "off" || r.escalate_mode === "always" || r.escalate_mode === "party_hours" ? r.escalate_mode : d.lead_watch.escalate_mode,
        escalate_phone: str(r.escalate_phone, d.lead_watch.escalate_phone, 30),
        escalate_after_minutes: num(r.escalate_after_minutes, d.lead_watch.escalate_after_minutes, 5, 240),
      }
      return out as WorkbenchSettings[K]
    }
    case "dispatch": {
      const r = isObj(raw) ? raw : {}
      const lo = num(r.busy_min_minutes, d.dispatch.busy_min_minutes, 30, 300)
      const ok = num(r.late_ok_minutes, d.dispatch.late_ok_minutes, 0, 180)
      const out: WorkbenchSettings["dispatch"] = {
        busy_min_minutes: lo,
        // 拖满不可能比顺利还短；极限不可能比"还能接受"还小。
        busy_max_minutes: Math.max(lo, num(r.busy_max_minutes, d.dispatch.busy_max_minutes, 30, 360)),
        arrive_early_minutes: num(r.arrive_early_minutes, d.dispatch.arrive_early_minutes, 0, 120),
        late_ok_minutes: ok,
        late_limit_minutes: Math.max(ok, num(r.late_limit_minutes, d.dispatch.late_limit_minutes, 0, 240)),
        google_traffic: bool(r.google_traffic, d.dispatch.google_traffic),
      }
      return out as WorkbenchSettings[K]
    }
    case "notifications": {
      const r = isObj(raw) ? raw : {}
      const out: WorkbenchSettings["notifications"] = {
        sms_to_email: bool(r.sms_to_email, d.notifications.sms_to_email),
        mms_to_email: bool(r.mms_to_email, d.notifications.mms_to_email),
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
    case "chefs": {
      const r = isObj(raw) ? raw : {}
      const list = (v: unknown, fallback: string[]) => (Array.isArray(v) ? v.map((x) => str(x, 40)).filter(Boolean).slice(0, 30) : fallback)
      const out: WorkbenchSettings["chefs"] = {
        default_base_pay_cents: num(r.default_base_pay_cents, d.chefs.default_base_pay_cents, 0, 100_000_00),
        default_head_from: num(r.default_head_from, d.chefs.default_head_from, 0, 200),
        default_per_head_cents: num(r.default_per_head_cents, d.chefs.default_per_head_cents, 0, 100_00),
        skill_options: list(r.skill_options, d.chefs.skill_options),
        area_options: list(r.area_options, d.chefs.area_options),
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
