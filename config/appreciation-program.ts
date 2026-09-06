// Rotating service-appreciation program: $50 off for a different service
// community each window, replacing a generic first-booking discount.
//
// LEGAL GUARDRAIL (California Unruh Act): honoree groups must be defined by
// OCCUPATION or SERVICE (military/veterans, healthcare, education, first
// responders). Never define a group by a protected characteristic — sex,
// race, religion, age, orientation ("ladies night" pricing has lost in CA
// courts). Occupation/service appreciation discounts are established,
// lawful practice.
//
// Verification stays honor-system + light: mention it when booking, show a
// work badge or service ID to the chef. Staff apply the $50 as a custom
// promotion line on the invoice — no pricing-engine change.

export type Honoree = {
  id: string
  /** Inclusive window, YYYY-MM-DD, Pacific time. */
  start: string
  end: string
  group: string
  /** Short emotional line above the offer. */
  headline: string
  blurb: string
}

export const APPRECIATION_AMOUNT = 50

export const APPRECIATION_TERMS =
  "Mention it when you book and show your work badge or service ID to your chef. $599+ parties, one per booking; stacks with the Weekday Special but not with other dollar-off offers."

export const APPRECIATION_SCHEDULE: Honoree[] = [
  {
    id: "teachers-2026",
    start: "2026-09-01",
    end: "2026-10-15",
    group: "Teachers & School Staff",
    headline: "For the people who show up for our kids",
    blurb:
      "Teachers, aides, coaches, counselors, school staff — this season, your party is $50 on us. You feed thirty minds all week; let someone cook for you.",
  },
  {
    id: "veterans-2026",
    start: "2026-10-16",
    end: "2026-11-30",
    group: "Veterans & Active Military",
    headline: "You served. Tonight, we serve you.",
    blurb:
      "Veterans and active-duty military: $50 off your party, through Veterans Day season. Bring the whole crew — the fire show is on us to light.",
  },
  {
    id: "healthcare-2026",
    start: "2026-12-01",
    end: "2027-01-15",
    group: "Nurses & Healthcare Workers",
    headline: "For the ones working the holiday shifts",
    blurb:
      "Nurses, techs, doctors, caregivers — while everyone else parties, you're on call. Whenever your night off lands, your party is $50 off.",
  },
  {
    id: "first-responders-2027",
    start: "2027-01-16",
    end: "2027-02-28",
    group: "Firefighters, EMTs & First Responders",
    headline: "For the first ones through the door",
    blurb:
      "Firefighters, paramedics, EMTs, dispatchers, peace officers — you run toward what everyone else runs from. Your party is $50 off, with respect.",
  },
  {
    id: "teachers-2027",
    start: "2027-03-01",
    end: "2027-04-30",
    group: "Teachers & School Staff",
    headline: "For the people who show up for our kids",
    blurb:
      "Teachers, aides, coaches, counselors, school staff — your party is $50 on us this season. You feed thirty minds all week; let someone cook for you.",
  },
  {
    id: "healthcare-2027",
    start: "2027-05-01",
    end: "2027-06-15",
    group: "Nurses & Healthcare Workers",
    headline: "Nurses Week is every week here",
    blurb:
      "Nurses, techs, doctors, caregivers — $50 off your party this season. Twelve-hour shifts earn a night where someone else does the cooking.",
  },
]

/** The honoree whose window covers the given date (PT), if any. */
export function getActiveHonoree(now: Date = new Date()): Honoree | undefined {
  const pt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now) // en-CA gives YYYY-MM-DD
  return APPRECIATION_SCHEDULE.find((h) => pt >= h.start && pt <= h.end)
}
