import React from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArrowDown } from "lucide-react";
import { format } from "date-fns";
import { TermsCheckbox } from "@/components/booking/booking-form";
import { TermsModal } from "@/components/booking/terms-modal";
import GooglePlacesAutocomplete from "../google-places-autocomplete";

interface Step6BookingFormProps {
  formData: {
    name: string;
    email: string;
    phone: string;
    address: string;
    message: string;
    agreeToTerms: boolean;
    zipcode: string;
    city: string;
    state: string;
  };
  totalGuests: number;
  costs: {
    subtotal: number;
    travelFee: number;
    total: number;
  };
  selectedDateTime: {
    date: Date | undefined;
    time: string | undefined;
    price: number;
    originalPrice: number;
  };
  showTerms: boolean;
  isOrderFormValid: boolean;
  isSubmitting: boolean;
  orderError: string;
  onInputChange: (field: string, value: string) => void;
  onCheckboxChange: (checked: boolean) => void;
  onShowTerms: () => void;
  onCloseTerms: () => void;
  onDateTimeSelect: (date: Date | undefined, time: string | undefined, price: number, originalPrice: number) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onPrev: () => void;
}

const DynamicPricingCalendar = dynamic(() => import("@/components/booking/dynamic-pricing-calendar"), {
  loading: () => <div className="animate-pulse bg-gray-100 h-[400px] rounded-lg" />,
  ssr: false,
});

const Step6BookingForm: React.FC<Step6BookingFormProps> = ({
  formData,
  totalGuests,
  costs,
  selectedDateTime,
  showTerms,
  isOrderFormValid,
  isSubmitting,
  orderError,
  onInputChange,
  onCheckboxChange,
  onShowTerms,
  onCloseTerms,
  onDateTimeSelect,
  onSubmit,
  onPrev,
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
                <Label htmlFor="address">Full Address*</Label>
                <div className="space-y-3">
                  <div id="street-address-container">
                    <GooglePlacesAutocomplete
                      value={formData.address}
                      onChange={(value, placeDetails) => {
                        let street = value;
                        if (placeDetails && placeDetails.address_components) {
                          let streetNumber = "";
                          let route = "";
                          let city = "";
                          let state = "";
                          let zipcode = "";
                          placeDetails.address_components.forEach((component: any) => {
                            const types = component.types;
                            if (types.includes("street_number")) streetNumber = component.long_name;
                            if (types.includes("route")) route = component.long_name;
                            if (
                              types.includes("locality") ||
                              types.includes("sublocality") ||
                              types.includes("administrative_area_level_3")
                            ) city = component.long_name;
                            if (types.includes("administrative_area_level_1")) state = component.short_name;
                            if (types.includes("postal_code")) zipcode = component.long_name;
                          });
                          if (streetNumber || route) street = [streetNumber, route].filter(Boolean).join(" ");
                          if (city) onInputChange("city", city);
                          if (state) onInputChange("state", state);
                          if (zipcode) onInputChange("zipcode", zipcode);
                        }
                        onInputChange("address", street);
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Special Requests or Notes</Label>
              <textarea
                id="message"
                value={formData.message}
                onChange={(e) => onInputChange("message", e.target.value)}
                placeholder="Dietary restrictions, special occasions, or other requests"
                className="w-full min-h-[100px] px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary bg-white"
              />
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
                />
              )}
            </div>

            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
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
                        <span>Special Discount:</span>
                        <span>-${(selectedDateTime.originalPrice - selectedDateTime.price).toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between font-bold border-t pt-2 mt-2">
                  <span>Total Amount:</span>
                  <span>
                    $
                    {(selectedDateTime.date && selectedDateTime.time
                      ? selectedDateTime.price + costs.travelFee
                      : costs.total
                    ).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <TermsCheckbox
                checked={formData.agreeToTerms}
                onChange={onCheckboxChange}
                onShowTerms={onShowTerms}
              />
              <TermsModal open={showTerms} onClose={onCloseTerms} />

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
            <Button
              variant="ghost"
              onClick={onPrev}
              className="text-gray-600 hover:text-primary"
            >
              Back to previous step
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Step6BookingForm; 