"use client"

import { useState, useEffect } from "react"
import { ArrowRight, CheckCircle, Copy, CreditCard, Smartphone } from "lucide-react"
import Image from "next/image"
import { Card, CardContent, CardAction, BottomSheet, SegmentedControl } from "@/components/ui/card"
import { paymentMethodsConfig } from "@/config/ui"
import type { PaymentMethod } from "@/types/payment"

interface ApplePaymentSheetProps {
  isOpen: boolean
  onClose: () => void
  bookingId: string
  amount: number
  onPaymentComplete: () => void
}

export function ApplePaymentSheet({ isOpen, onClose, bookingId, amount, onPaymentComplete }: ApplePaymentSheetProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("stripe")
  const [paymentStatus, setPaymentStatus] = useState<"idle" | "processing" | "success" | "error">("idle")
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Reset state when sheet opens
  useEffect(() => {
    if (isOpen) {
      setPaymentStatus("idle")
      setCopiedField(null)
    }
  }, [isOpen])

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const handlePayment = async () => {
    setPaymentStatus("processing")

    // Simulate payment processing
    setTimeout(() => {
      setPaymentStatus("success")
      setTimeout(() => {
        onPaymentComplete()
      }, 1500)
    }, 1500)
  }

  const currentMethod = paymentMethodsConfig.find((m) => m.id === paymentMethod) || paymentMethodsConfig[0]

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={`${currentMethod.name} Payment`}>
      <div className="space-y-6">
        <SegmentedControl
          options={paymentMethodsConfig.map((method) => ({
            value: method.id,
            label: method.name,
            icon:
              method.icon === "credit-card" ? (
                <CreditCard className="w-4 h-4" />
              ) : method.icon === "smartphone" ? (
                <Smartphone className="w-4 h-4" />
              ) : (
                <Image src={method.icon || "/placeholder.svg"} alt={method.name} width={16} height={16} />
              ),
          }))}
          value={paymentMethod}
          onChange={(value) => setPaymentMethod(value as PaymentMethod)}
          className="mb-6"
        />

        {/* Step 1: Confirm Order */}
        <Card elevation="low">
          <CardContent spacing="apple" step={1} stepTitle={currentMethod.steps?.[0].title || "Confirm Order"}>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Amount Due:</span>
                <span className="text-xl font-semibold text-gray-900">${amount.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Booking ID:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-gray-900">{bookingId}</span>
                  <button
                    onClick={() => handleCopy(bookingId, "bookingId")}
                    className="text-blue-500 hover:text-blue-600"
                    aria-label="Copy booking ID"
                  >
                    {copiedField === "bookingId" ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Account Info or Card Details */}
        <Card elevation="low">
          <CardContent spacing="apple" step={2} stepTitle={currentMethod.steps?.[1].title || "Payment Details"}>
            {(paymentMethod === "venmo" || paymentMethod === "zelle") && currentMethod.accountInfo && (
              <div className="space-y-3">
                {Object.entries(currentMethod.accountInfo).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-center">
                    <span className="text-gray-600">{key.charAt(0).toUpperCase() + key.slice(1)}:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-gray-900">{value}</span>
                      <button
                        onClick={() => handleCopy(value, key)}
                        className="text-blue-500 hover:text-blue-600"
                        aria-label={`Copy ${key}`}
                      >
                        {copiedField === key ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {paymentMethod === "stripe" && (
              <div className="space-y-4">
                <div className="flex space-x-2 justify-center">
                  <Image src="/visa-logo.png" alt="Visa" width={40} height={24} />
                  <Image src="/mastercard-logo.png" alt="Mastercard" width={40} height={24} />
                  <Image src="/amex-logo.png" alt="American Express" width={40} height={24} />
                  <Image src="/discover-logo.png" alt="Discover" width={40} height={24} />
                </div>
                <p className="text-center text-sm text-gray-500">Credit card form will appear here</p>
              </div>
            )}

            {paymentMethod === "square" && (
              <div className="text-center">
                <Image src="/square-logo.png" alt="Square" width={60} height={60} className="mx-auto mb-3" />
                <p className="text-sm text-gray-500">You'll be redirected to Square to complete your payment</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 3: QR Code or Complete Payment */}
        <Card elevation="low">
          <CardContent spacing="apple" step={3} stepTitle={currentMethod.steps?.[2].title || "Complete Payment"}>
            {(paymentMethod === "venmo" || paymentMethod === "zelle") && currentMethod.qrCode && (
              <div className="flex flex-col items-center">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-3">
                  {paymentMethod === "venmo" ? (
                    <img
                      src={currentMethod.qrCode || "/placeholder.svg"}
                      alt={`${currentMethod.name} QR Code`}
                      className="w-[200px] h-[200px] object-contain"
                    />
                  ) : (
                    <Image
                      src={currentMethod.qrCode || "/placeholder.svg"}
                      alt={`${currentMethod.name} QR Code`}
                      width={200}
                      height={200}
                    />
                  )}
                </div>
                <p className="text-sm text-gray-500 text-center">Scan this code with your {currentMethod.name} app</p>
              </div>
            )}

            {(paymentMethod === "stripe" || paymentMethod === "square") && (
              <p className="text-sm text-gray-500 text-center mb-2">Click the button below to complete your payment</p>
            )}
          </CardContent>
        </Card>

        {/* Action Button */}
        <CardAction
          onClick={handlePayment}
          disabled={paymentStatus === "processing"}
          style={{ backgroundColor: currentMethod.color || "#007AFF" }}
        >
          {paymentStatus === "processing" ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              Processing...
            </>
          ) : paymentStatus === "success" ? (
            <>
              <CheckCircle className="w-5 h-5 mr-1" />
              Payment Complete
            </>
          ) : (
            <>
              {paymentMethod === "stripe" || paymentMethod === "square" ? (
                <>Pay ${amount.toFixed(2)}</>
              ) : (
                <>Open {currentMethod.name} App</>
              )}
              <ArrowRight className="w-5 h-5 ml-1" />
            </>
          )}
        </CardAction>

        <p className="text-xs text-gray-500 text-center mt-4">
          By proceeding with payment, you agree to our Terms of Service and Cancellation Policy.
        </p>
      </div>
    </BottomSheet>
  )
}
