"use server"

import { createServerSupabaseClient } from "@/lib/supabase"
import type { Booking, BookingFormData, BookingResponse, AvailableTimesResponse } from "@/types/booking"
import { pricing } from "@/config/pricing"

// 计算旅行费用
function calculateTravelFee(zipcode: string): number {
  if (!zipcode || zipcode.length < 5) return 0

  const zipPrefix = zipcode.substring(0, 3)
  const regions: Record<string, number> = {
    // TX (Austin, Dallas, Houston, San Antonio)
    "737": 50,
    "750": 50,
    "751": 50,
    "752": 50,
    "770": 50,
    "771": 50,
    "772": 50,
    "782": 50,
    // NY, NJ, PA, DE
    "100": 50,
    "101": 50,
    "102": 50,
    "070": 50,
    "071": 50,
    "190": 50,
    "191": 50,
    "197": 50,
    // AZ (Phoenix Metropolitan)
    "850": 50,
    "851": 50,
    "852": 50,
    "853": 50,
    // VA, MD, Washington DC
    "200": 50,
    "201": 50,
    "220": 50,
    "221": 50,
    "208": 50,
    "209": 50,
    // FL (Miami, Orlando)
    "331": 50,
    "332": 50,
    "328": 50,
    "329": 50,
  }

  return regions[zipPrefix] || 75
}

// 创建预订
export async function createBooking(formData: BookingFormData): Promise<BookingResponse> {
  try {
    const supabase = createServerSupabaseClient()

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

    // 计算旅行费用
    const travelFee = calculateTravelFee(formData.zipcode)

    // 计算总金额
    let totalCost = 0
    totalCost += formData.adults * pricing.packages.basic.perPerson
    totalCost += formData.kids * pricing.children.basic
    totalCost += travelFee

    // 添加高级蛋白质费用
    premiumProteins.forEach((item) => {
      totalCost += item.quantity * item.unit_price
    })

    // 添加附加服务费用
    addOns.forEach((item) => {
      totalCost += item.quantity * item.unit_price
    })

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
      total_cost: Math.round(totalCost), // 转换为整数，因为数据库中是 bigint
      status: "pending",
      deposit: 0,
    }

    // 创建预订记录
    const { data: booking, error } = await supabase.from("bookings").insert(bookingData).select().single()

    if (error) {
      console.error("Error creating booking:", error)
      return {
        success: false,
        error: `Failed to create booking: ${error.message}`,
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

// 获取可用时间
export async function getAvailableTimes(date: string, zipcode: string): Promise<AvailableTimesResponse> {
  try {
    const supabase = createServerSupabaseClient()

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
    const allTimeSlots = ["11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"]

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
    const supabase = createServerSupabaseClient()

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
    const supabase = createServerSupabaseClient()

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
