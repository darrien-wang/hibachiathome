"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquare, Calculator, Phone, Mail } from "lucide-react"
import { useRouter } from "next/navigation"
import { PromotionBanner } from "@/components/promotions/promotion-banner"
import { siteConfig } from "@/config/site"
import { trackEvent } from "@/lib/tracking"

export default function BookingPage() {
  const router = useRouter()

  const handleEstimation = () => {
    trackEvent("booking_funnel_start")
    router.push("/estimation?source=booking")
  }

  const handleInstantQuote = () => {
    router.push("/quote")
  }

  return (
    <div className="page-container container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-4">Book Your Hibachi Experience</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Get a free estimate first, then contact us directly to book your experience.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-10 max-w-6xl mx-auto">
          {[
            {
              title: "Instant Quote",
              description: "One-page quote in under 30 seconds",
              icon: <Calculator className="mr-2 h-4 w-4 flex-shrink-0" />,
              buttonText: "Get Instant Quote",
              onClick: handleInstantQuote,
              variant: "default",
              className: "bg-emerald-50 border-emerald-200",
              isRecommended: true,
            },
            {
              title: "Free Estimate",
              description: "Calculate your price first",
              icon: <Calculator className="mr-2 h-4 w-4 flex-shrink-0" />,
              buttonText: "Get Estimate",
              onClick: handleEstimation,
              variant: "default",
              className: "bg-primary/5 border-primary/20",
              isRecommended: true,
              hidden: true,
            },
            {
              title: "SMS",
              description: "First-priority support channel",
              icon: <MessageSquare className="mr-2 h-4 w-4 flex-shrink-0" />,
              buttonText: "SMS",
              href: `sms:2137707788?body=I'm%20interested%20in%20booking%20a%20REAL%20HIBACHI%20experience`,
              external: false,
              variant: "outline",
            },
            {
              title: "Phone",
              description: "Second-priority direct call",
              icon: <Phone className="mr-2 h-4 w-4 flex-shrink-0" />,
              buttonText: siteConfig.contact.phone || "12137707788",
              href: `tel:${siteConfig.contact.phone || "12137707788"}`,
              external: false,
              variant: "outline",
            },
            {
              title: "Email",
              description: "Third-priority detailed support",
              icon: <Mail className="mr-2 h-4 w-4 flex-shrink-0" />,
              buttonText: "Email",
              href: `mailto:${siteConfig.contact.email}?subject=Real%20Hibachi%20Feedback%20and%20Support`,
              external: false,
              variant: "outline",
            },
            {
              title: "WhatsApp",
              description: "Last-priority backup channel",
              icon: <MessageSquare className="mr-2 h-4 w-4 flex-shrink-0" />,
              buttonText: "WhatsApp",
              href: `https://wa.me/${siteConfig.contact.phone || "12137707788"}?text=Hello%2C%20I%20would%20like%20to%20book%20a%20hibachi%20experience`,
              external: true,
              variant: "outline",
            },
          ].filter((card) => !card.hidden).map((card, index) => (
            <Card key={index} className={`text-center flex flex-col ${card.className || ""}`}>
              <CardHeader className="h-[120px] flex flex-col justify-center">
                <CardTitle>{card.title}</CardTitle>
                <CardDescription className="h-[40px] flex items-center justify-center">
                  {card.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col items-center justify-end pb-6">
                {card.onClick ? (
                  <>
                    <Button
                      className="w-full mx-auto h-10 text-xs sm:text-sm whitespace-nowrap overflow-hidden"
                      variant={card.variant}
                      onClick={card.onClick}
                    >
                      {card.icon}
                      {card.buttonText}
                    </Button>
                    <div className="h-[20px] flex items-center justify-center">
                      {card.isRecommended && (
                        <p className="text-xs text-green-600 mt-2 font-medium">Recommended First Step</p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <Button
                      className="w-full mx-auto h-10 text-xs sm:text-sm whitespace-nowrap overflow-hidden"
                      variant={card.variant}
                      asChild
                    >
                      <a
                        href={card.href}
                        target={card.external ? "_blank" : undefined}
                        rel={card.external ? "noopener noreferrer" : undefined}
                      >
                        {card.icon}
                        {card.buttonText}
                      </a>
                    </Button>
                    <div className="h-[20px] flex items-center justify-center">
                      {card.isRecommended && (
                        <p className="text-xs text-green-600 mt-2 font-medium">Recommended First Step</p>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-10">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">How It Works</h3>
          <div className="text-blue-800 space-y-2">
            <p>
              <strong>Step 1:</strong> Use our free estimate calculator to get your pricing
            </p>
            <p>
              <strong>Step 2:</strong> Contact us in this order: SMS, phone, email, then WhatsApp
            </p>
            <p>
              <strong>Step 3:</strong> We'll confirm details and arrange payment (cash, Zelle, Venmo)
            </p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-10">
          <h3 className="text-lg font-semibold text-amber-900 mb-3">Important Policies Before You Book</h3>
          <div className="grid gap-3 text-sm text-amber-900 md:grid-cols-2">
            <div className="rounded bg-white/70 p-3 border border-amber-100">
              <p className="font-semibold mb-1">Cancellation</p>
              <p>Cancel or reschedule with at least 48 hours notice to avoid late-change fees.</p>
            </div>
            <div className="rounded bg-white/70 p-3 border border-amber-100">
              <p className="font-semibold mb-1">Weather</p>
              <p>Cooking is outdoors. Please provide cover (tent/canopy) when weather is uncertain.</p>
            </div>
            <div className="rounded bg-white/70 p-3 border border-amber-100">
              <p className="font-semibold mb-1">Arrival Timing</p>
              <p>Chef typically arrives shortly before your selected start time for quick setup.</p>
            </div>
            <div className="rounded bg-white/70 p-3 border border-amber-100">
              <p className="font-semibold mb-1">Allergies & Dietary Needs</p>
              <p>Tell us in advance so we can prepare ingredients and cooking flow safely.</p>
            </div>
          </div>
        </div>

        <PromotionBanner />
      </div>
    </div>
  )
}
