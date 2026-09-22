import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { can, resolveAdminActor } from "@/lib/admin-auth"
import { sendSms } from "@/lib/sms-thread"
import { cityOf, normalizePhone10, reminderState, toE164Loose, type CustomerEvent, type CustomerRow, type MarketingTouch } from "@/lib/customers"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// 客户主档 · one row per person, their parties, and every marketing touch.
//   GET               -> { customers, events, touches, syncedOrders }
//   GET ?id=<uuid>    -> { customer, events, touches }
//   GET ?sync=1       -> merge paid orders into the master first, then list
//   POST { action }   -> import | update | add_event | delete_event | send | log_touch | delete
// Sends go straight to Twilio and are logged here, not on a lead: the person
// only becomes a lead again when they reply (the inbound webhook does that).

type Body = Record<string, unknown> & { action?: string }
const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v)
const str = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const strOrNull = (v: unknown, max = 300) => str(v, max) || null
const ymd = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
const intOrNull = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Math.round(Number(v)) : null)
const list = (v: unknown, max = 20) => (Array.isArray(v) ? v.map((x) => str(x, 40)).filter(Boolean).slice(0, max) : [])
const ptDate = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })

type Db = NonNullable<ReturnType<typeof createServerSupabaseClient>>

async function refreshAggregates(db: Db, customerId: string) {
  const { data } = await db.from("customer_events").select("event_date, occasion").eq("customer_id", customerId).order("event_date")
  const rows = (data ?? []) as Array<{ event_date: string; occasion: string | null }>
  const occasions = [...new Set(rows.map((r) => r.occasion).filter((o): o is string => !!o))]
  await db
    .from("customers")
    .update({ first_event_date: rows[0]?.event_date ?? null, last_event_date: rows[rows.length - 1]?.event_date ?? null, events_count: rows.length, occasions, updated_at: new Date().toISOString() })
    .eq("id", customerId)
}

/** Paid orders become customers + events (idempotent: one event per order, one customer per phone). */
async function syncFromOrders(db: Db): Promise<number> {
  const { data: orders } = await db
    .from("orders")
    .select("id, customer_name, customer_phone, customer_email, event_start, event_address, guest_adult_count, guest_child_count, quoted_total_cents, deposit_status, order_status")
    .in("deposit_status", ["paid_verified", "paid"])
    .neq("order_status", "cancelled")
    .not("event_start", "is", null)
  let touched = 0
  for (const o of (orders ?? []) as Array<Record<string, unknown>>) {
    const ten = normalizePhone10(o.customer_phone as string)
    const email = strOrNull(o.customer_email, 200)
    if (!ten && !email) continue
    let customer: { id: string } | null = null
    if (ten) {
      const { data } = await db.from("customers").select("id").eq("normalized_phone", ten).maybeSingle()
      customer = data
    }
    if (!customer && email) {
      const { data } = await db.from("customers").select("id").ilike("email", email).limit(1).maybeSingle()
      customer = data
    }
    if (!customer) {
      const { data, error } = await db
        .from("customers")
        .insert({ full_name: strOrNull(o.customer_name, 120), phone: ten ? `+1${ten}` : null, normalized_phone: ten, email, address: strOrNull(o.event_address), city: cityOf(o.event_address as string), source: "order" })
        .select("id")
        .single()
      if (error) throw error
      customer = data
    }
    const eventDate = ptDate(o.event_start as string)
    const guests = (Number(o.guest_adult_count) || 0) + (Number(o.guest_child_count) || 0)
    const eventRow = { customer_id: customer.id, event_date: eventDate, address: strOrNull(o.event_address), guest_count: guests || null, amount_cents: intOrNull(o.quoted_total_cents), source: "order", order_id: o.id as string }
    // The order_id unique index is partial (nulls allowed), which ON CONFLICT
    // cannot target through the client, so look first and then insert or update.
    const { data: existing } = await db.from("customer_events").select("id").eq("order_id", o.id as string).maybeSingle()
    const { error } = existing ? await db.from("customer_events").update(eventRow).eq("id", existing.id) : await db.from("customer_events").insert(eventRow)
    if (error) throw error
    await refreshAggregates(db, customer.id)
    touched++
  }
  return touched
}

export async function GET(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const db = createServerSupabaseClient()
  if (!db) return NextResponse.json({ error: "supabase not configured" }, { status: 500 })
  const sp = request.nextUrl.searchParams
  try {
    const id = sp.get("id")
    if (id && isUuid(id)) {
      const [{ data: customer }, { data: events }, { data: touches }] = await Promise.all([
        db.from("customers").select("*").eq("id", id).maybeSingle(),
        db.from("customer_events").select("*").eq("customer_id", id).order("event_date", { ascending: false }),
        db.from("marketing_touches").select("*").eq("customer_id", id).order("sent_at", { ascending: false }),
      ])
      if (!customer) return NextResponse.json({ error: "not found" }, { status: 404 })
      return NextResponse.json({ ok: true, customer, events: events ?? [], touches: touches ?? [] })
    }
    let syncedOrders = 0
    if (sp.get("sync") === "1") syncedOrders = await syncFromOrders(db)
    const [{ data: customers }, { data: events }, { data: touches }] = await Promise.all([
      db.from("customers").select("*").order("last_event_date", { ascending: false, nullsFirst: false }).limit(2000),
      db.from("customer_events").select("id, customer_id, event_date, event_time, address, occasion, guest_count, amount_cents, source, order_id").order("event_date", { ascending: false }).limit(5000),
      db.from("marketing_touches").select("id, customer_id, channel, campaign, sent_at, result, event_id").order("sent_at", { ascending: false }).limit(5000),
    ])
    if (sp.get("due") === "1") {
      // The daily check (a scheduled task) only needs who is due today, computed with the same rule the tab uses.
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })
      const due = ((customers ?? []) as CustomerRow[])
        .map((c) => ({ c, rs: reminderState(c, (touches ?? []) as MarketingTouch[], today) }))
        .filter(({ rs }) => rs.status === "due")
        .map(({ c, rs }) => ({ id: c.id, name: c.full_name, city: c.city, anniversary: rs.anniversary }))
      return NextResponse.json({ ok: true, today, due, count: due.length })
    }
    return NextResponse.json({ ok: true, customers: customers ?? [], events: events ?? [], touches: touches ?? [], syncedOrders })
  } catch (e) {
    const msg = e instanceof Error ? e.message : e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : String(e)
    console.error("[admin/customers] GET", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function customerFields(body: Body): Partial<CustomerRow> & { normalized_phone?: string | null } {
  const f = (body.fields ?? {}) as Record<string, unknown>
  const out: Record<string, unknown> = {}
  if ("full_name" in f) out.full_name = strOrNull(f.full_name, 120)
  if ("phone" in f) {
    const raw = str(f.phone, 40)
    out.phone = raw ? toE164Loose(raw) ?? raw : null
    out.normalized_phone = normalizePhone10(raw)
  }
  if ("email" in f) out.email = strOrNull(f.email, 200)?.toLowerCase() ?? null
  if ("address" in f) {
    out.address = strOrNull(f.address, 300)
    out.city = strOrNull(f.city, 80) ?? cityOf(out.address as string | null)
  } else if ("city" in f) out.city = strOrNull(f.city, 80)
  if ("zip" in f) out.zip = strOrNull(f.zip, 10)
  if ("notes" in f) out.notes = strOrNull(f.notes, 4000)
  if ("tags" in f) out.tags = list(f.tags)
  if ("occasions" in f) out.occasions = list(f.occasions, 10)
  if ("sms_consent" in f && ["unknown", "yes", "no"].includes(String(f.sms_consent))) {
    out.sms_consent = f.sms_consent
    out.sms_consent_at = f.sms_consent === "unknown" ? null : new Date().toISOString()
  }
  if ("do_not_contact" in f) out.do_not_contact = f.do_not_contact === true
  return out as Partial<CustomerRow>
}

const OPT_OUT = /opt|stop|21610|unsubscribe/i

export async function POST(request: NextRequest) {
  const actor = await resolveAdminActor(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const db = createServerSupabaseClient()
  if (!db) return NextResponse.json({ error: "supabase not configured" }, { status: 500 })
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  const action = String(body.action ?? "")
  const now = new Date().toISOString()
  try {
    switch (action) {
      case "import": {
        // rows: [{ name, phone, email, address, zip, event_date, event_time, occasion, notes }]
        const rows = Array.isArray(body.rows) ? (body.rows as Array<Record<string, unknown>>).slice(0, 2000) : []
        let created = 0
        let merged = 0
        let events = 0
        let skipped = 0
        for (const r of rows) {
          const ten = normalizePhone10(str(r.phone, 40))
          const email = strOrNull(r.email, 200)?.toLowerCase() ?? null
          const name = strOrNull(r.name, 120)
          const address = strOrNull(r.address, 300)
          const date = ymd(r.event_date)
          if (!ten && !email && !name && !address) {
            skipped++
            continue
          }
          let customer: { id: string } | null = null
          if (ten) customer = (await db.from("customers").select("id").eq("normalized_phone", ten).maybeSingle()).data
          if (!customer && email) customer = (await db.from("customers").select("id").ilike("email", email).limit(1).maybeSingle()).data
          if (!customer && !ten && !email && name && address) {
            customer = (await db.from("customers").select("id").ilike("full_name", name).ilike("address", address).limit(1).maybeSingle()).data
          }
          if (customer) {
            merged++
            // Fill blanks only; never overwrite what the boss already corrected.
            const { data: cur } = await db.from("customers").select("full_name, email, address, zip, notes").eq("id", customer.id).maybeSingle()
            const patch: Record<string, unknown> = { updated_at: now }
            if (cur && !cur.full_name && name) patch.full_name = name
            if (cur && !cur.email && email) patch.email = email
            if (cur && !cur.address && address) {
              patch.address = address
              patch.city = cityOf(address)
            }
            if (cur && !cur.zip && strOrNull(r.zip, 10)) patch.zip = strOrNull(r.zip, 10)
            await db.from("customers").update(patch).eq("id", customer.id)
          } else {
            const { data, error } = await db
              .from("customers")
              .insert({
                full_name: name,
                phone: ten ? `+1${ten}` : null,
                normalized_phone: ten,
                email,
                address,
                city: cityOf(address),
                zip: strOrNull(r.zip, 10),
                source: str(body.source, 40) || "import",
                notes: strOrNull(r.notes, 2000),
              })
              .select("id")
              .single()
            if (error) throw error
            customer = data
            created++
          }
          if (date) {
            const { data: existing } = await db.from("customer_events").select("id").eq("customer_id", customer.id).eq("event_date", date).limit(1)
            if (!existing || existing.length === 0) {
              const { error } = await db.from("customer_events").insert({
                customer_id: customer.id,
                event_date: date,
                event_time: strOrNull(r.event_time, 10),
                address,
                occasion: strOrNull(r.occasion, 40),
                guest_count: intOrNull(r.guest_count),
                source: str(body.source, 40) || "import",
              })
              if (error) throw error
              events++
            }
          }
          await refreshAggregates(db, customer.id)
        }
        return NextResponse.json({ ok: true, created, merged, events, skipped })
      }
      case "update": {
        if (!isUuid(body.id)) return NextResponse.json({ error: "id required" }, { status: 400 })
        const fields = customerFields(body)
        const { error } = await db.from("customers").update({ ...fields, updated_at: now }).eq("id", body.id)
        if (error) {
          if (String(error.message).includes("customers_normalized_phone_key")) return NextResponse.json({ error: "这个手机号已经在另一位客户名下" }, { status: 409 })
          throw error
        }
        return NextResponse.json({ ok: true })
      }
      case "add_event": {
        if (!isUuid(body.id)) return NextResponse.json({ error: "id required" }, { status: 400 })
        const date = ymd(body.event_date)
        if (!date) return NextResponse.json({ error: "日期格式要是 2026-01-31" }, { status: 400 })
        const { error } = await db.from("customer_events").insert({
          customer_id: body.id,
          event_date: date,
          event_time: strOrNull(body.event_time, 10),
          address: strOrNull(body.address, 300),
          occasion: strOrNull(body.occasion, 40),
          guest_count: intOrNull(body.guest_count),
          amount_cents: intOrNull(body.amount_cents),
          notes: strOrNull(body.notes, 1000),
          source: "manual",
        })
        if (error) throw error
        await refreshAggregates(db, body.id)
        return NextResponse.json({ ok: true })
      }
      case "delete_event": {
        if (!isUuid(body.event_id)) return NextResponse.json({ error: "event_id required" }, { status: 400 })
        const { data: ev } = await db.from("customer_events").select("customer_id, order_id").eq("id", body.event_id).maybeSingle()
        if (!ev) return NextResponse.json({ error: "not found" }, { status: 404 })
        if (ev.order_id) return NextResponse.json({ error: "来自订单的记录不能删" }, { status: 409 })
        const { error } = await db.from("customer_events").delete().eq("id", body.event_id)
        if (error) throw error
        await refreshAggregates(db, ev.customer_id as string)
        return NextResponse.json({ ok: true })
      }
      case "send": {
        if (!can(actor, "sms")) return NextResponse.json({ error: "没有发短信的权限" }, { status: 403 })
        if (!isUuid(body.id)) return NextResponse.json({ error: "id required" }, { status: 400 })
        const text = str(body.body, 900)
        const campaign = str(body.campaign, 40) || "custom"
        if (!text) return NextResponse.json({ error: "短信内容为空" }, { status: 400 })
        const { data: c } = await db.from("customers").select("*").eq("id", body.id).maybeSingle()
        const customer = c as CustomerRow | null
        if (!customer) return NextResponse.json({ error: "客户不存在" }, { status: 404 })
        if (!customer.phone) return NextResponse.json({ error: "这位客户没有手机号" }, { status: 409 })
        if (customer.do_not_contact) return NextResponse.json({ error: "已标记不再联系" }, { status: 409 })
        if (customer.opted_out_at || customer.sms_consent === "no") return NextResponse.json({ error: "这位客户已退订短信" }, { status: 409 })
        // Opt-outs and dead numbers recorded on the lead side hold here too.
        if (customer.normalized_phone) {
          const { data: blocked } = await db.from("leads").select("sms_blocked_reason").eq("normalized_phone", customer.normalized_phone).not("sms_blocked_at", "is", null).limit(5)
          const b = (blocked ?? []) as Array<{ sms_blocked_reason: string | null }>
          if (b.some((x) => OPT_OUT.test(x.sms_blocked_reason ?? ""))) {
            await db.from("customers").update({ opted_out_at: now, sms_consent: "no", updated_at: now }).eq("id", customer.id)
            return NextResponse.json({ error: "这个号码已退订短信（对方回过 STOP），不能再发" }, { status: 409 })
          }
          if (b.length > 0) return NextResponse.json({ error: `这个号码收不到短信（${b[0].sms_blocked_reason ?? "unreachable"}）` }, { status: 409 })
        }
        const sent = await sendSms(customer.phone, text)
        if (!sent.ok) return NextResponse.json({ error: `发送失败：${sent.error}` }, { status: 502 })
        const { error } = await db.from("marketing_touches").insert({
          customer_id: customer.id,
          channel: "sms",
          campaign,
          body: text,
          sent_by: actor.name ?? actor.alias,
          result: `${sent.status} ${sent.sid}`,
          event_id: isUuid(body.event_id) ? body.event_id : null,
        })
        if (error) throw error
        return NextResponse.json({ ok: true, sid: sent.sid })
      }
      case "log_touch": {
        if (!isUuid(body.id)) return NextResponse.json({ error: "id required" }, { status: 400 })
        const channel = str(body.channel, 10)
        if (!["sms", "email", "call", "note"].includes(channel)) return NextResponse.json({ error: "channel" }, { status: 400 })
        const { error } = await db.from("marketing_touches").insert({ customer_id: body.id, channel, campaign: str(body.campaign, 40) || "manual", body: strOrNull(body.body, 2000), sent_by: actor.name ?? actor.alias, result: strOrNull(body.result, 200) })
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      case "delete": {
        if (actor.role !== "owner") return NextResponse.json({ error: "只有老板能删客户" }, { status: 403 })
        if (!isUuid(body.id)) return NextResponse.json({ error: "id required" }, { status: 400 })
        const { error } = await db.from("customers").delete().eq("id", body.id)
        if (error) throw error
        return NextResponse.json({ ok: true })
      }
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 })
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : String(e)
    console.error("[admin/customers]", action, msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export type { CustomerEvent }
