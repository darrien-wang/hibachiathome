import type { SupabaseClient } from "@supabase/supabase-js"
import { phoneDigits10 } from "@/lib/staff-phones"

// 213 订餐线的拦截名单（老板 2026-10-28）。Yelp 广告开投后两天，推销电话打进来
// 四通：东岸一家 "AIO/SEO 优化" 代理一天打三次（老板接了 7 分钟、又被拉进一个 Zoom），
// 另一个开口就问 "Yelp 广告有没有带来客人"。老板："拦截，不允许他们打这个 booking line，
// 影响正常客人"。
//
// 名单上的号码打来，Twilio 直接 <Reject>：不接听、不计费，对方听到空号提示；
// 不响 App、不响备用机、不建线索、不发"没接到"短信（lead-watch 的补发也跳过）。
// 只拦认出来的推销号（desk block），不按区号拦：Neha（Temecula 28 人，已成单）是
// 682 德州号，度假租房的客人也多是外州号。短信不拦，照常进收件箱。

/** Every blocked number, as last-ten-digits. Empty when the table can't be read. */
export async function loadBlockedDigits(supabase: SupabaseClient | null | undefined): Promise<Set<string>> {
  const out = new Set<string>()
  if (!supabase) return out
  try {
    const { data } = await supabase.from("blocked_callers").select("phone_digits")
    for (const r of (data ?? []) as Array<{ phone_digits: string | null }>) {
      const d = phoneDigits10(r.phone_digits)
      if (d) out.add(d)
    }
  } catch {
    // A failed read lets every call ring: blocking a customer by mistake
    // costs more than one more sales pitch.
  }
  return out
}

export function isBlockedNumber(blocked: Set<string>, phone: string | null | undefined): boolean {
  const d = phoneDigits10(phone)
  return Boolean(d) && blocked.has(d)
}

/** Count the rejected call on the number's row (desk block lists it). Never throws. */
export async function noteBlockedCall(supabase: SupabaseClient, phone: string): Promise<void> {
  const d = phoneDigits10(phone)
  if (!d) return
  try {
    await supabase.rpc("rh_note_blocked_call", { p_digits: d })
  } catch {
    // The count is bookkeeping; the reject must still go out.
  }
}
