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

// Payment methods configuration
export const paymentMethodsConfig = {
  creditCards: [
    {
      name: "Visa",
      logo: "/visa-logo.png",
      enabled: true,
    },
    {
      name: "Mastercard",
      logo: "/mastercard-logo.png",
      enabled: true,
    },
    {
      name: "American Express",
      logo: "/amex-logo.png",
      enabled: true,
    },
    {
      name: "Discover",
      logo: "/discover-logo.png",
      enabled: true,
    },
  ],
  digitalWallets: [
    {
      name: "Zelle",
      logo: "/zelle-logo.png",
      qrCode: "/zelle-qrcode.png",
      enabled: true,
    },
    {
      name: "Venmo",
      qrCode: "/venmo-qrcode.png",
      enabled: true,
    },
    {
      name: "Square",
      logo: "/square-logo.png",
      enabled: true,
    },
  ],
}
