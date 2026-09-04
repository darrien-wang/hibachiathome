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

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
