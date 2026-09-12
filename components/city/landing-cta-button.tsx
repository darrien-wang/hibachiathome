"use client"

import { focusLandingPhone } from "@/components/city/landing-estimator"
import { trackEvent } from "@/lib/tracking"

// The final-CTA button on the landing template. It no longer leaves the page:
// the estimate card is the form, so this just brings the visitor back to the
// one input that matters.
export default function LandingCtaButton({ className, label = "Text me this quote" }: { className?: string; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        trackEvent("lead_start", { contact_surface: "landing_final_cta" })
        focusLandingPhone()
      }}
      className={className}
    >
      {label}
    </button>
  )
}
