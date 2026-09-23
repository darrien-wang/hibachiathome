import type { Metadata } from "next"
import PayClient from "./PayClient"

// 尾款支付页。链接由工作台生成并发给客户，带 ?o=<订单 id>。
//
// 和 /deposit 的区别：押金是固定的 $19.90，尾款要让客户自己决定给师傅多少
// 小费（老板 2026-09-23 定），所以金额不能在链接里写死。尾款本身仍然是死的，
// 只有小费是活的。

export const metadata: Metadata = {
  title: "Pay your balance",
  description: "Settle the balance for your Real Hibachi party and add a tip for your chef.",
  // 私人页面：一人一链接，别进索引也别被抓取。
  robots: { index: false, follow: false, nocache: true },
}

export default function PayPage() {
  return (
    <main className="min-h-[70vh] bg-cream text-ink">
      <PayClient />
    </main>
  )
}
