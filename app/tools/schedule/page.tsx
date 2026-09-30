import { Suspense } from "react"
import { ScheduleTool } from "@/components/schedule/ScheduleTool"

// 链接里的 ?t= 在客户端读（useSearchParams），外面得包一层 Suspense，
// 不然整页会退化成纯客户端渲染。
export default function ScheduleToolPage() {
  return (
    <div className="wb" style={{ minHeight: "100vh" }}>
      <Suspense fallback={null}>
        <ScheduleTool />
      </Suspense>
    </div>
  )
}
