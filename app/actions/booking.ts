"use server"
import type { Booking, BookingFormData, BookingResponse, AvailableTimesResponse } from "@/types/booking"
import { pricing } from "@/config/pricing"

// Travel fee, matching the live quote policy in app/api/quote/travel-fee:
// the first 50 miles from our Southern California base are free, then $1 for
// each mile beyond that allowance. The old version of this function carried a TX/NY/AZ/VA/FL zip table
// left over from the out-of-state markets we no longer serve, and defaulted
// every unlisted zip (i.e. every California one) to a flat $50.
const FREE_TRAVEL_MILES = 50
const FEE_PER_MILE = 1

function travelFeeForMiles(distanceMiles: number): number {
  if (!Number.isFinite(distanceMiles) || distanceMiles <= FREE_TRAVEL_MILES) return 0
  return Math.round((distanceMiles - FREE_TRAVEL_MILES) * FEE_PER_MILE)
}

// 类型校验函数
function isValidProteinItem(item: any): item is { name: string; quantity: number; unit_price: number } {
  return (
    typeof item === "object" &&
    (item.name === "Filet Mignon" || item.name === "Lobster Tail") &&
    typeof item.quantity === "number" &&
    typeof item.unit_price === "number"
  );
}
function isValidAddOnItem(item: any): item is { name: string; quantity: number; unit_price: number } {
  return (
    typeof item === "object" &&
    (item.name === "Extra Protein" || item.name === "Noodles") &&
    typeof item.quantity === "number" &&
    typeof item.unit_price === "number"
  );
}

// 创建预订
export async function createBooking(formData: BookingFormData): Promise<BookingResponse> {
  try {
    const supabase = (() => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        console.error("Missing Supabase environment variables")
        return null
      }

      const { createClient } = require("@supabase/supabase-js")
      return createClient(supabaseUrl, supabaseAnonKey)
    })()

    // Add null check for supabase client
    if (!supabase) {
      console.error("Failed to create Supabase client")
      return {
        success: false,
        error: "Database connection failed. Please try again.",
      }
    }

    // 验证必填字段
    const requiredFields = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
      zipcode: formData.zipcode,
      eventDate: formData.eventDate,
      eventTime: formData.eventTime,
    }

    const missingFields = Object.entries(requiredFields)
      .filter(([_, value]) => !value)
      .map(([key]) => key)

    if (missingFields.length > 0) {
      return {
        success: false,
        error: `Missing required fields: ${missingFields.join(", ")}`,
      }
    }

    // 验证电话号码格式
    const phoneRegex = /^[\d\s\-$$$$]+$/
    if (!phoneRegex.test(formData.phone)) {
      return {
        success: false,
        error: "Invalid phone number format",
      }
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      return {
        success: false,
        error: "Invalid email format",
      }
    }

    // 验证邮编格式
    const zipcodeRegex = /^\d{5}$/
    if (!zipcodeRegex.test(formData.zipcode)) {
      return {
        success: false,
        error: "Invalid ZIP code format (must be 5 digits)",
      }
    }

    // 准备高级蛋白质数据
    const premiumProteins = []
    if (formData.filetMignon > 0) {
      premiumProteins.push({
        name: "Filet Mignon",
        quantity: formData.filetMignon,
        unit_price: 5,
      })
    }
    if (formData.lobsterTail > 0) {
      premiumProteins.push({
        name: "Lobster Tail",
        quantity: formData.lobsterTail,
        unit_price: 10,
      })
    }

    // 准备附加服务数据
    const addOns = []
    if (formData.extraProteins > 0) {
      addOns.push({
        name: "Extra Protein",
        quantity: formData.extraProteins,
        unit_price: 15,
      })
    }
    if (formData.noodles > 0) {
      addOns.push({
        name: "Noodles",
        quantity: formData.noodles,
        unit_price: 5,
      })
    }

    // --- 新增结构校验 ---
    if (premiumProteins.length > 0 && !premiumProteins.every(isValidProteinItem)) {
      return { success: false, error: "Invalid premium_proteins structure" };
    }
    if (addOns.length > 0 && !addOns.every(isValidAddOnItem)) {
      return { success: false, error: "Invalid add_ons structure" };
    }

    // 计算旅行费用。距离由 /api/quote/travel-fee 用 Google Distance Matrix 算出，
    // 这里只按同一套规则（前 50 迈免费，之后 $1/迈）换算；拿不到距离时按 0 处理，
    // 绝不再用邮编猜一个 $50 出来。
    const travelFee = travelFeeForMiles(Number(formData.distanceMiles ?? 0))

    // 计算餐费（不含差旅费）
    let mealCost = 0
    mealCost += formData.adults * pricing.packages.basic.perPerson
    mealCost += formData.kids * pricing.children.basic
    premiumProteins.forEach((item) => {
      mealCost += item.quantity * item.unit_price
    })
    addOns.forEach((item) => {
      mealCost += item.quantity * item.unit_price
    })

    // 应用最低消费
    const minimumSpending = pricing.packages.basic.minimum
    const finalMealCost = Math.max(mealCost, minimumSpending)

    // 总金额 = 餐费（含最低消费）+ 差旅费
    const totalCost = Math.round(finalMealCost + travelFee)

    // 准备预订数据
    const bookingData: Booking = {
      full_name: formData.name,
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
      zip_code: formData.zipcode,
      event_date: formData.eventDate,
      event_time: formData.eventTime,
      guest_adults: formData.adults,
      guest_kids: formData.kids,
      price_adult: pricing.packages.basic.perPerson,
      price_kid: pricing.children.basic,
      travel_fee: travelFee,
      special_requests: formData.message || undefined,
      premium_proteins: premiumProteins.length > 0 ? premiumProteins : undefined,
      add_ons: addOns.length > 0 ? addOns : undefined,
      total_cost: totalCost,
      status: "pending",
      deposit: 0,
      deposit_amount: 0,
      deposit_status: "pending",
    }

    // 打印每次上传到数据库的 bookingData
    console.log("[createBooking] 上传到数据库的预定数据:", bookingData)

    // Create booking record with additional error handling
    const { data: booking, error } = await supabase.from("bookings").insert(bookingData).select().single()

    if (error) {
      console.error("Supabase error creating booking:", error)
      return {
        success: false,
        error: `Failed to create booking: ${error.message}`,
      }
    }

    if (!booking) {
      console.error("No booking data returned from Supabase")
      return {
        success: false,
        error: "Failed to create booking: No data returned",
      }
    }

    return {
      success: true,
      data: booking,
    }
  } catch (error: any) {
    console.error("Error in createBooking:", error)
    return {
      success: false,
      error: `An unexpected error occurred: ${error.message || "Unknown error"}`,
    }
  }
}

// 获取可�����时间
export async function getAvailableTimes(date: string, zipcode: string): Promise<AvailableTimesResponse> {
  try {
    const supabase = (() => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        console.error("Missing Supabase environment variables")
        return null
      }

      const { createClient } = require("@supabase/supabase-js")
      return createClient(supabaseUrl, supabaseAnonKey)
    })()

    // Add null check for supabase client
    if (!supabase) {
      console.error("Failed to create Supabase client")
      return {
        success: false,
        error: "Database connection failed. Please try again.",
      }
    }

    // 获取当天的预订
    const { data: existingBookings, error } = await supabase
      .from("bookings")
      .select("event_time, zip_code")
      .eq("event_date", date)

    if (error) {
      console.error("Error fetching bookings:", error)
      return {
        success: false,
        error: "Failed to fetch available times",
      }
    }

    // 默认时间段
    const allTimeSlots = ["13:00", "16:00", "19:00", "21:00"]

    // 计算可用时间段
    const availableTimeSlots = allTimeSlots.filter((time) => {
      const conflictingBooking = existingBookings?.find((booking) => {
        return booking.event_time === time && booking.zip_code === zipcode
      })
      return !conflictingBooking
    })

    return {
      success: true,
      availableTimeSlots,
    }
  } catch (error: any) {
    console.error("Error in getAvailableTimes:", error)
    return {
      success: false,
      error: `An unexpected error occurred: ${error.message || "Unknown error"}`,
    }
  }
}

// 获取预订列表
export async function getBookings(): Promise<{ success: boolean; data?: Booking[]; error?: string }> {
  try {
    const supabase = (() => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        console.error("Missing Supabase environment variables")
        return null
      }

      const { createClient } = require("@supabase/supabase-js")
      return createClient(supabaseUrl, supabaseAnonKey)
    })()

    const { data, error } = await supabase.from("bookings").select("*").order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching bookings:", error)
      return {
        success: false,
        error: error.message,
      }
    }

    return {
      success: true,
      data: data as Booking[],
    }
  } catch (error: any) {
    console.error("Error fetching bookings:", error)
    return {
      success: false,
      error: `An unexpected error occurred: ${error.message || "Unknown error"}`,
    }
  }
}

// 获取单个预订详情
export async function getBookingDetails(bookingId: string) {
  try {
    const supabase = (() => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        console.error("Missing Supabase environment variables")
        return null
      }

      const { createClient } = require("@supabase/supabase-js")
      return createClient(supabaseUrl, supabaseAnonKey)
    })()

    const { data, error } = await supabase.from("bookings").select("*").eq("id", bookingId).single()

    if (error) {
      console.error("Error fetching booking details:", error)
      return {
        success: false,
        error: "获取预订详情时出错",
      }
    }

    return {
      success: true,
      data,
    }
  } catch (error) {
    console.error("Error in getBookingDetails:", error)
    return {
      success: false,
      error: "获取预订详情时发生错误",
    }
  }
}
