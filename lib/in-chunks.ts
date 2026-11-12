// A long `.in()` filter, cut into requests the database API will answer.
//
// supabase-js puts the whole list in the URL, and the API turns a URL away
// once it is too long. Production, 2026-10-26: a URL of 25,004 characters (128
// Meta click ids) was the last one answered, 25,202 (129) the first refused -
// 400 "Bad Request" in plain text within milliseconds, before the query was
// read, so not an error PostgREST explains. From then to 2026-11-12 the Meta
// sweep lost its click lookup on every run (app/api/integrations/meta-capi).
// Counting values does not bound the URL: 200 uuids are 7,800 characters, 200
// Meta click ids 39,000. So the list is cut by what it will measure in the URL.

/** Characters of one `in` list let into a URL: a quarter of what the API has been seen to answer. */
export const IN_LIST_MAX_CHARS = 6_000

/** What one value adds to the URL inside `in.(…)`, as supabase-js escapes it, its comma (%2C) included. */
export function inListCost(value: string | number): number {
  const s = String(value)
  // supabase-js wraps a value holding a comma or a bracket in double quotes.
  const written = typeof value === "string" && /[,()]/.test(s) ? `"${s}"` : s
  return new URLSearchParams({ v: written }).toString().length - 2 + 3
}

/**
 * The values in order, in groups whose `in` list stays within `maxChars` of
 * URL. A single value longer than that goes alone. Ask once per group:
 *
 *   for (const part of inChunks(ids)) {
 *     const { data, error } = await supabase.from("t").select("…").in("id", part)
 *     if (error) …   // a refused read is not an empty answer
 *   }
 */
export function inChunks<T extends string | number>(values: readonly T[], maxChars = IN_LIST_MAX_CHARS): T[][] {
  const groups: T[][] = []
  let group: T[] = []
  let used = 0
  for (const v of values) {
    const cost = inListCost(v)
    if (group.length && used + cost > maxChars) {
      groups.push(group)
      group = []
      used = 0
    }
    group.push(v)
    used += cost
  }
  if (group.length) groups.push(group)
  return groups
}
