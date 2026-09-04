import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MapPin, Phone, Star, Clock, Users, ChefHat, Check } from "lucide-react"
import Link from "next/link"
import { AnimateOnScroll } from "@/components/animate-on-scroll"
import { JsonLd, BUSINESS_ID } from "@/components/structured-data"
import { phone } from "@/config/site"

export const metadata: Metadata = {
  title: "Hibachi at Home Los Angeles & Orange County | Private Chef Catering",
  description:
    "Professional hibachi at home service in Los Angeles, Orange County & surrounding areas. Private hibachi chef brings authentic Japanese teppanyaki experience to your location. Book today!",
  keywords:
    "hibachi at home los angeles, private hibachi chef LA, hibachi catering los angeles, teppanyaki at home, japanese chef los angeles, hibachi party catering, private chef los angeles, hibachi grill rental LA",
  openGraph: {
    title: "Hibachi at Home Los Angeles | Private Chef Service",
    description:
      "Bring authentic hibachi experience to your home in LA. Professional chefs, premium ingredients, unforgettable entertainment.",
    url: "https://www.realhibachi.com/locations/la-orange-county",
    siteName: "Real Hibachi",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: 'https://www.realhibachi.com/images/hibachi-flame-og.png',
        width: 1200,
        height: 630,
        alt: 'Hibachi at Home Los Angeles - Authentic Cooking with Amazing Flames',
      },
    ],
  },

  // Twitter Cards
  twitter: {
    card: 'summary_large_image',
    site: '@realhibachi',
    creator: '@realhibachi',
    title: 'Hibachi at Home Los Angeles | Private Chef Service',
    description: 'Authentic hibachi experience in LA & Orange County. Professional chefs bring Japanese teppanyaki to your home!',
    images: ['https://www.realhibachi.com/images/hibachi-flame-og.png'],
  },
}

const serviceAreas = [
  "Los Angeles",
  "Orange County",
  "Beverly Hills",
  "Santa Monica",
  "Pasadena",
  "Irvine",
  "Newport Beach",
  "Anaheim",
  "Long Beach",
  "Burbank",
  "Glendale",
  "Huntington Beach",
  "Costa Mesa",
  "Fullerton",
  "Torrance",
  "West Hollywood",
  "Manhattan Beach",
  "Redondo Beach",
  "El Segundo",
  "Culver City",
]

// Verbatim 5-star Google reviews from the Real Hibachi listing (owner-supplied,
// 2026-08) — same pool as /quote and the homepage; do not invent locations/dates.
const testimonials = [
  {
    name: "Spencer Sprowls",
    rating: 5,
    text: "Bling is an amazing chef!! He makes the party 100x better and will make amazing food for you.",
  },
  {
    name: "David Armstrong",
    rating: 5,
    text: "Chef Bling curated a brilliant display of culinary mastery and phenomenal vibes to create an forgettable evening for the bros and I. 2 thumbs up.",
  },
  {
    name: "Max Schwenk",
    rating: 5,
    text: "Unbelievable experience! Bling was the best chef ever!",
  },
]

const features = [
  {
    icon: <ChefHat className="h-8 w-8 text-primary" />,
    title: "Professional Hibachi Chefs",
    description: "Trained Japanese teppanyaki chefs with years of experience",
  },
  {
    icon: <Users className="h-8 w-8 text-primary" />,
    title: "Perfect for Any Event",
    description: "Birthday parties, corporate events, family gatherings, date nights",
  },
  {
    icon: <Clock className="h-8 w-8 text-primary" />,
    title: "Flexible Scheduling",
    description: "Available 7 days a week, lunch and dinner service",
  },
]

const laOcServiceJsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  "@id": "https://www.realhibachi.com/locations/la-orange-county#service",
  name: "Hibachi at Home in Los Angeles & Orange County",
  serviceType: "Private hibachi chef catering",
  provider: { "@id": BUSINESS_ID },
  description:
    "Private hibachi chef service across Los Angeles County and Orange County. The chef brings the grill, fresh ingredients, live cooking show, setup, and cleanup to your home or event space.",
  areaServed: serviceAreas.map((city) => ({ "@type": "City", name: `${city}, CA` })),
  offers: {
    "@type": "Offer",
    priceCurrency: "USD",
    price: "59.90",
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: "59.90",
      priceCurrency: "USD",
      unitText: "per adult ($29.90 per child 5–12, $5 per kid under 5, $599 event minimum)",
    },
    availability: "https://schema.org/InStock",
    url: "https://www.realhibachi.com/locations/la-orange-county",
  },
}

export default function LAOrangeCountyPage() {
  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={laOcServiceJsonLd} />
      {/* Hero Section */}
      <section className="hero-section bg-gradient-to-r from-amber-50 to-orange-50 pb-16">
        <div className="container mx-auto px-4">
          <AnimateOnScroll>
            <div className="text-center max-w-4xl mx-auto">
              <h1 className="text-4xl md:text-6xl font-serif font-bold text-gray-900 mb-6">
                Hibachi at Home <span className="text-primary">Los Angeles</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Experience authentic Japanese hibachi and teppanyaki at your location in Los Angeles, Orange County, and
                surrounding areas. Professional private chefs bring restaurant-quality entertainment and cuisine
                directly to you.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-lg px-8 py-4">
                  <Link href="/quote?source=seo_location_la_oc">Get Instant Quote</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="text-lg px-8 py-4">
                  <Link href="/menu">View Menu & Pricing</Link>
                </Button>
              </div>
              <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-600">
                <span className="flex items-center">
                  <Check className="h-4 w-4 text-primary mr-1" />
                  Full deposit refund up to 72h
                </span>
                <span className="flex items-center">
                  <Users className="h-4 w-4 text-primary mr-1" />
                  500+ Events
                </span>
                <span className="flex items-center">
                  <Clock className="h-4 w-4 text-primary mr-1" />
                  Same Day Available
                </span>
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <AnimateOnScroll>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-4">
                Why Choose Our <span className="text-primary">Hibachi at Home Service</span> in LA?
              </h2>
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                We're Los Angeles' premier hibachi at home service, bringing authentic Japanese teppanyaki experience to
                your doorstep
              </p>
            </div>
          </AnimateOnScroll>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {features.map((feature, index) => (
              <AnimateOnScroll key={index} delay={index * 100}>
                <Card className="text-center h-full hover:shadow-lg transition-shadow">
                  <CardContent className="p-8">
                    <div className="flex justify-center mb-4">{feature.icon}</div>
                    <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                    <p className="text-gray-600">{feature.description}</p>
                  </CardContent>
                </Card>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* Service Areas */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <AnimateOnScroll>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-4">
                Hibachi at Home Service Areas in <span className="text-primary">Southern California</span>
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Our professional hibachi chefs serve throughout Los Angeles County, Orange County, and surrounding areas
              </p>
            </div>
          </AnimateOnScroll>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-12">
            {serviceAreas.map((area, index) => (
              <AnimateOnScroll key={area} delay={index * 50}>
                <Card className="text-center hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <MapPin className="h-5 w-5 text-primary mx-auto mb-2" />
                    <p className="font-medium text-gray-900 text-sm">{area}</p>
                  </CardContent>
                </Card>
              </AnimateOnScroll>
            ))}
          </div>

          <AnimateOnScroll>
            <div className="text-center bg-white p-8 rounded-lg shadow-md">
              <h3 className="text-2xl font-bold mb-4">Don't See Your Area?</h3>
              <p className="text-gray-600 mb-6">
                We serve many more locations throughout Southern California. Contact us to check availability in your
                area.
              </p>
              <Button asChild variant="outline" size="lg">
                <Link href="sms:+16263628824?body=Hi! I'm interested in hibachi at home service in Los Angeles. Could you please let me know if you serve my area? Here are my details:%0A%0ALocation: [Please specify your city/area]%0ADate needed: [Please specify]%0ANumber of guests: [Please specify]%0A%0AThank you!">
                  Check My Area Availability
                </Link>
              </Button>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <AnimateOnScroll>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-4">
                What Our <span className="text-primary">Los Angeles Customers</span> Say
              </h2>
              <p className="text-lg text-gray-600">Real reviews from real hibachi at home experiences in LA</p>
            </div>
          </AnimateOnScroll>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <AnimateOnScroll key={index} delay={index * 100}>
                <Card className="h-full">
                  <CardContent className="p-6">
                    <div className="flex mb-4">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <p className="text-gray-600 mb-4 italic">"{testimonial.text}"</p>
                    <div>
                      <p className="font-bold text-gray-900">{testimonial.name}</p>
                      <p className="text-sm text-gray-500">Google review</p>
                    </div>
                  </CardContent>
                </Card>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary text-white">
        <div className="container mx-auto px-4">
          <AnimateOnScroll>
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-serif font-bold mb-6">
                Ready to Book Hibachi at Home in Los Angeles?
              </h2>
              <p className="text-xl mb-8 opacity-90">
                Join hundreds of satisfied customers who've experienced our authentic hibachi at home service. Book
                today and create unforgettable memories with family and friends.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="secondary" className="text-lg px-8 py-4">
                  <Link href="/quote?source=seo_location_la_oc">Get Instant Quote</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white text-white hover:bg-white hover:text-primary bg-transparent text-lg px-8 py-4"
                >
                  <Link href={phone.voice.tel}>
                    <Phone className="h-5 w-5 mr-2" />
                    Call {phone.voice.display}
                  </Link>
                </Button>
              </div>
              <p className="text-sm mt-4 opacity-75">
                Same-day booking available • Free consultation • 100% satisfaction guarantee
              </p>
            </div>
          </AnimateOnScroll>
        </div>
      </section>
    </div>
  )
}
