import { type NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// Sink for lib/report-client-error.ts. Writes one line per crash to the server
// log, where Vercel's runtime logs make it searchable — `[client-exception]`
// is the term to grep. Deliberately storage-free: the value is in seeing the
// stack within minutes of a deploy, and a table nobody reads is worse than a
// log line somebody greps.
//
// Always answers 204, even for garbage. The caller is a page that is already
// broken; a 4xx here would only add a second error to the console.
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return new NextResponse(null, { status: 204 })
  }

  const message = String(body.message ?? "").slice(0, 500)
  if (!message) {
    return new NextResponse(null, { status: 204 })
  }

  console.error(
    "[client-exception]",
    JSON.stringify({
      message,
      source: String(body.source ?? "unknown").slice(0, 40),
      digest: body.digest ? String(body.digest).slice(0, 100) : undefined,
      url: String(body.url ?? "").slice(0, 500),
      referrer: body.referrer ? String(body.referrer).slice(0, 300) : undefined,
      userAgent: String(body.userAgent ?? "").slice(0, 300),
      viewport: String(body.viewport ?? "").slice(0, 20),
      language: String(body.language ?? "").slice(0, 20),
      translated: body.translated === true,
      stack: String(body.stack ?? "").slice(0, 4000),
      at: new Date().toISOString(),
    }),
  )

  return new NextResponse(null, { status: 204 })
}
