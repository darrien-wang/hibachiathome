"use server"

import { createClient } from "@/lib/supabase"

/**
 * Runs database migrations for the application
 * This is a server action that can be called to run migrations programmatically
 */
export async function runMigrations() {
  try {
    const supabase = createClient()

    // Check if migrations table exists
    const { data: migrationTableExists, error: checkError } = await supabase
      .from("migrations")
      .select("name")
      .limit(1)
      .maybeSingle()

    // Create migrations table if it doesn't exist
    if (checkError && checkError.code === "PGRST116") {
      await supabase.rpc("create_migrations_table")
    }

    // Get list of applied migrations
    const { data: appliedMigrations } = await supabase.from("migrations").select("name")

    const appliedMigrationNames = appliedMigrations?.map((m) => m.name) || []

    // Define migrations to run
    const migrations = [
      {
        name: "create_bookings_table",
        sql: `
          CREATE TABLE IF NOT EXISTS bookings (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            customer_name TEXT NOT NULL,
            customer_email TEXT NOT NULL,
            customer_phone TEXT NOT NULL,
            event_date DATE NOT NULL,
            event_time TIME NOT NULL,
            guest_count INTEGER NOT NULL,
            location TEXT NOT NULL,
            package_type TEXT NOT NULL,
            special_requests TEXT,
            total_price DECIMAL(10, 2) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            status TEXT DEFAULT 'pending'
          );
        `,
      },
      {
        name: "create_deposits_table",
        sql: `
          CREATE TABLE IF NOT EXISTS deposits (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            booking_id UUID REFERENCES bookings(id),
            amount DECIMAL(10, 2) NOT NULL,
            payment_method TEXT NOT NULL,
            payment_status TEXT DEFAULT 'pending',
            transaction_id TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `,
      },
      {
        name: "create_service_zones_table",
        sql: `
          CREATE TABLE IF NOT EXISTS service_zones (
            id SERIAL PRIMARY KEY,
            zone_name TEXT NOT NULL,
            base_travel_fee DECIMAL(10, 2) NOT NULL,
            min_distance INTEGER NOT NULL,
            max_distance INTEGER NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `,
      },
    ]

    // Run migrations that haven't been applied yet
    for (const migration of migrations) {
      if (!appliedMigrationNames.includes(migration.name)) {
        await supabase.rpc("run_sql", { sql: migration.sql })

        // Record that migration was applied
        await supabase.from("migrations").insert({
          name: migration.name,
          applied_at: new Date().toISOString(),
        })
      }
    }

    return { success: true, message: "Migrations completed successfully" }
  } catch (error) {
    console.error("Migration error:", error)
    return {
      success: false,
      message: "Failed to run migrations",
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
