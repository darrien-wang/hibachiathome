import type { SupabaseClient } from "@supabase/supabase-js"

// 员工的号码（厨师、后勤、老板自己）打到或发到 213 线，是工作往来，不是客人：
// 不建线索、不进收件箱、不算"没回"。10-13 Gary 回了一句"好的"，先被当成新线索，
// 五个小时后又被收件箱当成等回复的客人报出来；老板："把所有chef的手机号都过滤一下
// 不要当作线索"。对话本身照样在 Twilio 里，desk thread 查得到。
// 不看 status：离职的师傅发来的也不是询价。

/** Last ten digits of a phone number, or "" when there are fewer than ten. */
export function phoneDigits10(phone: string | null | undefined): string {
  const d = String(phone ?? "").replace(/\D/g, "")
  return d.length >= 10 ? d.slice(-10) : ""
}

/** Every staff member's phone, as last-ten-digits. Empty when the table can't be read. */
export async function loadStaffDigits(supabase: SupabaseClient | null | undefined): Promise<Set<string>> {
  const out = new Set<string>()
  if (!supabase) return out
  try {
    const { data } = await supabase.from("staff_members").select("phone").not("phone", "is", null)
    for (const r of (data ?? []) as Array<{ phone: string | null }>) {
      const d = phoneDigits10(r.phone)
      if (d) out.add(d)
    }
  } catch {
    // A failed read must not take the inbox or a webhook down with it; the
    // worst case is a staff text showing up the way it did before.
  }
  return out
}

export function isStaffNumber(staff: Set<string>, phone: string | null | undefined): boolean {
  const d = phoneDigits10(phone)
  return Boolean(d) && staff.has(d)
}

// 2026-11-11（D-1111-03）起员工发来的短信有自己的去处：回「1」是确认改动，其他内容进
// 收件箱的 [chef] 一类。那边要知道这个号码是谁，所以多一个带名字的读法。上面按号码
// 排除"不是客人"的规则不变。

export type StaffContact = { id: string; name: string; phone: string | null; digits: string; role: string | null }

/** Every staff member with their name and number. Empty when the table can't be read. */
export async function loadStaffContacts(supabase: SupabaseClient | null | undefined): Promise<StaffContact[]> {
  if (!supabase) return []
  try {
    const { data } = await supabase.from("staff_members").select("id, display_name, full_name, phone, role")
    return ((data ?? []) as Array<{ id: string; display_name: string | null; full_name: string | null; phone: string | null; role: string | null }>).map((r) => ({
      id: r.id,
      name: (r.display_name ?? r.full_name ?? "").trim() || "员工",
      phone: r.phone,
      digits: phoneDigits10(r.phone),
      role: r.role ?? null,
    }))
  } catch {
    return []
  }
}

/** The staff members on this number (one phone can sit on two rows). */
export function staffOnNumber(contacts: StaffContact[], phone: string | null | undefined): StaffContact[] {
  const d = phoneDigits10(phone)
  return d ? contacts.filter((c) => c.digits === d) : []
}
