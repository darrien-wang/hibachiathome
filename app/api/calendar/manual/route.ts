import { NextRequest, NextResponse } from 'next/server';

// 手动配置的 slot 列表（可保留用于特殊价格或不可用情况）
const MANUAL_SLOTS: Record<string, { time: string; price: number; available: boolean }[]> = {
  '2024-06-10': [
    { time: '13:00', price: 100, available: true },
    { time: '16:00', price: 100, available: true },
    { time: '19:00', price: 100, available: true },
  ],
  // 可继续添加其它日期
};

const DEFAULT_TIMES = ['13:00', '16:00', '19:00'];
const DISCOUNT_TIMES = ['13:00', '16:00'];
const DISCOUNT_RATE = 0.1;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const basePrice = Number(searchParams.get('basePrice') || 0);

  if (!date) {
    return NextResponse.json({ error: 'Missing date' }, { status: 400 });
  }

  // 1. 优先用手动配置
  let slots = MANUAL_SLOTS[date];

  // 2. 如果没有配置，所有日期都只返回 13:00、16:00、19:00
  if (!slots) {
    slots = DEFAULT_TIMES.map(time => {
      let price = basePrice;
      if (DISCOUNT_TIMES.includes(time)) {
        price = basePrice -50;
      }
      return {
        time,
        price,
        available: true,
      };
    });
  }

  return NextResponse.json({ date, slots });
}
