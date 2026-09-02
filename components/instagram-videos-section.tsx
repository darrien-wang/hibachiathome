"use client"

import { AnimateOnScroll } from "@/components/animate-on-scroll"
import { Button } from "@/components/ui/button"
import { Instagram, Play } from "lucide-react"
import { getLatestVideos, type InstagramVideo } from "@/config/instagram-videos"
import { trackEvent } from "@/lib/tracking"

interface InstagramVideosSectionProps {
  displayMode?: "grid" | "carousel" // kept for call-site compatibility; layout is always the strip
  maxVisible?: number
  showViewAll?: boolean
  title?: string
  subtitle?: string
}

// Compact reel strip: locally hosted cover stills that deep-link to the
// Instagram reels. Replaces the official embed.js cards, whose fixed chrome
// (header, action bar, "View more on Instagram") and letterboxing made the
// section enormous and janky — and cost a third-party script on every load.
export default function InstagramVideosSection({
  maxVisible = 6,
  showViewAll = true,
  title = "Real Events, Real Moments",
  subtitle = "See our recent hibachi experiences from satisfied customers",
}: InstagramVideosSectionProps) {
  const videos = getLatestVideos(maxVisible)

  const openReel = (video: InstagramVideo) => {
    trackEvent("social_video_engagement", {
      video_id: video.id,
      interaction_type: "open_instagram",
      video_source: "instagram_section",
    })
    if (video.embedUrl) window.open(video.embedUrl, "_blank", "noopener")
  }

  const openProfile = () => {
    trackEvent("social_video_engagement", {
      interaction_type: "open_profile",
      video_source: "instagram_section",
    })
  }

  return (
    <section className="py-12 bg-gradient-to-br from-gray-50 to-stone-100">
      <div className="container mx-auto px-4">
        <AnimateOnScroll direction="down">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Instagram className="h-6 w-6 text-pink-500" />
              <h2 className="text-2xl md:text-3xl font-serif font-bold">{title}</h2>
            </div>
            <p className="text-base text-gray-600 max-w-3xl mx-auto">{subtitle}</p>
          </div>
        </AnimateOnScroll>

        <AnimateOnScroll>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory md:grid md:grid-cols-6 md:gap-4 md:overflow-visible md:pb-0 md:mx-auto md:px-0 md:max-w-5xl">
            {videos.map((video) => (
              <button
                key={video.id}
                type="button"
                onClick={() => openReel(video)}
                aria-label={`Watch this hibachi event reel on Instagram${video.location ? ` — ${video.location}` : ""}`}
                className="group relative aspect-[9/16] w-36 shrink-0 snap-start overflow-hidden rounded-xl bg-black text-left shadow-md transition-shadow hover:shadow-xl md:w-auto"
              >
                <img
                  src={video.thumbnailUrl}
                  alt={video.caption}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
                <Instagram className="absolute right-2 top-2 h-4 w-4 text-white drop-shadow" />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="rounded-full bg-white/85 p-2.5 shadow-lg transition-transform duration-300 group-hover:scale-110">
                    <Play className="h-4 w-4 text-gray-900 ml-0.5" fill="currentColor" />
                  </span>
                </span>
                {video.location && (
                  <span className="absolute bottom-2 left-2 right-2 truncate text-[11px] font-medium text-white/95 drop-shadow">
                    {video.location}
                  </span>
                )}
              </button>
            ))}
          </div>
        </AnimateOnScroll>

        {showViewAll && (
          <AnimateOnScroll direction="up">
            <div className="mt-7 text-center">
              <Button
                asChild
                variant="outline"
                className="rounded-full border-2 border-pink-400 px-7 text-pink-600 hover:bg-pink-50"
                onClick={openProfile}
              >
                <a href="https://www.instagram.com/realhibachi/" target="_blank" rel="noopener noreferrer">
                  <Instagram className="mr-2 h-4 w-4" />
                  Follow @realhibachi
                </a>
              </Button>
            </div>
          </AnimateOnScroll>
        )}
      </div>
    </section>
  )
}
