"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"

// Site chrome (header/footer/chat/toasts) is for the public site only; the
// /admin workbench renders bare. Children stay server-rendered (children
// pass-through pattern), so this wrapper does not affect homepage SSR.
export function HideOnAdmin({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  if (pathname?.startsWith("/admin")) return null
  return <>{children}</>
}
