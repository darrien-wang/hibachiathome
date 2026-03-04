import Stripe from "stripe"

let stripeClient: Stripe | null = null

export function getStripeServerClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim()

  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY environment variable.")
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey)
  }

  return stripeClient
}
