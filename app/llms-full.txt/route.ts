import { renderLlmsTxt } from "@/lib/ai-facts"

// Generated from the live pricing config so AI assistants never quote a stale
// number (决策日志 D-0917-06). Rebuilt hourly so date-bound offers roll off.
export const revalidate = 3600

export function GET() {
  return new Response(renderLlmsTxt(true), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  })
}
