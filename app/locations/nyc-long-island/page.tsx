import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Phone, Mail, MessageSquare, CheckCircle, CreditCard, DollarSign, Smartphone } from "lucide-react"
import { siteConfig } from "@/config/site"
import { AnimateOnScroll } from "@/components/animate-on-scroll"
import Image from "next/image"

export const metadata: Metadata = {
  title: "NYC & Long Island Private Hibachi Experience | Real Hibachi",
  description:
    "Book Real Hibachi for an unforgettable private hibachi chef experience in NYC (Manhattan, Brooklyn, Queens, Bronx, Staten Island) & Long Island. Signature services, easy booking, flexible payments!",
  keywords:
    "NYC hibachi, Long Island hibachi, private chef NYC, private chef Long Island, hibachi catering NYC, hibachi catering Long Island, teppanyaki NYC, teppanyaki Long Island, home hibachi, Real Hibachi NYC, Real Hibachi Long Island, Manhattan hibachi, Brooklyn hibachi, Queens hibachi, Bronx hibachi, Staten Island hibachi",
}

export default function NycLongIslandHibachiPage() {
  const signatureServices = [
    {
      name: "I LOVE U Flaming Fried Rice",
      description: "One egg per person, specially blended garlic-butter, flame-stirred to perfection.",
    },
    {
      name: "Fire Performance & Onion Volcano",
      description: "Dazzling fire blasts plus an erupting onion volcano demo.",
    },
    {
      name: "Kids’ Balloon Fun",
      description: "Balloon swords and balloon dogs made on the spot for your little guests.",
    },
    {
      name: "Birthday Celebration Balloons",
      description: "Honoree gets a custom “Special” balloon hat for extra flair.",
    },
  ]

  const whyChooseUs = [
    {
      text: "Experienced & Entertaining Chefs: Our professional chefs bring the teppanyaki excitement to your NYC or Long Island location.",
    },
    {
      text: "Stunning Photo Gallery: See the fun and food from our past events across New York.",
      link: "/gallery",
      linkText: "View Gallery",
    },
    {
      text: "Rave 5-Star Reviews: Trusted by customers in NYC and Long Island for unforgettable celebrations.",
      link: "/#testimonials-section",
      linkText: "Read Reviews",
    },
    {
      text: "Ultimate Convenience: We bring the entire hibachi experience to your home or venue in Manhattan, Brooklyn, Queens, The Bronx, Staten Island, or Long Island – setup, cooking, and cleanup included!",
    },
    {
      text: "Unforgettable Memories: Perfect for birthdays, anniversaries, corporate events, or any special occasion in the New York area.",
    },
  ]

  const paymentMethods = [
    { name: "Cash", icon: <DollarSign className="w-5 h-5 mr-2 text-green-600" /> },
    { name: "Credit Card", icon: <CreditCard className="w-5 h-5 mr-2 text-blue-600" /> },
    { name: "Venmo", icon: <Smartphone className="w-5 h-5 mr-2 text-sky-500" /> },
    { name: "Zelle", icon: <Smartphone className="w-5 h-5 mr-2 text-purple-600" /> },
  ]

  const serviceAreas = "Manhattan, Brooklyn, Queens, The Bronx, Staten Island, and Long Island"

  return (
    <div className="bg-gradient-to-b from-amber-50 to-orange-100 text-gray-800">
      {/* Hero Section */}
      <AnimateOnScroll>
        <section className="relative py-20 md:py-32 bg-white">
          <div className="absolute inset-0">
            <Image
              src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/nyc-skyline-seo-hero-0g76gYgY7gYgYgYgYgYgYgYgYgYgYg.jpg"
              alt="NYC Skyline for Hibachi Experience"
              fill
              style={{ objectFit: "cover" }}
              className="opacity-30"
              priority
            />
            <div className="absolute inset-0 bg-black/30"></div>
          </div>
          <div className="container mx-auto px-4 relative z-10 text-center">
            <h1
              className="text-4xl md:text-6xl font-bold font-serif mb-6 text-white"
              style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}
            >
              Real Hibachi <span className="text-primary">NYC & Long Island</span>
            </h1>
            <p
              className="text-xl md:text-2xl text-white mb-8 max-w-3xl mx-auto"
              style={{ textShadow: "0 1px 3px rgba(0,0,0,0.4)" }}
            >
              Your Premier Private Hibachi Chef Experience in {serviceAreas}
            </p>
            <Button
              asChild
              size="lg"
              className="bg-primary hover:bg-primary/90 text-white py-3 px-8 text-lg rounded-full shadow-lg hover:shadow-xl transition-all"
            >
              <Link href="/estimation">Get a Free Estimate</Link>
            </Button>
          </div>
        </section>
      </AnimateOnScroll>

      {/* Introduction */}
      <AnimateOnScroll>
        <section className="py-16">
          <div className="container mx-auto px-4">
            <p className="text-lg md:text-xl text-center text-gray-700 max-w-3xl mx-auto">
              Welcome to Real Hibachi, serving {serviceAreas}! Experience the thrill and deliciousness of a private
              hibachi chef right at your home, backyard, or chosen venue. We transform any gathering into an
              unforgettable culinary event, filled with dazzling performances and mouth-watering food.
            </p>
          </div>
        </section>
      </AnimateOnScroll>

      {/* Signature Services Section */}
      <AnimateOnScroll>
        <section className="py-16 bg-amber-50">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold font-serif text-center mb-12">
              Our <span className="text-primary">Signature Services</span>
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              {signatureServices.map((service, index) => (
                <AnimateOnScroll key={index} delay={index * 100} direction={index % 2 === 0 ? "left" : "right"}>
                  <div className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow h-full">
                    <div className="flex items-center mb-3">
                      <CheckCircle className="w-8 h-8 text-primary mr-3 flex-shrink-0" />
                      <h3 className="text-xl font-semibold font-serif text-gray-800">{service.name}</h3>
                    </div>
                    <p className="text-gray-600 ml-11">{service.description}</p>
                  </div>
                </AnimateOnScroll>
              ))}
            </div>
          </div>
        </section>
      </AnimateOnScroll>

      {/* Why Choose Real Hibachi Section */}
      <AnimateOnScroll>
        <section className="py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold font-serif text-center mb-12">
              Why Choose <span className="text-primary">Real Hibachi in NYC & Long Island?</span>
            </h2>
            <div className="space-y-6">
              {whyChooseUs.map((item, index) => (
                <AnimateOnScroll key={index} delay={index * 100}>
                  <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
                    <div className="flex items-start">
                      <CheckCircle className="w-6 h-6 text-green-500 mr-3 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-gray-700">{item.text}</p>
                        {item.link && (
                          <Link href={item.link} className="text-primary hover:underline text-sm font-medium">
                            {item.linkText} &rarr;
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </AnimateOnScroll>
              ))}
            </div>
          </div>
        </section>
      </AnimateOnScroll>

      {/* Booking Options Section */}
      <AnimateOnScroll>
        <section className="py-16 bg-orange-50">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold font-serif text-center mb-12">
              Easy <span className="text-primary">Booking Options</span>
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <AnimateOnScroll direction="up">
                <div className="bg-white p-8 rounded-lg shadow-xl h-full flex flex-col">
                  <h3 className="text-2xl font-semibold font-serif mb-4 text-center">24/7 Online Self-Booking</h3>
                  <p className="text-gray-600 mb-6 text-center flex-grow">
                    Ready to plan your NYC or Long Island hibachi party? Our intuitive online system allows you to get a
                    free estimate and book your experience anytime, anywhere. It’s fast, convenient, and available
                    around the clock.
                  </p>
                  <Button
                    asChild
                    size="lg"
                    className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-full"
                  >
                    <Link href="/estimation">Book Online Now</Link>
                  </Button>
                </div>
              </AnimateOnScroll>
              <AnimateOnScroll direction="up" delay={100}>
                <div className="bg-white p-8 rounded-lg shadow-xl h-full flex flex-col">
                  <h3 className="text-2xl font-semibold font-serif mb-4 text-center">Personalized Assistance</h3>
                  <p className="text-gray-600 mb-6 text-center flex-grow">
                    Prefer a personal touch? Our friendly team is here to help you customize your event and answer all
                    your questions. Reach out to us via:
                  </p>
                  <div className="space-y-3">
                    <a
                      href={`tel:${siteConfig.contact.phone}`}
                      className="flex items-center justify-center text-gray-700 hover:text-primary transition-colors"
                    >
                      <Phone className="w-5 h-5 mr-2" /> {siteConfig.contact.phone} (Call or SMS)
                    </a>
                    <a
                      href={`mailto:${siteConfig.contact.email}`}
                      className="flex items-center justify-center text-gray-700 hover:text-primary transition-colors"
                    >
                      <Mail className="w-5 h-5 mr-2" /> {siteConfig.contact.email}
                    </a>
                    <p className="flex items-center justify-center text-gray-700">
                      <MessageSquare className="w-5 h-5 mr-2" /> WhatsApp: {siteConfig.contact.phone}
                    </p>
                  </div>
                </div>
              </AnimateOnScroll>
            </div>
          </div>
        </section>
      </AnimateOnScroll>

      {/* Payment Methods Section */}
      <AnimateOnScroll>
        <section className="py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold font-serif text-center mb-12">
              Flexible <span className="text-primary">Payment Methods</span>
            </h2>
            <p className="text-center text-gray-700 mb-8 max-w-2xl mx-auto">
              We strive to make your experience seamless from booking to payment. We accept a variety of convenient
              payment options:
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
              {paymentMethods.map((method, index) => (
                <AnimateOnScroll key={method.name} delay={index * 100}>
                  <div className="bg-white p-4 rounded-lg shadow-md flex flex-col items-center justify-center text-center h-full hover:shadow-lg transition-shadow">
                    {method.icon}
                    <span className="mt-1 font-medium text-gray-700">{method.name}</span>
                  </div>
                </AnimateOnScroll>
              ))}
            </div>
          </div>
        </section>
      </AnimateOnScroll>

      {/* Discounts Section */}
      <AnimateOnScroll>
        <section className="py-16 bg-amber-50">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold font-serif mb-6">
              Exclusive <span className="text-primary">Discounts & Offers</span>
            </h2>
            <p className="text-lg text-gray-700 mb-8 max-w-2xl mx-auto">
              Make your NYC or Long Island hibachi experience even more special! We often have seasonal promotions,
              package deals, and special offers for our valued customers. Don't hesitate to ask about our current
              discounts when you book.
            </p>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-primary text-primary hover:bg-primary/10 py-3 px-8 text-lg rounded-full"
            >
              <Link href="/contact">Inquire About Discounts</Link>
            </Button>
          </div>
        </section>
      </AnimateOnScroll>

      {/* Final CTA */}
      <AnimateOnScroll>
        <section className="py-20 bg-primary text-white">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold font-serif mb-6">
              Ready for an Unforgettable Hibachi Party in NYC or Long Island?
            </h2>
            <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto">
              Let Real Hibachi bring the fire, flavor, and fun to your next event in {serviceAreas}.
            </p>
            <Button
              asChild
              size="lg"
              className="bg-white text-primary hover:bg-gray-100 py-4 px-10 text-xl rounded-full shadow-lg hover:shadow-xl transition-all"
            >
              <Link href="/estimation">Get Your Free Estimate Today!</Link>
            </Button>
          </div>
        </section>
      </AnimateOnScroll>
    </div>
  )
}
