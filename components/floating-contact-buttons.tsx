"use client"

import { Phone, MessageCircle, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"

export function FloatingContactButtons() {
  const phoneNumber = "2137707788"
  const smsNumber = "5627134832"
  const emailAddress = "realhibachiathome@gmail.com"

  const handleCall = () => {
    window.location.href = `tel:${phoneNumber}`
  }

  const handleSMS = () => {
    window.location.href = `sms:${smsNumber}`
  }

  const handleEmail = () => {
    window.location.href = `mailto:${emailAddress}`
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 items-end">
      {/* Phone Button */}
      <Button
        onClick={handleCall}
        className="bg-slate-700 hover:bg-green-600 text-white rounded-full px-6 py-3 shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 text-sm font-medium group min-w-[4rem] hover:min-w-max"
        size="lg"
      >
        <Phone className="h-4 w-4 flex-shrink-0" />
        <span className="hidden sm:inline">
          Call ({phoneNumber.slice(0, 3)}) {phoneNumber.slice(3, 6)}-{phoneNumber.slice(6)}
        </span>
        <span className="sm:hidden group-hover:hidden">Call</span>
        <span className="hidden group-hover:inline sm:hidden whitespace-nowrap text-xs">
          ({phoneNumber.slice(0, 3)}) {phoneNumber.slice(3, 6)}-{phoneNumber.slice(6)}
        </span>
      </Button>

      {/* SMS Button */}
      <Button
        onClick={handleSMS}
        className="bg-slate-700 hover:bg-blue-600 text-white rounded-full px-6 py-3 shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 text-sm font-medium group min-w-[4rem] hover:min-w-max"
        size="lg"
      >
        <MessageCircle className="h-4 w-4 flex-shrink-0" />
        <span className="hidden sm:inline">
          SMS ({smsNumber.slice(0, 3)}) {smsNumber.slice(3, 6)}-{smsNumber.slice(6)}
        </span>
        <span className="sm:hidden group-hover:hidden">SMS</span>
        <span className="hidden group-hover:inline sm:hidden whitespace-nowrap text-xs">
          ({smsNumber.slice(0, 3)}) {smsNumber.slice(3, 6)}-{smsNumber.slice(6)}
        </span>
      </Button>

      {/* Email Button */}
      <Button
        onClick={handleEmail}
        className="bg-slate-700 hover:bg-amber-600 text-white rounded-full px-6 py-3 shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 text-sm font-medium group min-w-[4rem] hover:min-w-max"
        size="lg"
      >
        <Mail className="h-4 w-4 flex-shrink-0" />
        <span className="hidden sm:inline">{emailAddress}</span>
        <span className="sm:hidden group-hover:hidden">Email</span>
        <span className="hidden group-hover:inline sm:hidden whitespace-nowrap text-xs">{emailAddress}</span>
      </Button>
    </div>
  )
}
