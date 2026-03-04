// Payment configuration
export const paymentConfig = {
  stripePaymentLink: "https://buy.stripe.com/7sY7sN6E300z4Pq4ug1B602", // Replace with actual production link
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
