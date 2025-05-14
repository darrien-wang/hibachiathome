"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle } from "lucide-react"
import Link from "next/link"

interface OrderData {
  id: string
  full_name: string
  event_date: string
  event_time: string
  total_amount: number
}

interface BookingSuccessProps {
  orderData: OrderData | null
  totalGuests: number
}

export default function BookingSuccess({ orderData, totalGuests }: BookingSuccessProps) {
  return (
    <Card className="border-green-100 bg-green-50/30">
      <CardContent className="pt-6 pb-6 text-center" spacing="default">
        <div className="mb-6 flex justify-center">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>
        <h2 className="text-2xl font-bold mb-4">Thank You for Your Booking!</h2>
        <p className="text-lg mb-6">
          We've received your hibachi party request and will get back to you within 24 hours to confirm all details.
        </p>
        <div className="bg-white p-6 rounded-lg border border-green-100 mb-6 text-left">
          <h3 className="text-xl font-semibold mb-4">Booking Summary</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Booking ID:</span>
              <span className="font-mono">{orderData?.id || "Processing..."}</span>
            </div>
            <div className="flex justify-between">
              <span>Name:</span>
              <span>{orderData?.full_name}</span>
            </div>
            <div className="flex justify-between">
              <span>Event Date:</span>
              <span>{orderData?.event_date}</span>
            </div>
            <div className="flex justify-between">
              <span>Event Time:</span>
              <span>{orderData?.event_time}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Guests:</span>
              <span>{totalGuests} people</span>
            </div>
            <div className="flex justify-between">
              <span>Total Amount:</span>
              <span className="font-bold">${orderData?.total_amount.toFixed(2)}</span>
            </div>
          </div>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90 rounded-full px-8">
          <Link href={`/deposit?id=${orderData?.id}`}>Pay Deposit Now</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
