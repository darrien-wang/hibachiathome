"use client"
import React, { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AnimateOnScroll } from "@/components/animate-on-scroll"

export default function HowItWorksSection() {
  const [animatedSteps, setAnimatedSteps] = useState([false, false, false])
  const [animationTriggered, setAnimationTriggered] = useState(false)

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

  return (
    <section id="how-it-works" className="py-20 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100">
      <div className="container mx-auto px-4">
        <AnimateOnScroll direction="down">
          <h2 className="text-3xl md:text-4xl font-serif font-bold text-center mb-12">
            How It <span className="text-primary">Works</span>
          </h2>
        </AnimateOnScroll>
        {/* Desktop Timeline View */}
        <div className="hidden md:block relative">
          <div className="absolute top-24 left-0 right-0 h-1 bg-gradient-to-r from-amber-300 via-orange-400 to-amber-300 z-0"></div>
          <div className="grid grid-cols-3 gap-8 relative z-10">
            {/* Step 1 */}
            <AnimateOnScroll delay={100} direction="up">
              <div className={`transform transition-all duration-500 ${animatedSteps[0] ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}>
                <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full">
                  <div className="flex justify-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-2xl font-serif font-bold mb-6 shadow-md">1</div>
                  </div>
                  <h3 className="text-xl font-bold mb-3 font-serif text-center">Pick Your Menu</h3>
                  <p className="text-foreground/80 font-sans tracking-wide text-center mb-6">Select from our Basic or Buffet packages based on your preferences and budget.</p>
                  <div className="text-center">
                    <Button asChild variant="outline" size="sm" className="rounded-full border-amber-500 text-amber-600 hover:bg-amber-50">
                      <Link href="/menu">View Packages</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </AnimateOnScroll>
            {/* Step 2 */}
            <AnimateOnScroll delay={300} direction="up">
              <div className={`transform transition-all duration-500 ${animatedSteps[1] ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}>
                <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full">
                  <div className="flex justify-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-2xl font-serif font-bold mb-6 shadow-md">2</div>
                  </div>
                  <h3 className="text-xl font-bold mb-3 font-serif text-center">Reserve Your Spot</h3>
                  <p className="text-foreground/80 font-sans tracking-wide text-center mb-6">Choose your preferred date and time, and we'll confirm availability within 24 hours.</p>
                  <div className="text-center">
                    <Button asChild variant="outline" size="sm" className="rounded-full border-amber-500 text-amber-600 hover:bg-amber-50">
                      <Link href="/book">Check Availability</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </AnimateOnScroll>
            {/* Step 3 */}
            <AnimateOnScroll delay={500} direction="up">
              <div className={`transform transition-all duration-500 ${animatedSteps[2] ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}>
                <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full">
                  <div className="flex justify-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-2xl font-serif font-bold mb-6 shadow-md">3</div>
                  </div>
                  <h3 className="text-xl font-bold mb-3 font-serif text-center">Let's Hibachi!</h3>
                  <p className="text-foreground/80 font-sans tracking-wide text-center mb-6">Our chef arrives, sets up, performs, cooks, serves, and cleans up. You just enjoy!</p>
                  <div className="text-center">
                    <Button asChild variant="outline" size="sm" className="rounded-full border-amber-500 text-amber-600 hover:bg-amber-50">
                      <Link href="/estimation">Get Started</Link>
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
            <div className={`transform transition-all duration-500 ${animatedSteps[0] ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}>
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-start">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xl font-serif font-bold mr-4 shadow-md flex-shrink-0">1</div>
                  <div>
                    <h3 className="text-xl font-bold mb-2 font-serif">Pick Your Menu</h3>
                  </div>
                </div>
                <p className="text-foreground/80 font-sans tracking-wide">Select from our Basic or Buffet packages based on your preferences and budget.</p>
                <div className="mt-4">
                  <Button asChild variant="outline" className="rounded-full border-2 border-amber-500 text-amber-600 hover:bg-amber-50 w-full">
                    <Link href="/menu">View Packages</Link>
                  </Button>
                </div>
              </div>
            </div>
          </AnimateOnScroll>
          {/* Step 2 */}
          <AnimateOnScroll delay={200} direction="right">
            <div className={`transform transition-all duration-500 ${animatedSteps[1] ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}>
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-start">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xl font-serif font-bold mr-4 shadow-md flex-shrink-0">2</div>
                  <div>
                    <h3 className="text-xl font-bold mb-2 font-serif">Reserve Your Spot</h3>
                  </div>
                </div>
                <p className="text-foreground/80 font-sans tracking-wide">Choose your preferred date and time, and we'll confirm availability within 24 hours.</p>
                <div className="mt-4">
                  <Button asChild variant="outline" className="rounded-full border-2 border-amber-500 text-amber-600 hover:bg-amber-50 w-full">
                    <Link href="/book">Check Availability</Link>
                  </Button>
                </div>
              </div>
            </div>
          </AnimateOnScroll>
          {/* Step 3 */}
          <AnimateOnScroll delay={300} direction="right">
            <div className={`transform transition-all duration-500 ${animatedSteps[2] ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}>
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-start">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xl font-serif font-bold mr-4 shadow-md flex-shrink-0">3</div>
                  <div>
                    <h3 className="text-xl font-bold mb-2 font-serif">Let's Hibachi!</h3>
                  </div>
                </div>
                <p className="text-foreground/80 font-sans tracking-wide">Our chef arrives, sets up, performs, cooks, serves, and cleans up. You just enjoy!</p>
                <div className="mt-4">
                  <Button asChild variant="outline" className="rounded-full border-2 border-amber-500 text-amber-600 hover:bg-amber-50 w-full">
                    <Link href="/estimation">Get Started</Link>
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