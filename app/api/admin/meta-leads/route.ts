import { type NextRequest, NextResponse } from "next/server"
import { can, resolveAdminActor } from "@/lib/admin-auth"
import { CRON_PURPOSE_META_LEADS, cronKeyFor, isCronCall } from "@/lib/cron-key"
import { escapeHtml } from "@/lib/escape-html"
import { fetchFormLeads, fetchLeadForms, metaLeadsToken, parseLead, type MetaLead, type MetaLeadForm } from "@/lib/meta-leads"
import { META_LEADS_HEALTH_KEY, failingMail, nextHealth, readHealth, recoveredMail } from "@/lib/meta-leads-health"
import { sendSupportNotificationEmail } from "@/lib/ops-notifications"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Meta lead-form ads -> the workbench (2026-10-21, owner: "表单广告每天拨 $20").
//
//   POST ?consumer=cron            pg_cron every 2 min (derived key "meta-leads")
//   POST / GET  (admin, board)     same sweep by hand; ?dry=1 lists what it would send
//
// Every new Instant Form submission is handed to /api/landing-quote exactly as
// the landing card does it: the customer is texted and emailed the exact
// price with the lock link, the lead is filed with the Meta attribution, ops
// gets the usual notification, and lead-watch's template B follows. Each Meta
// lead id is claimed in meta_form_leads before anything is sent, so two sweeps
// never quote the same person twice.

const BASE_URL = "https://www.realhibachi.com"
const SOURCE = "meta_lead_form"
/** How far back a sweep looks. A lead older than this that was never claimed is reported, not quoted. */
const LOOKBACK_H = 48

type Claimed = { meta_lead_id: string; lead_id: string | null; result: Record<string, unknown> | null }

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "form"
}

function ptToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date())
}

/** Hand one submission to the landing-quote route. Returns what the route answered. */
async function quoteLead(form: MetaLeadForm, lead: MetaLead): Promise<{ status: number; body: Record<string, unknown>; parsed: ReturnType<typeof parseLead> }> {
  const parsed = parseLead(lead, ptToday())
  const campaign = lead.campaign_name ?? ""
  const ad = lead.ad_name ?? ""
  const notes = [
    `Meta lead form "${form.name}"${campaign ? ` · ${campaign}` : ""}${ad ? ` / ${ad}` : ""}.`,
    `Answers: guests "${parsed.guestsText || "-"}", date "${parsed.dateText || "-"}", city "${parsed.cityText || "-"}".`,
    parsed.adults ? "" : "No guest count given - quoted at 10 (the minimum); ask.",
    parsed.eventDate || !parsed.dateText ? "" : "Date not understood - quoted as date TBD; ask.",
  ]
    .filter(Boolean)
    .join(" ")
  const attribution = {
    utm_source: "facebook",
    utm_medium: "paid_social",
    utm_campaign: campaign || "lead_form",
    utm_content: ad || undefined,
    utm_term: form.name,
  }
  const body = {
    phone: parsed.phone,
    email: parsed.email,
    name: parsed.name,
    adults: parsed.adults || 10,
    kids: 0,
    eventDate: parsed.eventDate,
    cityName: parsed.cityText || "Southern California",
    citySlug: "meta-lead-form",
    source: SOURCE,
    pagePath: `/meta/lead-form/${slug(form.name)}`,
    stage: "quote",
    plan: "standard",
    travelFee: 0,
    travelPending: true,
    metaQualified: true,
    noDateYet: false,
    notes,
    metaLeadId: lead.id,
    metaFormId: form.id,
    metaCreatedTime: lead.created_time,
  }
  const res = await fetch(`${BASE_URL}/api/landing-quote?consumer=cron`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-admin-key": cronKeyFor(CRON_PURPOSE_META_LEADS) ?? "",
      cookie: `realhibachi_attribution=${encodeURIComponent(JSON.stringify(attribution))}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { status: res.status, body: json, parsed }
}

async function sweep(dry: boolean) {
  const supabase = getSupabaseAdmin()
  if (!supabase) return { ok: false, error: "supabase not configured" }
  if (!metaLeadsToken()) return { ok: false, error: "META_LEADS_TOKEN not set" }

  const since = Math.floor(Date.now() / 1000) - LOOKBACK_H * 3600
  const forms = await fetchLeadForms()
  const report: Array<Record<string, unknown>> = []
  let fetched = 0
  let sent = 0
  let skipped = 0
  let failed = 0

  for (const form of forms) {
    const leads = await fetchFormLeads(form.id, since)
    fetched += leads.length
    if (!leads.length) continue
    const { data: known } = await supabase
      .from("meta_form_leads")
      .select("meta_lead_id, lead_id, result")
      .in(
        "meta_lead_id",
        leads.map((l) => l.id),
      )
    const claimed = new Map(((known ?? []) as Claimed[]).map((k) => [k.meta_lead_id, k]))

    for (const lead of leads) {
      if (claimed.has(lead.id)) continue
      const parsed = parseLead(lead, ptToday())
      if (dry) {
        report.push({ form: form.name, id: lead.id, created: lead.created_time, ...parsed })
        continue
      }
      // Claim first: a second sweep running at the same time sees the row and moves on.
      const { error: claimError } = await supabase.from("meta_form_leads").insert({
        meta_lead_id: lead.id,
        form_id: form.id,
        form_name: form.name,
        created_time: lead.created_time,
        campaign_name: lead.campaign_name ?? null,
        ad_name: lead.ad_name ?? null,
      })
      if (claimError) {
        if (claimError.code !== "23505") console.error("[meta-leads] claim failed", { id: lead.id, error: claimError.message })
        continue
      }
      let result: Record<string, unknown>
      let leadId: string | null = null
      if (!parsed.phone || !parsed.email) {
        // The quote route needs both. A form with either prefill removed is rare;
        // a person picks it up from the ops mail instead of the lead vanishing.
        result = { skipped: !parsed.phone ? "no_phone" : "no_email", ...parsed }
        skipped++
        await sendSupportNotificationEmail({
          subject: `📘 Meta lead form without ${parsed.phone ? "an email" : "a phone"} · ${parsed.name || "no name"} · ${parsed.cityText || "-"}`,
          text: [
            `A Facebook/Instagram lead form came in without ${parsed.phone ? "an email address" : "a phone number"}, so no automatic quote went out.`,
            `Name: ${parsed.name || "-"} · phone: ${parsed.phone || "-"} · email: ${parsed.email || "-"}`,
            `Guests: ${parsed.guestsText || "-"} · date: ${parsed.dateText || "-"} · city: ${parsed.cityText || "-"}`,
            `Form: ${form.name} · ${lead.campaign_name ?? ""} / ${lead.ad_name ?? ""} · Meta lead ${lead.id}`,
            "Reach out by whatever contact they left; Leads Center in Business Suite has the full submission.",
          ].join("\n"),
          html: "",
        }).catch(() => undefined)
      } else {
        try {
          const r = await quoteLead(form, lead)
          leadId = typeof r.body.leadId === "string" ? r.body.leadId : null
          result = { status: r.status, leadId, total: r.body.total ?? null, smsDelivered: r.body.smsDelivered ?? null, personal: r.body.personal ?? null, error: r.body.error ?? null }
          if (r.status >= 400) failed++
          else sent++
        } catch (error) {
          result = { error: error instanceof Error ? error.message : String(error) }
          failed++
        }
      }
      await supabase.from("meta_form_leads").update({ lead_id: leadId, result, handled_at: new Date().toISOString() }).eq("meta_lead_id", lead.id)
      report.push({ form: form.name, id: lead.id, created: lead.created_time, ...result })
    }
  }
  return { ok: failed === 0, forms: forms.map((f) => ({ id: f.id, name: f.name, status: f.status })), fetched, sent, skipped, failed, dry, report }
}

/**
 * Cron sweeps only: count failures in a row in workbench_settings and mail ops
 * at half an hour of failing (then every 12 hours) and once when it works
 * again. pg_cron never reads our answer, so without this a broken token is
 * silent (it was, for 17 hours, on 2026-10-21/22). Never throws.
 */
async function trackHealth(failure: string | null): Promise<void> {
  const supabase = getSupabaseAdmin()
  if (!supabase) return
  try {
    const { data } = await supabase.from("workbench_settings").select("value").eq("key", META_LEADS_HEALTH_KEY).maybeSingle()
    const prev = readHealth((data as { value?: unknown } | null)?.value)
    const now = Date.now()
    const nowIso = new Date(now).toISOString()
    const { health, alert, recovered } = nextHealth(prev, failure ? { ok: false, error: failure } : { ok: true }, nowIso)
    const { error } = await supabase
      .from("workbench_settings")
      .upsert({ key: META_LEADS_HEALTH_KEY, value: health, updated_at: nowIso, updated_by: "meta-leads cron" }, { onConflict: "key" })
    if (error) console.error("[meta-leads] health upsert failed", error.message)
    const mail = alert ? failingMail(health, now) : recovered ? recoveredMail(prev, now) : null
    if (mail) {
      await sendSupportNotificationEmail({
        subject: mail.subject,
        text: mail.text,
        html: `<pre style="white-space:pre-wrap;font-family:system-ui,sans-serif;font-size:14px;line-height:1.5">${escapeHtml(mail.text)}</pre>`,
      })
    }
  } catch (e) {
    console.error("[meta-leads] health tracking failed", e instanceof Error ? e.message : e)
  }
}

async function handle(request: NextRequest) {
  const cron = isCronCall(request, CRON_PURPOSE_META_LEADS)
  if (!cron) {
    const actor = await resolveAdminActor(request)
    if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    if (!can(actor, "board")) return NextResponse.json({ error: "没有看板权限" }, { status: 403 })
  }
  const dry = request.nextUrl.searchParams.get("dry") === "1"
  let body: Record<string, unknown>
  try {
    body = await sweep(dry)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[meta-leads] sweep failed", message)
    body = { ok: false, error: message }
  }
  // A sweep that reached Meta counts as working even if one quote failed (that
  // lead keeps its own failed result row); only "could not read the forms at
  // all" is the outage this watches for.
  if (cron && !dry) await trackHealth(typeof body.error === "string" ? body.error : null)
  return NextResponse.json(body, { status: 200 })
}

export async function POST(request: NextRequest) {
  return handle(request)
}

export async function GET(request: NextRequest) {
  return handle(request)
}
