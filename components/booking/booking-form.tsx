"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowDown } from "lucide-react"
import { format } from "date-fns"
import dynamic from "next/dynamic"
import type { DateTimeSelection } from "@/types/booking"
import { TermsModal } from "@/components/booking/terms-modal"

const DynamicPricingCalendar = dynamic(() => import("@/components/booking/dynamic-pricing-calendar"), {
  loading: () => <div className="animate-pulse bg-gray-100 h-[400px] rounded-lg" />,
  ssr: false,
})

interface BookingFormProps {
  formData: {
    name: string
    email: string
    phone: string
    address: string
    message: string
    agreeToTerms: boolean
    zipcode: string
  }
  costs: {
    subtotal: number
    travelFee: number
    total: number
  }
  selectedDateTime: DateTimeSelection
  isSubmitting: boolean
  orderError: string
  isOrderFormValid: boolean
  onSubmit: (e: React.FormEvent) => void
  onInputChange: (field: string, value: string) => void
  onCheckboxChange: (checked: boolean) => void
  onDateTimeSelect: (date: Date | undefined, time: string | undefined, price: number, originalPrice: number) => void
  totalGuests: number
}

interface TermsCheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  onShowTerms?: () => void
}

export function TermsCheckbox({ checked, onChange, onShowTerms }: TermsCheckboxProps) {
  return (
    <div className="flex items-start space-x-2">
      <Checkbox
        id="agreeToTerms"
        checked={checked}
        onCheckedChange={(checked) => onChange(checked === true)}
        required
      />
      <div className="grid gap-1.5 leading-none">
        <label
          htmlFor="agreeToTerms"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          I agree to the{" "}
          <button
            type="button"
            onClick={onShowTerms}
            className="text-primary hover:underline focus:outline-none"
          >
            terms and conditions
          </button>
        </label>
        <p className="text-sm text-gray-500">
          By submitting this form, you agree to be contacted about your hibachi experience.
        </p>
      </div>
    </div>
  )
}

export default function BookingForm({
  formData,
  costs,
  selectedDateTime,
  isSubmitting,
  orderError,
  isOrderFormValid,
  onSubmit,
  onInputChange,
  onCheckboxChange,
  onDateTimeSelect,
  totalGuests,
}: BookingFormProps) {
  const [showTerms, setShowTerms] = useState(false)

  const handleDateTimeSelect = (
    date: Date | undefined,
    time: string | undefined,
    price: number,
    originalPrice: number,
  ) => {
    onDateTimeSelect(date, time, price, originalPrice)
  }

  return (
    <div id="order-form" className="scroll-mt-24">
      <div className="flex justify-center my-8">
        <div className="flex flex-col items-center">
          <ArrowDown className="h-8 w-8 text-primary animate-bounce" />
          <p className="text-lg font-medium mt-2">Please Fill Your Information Below</p>
        </div>
      </div>

      <Card>
        <CardHeader className="bg-primary/5 border-b p-6">
          <CardTitle className="text-2xl">Complete Your Booking</CardTitle>
          <p className="text-gray-600 mt-2">
            Please provide your contact information and event details to finalize your hibachi party reservation.
          </p>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name*</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => onInputChange("name", e.target.value)}
                  required
                  placeholder="Your full name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address*</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => onInputChange("email", e.target.value)}
                  required
                  placeholder="your.email@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number*</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => onInputChange("phone", e.target.value)}
                  required
                  placeholder="(123) 456-7890"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Full Address*</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => onInputChange("address", e.target.value)}
                  required
                  placeholder="Street address, city, state"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Special Requests or Notes</Label>
              <textarea
                id="message"
                className="w-full min-h-[100px] p-2 border rounded-md"
                value={formData.message}
                onChange={(e) => onInputChange("message", e.target.value)}
                placeholder="Dietary restrictions, special occasions, or other requests"
              />
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Select Date & Time</h3>
              <p className="text-sm text-gray-500 mb-4">
                Choose from available dates and times. Green dates indicate special pricing!
              </p>
              {formData.zipcode && formData.zipcode.length === 5 && (
                <DynamicPricingCalendar
                  key={`calendar-${formData.zipcode}-${totalGuests}`}
                  onSelectDateTime={handleDateTimeSelect}
                  packageType="basic"
                  headcount={totalGuests}
                  zipcode={formData.zipcode}
                  basePrice={costs.subtotal}
                />
              )}
              {(!formData.zipcode || formData.zipcode.length !== 5) && (
                <div className="bg-amber-50 p-4 rounded-lg border border-amber-100 text-center">
                  <p>Please enter a valid ZIP code to see available dates and times.</p>
                </div>
              )}
            </div>

            <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
              <h3 className="text-lg font-medium mb-2">Order Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Total Guests:</span>
                  <span>{totalGuests} people</span>
                </div>
                <div className="flex justify-between">
                  <span>Food & Add-ons:</span>
                  <span>${costs.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Travel Fee:</span>
                  <span>${costs.travelFee.toFixed(2)}</span>
                </div>

                {selectedDateTime.date && selectedDateTime.time && (
                  <>
                    <div className="flex justify-between">
                      <span>Selected Date & Time:</span>
                      <span>
                        {format(selectedDateTime.date, "MMM d, yyyy")} at {selectedDateTime.time}
                      </span>
                    </div>
                    {selectedDateTime.originalPrice > selectedDateTime.price && (
                      <div className="flex justify-between text-green-600">
                        <span>Special Discount:</ span>
                        <span>-${(selectedDateTime.originalPrice - selectedDateTime.price).toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}

                <div className="flex justify-between font-bold">
                  <span>Total Amount:</span>
                  <span>
                    $
                    {(selectedDateTime.date && selectedDateTime.time ? selectedDateTime.price + costs.travelFee : costs.total).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <TermsCheckbox
                checked={formData.agreeToTerms}
                onChange={onCheckboxChange}
                onShowTerms={() => setShowTerms(true)}
              />

              {orderError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md">{orderError}</div>
              )}

              <Button
                id="submit-button"
                type="submit"
                disabled={isSubmitting || !isOrderFormValid || !formData.agreeToTerms}
                className="w-full bg-primary hover:bg-primary/90 rounded-full px-8 py-6 text-lg"
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
                    Processing...
                  </span>
                ) : (
                  "Book My Hibachi Party"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <TermsModal open={showTerms} onClose={() => setShowTerms(false)} />
    </div>
  )
}
