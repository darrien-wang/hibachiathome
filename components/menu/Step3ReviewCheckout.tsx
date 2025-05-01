"use client"

import type * as React from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface Step3ReviewCheckoutProps {
  selectedPackage: string | null
  getPackageById: (id: string) => any
  buffetHeadcount: number
  proteinSelections: any
  sideSelections: any
  regularProteins: any[]
  premiumProteins: any[]
  sides: any[]
  extraCharges: any
  customerInfo: any
  setCustomerInfo: (fn: (prev: any) => any) => void
  isSubmitting: boolean
  setCurrentStep: (step: 1 | 2 | 3) => void
  submitResult: any
  handleInputChange: (args: {
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    setCustomerInfo: any
  }) => void
  handleSubmitOrder: (e: React.MouseEvent<HTMLButtonElement>) => void
}

const Step3ReviewCheckout: React.FC<Step3ReviewCheckoutProps> = ({
  selectedPackage,
  getPackageById,
  buffetHeadcount,
  proteinSelections,
  sideSelections,
  regularProteins,
  premiumProteins,
  sides,
  extraCharges,
  customerInfo,
  setCustomerInfo,
  isSubmitting,
  setCurrentStep,
  submitResult,
  handleInputChange,
  handleSubmitOrder,
}) => {
  return (
    <div className="p-6 pt-0">
      <div className="mb-6">
        <h3 className="text-xl font-bold mb-2">Review & Checkout</h3>
        <p className="text-sm text-gray-600">Review your order and provide contact information</p>
      </div>

      {submitResult && (
        <Alert className={`mb-6 ${submitResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          {submitResult.success ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600" />
          )}
          <AlertTitle>{submitResult.success ? "Success!" : "Error"}</AlertTitle>
          <AlertDescription>{submitResult.message}</AlertDescription>
          {submitResult.success && submitResult.reservationId && (
            <p className="mt-2 text-sm">Reservation ID: {submitResult.reservationId}</p>
          )}
        </Alert>
      )}

      {/* 订单摘要 */}
      <div className="border rounded-lg p-4 mb-6">
        <h4 className="font-medium mb-3">Order Summary</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h5 className="text-sm font-medium mb-2">Package Details</h5>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Package:</span>
                <span>
                  {selectedPackage === "buffet"
                    ? "Buffet Package"
                    : selectedPackage === "basic"
                      ? "Basic Package"
                      : "Premium Package"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Guests:</span>
                <span>
                  {getPackageById(selectedPackage || "")?.headcount || 0}{" "}
                  {getPackageById(selectedPackage || "")?.headcount !== 1 ? "people" : "person"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Base Price:</span>
                <span>
                  {selectedPackage === "buffet"
                    ? `$${(buffetHeadcount * 39.9).toFixed(2)}`
                    : `$${getPackageById(selectedPackage || "")?.flatRate || 0}`}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h5 className="text-sm font-medium mb-2">Selected Items</h5>
            <div className="space-y-1 text-sm">
              {selectedPackage === "buffet" ? (
                <>
                  <div className="flex justify-between">
                    <span>Chicken:</span>
                    <span>× {buffetHeadcount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Premium Steak:</span>
                    <span>× {buffetHeadcount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shrimp:</span>
                    <span>× {buffetHeadcount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fried Rice:</span>
                    <span>× {buffetHeadcount}</span>
                  </div>
                </>
              ) : (
                <>
                  {Object.entries(proteinSelections)
                    .filter(([_, value]) => value.selected && value.quantity > 0)
                    .map(([key, value]: any) => {
                      const protein = [...regularProteins, ...premiumProteins].find((p) => p.id === key)
                      return protein ? (
                        <div key={key} className="flex justify-between">
                          <span>{protein.name}:</span>
                          <span>× {value.quantity}</span>
                        </div>
                      ) : null
                    })}
                  {Object.entries(sideSelections)
                    .filter(([_, value]) => value.selected && value.quantity > 0)
                    .map(([key, value]: any) => {
                      const side = sides.find((s) => s.id === key)
                      return side ? (
                        <div key={key} className="flex justify-between">
                          <span>{side.name}:</span>
                          <span>× {value.quantity}</span>
                        </div>
                      ) : null
                    })}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="border-t mt-4 pt-3">
          <div className="flex justify-between font-medium">
            <span>Total:</span>
            <span className="text-[#C33]">
              {selectedPackage === "buffet"
                ? `$${(buffetHeadcount * 39.9).toFixed(2)}`
                : `$${(getPackageById(selectedPackage || "")?.flatRate || 0) + extraCharges.total}`}
            </span>
          </div>
        </div>
      </div>

      {/* 联系信息表单 */}
      <div className="border rounded-lg p-4 mb-6">
        <h4 className="font-medium mb-3">Contact Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Full Name*
            </Label>
            <Input
              id="name"
              type="text"
              className="w-full p-2 border rounded-md"
              required
              value={customerInfo.name}
              onChange={(e) => handleInputChange({ e, setCustomerInfo })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium">
              Phone Number*
            </Label>
            <Input
              id="phone"
              type="tel"
              className="w-full p-2 border rounded-md"
              required
              value={customerInfo.phone}
              onChange={(e) => handleInputChange({ e, setCustomerInfo })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              className="w-full p-2 border rounded-md"
              value={customerInfo.email}
              onChange={(e) => handleInputChange({ e, setCustomerInfo })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="eventDate" className="text-sm font-medium">
              Event Date*
            </Label>
            <Input
              id="eventDate"
              type="date"
              className="w-full p-2 border rounded-md"
              required
              value={customerInfo.eventDate}
              onChange={(e) => handleInputChange({ e, setCustomerInfo })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="eventTime" className="text-sm font-medium">
              Event Time*
            </Label>
            <Input
              id="eventTime"
              type="time"
              className="w-full p-2 border rounded-md"
              required
              min="13:00"
              max="23:00"
              value={customerInfo.eventTime}
              onChange={(e) => handleInputChange({ e, setCustomerInfo })}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address" className="text-sm font-medium">
              Service Address*
            </Label>
            <Textarea
              id="address"
              rows={2}
              className="w-full p-2 border rounded-md"
              required
              value={customerInfo.address}
              onChange={(e) => handleInputChange({ e, setCustomerInfo })}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="specialRequests" className="text-sm font-medium">
              Special Requests (Optional)
            </Label>
            <Textarea
              id="specialRequests"
              rows={3}
              className="w-full p-2 border rounded-md"
              placeholder="Any dietary restrictions, allergies, or special requests"
              value={customerInfo.specialRequests}
              onChange={(e) => handleInputChange({ e, setCustomerInfo })}
            />
          </div>
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={() => setCurrentStep(2)}>
          ◀ Back
        </Button>
        <Button onClick={handleSubmitOrder} disabled={isSubmitting}>
          {isSubmitting ? "Processing..." : "Submit Order"}
        </Button>
      </div>
    </div>
  )
}

export default Step3ReviewCheckout
