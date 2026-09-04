import type { NextRequest } from "next/server"

export type AdminActor = { role: "owner" | "agent"; alias: string }

// Owner uses ADMIN_DASH_KEY, agents use AGENT_DASH_KEYS="anna:key1,bob:key2".
// Same scheme the leads endpoints have always used.
export function resolveAdminActor(request: NextRequest): AdminActor | null {
  const provided =
    request.headers.get("x-admin-key") ?? request.nextUrl.searchParams.get("key") ?? ""
  if (!provided) return null
  const owner = process.env.ADMIN_DASH_KEY
  if (owner && provided === owner) return { role: "owner", alias: "owner" }
  for (const entry of (process.env.AGENT_DASH_KEYS ?? "").split(",")) {
    const [alias, key] = entry.split(":").map((s) => s?.trim())
    if (alias && key && provided === key) return { role: "agent", alias }
  }
  return null
}
