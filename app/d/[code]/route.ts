import { type NextRequest, NextResponse } from "next/server"

import { resolveShortLink, SHORT_LINK_FALLBACK_URL } from "@/lib/short-link"

export const dynamic = "force-dynamic"

// /d/<code> -> the long URL it stands for. Unknown or expired codes land on the
// homepage instead of a 404, so a month-old text still goes somewhere useful.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const target = await resolveShortLink(code)
  const response = NextResponse.redirect(target ?? SHORT_LINK_FALLBACK_URL, 302)
  response.headers.set("Cache-Control", "no-store")
  response.headers.set("X-Robots-Tag", "noindex, nofollow")
  return response
}
