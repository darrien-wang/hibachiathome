import React from "react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { paymentConfig } from "@/config/ui";

interface Step7DepositProps {
  orderData: any;
  totalGuests: number;
  costs: { total: number };
  formData: any;
  goToPreviousStep: () => void;
}

const Step7Deposit: React.FC<Step7DepositProps> = ({ orderData, totalGuests, costs, formData, goToPreviousStep }) => {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center mb-6">Secure Your Hibachi Party with a Deposit</h2>

      {/* 顶部确认区 */}
      <div className="bg-green-50 p-5 rounded-lg border border-green-100">
        <h3 className="text-xl font-bold text-center text-green-800 mb-3">🎉 You're almost done!</h3>
        <p className="text-center mb-4">Here's a summary of your booking request:</p>

        <div className="grid grid-cols-2 gap-2 max-w-md mx-auto text-[#111827]">
          <div className="font-medium">📅 Date:</div>
          <div>
            {orderData?.event_date ? format(new Date(orderData.event_date), "MMMM d, yyyy") : "Not selected"}
          </div>

          <div className="font-medium">🕒 Time:</div>
          <div>{orderData?.event_time || "Not selected"}</div>

          <div className="font-medium">👥 Guests:</div>
          <div>{totalGuests} people</div>

          <div className="font-medium">🏠 Address:</div>
          <div className="capitalize">
            {orderData?.address
              ? `${orderData.address}, ${
                  formData.city || (typeof window !== "undefined" ? (document.getElementById("city-input") as HTMLInputElement)?.value : "") || ""
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

        <p className="text-center mt-3 text-blue-700">
          Need to make changes later? No problem — we're flexible!
        </p>
      </div>

      {/* 支付按钮区 */}
      <div className="pt-4">
        <Button
          onClick={() => {
            const stripeLink = `${paymentConfig.stripePaymentLink}?prefilled_email=${encodeURIComponent(formData.email)}`;
            window.location.href = stripeLink;
          }}
          className="w-full py-4 bg-[#E4572E] text-white rounded-md hover:bg-[#D64545] font-bold text-lg transition-colors shadow-md"
        >
          🟧 Confirm and Pay ${paymentConfig.depositAmount.toFixed(2)} Deposit
        </Button>
        <p className="text-center text-sm text-gray-500 mt-2">💳 Powered by Stripe • Secure & Encrypted</p>
      </div>

      {/* 小字说明区 */}
      <div className="text-xs text-gray-500 text-center space-y-1">
        <p>By paying the deposit, you are confirming your request for this event.</p>
        <p>
          If for any reason you need to cancel, you will receive a full refund if cancelled at least 72 hours
          before your event.
        </p>
        <p>
          <a href="/faq" className="text-[#E4572E] hover:underline">
            View our full refund policy
          </a>
        </p>
      </div>

      {/* 可选备选路径 */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <h3 className="text-lg font-medium text-center mb-3">❓ Not ready to pay now?</h3>
        <p className="text-center text-sm text-gray-600 mb-4">
          We can hold your quote for 24 hours. Leave your name and number below and we'll follow up.
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Your Name"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#E4572E]"
          />
          <input
            type="tel"
            placeholder="Phone Number"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#E4572E]"
          />
          <Button className="px-4 py-2 bg-gray-100 text-gray-800 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors">
            📩 Hold My Spot
          </Button>
        </div>
      </div>

      <div className="pt-2 text-center">
        <Button onClick={goToPreviousStep} variant="ghost" className="text-[#4B5563] hover:text-[#E4572E] text-sm font-medium">
          Back to previous step
        </Button>
      </div>
    </div>
  );
};

export default Step7Deposit; 