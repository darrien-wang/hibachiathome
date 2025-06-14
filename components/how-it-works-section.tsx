"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AnimateOnScroll } from "@/components/animate-on-scroll"
import { CheckCircle, MessageSquare, Calendar } from "lucide-react"

export default function HowItWorksSection() {
  const [animatedSteps, setAnimatedSteps] = useState([false, false, false])
  const [animationTriggered, setAnimationTriggered] = useState(false)
  const [/* remove */ todayFormatted, /* remove */ setTodayFormatted] = useState("")

  useEffect(() => {
    const handleScroll = () => {
      const section = document.getElementById("how-it-works")
      if (section && !animationTriggered) {
        const sectionTop = section.getBoundingClientRect().top
        const windowHeight = window.innerHeight
        if (sectionTop < windowHeight * 0.75) {
          setAnimationTriggered(true)
          setTimeout(() => setAnimatedSteps([true, false, false]), 0)
          setTimeout(() => setAnimatedSteps([true, true, false]), 300)
          setTimeout(() => setAnimatedSteps([true, true, true]), 600)
        }
      }
    }
    window.addEventListener("scroll", handleScroll)
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [animationTriggered])

  /* Remove this useEffect block entirely:
  useEffect(() => {
    // Function to format today's date as MM/DD
    const getTodayFormatted = () => {
      const today = new Date()
      return `${today.getMonth() + 1}/${today.getDate()}`
    }
    setTodayFormatted(getTodayFormatted())
  }, [])
  */

  // SMS template for availability check
  const availabilitySmsTemplate = `Hi, I'm interested in booking a hibachi party on [DATE]. Is this date available? I'm looking at [YOUR PACKAGE].`
  const availabilitySmsLink = `sms:+15627134832?body=${encodeURIComponent(availabilitySmsTemplate)}`

  // SMS template for booking details
  const bookingSmsTemplate = `Hi, I'd like to book a hibachi party on [DATE] at [TIME], at [LOCATION/ZIP CODE] for approximately [NUMBER] people. Can you help me arrange this?`
  const bookingSmsLink = `sms:+15627134832?body=${encodeURIComponent(bookingSmsTemplate)}`

  return (
    <section id="how-it-works" className="py-20 relative overflow-hidden">
      <video
        className="absolute top-0 left-0 w-full h-full object-cover z-0 opacity-60"
        autoPlay
        muted
        loop
        playsInline
        src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachi%20video/smallfire-EtpxGU9GpXZMkOHfBSrfm4qWNxXChh.mp4"
      />
      <div className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-30 z-10"></div>
      <div className="container mx-auto px-4 relative z-20">
        {/* Show Up Package Highlight Box */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl p-6 mb-12 shadow-lg border-l-4 border-amber-500 max-w-3xl mx-auto">
          <h3 className="text-2xl md:text-3xl font-bold mb-3 text-amber-700 font-serif">
            Throw a Hibachi Party in 3 Minutes – Just Show Up!
          </h3>
          <p className="text-gray-700 mb-6 text-lg">
            Planning a party has never been this easy. With our Show Up Package, you get everything you need — without
            lifting a finger.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              <span className="text-gray-800">Professional chef</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              <span className="text-gray-800">All food & ingredients</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              <span className="text-gray-800">Teppanyaki grill & gas</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              <span className="text-gray-800">Tables & chairs</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              <span className="text-gray-800">Plates & utensils</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              <span className="text-gray-800">Sake & beverages</span>
            </div>
          </div>
          <p className="text-gray-700 font-medium text-center text-lg border-t border-gray-200 pt-4">
            We handle the setup, cooking, serving, and cleanup.
            <br />
            <span className="font-bold text-amber-700">You just show up, and enjoy.</span>
          </p>
        </div>

        <AnimateOnScroll direction="down">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-center mb-12 text-white">
            How to <span className="text-amber-300">Throw a Party in 3 Minutes</span>?
          </h2>
        </AnimateOnScroll>
        {/* Desktop Timeline View */}
        <div className="hidden md:block relative">
          <div className="absolute top-24 left-0 right-0 h-1 bg-gradient-to-r from-amber-300 via-orange-400 to-amber-300 z-0"></div>
          <div className="grid grid-cols-3 gap-8 relative z-10">
            {/* Step 1 */}
            <AnimateOnScroll delay={100} direction="up">
              <div
                className={`transform transition-all duration-500 ${animatedSteps[0] ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
              >
                <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full">
                  <div className="flex justify-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-2xl font-serif font-bold mb-6 shadow-md">
                      1
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-3 font-serif text-center">Pick Your Menu</h3>
                  <p className="text-foreground/80 font-sans tracking-wide text-center mb-6">
                    Choose our Show Up package or select from other available packages. Tell us your preferred proteins.
                  </p>
                  <div className="text-center">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="rounded-full border-amber-500 text-amber-600 hover:bg-amber-50"
                    >
                      <Link href="/menu">View Menu</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </AnimateOnScroll>
            {/* Step 2 */}
            <AnimateOnScroll delay={300} direction="up">
              <div
                className={`transform transition-all duration-500 ${animatedSteps[1] ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
              >
                <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full">
                  <div className="flex justify-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-2xl font-serif font-bold mb-6 shadow-md">
                      2
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-3 font-serif text-center">Check Availability</h3>
                  <p className="text-foreground/80 font-sans tracking-wide text-center mb-6">
                    Send us a quick text to check if your preferred date is available. We'll respond within hours.
                  </p>
                  <div className="text-center">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="rounded-full border-amber-500 text-amber-600 hover:bg-amber-50 flex items-center gap-2"
                    >
                      <a href={availabilitySmsLink}>
                        <MessageSquare className="h-4 w-4" />
                        <span>Text for Availability</span>
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </AnimateOnScroll>
            {/* Step 3 */}
            <AnimateOnScroll delay={500} direction="up">
              <div
                className={`transform transition-all duration-500 ${animatedSteps[2] ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
              >
                <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full">
                  <div className="flex justify-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-2xl font-serif font-bold mb-6 shadow-md">
                      3
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-3 font-serif text-center">Book Your Party</h3>
                  <p className="text-foreground/80 font-sans tracking-wide text-center mb-6">
                    Send us your party details including date, time, location, and number of guests. We'll handle the
                    rest!
                  </p>
                  <div className="text-center">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="rounded-full border-amber-500 text-amber-600 hover:bg-amber-50 flex items-center gap-2"
                    >
                      <a href={bookingSmsLink}>
                        <Calendar className="h-4 w-4" />
                        <span>Book Your Party</span>
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </AnimateOnScroll>
          </div>
        </div>
        {/* Mobile Card View */}
        <div className="md:hidden space-y-6">
          {/* Step 1 */}
          <AnimateOnScroll delay={100} direction="right">
            <div
              className={`transform transition-all duration-500 ${animatedSteps[0] ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
            >
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-start">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xl font-serif font-bold mr-4 shadow-md flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2 font-serif">Pick Your Menu</h3>
                  </div>
                </div>
                <p className="text-foreground/80 font-sans tracking-wide mt-2">
                  Choose our Show Up package (or select from other available packages) and tell us your preferred
                  proteins.
                </p>
                <div className="mt-4">
                  <Button
                    asChild
                    variant="outline"
                    className="rounded-full border-2 border-amber-500 text-amber-600 hover:bg-amber-50 w-full"
                  >
                    <Link href="/menu">View Menu</Link>
                  </Button>
                </div>
              </div>
            </div>
          </AnimateOnScroll>
          {/* Step 2 */}
          <AnimateOnScroll delay={200} direction="right">
            <div
              className={`transform transition-all duration-500 ${animatedSteps[1] ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
            >
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-start">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xl font-serif font-bold mr-4 shadow-md flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2 font-serif">Check Availability</h3>
                  </div>
                </div>
                <p className="text-foreground/80 font-sans tracking-wide mt-2">
                  Send us a quick text to check if your preferred date is available. We'll respond within hours.
                </p>
                <div className="mt-4">
                  <Button
                    asChild
                    variant="outline"
                    className="rounded-full border-2 border-amber-500 text-amber-600 hover:bg-amber-50 w-full flex items-center justify-center gap-2"
                  >
                    <a href={availabilitySmsLink}>
                      <MessageSquare className="h-4 w-4" />
                      <span>Text for Availability</span>
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </AnimateOnScroll>

          {/* Step 3 */}
          <AnimateOnScroll delay={300} direction="right">
            <div
              className={`transform transition-all duration-500 ${animatedSteps[2] ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
            >
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-start">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xl font-serif font-bold mr-4 shadow-md flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2 font-serif">Book Your Party</h3>
                  </div>
                </div>
                <p className="text-foreground/80 font-sans tracking-wide mt-2">
                  Send us your party details including date, time, location, and number of guests. We'll handle the
                  rest!
                </p>
                <div className="mt-4">
                  <Button
                    asChild
                    variant="outline"
                    className="rounded-full border-2 border-amber-500 text-amber-600 hover:bg-amber-50 w-full flex items-center justify-center gap-2"
                  >
                    <a href={bookingSmsLink}>
                      <Calendar className="h-4 w-4" />
                      <span>Book Your Party</span>
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </div>
    </section>
  )
}
