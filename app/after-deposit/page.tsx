"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle, Calendar, Clock, Users, DollarSign, ArrowRight } from "lucide-react"
import Link from "next/link"
import { getBookingDetails } from "@/app/actions/booking"
import { formatDate } from "@/lib/utils"

export default function AfterDepositPage() {
  const searchParams = useSearchParams()
  const bookingId = searchParams.get("id")
  const [booking, setBooking] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchBookingDetails() {
      if (!bookingId) {
        setError("Booking ID is missing. Please check your confirmation email for the correct link.")
        setLoading(false)
        return
      }

      try {
        const result = await getBookingDetails(bookingId)
        if (result.success && result.data) {
          setBooking(result.data)
        } else {
          setError("Unable to find your booking details. Please contact our support team.")
        }
      } catch (err) {
        console.error(err)
        setError("An error occurred while retrieving your booking details.")
      } finally {
        setLoading(false)
      }
    }

    fetchBookingDetails()
  }, [bookingId])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 pt-24 mt-16">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12 pt-24 mt-16">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-6">Deposit Confirmation</h1>
          <Card className="border-red-100">
            <CardContent className="pt-6 pb-6">
              <div className="text-center mb-6">
                <div className="inline-flex h-12 w-12 rounded-full bg-red-100 items-center justify-center">
                  <span className="text-red-600 text-xl">!</span>
                </div>
              </div>
              <h2 className="text-xl font-semibold mb-4 text-center">Error</h2>
              <p className="text-center mb-6">{error}</p>
              <div className="flex justify-center">
                <Button asChild>
                  <Link href="/contact">Contact Support</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-12 pt-24 mt-16">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-4">Thank You for Your Deposit!</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Your hibachi party is confirmed and we're excited to serve you
          </p>
        </div>

        <Card className="border-green-100 bg-green-50/30 mb-8">
          <CardContent className="pt-6 pb-6">
            <div className="mb-6 flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-4 text-center">Booking Confirmed!</h2>
            <p className="text-lg mb-6 text-center">
              We have received your deposit payment of ${booking?.deposit || 100}.00
            </p>

            <div className="bg-white p-6 rounded-lg border border-green-100 mb-6">
              <h3 className="text-xl font-semibold mb-4">Booking Details</h3>
              <div className="space-y-4">
                <div className="flex items-start">
                  <Calendar className="h-5 w-5 mr-3 text-gray-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Event Date</p>
                    <p className="text-gray-600">
                      {booking?.event_date ? formatDate(booking.event_date) : "Not specified"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <Clock className="h-5 w-5 mr-3 text-gray-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Event Time</p>
                    <p className="text-gray-600">{booking?.event_time || "Not specified"}</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <Users className="h-5 w-5 mr-3 text-gray-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Guest Count</p>
                    <p className="text-gray-600">
                      {booking?.guest_adults || 0} Adults, {booking?.guest_kids || 0} Children
                    </p>
                  </div>
                </div>

                <div className="flex items-start">
                  <DollarSign className="h-5 w-5 mr-3 text-gray-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Total Amount</p>
                    <p className="text-gray-600">${booking?.total_cost?.toFixed(2) || "Calculated on event day"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 p-6 rounded-lg border border-amber-100 mb-6">
              <h3 className="text-lg font-semibold mb-2 flex items-center">
                <span className="inline-block h-6 w-6 rounded-full bg-amber-100 flex items-center justify-center mr-2">
                  <span className="text-amber-600 text-sm">i</span>
                </span>
                Next Steps
              </h3>
              <ul className="list-disc list-inside space-y-2 text-gray-700">
                <li>Our team will contact you within 24-48 hours to confirm all details</li>
                <li>We'll send a reminder 3 days before your event</li>
                <li>The remaining balance will be due on the day of your event</li>
                <li>Remember our 48-hour free cancellation policy if your plans change</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild className="bg-primary hover:bg-primary/90 rounded-full px-8">
                <Link href="/">
                  Return to Home <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full px-8">
                <Link href="/contact">Contact Us</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-gray-500 text-sm">
          <p>A confirmation email has been sent to your email address.</p>
          <p className="mt-2">
            Booking Reference: <span className="font-mono font-medium">{bookingId || "Unknown"}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
