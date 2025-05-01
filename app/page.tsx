"use client"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Flame, Camera, ThumbsUp, Package } from "lucide-react"
import { useState, useEffect } from "react"

// Testimonial data
const testimonials = [
  {
    name: "Sarah M.",
    text: "The hibachi experience was amazing! Our chef was entertaining and the food was delicious. Perfect for my daughter's birthday party!",
    location: "Boston, MA",
  },
  {
    name: "Michael T.",
    text: "We booked Hibachi-at-Home for our anniversary and it exceeded all expectations. The convenience of having restaurant-quality hibachi at home is unbeatable.",
    location: "Chicago, IL",
  },
  {
    name: "Jennifer L.",
    text: "Our family gathering was transformed into an unforgettable event. The chef was professional, friendly, and put on an amazing show!",
    location: "Atlanta, GA",
  },
  {
    name: "David W.",
    text: "The perfect solution for our office party. Everyone was impressed with both the performance and the delicious food. Will definitely book again!",
    location: "Seattle, WA",
  },
]

export default function Home() {
  const [currentTestimonial, setCurrentTestimonial] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      {/* Hero Section - Softer, more inviting style */}
      <section className="relative h-screen min-h-[600px] flex items-center justify-center">
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/edae833a967fb994df866aa8ce7af7b-ifIJnkRuSbTbOMxtgsqvU6zen5lTVv.png)`,
            }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-black/30"></div>
        </div>
        <div className="container mx-auto px-4 relative z-10 text-center text-white">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold mb-6 tracking-wide leading-tight">
            <span className="inline-block animate-fadeIn">Hibachi Show </span>
            <div className="inline-flex items-center">
              <Flame className="h-8 w-8 md:h-10 md:w-10 lg:h-12 lg:w-12 text-[#F9A77C] animate-flicker mr-1" />
              <span className="text-[#F9A77C] inline-block animate-fireText relative">
                & Delicious Food
                <span className="absolute -bottom-1 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-[#F9A77C] to-amber-500 animate-fireUnderline"></span>
              </span>
              <Flame className="h-8 w-8 md:h-10 md:w-10 lg:h-12 lg:w-12 text-[#F9A77C] animate-flicker ml-1" />
            </div>
            <span className="inline-block animate-slideUp"> in Your Backyard</span>
          </h1>
          <p className="text-xl md:text-2xl max-w-3xl mx-auto mb-8 font-sans tracking-wide">
            Top-tier food & service. No hidden fees. From $499.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 md:gap-6">
            <Button
              asChild
              size="lg"
              className="text-lg py-6 px-8 bg-primary hover:bg-primary/90 rounded-full border-2 border-primary"
            >
              <Link href="/book">Book Now</Link>
            </Button>
            <Button
              asChild
              size="lg"
              className="text-lg py-6 px-8 bg-white text-[#FF6600] border-2 border-[#FF6600] hover:bg-[#FF6600] hover:text-white transition-colors duration-300 rounded-full shadow-sm hover:shadow-md"
            >
              <Link href="/menu">View Packages</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonial Slider - Social proof */}
      <section className="py-10 bg-muted">
        <div className="container mx-auto px-4">
          <div className="relative overflow-hidden h-48">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className={`absolute w-full transition-all duration-1000 ease-in-out ${
                  index === currentTestimonial ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
                }`}
              >
                <div className="max-w-3xl mx-auto text-center">
                  <p className="text-lg md:text-xl italic mb-4 font-sans">&ldquo;{testimonial.text}&rdquo;</p>
                  <p className="font-medium text-primary font-sans">
                    {testimonial.name} • {testimonial.location}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-center mt-4">
            {testimonials.map((_, index) => (
              <button
                key={index}
                className={`w-2 h-2 mx-1 rounded-full ${index === currentTestimonial ? "bg-primary" : "bg-gray-300"}`}
                onClick={() => setCurrentTestimonial(index)}
                aria-label={`View testimonial ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Key Benefits Section - Three columns with icons */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-center mb-12">
            Why Choose <span className="text-primary">Hibachi-at-Home</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow rounded-2xl overflow-hidden">
              <CardContent className="pt-6">
                <div className="mb-4 flex justify-center">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <ThumbsUp className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-center mb-2 font-serif">Affordable Convenience</h3>
                <p className="text-center text-foreground/80 font-sans tracking-wide">
                  Backyard hibachi experience with a show for only $39.9 per person. No travel, no waiting, just pure
                  enjoyment.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow rounded-2xl overflow-hidden">
              <CardContent className="pt-6">
                <div className="mb-4 flex justify-center">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Package className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-center mb-2 font-serif">All-Inclusive Service</h3>
                <p className="text-center text-foreground/80 font-sans tracking-wide">
                  We provide everything: cooking equipment, ingredients, and professional chefs. You just enjoy the
                  experience.
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow rounded-2xl overflow-hidden">
              <CardContent className="pt-6">
                <div className="mb-4 flex justify-center">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Camera className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-center mb-2 font-serif">Perfect for Special Occasions</h3>
                <p className="text-center text-foreground/80 font-sans tracking-wide">
                  Birthdays, anniversaries, holidays, or just because. Create memorable moments and amazing photo
                  opportunities.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-12 text-center">
            <Button
              asChild
              size="lg"
              className="bg-primary hover:bg-primary/90 text-lg rounded-full border-2 border-primary"
            >
              <Link href="/menu">View Our Packages</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-muted">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-center mb-12">
            How It <span className="text-primary">Works</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#F4B6A0] text-white text-2xl font-serif font-bold mb-4 shadow-sm">
                1
              </div>
              <h3 className="text-xl font-bold mb-2 font-serif">Choose Your Package</h3>
              <p className="text-foreground/80 font-sans tracking-wide">
                Select from our Basic, Premium, or Deluxe packages based on your preferences and budget.
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#F4B6A0] text-white text-2xl font-serif font-bold mb-4 shadow-sm">
                2
              </div>
              <h3 className="text-xl font-bold mb-2 font-serif">Book Your Date</h3>
              <p className="text-foreground/80 font-sans tracking-wide">
                Choose your preferred date and time, and we'll confirm availability within 24 hours.
              </p>
            </div>

            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#F4B6A0] text-white text-2xl font-serif font-bold mb-4 shadow-sm">
                3
              </div>
              <h3 className="text-xl font-bold mb-2 font-serif">Enjoy The Experience</h3>
              <p className="text-foreground/80 font-sans tracking-wide">
                Our chef arrives, sets up, performs, cooks, serves, and cleans up. You just enjoy!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Gallery - Auto Scrolling */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-center mb-12">
            Moments to <span className="text-primary">Remember</span>
          </h2>

          <div className="relative overflow-hidden">
            {/* Auto-scrolling gallery */}
            <div className="flex animate-scroll">
              {/* First set of images */}
              <div className="flex flex-nowrap min-w-full">
                <div className="w-1/4 p-1 aspect-square flex-shrink-0">
                  <img
                    src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/1-m93dHNDISVKua3hTFnhnZ2JOqCPLB8.jpg"
                    alt="Hibachi chef cooking with flames"
                    className="w-full h-full object-cover rounded-lg hover:scale-105 transition-transform"
                  />
                </div>
                <div className="w-1/4 p-1 aspect-square flex-shrink-0">
                  <img
                    src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/2-fwVMDe7XNA5vixCVGUffU4v1pDKdGG.jpg"
                    alt="Fresh hibachi food being prepared"
                    className="w-full h-full object-cover rounded-lg hover:scale-105 transition-transform"
                  />
                </div>
                <div className="w-1/4 p-1 aspect-square flex-shrink-0">
                  <img
                    src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/3-ECGoDibwRJkqEKZFdiHbo4zufuvMyy.jpg"
                    alt="Family enjoying hibachi at home"
                    className="w-full h-full object-cover rounded-lg hover:scale-105 transition-transform"
                  />
                </div>
                <div className="w-1/4 p-1 aspect-square flex-shrink-0">
                  <img
                    src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/4-SfqZqyg2PR4QVtatCRbequgR4WEoED.jpg"
                    alt="Chef performing tricks"
                    className="w-full h-full object-cover rounded-lg hover:scale-105 transition-transform"
                  />
                </div>
              </div>

              {/* Duplicate set for seamless scrolling */}
              <div className="flex flex-nowrap min-w-full">
                <div className="w-1/4 p-1 aspect-square flex-shrink-0">
                  <img
                    src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/5-q0GCQMceuaTeB4FEj5cRTas5xwHNeM.jpg"
                    alt="Seafood hibachi"
                    className="w-full h-full object-cover rounded-lg hover:scale-105 transition-transform"
                  />
                </div>
                <div className="w-1/4 p-1 aspect-square flex-shrink-0">
                  <img
                    src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/7-TDZQrw5MJ7F6E1PmyHBDTtVPfNotpU.jpg"
                    alt="Backyard party with hibachi"
                    className="w-full h-full object-cover rounded-lg hover:scale-105 transition-transform"
                  />
                </div>
                <div className="w-1/4 p-1 aspect-square flex-shrink-0">
                  <img
                    src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/9-qHeyNSeSAqYXM7I48CSkphbX7otGg4.jpg"
                    alt="Chef preparing food for guests"
                    className="w-full h-full object-cover rounded-lg hover:scale-105 transition-transform"
                  />
                </div>
                <div className="w-1/4 p-1 aspect-square flex-shrink-0">
                  <img
                    src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/10-J7UoyKbxWTbhf21D1MIAUmZDztkwuY.jpg"
                    alt="Indoor hibachi setup"
                    className="w-full h-full object-cover rounded-lg hover:scale-105 transition-transform"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Button asChild variant="outline" size="lg" className="rounded-full border-2 hover:bg-background/5">
              <Link href="/gallery">View Full Gallery</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Banner - Softer colors */}
      <section className="py-16 bg-gradient-to-r from-[#F9A77C]/90 to-[#FDC5A7]/90 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-6">Ready for an Unforgettable Experience?</h2>
          <p className="text-xl max-w-2xl mx-auto mb-8 font-sans tracking-wide">
            Book your hibachi experience today and surprise your guests with a unique culinary adventure.
          </p>
          <Button
            asChild
            size="lg"
            className="text-lg bg-white text-[#F9A77C] hover:bg-white/90 hover:text-[#F4B6A0] rounded-full shadow-sm border-2 border-white"
          >
            <Link href="/book">Book Your Experience</Link>
          </Button>
        </div>
      </section>
    </>
  )
}
