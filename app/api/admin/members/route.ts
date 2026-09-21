import { type NextRequest, NextResponse } from "next/server"
import { PERM_KEYS, dropCachedMember, permsFor, resolveAdminActor, revokeMemberSessions, type MemberRole, type Perms } from "@/lib/admin-auth"
import { normalizeLoginPhone } from "@/lib/workbench-login"
import { createServerSupabaseClient } from "@/lib/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// 成员与权限. Admin only, except deleting your own passkey.
//   GET                          -> { members: [...] }
//   POST { action: "create", name, phone, role, perms }
//   POST { action: "update", id, name?, role?, perms?, active? }
//   POST { action: "revoke_sessions", id }        (kick every device)
//   POST { action: "delete_passkey", passkey_id }  (admin, or your own)

type MemberOut = {
  id: string
  name: string
  phone: string
  role: MemberRole
  perms: Perms
  active: boolean
  created_at: string
  last_login_at: string | null
  passkeys: number
  sessions: number
}

const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v)
const roleOf = (v: unknown): MemberRole | null => (v === "admin" || v === "agent" ? v : null)
function permsInput(v: unknown): Partial<Perms> {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>
  const out: Partial<Perms> = {}
  for (const k of PERM_KEYS) if (typeof o[k] === "boolean") out[k] = o[k] as boolean
  return out
}

async function listMembers(supabase: NonNullable<ReturnType<typeof createServerSupabaseClient>>): Promise<MemberOut[]> {
  const [{ data: members }, { data: keys }, { data: sessions }] = await Promise.all([
    supabase.from("workbench_members").select("id, name, phone, role, perms, active, created_at, last_login_at").order("created_at", { ascending: true }),
    supabase.from("workbench_passkeys").select("member_id"),
    supabase.from("workbench_sessions").select("member_id").is("revoked_at", null).gt("expires_at", new Date().toISOString()),
  ])
  const keyCount = new Map<string, number>()
  for (const k of (keys ?? []) as Array<{ member_id: string }>) keyCount.set(k.member_id, (keyCount.get(k.member_id) ?? 0) + 1)
  const sessCount = new Map<string, number>()
  for (const s of (sessions ?? []) as Array<{ member_id: string }>) sessCount.set(s.member_id, (sessCount.get(s.member_id) ?? 0) + 1)
  return ((members ?? []) as Array<{ id: string; name: string; phone: string; role: MemberRole; perms: unknown; active: boolean; created_at: string; last_login_at: string | null }>).map((m) => ({
    id: m.id,
    name: m.name,
    phone: m.phone,
    role: m.role,
    perms: permsFor(m.role, m.perms),
    active: m.active,
    created_at: m.created_at,
    last_login_at: m.last_login_at,
    passkeys: keyCount.get(m.id) ?? 0,
    sessions: sessCount.get(m.id) ?? 0,
  }))
}

export async function GET(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (actor.role !== "owner") return NextResponse.json({ error: "只有管理员能看成员" }, { status: 403 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "supabase not configured" }, { status: 500 })
  return NextResponse.json({ ok: true, members: await listMembers(supabase) })
}

export async function POST(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createServerSupabaseClient()
  if (!supabase) return NextResponse.json({ error: "supabase not configured" }, { status: 500 })
  let body: Record<string, unknown> & { action?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  const action = body.action

  if (action === "delete_passkey") {
    if (!isUuid(body.passkey_id)) return NextResponse.json({ error: "passkey_id required" }, { status: 400 })
    const { data: pk } = await supabase.from("workbench_passkeys").select("id, member_id").eq("id", body.passkey_id).maybeSingle()
    if (!pk) return NextResponse.json({ error: "not found" }, { status: 404 })
    if (actor.role !== "owner" && pk.member_id !== actor.memberId) return NextResponse.json({ error: "只能删自己的通行密钥" }, { status: 403 })
    await supabase.from("workbench_passkeys").delete().eq("id", pk.id)
    return NextResponse.json({ ok: true })
  }

  if (actor.role !== "owner") return NextResponse.json({ error: "只有管理员能改成员和权限" }, { status: 403 })

  if (action === "create") {
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : ""
    const phone = normalizeLoginPhone(body.phone)
    const role = roleOf(body.role) ?? "agent"
    if (!name) return NextResponse.json({ error: "名字要填" }, { status: 400 })
    if (!phone) return NextResponse.json({ error: "手机号不对，输 10 位美国号码" }, { status: 400 })
    const { data: dup } = await supabase.from("workbench_members").select("id, active").eq("phone", phone).maybeSingle()
    if (dup) return NextResponse.json({ error: dup.active ? "这个号码已经是成员了" : "这个号码是停用的成员，重新启用即可" }, { status: 409 })
    const { error } = await supabase.from("workbench_members").insert({ name, phone, role, perms: permsInput(body.perms), created_by: actor.alias })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, members: await listMembers(supabase) })
  }

  if (action === "update") {
    if (!isUuid(body.id)) return NextResponse.json({ error: "id required" }, { status: 400 })
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 60)
    const role = roleOf(body.role)
    if (role) patch.role = role
    if (body.perms !== undefined) patch.perms = permsInput(body.perms)
    if (typeof body.active === "boolean") patch.active = body.active
    const self = body.id === actor.memberId
    if (self && (patch.active === false || (role && role !== "admin"))) return NextResponse.json({ error: "不能停用或降级自己" }, { status: 400 })
    const { error } = await supabase.from("workbench_members").update(patch).eq("id", body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (patch.active === false) await revokeMemberSessions(body.id)
    else dropCachedMember(body.id)
    return NextResponse.json({ ok: true, members: await listMembers(supabase) })
  }

  if (action === "revoke_sessions") {
    if (!isUuid(body.id)) return NextResponse.json({ error: "id required" }, { status: 400 })
    await revokeMemberSessions(body.id)
    return NextResponse.json({ ok: true, members: await listMembers(supabase) })
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 })
}
