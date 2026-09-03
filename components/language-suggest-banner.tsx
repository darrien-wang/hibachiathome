"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const DISMISS_KEY = "rh-es-banner-dismissed"

// Soft language suggestion: Spanish-preferring browsers get a dismissible bar
// pointing at /es. Never a forced redirect — that hurts both SEO and trust.
export default function LanguageSuggestBanner() {
  const pathname = usePathname()
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (pathname?.startsWith("/es")) return
      if (localStorage.getItem(DISMISS_KEY)) return
      const langs = navigator.languages?.length ? navigator.languages : [navigator.language]
      if (langs.some((l) => l?.toLowerCase().startsWith("es"))) setShow(true)
    } catch {
      /* storage or language APIs unavailable */
    }
  }, [pathname])

  if (!show) return null

  return (
    <div className="bg-amber-100 border-b border-amber-200 text-amber-900 text-sm">
      <div className="container mx-auto px-4 py-2 flex items-center justify-center gap-3">
        <span>
          ¿Prefieres español?{" "}
          <Link href="/es" className="font-semibold underline underline-offset-2 hover:text-amber-950">
            Ver esta página en español →
          </Link>
        </span>
        <button
          type="button"
          aria-label="Cerrar"
          className="ml-2 rounded px-1.5 text-amber-700 hover:bg-amber-200"
          onClick={() => {
            try {
              localStorage.setItem(DISMISS_KEY, "1")
            } catch {}
            setShow(false)
          }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
