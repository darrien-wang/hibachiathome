import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "SMS Program & Opt-In | Real Hibachi",
  description:
    "How the Real Hibachi text messaging program works: how to opt in, message frequency, rates, and how to opt out.",
  alternates: { canonical: "https://www.realhibachi.com/sms-opt-in" },
}

export default function SmsOptInPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Real Hibachi SMS Program &amp; Opt-In</h1>

      <p className="text-gray-700 leading-relaxed mb-6">
        Real Hibachi is a private hibachi chef and catering service based in Rowland Heights,
        California, serving the greater Los Angeles area. We operate a conversational
        customer-care text messaging program to answer booking inquiries, send quotes, and confirm
        event details. This page describes exactly how end users consent to receive text messages
        from us.
      </p>

      <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">How you opt in</h2>
      <ol className="list-decimal pl-6 mb-6 text-gray-700 leading-relaxed">
        <li className="mb-4">
          <strong>Online quote form.</strong> On our quote page at{" "}
          <a href="/quote" className="text-orange-600 underline">
            https://www.realhibachi.com/quote
          </a>{" "}
          you enter your phone number and may check an optional consent checkbox (unchecked by
          default) that reads:
          <blockquote className="border-l-4 border-orange-300 pl-4 my-3 text-gray-800">
            &ldquo;I agree to receive text messages from Real Hibachi about my quote and booking.
            Consent is not a condition of purchase.&rdquo;
          </blockquote>
          Directly beneath the checkbox, the form states: &ldquo;Message frequency varies; message
          and data rates may apply. Reply STOP to opt out or HELP for help,&rdquo; with links to our
          Privacy Policy and Terms of Service.
        </li>
        <li className="mb-4">
          <strong>Text us first.</strong> Our business number is displayed on every page of{" "}
          <a href="/" className="text-orange-600 underline">
            https://www.realhibachi.com
          </a>{" "}
          via the header Call/SMS buttons and floating contact buttons. When you send us the first
          message, we reply to your inquiry.
        </li>
      </ol>

      <h2 className="text-2xl font-bold mt-8 mb-4 text-gray-900">Program details</h2>
      <ul className="list-disc pl-6 mb-6 text-gray-700 leading-relaxed">
        <li className="mb-2">
          <strong>Program name:</strong> Real Hibachi customer care &amp; booking messages
        </li>
        <li className="mb-2">
          <strong>Message types:</strong> quotes, booking confirmations, and event logistics —
          conversational customer service only. No marketing lists and no alcohol-related content.
        </li>
        <li className="mb-2">
          <strong>Message frequency:</strong> varies by conversation; this is not a recurring
          subscription.
        </li>
        <li className="mb-2">
          <strong>Fees:</strong> message and data rates may apply according to your carrier plan.
        </li>
        <li className="mb-2">
          <strong>Opt out:</strong> reply <strong>STOP</strong> at any time to cancel. We may send
          one final message confirming your opt-out.
        </li>
        <li className="mb-2">
          <strong>Help:</strong> reply <strong>HELP</strong>, or contact{" "}
          <a href="mailto:support@realhibachi.com" className="text-orange-600 underline">
            support@realhibachi.com
          </a>
          .
        </li>
        <li className="mb-2">
          <strong>Privacy:</strong> no mobile information will be shared with third parties or
          affiliates for marketing or promotional purposes. Text messaging originator opt-in data
          and consent will not be shared with, or sold to, any third parties.
        </li>
      </ul>

      <p className="text-gray-700 leading-relaxed mb-6">
        See our{" "}
        <a href="/privacy-policy" className="text-orange-600 underline">
          Privacy Policy
        </a>{" "}
        and{" "}
        <a href="/terms" className="text-orange-600 underline">
          Terms of Service
        </a>{" "}
        (section 3, SMS Text Messaging Terms &amp; Conditions) for the full program terms.
      </p>

      <p className="text-sm text-gray-500">
        Real Hibachi · Rowland Heights, CA ·{" "}
        <a href="mailto:support@realhibachi.com" className="underline">
          support@realhibachi.com
        </a>
      </p>
    </div>
  )
}
