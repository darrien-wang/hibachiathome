import { getSupabaseAdmin } from "@/lib/supabase-admin"

const CONTRACT_VERSION = "2026-04-20.runtime.v1"
const REQUIRED_ENV_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "CRM_INTEGRATION_BASE_URL",
  "CRM_INTEGRATION_SHARED_SECRET",
  "INVOICE_SELF_SERVICE_BASE_URL",
  "NEXT_PUBLIC_INVOICE_SELF_SERVICE_BASE_URL",
]
const REQUIRED_TABLES = [
  "bookings",
  "stripe_webhook_events",
  "crm_integration_outbox",
  "chat_sessions",
  "chat_messages",
]

type ReleaseCheck = {
  id: string
  ok: boolean
  detail: string
}

function isPresent(key: string) {
  return Boolean(process.env[key]?.trim())
}

function getRequestedHost(request: Request) {
  return request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host") || null
}

function getRequestedProtocol(request: Request) {
  return request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || new URL(request.url).protocol.replace(":", "")
}

function inferTargetId(host: string | null) {
  const normalizedHost = host?.toLowerCase() || ""
  if (normalizedHost.includes("realhibachi-marketing")) {
    return "isolated-marketing"
  }
  return "public-site"
}

function summarizeSupabase() {
  const adminUrl = process.env.SUPABASE_URL?.trim() || null
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || null
  const rawUrl = adminUrl || publicUrl

  if (!rawUrl) {
    return {
      configured: false,
      urlHost: null,
      projectRef: null,
      publicUrlMatchesAdmin: null,
      detail: "SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL missing.",
    }
  }

  try {
    const parsed = new URL(rawUrl)
    return {
      configured: true,
      urlHost: parsed.host,
      projectRef: parsed.hostname.split(".")[0] || null,
      publicUrlMatchesAdmin: adminUrl && publicUrl ? adminUrl === publicUrl : null,
      detail: `Supabase host ${parsed.host}`,
    }
  } catch {
    return {
      configured: false,
      urlHost: null,
      projectRef: null,
      publicUrlMatchesAdmin: null,
      detail: "SUPABASE_URL is not a valid URL.",
    }
  }
}

async function checkTables(tableNames: string[]) {
  const supabase = getSupabaseAdmin()
  if (!supabase) {
    return tableNames.map((tableName) => ({
      name: tableName,
      ok: false,
      detail: "Supabase admin client is not configured.",
    }))
  }

  return Promise.all(
    tableNames.map(async (tableName) => {
      const { error } = await supabase.from(tableName).select("*", { head: true, count: "exact" })
      return {
        name: tableName,
        ok: !error,
        detail: error ? error.message : "reachable",
      }
    }),
  )
}

export async function buildReleaseReadyPayload(request: Request) {
  const host = getRequestedHost(request)
  const protocol = getRequestedProtocol(request)
  const targetId = inferTargetId(host)
  const envChecks = REQUIRED_ENV_KEYS.map((key) => ({
    key,
    present: isPresent(key),
  }))
  const supabaseSummary = summarizeSupabase()
  const tableChecks = await checkTables(REQUIRED_TABLES)

  const checks: ReleaseCheck[] = [
    ...envChecks.map((entry) => ({
      id: `env:${entry.key}`,
      ok: entry.present,
      detail: entry.present ? "present" : "missing",
    })),
    {
      id: "dependency:shared-supabase",
      ok: supabaseSummary.configured,
      detail: supabaseSummary.detail,
    },
    ...tableChecks.map((entry) => ({
      id: `table:${entry.name}`,
      ok: entry.ok,
      detail: entry.detail,
    })),
  ]

  const ok = checks.every((entry) => entry.ok)

  return {
    ok,
    contractVersion: CONTRACT_VERSION,
    service: {
      codebase: "marketing",
      target: targetId,
      gitRepo: "darrien-wang/hibachiathome",
      sharedDataDependencies: ["shared-supabase", "invoice-self-service"],
      relatedTargets: ["ops/ops", "chef/chef"],
    },
    deployment: {
      requestedHost: host,
      requestedBaseUrl: host ? `${protocol}://${host}` : null,
      vercelEnv: process.env.VERCEL_ENV || process.env.NODE_ENV || null,
      vercelUrl: process.env.VERCEL_URL || null,
      productionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL || null,
      gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    },
    dependencies: {
      sharedSupabase: {
        configured: supabaseSummary.configured,
        urlHost: supabaseSummary.urlHost,
        projectRef: supabaseSummary.projectRef,
        publicUrlMatchesAdmin: supabaseSummary.publicUrlMatchesAdmin,
      },
    },
    checks,
  }
}
