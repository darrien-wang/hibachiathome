import type { ReactNode } from "react"
import Image from "next/image"
import { Check, ChefHat, Play, ShieldCheck, Star } from "lucide-react"
import LazyVideo from "@/components/lazy-video"
import CityQuoteCalculator from "@/components/city/city-quote-calculator"
import { PROOF_MEDIA } from "@/config/proof-media"
import { reviewSourceLabel, type GoogleReview } from "@/config/reviews"

// The first screen every paid visitor sees on a city / service landing page.
// Order is deliberate and matches what the ad promised: the price they clicked
// for, an estimator they can use in one tap, proof it's real, then the copy.
// Keep this component free of hooks so the async city pages can render it.

const TRUST = [
  { icon: Check, text: "Refund up to 72h" },
  { icon: ChefHat, text: "Chef named 48h ahead" },
  { icon: ShieldCheck, text: "Licensed & insured" },
] as const

export default function CityLandingHero({
  breadcrumb,
  title,
  subhead,
  citySlug,
  cityName,
  source,
  smsHref,
  reviews,
  proofCount = 6,
}: {
  breadcrumb: ReactNode
  title: ReactNode
  subhead: string
  citySlug: string
  cityName: string
  source?: string
  smsHref?: string
  reviews: GoogleReview[]
  proofCount?: number
}) {
  const media = PROOF_MEDIA.slice(0, proofCount)

  return (
    <section className="hero-section bg-cream pb-8">
      <div className="container mx-auto px-4">
        <nav className="mb-2 hidden pt-2 text-xs text-gray-500 md:block" aria-label="Breadcrumb">
          {breadcrumb}
        </nav>

        <div className="mx-auto max-w-3xl">
          <h1 className="text-center text-[26px] font-serif font-bold leading-tight text-gray-900 md:text-5xl">{title}</h1>
          <p className="mx-auto mt-1.5 hidden max-w-xl text-center text-gray-700 md:block md:text-base">{subhead}</p>

        {/* Real parties: one row, swipeable. Videos only load when they scroll in. */}
        <div
          className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 md:mt-5 md:gap-3 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Photos and clips from real Real Hibachi parties"
        >
          {media.map((item) => (
            <div key={item.src} className="relative h-[120px] w-[168px] shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:h-44 sm:w-64">
              {item.type === "video" ? (
                <>
                  <LazyVideo className="absolute inset-0 h-full w-full object-cover" poster={item.poster} src={item.src} />
                  <span className="pointer-events-none absolute bottom-2 left-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white">
                    <Play className="h-3 w-3 fill-white" aria-hidden="true" />
                  </span>
                </>
              ) : (
                <Image src={item.src} alt={item.alt} fill sizes="(max-width: 640px) 168px, 256px" className="object-cover" />
              )}
            </div>
          ))}
        </div>

          <div className="mt-3">
            <CityQuoteCalculator citySlug={citySlug} cityName={cityName} source={source} smsHref={smsHref} />
          </div>

          <ul className="mt-3 flex flex-wrap justify-center gap-1.5 text-[11px] text-gray-700 sm:text-sm">
            {TRUST.map((item) => (
              <li key={item.text} className="flex items-center rounded-full border border-ink/10 bg-surface px-2.5 py-1">
                <item.icon className="mr-1 h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {item.text}
              </li>
            ))}
          </ul>
        </div>

        {/* Verbatim 5-star Google reviews (config/reviews.ts) — same corpus as /quote. */}
        <div className="mx-auto mt-6 max-w-5xl">
          <div className="flex items-center justify-center gap-1 text-xs text-gray-600 sm:text-sm">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
            ))}
            <span className="ml-1">Google &amp; Zola reviews</span>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {reviews.map((review, i) => (
              <blockquote key={review.name} className={`rounded-2xl border border-ink/10 bg-surface p-4 ${i >= 2 ? "hidden md:block" : ""}`}>
                <p className="line-clamp-3 text-sm leading-6 text-gray-700 md:line-clamp-none">{review.text}</p>
                <footer className="mt-2 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-flame text-sm font-bold text-white">
                    {review.name.charAt(0)}
                  </span>
                  <span className="text-xs text-gray-600">
                    <span className="font-medium text-gray-900">{review.name}</span> · {reviewSourceLabel(review)}
                  </span>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
