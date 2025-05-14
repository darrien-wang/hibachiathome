"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { CheckCircle, AlertCircle, ArrowRight, CreditCard, Smartphone } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { processPayment } from "@/app/actions/payment"
import { getBookingDetails } from "@/app/actions/booking"
import type { PaymentMethod } from "@/types/payment"

export default function DepositPaymentPage() {
  const searchParams = useSearchParams()
  const bookingId = searchParams.get("id")
  const [booking, setBooking] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("stripe")
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "success" | "error">("idle")
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [paymentSuccess, setPaymentSuccess] = useState(false)

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
          setError(result.error || "Unable to retrieve booking details")
        }
      } catch (err) {
        setError("Error retrieving booking information")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchBookingDetails()
  }, [bookingId])

  const handlePayment = async () => {
    if (!booking || !bookingId) return

    setPaymentStatus("processing")
    setPaymentError(null)

    try {
      const depositAmount = calculateDepositAmount(calculateTotalAmount(booking))
      const result = await processPayment({
        bookingId,
        amount: depositAmount,
        method: paymentMethod,
      })

      if (result.success) {
        setPaymentStatus("success")
        setPaymentSuccess(true)
      } else {
        setPaymentStatus("error")
        setPaymentError(result.error || "Payment processing failed")
      }
    } catch (err: any) {
      setPaymentStatus("error")
      setPaymentError(err.message || "An error occurred during payment processing")
      console.error(err)
    }
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
  const calculateDepositAmount = (totalAmount: number) => {
    // 押金为总金额的 20%，最低 $100
    return Math.max(totalAmount * 0.2, 100)
  }

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
        <div className="max-w-3xl mx-auto">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>错误</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-6 text-center">
            <Button asChild>
              <Link href="/contact">联系我们</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const totalAmount = calculateTotalAmount(booking)
  const depositAmount = calculateDepositAmount(totalAmount)

  if (paymentSuccess) {
    return (
      <div className="container mx-auto px-4 py-12 pt-24 mt-16">
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
    <div className="container mx-auto px-4 py-12 pt-24 mt-16">
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
                  <p className="text-sm text-gray-500">Deposit Amount (20%)</p>
                  <p className="font-bold text-lg text-primary">${depositAmount.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </CardContent>

          <CardHeader>
            <CardTitle>Select Payment Method</CardTitle>
            <CardDescription>We accept multiple payment methods</CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs defaultValue="stripe" onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
              <TabsList className="grid grid-cols-4 mb-6">
                <TabsTrigger value="stripe">
                  <div className="flex flex-col items-center">
                    <CreditCard className="h-4 w-4 mb-1" />
                    <span>Credit Card</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger value="square">
                  <div className="flex flex-col items-center">
                    <Image src="/square-logo.png" alt="Square" width={16} height={16} className="mb-1" />
                    <span>Square</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger value="venmo">
                  <div className="flex flex-col items-center">
                    <Smartphone className="h-4 w-4 mb-1" />
                    <span>Venmo</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger value="zelle">
                  <div className="flex flex-col items-center">
                    <Image src="/zelle-logo.png" alt="Zelle" width={16} height={16} className="mb-1" />
                    <span>Zelle</span>
                  </div>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="stripe">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium mb-2">Credit Card Payment</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Securely pay with your credit or debit card. We accept Visa, Mastercard, American Express, and
                    Discover.
                  </p>
                  <div className="flex space-x-2 mb-4">
                    <Image src="/visa-logo.png" alt="Visa" width={40} height={24} />
                    <Image src="/mastercard-logo.png" alt="Mastercard" width={40} height={24} />
                    <Image src="/amex-logo.png" alt="American Express" width={40} height={24} />
                    <Image src="/discover-logo.png" alt="Discover" width={40} height={24} />
                  </div>
                  <Button onClick={handlePayment} disabled={paymentStatus === "processing"} className="w-full">
                    {paymentStatus === "processing" ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        Pay Deposit ${depositAmount.toFixed(2)}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </div>
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="square">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium mb-2">Square Payment</h3>
                  <p className="text-sm text-gray-600 mb-4">Pay securely with your Square account.</p>
                  <Button onClick={handlePayment} disabled={paymentStatus === "processing"} className="w-full">
                    {paymentStatus === "processing" ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        Pay with Square
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </div>
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="venmo">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium mb-2">Venmo Payment</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Send payment to us using your Venmo account. Please include your booking ID in the notes.
                  </p>
                  <div className="mb-4">
                    <p className="text-sm font-medium">Venmo Username:</p>
                    <p className="font-mono bg-white p-2 rounded border">@HibachiChef</p>
                  </div>
                  <Button onClick={handlePayment} disabled={paymentStatus === "processing"} className="w-full">
                    {paymentStatus === "processing" ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        Open Venmo App
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </div>
                    )}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="zelle">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium mb-2">Zelle Payment</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Send payment to us using Zelle. Please include your booking ID in the notes.
                  </p>
                  <div className="space-y-2 mb-4">
                    <div>
                      <p className="text-sm font-medium">Zelle Email:</p>
                      <p className="font-mono bg-white p-2 rounded border">payments@hibachichef.com</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Zelle Phone:</p>
                      <p className="font-mono bg-white p-2 rounded border">(555) 123-4567</p>
                    </div>
                  </div>
                  <Button onClick={handlePayment} disabled={paymentStatus === "processing"} className="w-full">
                    {paymentStatus === "processing" ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        Open Zelle App
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </div>
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            {paymentError && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Payment Error</AlertTitle>
                <AlertDescription>{paymentError}</AlertDescription>
              </Alert>
            )}
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <p className="text-sm text-gray-500">
              By paying the deposit, you agree to our
              <Link href="/terms" className="text-primary hover:underline">
                Terms of Service
              </Link>
              and
              <Link href="/cancellation-policy" className="text-primary hover:underline">
                Cancellation Policy
              </Link>
              .
            </p>
            <p className="text-sm text-gray-500">
              If you have any questions, please
              <Link href="/contact" className="text-primary hover:underline">
                contact us
              </Link>
              .
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
