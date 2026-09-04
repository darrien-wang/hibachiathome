import { NextResponse } from "next/server"
import { escapeHtml } from "@/lib/escape-html"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"
import { isOpsEmailEffectivelyHandled, sendSupportNotificationEmail } from "@/lib/ops-notifications"
import { createServerSupabaseClient } from "@/lib/supabase"

const WEEKEND_DAYS = new Set(["fri", "sat", "sun"])
const LOCALES = new Set(["zh", "en", "es"])

function asString(value: unknown, max = 500): string | undefined {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.slice(0, max)
}

function asDays(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const days = value
    .filter((day): day is string => typeof day === "string")
    .map((day) => day.trim().toLowerCase())
    .filter((day) => WEEKEND_DAYS.has(day))
  return Array.from(new Set(days))
}

function resolvePathFromReferer(value: string | null): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    return `${url.pathname}${url.search || ""}`
  } catch {
    return undefined
  }
}

export async function POST(request: Request) {
  const limit = await rateLimit("jobs", request, 5, 60)
  if (!limit.ok) {
    const { status, body } = tooManyRequests()
    return NextResponse.json(body, { status })
  }

  try {
    const body = (await request.json()) as Record<string, unknown>

    const name = asString(body.name, 120)
    const phone = asString(body.phone, 40)
    const cityOrZip = asString(body.cityOrZip, 120)

    // Three fields is the whole gate. Everything else on this form is useful
    // for sorting applicants, not for reaching them — and a form that rejects
    // someone over an optional field is a form that loses the applicant.
    if (!name || !phone || !cityOrZip) {
      return NextResponse.json({ error: "Name, phone, and city are required" }, { status: 400 })
    }

    const email = asString(body.email, 200)
    const vehicle = asString(body.vehicle, 200)
    const experience = asString(body.experience, 2000)
    const earliestStart = asString(body.earliestStart, 200)
    const availability = asDays(body.availability)
    const hasCar = body.hasCar === true
    const acceptsTerms = body.acceptsTerms === true
    const localeRaw = asString(body.locale, 8)?.toLowerCase()
    const locale = localeRaw && LOCALES.has(localeRaw) ? localeRaw : "zh"
    const sourcePage = resolvePathFromReferer(request.headers.get("referer"))

    let persistenceError: string | null = null
    const supabase = createServerSupabaseClient()

    if (supabase) {
      const { error } = await supabase.from("chef_applications").insert({
        name,
        phone,
        email: email ?? null,
        city_or_zip: cityOrZip,
        has_car: hasCar,
        vehicle: vehicle ?? null,
        availability,
        experience: experience ?? null,
        accepts_terms: acceptsTerms,
        earliest_start: earliestStart ?? null,
        locale,
        source_page: sourcePage ?? null,
        raw_payload: body,
      })
      if (error) {
        persistenceError = error.message
        console.error("[CHEF_APPLICATION_PERSISTENCE_FAILED]", { error: error.message, phone })
      }
    } else {
      persistenceError = "Supabase client unavailable"
      console.error("[CHEF_APPLICATION_PERSISTENCE_FAILED] Supabase client unavailable", { phone })
    }

    // An applicant who reaches the inbox but never reached the database is only
    // recoverable if whoever opens the email knows to copy them out. Say so at
    // the top, the same way the contact route does.
    const warningHtml = persistenceError
      ? `<div style="border:2px solid #b91c1c;background:#fef2f2;border-radius:8px;padding:12px;margin-bottom:16px">
          <p style="margin:0;color:#7f1d1d;font-weight:bold">NOT SAVED TO THE DATABASE &mdash; copy these details out of this email.</p>
          <p style="margin:6px 0 0;color:#7f1d1d">Reason: ${escapeHtml(persistenceError)}</p>
        </div>`
      : ""

    const daysLabel = availability.length ? availability.join(", ").toUpperCase() : "none selected"

    const emailHtml = `
      ${warningHtml}
      <h2>New chef application</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
      ${email ? `<p><strong>Email:</strong> ${escapeHtml(email)}</p>` : ""}
      <p><strong>City / ZIP:</strong> ${escapeHtml(cityOrZip)}</p>
      <p><strong>Car:</strong> ${hasCar ? "yes" : "no"}${vehicle ? ` &mdash; ${escapeHtml(vehicle)}` : ""}</p>
      <p><strong>Weekend availability:</strong> ${escapeHtml(daysLabel)}</p>
      <p><strong>Earliest weekend to shadow:</strong> ${escapeHtml(earliestStart || "not given")}</p>
      <p><strong>Accepts 1099 + own hand tools:</strong> ${acceptsTerms ? "yes" : "no"}</p>
      <p><strong>Read the page in:</strong> ${escapeHtml(locale)}</p>
      <h3>Experience</h3>
      <p>${escapeHtml(experience || "none given").replace(/\n/g, "<br>")}</p>
      <hr>
      <p><strong>Next step:</strong> text them the three script lines and ask for a voice memo back.</p>
    `

    const emailText = [
      persistenceError ? `!! NOT SAVED TO THE DATABASE - copy these details out.\n!! Reason: ${persistenceError}\n` : null,
      "New chef application",
      `Name: ${name}`,
      `Phone: ${phone}`,
      email ? `Email: ${email}` : null,
      `City/ZIP: ${cityOrZip}`,
      `Car: ${hasCar ? "yes" : "no"}${vehicle ? ` - ${vehicle}` : ""}`,
      `Weekend availability: ${daysLabel}`,
      `Earliest weekend to shadow: ${earliestStart || "not given"}`,
      `Accepts 1099 + own hand tools: ${acceptsTerms ? "yes" : "no"}`,
      `Read the page in: ${locale}`,
      "",
      "Experience:",
      experience || "none given",
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n")

    const emailResult = await sendSupportNotificationEmail({
      subject: `Chef application - ${name} (${cityOrZip})`,
      text: emailText,
      html: emailHtml,
    })

    // The applicant is told "we got it" as long as the submission landed
    // somewhere we can recover it from. Both sinks failing is the only case
    // worth surfacing, because then it really is lost.
    if (persistenceError && !isOpsEmailEffectivelyHandled(emailResult)) {
      return NextResponse.json(
        { error: "We could not save your application. Please text 562-713-4832 instead." },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[CHEF_APPLICATION_FAILED]", error)
    return NextResponse.json({ error: "Something went wrong. Please text 562-713-4832." }, { status: 500 })
  }
}
