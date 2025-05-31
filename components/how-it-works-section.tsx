"use client"
import { useState, useEffect } from "react"
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
          <h2 className="text-4xl md:text-5xl font-energy font-bold text-center mb-16 tracking-wide">
            <span className="text-[#FFF4E0] drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">HOW THE </span>
            <span className="fire-text-gradient animate-pulse">FIRE STARTS</span>
          </h2>
        </AnimateOnScroll>

        {/* Desktop Timeline View */}
        <div className="hidden md:block relative">
          <div className="absolute top-32 left-0 right-0 h-2 fire-gradient z-0 rounded-full"></div>
          <div className="grid grid-cols-3 gap-8 relative z-10">
            {/* Step 1 */}
            <AnimateOnScroll delay={100} direction="up">
              <div
                className={`transform transition-all duration-500 ${animatedSteps[0] ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
              >
                <div className="bg-card rounded-2xl p-8 shadow-2xl hover:shadow-fire transition-all duration-300 hover:-translate-y-2 h-full border border-fire-bright/20 fire-glow-subtle">
                  <div className="flex justify-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full fire-gradient text-white text-3xl font-energy font-bold mb-8 shadow-lg animate-fireGlow">
                      1
                    </div>
                  </div>
                  <h3 className="text-2xl font-energy mb-4 text-center text-white">PICK YOUR MENU</h3>
                  <p className="text-muted-foreground font-sans tracking-wide text-center mb-8 leading-relaxed">
                    Select from our Basic or Buffet packages based on your preferences and budget.
                  </p>
                  <div className="text-center">
                    <Button
                      asChild
                      className="cta-secondary hover:fire-glow-intense transition-all duration-300 font-bold text-lg px-8 py-3"
                    >
                      <Link href="/menu">View Packages</Link>
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
                <div className="bg-card rounded-2xl p-8 shadow-2xl hover:shadow-fire transition-all duration-300 hover:-translate-y-2 h-full border border-fire-bright/20 fire-glow-subtle">
                  <div className="flex justify-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full fire-gradient text-white text-3xl font-energy font-bold mb-8 shadow-lg animate-fireGlow">
                      2
                    </div>
                  </div>
                  <h3 className="text-2xl font-energy mb-4 text-center text-white">RESERVE YOUR SPOT</h3>
                  <p className="text-muted-foreground font-sans tracking-wide text-center mb-8 leading-relaxed">
                    Choose your preferred date and time, and we'll confirm availability within 24 hours.
                  </p>
                  <div className="text-center">
                    <Button
                      asChild
                      className="cta-secondary hover:fire-glow-intense transition-all duration-300 font-bold text-lg px-8 py-3"
                    >
                      <Link href="/book">Check Availability</Link>
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
                <div className="bg-card rounded-2xl p-8 shadow-2xl hover:shadow-fire transition-all duration-300 hover:-translate-y-2 h-full border border-fire-bright/20 fire-glow-subtle">
                  <div className="flex justify-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full fire-gradient text-white text-3xl font-energy font-bold mb-8 shadow-lg animate-fireGlow">
                      3
                    </div>
                  </div>
                  <h3 className="text-2xl font-energy mb-4 text-center text-white">LET'S HIBACHI!</h3>
                  <p className="text-muted-foreground font-sans tracking-wide text-center mb-8 leading-relaxed">
                    Our chef arrives, sets up, performs, cooks, serves, and cleans up. You just enjoy!
                  </p>
                  <div className="text-center">
                    <Button
                      asChild
                      className="cta-primary hover:fire-glow-intense transition-all duration-300 font-bold text-lg px-8 py-3"
                    >
                      <Link href="/estimation">Get Started</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </AnimateOnScroll>
          </div>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-8">
          {/* Step 1 */}
          <AnimateOnScroll delay={100} direction="right">
            <div
              className={`transform transition-all duration-500 ${animatedSteps[0] ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
            >
              <div className="bg-card rounded-2xl p-6 shadow-2xl border border-fire-bright/20 fire-glow-subtle">
                <div className="flex items-start">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full fire-gradient text-white text-2xl font-energy font-bold mr-6 shadow-lg flex-shrink-0 animate-fireGlow">
                    1
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-3 text-white tracking-wide">PICK YOUR MENU</h3>
                    <p className="text-muted-foreground font-medium tracking-wide mb-4 leading-relaxed">
                      Select from our Basic or Buffet packages based on your preferences and budget.
                    </p>
                    <Button
                      asChild
                      className="cta-secondary hover:fire-glow-intense transition-all duration-300 font-bold w-full"
                    >
                      <Link href="/menu">View Packages</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </AnimateOnScroll>

          {/* Step 2 */}
          <AnimateOnScroll delay={200} direction="right">
            <div
              className={`transform transition-all duration-500 ${animatedSteps[1] ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
            >
              <div className="bg-card rounded-2xl p-6 shadow-2xl border border-fire-bright/20 fire-glow-subtle">
                <div className="flex items-start">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full fire-gradient text-white text-2xl font-energy font-bold mr-6 shadow-lg flex-shrink-0 animate-fireGlow">
                    2
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-3 text-white tracking-wide">RESERVE YOUR SPOT</h3>
                    <p className="text-muted-foreground font-medium tracking-wide mb-4 leading-relaxed">
                      Choose your preferred date and time, and we'll confirm availability within 24 hours.
                    </p>
                    <Button
                      asChild
                      className="cta-secondary hover:fire-glow-intense transition-all duration-300 font-bold w-full"
                    >
                      <Link href="/book">Check Availability</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </AnimateOnScroll>

          {/* Step 3 */}
          <AnimateOnScroll delay={300} direction="right">
            <div
              className={`transform transition-all duration-500 ${animatedSteps[2] ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
            >
              <div className="bg-card rounded-2xl p-6 shadow-2xl border border-fire-bright/20 fire-glow-subtle">
                <div className="flex items-start">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full fire-gradient text-white text-2xl font-energy font-bold mr-6 shadow-lg flex-shrink-0 animate-fireGlow">
                    3
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-3 text-white tracking-wide">LET'S HIBACHI!</h3>
                    <p className="text-muted-foreground font-medium tracking-wide mb-4 leading-relaxed">
                      Our chef arrives, sets up, performs, cooks, serves, and cleans up. You just enjoy!
                    </p>
                    <Button
                      asChild
                      className="cta-primary hover:fire-glow-intense transition-all duration-300 font-bold w-full"
                    >
                      <Link href="/estimation">Get Started</Link>
                    </Button>
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
