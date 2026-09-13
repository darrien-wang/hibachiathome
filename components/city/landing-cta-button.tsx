"use client"

import type { ReactNode } from "react"
import { focusLandingPhone } from "@/components/city/landing-estimator"
import { trackEvent } from "@/lib/tracking"

// A CTA on the landing template that does not leave the page: the estimate
// card is the form, so this just brings the visitor back to the one input that
// matters. `surface` names which button it was for the funnel report.
export default function LandingCtaButton({
  className,
  label = "Text me this quote",
  surface = "landing_final_cta",
  children,
}: {
  className?: string
  label?: string
  surface?: string
  children?: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={() => {
        trackEvent("lead_start", { contact_surface: surface })
        focusLandingPhone()
      }}
      className={className}
    >
      {children ?? label}
    </button>
  )
}
