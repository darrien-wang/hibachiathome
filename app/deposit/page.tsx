"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { CheckCircle, AlertCircle, ArrowRight } from "lucide-react"
import Link from "next/link"
import { getBookingDetails } from "@/app/actions/booking"
import type { PaymentMethod } from "@/types/payment"
import { paymentConfig } from "@/config/ui"

export default function DepositPaymentPage() {
  const searchParams = useSearchParams()
  const bookingId = searchParams.get("id") || "DEMO123"
  const [booking, setBooking] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("stripe")
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "success" | "error">("idle")
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [isPaymentSheetOpen, setIsPaymentSheetOpen] = useState(false)

  useEffect(() => {
    async function fetchBookingDetails() {
      if (!bookingId) {
        setError("Booking ID is missing. Please check if your link is complete.")
        setLoading(false)
        return
      }

      try {
        const result = await getBookingDetails(bookingId)
        if (result.success && result.data) {
          setBooking(result.data)
        } else {
          // For demo purposes, create a mock booking if real data fails
          setBooking({
            id: bookingId,
            full_name: "John Doe",
            event_date: "2023-12-25",
            event_time: "18:00",
            guest_adults: 10,
            guest_kids: 2,
            price_adult: 45,
            price_kid: 25,
            travel_fee: 50,
          })
        }
      } catch (err) {
        console.error(err)
        // For demo purposes, create a mock booking if real data fails
        setBooking({
          id: bookingId,
          full_name: "John Doe",
          event_date: "2023-12-25",
          event_time: "18:00",
          guest_adults: 10,
          guest_kids: 2,
          price_adult: 45,
          price_kid: 25,
          travel_fee: 50,
        })
      } finally {
        setLoading(false)
      }
    }

    fetchBookingDetails()
  }, [bookingId])

  const handlePayment = async () => {
    setIsPaymentSheetOpen(true)
  }

  const handlePaymentComplete = async () => {
    setPaymentStatus("success")
    setPaymentSuccess(true)
    setIsPaymentSheetOpen(false)
  }

  // 计算总金额
  const calculateTotalAmount = (booking: any) => {
    if (booking.total_cost) return booking.total_cost

    let total = 0

    // 基本费用
    total += booking.guest_adults * booking.price_adult
    total += booking.guest_kids * booking.price_kid

    // 旅行费用
    if (booking.travel_fee) {
      total += Number(booking.travel_fee)
    }

    // 高级蛋白质
    if (booking.premium_proteins && Array.isArray(booking.premium_proteins)) {
      booking.premium_proteins.forEach((item: any) => {
        total += item.quantity * item.unit_price
      })
    }

    // 附加服务
    if (booking.add_ons && Array.isArray(booking.add_ons)) {
      booking.add_ons.forEach((item: any) => {
        total += item.quantity * item.unit_price
      })
    }

    return total
  }

  // 计算押金金额
  const calculateDepositAmount = () => {
    // 固定押金金额为 $100
    return paymentConfig.depositAmount || 100
  }

  if (loading) {
    return (
      <div className="page-container container mx-auto px-4 py-12">
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
      <div className="page-container container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-6 text-center">
            <Button asChild>
              <Link href="/service-area">Contact Us</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const totalAmount = calculateTotalAmount(booking)
  const depositAmount = calculateDepositAmount()

  if (paymentSuccess) {
    return (
      <div className="page-container container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <Card className="border-green-100 bg-green-50/30">
            <CardContent className="pt-6 pb-6 text-center">
              <div className="mb-6 flex justify-center">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-4">Deposit Payment Successful!</h2>
              <p className="text-lg mb-6">
                We have received your deposit payment. Your booking is confirmed, and we will contact you soon to
                confirm the details.
              </p>
              <div className="bg-white p-6 rounded-lg border border-green-100 mb-6 text-left">
                <h3 className="text-xl font-semibold mb-4">Payment Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Booking ID:</span>
                    <span className="font-mono">{booking?.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Customer Name:</span>
                    <span>{booking?.full_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Event Date:</span>
                    <span>{booking?.event_date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Deposit Amount:</span>
                    <span className="font-bold">${depositAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Payment Method:</span>
                    <span>{paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}</span>
                  </div>
                </div>
              </div>
              <Button asChild className="bg-primary hover:bg-primary/90 rounded-full px-8">
                <Link href="/">Return to Home</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container container mx-auto px-4 py-12">
      <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-8 rounded-md shadow-sm max-w-3xl mx-auto">
        <div className="flex items-center">
          <CheckCircle className="h-6 w-6 text-green-500 mr-3" />
          <p className="text-green-700 font-medium text-lg">
            <span className="font-bold">48-Hour Free Cancellation Policy:</span> Cancel within 48 hours for a full
            refund with no penalty.
          </p>
        </div>
      </div>
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-4">Pay Booking Deposit</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Please pay the deposit to confirm your private hibachi party booking
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
            <CardDescription>Please confirm the following booking information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Booking ID</p>
                  <p className="font-medium">{booking?.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Customer Name</p>
                  <p className="font-medium">{booking?.full_name}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Event Date</p>
                  <p className="font-medium">{booking?.event_date}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Event Time</p>
                  <p className="font-medium">{booking?.event_time}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Number of Adults</p>
                  <p className="font-medium">{booking?.guest_adults} people</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Number of Children</p>
                  <p className="font-medium">{booking?.guest_kids} people</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Total Amount</p>
                  <p className="font-medium">${totalAmount.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Deposit Amount</p>
                  <p className="font-bold text-lg text-primary">${paymentConfig.depositAmount.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button
              onClick={() => (window.location.href = paymentConfig.stripePaymentLink)}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-xl py-3"
            >
              <div className="flex items-center justify-center">
                <img
                  src="https://b.stripecdn.com/manage-statics-srv/assets/public/favicon.ico"
                  alt="Stripe"
                  className="h-5 w-5 mr-2"
                />
                Pay Securely with Stripe ${depositAmount.toFixed(2)}
                <ArrowRight className="ml-2 h-4 w-4" />
              </div>
            </Button>

            <div className="text-sm text-gray-600 mt-4 space-y-4">
              <p className="text-center font-medium">
                By paying the deposit, you agree to our{" "}
                <Link href="/terms" className="text-primary hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/cancellation-policy" className="text-primary hover:underline">
                  Cancellation Policy
                </Link>
                .
              </p>

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-xs">
                <h4 className="font-semibold mb-2">Important Policies:</h4>

                <p className="mb-2">
                  <span className="font-semibold">Liability Waiver:</span> Real Hibachi, Inc. will NOT be liable for
                  property damage caused during events. The host waives any claims against Real Hibachi for loss,
                  damage, or destruction of property.
                </p>

                <p className="mb-2">
                  <span className="font-semibold">Communication Consent:</span> By proceeding, you agree to receive
                  communications by text message about your booking. You may opt-out by replying STOP.
                </p>

                <p className="mb-2">
                  <span className="font-semibold">Cancellation Policy:</span> Notify us within 48 hours of your event to
                  cancel or reschedule and receive a full refund of your deposit with no penalty fees.
                </p>

                <p>
                  <span className="font-semibold">Weather Policy:</span> If it rains, customer must provide covering for
                  the chef. Customer is responsible for canceling due to inclement weather within 48 hours of your
                  party.
                </p>
              </div>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
