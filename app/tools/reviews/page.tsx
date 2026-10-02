import { Suspense } from "react"
import { ReviewBoard } from "@/components/reviews/ReviewBoard"

// 链接里的 ?t= 在客户端读（useSearchParams），外面得包一层 Suspense，
// 不然整页会退化成纯客户端渲染。
export default function ReviewBoardPage() {
  return (
    <div className="wb" style={{ minHeight: "100vh" }}>
      <Suspense fallback={null}>
        <ReviewBoard />
      </Suspense>
    </div>
  )
}
