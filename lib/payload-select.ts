// Ask PostgREST for a few keys of a jsonb column instead of the whole document.
//
// 2026-10-13 Supabase stopped the project for 17 minutes (exceed_egress_quota):
// the inbox, the leads list and the reply audit each pulled thousands of
// lead_touchpoints a minute with the full raw_payload_json - every Twilio
// field of every text - to read one or two keys. `->` (not `->>`) keeps each
// value's JSON type, so a `true` flag is still a boolean, not the string "true".

const KEY = /^[A-Za-z_][A-Za-z0-9_]*$/
const alias = (key: string) => `pl_${key}`

/** Select fragment: `pl_Body:raw_payload_json->Body, pl_subject:raw_payload_json->subject, ...` */
export function payloadColumns(keys: readonly string[], column = "raw_payload_json"): string {
  for (const k of keys) {
    if (!KEY.test(k)) throw new Error(`payloadColumns: ${JSON.stringify(k)} is not a plain key`)
  }
  return keys.map((k) => `${alias(k)}:${column}->${k}`).join(", ")
}

/** The payload object back, with only the selected keys that had a value. */
export function payloadFrom(row: Record<string, unknown> | null | undefined, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!row) return out
  for (const k of keys) {
    const v = row[alias(k)]
    if (v !== undefined && v !== null) out[k] = v
  }
  return out
}
