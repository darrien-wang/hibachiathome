import { redirect } from "next/navigation"
import { forwardToWorkbench } from "@/lib/workbench-redirect"

// The lead page merged into the workbench (2026-09-21). Alerts still link to
// /admin/leads?lead=<id>, so keep the URL alive and hand the params over.
export default async function LeadsRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(forwardToWorkbench("leads", await searchParams))
}
