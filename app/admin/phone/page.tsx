"use client"

import { useEffect } from "react"
import { useSoftphone } from "@/components/admin/SoftphoneProvider"

// The phone lives in the right-hand drawer now, reachable from every admin page.
// This route stays as a bookmark target: it just opens the drawer and says so.
export default function SoftphonePage() {
  const { setDrawerOpen } = useSoftphone()

  useEffect(() => {
    setDrawerOpen(true)
  }, [setDrawerOpen])

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "40px 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>客服电话已移到右侧</h1>
      <p style={{ color: "#6b7280", fontSize: 13.5, lineHeight: 1.7, margin: 0 }}>
        电话面板现在是右侧的抽屉，在订单页、线索页都能随时拉开——点屏幕右边缘那个竖条即可。
        来电时它会自动弹出，不用切换页面。
      </p>
    </main>
  )
}
