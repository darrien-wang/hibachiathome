import type { SupabaseClient } from "@supabase/supabase-js"
import { stockLabel, stockUnit, VEG_IDS } from "@/lib/pantry"

// 占用：算过缺口的单，它那份料就被占住，别的单看到的可用量要扣掉（老板 2026-09-29）。
//
// 三个动作：
//   reserve()   算缺口的时候把这几单的用量占住（幂等，重算就覆盖）
//   settle()    派对那天过去了（或订单取消了）→ 占用放掉。**不扣库存**：老板 2026-10-02 定，
//               库存每次备货自己重新核对（"不用自动扣库存了，每次都重新自己核对"）——
//               自动扣只扣在备货页算过的单，漏算的单会让库存虚高（9/26 两场菲力就是这样挂了 5 盒）。
//   committed() 别的单还占着多少，算可用量用
//
// 为什么懒执行而不是定时任务：定时任务卡死过三天没人发现（2026-09-27），而这件事
// 晚做几小时没有任何代价——下一个打开备货页的人替它做了。

const PT = "America/Los_Angeles"

type Row = { order_id: string; item_key: string; qty: number; unit: string }

/** PT 的今天（YYYY-MM-DD）。派对当天不结算，过了这一天才算办完。 */
function todayPT(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: PT })
}

/**
 * 把过期的占用放掉：派对那天过去了、或者订单取消/删了，这单就不再占着料。
 * 不碰库存——库存靠每次备货时对货（老板 2026-10-02）。
 */
export async function settleDueReservations(supabase: SupabaseClient, now = new Date()): Promise<{ released: number }> {
  const { data: open } = await supabase.from("prep_reservations").select("order_id, item_key, qty, unit").is("settled_at", null)
  const rows = (open ?? []) as Row[]
  if (rows.length === 0) return { released: 0 }

  const orderIds = Array.from(new Set(rows.map((r) => r.order_id)))
  const { data: orders } = await supabase.from("orders").select("id, event_start, order_status").in("id", orderIds)
  const byId = new Map<string, { event_start: string | null; order_status: string | null }>()
  for (const o of (orders ?? []) as Array<{ id: string; event_start: string | null; order_status: string | null }>) {
    byId.set(o.id, { event_start: o.event_start, order_status: o.order_status })
  }

  const today = todayPT(now)
  const due = Array.from(
    new Set(
      rows
        .filter((r) => {
          const o = byId.get(r.order_id)
          // 订单没了（删了）或者取消了；或者派对那天过去了（event_start 是墙上时间，直接取日期位）；
          // 或者日期被拿掉了（日期待定，2026-10-04）——原来那天不办了，料也不该再占着。
          const gone = !o || /cancel|void|refund/i.test(o.order_status ?? "")
          const day = (o?.event_start ?? "").slice(0, 10)
          return gone || !day || day < today
        })
        .map((r) => r.order_id),
    ),
  )
  if (due.length === 0) return { released: 0 }
  const { data } = await supabase
    .from("prep_reservations")
    .update({ settled_at: now.toISOString(), settled_kind: "released" })
    .in("order_id", due)
    .is("settled_at", null)
    .select("order_id")
  return { released: (data ?? []).length }
}

// ---- 蔬菜：清单和对货只有一行"蔬菜合计"（西葫芦/西兰花/洋葱/胡萝卜随意配），
// 库存却是四样分开记的（收据按样入库）。四样分开的数是唯一的账：
//   读 = 四样之和；对货写一个总数 = 按比例改四样。
// 原来对货写进一个单独的 mixed_vege 行，读的时候又被四样之和盖掉——老板点"没了"不生效，
// 蔬菜永远显示够（2026-09-30 老板："为什么备货不展示蔬菜要买多少"）。

export async function vegTotal(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase.from("pantry_stock").select("item_key, qty").in("item_key", [...VEG_IDS])
  return Math.round(((data ?? []) as Array<{ qty: number }>).reduce((n, r) => n + (Number(r.qty) || 0), 0) * 100) / 100
}

/** 把四样蔬菜按原来的比例缩放到 total（原来全是 0 就平分）。counted = 这是一次盘点（记盘点时间）。 */
export async function setVegTotal(supabase: SupabaseClient, total: number, by: string, counted: boolean): Promise<void> {
  const { data } = await supabase.from("pantry_stock").select("item_key, qty").in("item_key", [...VEG_IDS])
  const cur = new Map(((data ?? []) as Array<{ item_key: string; qty: number }>).map((r) => [r.item_key, Number(r.qty) || 0]))
  const sum = VEG_IDS.reduce((n, k) => n + (cur.get(k) ?? 0), 0)
  const now = new Date().toISOString()
  for (const k of VEG_IDS) {
    const q = Math.round((sum > 0 ? ((cur.get(k) ?? 0) * total) / sum : total / VEG_IDS.length) * 100) / 100
    const patch = { label: stockLabel(k), unit: stockUnit(k), qty: Math.max(0, q), updated_at: now, updated_by: by, ...(counted ? { counted_at: now } : {}) }
    if (cur.has(k)) await supabase.from("pantry_stock").update(patch).eq("item_key", k)
    else await supabase.from("pantry_stock").insert({ item_key: k, ...patch })
  }
  // 合计行不单独记账：有旧的就清掉，免得又有人以为它是数
  await supabase.from("pantry_stock").delete().eq("item_key", "mixed_vege")
}

/** 这几单算过缺口 = 它们的料被占住。重算就覆盖，所以可以随便重算。 */
export async function reserveForOrders(
  supabase: SupabaseClient,
  perOrder: Array<{ orderId: string; items: Array<{ id: string; qty: number; unit: string }> }>,
): Promise<void> {
  for (const o of perOrder) {
    // 菜单改小了要把多出来的行删掉，否则占用会留着一份不存在的需求。
    // 先查再按列表删，不手工拼 PostgREST 的 not.in 过滤串（item_key 里有个引号就散了）。
    const keep = new Set(o.items.map((i) => i.id))
    const { data: existing } = await supabase.from("prep_reservations").select("item_key").eq("order_id", o.orderId).is("settled_at", null)
    const stale = ((existing ?? []) as Array<{ item_key: string }>).map((r) => r.item_key).filter((k) => !keep.has(k))
    if (stale.length > 0) {
      await supabase.from("prep_reservations").delete().eq("order_id", o.orderId).is("settled_at", null).in("item_key", stale)
    }
    if (o.items.length === 0) continue
    await supabase.from("prep_reservations").upsert(
      o.items.map((i) => ({
        order_id: o.orderId,
        item_key: i.id,
        qty: Math.round(i.qty * 100) / 100,
        unit: i.unit ?? "",
        reserved_at: new Date().toISOString(),
        settled_at: null,
        settled_kind: null,
      })),
      { onConflict: "order_id,item_key" },
    )
  }
}

/**
 * 别的单还占着多少（不含 exclude 里的那几单——那几单正是现在要算的，
 * 把自己的占用也扣一遍就成了双重计算）。
 */
export async function committedByItem(supabase: SupabaseClient, excludeOrderIds: string[] = []): Promise<Record<string, number>> {
  return (await committedDetail(supabase, excludeOrderIds)).totals
}

/**
 * 同上，再按单拆开：每样东西是哪几单占着、各占多少（老板 2026-09-30："我怎么知道
 * 是哪一单占用的"）。
 */
export async function committedDetail(
  supabase: SupabaseClient,
  excludeOrderIds: string[] = [],
): Promise<{ totals: Record<string, number>; byItem: Record<string, Array<{ orderId: string; qty: number }>> }> {
  const { data } = await supabase.from("prep_reservations").select("order_id, item_key, qty").is("settled_at", null)
  const skip = new Set(excludeOrderIds)
  const totals: Record<string, number> = {}
  const byItem: Record<string, Array<{ orderId: string; qty: number }>> = {}
  for (const r of (data ?? []) as Row[]) {
    if (skip.has(r.order_id)) continue
    totals[r.item_key] = Math.round(((totals[r.item_key] ?? 0) + Number(r.qty)) * 100) / 100
    ;(byItem[r.item_key] = byItem[r.item_key] ?? []).push({ orderId: r.order_id, qty: Number(r.qty) })
  }
  return { totals, byItem }
}
