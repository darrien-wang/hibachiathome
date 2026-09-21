// Server side of the workbench settings: read the rows, overlay on the
// defaults, cache for a minute. Everything that behaves differently because
// of a setting (SMS brakes, lead watch, CPA targets) calls
// getWorkbenchSettings() at request time and never caches longer than this.
import { createServerSupabaseClient } from "@/lib/supabase"
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  type SettingsSection,
  type WorkbenchSettings,
} from "@/lib/workbench-settings-shared"

export type { WorkbenchSettings, SettingsSection } from "@/lib/workbench-settings-shared"

const CACHE_TTL_MS = 60_000

type Row = { key: string; value: unknown; updated_at: string; updated_by: string | null }

let cache: { at: number; settings: WorkbenchSettings; meta: Record<string, { updated_at: string; updated_by: string | null }> } | null = null

export async function readSettingsRows(): Promise<Row[]> {
  const supabase = createServerSupabaseClient()
  if (!supabase) return []
  const { data, error } = await supabase.from("workbench_settings").select("key, value, updated_at, updated_by")
  if (error) {
    // A missing table (fresh environment) must not take the workbench down.
    console.warn("[workbench-settings] read failed:", error.message)
    return []
  }
  return (data ?? []) as Row[]
}

export async function loadWorkbenchSettings(): Promise<{
  settings: WorkbenchSettings
  meta: Record<string, { updated_at: string; updated_by: string | null }>
}> {
  const rows = await readSettingsRows()
  const raw: Partial<Record<SettingsSection, unknown>> = {}
  const meta: Record<string, { updated_at: string; updated_by: string | null }> = {}
  for (const r of rows) {
    raw[r.key as SettingsSection] = r.value
    meta[r.key] = { updated_at: r.updated_at, updated_by: r.updated_by }
  }
  const settings = mergeSettings(raw)
  cache = { at: Date.now(), settings, meta }
  return { settings, meta }
}

/** Cached read for hot paths (SMS brakes, lead watch, channels). */
export async function getWorkbenchSettings(): Promise<WorkbenchSettings> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.settings
  try {
    return (await loadWorkbenchSettings()).settings
  } catch (e) {
    console.warn("[workbench-settings] falling back to defaults:", e instanceof Error ? e.message : e)
    return DEFAULT_SETTINGS
  }
}

export function invalidateWorkbenchSettings() {
  cache = null
}
