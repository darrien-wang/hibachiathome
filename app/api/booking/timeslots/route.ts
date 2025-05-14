import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 })

  // mock 时间段数据
  let timeSlots = []
  if (date === "2025-05-15") {
    timeSlots = [
      { time: "11:00", price: 399, originalPrice: 499, discount: true },
      { time: "13:00", price: 399, originalPrice: 499, discount: true },
      { time: "15:00", price: 499, originalPrice: 499, discount: false },
      { time: "17:00", price: 499, originalPrice: 499, discount: false },
      { time: "19:00", price: 499, originalPrice: 499, discount: false },
    ]
  } else {
    timeSlots = [
      { time: "11:00", price: 499, originalPrice: 499, discount: false },
      { time: "13:00", price: 499, originalPrice: 499, discount: false },
      { time: "15:00", price: 499, originalPrice: 499, discount: false },
      { time: "17:00", price: 499, originalPrice: 499, discount: false },
      { time: "19:00", price: 499, originalPrice: 499, discount: false },
    ]
  }

  return NextResponse.json({ date, timeSlots })
}
