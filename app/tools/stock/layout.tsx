import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
import "../../admin/workbench.css"

// 师傅盘点（2026-11-26，components/stock/StockCount.tsx）。私人链接，不收录；
// 站点头尾和追踪脚本由 HideOnAdmin 按 /tools/ 挡掉。
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "盘点 · Real Hibachi",
  robots: { index: false, follow: false, noarchive: true },
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" }

export default function ToolsStockLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`header:not(.wb header), footer, #social-proof-toast { display: none !important; } body { background: #f3f2f2; }`}</style>
      <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      {children}
    </>
  )
}
