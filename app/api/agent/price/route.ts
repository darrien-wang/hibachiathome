import { NextResponse } from "next/server"
import { rateLimit, tooManyRequests } from "@/lib/rate-limit"
import { getDrivingMiles } from "@/lib/travel-distance"
import { homeBaseOrigin } from "@/config/home-base"
import {
  DEPOSIT_AMOUNT,
  GUEST_TIERS,
  MINIMUM_SPEND,
  PARTY_SIZE_CUSTOM_FROM,
  TRAVEL_FREE_RADIUS_MILES,
  WEEKDAY_SPECIAL,
  calcSimpleEstimate,
  calcTravelFee,
  checkWeekdayEligibility,
  weekdayBlackoutLabel,
} from "@/config/pricing-rules"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Exact price for AI agents (决策日志 D-0917-06). People on the site see a
// range until they leave contact details (D-0913-06); an agent comparing
// caterers for someone gets the real number, computed by the same
// calcSimpleEstimate the landing pages and the quote text use.
//
// GET /api/agent/price?adults=15&kids=2&under5=1&date=2026-10-14&zip=92618

const ORIGIN_ZIP = homeBaseOrigin()

const int = (v: string | null, min: number, max: number) => {
  const n = Math.round(Number(v ?? 0))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min
}

function todayLA(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date())
}

export async function GET(request: Request) {
  const limited = await rateLimit("agent-price", request, 40, 600)
  if (!limited.ok) {
    const { status, body } = tooManyRequests()
    return NextResponse.json(body, { status })
  }

  const q = new URL(request.url).searchParams
  const adults = int(q.get("adults"), 0, 200)
  const kids = int(q.get("kids"), 0, 100)
  const under5 = int(q.get("under5"), 0, 100)
  const date = (q.get("date") ?? "").trim()
  const zip = (q.get("zip") ?? "").trim()

  if (adults + kids < 1) {
    return NextResponse.json({ ok: false, error: "adults_required", message: "Pass adults (13+) and optionally kids (5-12) and under5." }, { status: 400 })
  }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: "date_invalid", message: "Use YYYY-MM-DD." }, { status: 400 })
  }
  if (date && date < todayLA()) {
    return NextResponse.json({ ok: false, error: "date_past", message: "That date has already passed." }, { status: 400 })
  }
  if (zip && !/^\d{5}$/.test(zip)) {
    return NextResponse.json({ ok: false, error: "zip_invalid", message: "Use a 5-digit US ZIP code." }, { status: 400 })
  }

  const paidGuests = adults + kids
  if (paidGuests >= PARTY_SIZE_CUSTOM_FROM) {
    return NextResponse.json({
      ok: true,
      customQuote: true,
      message: `Parties of ${PARTY_SIZE_CUSTOM_FROM}+ guests get a custom quote. Submit a quote request (POST /api/agent/quote-request) and a person replies by text.`,
    })
  }

  // With a date the real rule decides (Mon-Thu, holiday blackouts); without
  // one, show both so the agent can tell the customer what a weekday saves.
  const eligibility = date ? checkWeekdayEligibility(date, { adult: adults, child: kids, toddler: under5 }) : null

  let travel: { fee: number; drivingMiles: number | null; note: string } = {
    fee: 0,
    drivingMiles: null,
    note: zip ? "" : `Pass zip for the exact travel fee. The first ${TRAVEL_FREE_RADIUS_MILES} driving miles are free.`,
  }
  if (zip) {
    try {
      const r = await getDrivingMiles(ORIGIN_ZIP, zip)
      travel = { fee: Math.round(calcTravelFee(r.drivingMiles)), drivingMiles: r.drivingMiles, note: "" }
    } catch {
      travel.note = "Could not measure the drive right now; the team confirms any travel fee before the deposit."
    }
  }

  const quote = (weekday: boolean) => {
    const est = calcSimpleEstimate({ adults, kids, weekdaySpecial: weekday, travelFee: travel.fee })
    const platter = weekday || paidGuests + under5 >= 20
    return {
      plan: weekday ? "Weekday Special (Mon-Thu)" : "Standard",
      adultRate: weekday ? GUEST_TIERS.adult.weekdayPrice : GUEST_TIERS.adult.price,
      childRate: weekday ? GUEST_TIERS.child.weekdayPrice : GUEST_TIERS.child.price,
      under5Rate: 0,
      foodSubtotal: est.subtotal,
      partySizeDiscount: est.partySizeDiscountApplied,
      minimumApplied: est.minApplied,
      travelFee: est.travelFee,
      total: est.total,
      // 2026-09-22: one appetizer of the customer's choice, not a 3-item platter.
      freeAppetizer: platter
        ? `One free appetizer of your choice (${WEEKDAY_SPECIAL.appetizerPlatter.detail}), one tray for the table to share; gyoza if you don't choose`
        : null,
    }
  }

  const standard = quote(false)
  const weekday = quote(true)
  const blackout = date ? weekdayBlackoutLabel(date) : null

  return NextResponse.json({
    ok: true,
    currency: "USD",
    guests: { adults, kids, under5 },
    date: date || null,
    zip: zip || null,
    price: eligibility ? (eligibility.isEligible ? weekday : standard) : standard,
    ...(eligibility
      ? {}
      : { ifMondayToThursday: weekday }),
    weekdaySpecial: eligibility
      ? eligibility.isEligible
        ? "applies to this date"
        : blackout
          ? `not available on ${blackout}`
          : "Monday-Thursday only"
      : "Monday-Thursday only; pass date to apply it",
    travel,
    notIncluded: [
      "Gratuity for the chef (20-25% is customary)",
      "Optional upgrades and add-ons (see /llms.txt)",
      "4% processing fee if the balance is paid by card, Venmo or Zelle (cash has no fee)",
    ],
    minimum: MINIMUM_SPEND,
    deposit: {
      amount: DEPOSIT_AMOUNT,
      note: "Locks the date, fully refundable with 72+ hours notice. The customer pays it through the link we text and email them.",
    },
    next: "To book, ask the customer for permission and their name, mobile and email, then POST /api/agent/quote-request.",
  })
}
