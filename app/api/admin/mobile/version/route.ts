import { NextResponse } from "next/server"
import { MOBILE_APP } from "@/config/mobile-app"

export const dynamic = "force-dynamic"

// Public on purpose: the app asks before anyone is logged in, and nothing
// here is secret. The APK itself is served from /app/ on this site.
export async function GET() {
  return NextResponse.json({ ok: true, ...MOBILE_APP })
}
