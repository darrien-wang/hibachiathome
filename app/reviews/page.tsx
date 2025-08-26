import { Metadata } from "next"
import SMSReviews from "@/components/reviews/sms-reviews"
import { AnimateOnScroll } from "@/components/animate-on-scroll"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Customer Reviews - Real Hibachi At Home",
  description: "Read authentic reviews and testimonials from our satisfied customers. See real SMS feedback and ratings for our hibachi catering services.",
  keywords: "hibachi reviews, customer testimonials, hibachi catering feedback, SMS reviews, authentic customer experiences",
  openGraph: {
    title: "Real Customer Reviews - Hibachi At Home",
    description: "Discover what our customers really think about our hibachi catering services through authentic reviews and testimonials.",
    url: "https://realhibachiathome.com/reviews",
    images: ["/images/reviews/7.25 8pm.png"],
  },
  alternates: {
    canonical: "https://realhibachiathome.com/reviews"
  }
}

export default function ReviewsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Hero Section */}
      <section className="pt-32 pb-16 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <AnimateOnScroll>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Customer Reviews & Feedback
            </h1>
            <p className="text-xl md:text-2xl max-w-3xl mx-auto mb-8 opacity-90">
              Real voices from satisfied customers witnessing our professional hibachi service quality
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-orange-600 hover:bg-orange-700 text-white font-semibold">
                <Link href="/book">Experience Our Service</Link>
              </Button>
              <Button asChild size="lg" className="bg-white/20 backdrop-blur-sm border-white border-2 text-white hover:bg-white hover:text-blue-600 font-semibold">
                <Link href="sms:2137707788">Text for Quote</Link>
              </Button>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* SMS Reviews */}
      <SMSReviews />

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-orange-600 to-amber-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <AnimateOnScroll>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Experience Professional Service?
            </h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
              Join our satisfied customers and enjoy authentic hibachi at-home experience
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-white text-orange-600 hover:bg-orange-50 font-semibold shadow-lg">
                <Link href="/book">Book Now</Link>
              </Button>
              <Button asChild size="lg" className="bg-white/20 backdrop-blur-sm border-white border-2 text-white hover:bg-white hover:text-orange-600 font-semibold">
                <Link href="/menu">View Menu</Link>
              </Button>
            </div>
          </AnimateOnScroll>
        </div>
      </section>
    </div>
  )
}
