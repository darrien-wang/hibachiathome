"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, Play } from "lucide-react"

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

/**
 * The planner demo, in the Organic design system.
 *
 * Two stages on purpose: a silent 30s teaser loops in a phone frame (the price
 * bar is cropped out of that cut), and tapping swaps it for the narrated
 * two-minute story. Nobody commits to two minutes of audio from a scroll, but
 * plenty of people will watch a loop and then ask for the sound.
 *
 * Sits after the pricing cards: someone who has just read the price is the
 * person most likely to care that the planning part is genuinely fun.
 */
export default function PartyPlannerSection() {
  const [playing, setPlaying] = useState(false)

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
    <section id="party-planner" className="scroll-mt-20 pt-9 lg:pt-24">
      <div className="mx-auto max-w-7xl px-5 lg:grid lg:grid-cols-2 lg:items-center lg:gap-14 lg:px-8">
        {/* Phone frame first on mobile — the video is the point of the section. */}
        <div className="mx-auto w-full max-w-[260px] lg:order-1 lg:max-w-[300px]">
          <div className="relative overflow-hidden rounded-[2.2rem] border-[10px] border-cocoa bg-cocoa shadow-organic-lg">
            {playing ? (
              <video
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
                  className="pointer-events-none block w-full aspect-[480/896] object-cover"
                  src="/videos/party-planner-teaser.mp4"
                  poster="/videos/posters/party-planner.jpg"
                />
                <span className="absolute inset-x-0 bottom-4 flex justify-center">
                  <span className="inline-flex items-center gap-2 rounded-full bg-cocoa/80 px-4 py-2 text-[13px] font-semibold text-white backdrop-blur-sm">
                    <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                    Watch with sound · 2 min
                  </span>
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 lg:mt-0">
          <h2 className="font-serif text-2xl font-extrabold lg:text-[40px]">Plan it like a game</h2>
          <p className="mt-2 text-base text-clay-700 lg:mt-3 lg:text-lg">
            Watch Maria seat 22 guests, let everyone pick their own proteins, and lock the date — all before her
            coffee got cold.
          </p>
          <Link
            href={PLANNER_URL}
            target="_blank"
            rel="noopener"
            onClick={handleCta}
            className="mt-4 inline-flex h-[52px] items-center gap-2 rounded-full bg-flame px-7 text-base font-semibold text-white transition hover:bg-flame-600 lg:mt-6 lg:h-14 lg:px-8 lg:text-[17px]"
          >
            Open the planner
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  )
}
