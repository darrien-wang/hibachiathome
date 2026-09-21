import { Suspense } from "react"
import Workbench from "@/components/admin/workbench/Workbench"

// The workbench: 看板 · 线索 · 订单 · 日历 · 设置 in one shell. Tabs and
// dialogs live in the query string (see components/admin/workbench/Workbench.tsx).
export default function AdminPage() {
  return (
    <Suspense fallback={<div className="wb" />}>
      <Workbench />
    </Suspense>
  )
}
