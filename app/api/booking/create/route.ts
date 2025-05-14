import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
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

  return NextResponse.json({ success: true })
}
