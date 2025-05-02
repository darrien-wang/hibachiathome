"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { CalendarIcon, MessageSquare, CheckCircle, AlertCircle } from "lucide-react"
import { format } from "date-fns"
import { createBookingWithOrder } from "../actions/booking"
import type { Reservation } from "@/types/booking"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// Time slots available for booking
const timeSlots = [
  "1:00 PM",
  "1:30 PM",
  "2:00 PM",
  "2:30 PM",
  "3:00 PM",
  "3:30 PM",
  "4:00 PM",
  "4:30 PM",
  "5:00 PM",
  "5:30 PM",
  "6:00 PM",
  "6:30 PM",
  "7:00 PM",
  "7:30 PM",
  "8:00 PM",
  "8:30 PM",
  "9:00 PM",
]

// Calculate tomorrow's date for minimum booking date
const tomorrow = new Date()
tomorrow.setDate(tomorrow.getDate() + 1)
tomorrow.setHours(0, 0, 0, 0) // Set to beginning of the day to avoid time issues

export default function BookingPage() {
  const [date, setDate] = useState<Date | undefined>(undefined)
  const [headcount, setHeadcount] = useState(8)
  const [selectedTime, setSelectedTime] = useState<string>("")
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    message: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{
    success: boolean
    message: string
    reservationId?: string
  } | null>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [id]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!date || !selectedTime) {
      // Replace the browser alert with setting a validation error message
      setSubmitResult({
        success: false,
        message: "Please select a date and time for your booking",
      })
      return
    }

    setIsSubmitting(true)
    setSubmitResult(null)

    try {
      // 准备预订数据
      const reservationData: Reservation = {
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.phone,
        headcount: headcount,
        event_date: format(date, "yyyy-MM-dd"),
        event_time: selectedTime,
        address: formData.address,
        special_requests: formData.message || undefined,
        status: "pending",
      }

      // 创建一个简单的订单数据（实际应用中，这应该来自购物车或套餐选择）
      const orderData = {
        package_id: "standard", // 默认套餐
        total_price: headcount * 60, // 简单计算，每人 $60
        items: [
          {
            item_type: "package",
            item_id: "standard",
            quantity: 1,
            price: headcount * 60,
          },
        ],
        participants: [
          {
            name: formData.name,
            is_host: true,
            selections: [],
          },
        ],
      }

      // 调用服务器操作创建预订和订单
      const result = await createBookingWithOrder(reservationData, orderData)

      if (result.success && result.data) {
        setSubmitResult({
          success: true,
          message: "Your booking has been successfully submitted! We'll contact you shortly to confirm details.",
          reservationId: result.data.reservation.id,
        })

        // 重置表单
        setFormData({
          name: "",
          email: "",
          phone: "",
          address: "",
          message: "",
        })
        setDate(undefined)
        setSelectedTime("")
        setHeadcount(8)
      } else {
        setSubmitResult({
          success: false,
          message: result.error || "There was an error submitting your booking. Please try again.",
        })
      }
    } catch (error) {
      console.error("Error submitting booking:", error)
      setSubmitResult({
        success: false,
        message: "There was an error submitting your booking. Please try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Add this useEffect to scroll to the alert when it appears
  useEffect(() => {
    if (submitResult) {
      // Scroll to the top of the form where the alert is displayed
      window.scrollTo({
        top: document.querySelector(".alert-container")?.offsetTop || 0,
        behavior: "smooth",
      })
    }
  }, [submitResult])

  return (
    <div className="container mx-auto px-4 pt-24 pb-12 mt-16">
      <div className="max-w-4xl mx-auto alert-container">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-4">Book Your Hibachi Experience</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Fill out the form below to request a booking, or contact us directly via WhatsApp or SMS for faster service.
          </p>
        </div>

        {submitResult && (
          <div className="animate-fadeIn">
            <Alert
              className={`mb-6 ${
                submitResult.success
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-red-50 border-red-200 text-red-800"
              } shadow-sm transition-all duration-300`}
            >
              {submitResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              <AlertTitle className="text-lg font-medium">{submitResult.success ? "Success!" : "Error"}</AlertTitle>
              <AlertDescription className="mt-2">
                {submitResult.message}
                {submitResult.success && submitResult.reservationId && (
                  <p className="mt-2 text-sm font-medium">Reservation ID: {submitResult.reservationId}</p>
                )}
              </AlertDescription>
            </Alert>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <Card className="text-center">
            <CardHeader>
              <CardTitle>WhatsApp</CardTitle>
              <CardDescription>Fastest response time</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline" asChild>
                <a
                  href="https://wa.me/15627134832?text=Hello%2C%20I%20would%20like%20to%20book%20a%20hibachi%20experience"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Message via WhatsApp
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <CardTitle>SMS</CardTitle>
              <CardDescription>Text us directly</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline" asChild>
                <a href="sms:15627134832?body=I'm%20interested%20in%20booking%20a%20hibachi%20experience">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Send SMS
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <CardTitle>Phone</CardTitle>
              <CardDescription>Speak with us</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline" asChild>
                <a href="tel:5627134832">562-713-4832</a>
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Booking Request Form</CardTitle>
            <CardDescription>
              Fill out all details to request your booking. We'll contact you to confirm availability.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="Your full name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={formData.email}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    placeholder="123-456-789"
                    required
                    value={formData.phone}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="headcount">Number of Guests </Label>
                  <div className="flex items-center">
                    <Input
                      id="headcount"
                      type="number"
                      min={1}
                      max={120}
                      value={headcount}
                      onChange={(e) => setHeadcount(Number.parseInt(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Preferred Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : "Select a date (min. 1 day in advance)"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        initialFocus
                        disabled={(date) => {
                          const now = new Date()
                          now.setHours(0, 0, 0, 0) // Set to beginning of the day
                          // Disable today and past dates
                          return date < tomorrow
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="time">Preferred Time</Label>
                  <Select value={selectedTime} onValueChange={setSelectedTime}>
                    <SelectTrigger id="time">
                      <SelectValue placeholder="Select a time" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Address for Service</Label>
                  <Textarea
                    id="address"
                    placeholder="Full address where you'd like the hibachi service"
                    rows={3}
                    required
                    value={formData.address}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="message">Special Requests or Notes</Label>
                  <Textarea
                    id="message"
                    placeholder="Any dietary restrictions, special occasions, or other requests"
                    rows={4}
                    value={formData.message}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-2 rounded-md transition-all duration-300 shadow-sm hover:shadow-md"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Submitting...
                  </span>
                ) : (
                  "Submit Booking Request"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
