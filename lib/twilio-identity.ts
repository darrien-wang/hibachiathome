// Shared helpers for routing calls between Twilio and the browser softphone.

// Twilio client identities travel through TwiML attributes and URLs, so keep
// them to a conservative charset.
export function identityForAlias(alias: string): string {
  return `agent_${alias.toLowerCase().replace(/[^a-z0-9_-]/g, "")}`
}

// Every staff member who could be signed in to the softphone: the owner plus
// each alias in AGENT_DASH_KEYS. Inbound calls ring all of them at once.
export function agentIdentities(): string[] {
  const aliases = ["owner"]
  for (const entry of (process.env.AGENT_DASH_KEYS ?? "").split(",")) {
    const [alias, key] = entry.split(":").map((s) => s?.trim())
    if (alias && key) aliases.push(alias)
  }
  const seen = new Set<string>()
  return aliases
    .map(identityForAlias)
    .filter((id) => id !== "agent_" && !seen.has(id) && seen.add(id))
}

/** Identity for whoever the token route authenticated: key alias, or a
 *  workbench member (SMS / passkey login). Names that slug to nothing
 *  (e.g. Chinese) fall back to the member id so two people never share one. */
export function identityForActor(actor: { alias: string; memberId?: string | null }): string {
  const id = identityForAlias(actor.alias)
  if (id !== "agent_") return id
  return identityForAlias(`m${(actor.memberId ?? "anon").replace(/-/g, "").slice(0, 8)}`)
}

// Inbound calls ring the static list above plus every active workbench
// member, so someone logged in by phone number rings the same as a key user.
export async function ringIdentities(): Promise<string[]> {
  const ids = new Set(agentIdentities())
  try {
    const { createServerSupabaseClient } = await import("@/lib/supabase")
    const supabase = createServerSupabaseClient()
    if (supabase) {
      const { data } = await supabase.from("workbench_members").select("id, name").eq("active", true)
      for (const m of (data ?? []) as Array<{ id: string; name: string }>) ids.add(identityForActor({ alias: m.name, memberId: m.id }))
    }
  } catch {
    // Members table unreachable: the static list still rings.
  }
  return [...ids].slice(0, 10)
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
