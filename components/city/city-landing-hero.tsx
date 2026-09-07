import type { ReactNode } from "react"
import Image from "next/image"
import { Check, ChefHat, Clock, ShieldCheck, Star } from "lucide-react"
import LazyVideo from "@/components/lazy-video"
import CityQuoteCalculator from "@/components/city/city-quote-calculator"
import { PROOF_MEDIA } from "@/config/proof-media"
import type { GoogleReview } from "@/config/reviews"

// The first screen every paid visitor sees on a city / service landing page.
// Order is deliberate and matches what the ad promised: the price they clicked
// for, an estimator they can use in one tap, proof it's real, then the copy.
// Keep this component free of hooks so the async city pages can render it.

const TRUST = [
  { icon: Check, text: "Full deposit refund up to 72h" },
  { icon: ShieldCheck, text: "Licensed & Insured" },
  { icon: ChefHat, text: "Chef confirmed by name 48h ahead" },
  { icon: Clock, text: "Setup & cleanup included" },
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
    <section className="hero-section bg-gradient-to-r from-amber-50 to-orange-50 pb-10">
      <div className="container mx-auto px-4">
        <nav className="mb-4 pt-4 text-sm text-gray-500" aria-label="Breadcrumb">
          {breadcrumb}
        </nav>

        <div className="mx-auto max-w-3xl">
          <h1 className="text-center text-3xl font-serif font-bold leading-tight text-gray-900 md:text-5xl">{title}</h1>
          <p className="mx-auto mt-2 max-w-xl text-center text-sm text-gray-700 md:text-base">{subhead}</p>

          <div className="mt-4">
            <CityQuoteCalculator citySlug={citySlug} cityName={cityName} source={source} smsHref={smsHref} />
          </div>

          <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-600 sm:text-sm">
            {TRUST.map((item) => (
              <li key={item.text} className="flex items-center">
                <item.icon className="mr-1 h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {item.text}
              </li>
            ))}
          </ul>
        </div>

        {/* Real parties: one row, swipeable. Videos only load when they scroll in. */}
        <div
          className="-mx-4 mt-6 flex gap-3 overflow-x-auto px-4 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Photos and clips from real Real Hibachi parties"
        >
          {media.map((item) => (
            <div key={item.src} className="relative h-40 w-56 shrink-0 overflow-hidden rounded-xl bg-gray-100 sm:h-48 sm:w-72">
              {item.type === "video" ? (
                <LazyVideo className="absolute inset-0 h-full w-full object-cover" poster={item.poster} src={item.src} />
              ) : (
                <Image src={item.src} alt={item.alt} fill sizes="288px" className="object-cover" />
              )}
            </div>
          ))}
        </div>

        {/* Verbatim 5-star Google reviews (config/reviews.ts) — same corpus as /quote. */}
        <div className="mx-auto mt-6 max-w-5xl">
          <div className="flex items-center justify-center gap-1 text-xs text-gray-600 sm:text-sm">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
            ))}
            <span className="ml-1">5-star Google reviews from Southern California parties</span>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {reviews.map((review) => (
              <blockquote key={review.name} className="rounded-xl border border-amber-100 bg-white/90 p-4">
                <p className="text-sm leading-6 text-gray-700">{review.text}</p>
                <footer className="mt-2 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-sm font-bold text-white">
                    {review.name.charAt(0)}
                  </span>
                  <span className="text-xs text-gray-600">
                    <span className="font-medium text-gray-900">{review.name}</span> · Google review
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
