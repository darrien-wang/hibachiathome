// Keeps a sweep's health record (lib/sweep-health.ts) in workbench_settings
// and sends the mails it calls for.

import { escapeHtml } from "@/lib/escape-html"
import { isOpsEmailEffectivelyHandled, sendSupportNotificationEmail } from "@/lib/ops-notifications"
import { createServerSupabaseClient } from "@/lib/supabase"
import { nextHealth, readHealth, type SweepOutcome, type SweepWatch } from "@/lib/sweep-health"

/**
 * Count one cron sweep: failures in a row go up or back to zero, and ops is
 * mailed when the streak crosses the sweep's lines and once when it works
 * again. Call it for cron sweeps only - a run by hand or a dry run says
 * nothing about whether the schedule works. Never throws: what a sweep
 * answers must not depend on its bookkeeping.
 *
 * The count lives in the database, so it cannot tell anyone that the database
 * itself is gone. A record that cannot be read leaves this sweep uncounted:
 * a failed read is not a clean slate, and a streak of 1 written over the real
 * one would put the mail off. Every failed sweep is in the function log
 * whatever happens to the record, which keeps only the last error.
 */
export async function recordSweepHealth(watch: SweepWatch, outcome: SweepOutcome): Promise<void> {
  const tag = `[${watch.name}]`
  if (!outcome.ok) console.error(`${tag} sweep failed:`, outcome.error)
  try {
    const supabase = createServerSupabaseClient()
    if (!supabase) return
    const { data, error: readError } = await supabase.from("workbench_settings").select("value").eq("key", watch.key).maybeSingle()
    if (readError) {
      console.error(`${tag} health record not read, sweep not counted`, readError.message)
      return
    }
    const prev = readHealth((data as { value?: unknown } | null)?.value)
    const now = Date.now()
    const nowIso = new Date(now).toISOString()
    const { health, alert, recovered } = nextHealth(prev, outcome, nowIso, watch.cadence)
    const { error } = await supabase
      .from("workbench_settings")
      .upsert({ key: watch.key, value: health, updated_at: nowIso, updated_by: `${watch.name} cron` }, { onConflict: "key" })
    if (error) console.error(`${tag} health record not saved`, error.message)
    const mail = alert ? watch.failingMail(health, now) : recovered ? watch.recoveredMail(prev, now) : null
    if (!mail) return
    const sent = await sendSupportNotificationEmail({
      subject: mail.subject,
      text: mail.text,
      html: `<pre style="white-space:pre-wrap;font-family:system-ui,sans-serif;font-size:14px;line-height:1.5">${escapeHtml(mail.text)}</pre>`,
    })
    if (!isOpsEmailEffectivelyHandled(sent)) console.error(`${tag} health mail not sent`, mail.subject, sent.error ?? sent.skippedReason)
  } catch (e) {
    console.error(`${tag} health tracking failed`, e instanceof Error ? e.message : e)
  }
}
