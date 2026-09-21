import type { NextRequest } from "next/server"
import { createHash, randomBytes } from "node:crypto"
import { createServerSupabaseClient } from "@/lib/supabase"
import { ADMIN_PERMS, AGENT_DEFAULT_PERMS, permsFor, type MemberRole, type Perms, type PublicActor } from "@/lib/workbench-perms"

export { PERM_KEYS, PERM_LABELS, permsFor, type MemberRole, type Perms, type PublicActor } from "@/lib/workbench-perms"

// Who is calling an /api/admin/* route, and what they may see.
//
// Two ways in:
//   1. x-admin-key header (or ?key=): ADMIN_DASH_KEY is the owner, AGENT_DASH_KEYS
//      ("anna:key1,bob:key2") are agents. Scripts and the old links use this.
//   2. rh_wb_session cookie: a workbench_sessions row created by SMS-code or
//      passkey login (app/api/admin/auth/*). People live in workbench_members.
//
// role "owner" = 管理员 (every existing `role !== "owner"` check keeps working),
// role "agent" = 坐席. perms narrow what an agent may see: no 看板 and no chef
// pay / documents unless the admin switches them on. Admins have every perm.

export type AdminActor = {
  role: "owner" | "agent"
  /** key alias or member name; this is what audit trails record */
  alias: string
  via: "key" | "session"
  memberId?: string
  name?: string
  phone?: string
  perms: Perms
}

export type MemberRow = { id: string; name: string; phone: string; role: MemberRole; perms: unknown; active: boolean }

/** Admins can do everything; agents only what their perms allow. */
export function can(actor: AdminActor, perm: keyof Perms): boolean {
  return actor.role === "owner" || actor.perms[perm] === true
}

/** The shape the client gets: never a key, nothing beyond what the UI needs. */
export function publicActor(actor: AdminActor): PublicActor {
  return { role: actor.role, alias: actor.alias, name: actor.name ?? actor.alias, via: actor.via, memberId: actor.memberId ?? null, perms: actor.perms }
}

export function memberActor(m: MemberRow, via: "session" | "key" = "session"): AdminActor {
  return { role: m.role === "admin" ? "owner" : "agent", alias: m.name, via, memberId: m.id, name: m.name, phone: m.phone, perms: permsFor(m.role, m.perms) }
}

function keyActor(provided: string): AdminActor | null {
  const owner = process.env.ADMIN_DASH_KEY
  if (owner && provided === owner) return { role: "owner", alias: "owner", via: "key", perms: { ...ADMIN_PERMS } }
  for (const entry of (process.env.AGENT_DASH_KEYS ?? "").split(",")) {
    const [alias, key] = entry.split(":").map((s) => s?.trim())
    if (alias && key && provided === key) return { role: "agent", alias, via: "key", perms: { ...AGENT_DEFAULT_PERMS } }
  }
  return null
}

// ---------------------------------------------------------------- sessions

export const SESSION_COOKIE = "rh_wb_session"
const SESSION_DAYS = 30
const CACHE_MS = 60_000
const TOUCH_MS = 5 * 60_000

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex")
export const newToken = () => randomBytes(32).toString("base64url")

type SessionHit = { actor: AdminActor; until: number }
// Per-instance cache so a busy workbench does not hit the sessions table on every poll.
const sessionCache = new Map<string, SessionHit>()

type SessionRow = {
  id: string
  member_id: string
  expires_at: string
  revoked_at: string | null
  last_seen_at: string | null
  workbench_members: MemberRow | MemberRow[] | null
}

async function sessionActor(token: string): Promise<AdminActor | null> {
  const hash = sha256(token)
  const hit = sessionCache.get(hash)
  if (hit && hit.until > Date.now()) return hit.actor
  const supabase = createServerSupabaseClient()
  if (!supabase) return null
  const { data } = await supabase
    .from("workbench_sessions")
    .select("id, member_id, expires_at, revoked_at, last_seen_at, workbench_members(id, name, phone, role, perms, active)")
    .eq("token_hash", hash)
    .maybeSingle()
  const row = data as SessionRow | null
  if (!row || row.revoked_at || Date.parse(row.expires_at) < Date.now()) return null
  const m = Array.isArray(row.workbench_members) ? row.workbench_members[0] : row.workbench_members
  if (!m || !m.active) return null
  const actor = memberActor(m, "session")
  sessionCache.set(hash, { actor, until: Date.now() + CACHE_MS })
  if (!row.last_seen_at || Date.now() - Date.parse(row.last_seen_at) > TOUCH_MS) {
    void supabase
      .from("workbench_sessions")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", row.id)
      .then(
        () => undefined,
        () => undefined,
      )
  }
  return actor
}

/** Key header first (scripts, old links), then the login-session cookie. */
export async function resolveAdminActor(request: NextRequest): Promise<AdminActor | null> {
  const provided = request.headers.get("x-admin-key") ?? request.nextUrl.searchParams.get("key") ?? ""
  if (provided) {
    const byKey = keyActor(provided)
    if (byKey) return byKey
  }
  const token = request.cookies.get(SESSION_COOKIE)?.value ?? ""
  if (!token) return null
  return sessionActor(token)
}

export function requestMeta(request: NextRequest): { ip: string | null; userAgent: string | null } {
  const fwd = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? ""
  const ip = fwd.split(",")[0]?.trim() || null
  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null
  return { ip, userAgent }
}

export async function createSession(
  memberId: string,
  meta: { via: "sms" | "passkey"; ip?: string | null; userAgent?: string | null },
): Promise<{ token: string; expiresAt: Date } | null> {
  const supabase = createServerSupabaseClient()
  if (!supabase) return null
  const token = newToken()
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000)
  const { error } = await supabase.from("workbench_sessions").insert({
    token_hash: sha256(token),
    member_id: memberId,
    expires_at: expiresAt.toISOString(),
    last_seen_at: new Date().toISOString(),
    user_agent: meta.userAgent ?? null,
    ip: meta.ip ?? null,
    via: meta.via,
  })
  if (error) return null
  await supabase.from("workbench_members").update({ last_login_at: new Date().toISOString() }).eq("id", memberId)
  return { token, expiresAt }
}

const cookieBase = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" }
export const sessionCookie = (token: string, expiresAt: Date) => ({ name: SESSION_COOKIE, value: token, ...cookieBase, expires: expiresAt })
export const clearedSessionCookie = () => ({ name: SESSION_COOKIE, value: "", ...cookieBase, expires: new Date(0) })

export async function revokeSessionToken(token: string): Promise<void> {
  const supabase = createServerSupabaseClient()
  if (!supabase || !token) return
  const hash = sha256(token)
  sessionCache.delete(hash)
  await supabase.from("workbench_sessions").update({ revoked_at: new Date().toISOString() }).eq("token_hash", hash).is("revoked_at", null)
}

/** Drop cached actors for a member so a perms/role change shows on their next request. */
export function dropCachedMember(memberId: string): void {
  for (const [h, hit] of sessionCache) if (hit.actor.memberId === memberId) sessionCache.delete(h)
}

export async function revokeMemberSessions(memberId: string): Promise<void> {
  const supabase = createServerSupabaseClient()
  if (!supabase) return
  dropCachedMember(memberId)
  await supabase.from("workbench_sessions").update({ revoked_at: new Date().toISOString() }).eq("member_id", memberId).is("revoked_at", null)
}
