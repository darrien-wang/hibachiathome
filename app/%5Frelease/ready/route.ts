import { NextResponse } from "next/server"

import { buildReleaseReadyPayload } from "@/lib/release-ready"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const payload = await buildReleaseReadyPayload(request)
  return NextResponse.json(payload, {
    status: payload.ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  })
}
