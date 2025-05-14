/* pages/api/calendar.ts */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getDriveMinutes } from './mapService';

type Slot = { time: string; price: number; available: boolean };
type ApiResponse = { date: string; slots: Slot[] };
type ErrorResponse = { error: string };

const DISCOUNT_RATE = 0.1;
const SERVICE_DURATION_MIN = 90; // 服务时长 90 分钟

export async function GET(req: NextRequest) {
  console.log("API /api/calendar called");
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');
    const address = searchParams.get('address');
    const basePrice = searchParams.get('basePrice');

    // 参数验证
    if (!date || !address || !basePrice) {
      console.error("Missing required parameters:", { date, address, basePrice });
      return NextResponse.json(
        { error: 'Missing required parameters: date, address, and basePrice are required' },
        { status: 400 }
      );
    }

    const base = parseFloat(basePrice);
    if (isNaN(base) || base <= 0) {
      console.error("Invalid basePrice:", basePrice);
      return NextResponse.json(
        { error: 'basePrice must be a positive number' },
        { status: 400 }
      );
    }

    // 验证日期格式
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      console.error("Invalid date format:", date);
      return NextResponse.json(
        { error: 'Invalid date format. Please use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    console.log(`===== API /api/calendar START: date=${date}, address=${address} =====`);
    
    // 初始化 Supabase 客户端
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase configuration");
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 查询当天所有订单
    const { data: bookings, error: supaError } = await supabase
      .from('bookings')
      .select('event_date, event_time, address, zip_code')
      .not('deposit', 'is', null)
      .eq('event_date', date);

    if (supaError) {
      console.error("Supabase query error:", supaError);
      return NextResponse.json(
        { error: 'Database query failed' },
        { status: 500 }
      );
    }

    console.log(`Fetched bookings for ${date}:`, bookings);
    console.log(`Total bookings found: ${(bookings || []).length}`);

    const MAX_TECHS = 1;
    const slots: Slot[] = [];
    let t = new Date(`${date}T13:00:00`);
    const end = new Date(`${date}T21:00:00`);

    // 处理bookings数据，转成更易用的格式
    const bookingDetails = (bookings || []).map(b => {
      const start = new Date(`${b.event_date}T${b.event_time}`);
      const end = new Date(start.getTime() + SERVICE_DURATION_MIN * 60000);
      console.log(`Booking: ${b.event_date} ${b.event_time}, zip: ${b.zip_code}, startTime: ${start}, endTime: ${end}`);
      return {
        ...b,
        startTime: start,
        endTime: end
      };
    });

    // 1. 首先检查当天是否有任何"高负载"时间段
    const getOverlapCount = (slotStart: Date, slotEnd: Date) => {
      const overlaps = bookingDetails.filter(b => {
        const doesOverlap = !(slotEnd <= b.startTime || slotStart >= b.endTime);
        return doesOverlap;
      });
      return overlaps.length;
    };

    const generateSlots = async () => {
      // 检查是否有热门时段（订单数 >= 师傅数量）
      let hasHighLoadSlot = false;
      let tempTime = new Date(`${date}T13:00:00`);
      console.log(`Checking for high load slots. MAX_TECHS=${MAX_TECHS}`);
      
      while (tempTime <= end) {
        const slotStart = new Date(tempTime);
        const slotEnd = new Date(slotStart.getTime() + SERVICE_DURATION_MIN * 60000);
        const count = getOverlapCount(slotStart, slotEnd);
        console.log(`Time: ${slotStart.toTimeString().slice(0, 5)}, Overlap count: ${count}, High load? ${count >= MAX_TECHS}`);
        
        if (count >= MAX_TECHS) {
          hasHighLoadSlot = true;
          console.log(`Found high load slot at ${slotStart.toTimeString().slice(0, 5)} with ${count} overlapping bookings`);
          break;
        }
        tempTime = new Date(tempTime.getTime() + 30 * 60000);
      }

      console.log(`Has high load slot: ${hasHighLoadSlot}`);

      // 2. 处理每个时间段
      console.log(`Processing time slots for pricing and availability...`);
      while (t <= end) {
        const slotStart = new Date(t);
        const slotEnd = new Date(slotStart.getTime() + SERVICE_DURATION_MIN * 60000);
        const overlapCount = getOverlapCount(slotStart, slotEnd);
        
        // 判断是否可预约
        const available = overlapCount < MAX_TECHS;
        console.log(`Time: ${slotStart.toTimeString().slice(0, 5)}, Overlap: ${overlapCount}, Available: ${available}`);
        
        // 判断是否有足够间隔（如有需要打折）
        let hasSufficientGap = true;
        if (hasHighLoadSlot && available) {
          console.log(`Checking gaps for ${slotStart.toTimeString().slice(0, 5)}...`);
          for (const booking of bookingDetails) {
            try {
              // 计算两地之间的驾驶时间
              const driveMin = await getDriveMinutes(booking.zip_code, address);
              console.log(`Drive time from ${booking.zip_code} to ${address}: ${driveMin} minutes`);
              
              // 新订单结束时间 + 驾驶时间 <= 已有订单开始时间 或 已有订单结束时间 + 驾驶时间 <= 新订单开始时间
              const gap1 = slotEnd.getTime() + driveMin * 60000 <= booking.startTime.getTime();
              const gap2 = booking.endTime.getTime() + driveMin * 60000 <= slotStart.getTime();
              const hasGap = gap1 || gap2;
              
              console.log(`  Booking at ${booking.event_time}, Gap before: ${gap1}, Gap after: ${gap2}, Has sufficient gap: ${hasGap}`);
              
              if (!hasGap) {
                hasSufficientGap = false;
                console.log(`  Insufficient gap for ${slotStart.toTimeString().slice(0, 5)} with booking at ${booking.event_time}`);
                break;
              }
            } catch (error) {
              console.error(`Error calculating drive time: ${error}`);
              hasSufficientGap = false;
              break;
            }
          }
        }

        // 判断是否打折
        let price = base;
        if (hasHighLoadSlot && available && hasSufficientGap) {
          const discountPrice = Math.floor(base * (1 - DISCOUNT_RATE));
          console.log(`Applying discount for ${slotStart.toTimeString().slice(0, 5)}: ${base} -> ${discountPrice}`);
          price = discountPrice;
        } else {
          console.log(`No discount for ${slotStart.toTimeString().slice(0, 5)}, reasons: hasHighLoad=${hasHighLoadSlot}, available=${available}, sufficientGap=${hasSufficientGap}`);
        }

        price = Math.floor(price);
        slots.push({ 
          time: t.toTimeString().slice(0, 5), 
          price,
          available 
        });
        t = new Date(t.getTime() + 30 * 60000);
      }
    };

    await generateSlots();

    // 在返回响应之前确保数据格式正确
    const response = {
      date,
      slots: slots.map(slot => ({
        time: slot.time,
        price: Math.floor(slot.price), // 确保价格是整数
        available: Boolean(slot.available) // 确保是布尔值
      }))
    };

    console.log(`Generated ${response.slots.length} slots for ${date}`);
    console.log(`===== API /api/calendar END =====`);

    return NextResponse.json(response);
  } catch (error) {
    console.error("Unexpected error in /api/calendar:", error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while processing your request' },
      { status: 500 }
    );
  }
}
