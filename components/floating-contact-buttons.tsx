"use client"

import { Phone, MessageCircle } from "lucide-react"

export default function FloatingContactButtons() {
  const handleCall = () => {
    window.location.href = "tel:2137707788"
  }

  const handleSMS = () => {
    window.location.href = "sms:5627134832"
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      {/* Phone Button */}
      <button
        onClick={handleCall}
        className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 group"
        aria-label="Call us"
      >
        <Phone className="w-5 h-5" />
        <span className="hidden sm:inline text-sm font-medium">(213) 770-7788</span>
        <span className="sm:hidden text-sm font-medium">Call</span>
      </button>

      {/* SMS Button */}
      <button
        onClick={handleSMS}
        className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2 group"
        aria-label="Send SMS"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="hidden sm:inline text-sm font-medium">SMS (562) 713-4832</span>
        <span className="sm:hidden text-sm font-medium">SMS</span>
      </button>
    </div>
  )
}
