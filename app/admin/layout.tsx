import type { ReactNode } from "react"

// Dynamic rendering so usePathname resolves during SSR and the site chrome
// (header/footer/chat) is stripped server-side — no flash of public-site UI.
export const dynamic = "force-dynamic"

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children
}
