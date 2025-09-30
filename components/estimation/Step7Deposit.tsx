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
      {/* Progress Indicator */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-orange-400 to-red-500 text-white rounded-full mb-4 animate-bounce">
          <span className="text-2xl">🎉</span>
        </div>
        <div className="mb-4">
          <div className="flex items-center justify-center space-x-2 mb-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full opacity-60 animate-pulse" style={{animationDuration: '3s'}}></div>
            <div className="w-3 h-3 bg-orange-500 rounded-full opacity-70 animate-pulse" style={{animationDuration: '3.2s', animationDelay: '0.1s'}}></div>
            <div className="w-3 h-3 bg-orange-500 rounded-full opacity-80 animate-pulse" style={{animationDuration: '3.4s', animationDelay: '0.2s'}}></div>
            <div className="w-3 h-3 bg-orange-500 rounded-full opacity-90 animate-pulse" style={{animationDuration: '3.6s', animationDelay: '0.3s'}}></div>
            <div className="w-3 h-3 bg-orange-500 rounded-full opacity-95 animate-pulse" style={{animationDuration: '3.8s', animationDelay: '0.4s'}}></div>
            <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse" style={{animationDuration: '4s', animationDelay: '0.45s'}}></div>
            <div className="w-4 h-4 bg-orange-500 rounded-full animate-pulse border-2 border-white shadow-lg" style={{animationDuration: '4.2s', animationDelay: '0.5s'}}></div>
          </div>
          <p className="text-sm text-gray-600">Step 7 of 7 - Final Step!</p>
        </div>
      </div>

      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent mb-2 animate-fade-in">
          🔥 Almost There! 🔥
        </h2>
        <p className="text-xl text-gray-700 mb-2">You're just ONE step away from your amazing hibachi experience!</p>
        <p className="text-lg font-medium text-orange-600 animate-pulse" style={{animationDuration: '2.5s'}}>Secure your party with a quick deposit ⬇️</p>
      </div>

      {/* 顶部确认区 */}
      <div className="bg-gradient-to-r from-orange-50 to-red-50 p-6 rounded-xl border border-orange-200 shadow-lg transform hover:scale-105 transition-all duration-300">
        <h3 className="text-xl font-bold text-center text-orange-800 mb-3 animate-fade-in">🎊 Your Hibachi Party Details 🎊</h3>
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
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-full mb-4 animate-bounce delay-1000">
            <span className="text-xl">💳</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-2">Choose Your Payment Method</h3>
          <p className="text-lg text-gray-600 animate-fade-in delay-500">Select your preferred way to secure your hibachi party!</p>
          <div className="mt-4 animate-pulse" style={{animationDuration: '2.8s'}}>
            <span className="inline-block px-4 py-2 bg-gradient-to-r from-orange-400 to-red-500 text-white rounded-full text-sm font-bold shadow-lg">
              🚀 FINAL STEP TO HIBACHI HEAVEN! 🚀
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Credit Card/Stripe */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-6 flex flex-col items-center hover:shadow-xl hover:scale-105 transition-all duration-300 transform animate-fade-in-up"
               style={{ animationDelay: '0.2s' }}>
            <img
              src="https://b.stripecdn.com/manage-statics-srv/assets/public/favicon.ico"
              alt="Stripe"
              className="h-8 w-8 mb-2"
            />
            <div className="font-semibold mb-3">Credit Card</div>
            <Button
              onClick={() => {
                const stripeLink = `${paymentConfig.stripePaymentLink}?prefilled_email=${encodeURIComponent(formData.email)}`
                window.location.href = stripeLink
              }}
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-lg px-6 py-3 text-base font-medium mb-3 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Pay ${paymentConfig.depositAmount.toFixed(2)} Deposit
            </Button>
            <div className="text-xs text-gray-500 text-center">💳 Powered by Stripe • Secure & Encrypted</div>
          </div>

          {/* Venmo */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-6 flex flex-col items-center hover:shadow-xl hover:scale-105 transition-all duration-300 transform animate-fade-in-up"
               style={{ animationDelay: '0.4s' }}>
            <img
              src="https://cdn.iconscout.com/icon/free/png-256/venmo-2-569346.png"
              alt="Venmo"
              className="h-8 w-8 mb-2"
            />
            <div className="font-semibold mb-3">Venmo</div>
            <Button
              onClick={() => {
                window.open(`https://venmo.com/u/shiqi-wang-22`, '_blank')
              }}
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-lg px-6 py-3 text-base font-medium mb-3 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Send ${paymentConfig.depositAmount.toFixed(2)} Deposit
            </Button>
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
          <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-6 flex flex-col items-center hover:shadow-xl hover:scale-105 transition-all duration-300 transform animate-fade-in-up"
               style={{ animationDelay: '0.6s' }}>
            <img
              src="https://play-lh.googleusercontent.com/F4U2pL8z-Ic5FzCfe1xVXMWRvff6oEBIzDsyGRc4mE3bIUPiCfhuXXXvTOfcpVglKqs=w480-h960-rw"
              alt="Zelle"
              className="h-8 w-8 mb-2"
            />
            <div className="font-semibold mb-3">Zelle</div>
            <Button
              onClick={() => {
                // Copy phone number to clipboard
                navigator.clipboard.writeText('562-713-4832')
                alert('Phone number copied to clipboard!')
              }}
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-lg px-6 py-3 text-base font-medium mb-3 transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Send ${paymentConfig.depositAmount.toFixed(2)} Deposit
            </Button>
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
        <div className="text-center animate-fade-in delay-1000">
          <div className="inline-block bg-gradient-to-r from-yellow-100 to-orange-100 border border-yellow-300 rounded-lg p-4 mb-4">
            <p className="text-base text-orange-700 font-semibold mb-2">
              📸 <span className="animate-pulse" style={{animationDuration: '2s'}}>Important:</span> If you pay by Venmo or Zelle
            </p>
            <p className="text-sm text-orange-600">
              Please send a screenshot of your payment to{" "}
              <a href="sms:+12137707788" className="underline font-bold hover:text-orange-800 transition-colors">
                562-713-4832
              </a>{" "}
              via SMS.
            </p>
          </div>
        </div>
        <div className="text-center text-sm text-gray-600 mt-2">
          Your reservation is successful! If you have any questions or want to confirm your menu, contact us anytime:
          <br />
          <span className="font-medium">SMS/Text:</span>{" "}
          <a href="sms:+12137707788" className="text-[#E4572E] hover:underline">
            213-770-7788
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
