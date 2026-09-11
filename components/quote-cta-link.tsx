"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useEffect, useState, type MouseEvent, type ReactNode } from "react"

/**
 * A quote CTA that admits it is working.
 *
 * On a slow connection the /quote chunk can take several seconds to arrive
 * and Next.js paints nothing in between, so the tap looks ignored: people
 * tap again, or give up (owner's own report, 2026-09-10). The label turns
 * into a spinner the moment it is pressed and resets when the route
 * actually changes. A 20 s guard resets it if navigation dies silently, so
 * the button can never be stuck "loading" on a page that never left.
 */
export default function QuoteCtaLink({
  href,
  className,
  children,
  onClick,
  pendingLabel = "Opening your quote…",
}: {
  href: string
  className?: string
  children: ReactNode
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
  pendingLabel?: string
}) {
  const [pending, setPending] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setPending(false)
  }, [pathname])

  useEffect(() => {
    if (!pending) return
    const timer = window.setTimeout(() => setPending(false), 20_000)
    return () => window.clearTimeout(timer)
  }, [pending])

  return (
    <Link
      href={href}
      className={className}
      aria-busy={pending || undefined}
      onClick={(event) => {
        onClick?.(event)
        // Modifier clicks open a new tab; this page is not going anywhere.
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey) return
        setPending(true)
      }}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </Link>
  )
}
