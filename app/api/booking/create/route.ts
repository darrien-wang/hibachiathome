import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { upsertLeadFromContact, readAttributionFromCookieHeader } from '@/lib/leads'

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.json({ error: "Missing Supabase server configuration" }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)
  const body = await req.json()

  // 校验必填字段
  const required = [
    'full_name', 'email', 'phone', 'address', 'zip_code',
    'event_date', 'event_time', 'guest_adults', 'guest_kids',
    'price_adult', 'price_kid', 'travel_fee', 'tip_pct',
    'premium_proteins', 'add_ons'
  ]
  for (const key of required) {
    if (body[key] === undefined) {
      return NextResponse.json({ error: `Missing field: ${key}` }, { status: 400 })
    }
  }

  // 插入数据库
  const { error } = await supabase.from('bookings').insert([{
    ...body,
    premium_proteins: JSON.stringify(body.premium_proteins),
    add_ons: JSON.stringify(body.add_ons),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Mirror the booking into the leads pipeline so /book customers show up on
  // the workbench (fulfillment, review invites, repeat-business follow-up).
  try {
    const attribution = readAttributionFromCookieHeader(req.headers.get('cookie'))
    await upsertLeadFromContact(supabase, {
      name: body.full_name,
      email: body.email,
      phone: body.phone,
      message:
        `Direct booking via /book.\n` +
        `Event: ${body.event_date} ${body.event_time}\n` +
        `Guests: ${body.guest_adults} adults, ${body.guest_kids} kids\n` +
        `Address: ${body.address}, ${body.zip_code}`,
      leadSource: 'book_page',
      leadChannel: 'website_direct_booking',
      cityOrZip: String(body.zip_code ?? ''),
      guestCount: Number(body.guest_adults ?? 0) + Number(body.guest_kids ?? 0),
      sourcePage: '/book',
      touchpointType: 'booking_created',
      touchpointSource: 'website_api',
      attribution,
      rawPayload: { event_date: body.event_date, event_time: body.event_time },
    })
  } catch (leadError) {
    console.error('[booking/create] lead mirror failed', leadError)
  }

  return NextResponse.json({ success: true })
}
