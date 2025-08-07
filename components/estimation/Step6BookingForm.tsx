"use client"

import type React from "react"
import dynamic from "next/dynamic"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ArrowDown } from "lucide-react"
import { TermsCheckbox } from "@/components/booking/booking-form"
import { TermsModal } from "@/components/booking/terms-modal"
import GooglePlacesAutocomplete from "../google-places-autocomplete"

interface Step6BookingFormProps {
  formData: {
    name: string
    email: string
    phone: string
    address: string
    message: string
    agreeToTerms: boolean
    zipcode: string
    city: string
    state: string
    estimatedGuests: string
    adults: number
    kids: number
    filetMignon: number
    lobsterTail: number
    premiumScallops: number
    extraProteins: number
    noodles: number
    gyoza: number
    edamame: number
  }
  totalGuests: number
  costs: {
    subtotal: number
    travelFee: number
    total: number
  }
  selectedDateTime: {
    dateString: string | undefined
    time: string | undefined
    price: number
    originalPrice: number
  }
  showTerms: boolean
  isOrderFormValid: boolean
  validationErrors: string[]
  isSubmitting: boolean
  orderError: string
  onInputChange: (field: string, value: string) => void
  onCheckboxChange: (checked: boolean) => void
  onShowTerms: () => void
  onCloseTerms: () => void
  onDateTimeSelect: (
    dateString: string | undefined,
    time: string | undefined,
    price: number,
    originalPrice: number,
  ) => void
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onPrev: () => void
  onNext?: () => void
}

const DynamicPricingCalendar = dynamic(() => import("@/components/booking/dynamic-pricing-calendar"), {
  loading: () => <div className="animate-pulse bg-gray-100 h-[400px] rounded-lg" />,
  ssr: false,
})

const Step6BookingForm: React.FC<Step6BookingFormProps> = ({
  formData,
  totalGuests,
  costs,
  selectedDateTime,
  showTerms,
  isOrderFormValid,
  validationErrors,
  isSubmitting,
  orderError,
  onInputChange,
  onCheckboxChange,
  onShowTerms,
  onCloseTerms,
  onDateTimeSelect,
  onSubmit,
  onPrev,
  onNext,
}) => {
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
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => onInputChange("phone", e.target.value)}
                  required
                  placeholder="(123) 456-7890"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimatedGuests">Estimated Guest Count*</Label>
                <Input
                  id="estimatedGuests"
                  type="number"
                  value={formData.estimatedGuests}
                  onChange={(e) => onInputChange("estimatedGuests", e.target.value)}
                  required
                  placeholder="Number of guests"
                  min="1"
                  max="100"
                />
                <p className="text-xs text-gray-500">
                  You can adjust this number later as needed
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Full Address*</Label>
              <div className="space-y-3">
                  <div id="street-address-container">
                    <GooglePlacesAutocomplete
                      value={formData.address}
                      onChange={(value, placeDetails) => {
                        let street = value
                        if (placeDetails && placeDetails.address_components) {
                          let streetNumber = ""
                          let route = ""
                          let city = ""
                          let state = ""
                          let zipcode = ""
                          placeDetails.address_components.forEach((component: any) => {
                            const types = component.types
                            if (types.includes("street_number")) streetNumber = component.long_name
                            if (types.includes("route")) route = component.long_name
                            if (
                              types.includes("locality") ||
                              types.includes("sublocality") ||
                              types.includes("administrative_area_level_3")
                            )
                              city = component.long_name
                            if (types.includes("administrative_area_level_1")) state = component.short_name
                            if (types.includes("postal_code")) zipcode = component.long_name
                          })
                          if (streetNumber || route) street = [streetNumber, route].filter(Boolean).join(" ")
                          if (city) onInputChange("city", city)
                          if (state) onInputChange("state", state)
                          if (zipcode) onInputChange("zipcode", zipcode)
                        }
                        onInputChange("address", street)
                      }}
                      placeholder="Street Address"
                      className="address-input"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      id="city-input"
                      type="text"
                      placeholder="City"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                      autoComplete="address-level2"
                      value={formData.city}
                      onChange={(e) => onInputChange("city", e.target.value)}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        id="state-input"
                        type="text"
                        placeholder="State"
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                        autoComplete="address-level1"
                        value={formData.state}
                        onChange={(e) => onInputChange("state", e.target.value)}
                      />
                      <Input
                        type="text"
                        value={formData.zipcode}
                        onChange={(e) => onInputChange("zipcode", e.target.value)}
                        placeholder="ZIP"
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                        autoComplete="postal-code"
                        maxLength={5}
                      />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  FULL ADDRESS OF PARTY (House #, Street, PLEASE include Zip Code)
                </p>
              </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">🍽️ Your Estimated Menu</h3>
              
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Base Package */}
                  <div className="bg-white rounded-lg p-4 border border-blue-100">
                    <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
                      🥘 <span className="ml-2">Base Hibachi Package</span>
                    </h4>
                    <div className="text-sm space-y-1">
                      <p>• Hibachi Fried Rice</p>
                      <p>• Mixed Vegetables</p>
                      <p>• Yum Yum Sauce, Teriyaki Sauce, Salad Dressing</p>
                      <p>• Regular Protein (Choice of: Chicken, Steak, Shrimp, Salmon, or Tofu)</p>
                    </div>
                  </div>

                  {/* Entertainment Activities */}
                  <div className="bg-white rounded-lg p-4 border border-purple-200">
                    <h4 className="font-semibold text-purple-900 mb-3 flex items-center">
                      🎭 <span className="ml-2">Entertainment & Show</span>
                    </h4>
                    <div className="text-sm space-y-1">
                      <p>• Onion Volcano 🌋</p>
                      <p>• Sake Gun 🔫</p>
                      <p>• Pee Pee Boy 💦</p>
                      <p>• Zucchini Toss 🥒</p>
                      <p>• Interactive Chef Performance</p>
                      <p>• Egg Juggling & Tricks</p>
                    </div>
                  </div>

                  {/* Premium Upgrades */}
                  {(formData.filetMignon > 0 || formData.lobsterTail > 0 || formData.premiumScallops > 0) && (
                    <div className="bg-white rounded-lg p-4 border border-amber-200">
                      <h4 className="font-semibold text-amber-900 mb-3 flex items-center">
                        ⭐ <span className="ml-2">Premium Upgrades</span>
                      </h4>
                      <div className="text-sm space-y-1">
                        {formData.filetMignon > 0 && (
                          <p>• Filet Mignon Upgrade</p>
                        )}
                        {formData.lobsterTail > 0 && (
                          <p>• Spiny Lobster Tail</p>
                        )}
                        {formData.premiumScallops > 0 && (
                          <p>• Premium Sea Scallops</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Sides & Add-ons */}
                  {(formData.extraProteins > 0 || formData.noodles > 0 || formData.gyoza > 0 || formData.edamame > 0) && (
                    <div className="bg-white rounded-lg p-4 border border-green-200">
                      <h4 className="font-semibold text-green-900 mb-3 flex items-center">
                        🍜 <span className="ml-2">Sides & Add-ons</span>
                      </h4>
                      <div className="text-sm space-y-1">
                        {formData.extraProteins > 0 && (
                          <p>• Extra Proteins</p>
                        )}
                        {formData.noodles > 0 && (
                          <p>• Hibachi Noodles</p>
                        )}
                        {formData.gyoza > 0 && (
                          <p>• Gyoza (12pcs)</p>
                        )}
                        {formData.edamame > 0 && (
                          <p>• Edamame</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg p-4 border border-red-200">
                  <h4 className="font-semibold text-red-900 mb-2 flex items-center">
                    🔥 <span className="ml-2">What Makes Our Hibachi Special</span>
                  </h4>
                  <p className="text-sm text-red-800">
                    Our experienced hibachi chefs bring the authentic Japanese teppanyaki experience to your home with skilled knife work, 
                    entertaining cooking tricks, and interactive performances that will delight guests of all ages!
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="message">Special Requests & Dietary Restrictions (Optional)</Label>
                <textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => onInputChange("message", e.target.value)}
                  placeholder="Please let us know about any allergies, dietary restrictions, or special requests for your hibachi party..."
                  className="w-full min-h-[120px] px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary bg-white text-sm"
                />
                <p className="text-xs text-gray-500">
                  💡 Optional: Please specify any food allergies or dietary restrictions to ensure a safe dining experience
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-900 mb-2">✅ Booking Policy & Flexibility:</h4>
                <div className="text-sm text-green-800 space-y-2">
                  <p className="flex items-start">
                    <span className="text-green-600 mr-2">📅</span>
                    <span><strong>Menu Selection:</strong> No rush! You can finalize your exact menu choices up to <strong>1 day before</strong> your party date.</span>
                  </p>
                  <p className="flex items-start">
                    <span className="text-green-600 mr-2">➕</span>
                    <span><strong>Increase Guests:</strong> You can <strong>add more guests any time</strong> (additional charges apply).</span>
                  </p>
                  <p className="flex items-start">
                    <span className="text-green-600 mr-2">➖</span>
                    <span><strong>Reduce Guests:</strong> You can <strong>reduce guest count</strong> up until the day before your party.</span>
                  </p>
                  <p className="flex items-start">
                    <span className="text-orange-500 mr-2">⚠️</span>
                    <span><strong>Day-of Policy:</strong> Guest count <strong>cannot be reduced on the party day</strong> as ingredients are already prepared.</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium">Select Date & Time</h3>
              <p className="text-sm text-gray-600 mb-4">
                Choose from available dates and times. Green dates indicate special pricing!
              </p>
              {formData.zipcode && formData.zipcode.length === 5 && (
                <DynamicPricingCalendar
                  key={`calendar-${formData.zipcode}-${totalGuests}`}
                  onSelectDateTime={onDateTimeSelect}
                  packageType="basic"
                  headcount={totalGuests}
                  zipcode={formData.zipcode}
                  basePrice={costs.subtotal}
                  selectedDateTime={selectedDateTime}
                />
              )}
            </div>

            <div className="space-y-4">
              <TermsCheckbox checked={formData.agreeToTerms} onChange={onCheckboxChange} onShowTerms={onShowTerms} />
              <TermsModal open={showTerms} onClose={onCloseTerms} />

              {/* Validation Errors */}
              {!isOrderFormValid && validationErrors.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-medium text-amber-900 mb-2 flex items-center">
                    ⚠️ <span className="ml-2">Please complete the following required fields:</span>
                  </h4>
                  <ul className="text-sm text-amber-800 space-y-1 ml-4">
                    {validationErrors.map((error, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-amber-600 mr-2">•</span>
                        <span>{error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

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

          <div className="mt-4 text-center">
            <Button variant="ghost" onClick={onPrev} className="text-gray-600 hover:text-primary">
              Back to previous step
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Step6BookingForm
