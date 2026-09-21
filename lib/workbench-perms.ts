// Roles and permissions of workbench members. Client-safe: no node imports,
// so the settings UI and the server (lib/admin-auth.ts) share one definition.
//
// role "admin" = 管理员, sees and changes everything.
// role "agent" = 坐席, works leads / orders / planner / calendar; the toggles
// below open more for a specific person.

export type MemberRole = "admin" | "agent"
export type Perms = { board: boolean; chef_sensitive: boolean; sms: boolean }
export const PERM_KEYS = ["board", "chef_sensitive", "sms"] as const
export const PERM_LABELS: Record<keyof Perms, string> = {
  board: "看板（花费、CPA、渠道）",
  chef_sensitive: "厨师的工价、证件、报税、结算、报销",
  sms: "给客户发短信",
}
export const ADMIN_PERMS: Perms = { board: true, chef_sensitive: true, sms: true }
export const AGENT_DEFAULT_PERMS: Perms = { board: false, chef_sensitive: false, sms: true }

export function permsFor(role: MemberRole, overrides?: unknown): Perms {
  if (role === "admin") return { ...ADMIN_PERMS }
  const o = (overrides && typeof overrides === "object" ? overrides : {}) as Record<string, unknown>
  const out: Perms = { ...AGENT_DEFAULT_PERMS }
  for (const k of PERM_KEYS) if (typeof o[k] === "boolean") out[k] = o[k] as boolean
  return out
}

/** What the client learns about whoever is logged in. Never a key. */
export type PublicActor = {
  role: "owner" | "agent"
  alias: string
  name: string
  via: "key" | "session"
  memberId: string | null
  perms: Perms
}

export const ROLE_LABELS: Record<MemberRole, string> = { admin: "管理员", agent: "坐席" }
