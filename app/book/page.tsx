"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquare } from "lucide-react"
import { useRouter } from "next/navigation"
import { PromotionBanner } from "@/components/promotions/promotion-banner"
import { siteConfig } from "@/config/site"

export default function BookingPage() {
  const router = useRouter()

  const handleOnlineBooking = () => {
    router.push("/estimation?source=booking")
  }

  return (
    <div className="container mx-auto px-4 pt-24 pb-12 mt-16">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-4">Book Your Hibachi Experience</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Choose your preferred booking method below, or contact us directly for faster service.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10 max-w-5xl mx-auto">
          {[
            {
              title: "Online Booking",
              description: "Book at your convenience",
              icon: <MessageSquare className="mr-2 h-4 w-4 flex-shrink-0" />,
              buttonText: "Book Online",
              onClick: handleOnlineBooking,
              variant: "default",
              className: "bg-primary/5 border-primary/20",
              is24_7: true,
            },
            {
              title: "WhatsApp",
              description: "Fastest response time",
              icon: <MessageSquare className="mr-2 h-4 w-4 flex-shrink-0" />,
              buttonText: "WhatsApp",
              href: `https://wa.me/${siteConfig.contact.phone || "15627134832"}?text=Hello%2C%20I%20would%20like%20to%20book%20a%20hibachi%20experience`,
              external: true,
              variant: "outline",
            },
            {
              title: "SMS",
              description: "Text us directly",
              icon: <MessageSquare className="mr-2 h-4 w-4 flex-shrink-0" />,
              buttonText: "SMS",
              href: `sms:5627134832?body=I'm%20interested%20in%20booking%20a%20REAL%20HIBACHI%20experience`,
              external: false,
              variant: "outline",
            },
            {
              title: "Phone",
              description: "Speak with us",
              icon: null,
              buttonText: siteConfig.contact.phone || "15627134832",
              href: `tel:${siteConfig.contact.phone || "15627134832"}`,
              external: false,
              variant: "outline",
            },
          ].map((card, index) => (
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
                      {card.is24_7 && <p className="text-xs text-gray-500 mt-2">24/7 Service Available</p>}
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
                      {card.is24_7 && <p className="text-xs text-gray-500 mt-2">24/7 Service Available</p>}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <PromotionBanner />
      </div>
    </div>
  )
}
