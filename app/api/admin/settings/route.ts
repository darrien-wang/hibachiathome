import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { resolveAdminActor, publicActor } from "@/lib/admin-auth"
import { invalidateWorkbenchSettings, loadWorkbenchSettings } from "@/lib/workbench-settings"
import { DEFAULT_SETTINGS, isSettingsSection, sanitizeSection } from "@/lib/workbench-settings-shared"
import {
  CARD_SURCHARGE_RATE,
  DEPOSIT_AMOUNT,
  FULL_SETUP_PER_GUEST,
  GUESTS_PER_CHEF,
  GUEST_TIERS,
  MINIMUM_SPEND,
  PARTY_SIZE_DISCOUNT_TIERS,
  PRICING_RULES_VERSION,
  TABLES_CHAIRS_PER_GUEST,
  TRAVEL_FREE_RADIUS_MILES,
  TRAVEL_RATE_PER_MILE,
  UTENSILS_PER_GUEST,
  WEEKDAY_SPECIAL,
  WEEKDAY_SPECIAL_BLACKOUTS,
} from "@/config/pricing-rules"
import { HOME_BASE_ZIP } from "@/config/home-base"

export const dynamic = "force-dynamic"

// 基础设置 · GET everyone on the team, PUT owner only.
//   GET               -> { ok, settings, defaults, meta, code, viewer }
//   PUT {section, value}      -> validate, upsert one section, return merged
//   PUT {section, reset:true} -> delete the row (back to the code default)
// `code` is the read-only part of the settings screen: numbers that live in
// config/*.ts on purpose (the invoice app mirrors them), shown so the owner
// sees the whole picture in one place.

function codeConfig() {
  return {
    pricing_version: PRICING_RULES_VERSION,
    adult: GUEST_TIERS.adult.price,
    adult_weekday: GUEST_TIERS.adult.weekdayPrice,
    child: GUEST_TIERS.child.price,
    child_weekday: GUEST_TIERS.child.weekdayPrice,
    minimum_spend: MINIMUM_SPEND,
    deposit: DEPOSIT_AMOUNT,
    card_surcharge_rate: CARD_SURCHARGE_RATE,
    travel_free_miles: TRAVEL_FREE_RADIUS_MILES,
    travel_rate_per_mile: TRAVEL_RATE_PER_MILE,
    home_base_zip: HOME_BASE_ZIP,
    tables_chairs_per_guest: TABLES_CHAIRS_PER_GUEST,
    utensils_per_guest: UTENSILS_PER_GUEST,
    full_setup_per_guest: FULL_SETUP_PER_GUEST,
    guests_per_chef: GUESTS_PER_CHEF,
    weekday_special_days: WEEKDAY_SPECIAL.eligibleWeekdays,
    weekday_platter_value: WEEKDAY_SPECIAL.appetizerPlatter.value,
    party_size_tiers: PARTY_SIZE_DISCOUNT_TIERS,
    blackouts: WEEKDAY_SPECIAL_BLACKOUTS,
  }
}

export async function GET(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { settings, meta } = await loadWorkbenchSettings()
  return NextResponse.json({ ok: true, settings, defaults: DEFAULT_SETTINGS, meta, code: codeConfig(), viewer: publicActor(actor) })
}

export async function PUT(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (actor.role !== "owner") return NextResponse.json({ error: "只有老板能改设置" }, { status: 403 })

  let body: { section?: unknown; value?: unknown; reset?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  if (!isSettingsSection(body.section)) return NextResponse.json({ error: "unknown section" }, { status: 400 })

  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "supabase not configured" }, { status: 500 })

  if (body.reset === true) {
    const { error } = await supabase.from("workbench_settings").delete().eq("key", body.section)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const value = sanitizeSection(body.section, body.value)
    const { error } = await supabase
      .from("workbench_settings")
      .upsert({ key: body.section, value, updated_at: new Date().toISOString(), updated_by: actor.alias }, { onConflict: "key" })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  invalidateWorkbenchSettings()
  const { settings, meta } = await loadWorkbenchSettings()
  return NextResponse.json({ ok: true, settings, meta })
}
