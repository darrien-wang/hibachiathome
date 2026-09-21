// Browser-side memory that a deposit was paid on this device, written by the
// success page and read by the deposit page before it shows a pay button.
// It is the fast layer only: Safari drops script-written storage after a
// week of not visiting, and a second phone knows nothing. The server check
// (/api/deposit/status) and the refusal in /api/deposit/start are the layers
// that actually hold. Keys follow the party, not the device, so a family
// sharing one iPad can still book a second party.

export type DepositMarker = {
  orderNo?: string | null
  eventDate?: string | null
  eventTime?: string | null
  manageUrl?: string | null
  savedAt: number
}

export type DepositIdentity = {
  leadId?: string | null
  email?: string | null
  eventDate?: string | null
}

const PREFIX = "rh-deposit-paid:"

export function depositMarkerKeys(identity: DepositIdentity): string[] {
  const keys: string[] = []
  const lead = (identity.leadId ?? "").trim().toLowerCase()
  if (lead) keys.push(`${PREFIX}lead:${lead}`)
  const email = (identity.email ?? "").trim().toLowerCase()
  const date = (identity.eventDate ?? "").trim()
  if (email && date) keys.push(`${PREFIX}email:${email}|${date}`)
  return keys
}

export function readDepositMarker(identity: DepositIdentity): DepositMarker | null {
  try {
    for (const key of depositMarkerKeys(identity)) {
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as DepositMarker
      if (parsed && typeof parsed === "object" && typeof parsed.savedAt === "number") return parsed
    }
  } catch {}
  return null
}

export function writeDepositMarker(identity: DepositIdentity, marker: DepositMarker): void {
  try {
    const value = JSON.stringify(marker)
    for (const key of depositMarkerKeys(identity)) window.localStorage.setItem(key, value)
  } catch {}
}
