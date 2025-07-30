"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { paymentConfig } from "@/config/ui"

interface Step7DepositProps {
  orderData: any
  totalGuests: number
  costs: { total: number }
  formData: any
  goToPreviousStep: () => void
  onStartNew: () => void
}

const Step7Deposit: React.FC<Step7DepositProps> = ({
  orderData,
  totalGuests,
  costs,
  formData,
  goToPreviousStep,
  onStartNew,
}) => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center mb-6">Secure Your Hibachi Party with a Deposit</h2>

      {/* 顶部确认区 */}
      <div className="bg-green-50 p-5 rounded-lg border border-green-100">
        <h3 className="text-xl font-bold text-center text-green-800 mb-3">🎉 You're almost done!</h3>
        <p className="text-center mb-4">Here's a summary of your booking request:</p>

        <div className="grid grid-cols-2 gap-2 max-w-md mx-auto text-[#111827]">
          <div className="font-medium">📅 Date:</div>
          <div>{orderData?.event_date ? format(new Date(orderData.event_date + "T00:00:00"), "MMMM d, yyyy") : "Not selected"}</div>

          <div className="font-medium">🕒 Time:</div>
          <div>{orderData?.event_time || "Not selected"}</div>

          <div className="font-medium">👥 Guests:</div>
          <div>{totalGuests} people</div>

          <div className="font-medium">🏠 Address:</div>
          <div className="capitalize">
            {orderData?.address
              ? `${orderData.address}, ${
                  formData.city ||
                  (
                    typeof window !== "undefined"
                      ? (document.getElementById("city-input") as HTMLInputElement)?.value
                      : ""
                  ) ||
                  ""
                }, ${formData.state || (typeof window !== "undefined" ? (document.getElementById("state-input") as HTMLInputElement)?.value : "") || ""} ${
                  formData.zipcode
                }`
              : "Not provided"}
          </div>

          <div className="font-medium">💵 Estimated Total:</div>
          <div>${orderData?.total_amount?.toFixed(2) || costs.total.toFixed(2)}</div>

          <div className="font-medium">💰 Deposit Required:</div>
          <div className="font-bold text-[#E4572E]">${paymentConfig.depositAmount.toFixed(2)}</div>
        </div>
      </div>

      {/* 安心提示区 */}
      <div className="bg-blue-50 p-5 rounded-lg border border-blue-100">
        <h3 className="text-lg font-bold text-center text-blue-800 mb-3">🔒 Why do we ask for a deposit?</h3>

        <ul className="space-y-2 max-w-md mx-auto">
          <li className="flex items-start">
            <span className="text-green-600 mr-2">✅</span>
            <span>This secures your chef and blocks your date</span>
          </li>
          <li className="flex items-start">
            <span className="text-green-600 mr-2">✅</span>
            <span>Fully refundable up to 48 hours before the event</span>
          </li>
          <li className="flex items-start">
            <span className="text-green-600 mr-2">✅</span>
            <span>We'll reach out within 24 hours to confirm everything</span>
          </li>
        </ul>

        <p className="text-center mt-3 text-blue-700">Need to make changes later? No problem — we're flexible!</p>
      </div>

      {/* 支付方式选择区 */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <h3 className="text-lg font-medium text-center mb-6">Choose your deposit payment method</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Credit Card/Stripe */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 flex flex-col items-center">
            <img
              src="https://b.stripecdn.com/manage-statics-srv/assets/public/favicon.ico"
              alt="Stripe"
              className="h-8 w-8 mb-2"
            />
            <div className="font-semibold mb-2">Credit Card</div>
            <Button
              onClick={() => {
                const stripeLink = `${paymentConfig.stripePaymentLink}?prefilled_email=${encodeURIComponent(formData.email)}`
                window.location.href = stripeLink
              }}
              className="w-full bg-[#E4572E] hover:bg-[#D64545] text-white rounded-full px-6 py-3 text-base font-bold mt-2"
            >
              Pay ${paymentConfig.depositAmount.toFixed(2)} Deposit
            </Button>
            <div className="text-xs text-gray-500 mt-2 text-center">💳 Powered by Stripe • Secure & Encrypted</div>
          </div>

          {/* Venmo */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 flex flex-col items-center">
            <img
              src="https://cdn.iconscout.com/icon/free/png-256/venmo-2-569346.png"
              alt="Venmo"
              className="h-8 w-8 mb-2"
            />
            <div className="font-semibold mb-2">Venmo</div>
            <div className="text-[#E4572E] font-bold text-lg mb-1">@shiqi-wang-22</div>
            <div className="text-xs text-gray-500 text-center mb-2">
              Please include your name & event date in the note
            </div>
            <div className="text-xs text-gray-500 text-center">
              Need help?{" "}
              <a href="sms:+12137707788" className="text-[#E4572E] hover:underline">
                Text us
              </a>{" "}
              or{" "}
              <a href="tel:+12137707788" className="text-[#E4572E] hover:underline">
                Call us
              </a>
            </div>
          </div>

          {/* Zelle */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 flex flex-col items-center">
            <img
              src="https://cdn.iconscout.com/icon/free/png-256/zelle-1-761688.png"
              alt="Zelle"
              className="h-8 w-8 mb-2"
            />
            <div className="font-semibold mb-2">Zelle</div>
            <div className="text-[#E4572E] font-bold text-lg mb-1">562-713-4832</div>
            <div className="text-xs text-gray-500 text-center mb-2">
              Please include your name & event date in the note
            </div>
            <div className="text-xs text-gray-500 text-center">
              Need help?{" "}
              <a href="sms:+12137707788" className="text-[#E4572E] hover:underline">
                Text us
              </a>{" "}
              or{" "}
              <a href="tel:+12137707788" className="text-[#E4572E] hover:underline">
                Call us
              </a>
            </div>
          </div>
        </div>
        <div className="text-center text-base text-[#E4572E] font-semibold mb-2">
          If you pay by Venmo or Zelle, please send a screenshot of your payment to{" "}
          <a href="sms:+12137707788" className="underline">
            562-713-4832
          </a>{" "}
          via SMS.
        </div>
        <div className="text-center text-sm text-gray-600 mt-2">
          Your reservation is successful! If you have any questions or want to confirm your menu, contact us anytime:
          <br />
          <span className="font-medium">SMS/Text:</span>{" "}
          <a href="sms:+12137707788" className="text-[#E4572E] hover:underline">
            562-713-4832
          </a>
          &nbsp;|&nbsp;
          <span className="font-medium">Phone:</span>{" "}
          <a href="tel:+12137707788" className="text-[#E4572E] hover:underline">
            213-770-7788
          </a>
          &nbsp;|&nbsp;
          <span className="font-medium">WhatsApp:</span>{" "}
          <a
            href="https://wa.me/12137707788"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#E4572E] hover:underline"
          >
            213-770-7788
          </a>
        </div>
      </div>

      <div className="pt-2 text-center flex flex-col items-center gap-2">
        <Button
          onClick={goToPreviousStep}
          variant="ghost"
          className="text-[#4B5563] hover:text-[#E4572E] text-sm font-medium"
        >
          Back to previous step
        </Button>
        <Button onClick={onStartNew} variant="outline" className="text-[#E4572E] border-[#E4572E] mt-2 bg-transparent">
          Start New
        </Button>
      </div>
    </div>
  )
}

export default Step7Deposit
