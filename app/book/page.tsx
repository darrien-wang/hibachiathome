"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquare, Calculator, Phone } from "lucide-react"
import { useRouter } from "next/navigation"
import { PromotionBanner } from "@/components/promotions/promotion-banner"
import { siteConfig } from "@/config/site"

export default function BookingPage() {
  const router = useRouter()

  const handleEstimation = () => {
    router.push("/estimation?source=booking")
  }

  return (
    <div className="page-container container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-semibold text-gray-900 mb-4 tracking-tight">Book Your Experience</h1>
          <p className="text-lg text-gray-600 max-w-xl mx-auto leading-relaxed">
            Get a free estimate first, then contact us to book your hibachi experience.
          </p>
        </div>

        {/* Primary Action - Free Estimate */}
        <div className="mb-16">
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl shadow-sm max-w-lg mx-auto overflow-hidden">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Calculator className="h-8 w-8 text-orange-600" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-3">Get Free Estimate</h2>
              <p className="text-gray-600 mb-8 leading-relaxed">
                Get personalized pricing in minutes — no commitment required
              </p>
              <Button
                size="lg"
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white h-12 text-base font-medium rounded-xl"
                onClick={handleEstimation}
              >
                Get My Free Estimate
              </Button>
              <p className="text-sm text-orange-600 mt-4 font-medium">Recommended first step</p>
            </div>
          </div>
        </div>

        {/* Contact Options */}
        <div className="mb-16">
          <h2 className="text-xl font-semibold text-gray-900 text-center mb-8">Ready to book? Get in touch</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              {
                title: "WhatsApp",
                description: "Fastest response",
                icon: <MessageSquare className="h-5 w-5" />,
                buttonText: "Open WhatsApp",
                href: `https://wa.me/${siteConfig.contact.phone || "12137707788"}?text=Hello%2C%20I%20would%20like%20to%20book%20a%20hibachi%20experience`,
                external: true,
                primary: true
              },
              {
                title: "Text Message",
                description: "Send us a text",
                icon: <MessageSquare className="h-5 w-5" />,
                buttonText: "Send Message",
                href: `sms:2137707788?body=I'm%20interested%20in%20booking%20a%20REAL%20HIBACHI%20experience`,
                external: false,
                primary: false
              },
              {
                title: "Phone Call",
                description: "Speak directly",
                icon: <Phone className="h-5 w-5" />,
                buttonText: siteConfig.contact.phone || "(213) 770-7788",
                href: `tel:${siteConfig.contact.phone || "12137707788"}`,
                external: false,
                primary: false
              },
            ].map((card, index) => (
              <div key={index} className="bg-white border border-orange-200 rounded-xl p-6 text-center hover:border-orange-300 transition-colors hover:bg-orange-50/30">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-orange-600">{card.icon}</span>
                </div>
                <h3 className="font-medium text-gray-900 mb-1">{card.title}</h3>
                <p className="text-sm text-gray-600 mb-4">{card.description}</p>
                <Button
                  variant={card.primary ? "default" : "outline"}
                  className={`w-full h-10 text-sm rounded-lg ${
                    card.primary 
                      ? "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-0" 
                      : "border-orange-300 text-orange-600 hover:bg-orange-50"
                  }`}
                  asChild
                >
                  <a
                    href={card.href}
                    target={card.external ? "_blank" : undefined}
                    rel={card.external ? "noopener noreferrer" : undefined}
                  >
                    {card.buttonText}
                  </a>
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-8 border border-orange-200">
          <h3 className="text-xl font-semibold text-gray-900 mb-8 text-center">How it works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-sm font-medium">
                1
              </div>
              <h4 className="font-medium text-gray-900 mb-2">Get estimate</h4>
              <p className="text-gray-600 text-sm leading-relaxed">
                Use our calculator to get personalized pricing instantly
              </p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-sm font-medium">
                2
              </div>
              <h4 className="font-medium text-gray-900 mb-2">Contact us</h4>
              <p className="text-gray-600 text-sm leading-relaxed">
                Reach out via WhatsApp, text, or phone to book your date
              </p>
            </div>
            <div className="text-center">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-sm font-medium">
                3
              </div>
              <h4 className="font-medium text-gray-900 mb-2">Enjoy experience</h4>
              <p className="text-gray-600 text-sm leading-relaxed">
                We'll confirm details and bring the hibachi experience to you
              </p>
            </div>
          </div>
        </div>

        {/* <PromotionBanner /> */}
      </div>
    </div>
  )
}
