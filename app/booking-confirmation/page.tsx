"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { createClientComponentClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { format } from "date-fns"
import { CheckCircle } from "lucide-react"

export default function BookingConfirmationPage() {
  const searchParams = useSearchParams()
  const reservationId = searchParams.get("id")
  const [reservation, setReservation] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchReservation() {
      if (!reservationId) {
        setError("No reservation ID provided")
        setLoading(false)
        return
      }

      try {
        const supabase = createClientComponentClient()
        const { data, error } = await supabase
          .from("reservations")
          .select(`
            *,
            orders (*)
          `)
          .eq("id", reservationId)
          .single()

        if (error) {
          throw error
        }

        setReservation(data)
      } catch (error) {
        console.error("Error fetching reservation:", error)
        setError("Failed to load reservation details")
      } finally {
        setLoading(false)
      }
    }

    fetchReservation()
  }, [reservationId])

  if (loading) {
    return (
      <div className="page-container container max-w-4xl mx-auto py-12 px-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p>Loading reservation details...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !reservation) {
    return (
      <div className="page-container container max-w-4xl mx-auto py-12 px-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-red-500">{error || "Reservation not found"}</p>
              <Button asChild className="mt-4">
                <Link href="/">Return to Home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="page-container container max-w-4xl mx-auto py-12 px-4">
      <Card className="border-green-200 bg-green-50">
        <CardHeader className="text-center border-b border-green-200 bg-green-100">
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-green-600" />
          </div>
          <CardTitle className="text-2xl text-green-800">Booking Confirmed!</CardTitle>
          <p className="text-green-700">Your hibachi experience has been successfully booked.</p>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="bg-white p-6 rounded-lg border border-green-200">
            <h3 className="font-semibold text-lg mb-4">Reservation Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Reservation ID</p>
                <p className="font-medium">{reservation.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="font-medium capitalize">{reservation.status}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Date & Time</p>
                <p className="font-medium">
                  {format(new Date(reservation.event_date), "MMMM d, yyyy")} at {reservation.event_time}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Number of Guests</p>
                <p className="font-medium">{reservation.headcount} people</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Package</p>
                <p className="font-medium capitalize">{reservation.orders?.[0]?.package_id || "Basic"} Package</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Price</p>
                <p className="font-medium">${reservation.final_price}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-gray-500">Location</p>
                <p className="font-medium">{reservation.address}</p>
                <p className="font-medium">ZIP: {reservation.zipcode}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-green-200">
            <h3 className="font-semibold text-lg mb-4">What's Next?</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-700">
              <li>Our team will review your booking and confirm availability.</li>
              <li>You'll receive a confirmation email within 24 hours.</li>
              <li>Our chef will contact you 1-2 days before your event to confirm details.</li>
              <li>Prepare to enjoy an amazing hibachi experience!</li>
            </ol>
          </div>

          <div className="flex justify-center space-x-4">
            <Button asChild variant="outline">
              <Link href="/">Return to Home</Link>
            </Button>
            <Button asChild>
              <Link href="/contact">Contact Us</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
