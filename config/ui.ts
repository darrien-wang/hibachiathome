// Payment configuration
export const paymentConfig = {
  depositAmount: 100,
  get stripePaymentLink() {
    // Check if we're in production (realhibachi.com domain)
    if (typeof window !== "undefined") {
      const isProduction = window.location.hostname === "realhibachi.com"
      return isProduction
        ? "https://book.stripe.com/live_payment_link_here" // Replace with actual production link
        : "https://book.stripe.com/test_5kQbJ3gezbCaf6hepw5sA00"
    }
    // Fallback for server-side rendering
    return "https://book.stripe.com/test_5kQbJ3gezbCaf6hepw5sA00"
  },
}
