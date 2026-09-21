import { redirect } from "next/navigation"
import { forwardToWorkbench } from "@/lib/workbench-redirect"

// The channel scorecard is the workbench's 看板 tab now (2026-09-21).
export default async function ChannelsRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(forwardToWorkbench("board", await searchParams))
}
