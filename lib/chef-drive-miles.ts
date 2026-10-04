import type { SupabaseClient } from "@supabase/supabase-js"
import { homeBaseOrigin } from "@/config/home-base"
import { driveFromBase } from "@/lib/base-drive"

// 师傅路费的里程（2026-10-04）：基地到这单地址的实际车程，和报价/发票同一套量法
// （lib/base-drive.ts）。
//
// 以前读发票的 travelFee.distanceMiles。可客人那头的路费常常是手填的（免了填 $0、
// 凑个整数），手填了发票就不量里程，或者里程被改成 50 —— 师傅的路费跟着没了：
// Niko 10/3 West Hills 实际 53.7 mi，结算里是 "?"；Bling 同天 Yucca Valley 106.6 mi
// 也是 "?"。规则一直是"客户那头免不免路费都照给师傅"（2026-09-28），所以发票上
// 没有 50 mi 以上里程的单，师傅这头自己量，按地址存一份（order_drive_miles），
// 地址改了才重量。发票上量过、超过 50 mi 的照发票（客人按那个数付的路费）。

export type DriveMiles = { miles: number; source: string }

/** 每次打开最多新量几单：每单是一次收费的 Google 调用，剩下的下次打开接着量。 */
const NEW_PER_LOAD = 12

export async function chefDriveMiles(
  supabase: SupabaseClient,
  orders: Array<{ id: string; event_address: string | null }>,
): Promise<Map<string, DriveMiles>> {
  const out = new Map<string, DriveMiles>()
  const wanted = new Map<string, string>()
  for (const o of orders) {
    const address = (o.event_address ?? "").trim()
    if (address) wanted.set(o.id, address)
  }
  if (wanted.size === 0) return out

  const { data } = await supabase.from("order_drive_miles").select("order_id, address, miles, source").in("order_id", [...wanted.keys()])
  const todo: Array<{ id: string; address: string }> = []
  const cached = new Map(((data ?? []) as Array<{ order_id: string; address: string; miles: number | string; source: string }>).map((r) => [r.order_id, r]))
  for (const [id, address] of wanted) {
    const c = cached.get(id)
    if (c && c.address === address) out.set(id, { miles: Number(c.miles), source: c.source })
    else todo.push({ id, address })
  }

  const measured = await Promise.all(
    todo.slice(0, NEW_PER_LOAD).map(async (t) => {
      const d = await driveFromBase(homeBaseOrigin(), t.address)
      // 量不出来的不存：下次打开再试，结算里照旧显示 "?"。
      if (!d.ok) return null
      return {
        order_id: t.id,
        address: t.address,
        miles: Math.round(d.result.drivingMiles * 10) / 10,
        source: d.approximate ? `${d.result.provider}_city_fallback` : d.result.provider,
        computed_at: new Date().toISOString(),
      }
    }),
  )
  const rows = measured.filter((r): r is NonNullable<typeof r> => r !== null)
  if (rows.length) {
    await supabase.from("order_drive_miles").upsert(rows, { onConflict: "order_id" })
    for (const r of rows) out.set(r.order_id, { miles: r.miles, source: r.source })
  }
  return out
}
