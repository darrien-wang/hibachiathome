import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MapPin, Phone, Star } from "lucide-react"
import Link from "next/link"
import { AnimateOnScroll } from "@/components/animate-on-scroll"

export const metadata: Metadata = {
  title: "Hibachi Catering Los Angeles & Orange County | Real Hibachi",
  description:
    "Premium hibachi catering services in Los Angeles, Orange County, and surrounding areas. Professional hibachi chefs bring the authentic Japanese teppanyaki experience to your event.",
  keywords:
    "hibachi catering Los Angeles, Orange County hibachi, LA teppanyaki catering, private hibachi chef California, Japanese catering LA",
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
]

const testimonials = [
  {
    name: "Maria Rodriguez",
    location: "Beverly Hills, CA",
    rating: 5,
    text: "Absolutely incredible experience! The hibachi chef was entertaining and the food was restaurant quality. Perfect for our family gathering in Beverly Hills.",
  },
  {
    name: "David Chen",
    location: "Irvine, CA",
    rating: 5,
    text: "Hired Real Hibachi for my daughter's birthday party in Irvine. The kids were mesmerized by the chef's skills and the adults loved the food. Highly recommend!",
  },
  {
    name: "Jennifer Kim",
    location: "Santa Monica, CA",
    rating: 5,
    text: "Professional service from start to finish. The hibachi experience brought our corporate event in Santa Monica to the next level. Will definitely book again.",
  },
]

export default function LAOrangeCountyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-amber-50 to-orange-50 pt-32 pb-16">
        <div className="container mx-auto px-4">
          <AnimateOnScroll>
            <div className="text-center max-w-4xl mx-auto">
              <h1 className="text-4xl md:text-6xl font-serif font-bold text-gray-900 mb-6">
                Hibachi Catering in <span className="text-primary">Los Angeles & Orange County</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Bring the authentic Japanese hibachi experience to your event in LA, Orange County, and surrounding
                areas. Professional hibachi chefs, premium ingredients, and unforgettable entertainment.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="bg-primary hover:bg-primary/90">
                  <Link href="/book">Book Your Event</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/menu">View Menu & Pricing</Link>
                </Button>
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* Service Areas */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <AnimateOnScroll>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-4">
                We Serve Throughout <span className="text-primary">Southern California</span>
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Our professional hibachi chefs travel throughout Los Angeles County and Orange County to bring you the
                ultimate dining experience.
              </p>
            </div>
          </AnimateOnScroll>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-12">
            {serviceAreas.map((area, index) => (
              <AnimateOnScroll key={area} delay={index * 50}>
                <Card className="text-center hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <MapPin className="h-6 w-6 text-primary mx-auto mb-2" />
                    <p className="font-medium text-gray-900">{area}</p>
                  </CardContent>
                </Card>
              </AnimateOnScroll>
            ))}
          </div>

          <AnimateOnScroll>
            <div className="text-center">
              <p className="text-gray-600 mb-4">Don't see your area listed?</p>
              <Button asChild variant="outline">
                <Link href="sms:5627134832?body=Hi! I'm interested in hibachi catering service. Could you please let me know if you're available for my event? Here are the details:%0A%0ADate: [Please specify]%0ATime: [Please specify]%0ALocation: [Please specify]%0ANumber of guests: [Please specify]%0A%0AThank you!">
                  Contact Us for Availability
                </Link>
              </Button>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <AnimateOnScroll>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-4">
                What Our <span className="text-primary">LA & OC Customers</span> Say
              </h2>
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
                      <p className="text-sm text-gray-500">{testimonial.location}</p>
                    </div>
                  </CardContent>
                </Card>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Info */}
      <section className="py-16 bg-primary text-white">
        <div className="container mx-auto px-4">
          <AnimateOnScroll>
            <div className="text-center max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-serif font-bold mb-6">
                Ready to Book Your LA or Orange County Hibachi Event?
              </h2>
              <p className="text-xl mb-8 opacity-90">
                Contact us today to discuss your event needs and get a custom quote for hibachi catering in your area.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="secondary">
                  <Link href="/book">Book Now</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white text-white hover:bg-white hover:text-primary bg-transparent"
                >
                  <Link href="tel:+12137707788">
                    <Phone className="h-5 w-5 mr-2" />
                    Call (213) 770-7788
                  </Link>
                </Button>
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </section>
    </div>
  )
}
