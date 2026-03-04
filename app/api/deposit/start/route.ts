import { NextRequest, NextResponse } from "next/server"
import { paymentConfig } from "@/config/ui"

export async function GET(request: NextRequest) {
  const prefilledEmail = request.nextUrl.searchParams.get("prefilled_email")

  if (!paymentConfig.stripePaymentLink) {
    return NextResponse.json({ success: false, error: "Stripe payment link is not configured." }, { status: 500 })
  }

  const destination = new URL(paymentConfig.stripePaymentLink)
  if (prefilledEmail) {
    destination.searchParams.set("prefilled_email", prefilledEmail)
  }

  return NextResponse.redirect(destination.toString(), 302)
}
