// UI组件配置

// Card组件配置
export interface CardConfig {
  variants: {
    [key: string]: string
  }
  content: {
    spacing: {
      [key: string]: string
    }
  }
  footer: {
    className: string
  }
  header: {
    className: string
  }
  title: {
    className: string
  }
  description: {
    className: string
  }
}

export const cardConfig: CardConfig = {
  variants: {
    default: "bg-white text-gray-900 border-gray-200/60",
    destructive: "bg-red-50 text-red-900 border-red-200/60",
    outline: "border border-gray-200 bg-transparent",
    payment: "bg-white border-gray-200/60 overflow-hidden",
    apple: "bg-white/95 backdrop-blur-sm border-[0.5px] border-gray-200/60",
  },
  content: {
    spacing: {
      default: "p-6 pt-0",
      compact: "p-4 pt-0",
      spacious: "p-8 pt-0",
      apple: "p-5 pt-0",
    },
  },
  footer: {
    className: "flex items-center p-6 pt-0",
  },
  header: {
    className: "flex flex-col space-y-1.5 p-6",
  },
  title: {
    className: "text-lg font-semibold leading-none tracking-tight",
  },
  description: {
    className: "text-sm text-muted-foreground",
  },
}

// 支付方式配置
export interface PaymentMethodConfig {
  id: string
  name: string
  icon: string
  description: string
  instructions?: string
  qrCode?: string
  accountInfo?: {
    [key: string]: string
  }
  color?: string
  steps?: {
    title: string
    description: string
  }[]
}

export const paymentMethodsConfig: PaymentMethodConfig[] = [
  {
    id: "stripe",
    name: "Credit Card",
    icon: "credit-card",
    description:
      "Securely pay with your credit or debit card. We accept Visa, Mastercard, American Express, and Discover.",
    color: "#635BFF",
    steps: [
      {
        title: "Confirm Amount",
        description: "You will be charged $200 for your deposit.",
      },
      {
        title: "Enter Card Details",
        description: "Enter your card information securely.",
      },
      {
        title: "Complete Payment",
        description: "Review and confirm your payment.",
      },
    ],
  },
  {
    id: "square",
    name: "Square",
    icon: "/square-logo.png",
    description: "Pay securely with your Square account.",
    color: "#006AFF",
    steps: [
      {
        title: "Confirm Amount",
        description: "You will be charged $100 for your deposit.",
      },
      {
        title: "Connect Square",
        description: "You'll be redirected to Square to complete payment.",
      },
      {
        title: "Complete Payment",
        description: "Follow Square's instructions to complete payment.",
      },
    ],
  },
  {
    id: "venmo",
    name: "Venmo",
    icon: "smartphone",
    description: "Send payment to us using your Venmo account. Please include your booking ID in the notes.",
    qrCode:
      "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/logo/payment/venmo-MV7d4AofbDGxOdoE89ifcEWKfFdkOZ.png",
    accountInfo: {
      username: "@HibachiChef",
    },
    color: "#008CFF",
    steps: [
      {
        title: "Confirm Order",
        description: "Verify your booking ID and payment amount.",
      },
      {
        title: "Copy Username",
        description: "Copy our Venmo username or scan the QR code.",
      },
      {
        title: "Complete Payment",
        description: "Open Venmo app and send payment with booking ID in notes.",
      },
    ],
  },
  {
    id: "zelle",
    name: "Zelle",
    icon: "/zelle-logo.png",
    description: "Send payment to us using Zelle. Please include your booking ID in the notes.",
    qrCode: "/zelle-qrcode.png",
    accountInfo: {
      email: "payments@hibachichef.com",
      phone: "(555) 123-4567",
    },
    color: "#6D1ED4",
    steps: [
      {
        title: "Confirm Order",
        description: "Verify your booking ID and payment amount.",
      },
      {
        title: "Copy Contact Info",
        description: "Copy our Zelle email or phone number.",
      },
      {
        title: "Complete Payment",
        description: "Open Zelle app and send payment with booking ID in notes.",
      },
    ],
  },
]

export const paymentConfig = {
  stripePaymentLink: "https://buy.stripe.com/fZecPIeSL0e658I7ss",
  depositAmount: 200,
}
