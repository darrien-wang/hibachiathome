"use client"

import type React from "react"

import { CheckCircle, Calendar, Clock, Users, DollarSign, Lock, CreditCard } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { format } from "date-fns"

type BookingSuccessProps = {
  orderData: {
    id: string
    full_name: string
    event_date: string
    event_time: string
    total_amount: number
  } | null
  totalGuests: number
}

export default function BookingSuccess({ orderData, totalGuests }: BookingSuccessProps) {
  const [showLeadForm, setShowLeadForm] = useState(false)
  const [leadName, setLeadName] = useState("")
  const [leadPhone, setLeadPhone] = useState("")
  const [leadSubmitted, setLeadSubmitted] = useState(false)

  const depositAmount = 100.0
  const formattedDate = orderData?.event_date ? format(new Date(orderData.event_date), "MMMM d, yyyy") : "May 22, 2025"

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Here you would normally send this lead information to your backend
    console.log("Lead submitted:", { name: leadName, phone: leadPhone })
    setLeadSubmitted(true)
  }

  return (
    <Card className="border-amber-100 bg-amber-50/30">
      <CardContent className="pt-6 pb-6">
        <h2 className="text-2xl font-bold text-center mb-6">Secure Your Hibachi Party with a Deposit</h2>

        {/* Confirmation Summary Section */}
        <div className="bg-white rounded-lg p-6 mb-6 border border-gray-200 shadow-sm">
          <h3 className="text-xl font-semibold mb-4 text-center">🎉 You're almost done!</h3>
          <p className="text-center mb-4">Here's a summary of your booking request:</p>

          <div className="space-y-2 max-w-md mx-auto">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <Calendar className="h-5 w-5 mr-2 text-[#E4572E]" />
                <span className="text-gray-700">Date:</span>
              </div>
              <span className="font-medium">{formattedDate}</span>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <Clock className="h-5 w-5 mr-2 text-[#E4572E]" />
                <span className="text-gray-700">Time:</span>
              </div>
              <span className="font-medium">{orderData?.event_time || "7:00 PM"}</span>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <Users className="h-5 w-5 mr-2 text-[#E4572E]" />
                <span className="text-gray-700">Guests:</span>
              </div>
              <span className="font-medium">{totalGuests}</span>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <DollarSign className="h-5 w-5 mr-2 text-[#E4572E]" />
                <span className="text-gray-700">Estimated Total:</span>
              </div>
              <span className="font-medium">${orderData?.total_amount.toFixed(2) || "574.00"}</span>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-gray-200 mt-2">
              <div className="flex items-center">
                <DollarSign className="h-5 w-5 mr-2 text-[#E4572E]" />
                <span className="text-gray-700 font-semibold">Deposit Required:</span>
              </div>
              <span className="font-bold">${depositAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Why Deposit Section */}
        <div className="bg-white rounded-lg p-6 mb-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-center mb-4">
            <Lock className="h-6 w-6 mr-2 text-[#E4572E]" />
            <h3 className="text-lg font-semibold">Why do we ask for a deposit?</h3>
          </div>

          <ul className="space-y-2 max-w-md mx-auto">
            <li className="flex items-start">
              <CheckCircle className="h-5 w-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" />
              <span>This secures your chef and blocks your date</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="h-5 w-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" />
              <span>Fully refundable up to 72 hours before the event</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="h-5 w-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" />
              <span>We'll reach out within 24 hours to confirm everything</span>
            </li>
          </ul>

          <p className="text-center mt-4 text-gray-600 italic">
            Need to make changes later? No problem — we're flexible!
          </p>
        </div>

        {/* Payment Button Section */}
        <div className="text-center mb-6">
          <Button
            className="w-full max-w-md py-6 text-lg bg-[#E4572E] hover:bg-[#D64545] mb-2"
            onClick={() => (window.location.href = `/deposit?order=${orderData?.id || "demo"}`)}
          >
            <CreditCard className="mr-2 h-5 w-5" />
            Confirm and Pay ${depositAmount.toFixed(2)} Deposit
          </Button>

          <p className="text-sm text-gray-500">💳 Powered by Stripe • Secure & Encrypted</p>
        </div>

        {/* Legal Text */}
        <div className="text-xs text-gray-500 text-center max-w-md mx-auto mb-8">
          <p className="mb-1">By paying the deposit, you are confirming your request for this event.</p>
          <p>
            If for any reason you need to cancel, you will receive a full refund if cancelled at least 72 hours before
            your event.
            <a href="/faq" className="text-[#E4572E] hover:underline ml-1">
              Learn more
            </a>
          </p>
        </div>

        {/* Alternative Option */}
        {!leadSubmitted ? (
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="font-medium text-center mb-3">❓ Not ready to pay now?</h4>
            <p className="text-sm text-center mb-4">
              We can hold your quote for 24 hours. Leave your name and number below and we'll follow up.
            </p>

            {!showLeadForm ? (
              <div className="text-center">
                <Button variant="outline" className="border-gray-300" onClick={() => setShowLeadForm(true)}>
                  Hold My Spot
                </Button>
              </div>
            ) : (
              <form onSubmit={handleLeadSubmit} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Your Name"
                    className="px-3 py-2 border border-gray-300 rounded-md"
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    required
                  />
                  <input
                    type="tel"
                    placeholder="Phone Number"
                    className="px-3 py-2 border border-gray-300 rounded-md"
                    value={leadPhone}
                    onChange={(e) => setLeadPhone(e.target.value)}
                    required
                  />
                </div>
                <div className="text-center">
                  <Button
                    type="submit"
                    variant="outline"
                    className="border-[#E4572E] text-[#E4572E] hover:bg-[#E4572E] hover:text-white"
                  >
                    📩 Hold My Spot
                  </Button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div className="bg-green-50 rounded-lg p-4 border border-green-200 text-center">
            <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-2" />
            <h4 className="font-medium mb-1">Thank you!</h4>
            <p className="text-sm">
              We've received your information and will contact you within 24 hours to confirm your booking details.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
