"use client"

import { Button } from "@/components/ui/button"
import { MessageSquare } from "lucide-react"
import { trackEvent } from "@/lib/tracking"

// The 9/2 Clarity tapes showed a paid visitor clicking the $1198 example
// price expecting it to do something, then leaving without a trace. Every
// price card now has a one-tap exit: a prefilled text that carries the
// party size and budget the visitor was just looking at.
export function PackageSmsButton({ guests, total }: { guests: number; total: number }) {
  const handleClick = () => {
    trackEvent("contact_sms_click", {
      contact_surface: "menu_price_example",
      guest_count: guests,
      value: total,
    })
    if ((window as { __REALHIBACHI_DISABLE_NAVIGATION__?: boolean }).__REALHIBACHI_DISABLE_NAVIGATION__) {
      return
    }
    const body = encodeURIComponent(
      `Hi Real Hibachi! I'm looking at hibachi for about ${guests} guests (around $${total}). Is my date available?`,
    )
    window.location.href = `sms:2137707788?body=${body}`
  }

  return (
    <Button
      onClick={handleClick}
      className="mt-3 h-9 w-full rounded-full bg-[hsl(24_79%_55%)] text-xs text-white hover:bg-[hsl(24_79%_48%)]"
    >
      <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
      Text us about this package
    </Button>
  )
}
