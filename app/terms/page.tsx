import type { Metadata } from "next"
import { phone } from "@/config/site"

export const metadata: Metadata = {
  title: "Terms of Service | Real Hibachi",
  description:
    "Terms of Service for Real Hibachi, including our SMS text messaging program terms and conditions.",
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      <div className="page-container container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">Terms of Service</h1>
            <div className="w-24 h-1 bg-orange-500 mx-auto"></div>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8 md:p-12">
            <div className="prose prose-lg max-w-none">
              <p className="text-gray-700 leading-relaxed mb-6">
                These Terms of Service (&quot;Terms&quot;) govern your use of the Real Hibachi website and services.
                By booking an event, submitting a form, or contacting us, you agree to these Terms.
              </p>

              <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">1. Services</h2>
              <p className="text-gray-700 leading-relaxed mb-6">
                Real Hibachi provides private hibachi chef and catering experiences at customer locations across
                Southern California. Quotes shown on our website are estimates; final pricing is confirmed before your
                event. Bookings are subject to chef availability and confirmation by our team.
              </p>

              <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">2. Bookings, Deposits, and Cancellations</h2>
              <p className="text-gray-700 leading-relaxed mb-6">
                A deposit may be required to secure your event date. Deposits and cancellation terms are communicated
                at the time of booking. Weather-related rescheduling is handled case by case — we work with you to
                find a new date whenever possible.
              </p>

              <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">3. SMS Text Messaging Terms &amp; Conditions</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Real Hibachi offers a customer-care text messaging program to answer booking inquiries, send quotes,
                and confirm event details.
              </p>
              <ul className="list-disc pl-6 mb-6">
                <li className="mb-2">
                  <strong>Opt-in:</strong> You opt in to receive text messages from Real Hibachi when you text our
                  business number first, or when you submit a booking or quote request on our website and provide
                  your mobile phone number. Consent is not a condition of any purchase.
                </li>
                <li className="mb-2">
                  <strong>Message frequency:</strong> Message frequency varies based on your inquiry and booking
                  activity. This is a conversational customer-service program, not a recurring marketing subscription.
                </li>
                <li className="mb-2">
                  <strong>Fees:</strong> Message and data rates may apply according to your mobile carrier plan.
                </li>
                <li className="mb-2">
                  <strong>Opt-out:</strong> Reply <strong>STOP</strong> at any time to cancel and stop receiving
                  messages. After you send STOP, we may send one final message confirming your opt-out.
                </li>
                <li className="mb-2">
                  <strong>Help:</strong> Reply <strong>HELP</strong> for help, or contact us at
                  support@realhibachi.com or {phone.voice.display}.
                </li>
                <li className="mb-2">
                  <strong>Carriers:</strong> Mobile carriers are not liable for delayed or undelivered messages.
                </li>
                <li className="mb-2">
                  <strong>Privacy:</strong> Your phone number and text messaging opt-in data will not be shared with
                  or sold to third parties or affiliates for marketing purposes. See our{" "}
                  <a href="/privacy-policy" className="text-orange-600 underline">
                    Privacy Policy
                  </a>{" "}
                  for details on how we handle your information.
                </li>
              </ul>

              <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">4. Customer Responsibilities</h2>
              <p className="text-gray-700 leading-relaxed mb-6">
                You are responsible for providing a safe, legal setup space for the hibachi grill (outdoor or
                well-ventilated area), accurate event details, and timely access to the venue. Guests attend at their
                own discretion; please inform us of any food allergies in advance.
              </p>

              <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">5. Limitation of Liability</h2>
              <p className="text-gray-700 leading-relaxed mb-6">
                To the fullest extent permitted by law, Real Hibachi&apos;s liability for any claim arising from our
                services is limited to the amount you paid for the event at issue. We are not liable for indirect,
                incidental, or consequential damages.
              </p>

              <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">6. Changes to These Terms</h2>
              <p className="text-gray-700 leading-relaxed mb-6">
                We may update these Terms from time to time. The latest version will always be posted on this page.
                Continued use of our services after changes constitutes acceptance of the updated Terms.
              </p>

              <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-4">7. Contact Us</h2>
              <p className="text-gray-700 leading-relaxed mb-2">Real Hibachi</p>
              <p className="text-gray-700 leading-relaxed mb-2">Email: support@realhibachi.com</p>
              <p className="text-gray-700 leading-relaxed mb-6">Phone: {phone.voice.display}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
