import { createClient } from "@supabase/supabase-js"

import {
  loadTopology,
  loadSchemaContract,
  getCodebase,
  readEnvFile,
  resolveFromRepo,
  fileExists,
} from "./_lib.mjs"

const topology = await loadTopology()
const contract = await loadSchemaContract()
const sourceCodebase = getCodebase(topology, contract.sourceCodebase)
const envFile = await readEnvFile(sourceCodebase.localRepoPath, sourceCodebase.localEnvFile)

const supabaseUrl = process.env.SUPABASE_URL || envFile.values.SUPABASE_URL
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || envFile.values.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for schema validation.")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const failures = []

for (const table of contract.requiredTables) {
  const { error } = await supabase.from(table.name).select("*", { head: true, count: "exact" }).limit(1)

  if (error) {
    failures.push(`${table.name}: ${error.message}`)
    continue
  }

  console.log(`[ok] table ${table.name}`)

  if (table.migrationPath) {
    const migrationPath = resolveFromRepo(table.migrationPath)
    const exists = await fileExists(migrationPath)
    if (!exists) {
      failures.push(`${table.name}: migration file not found at ${migrationPath}`)
    } else {
      console.log(`[ok] migration file for ${table.name}: ${migrationPath}`)
    }
  }
}

if (failures.length > 0) {
  console.error("\nSupabase schema contract failed:")
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log("\nSupabase schema contract passed.")
