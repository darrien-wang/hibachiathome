"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"

// Site chrome (header/footer/chat/toasts) and every tracker are for the public
// site only; the /admin workbench renders bare. So do the private tools under
// /tools (the shared scheduling page, 2026-09-29): people paste other
// businesses' customer addresses there, and no ad pixel or session recorder
// belongs anywhere near that. Children stay server-rendered (children
// pass-through pattern), so this wrapper does not affect homepage SSR.
//
// `chrome` marks the header, footer and banners: those are also left off the
// party album (/album/<token>, 2026-11-23) - a guest opening it from the group
// chat should see the party, not our nav and a quote button. Trackers still run
// there (the people at the party are who we'd want to reach later).
export function HideOnAdmin({ children, chrome = false }: { children: ReactNode; chrome?: boolean }) {
  const pathname = usePathname()
  if (pathname?.startsWith("/admin") || pathname?.startsWith("/tools/")) return null
  if (chrome && pathname?.startsWith("/album/")) return null
  return <>{children}</>
}
