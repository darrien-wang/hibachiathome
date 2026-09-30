import type { SupabaseClient } from "@supabase/supabase-js"

// 占用：算过缺口的单，它那份料就被占住，别的单看到的可用量要扣掉（老板 2026-09-29）。
//
// 三个动作：
//   reserve()   算缺口的时候把这几单的用量占住（幂等，重算就覆盖）
//   settle()    派对那天过去了 → 占用变成消耗，库存自动扣掉，不用人工划
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
 * 把过期的占用结掉：派对那天过去了就扣库存，订单取消了就直接释放。
 *
 * 扣到 0 为止不记负数——师傅多拿少拿是正常波动，负库存只会误导（和 consume 那条
 * 一个口径）。
 */
export async function settleDueReservations(supabase: SupabaseClient, now = new Date()): Promise<{ consumed: number; released: number }> {
  const { data: open } = await supabase.from("prep_reservations").select("order_id, item_key, qty, unit").is("settled_at", null)
  const rows = (open ?? []) as Row[]
  if (rows.length === 0) return { consumed: 0, released: 0 }

  const orderIds = Array.from(new Set(rows.map((r) => r.order_id)))
  const { data: orders } = await supabase.from("orders").select("id, event_start, order_status").in("id", orderIds)
  const byId = new Map<string, { event_start: string | null; order_status: string | null }>()
  for (const o of (orders ?? []) as Array<{ id: string; event_start: string | null; order_status: string | null }>) {
    byId.set(o.id, { event_start: o.event_start, order_status: o.order_status })
  }

  const today = todayPT(now)
  const stamp = now.toISOString()
  let consumed = 0
  let released = 0

  for (const r of rows) {
    const o = byId.get(r.order_id)
    // 订单没了（删了）或者取消了 → 释放，不扣库存。
    const gone = !o || /cancel|void|refund/i.test(o.order_status ?? "")
    // event_start 存的是墙上时间（按 UTC 写入），所以"哪一天"直接取 ISO 日期位。
    const day = (o?.event_start ?? "").slice(0, 10)
    const done = !!day && day < today

    if (!gone && !done) continue

    if (gone) {
      await supabase
        .from("prep_reservations")
        .update({ settled_at: stamp, settled_kind: "released" })
        .eq("order_id", r.order_id)
        .eq("item_key", r.item_key)
        .is("settled_at", null)
      released++
      continue
    }

    // 先标已结算再扣库存：两个人同时打开页面时，唯一键 + settled_at is null 的条件
    // 让只有一个人扣得动，不会扣两次。
    const { data: claimed } = await supabase
      .from("prep_reservations")
      .update({ settled_at: stamp, settled_kind: "consumed" })
      .eq("order_id", r.order_id)
      .eq("item_key", r.item_key)
      .is("settled_at", null)
      .select("order_id")
    if (!claimed || claimed.length === 0) continue

    const { data: cur } = await supabase.from("pantry_stock").select("qty").eq("item_key", r.item_key).maybeSingle()
    const next = Math.max(0, Math.round(((Number(cur?.qty) || 0) - Number(r.qty)) * 100) / 100)
    if (cur) {
      await supabase.from("pantry_stock").update({ qty: next, updated_at: stamp, updated_by: "auto" }).eq("item_key", r.item_key)
    }
    await supabase.from("stock_moves").insert({
      item_key: r.item_key,
      delta: -Number(r.qty),
      unit: r.unit || "",
      reason: "consume",
      ref: `reserve:${r.order_id}:${r.item_key}`,
      note: "派对办完，占用自动结转",
      created_by: "auto",
    })
    consumed++
  }

  return { consumed, released }
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
