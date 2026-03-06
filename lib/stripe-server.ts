import Stripe from "stripe"
import { isPreBranchDeployment, resolveStripeSecretKey } from "@/lib/stripe-env"

let stripeClient: Stripe | null = null

export function getStripeServerClient(): Stripe {
  const secretKey = resolveStripeSecretKey()

  if (!secretKey) {
    const envHint = isPreBranchDeployment()
      ? "Missing Stripe secret key. Expected PRE_STRIPE_SECRET_KEY (or fallback STRIPE_SECRET_KEY)."
      : "Missing STRIPE_SECRET_KEY environment variable."
    throw new Error(envHint)
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey)
  }

  return stripeClient
}
