"use client"

import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { MessageCircle } from "lucide-react"
import { trackEvent } from "@/lib/tracking"

export function FloatingContactButtons() {
  const pathname = usePathname()
  const phoneNumber = "2137707788"

  if (pathname.startsWith("/deposit") || pathname.startsWith("/after-deposit")) {
    return null
  }

  const handleSMS = () => {
    trackEvent("sms_click", { contact_surface: "mobile_sticky_cta" })

    if ((window as { __REALHIBACHI_DISABLE_NAVIGATION__?: boolean }).__REALHIBACHI_DISABLE_NAVIGATION__) {
      return
    }

    window.location.href = `sms:${phoneNumber}?body=Hi%20Real%20Hibachi%2C%20I%20want%20a%20quick%20quote.`
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-orange-200 bg-white/95 backdrop-blur md:hidden">
      <div className="flex items-center justify-between gap-3 p-2">
        <p className="text-xs font-medium text-gray-700">Questions? Text us</p>
        <Button onClick={handleSMS} variant="outline" className="h-10 border-orange-300 text-orange-700">
          <MessageCircle className="mr-1 h-4 w-4" />
          SMS
        </Button>
      </div>
    </div>
  )
}
