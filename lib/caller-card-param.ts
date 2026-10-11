// The caller card's trip from the inbound TwiML to the ring screen (lib/caller-card.ts): one Twilio
// <Parameter> on each App leg, which the Android and browser Voice SDKs hand over with the call
// invite. The value is base64url JSON, so no space, "$" or Chinese character can be mangled by the
// push on the way; the Android app decodes the same format (VoiceManager.callerCard).

export const CALLER_CARD_PARAM = "callerCard"

export type CallerCard = {
  /** The name as we have it; "" when we only know the party. */
  name: string
  /** "35人 · 10月12日 周一 · 报价 $1,225 · 还没锁单" */
  line: string
}

export function encodeCallerCard(card: CallerCard): string {
  const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, name: card.name, line: card.line }))
  let binary = ""
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function decodeCallerCard(value: string | null | undefined): CallerCard | null {
  if (!value) return null
  try {
    const b64 = value.replace(/-/g, "+").replace(/_/g, "/")
    const binary = atob(b64 + "===".slice((b64.length + 3) % 4))
    const json = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)))) as Record<string, unknown>
    const name = typeof json.name === "string" ? json.name : ""
    const line = typeof json.line === "string" ? json.line : ""
    return name || line ? { name, line } : null
  } catch {
    return null
  }
}
