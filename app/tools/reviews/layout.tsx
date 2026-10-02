import type { Metadata } from "next"
import type { ReactNode } from "react"
import "../../admin/workbench.css"

// 好评榜（2026-10-02）。师傅自己打开看排名、认领没点名的评价。
// 和工作台同一套 Modernist 样式（.wb 作用域）。私人链接，不收录；
// 站点头尾和追踪脚本由 HideOnAdmin 按 /tools/ 挡掉。
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "好评榜 · Review Board",
  robots: { index: false, follow: false, noarchive: true },
}

export default function ToolsReviewsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* 服务端就把站点头尾藏住，别在水合前闪一下营销站的 UI */}
      <style>{`header:not(.wb header), footer, #social-proof-toast { display: none !important; } body { background: #f3f2f2; }`}</style>
      <link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      {children}
    </>
  )
}
