import { randomInt } from "node:crypto"
import { createServerSupabaseClient } from "@/lib/supabase"
import { sha256, type MemberRow } from "@/lib/admin-auth"
import { toE164 } from "@/lib/sms-thread"

// SMS-code login for the workbench. A code is six digits, lives ten minutes,
// is stored hashed with the phone it belongs to, and dies after five wrong
// guesses. Rate limits are counted from the same table, so there is nothing
// else to configure.

const CODE_TTL_MS = 10 * 60_000
const WINDOW_MS = 10 * 60_000
const MAX_CODES_PER_PHONE = 3
const MAX_CODES_PER_IP = 15
const MAX_ATTEMPTS = 5

export function normalizeLoginPhone(raw: unknown): string | null {
  return typeof raw === "string" ? toE164(raw) : null
}

export async function findActiveMember(phone: string): Promise<MemberRow | null> {
  const supabase = createServerSupabaseClient()
  if (!supabase) return null
  const { data } = await supabase.from("workbench_members").select("id, name, phone, role, perms, active").eq("phone", phone).eq("active", true).maybeSingle()
  return (data as MemberRow | null) ?? null
}

export const loginCodeSms = (code: string) =>
  `Real Hibachi workbench: your login code is ${code}. It expires in 10 minutes. If you did not request it, ignore this text.`

export async function issueLoginCode(phone: string, ip: string | null): Promise<{ ok: true; code: string } | { ok: false; error: string; status: number }> {
  const supabase = createServerSupabaseClient()
  if (!supabase) return { ok: false, error: "supabase not configured", status: 500 }
  const since = new Date(Date.now() - WINDOW_MS).toISOString()
  const [byPhone, byIp] = await Promise.all([
    supabase.from("workbench_login_codes").select("id", { count: "exact", head: true }).eq("phone", phone).gte("created_at", since),
    ip ? supabase.from("workbench_login_codes").select("id", { count: "exact", head: true }).eq("ip", ip).gte("created_at", since) : Promise.resolve({ count: 0 }),
  ])
  if ((byPhone.count ?? 0) >= MAX_CODES_PER_PHONE) return { ok: false, error: "验证码发得太频繁，10 分钟后再试", status: 429 }
  if ((byIp.count ?? 0) >= MAX_CODES_PER_IP) return { ok: false, error: "验证码发得太频繁，10 分钟后再试", status: 429 }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0")
  const { error } = await supabase.from("workbench_login_codes").insert({
    phone,
    code_hash: sha256(`${phone}:${code}`),
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    ip,
  })
  if (error) return { ok: false, error: error.message, status: 500 }
  return { ok: true, code }
}

export async function consumeLoginCode(phone: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createServerSupabaseClient()
  if (!supabase) return { ok: false, error: "supabase not configured" }
  const digits = code.replace(/\D/g, "")
  if (digits.length !== 6) return { ok: false, error: "验证码是 6 位数字" }
  const { data } = await supabase
    .from("workbench_login_codes")
    .select("id, code_hash, expires_at, attempts, consumed_at")
    .eq("phone", phone)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  const row = data as { id: string; code_hash: string; expires_at: string; attempts: number } | null
  if (!row) return { ok: false, error: "先获取验证码" }
  if (Date.parse(row.expires_at) < Date.now()) return { ok: false, error: "验证码已过期，重新获取一个" }
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, error: "错误次数太多，重新获取验证码" }
  if (row.code_hash !== sha256(`${phone}:${digits}`)) {
    await supabase.from("workbench_login_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id)
    return { ok: false, error: `验证码不对（还可试 ${MAX_ATTEMPTS - row.attempts - 1} 次）` }
  }
  await supabase.from("workbench_login_codes").update({ consumed_at: new Date().toISOString() }).eq("id", row.id)
  return { ok: true }
}
