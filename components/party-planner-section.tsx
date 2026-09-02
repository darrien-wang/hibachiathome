"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, Check, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AnimateOnScroll } from "@/components/animate-on-scroll"
import LazyVideo from "@/components/lazy-video"
import { trackEvent } from "@/lib/tracking"

const PLANNER_URL =
  "https://party.realhibachi.com/order?utm_source=homepage&utm_medium=planner_section&utm_campaign=party_planner_video"

// Clarity smart events pair with the GA4 dataLayer events so the funnel is
// visible in both dashboards; the snippet loads via GTM so guard the global.
function clarityEvent(name: string) {
  try {
    ;(window as unknown as { clarity?: (cmd: string, name: string) => void }).clarity?.("event", name)
  } catch {
    /* Clarity not loaded */
  }
}

const featureBullets = [
  "Set who's coming — kids are half price, babies free",
  "Everyone picks their own proteins with a shared link",
  "Arrange tables & seats like a game, share an invite poster",
  "A $19.90 deposit locks your date & chef",
]

export default function PartyPlannerSection() {
  const [playing, setPlaying] = useState(false)
  const fullRef = useRef<HTMLVideoElement | null>(null)

  const handlePlay = () => {
    trackEvent("planner_video_play")
    clarityEvent("planner_video_play")
    setPlaying(true)
  }

  const handleCta = () => {
    trackEvent("planner_cta_click")
    clarityEvent("planner_cta_click")
  }

  return (
    <AnimateOnScroll>
      <section id="party-planner" className="py-16 bg-white scroll-mt-36 md:scroll-mt-44">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center max-w-6xl mx-auto">
            <AnimateOnScroll direction="left">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-[hsl(24_79%_55%)] mb-3">
                  Party Planner
                </p>
                <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-4">
                  Throw a Party in Minutes
                </h2>
                <p className="text-lg text-gray-600 mb-6">
                  Watch Maria plan her daughter&apos;s birthday for 22 guests — seats, menus, and the date
                  locked, all before her coffee got cold.
                </p>
                <div className="space-y-3 mb-8">
                  {featureBullets.map((item) => (
                    <div key={item} className="flex items-start gap-3 text-[15px] leading-relaxed text-gray-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(24_79%_42%)]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <Button
                  asChild
                  className="h-12 rounded-full bg-[hsl(24_79%_55%)] text-white hover:bg-[hsl(24_79%_48%)] px-8 text-base font-semibold shadow-md"
                  onClick={handleCta}
                >
                  <Link href={PLANNER_URL} target="_blank" rel="noopener">
                    Plan Your Party
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <p className="mt-4 text-sm text-gray-500">
                  Plans change? Our team is one text away — the planner just keeps everything organized.
                </p>
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll direction="right">
              <div className="mx-auto w-full max-w-[300px] md:max-w-[320px]">
                {/* phone frame */}
                <div className="relative rounded-[2.2rem] border-[10px] border-gray-900 bg-gray-900 shadow-2xl overflow-hidden">
                  {playing ? (
                    <video
                      ref={fullRef}
                      className="block w-full aspect-[780/1688]"
                      src="/videos/party-planner-story.mp4"
                      controls
                      autoPlay
                      playsInline
                      onEnded={() => {
                        trackEvent("planner_video_complete")
                        clarityEvent("planner_video_complete")
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      aria-label="Watch the party planner demo with sound"
                      className="relative block w-full cursor-pointer text-left"
                      onClick={handlePlay}
                    >
                      <LazyVideo
                        className="block w-full aspect-[480/896] object-cover pointer-events-none"
                        src="/videos/party-planner-teaser.mp4"
                        poster="/videos/posters/party-planner.jpg"
                      />
                      <span className="absolute inset-x-0 bottom-4 flex justify-center">
                        <span className="inline-flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm">
                          <Play className="h-4 w-4 fill-current" />
                          Watch with sound · 2 min
                        </span>
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </AnimateOnScroll>
          </div>
        </div>
      </section>
    </AnimateOnScroll>
  )
}
