"use client"

import { Phone, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export function FloatingContactButtons() {
  const phoneNumber = "2137707788"
  const smsNumber = "5627134832"

  const handleCall = () => {
    window.location.href = `tel:${phoneNumber}`
  }

  const handleSMS = () => {
    window.location.href = `sms:${smsNumber}`
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      {/* Phone Button */}
      <Button
        onClick={handleCall}
        className="bg-slate-700 hover:bg-slate-800 text-white rounded-full px-6 py-3 shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 text-sm font-medium"
        size="lg"
      >
        <Phone className="h-4 w-4" />
        <span className="hidden sm:inline">
          Call ({phoneNumber.slice(0, 3)}) {phoneNumber.slice(3, 6)}-{phoneNumber.slice(6)}
        </span>
        <span className="sm:hidden">Call</span>
      </Button>

      {/* SMS Button */}
      <Button
        onClick={handleSMS}
        className="bg-slate-700 hover:bg-slate-800 text-white rounded-full px-6 py-3 shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 text-sm font-medium"
        size="lg"
      >
        <MessageCircle className="h-4 w-4" />
        <span className="hidden sm:inline">
          SMS ({smsNumber.slice(0, 3)}) {smsNumber.slice(3, 6)}-{smsNumber.slice(6)}
        </span>
        <span className="sm:hidden">SMS</span>
      </Button>
    </div>
  )
}
