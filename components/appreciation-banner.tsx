"use client"

// Service-appreciation banner: renders the currently active honoree window
// from config/appreciation-program. Client-only on purpose — the themed
// landing pages are statically generated, and a build-time date would freeze
// the rotation; computing in the browser keeps the schedule live.
import { useEffect, useState } from "react"
import Link from "next/link"
import { HeartHandshake } from "lucide-react"
import {
  APPRECIATION_AMOUNT,
  APPRECIATION_TERMS,
  getActiveHonoree,
  type Honoree,
} from "@/config/appreciation-program"
import { trackEvent } from "@/lib/tracking"

export default function AppreciationBanner({
  source,
  showCta = true,
}: {
  /** Where the banner is placed, for the quote link + tracking. */
  source: string
  /** Hide the CTA on pages that already are the quote surface. */
  showCta?: boolean
}) {
  // Resolve after mount so SSG'd HTML never bakes in a stale honoree.
  const [honoree, setHonoree] = useState<Honoree | null>(null)
  useEffect(() => {
    setHonoree(getActiveHonoree() ?? null)
  }, [])

  if (!honoree) return null

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-5">
      <div className="flex items-start gap-3">
        <HeartHandshake className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Appreciation Program · right now we&apos;re honoring
          </p>
          <p className="mt-0.5 font-bold text-gray-900">
            {honoree.group} — ${APPRECIATION_AMOUNT} off your party
          </p>
          <p className="mt-1 text-sm text-gray-700">
            <span className="italic">{honoree.headline}.</span> {honoree.blurb}
          </p>
          <p className="mt-2 text-xs text-gray-500">{APPRECIATION_TERMS}</p>
          {showCta && (
            <Link
              href={`/quote?source=${encodeURIComponent(`appreciation_${source}`)}`}
              onClick={() =>
                trackEvent("promotion_click", { promotion: honoree.id, contact_surface: source })
              }
              className="mt-3 inline-flex items-center rounded-full bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800 transition-colors"
            >
              Claim your ${APPRECIATION_AMOUNT} — get a quote
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
