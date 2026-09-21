// Maps the old admin URLs onto the single workbench route, keeping every
// deep link that other systems still send (SMS alerts, landing-quote and
// planner notifications link to /admin/leads?lead=…; global search used
// /admin/orders?order=…).
export function forwardToWorkbench(tab: "board" | "leads" | "orders" | "cal", params: Record<string, string | string[] | undefined>): string {
  const out = new URLSearchParams()
  out.set("tab", tab)
  for (const [k, v] of Object.entries(params)) {
    const val = Array.isArray(v) ? v[0] : v
    if (!val) continue
    if (k === "tab") continue
    if (tab === "orders" && k === "lead") out.set("lead_order", val)
    else if (tab === "orders" && k === "stage") out.set("filter", val)
    else out.set(k, val)
  }
  return `/admin?${out.toString()}`
}
