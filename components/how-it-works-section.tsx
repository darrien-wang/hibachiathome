"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AnimateOnScroll } from "@/components/animate-on-scroll"
import { MessageSquare, Calendar, CreditCard, ChefHat } from "lucide-react"

export default function HowItWorksSection() {
  const [animatedSteps, setAnimatedSteps] = useState([false, false, false, false])
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
          setTimeout(() => setAnimatedSteps([true, false, false, false]), 0)
          setTimeout(() => setAnimatedSteps([true, true, false, false]), 300)
          setTimeout(() => setAnimatedSteps([true, true, true, false]), 600)
          setTimeout(() => setAnimatedSteps([true, true, true, true]), 900)
        }
      }
    }
    window.addEventListener("scroll", handleScroll)
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [animationTriggered])

  // SMS template for availability check
  const availabilitySmsTemplate = `Hi, I'm interested in booking a hibachi party on [DATE]. Is this date available? I'm looking at [YOUR PACKAGE].`
  const availabilitySmsLink = `sms:+12137707788?body=${encodeURIComponent(availabilitySmsTemplate)}`

  // SMS template for booking details
  const bookingSmsTemplate = `Hi, I'd like to book a hibachi party on [DATE] at [TIME], at [LOCATION/ZIP CODE] for approximately [NUMBER] people. Can you help me arrange this?`
  const bookingSmsLink = `sms:+12137707788?body=${encodeURIComponent(bookingSmsTemplate)}`

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
        <AnimateOnScroll direction="down">
          <p className="text-center text-amber-100 mb-8 text-sm">Need custom details? Ask support directly and we will guide you.</p>
        </AnimateOnScroll>
        {/* Desktop Timeline View */}
        <div className="hidden md:block relative">
          <div className="absolute top-24 left-0 right-0 h-1 bg-gradient-to-r from-amber-300 via-orange-400 to-amber-300 z-0"></div>
          <div className="grid grid-cols-4 gap-3 md:gap-4 xl:gap-6 relative z-10">
            {/* Step 1 */}
            <AnimateOnScroll delay={100} direction="up">
              <div
                className={`transform transition-all duration-500 ${animatedSteps[0] ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
              >
                <div className="bg-white rounded-xl p-4 md:p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full min-h-[320px] flex flex-col">
                  <div className="flex justify-center">
                    <div className="inline-flex items-center justify-center w-12 md:w-16 h-12 md:h-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-lg md:text-2xl font-serif font-bold mb-4 md:mb-6 shadow-md">
                      1
                    </div>
                  </div>
                  <h3 className="text-lg md:text-xl font-bold mb-2 md:mb-3 font-serif text-center">Check Availability</h3>
                  <div className="flex-1 flex flex-col justify-between">
                    <p className="text-foreground/80 font-sans tracking-wide text-center mb-4 md:mb-6 text-sm md:text-base">
                      Theme: Date & Availability
                    </p>
                    <div className="text-center">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="rounded-full border-amber-500 text-amber-600 hover:bg-amber-50 flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4"
                    >
                      <a href={availabilitySmsLink}>
                        <MessageSquare className="h-3 w-3 md:h-4 md:w-4" />
                        <span>Check Availability</span>
                      </a>
                    </Button>
                    </div>
                  </div>
                </div>
              </div>
            </AnimateOnScroll>
            {/* Step 2 */}
            <AnimateOnScroll delay={300} direction="up">
              <div
                className={`transform transition-all duration-500 ${animatedSteps[1] ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
              >
                <div className="bg-white rounded-xl p-4 md:p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full min-h-[320px] flex flex-col">
                  <div className="flex justify-center">
                    <div className="inline-flex items-center justify-center w-12 md:w-16 h-12 md:h-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-lg md:text-2xl font-serif font-bold mb-4 md:mb-6 shadow-md">
                      2
                    </div>
                  </div>
                  <h3 className="text-lg md:text-xl font-bold mb-2 md:mb-3 font-serif text-center">Choose Your Details</h3>
                  <div className="flex-1 flex flex-col justify-between">
                    <p className="text-foreground/80 font-sans tracking-wide text-center mb-4 md:mb-6 text-sm md:text-base">
                      Theme: Guests & Menu
                    </p>
                    <div className="text-center">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="rounded-full border-amber-500 text-amber-600 hover:bg-amber-50 flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4"
                    >
                      <Link href="/menu">
                        <Calendar className="h-3 w-3 md:h-4 md:w-4" />
                        <span>View Menu</span>
                      </Link>
                    </Button>
                    </div>
                  </div>
                </div>
              </div>
            </AnimateOnScroll>
            {/* Step 3 */}
            <AnimateOnScroll delay={500} direction="up">
              <div
                className={`transform transition-all duration-500 ${animatedSteps[2] ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
              >
                <div className="bg-white rounded-xl p-4 md:p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full min-h-[320px] flex flex-col">
                  <div className="flex justify-center">
                    <div className="inline-flex items-center justify-center w-12 md:w-16 h-12 md:h-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-lg md:text-2xl font-serif font-bold mb-4 md:mb-6 shadow-md">
                      3
                    </div>
                  </div>
                  <h3 className="text-lg md:text-xl font-bold mb-2 md:mb-3 font-serif text-center">Secure with Deposit</h3>
                  <div className="flex-1 flex flex-col justify-between">
                    <p className="text-foreground/80 font-sans tracking-wide text-center mb-4 md:mb-6 text-sm md:text-base">
                      Theme: Deposit & Confirmation
                    </p>
                    <div className="text-center">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="rounded-full border-amber-500 text-amber-600 hover:bg-amber-50 flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-4"
                    >
                      <Link href="/estimation">
                        <CreditCard className="h-3 w-3 md:h-4 md:w-4" />
                        <span>Reserve Now</span>
                      </Link>
                    </Button>
                    </div>
                  </div>
                </div>
              </div>
            </AnimateOnScroll>
            {/* Step 4 */}
            <AnimateOnScroll delay={700} direction="up">
              <div
                className={`transform transition-all duration-500 ${animatedSteps[3] ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
              >
                <div className="bg-white rounded-xl p-4 md:p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full min-h-[320px] flex flex-col">
                  <div className="flex justify-center">
                    <div className="inline-flex items-center justify-center w-12 md:w-16 h-12 md:h-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-lg md:text-2xl font-serif font-bold mb-4 md:mb-6 shadow-md">
                      4
                    </div>
                  </div>
                  <h3 className="text-lg md:text-xl font-bold mb-2 md:mb-3 font-serif text-center">Enjoy the Experience</h3>
                  <div className="flex-1 flex flex-col justify-between">
                    <p className="text-foreground/80 font-sans tracking-wide text-center mb-4 md:mb-6 text-sm md:text-base">
                      Theme: Event Day Experience
                    </p>
                    <div className="text-center">
                    <div className="inline-flex items-center gap-2 px-3 md:px-4 py-2 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-full animate-breathe">
                      <ChefHat className="h-3 w-3 md:h-4 md:w-4 text-amber-600" />
                      <span className="text-amber-700 font-medium text-xs md:text-sm">Chef On The Way</span>
                      <div className="flex space-x-1">
                        <div className="w-1 h-1 bg-amber-500 rounded-full animate-pulse"></div>
                        <div className="w-1 h-1 bg-amber-500 rounded-full animate-pulse [animation-delay:0.2s]"></div>
                        <div className="w-1 h-1 bg-amber-500 rounded-full animate-pulse [animation-delay:0.4s]"></div>
                      </div>
                    </div>
                    </div>
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
                    <h3 className="text-xl font-bold mb-2 font-serif">Check Availability</h3>
                  </div>
                </div>
                <p className="text-foreground/80 font-sans tracking-wide mt-2">Theme: Date & Availability</p>
                <div className="mt-4">
                  <Button
                    asChild
                    variant="outline"
                    className="rounded-full border-2 border-amber-500 text-amber-600 hover:bg-amber-50 w-full flex items-center justify-center gap-2"
                  >
                    <a href={availabilitySmsLink}>
                      <MessageSquare className="h-4 w-4" />
                      <span>Check Availability</span>
                    </a>
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
                    <h3 className="text-xl font-bold mb-2 font-serif">Choose Your Details</h3>
                  </div>
                </div>
                <p className="text-foreground/80 font-sans tracking-wide mt-2">Theme: Guests & Menu</p>
                <div className="mt-4">
                  <Button
                    asChild
                    variant="outline"
                    className="rounded-full border-2 border-amber-500 text-amber-600 hover:bg-amber-50 w-full flex items-center justify-center gap-2"
                  >
                    <Link href="/menu">
                      <Calendar className="h-4 w-4" />
                      <span>View Menu</span>
                    </Link>
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
                    <h3 className="text-xl font-bold mb-2 font-serif">Secure with Deposit</h3>
                  </div>
                </div>
                <p className="text-foreground/80 font-sans tracking-wide mt-2">Theme: Deposit & Confirmation</p>
                <div className="mt-4">
                  <Button
                    asChild
                    variant="outline"
                    className="rounded-full border-2 border-amber-500 text-amber-600 hover:bg-amber-50 w-full flex items-center justify-center gap-2"
                  >
                    <Link href="/estimation">
                      <CreditCard className="h-4 w-4" />
                      <span>Reserve Now</span>
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </AnimateOnScroll>

          {/* Step 4 */}
          <AnimateOnScroll delay={400} direction="right">
            <div
              className={`transform transition-all duration-500 ${animatedSteps[3] ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
            >
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-start">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xl font-serif font-bold mr-4 shadow-md flex-shrink-0">
                    4
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2 font-serif">Enjoy the Experience</h3>
                  </div>
                </div>
                <p className="text-foreground/80 font-sans tracking-wide mt-2">Theme: Event Day Experience</p>
                <div className="mt-4 flex justify-center">
                  <div className="inline-flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-full animate-breathe">
                    <ChefHat className="h-4 w-4 text-amber-600" />
                    <span className="text-amber-700 font-medium">Chef On The Way</span>
                    <div className="flex space-x-1">
                      <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></div>
                      <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse [animation-delay:0.2s]"></div>
                      <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse [animation-delay:0.4s]"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </div>
    </section>
  )
}
