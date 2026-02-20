"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Phone, MessageCircle } from "lucide-react"
import { trackEvent } from "@/lib/tracking"

export function FloatingContactButtons() {
  const pathname = usePathname()
  const phoneNumber = "2137707788"

  if (pathname.startsWith("/deposit") || pathname.startsWith("/after-deposit")) {
    return null
  }

  const handleBook = () => {
    trackEvent("lead_start", { contact_surface: "mobile_sticky_cta" })
  }

  const handleCall = () => {
    trackEvent("phone_click", { contact_surface: "mobile_sticky_cta" })

    if ((window as { __REALHIBACHI_DISABLE_NAVIGATION__?: boolean }).__REALHIBACHI_DISABLE_NAVIGATION__) {
      return
    }

    window.location.href = `tel:${phoneNumber}`
  }

  const handleWhatsApp = () => {
    trackEvent("contact_whatsapp_click", { contact_surface: "mobile_sticky_cta" })
    const body = encodeURIComponent("Hi Real Hibachi, I want to check date availability and pricing.")
    window.location.href = `https://wa.me/1${phoneNumber}?text=${body}`
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
      <div className="grid grid-cols-4 gap-2 p-2">
        <Button asChild onClick={handleBook} className="h-10 bg-orange-600 hover:bg-orange-700 text-white">
          <Link href="/book">Book</Link>
        </Button>
        <Button onClick={handleSMS} variant="outline" className="h-10 border-orange-300 text-orange-700">
          <MessageCircle className="mr-1 h-4 w-4" />
          SMS
        </Button>
        <Button onClick={handleCall} className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Phone className="mr-1 h-4 w-4" />
          Call
        </Button>
        <Button onClick={handleWhatsApp} className="h-10 bg-green-600 hover:bg-green-700 text-white">
          <MessageCircle className="mr-1 h-4 w-4" />
          WA
        </Button>
      </div>
    </div>
  )
}
