"use server"

import { createServerSupabaseClient } from "@/lib/supabase"
import type { Reservation, Order, OrderItem, Participant, ParticipantSelection } from "@/types/booking"

// 创建预订
export async function createReservation(
  reservationData: Reservation,
): Promise<{ success: boolean; data?: Reservation; error?: string }> {
  try {
    const supabase = createServerSupabaseClient()

    const { data, error } = await supabase.from("reservations").insert(reservationData).select().single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error("Error creating reservation:", error.message)
    return { success: false, error: error.message }
  }
}

// 创建订单
export async function createOrder(orderData: Order): Promise<{ success: boolean; data?: Order; error?: string }> {
  try {
    const supabase = createServerSupabaseClient()

    const { data, error } = await supabase.from("orders").insert(orderData).select().single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error("Error creating order:", error.message)
    return { success: false, error: error.message }
  }
}

// 创建订单项目
export async function createOrderItems(
  orderItems: OrderItem[],
): Promise<{ success: boolean; data?: OrderItem[]; error?: string }> {
  try {
    const supabase = createServerSupabaseClient()

    const { data, error } = await supabase.from("order_items").insert(orderItems).select()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error("Error creating order items:", error.message)
    return { success: false, error: error.message }
  }
}

// 创建参与者
export async function createParticipants(
  participants: Participant[],
): Promise<{ success: boolean; data?: Participant[]; error?: string }> {
  try {
    const supabase = createServerSupabaseClient()

    const { data, error } = await supabase.from("participants").insert(participants).select()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error("Error creating participants:", error.message)
    return { success: false, error: error.message }
  }
}

// 创建参与者选择
export async function createParticipantSelections(
  selections: ParticipantSelection[],
): Promise<{ success: boolean; data?: ParticipantSelection[]; error?: string }> {
  try {
    const supabase = createServerSupabaseClient()

    const { data, error } = await supabase.from("participant_selections").insert(selections).select()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error("Error creating participant selections:", error.message)
    return { success: false, error: error.message }
  }
}

// 完整的预订和订单创建流程
export async function createBookingWithOrder(
  reservationData: Reservation,
  orderData: {
    package_id: string
    total_price: number
    items: Array<{
      item_type: string
      item_id: string
      quantity: number
      price: number
    }>
    participants: Array<{
      name: string
      is_host?: boolean
      is_proxy_selection?: boolean
      selections?: Array<{
        item_type: string
        item_id: string
        quantity: number
      }>
    }>
  },
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const supabase = createServerSupabaseClient()

    // 开始事务
    // 注意：Supabase JS 客户端不直接支持事务，所以我们需要手动处理错误和回滚

    // 1. 创建预订
    const reservationResult = await createReservation(reservationData)
    if (!reservationResult.success || !reservationResult.data) {
      return { success: false, error: reservationResult.error || "Failed to create reservation" }
    }

    const reservation = reservationResult.data

    // 2. 创建订单
    const orderResult = await createOrder({
      reservation_id: reservation.id!,
      package_id: orderData.package_id,
      total_price: orderData.total_price,
    })

    if (!orderResult.success || !orderResult.data) {
      // 如果订单创建失败，我们应该删除预订
      await supabase.from("reservations").delete().eq("id", reservation.id)
      return { success: false, error: orderResult.error || "Failed to create order" }
    }

    const order = orderResult.data

    // 3. 创建订单项目
    if (orderData.items.length > 0) {
      const orderItems = orderData.items.map((item) => ({
        order_id: order.id!,
        item_type: item.item_type,
        item_id: item.item_id,
        quantity: item.quantity,
        price: item.price,
      }))

      const orderItemsResult = await createOrderItems(orderItems)
      if (!orderItemsResult.success) {
        // 如果订单项目创建失败，我们应该删除订单和预订
        await supabase.from("orders").delete().eq("id", order.id)
        await supabase.from("reservations").delete().eq("id", reservation.id)
        return { success: false, error: orderItemsResult.error || "Failed to create order items" }
      }
    }

    // 4. 创建参与者
    if (orderData.participants.length > 0) {
      const participants = orderData.participants.map((participant) => ({
        order_id: order.id!,
        name: participant.name,
        is_host: participant.is_host || false,
        is_proxy_selection: participant.is_proxy_selection || false,
      }))

      const participantsResult = await createParticipants(participants)
      if (!participantsResult.success || !participantsResult.data) {
        // 如果参与者创建失败，我们应该删除订单项目、订单和预订
        await supabase.from("order_items").delete().eq("order_id", order.id)
        await supabase.from("orders").delete().eq("id", order.id)
        await supabase.from("reservations").delete().eq("id", reservation.id)
        return { success: false, error: participantsResult.error || "Failed to create participants" }
      }

      // 5. 创建参与者选择
      const createdParticipants = participantsResult.data

      for (let i = 0; i < createdParticipants.length; i++) {
        const participant = createdParticipants[i]
        const participantData = orderData.participants[i]

        if (participantData.selections && participantData.selections.length > 0) {
          const selections = participantData.selections.map((selection) => ({
            participant_id: participant.id!,
            item_type: selection.item_type,
            item_id: selection.item_id,
            quantity: selection.quantity,
          }))

          const selectionsResult = await createParticipantSelections(selections)
          if (!selectionsResult.success) {
            // 如果选择创建失败，我们应该删除参与者、订单项目、订单和预订
            await supabase.from("participants").delete().eq("order_id", order.id)
            await supabase.from("order_items").delete().eq("order_id", order.id)
            await supabase.from("orders").delete().eq("id", order.id)
            await supabase.from("reservations").delete().eq("id", reservation.id)
            return { success: false, error: selectionsResult.error || "Failed to create participant selections" }
          }
        }
      }
    }

    return {
      success: true,
      data: {
        reservation,
        order,
      },
    }
  } catch (error: any) {
    console.error("Error in booking process:", error.message)
    return { success: false, error: error.message }
  }
}

// 获取预订列表
export async function getReservations(): Promise<{ success: boolean; data?: Reservation[]; error?: string }> {
  try {
    const supabase = createServerSupabaseClient()

    const { data, error } = await supabase.from("reservations").select("*").order("created_at", { ascending: false })

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error("Error fetching reservations:", error.message)
    return { success: false, error: error.message }
  }
}

// 获取订单详情
export async function getOrderDetails(orderId: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const supabase = createServerSupabaseClient()

    // 获取订单信息
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*, reservation:reservations(*)")
      .eq("id", orderId)
      .single()

    if (orderError) throw orderError

    // 获取订单项目
    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId)

    if (itemsError) throw itemsError

    // 获取参与者
    const { data: participants, error: participantsError } = await supabase
      .from("participants")
      .select("*")
      .eq("order_id", orderId)

    if (participantsError) throw participantsError

    // 获取参与者选择
    const participantIds = participants.map((p) => p.id)
    let participantSelections = []

    if (participantIds.length > 0) {
      const { data: selections, error: selectionsError } = await supabase
        .from("participant_selections")
        .select("*")
        .in("participant_id", participantIds)

      if (selectionsError) throw selectionsError
      participantSelections = selections
    }

    return {
      success: true,
      data: {
        order,
        orderItems,
        participants,
        participantSelections,
      },
    }
  } catch (error: any) {
    console.error("Error fetching order details:", error.message)
    return { success: false, error: error.message }
  }
}
