import type { Metadata } from "next"
import ConfirmClient from "./ConfirmClient"

// 客户确认页：把这一单的关键事实摆一屏（日期/地址/人数/菜/桌椅/总价），
// 客户点一下 Confirm，工作台那头的订单就从"待确认"变成"已确认"。
// 发票之后再改任何一个字，状态自动回到"改后未确认"——所以这页永远只
// 代表"客户认过的那一版"。链接 ?o=<订单 id>，和 /pay 同一套口径。

export const metadata: Metadata = {
  title: "Confirm your party details",
  description: "One tap to confirm everything for your Real Hibachi party is exactly right.",
  robots: { index: false, follow: false, nocache: true },
}

export default function ConfirmPage() {
  return (
    <main className="min-h-[70vh] bg-cream text-ink">
      <ConfirmClient />
    </main>
  )
}
