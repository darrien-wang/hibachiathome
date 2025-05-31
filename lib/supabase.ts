import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export function createServerSupabaseClient() {
  try {
    const cookieStore = cookies()

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase environment variables")
      throw new Error("Supabase configuration is missing")
    }

    return createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Handle cookie setting errors in server components
            console.warn("Failed to set cookie:", error)
          }
        },
        remove(name: string, options: any) {
          try {
            cookieStore.set({ name, value: "", ...options })
          } catch (error) {
            // Handle cookie removal errors in server components
            console.warn("Failed to remove cookie:", error)
          }
        },
      },
    })
  } catch (error) {
    console.error("Error creating Supabase client:", error)
    return null
  }
}

// Create client-side Supabase client (singleton pattern)
let clientSupabaseClient: any = null

export function createClientSupabaseClient() {
  if (typeof window === "undefined") {
    return null // Server-side, return null
  }

  if (clientSupabaseClient) {
    return clientSupabaseClient
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing client-side Supabase environment variables")
      return null
    }

    const { createClient } = require("@supabase/supabase-js")
    clientSupabaseClient = createClient(supabaseUrl, supabaseAnonKey)
    return clientSupabaseClient
  } catch (error) {
    console.error("Error creating client Supabase client:", error)
    return null
  }
}

// Create client component Supabase client
export function createClientComponentClient() {
  if (typeof window === "undefined") {
    return null // Server-side, return null
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing client component Supabase environment variables")
      return null
    }

    const { createClient } = require("@supabase/supabase-js")
    return createClient(supabaseUrl, supabaseAnonKey)
  } catch (error) {
    console.error("Error creating client component Supabase client:", error)
    return null
  }
}

// Re-export createClient for compatibility
export { createClient } from "@supabase/supabase-js"
