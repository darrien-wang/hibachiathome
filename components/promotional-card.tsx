import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function PromotionalCard() {
  return (
    <div className="max-w-md mx-auto my-12 bg-white rounded-lg shadow-xl overflow-hidden">
      <div className="p-6 text-center">
        <div className="text-4xl mb-4">🦞</div>
        <h3 className="text-2xl font-bold text-gray-800 mb-3">Limited Time Offer!</h3>
        <p className="text-gray-600 mb-4 leading-relaxed">
          Book now and get a <span className="font-bold text-amber-600">FREE lobster protein upgrade</span> for one
          lucky guest at every party!
        </p>
        <p className="text-xs text-gray-500 mt-3">*Valid for new bookings only. One upgrade per party.</p>
      </div>
    </div>
  )
}
