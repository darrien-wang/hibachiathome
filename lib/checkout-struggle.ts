import { createServerSupabaseClient } from "@/lib/supabase"
import { sendSupportNotificationEmail } from "@/lib/ops-notifications"

// Someone who opens checkout again and again is not browsing - they are stuck,
// and we only ever hear about it if they bother to text us (2026-09-23: a
// Temecula customer started checkout five times in twelve minutes, told us
// "you guys have the wrong number and I'm not able to pay", and got through on
// the fifth try; the six notification emails were sitting in the inbox the
// whole time and nobody was watching). Every start is now written to the
// lead's timeline, and the third one inside the window raises an alert so a
// human can ask what they are seeing while they are still on the page.

const START_TYPE = "deposit_checkout_started"
const ALERT_TYPE = "deposit_checkout_stuck_alert"
/** How far back attempts count toward "stuck". */
const WINDOW_MINUTES = 20
/** Attempts within the window before we shout. */
const ALERT_AT = 3
/** Do not alert twice for the same struggle. */
const ALERT_COOLDOWN_MINUTES = 30

export interface CheckoutStartFacts {
  leadId?: string
  sessionId: string
  customerName?: string
  customerEmail?: string
  eventDate?: string
  location?: string
  checkoutUrl?: string
}

function prettyPhone(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "").slice(-10)
  if (digits.length !== 10) return raw ?? "unknown"
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

/**
 * Write this checkout start to the lead's timeline and alert when the same
 * lead keeps coming back. Best effort: a failure here must never block a
 * customer from paying.
 */
export async function recordCheckoutStart(facts: CheckoutStartFacts): Promise<{ attempts: number; alerted: boolean }> {
  const leadId = (facts.leadId ?? "").trim()
  if (!leadId || !/^[0-9a-f-]{36}$/i.test(leadId)) return { attempts: 0, alerted: false }

  const supabase = createServerSupabaseClient()
  if (!supabase) return { attempts: 0, alerted: false }

  try {
    await supabase.from("lead_touchpoints").insert({
      lead_id: leadId,
      touchpoint_type: START_TYPE,
      touchpoint_source: "deposit_start",
      external_touchpoint_id: facts.sessionId,
      raw_payload_json: {
        session_id: facts.sessionId,
        event_date: facts.eventDate ?? null,
        location: facts.location ?? null,
      },
    })

    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString()
    const { count } = await supabase
      .from("lead_touchpoints")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", leadId)
      .eq("touchpoint_type", START_TYPE)
      .gte("created_at", since)
    const attempts = count ?? 1
    if (attempts < ALERT_AT) return { attempts, alerted: false }

    // One alert per struggle, not one per click.
    const cooldownSince = new Date(Date.now() - ALERT_COOLDOWN_MINUTES * 60_000).toISOString()
    const { count: alreadyAlerted } = await supabase
      .from("lead_touchpoints")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", leadId)
      .eq("touchpoint_type", ALERT_TYPE)
      .gte("created_at", cooldownSince)
    if ((alreadyAlerted ?? 0) > 0) return { attempts, alerted: false }

    const { data: lead } = await supabase
      .from("leads")
      .select("full_name, phone, email")
      .eq("id", leadId)
      .maybeSingle()
    const who = (lead?.full_name ?? "").trim() || facts.customerName || prettyPhone(lead?.phone)
    const phone = prettyPhone(lead?.phone)
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://www.realhibachi.com"
    const suggested = "Hey - I see the payment page giving you trouble. What is it showing you? I can take the deposit another way."

    await sendSupportNotificationEmail({
      subject: `Stuck at checkout: ${who} tried ${attempts}x`,
      text: [
        `${who} has opened the deposit checkout ${attempts} times in the last ${WINDOW_MINUTES} minutes and has not paid.`,
        `Phone: ${phone}`,
        `Email: ${lead?.email ?? facts.customerEmail ?? "unknown"}`,
        facts.eventDate ? `Party date: ${facts.eventDate}` : "",
        `Workbench: ${base}/admin/leads?lead=${leadId}`,
        "",
        "Text them now - they are probably still on the page:",
        suggested,
      ]
        .filter(Boolean)
        .join("\n"),
      html: [
        `<p><strong>${who}</strong> has opened the deposit checkout <strong>${attempts} times</strong> in the last ${WINDOW_MINUTES} minutes and has not paid.</p>`,
        `<p>Phone: <strong>${phone}</strong><br/>Email: ${lead?.email ?? facts.customerEmail ?? "unknown"}${facts.eventDate ? `<br/>Party date: ${facts.eventDate}` : ""}</p>`,
        `<p><a href="${base}/admin/leads?lead=${leadId}">Open in the workbench</a></p>`,
        `<p>Text them now - they are probably still on the page:<br/><em>${suggested}</em></p>`,
      ].join(""),
    })

    await supabase.from("lead_touchpoints").insert({
      lead_id: leadId,
      touchpoint_type: ALERT_TYPE,
      touchpoint_source: "deposit_start",
      raw_payload_json: { attempts, window_minutes: WINDOW_MINUTES, session_id: facts.sessionId },
    })

    return { attempts, alerted: true }
  } catch (error) {
    console.error("[checkout-struggle] could not record or alert", error)
    return { attempts: 0, alerted: false }
  }
}
