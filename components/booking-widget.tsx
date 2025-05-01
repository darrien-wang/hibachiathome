"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { MessageSquare, X } from "lucide-react"

export default function BookingWidget() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-6 left-6 z-40">
        <Button onClick={() => setIsOpen(true)} className="h-14 w-14 rounded-full shadow-lg" size="icon">
          <MessageSquare className="h-6 w-6" />
          <span className="sr-only">Book Now</span>
        </Button>
      </div>

      {/* Booking widget */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 z-50 w-full sm:w-96 bg-white shadow-xl rounded-t-lg sm:rounded-lg sm:bottom-6 sm:right-6 overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b">
            <h3 className="font-serif font-bold text-lg">Quick Booking</h3>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
          <div className="p-4">
            <p className="text-sm text-gray-600 mb-4">
              For the fastest response, message us directly to book your hibachi experience:
            </p>
            <div className="space-y-4">
              <Button className="w-full" variant="outline">
                <MessageSquare className="mr-2 h-4 w-4" />
                Message via WhatsApp
              </Button>
              <Button className="w-full" variant="outline">
                <MessageSquare className="mr-2 h-4 w-4" />
                Send SMS
              </Button>
              <div className="text-center text-sm text-gray-500">
                <p>- or -</p>
              </div>
              <Button className="w-full" asChild>
                <a href="/book">Fill out booking form</a>
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
