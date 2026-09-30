"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"

// Site chrome (header/footer/chat/toasts) and every tracker are for the public
// site only; the /admin workbench renders bare. So do the private tools under
// /tools (the shared scheduling page, 2026-09-29): people paste other
// businesses' customer addresses there, and no ad pixel or session recorder
// belongs anywhere near that. Children stay server-rendered (children
// pass-through pattern), so this wrapper does not affect homepage SSR.
export function HideOnAdmin({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  if (pathname?.startsWith("/admin") || pathname?.startsWith("/tools/")) return null
  return <>{children}</>
}
