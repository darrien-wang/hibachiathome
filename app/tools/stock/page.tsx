import { Suspense } from "react"
import { StockCount } from "@/components/stock/StockCount"

// ?t= 在客户端读（useSearchParams），外面包一层 Suspense。
export default function StockCountPage() {
  return (
    <div className="wb" style={{ minHeight: "100vh" }}>
      <Suspense fallback={null}>
        <StockCount />
      </Suspense>
    </div>
  )
}
