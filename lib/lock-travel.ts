import zipCity from "./data/ca-zip-city.json"
import { getCityTravel } from "@/config/city-travel"
import { homeBaseOrigin } from "@/config/home-base"
import { calcSimpleEstimate, calcTravelFee, checkWeekdayEligibility } from "@/config/pricing-rules"
import { hasHouseNumber, standardizeAddress, uspsCityForZip, type StandardAddress } from "@/lib/address-standard"
import { driveFromBase, type BaseDrive } from "@/lib/base-drive"
import { zipFromAddress } from "@/lib/coarse-destination"

// ============================================================
// Travel on the order, decided when the customer locks the date
// ============================================================
// Until 2026-10-21 every self-locked order was created with $0 travel: the
// placeholder booking said travel_fee 0 and nothing measured the address.
// RH-20261022-7105 was quoted $641 with ~$42 travel to Palm Springs and came
// in at $599 for a party in Desert Hot Springs (94 mi); Lancaster (93 mi) and
// an Indio party the day before the same; all fixed by hand.
//
// Now, when the lock completes:
//   1. The address the customer entered is put in the order's form,
//      "street, City, CA zip" (lib/address-standard.ts) - a bare street line
//      gets its city and ZIP.
//   2. Its driving miles from the base are measured with the same service
//      and rule as the quote (lib/base-drive.ts, config/pricing-rules.ts:
//      first 50 miles free, then $1 a mile).
//   3. Nothing measurable (no address yet, a region like "LA & Orange
//      County", the map services down): the travel in the quote the customer
//      was sent stands instead.
//   4. Nothing at all: the fee is left unknown and said so, loudly - never a
//      silent $0.
// A signed deal can waive travel (custom-deal travelWaived): $0 on purpose,
// the miles still recorded for chef pay.

export type LockTravelSource = "address" | "city" | "quote" | "none"

export type LockTravel = {
  /** What the order should carry: the standard form when there is one, else what the customer typed. */
  address: string | null
  /** The address's ZIP, when known. */
  zip: string | null
  /** True when `address` is the standard "street, City, CA zip" form. */
  standardized: boolean
  /** Driving miles from the base, when measured. */
  miles: number | null
  /** The travel fee to bill; null when nothing was measured or quoted. */
  fee: number | null
  source: LockTravelSource
  waived: boolean
  /** The travel in the customer's quote, when one was found. */
  quotedFee: number | null
  /** One line for the ops email: how the figure was reached. */
  summary: string
}

const PLACEHOLDER = /^(?:tbd|n\/?a|none|unknown|-+|\?+)$/i
const KNOWN_CITIES = new Set(Object.values(zipCity as Record<string, string>).map((c) => c.toLowerCase()))

/** "Palm Springs" / "palm springs, CA" / "92201" -> "Palm Springs, CA" (a place the router can find), or null. */
export function cityQuery(text: string | null | undefined): string | null {
  const t = (text ?? "").trim()
  const zipCityName = uspsCityForZip(/^\s*(\d{5})(?:-\d{4})?\s*$/.exec(t)?.[1])
  if (zipCityName) return `${zipCityName}, CA ${t.slice(0, 5)}`
  // Only a separate "CA" / "California" word goes - "Santa Monica" keeps its "ca".
  const name = t.replace(/(?:,\s*|\s+)(?:CA|California)\.?(?:\s+\d{5}(?:-\d{4})?)?\s*$/i, "").replace(/,\s*$/, "").trim()
  return name && KNOWN_CITIES.has(name.toLowerCase()) ? `${name}, CA` : null
}

/**
 * The travel part of a quoted total: the total minus what the same party's
 * food alone prices to, as the deposit page reads it. Under $1.50 is the
 * rounding a link applies to its estimate, not travel.
 */
export function travelFromEstimate(args: { estimate: number | null | undefined; adults: number; kids: number; eventDate?: string | null }): number | null {
  const estimate = Number(args.estimate)
  if (!Number.isFinite(estimate) || estimate <= 0) return null
  const adults = Math.max(0, Math.floor(Number(args.adults) || 0))
  const kids = Math.max(0, Math.floor(Number(args.kids) || 0))
  if (adults + kids === 0) return null
  const date = /^\d{4}-\d{2}-\d{2}$/.test(args.eventDate ?? "") ? (args.eventDate as string) : null
  const weekday = date ? checkWeekdayEligibility(date, { adult: adults, child: kids, toddler: 0 }).isEligible : false
  const food = calcSimpleEstimate({ adults, kids, weekdaySpecial: weekday, travelFee: 0 }).total
  const travel = estimate - food
  return travel >= 1.5 ? Math.round(travel) : 0
}

/**
 * The travel in the quote the customer was sent, best source first: the
 * site's texted quote (it records its travel), the deposit link's own
 * estimate, then the published travel for the city the quote was for.
 * `null` when none of them says anything.
 */
export function quotedTravel(args: {
  /** computed.travelFee of the lead's latest texted quote, and whether that quote left travel pending. */
  textedQuote?: { travelFee: number | null; travelPending: boolean } | null
  /** The link's estimate - only when it is a plain estimate (no agreed total, no deal). */
  estimate?: { amount: number | null; adults: number; kids: number; eventDate?: string | null } | null
  /** The place the link / quote named. */
  place?: string | null
}): number | null {
  const texted = args.textedQuote
  if (texted && !texted.travelPending && typeof texted.travelFee === "number" && Number.isFinite(texted.travelFee) && texted.travelFee >= 0) {
    return Math.round(texted.travelFee * 100) / 100
  }
  if (args.estimate) {
    const fromEstimate = travelFromEstimate({ ...args.estimate, estimate: args.estimate.amount })
    if (fromEstimate !== null && fromEstimate > 0) return fromEstimate
  }
  const city = cityQuery(args.place)?.replace(/,\s*CA.*$/, "")
  const table = city ? getCityTravel(city.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")) : undefined
  if (table) return table.fee
  return null
}

export type LockTravelDeps = {
  standardize?: (raw: string, opts: { cityHint?: string | null }) => Promise<StandardAddress | null>
  drive?: (origin: string, destination: string) => Promise<BaseDrive>
  origin?: string
  /** The whole lookup gives up after this long and falls back to the quote. */
  deadlineMs?: number
}

const money = (n: number) => `$${n.toFixed(2)}`

type Measured = { std: StandardAddress | null; destination: string | null; drive: BaseDrive | null }

async function measure(typed: string | null, cityHint: string | null, deps: Required<Omit<LockTravelDeps, "deadlineMs">>): Promise<Measured> {
  const street = typed !== null && hasHouseNumber(typed)
  const std = street ? await deps.standardize(typed, { cityHint }) : null
  // What to route to. A street the standardizer could not place is routed
  // only when it names its own town or ZIP (anchored to California) - "123
  // Main St" alone would geocode to whichever Main Street the map likes
  // best, so it gets the town the customer was quoted for instead.
  let destination: string | null = null
  if (std) destination = std.address
  else if (street && (typed.includes(",") || zipFromAddress(typed))) destination = /\b(?:CA|California)\b/i.test(typed) ? typed : `${typed}, CA`
  else if (street) destination = cityQuery(cityHint)
  else destination = typed ? cityQuery(typed) : cityQuery(cityHint)
  if (!destination) return { std, destination: null, drive: null }
  const drive = await deps.drive(deps.origin, destination)
  return { std, destination, drive }
}

/**
 * Travel for a party whose date is being locked. Never throws: a failure
 * anywhere falls back to the quote, and then to "unknown", said out loud.
 */
export async function resolveLockTravel(
  input: { address: string | null | undefined; cityHint?: string | null; quotedFee: number | null; waived: boolean },
  deps: LockTravelDeps = {},
): Promise<LockTravel> {
  const raw = (input.address ?? "").replace(/\s+/g, " ").trim()
  const typed = raw && !PLACEHOLDER.test(raw) ? raw : null
  const cityHint = (input.cityHint ?? "").trim() || null
  const full = {
    standardize: deps.standardize ?? ((a: string, o: { cityHint?: string | null }) => standardizeAddress(a, o)),
    drive: deps.drive ?? driveFromBase,
    origin: deps.origin ?? homeBaseOrigin(),
  }

  let measured: Measured = { std: null, destination: null, drive: null }
  let timedOut = false
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const deadline = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => resolve("timeout"), deps.deadlineMs ?? 9000)
    })
    const result = await Promise.race([measure(typed, cityHint, full), deadline])
    if (result === "timeout") timedOut = true
    else measured = result
  } catch (error) {
    console.warn("[lock-travel] measuring failed", error instanceof Error ? error.message : error)
  } finally {
    clearTimeout(timer)
  }

  const std = measured.std
  const base = {
    address: std?.address ?? typed,
    zip: std?.zip ?? null,
    standardized: Boolean(std),
    waived: input.waived,
    quotedFee: input.quotedFee,
  }
  const waivedNote = (fee: number | null) => (fee !== null && fee > 0 ? `; waived by the deal (would be ${money(fee)})` : "; waived by the deal")

  const drive = measured.drive
  if (drive?.ok) {
    const miles = Math.round(drive.result.drivingMiles * 10) / 10
    const ruleFee = calcTravelFee(miles)
    const toStreet = hasHouseNumber(measured.destination ?? "")
    const source: LockTravelSource = toStreet && !drive.approximate ? "address" : "city"
    const where =
      source === "address"
        ? "the address"
        : toStreet
          ? "the town (the map has no pin for that house)"
          : `${measured.destination} (a town, no street address yet)`
    return {
      ...base,
      miles,
      fee: input.waived ? 0 : ruleFee,
      source,
      summary: `${miles} mi to ${where} -> ${money(input.waived ? 0 : ruleFee)}${input.waived ? waivedNote(ruleFee) : ""}`,
    }
  }

  const why = timedOut
    ? "measuring timed out"
    : measured.destination
      ? `could not measure "${measured.destination}"`
      : typed
        ? `"${typed}" is not an address or town we can measure`
        : "no address yet"
  if (input.quotedFee !== null) {
    return {
      ...base,
      miles: null,
      fee: input.waived ? 0 : input.quotedFee,
      source: "quote",
      summary: `not measured (${why}) -> quoted travel ${money(input.quotedFee)}${input.waived ? waivedNote(input.quotedFee) : ""}`,
    }
  }
  return {
    ...base,
    miles: null,
    fee: input.waived ? 0 : null,
    source: "none",
    summary: input.waived ? `not measured (${why}); waived by the deal` : `UNKNOWN - not measured (${why}) and no quote travel to fall back on: check the address`,
  }
}
