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
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100">
      {/* Hero Section */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-stone-50 via-white to-orange-50/30 relative overflow-hidden">
        {/* Subtle background elements */}
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-20 right-20 w-60 h-60 bg-orange-100/30 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-40 h-40 bg-amber-100/40 rounded-full blur-2xl"></div>
        </div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <AnimateOnScroll>
            <div className="mb-6">
              <div className="inline-flex items-center gap-3 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full shadow-lg border border-orange-100 mb-8">
                <div className="w-3 h-3 bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"></div>
                <span className="text-orange-600 font-medium">Customer Testimonials</span>
              </div>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-gray-900">
              Customer Reviews & <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">Feedback</span>
            </h1>
            <p className="text-xl md:text-2xl max-w-3xl mx-auto mb-8 text-gray-600">
              Real voices from satisfied customers witnessing our professional hibachi service quality
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300">
                <Link href="/book">Experience Our Service</Link>
              </Button>
              <Button asChild size="lg" className="bg-white border-2 border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-300 font-semibold shadow-md transition-all duration-300">
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
          </AnimateOnScroll>
        </div>
      </section>
    </div>
  )
}
