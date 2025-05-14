import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"

// 缓存配置数据，避免重复请求
let configCache: Record<string, string> | null = null
let configLastFetched = 0
const CONFIG_CACHE_TTL = 60 * 1000 // 1分钟缓存

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { date, time, zipcode, headcount, packageType, initialBasePrice } = await request.json()

    if (!date || !time || !zipcode) {
      return NextResponse.json(
        { error: "Missing required parameters: date, time, and zipcode are required" },
        { status: 400 },
      )
    }

    // 1. 获取价格配置 (使用缓存减少请求)
    let config: Record<string, string> = {
      // Default values in case the database query fails
      technician_count: "3",
      max_orders_per_technician: "3",
      schedule_discount: "0.8",
      early_booking_discount: "0.95",
      early_booking_days: "7",
      buffer_minutes: "15",
    }

    try {
      // 检查缓存是否有效
      const now = Date.now()
      if (!configCache || now - configLastFetched > CONFIG_CACHE_TTL) {
        const { data: configData, error: configError } = await supabase.from("pricing_config").select("key, value")

        if (configError) {
          console.error("Error fetching pricing config:", configError)
          // If the table doesn't exist yet, we'll use the default values
          if (configError.message.includes("does not exist")) {
            console.log("pricing_config table does not exist yet, using default values")
          }
          // Continue using default config or cached config
        } else if (configData && configData.length > 0) {
          // 更新缓存
          const newConfig: Record<string, string> = {}
          configData.forEach((item) => {
            newConfig[item.key] = item.value
          })
          configCache = newConfig
          configLastFetched = now
          config = newConfig
        }
      } else {
        // 使用缓存
        config = configCache
      }
    } catch (error) {
      console.error("Error processing pricing config:", error)
      // 使用默认配置继续
    }

    // 2. 容量校验 - 检查当日预约数量是否超过最大容量
    const technicianCount = Number.parseInt(config.technician_count || "3")
    const maxOrdersPerTech = Number.parseInt(config.max_orders_per_technician || "3")
    const maxDailyOrders = technicianCount * maxOrdersPerTech

    try {
      const { count: existingOrdersCount, error: countError } = await supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("event_date", date)
        .eq("status", "confirmed")

      if (countError) {
        console.error("Error counting existing orders:", countError)
        // 继续处理，假设有容量
      } else if (existingOrdersCount && existingOrdersCount >= maxDailyOrders) {
        return NextResponse.json({
          available: false,
          error: "This date is fully booked. Please select another date.",
        })
      }
    } catch (error) {
      console.error("Error checking capacity:", error)
      // 继续处理，假设有容量
    }

    // 3. 查找当日最近的预约 (可选步骤，如果失败继续处理)
    let nearestOrder = null
    try {
      const { data: nearestOrderData, error: nearestOrderError } = await supabase
        .from("reservations")
        .select("id, event_time, address")
        .eq("event_date", date)
        .eq("status", "confirmed")
        .order("event_time")
        .limit(1)

      if (!nearestOrderError && nearestOrderData && nearestOrderData.length > 0) {
        nearestOrder = nearestOrderData[0]
      }
    } catch (error) {
      console.error("Error finding nearest order:", error)
      // 继续处理，假设没有最近的预约
    }

    // 4. Get base price from the request or calculate if not provided
    let basePrice = initialBasePrice || 0
    console.log("Received basePrice:", basePrice, "headcount:", headcount, "packageType:", packageType)

    if (!basePrice) {
      // Fallback calculation if basePrice is not provided
      if (packageType === "basic") {
        // Get base price from config or pricing table
        // Simplified calculation
        const perPersonPrice = 60 // Assume $60 per person
        basePrice = headcount * perPersonPrice
        // Ensure minimum spending
        const minimumSpending = 300 // Assume $300 minimum
        basePrice = Math.max(basePrice, minimumSpending)
      } else {
        // Assume buffet package is $80 per person
        const perPersonPrice = 80
        basePrice = headcount * perPersonPrice
        // Ensure minimum spending
        const minimumSpending = 400
        basePrice = Math.max(basePrice, minimumSpending)
      }
    }

    // 5. 计算折扣和最终价格
    const scheduleDiscount = Number.parseFloat(config.schedule_discount || "0.8")
    const earlyBookingDiscount = Number.parseFloat(config.early_booking_discount || "0.95")
    const earlyBookingDays = Number.parseInt(config.early_booking_days || "7")
    const bufferMinutes = Number.parseInt(config.buffer_minutes || "15")

    // 检查是否有足够的调度间隔
    let finalPrice = basePrice
    let scheduleDiscountApplied = false
    let earlyDiscountApplied = false
    let errorMessage = null

    if (nearestOrder) {
      // 由于没有 zipcode 列，我们将使用固定的驾驶时间
      // 在实际应用中，您可能需要从地址中提取邮编或使用其他方法计算驾驶时间
      const driveMinutes = 30 // 使用默认驾驶时间

      // 计算最小调度间隔
      const minInterval = driveMinutes + bufferMinutes

      // 计算两个时间点之间的分钟差
      const prevTime = nearestOrder.event_time
      const timeMinutesDiff = calculateTimeDifference(prevTime, time)

      if (timeMinutesDiff < minInterval) {
        errorMessage = `Scheduling requires at least ${minInterval} minutes between bookings. This time slot is not available.`
      } else {
        // 满足调度间隔，应用折扣
        scheduleDiscountApplied = true
        finalPrice *= scheduleDiscount
      }
    } else {
      // 当日无其他订单，直接应用调度折扣
      scheduleDiscountApplied = true
      finalPrice *= scheduleDiscount
    }

    // 检查是否符合提前预订折扣条件
    const today = new Date()
    const bookingDate = new Date(date)
    const daysDifference = Math.floor((bookingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (daysDifference >= earlyBookingDays) {
      earlyDiscountApplied = true
      finalPrice *= earlyBookingDiscount
    }

    // 四舍五入到两位小数
    finalPrice = Math.round(finalPrice * 100) / 100

    return NextResponse.json({
      available: !errorMessage,
      error: errorMessage,
      basePrice,
      finalPrice,
      scheduleDiscountApplied,
      scheduleDiscount,
      earlyDiscountApplied,
      earlyBookingDiscount,
      originalPrice: basePrice,
    })
  } catch (error) {
    console.error("Error checking availability:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}

// 计算两个时间字符串之间的分钟差
function calculateTimeDifference(time1: string, time2: string): number {
  // 假设时间格式为 "HH:MM"
  const [hours1, minutes1] = time1.split(":").map(Number)
  const [hours2, minutes2] = time2.split(":").map(Number)

  const totalMinutes1 = hours1 * 60 + minutes1
  const totalMinutes2 = hours2 * 60 + minutes2

  return Math.abs(totalMinutes2 - totalMinutes1)
}
