import zipCity from "./data/ca-zip-city.json"

// CA ZIP -> USPS city name ("92201" -> "Indio"). A copy of the invoice repo's
// lib/data/ca-zip-city.json (its address autocomplete takes city names from
// it). Server routes only - 52 KB has no business in a client bundle.
const TABLE = zipCity as Record<string, string>

/**
 * The town for a bare ZIP the customer typed into a city field. The quote text
 * read "your 92201 hibachi price" (Amanda 2026-10-16, Meta destination form);
 * anything that is not a 5-digit California ZIP gives "".
 */
export function cityForZip(s: string | null | undefined): string {
  const m = /^\s*(\d{5})(?:-\d{4})?\s*$/.exec(s ?? "")
  return (m && TABLE[m[1]]) || ""
}
