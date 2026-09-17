import { type NextRequest, NextResponse } from "next/server"

import { createShortLink, isAllowedShortLinkTarget, SHORT_LINK_TTL_DAYS } from "@/lib/short-link"

export const dynamic = "force-dynamic"

// Staff-only: shorten a deposit / planner / pay link before texting it.
//   POST { url, leadId?, ttlDays? } -> { ok, shortUrl, code, expiresAt }
function actorAlias(request: NextRequest): string | null {
  const provided = request.headers.get("x-admin-key") ?? ""
  if (!provided) return null
  const owner = process.env.ADMIN_DASH_KEY
  if (owner && provided === owner) return "owner"
  for (const entry of (process.env.AGENT_DASH_KEYS ?? "").split(",")) {
    const [alias, key] = entry.split(":").map((s) => s?.trim())
    if (alias && key && provided === key) return alias
  }
  return null
}

export async function POST(request: NextRequest) {
  const actor = actorAlias(request)
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  let body: { url?: string; leadId?: string; ttlDays?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 })
  }
  const url = String(body.url ?? "").trim()
  if (!isAllowedShortLinkTarget(url)) {
    return NextResponse.json({ ok: false, error: "url must be an https link on a Real Hibachi host" }, { status: 400 })
  }
  const link = await createShortLink(url, {
    leadId: String(body.leadId ?? "").trim() || null,
    createdBy: actor,
    ttlDays: Number.isFinite(body.ttlDays) ? Number(body.ttlDays) : SHORT_LINK_TTL_DAYS,
  })
  if (!link) return NextResponse.json({ ok: false, error: "could not create short link" }, { status: 500 })
  return NextResponse.json({ ok: true, ...link })
}
