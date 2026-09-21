import { redirect } from "next/navigation"
import { forwardToWorkbench } from "@/lib/workbench-redirect"

// Bookmark target: opens the workbench with the softphone drawer out.
export default async function PhoneRedirect({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(forwardToWorkbench("leads", { ...(await searchParams), phone: "1" }))
}
