"use server"

import { createClient } from "@/lib/supabase"

/**
 * Adds a new service zone to the database
 */
export async function addServiceZone(data: {
  zoneName: string
  baseTravelFee: number
  minDistance: number
  maxDistance: number
}) {
  try {
    const supabase = createClient()

    const { data: newZone, error } = await supabase
      .from("service_zones")
      .insert({
        zone_name: data.zoneName,
        base_travel_fee: data.baseTravelFee,
        min_distance: data.minDistance,
        max_distance: data.maxDistance,
      })
      .select()
      .single()

    if (error) throw error

    return { success: true, data: newZone }
  } catch (error) {
    console.error("Error adding service zone:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Adds travel time data for a specific zone
 */
export async function addZoneTravelTime(data: {
  zoneId: number
  dayOfWeek: number // 0-6 for Sunday-Saturday
  startTime: string // HH:MM format
  endTime: string // HH:MM format
  estimatedMinutes: number
}) {
  try {
    const supabase = createClient()

    const { data: newTravelTime, error } = await supabase
      .from("zone_travel_times")
      .insert({
        zone_id: data.zoneId,
        day_of_week: data.dayOfWeek,
        start_time: data.startTime,
        end_time: data.endTime,
        estimated_minutes: data.estimatedMinutes,
      })
      .select()
      .single()

    if (error) throw error

    return { success: true, data: newTravelTime }
  } catch (error) {
    console.error("Error adding zone travel time:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Adds a new technician/chef to the system
 */
export async function addTechnician(data: {
  name: string
  email: string
  phone: string
  specialties: string[]
  availability: {
    dayOfWeek: number
    startTime: string
    endTime: string
  }[]
}) {
  try {
    const supabase = createClient()

    // Add the technician
    const { data: newTechnician, error: techError } = await supabase
      .from("technicians")
      .insert({
        name: data.name,
        email: data.email,
        phone: data.phone,
        specialties: data.specialties,
      })
      .select()
      .single()

    if (techError) throw techError

    // Add availability records
    if (data.availability && data.availability.length > 0) {
      const availabilityRecords = data.availability.map((avail) => ({
        technician_id: newTechnician.id,
        day_of_week: avail.dayOfWeek,
        start_time: avail.startTime,
        end_time: avail.endTime,
      }))

      const { error: availError } = await supabase.from("technician_availability").insert(availabilityRecords)

      if (availError) throw availError
    }

    return { success: true, data: newTechnician }
  } catch (error) {
    console.error("Error adding technician:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Updates pricing configuration in the system
 */
export async function updatePricingConfig(data: {
  key: string
  value: any
  description?: string
}) {
  try {
    const supabase = createClient()

    // Check if config exists
    const { data: existingConfig, error: checkError } = await supabase
      .from("pricing_config")
      .select("*")
      .eq("key", data.key)
      .maybeSingle()

    if (checkError && checkError.code !== "PGRST116") throw checkError

    let result

    if (existingConfig) {
      // Update existing config
      const { data: updated, error } = await supabase
        .from("pricing_config")
        .update({
          value: data.value,
          description: data.description || existingConfig.description,
          updated_at: new Date().toISOString(),
        })
        .eq("key", data.key)
        .select()
        .single()

      if (error) throw error
      result = updated
    } else {
      // Insert new config
      const { data: inserted, error } = await supabase
        .from("pricing_config")
        .insert({
          key: data.key,
          value: data.value,
          description: data.description || `Configuration for ${data.key}`,
        })
        .select()
        .single()

      if (error) throw error
      result = inserted
    }

    return { success: true, data: result }
  } catch (error) {
    console.error("Error updating pricing config:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
