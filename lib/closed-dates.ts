import type { SupabaseClient } from "@supabase/supabase-js"

// Days closed to new bookings (owner 2026-11-19: "12/5 号现在可以关闭了 不能再接了",
// then "除非可以连台的"). One row in public.closed_dates closes its day
// (migrations/closed-dates.sql):
//   - /api/deposit/start refuses a new booking for it, with closedDateMessage;
//     a party already booked on the day still opens as locked (that check runs first)
//   - /api/landing-quote leaves the lock link out of the instant quote
//   - the lead watch does not text "<day> is open"; the lead goes to a person
// A party that can chain onto one the day already has is the owner's call: the
// desk deletes the row while that customer locks, then puts it back.
//
// Reading the table can fail; then the day counts as open. A booking we have to
// sort out by hand costs less than a customer the lock page turns away for nothing.

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/** Is this day (YYYY-MM-DD) closed to new bookings? False when it cannot be read. */
export async function isDateClosed(supabase: Pick<SupabaseClient, "from"> | null | undefined, day: string | null | undefined): Promise<boolean> {
  if (!supabase || !day || !ISO_DAY.test(day)) return false
  try {
    const { data, error } = await supabase.from("closed_dates").select("day").eq("day", day).limit(1)
    if (error) return false
    return Array.isArray(data) && data.length > 0
  } catch {
    return false
  }
}

/** "Saturday, Dec 5" for a YYYY-MM-DD day. */
export function closedDayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const weekday = date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })
  const month = date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })
  return `${weekday}, ${month} ${d}`
}

/** What the lock page shows when the customer picked a closed day. */
export function closedDateMessage(day: string): string {
  return `${closedDayLabel(day)} is fully booked. Please text us at (213) 770-7788 and we'll help you find another time.`
}
