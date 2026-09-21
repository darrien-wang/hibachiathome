import { redirect } from "next/navigation"
import { forwardToWorkbench } from "@/lib/workbench-redirect"

// The order page merged into the workbench (2026-09-21). ?order= opens the
// order dialog, ?lead= becomes ?lead_order= (the order that lead turned into),
// ?stage= becomes the list filter.
export default async function OrdersRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(forwardToWorkbench("orders", await searchParams))
}
