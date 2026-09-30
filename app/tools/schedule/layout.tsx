import type { Metadata } from "next"
import type { ReactNode } from "react"
import "../../admin/workbench.css"

// 分享出去的排班计算器（2026-09-29）。和工作台同一套 Modernist 样式（.wb 作用域）。
// 私人链接，不收录；站点的头尾和所有追踪脚本由 HideOnAdmin 按 /tools/ 挡掉。
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "排班计算器 · Scheduler",
  robots: { index: false, follow: false, noarchive: true },
}

export default function ToolsScheduleLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* 服务端就先把站点头尾藏住，别在水合前闪一下营销站的 UI */}
      <style>{`header:not(.wb header), footer, #social-proof-toast { display: none !important; } body { background: #f3f2f2; }`}</style>
      <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      {children}
    </>
  )
}
