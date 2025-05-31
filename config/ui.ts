// Payment configuration
export const paymentConfig = {
  depositAmount: 100,
  stripePaymentLink: "https://book.stripe.com/fZecPIeSL0e658I7ss", // Replace with actual production link
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
