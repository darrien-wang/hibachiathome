import type { Metadata } from "next"
import Link from "next/link"
import { CheckCircle2 } from "lucide-react"
import { phone, smsHref } from "@/config/site"

// Balance links used to land on /deposit/success, which fires deposit tracking
// and tells the customer their deposit is in — for someone who just paid the
// rest of their bill, both are wrong. This page says the true thing and
// deliberately tracks nothing: the payment is already recorded server-side by
// the Stripe webhook, and there is no ad conversion to fire on a final balance.
export const metadata: Metadata = {
  title: "Payment Received | Real Hibachi",
  description: "Your balance payment went through.",
  robots: { index: false, follow: false },
}

export default function BalanceSuccessPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <CheckCircle2 className="h-14 w-14 text-emerald-500" aria-hidden />
      <h1 className="text-2xl font-semibold text-gray-900">Payment received — you&apos;re all set</h1>
      <p className="text-gray-600">
        Thanks! Your balance is paid in full and your card receipt is on its way by email. Nothing else
        is needed from you before the party — your chef will arrive at the scheduled time with
        everything.
      </p>
      <p className="text-sm text-gray-500">
        Questions before the event? Text us at{" "}
        <a href={smsHref()} className="font-medium text-gray-800 underline underline-offset-2">
          {phone.sms.dashed}
        </a>
        .
      </p>
      <Link href="/" className="text-sm text-gray-500 underline underline-offset-2 hover:text-gray-700">
        Back to the homepage
      </Link>
    </div>
  )
}
