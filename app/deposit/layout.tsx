import type { Metadata } from "next"
import type { ReactNode } from "react"

// The deposit flow is reached only from a link we send (决策日志 D-0913-01:
// no deposit on the public site), so none of these pages belong in search.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function DepositLayout({ children }: { children: ReactNode }) {
  return children
}
