import type { ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { Accordion, FinalCta, SectionTitle } from "@/components/city/landing-parts"
import LandingDiffs from "@/components/city/landing-diffs"
import LandingHero, { FIRST_MILES_FREE, HERO_CHIPS } from "@/components/city/landing-hero"
import { TRAVEL_FREE_RADIUS_MILES } from "@/config/pricing-rules"
import { reviewSourceLabel, type GoogleReview } from "@/config/reviews"

// One template for every paid landing page — /hibachi-at-home/{city},
// /hibachi-catering/{city}, /mobile-hibachi, /private-hibachi-chef — from the
// Claude Design "Realhibachi Landing Page" board (2026-09-08). Conversion path
// first (city + price + one action in 3 seconds), differentiators right under
// it, then proof; the SEO long-form stays on the page inside folded
// <details> rows so it is indexed without sitting in the way.

export type LandingDetail = { title: string; body: ReactNode }
export type LandingFaq = { question: string; answer: string }
export type LandingLink = { label: string; href: string }

export type LandingTemplateProps = {
  city: string
  citySlug: string
  source?: string
  smsHref?: string
  kicker: string
  title: ReactNode
  subhead: string
  /** Driving miles (used only to decide included vs fee); the page never prints them. */
  distanceMiles?: number | null
  travelFee?: number | null
  /** Keep the page's own city in the estimate card even when ?loc= names the visitor's (config/geo-locations GEO_GREETING_SLUGS). */
  lockCity?: boolean
  reviews: GoogleReview[]
  included: string[]
  hoods: string[]
  hoodsHeading?: string
  bestEvening?: string | null
  details: LandingDetail[]
  detailsHeading?: string
  faqs: LandingFaq[]
  faqHeading?: string
  ctaHeading: string
  ctaBody?: string
  nearby: LandingLink[]
  nearbyLabel?: string
  /** Extra SEO copy (e.g. cross-links) rendered under the nearby row. */
  footnote?: ReactNode
  /**
   * Swap the hero for a shot that fits the place. Coastal pages use the beach
   * sunset table; everywhere else keeps the fire show, which is the stronger
   * image when there is no view to sell.
   */
  heroImage?: string
  heroAlt?: string
  /** Hero chips; defaults to the three every city page shows. */
  chips?: string[]
  /** "Every {city} booking includes" / "{city} hosts say" overrides for hub pages. */
  includedHeading?: string
  reviewsHeading?: string
  /** Estimate card starting headcount (default 15 adults). */
  estimatorDefaults?: { adults: number; kids: number }
  /** Page-specific sections (menu tabs, occasion moments, city grids),
   * rendered after "How it works" and before the local details + FAQ. */
  children?: ReactNode
}

// Hero image (2560px sharpened master of the fire-show shot) and the card's
// proof photo live in components/city/landing-hero.tsx since 2026-09-21.

const DISHES = [
  { src: "/images/menu/steak.jpg", label: "Steak 4.5 oz" },
  { src: "/images/menu/shrimp.jpg", label: "Shrimp 5 pcs" },
  { src: "/images/menu/chicken.jpg", label: "Chicken 5 oz" },
  { src: "/images/menu/salmon.jpg", label: "Salmon 4 oz" },
] as const

const STEPS = [
  { title: "Text yourself the quote", body: "Add your mobile and email, then pick guests and day — your exact price and discount code show on screen and arrive by text." },
  { title: "We confirm your date", body: "A real person replies by text, confirms the date and books your chef. Free to cancel with 72+ hours notice." },
  { title: "We bring the restaurant", body: "Chef arrives 10–30 min before start, lays a mat, sets the grill, performs, feeds everyone, cleans up." },
] as const


export default function LandingTemplate(props: LandingTemplateProps) {
  const {
    city,
    citySlug,
    heroImage,
    heroAlt,
    source,
    kicker,
    title,
    subhead,
    distanceMiles,
    travelFee,
    lockCity,
    reviews,
    included,
    hoods,
    hoodsHeading,
    bestEvening,
    details,
    detailsHeading,
    faqs,
    faqHeading,
    ctaHeading,
    ctaBody,
    nearby,
    nearbyLabel,
    footnote,
    chips,
    includedHeading,
    reviewsHeading,
    estimatorDefaults,
    children,
  } = props

  const noTravelFee = travelFee != null ? travelFee <= 0 : distanceMiles != null ? distanceMiles <= TRAVEL_FREE_RADIUS_MILES : null
  // noTravelFee === null: a hub page with no single distance (SoCal-wide).
  const travelLine =
    noTravelFee === false ? "travel fee shown upfront" : noTravelFee === true ? `no travel fee for ${city}` : `first ${TRAVEL_FREE_RADIUS_MILES} miles free`
  // Never says where the base is — only whether this city carries a fee.
  const distanceLine =
    noTravelFee === true
      ? `No travel fee for ${city}`
      : noTravelFee === false && travelFee != null
        ? `${city}: about $${travelFee} travel, shown in your quote`
        : "Most SoCal addresses carry no travel fee"

  return (
    <div className="bg-cream pb-28 text-ink lg:pb-16">
      <LandingHero
        kicker={kicker}
        title={title}
        subhead={
          <>
            {subhead} Setup &amp; cleanup included, {travelLine}.
          </>
        }
        chips={chips ?? HERO_CHIPS}
        image={heroImage}
        imageAlt={heroAlt ?? `Live hibachi fire show at a backyard party — hibachi at home in ${city}`}
        estimator={{
          citySlug,
          cityName: city,
          lockCity,
          source,
          travelFee,
          travelNote: noTravelFee === null ? FIRST_MILES_FREE : undefined,
          defaults: estimatorDefaults,
        }}
      />

      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 pt-8 lg:gap-[72px] lg:px-8 lg:pt-16">
        <LandingDiffs distanceLine={distanceLine} />

        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-2 lg:gap-14">
          {/* ── Included + menu ── */}
          <section className="flex flex-col gap-3.5 lg:gap-4 lg:order-1">
            <SectionTitle>{includedHeading ?? `Every ${city} booking includes`}</SectionTitle>
            <div className="flex flex-col gap-2 text-sm leading-snug lg:text-[15px] lg:gap-2.5">
              {included.map((line) => (
                <div key={line} className="flex gap-2.5">
                  <span className="font-bold text-gold-700" aria-hidden="true">✓</span>
                  {line}
                </div>
              ))}
            </div>
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-3 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
              {DISHES.map((dish) => (
                <div key={dish.src} className="flex w-24 shrink-0 flex-col gap-1.5 lg:w-auto">
                  <div className="relative aspect-square overflow-hidden rounded-full">
                    <Image src={dish.src} alt={dish.label} fill sizes="(max-width: 1024px) 96px, 140px" className="object-cover saturate-[1.15]" />
                  </div>
                  <span className="text-center text-xs font-semibold lg:text-[13px]">{dish.label}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-clay-600">Upgrades per guest: filet +$8 · scallops +$6 · lobster tail +$12</p>
          </section>

          {/* ── Reviews ── */}
          <section className="flex flex-col gap-3 lg:order-2 lg:gap-4">
            <SectionTitle aside="Google & Zola reviews">{reviewsHeading ?? `${city} hosts say`}</SectionTitle>
            {reviews.slice(0, 3).map((review, i) => (
              <blockquote key={review.name} className={`flex flex-col gap-2 rounded-[28px] border border-ink/10 bg-surface p-4 shadow-organic lg:p-5 ${i === 2 ? "hidden lg:flex" : ""}`}>
                <p className="text-sm leading-relaxed lg:text-[15px]">&ldquo;{review.text}&rdquo;</p>
                <span className="text-xs text-clay-600 lg:text-[13px]">{review.name} · {reviewSourceLabel(review)}</span>
              </blockquote>
            ))}
          </section>
        </div>

        {/* Page-specific sections sit between the pitch and the local detail. */}
        {children}

        {/* ── How it works ── */}
        <section className="flex flex-col gap-3.5 lg:gap-5">
          <SectionTitle>How it works</SectionTitle>
          <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-3 lg:gap-5">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex items-start gap-3.5 lg:gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-flame font-serif text-[15px] font-extrabold text-white lg:h-10 lg:w-10 lg:text-lg">
                  {i + 1}
                </span>
                <div>
                  <p className="text-[15px] font-semibold lg:text-[17px]">{step.title}</p>
                  <p className="text-[13px] leading-snug text-clay-700 lg:text-sm">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-2 lg:gap-14">
          {/* ── Local + details ── */}
          <section className="flex flex-col gap-3 lg:gap-3.5">
            <SectionTitle>{hoodsHeading ?? `Where we cook in ${city}`}</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {hoods.map((n) => (
                <span key={n} className="whitespace-nowrap rounded-full bg-surface px-3 py-1.5 text-xs lg:text-[13px]">
                  {n}
                </span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-2 gap-2.5 lg:gap-3">
              <div className="rounded-[28px] border border-ink/10 bg-surface p-3.5 shadow-organic lg:p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-clay-600">Best evening months</p>
                <p className="text-[15px] font-semibold lg:text-[17px]">{bestEvening || "April – November"}</p>
              </div>
              <div className="rounded-[28px] border border-ink/10 bg-surface p-3.5 shadow-organic lg:p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-clay-600">Space needed</p>
                <p className="text-[15px] font-semibold lg:text-[17px]">King-bed-size flat spot, outdoors</p>
              </div>
            </div>
            {details.length > 0 ? (
              <div className="pt-3">
                <p className="pb-1 text-xs font-bold uppercase tracking-[0.08em] text-clay-600">{detailsHeading ?? `${city} details`}</p>
                <Accordion items={details} idPrefix="detail" />
              </div>
            ) : null}
          </section>

          {/* ── FAQ ── */}
          <section className="flex flex-col">
            <h2 className="mb-1.5 font-serif text-[26px] font-extrabold leading-[1.1] lg:mb-2 lg:text-4xl">{faqHeading ?? `${city} hibachi FAQ`}</h2>
            <Accordion items={faqs.map((f) => ({ title: f.question, body: <p>{f.answer}</p> }))} idPrefix="faq" />
          </section>
        </div>

        {/* ── Final CTA ── */}
        <FinalCta heading={ctaHeading} body={ctaBody}>
          <div className="pt-6 text-xs leading-[1.8] text-clay-600 lg:flex lg:justify-between lg:pt-8 lg:text-[13px]">
            <div>
              <span className="font-semibold text-ink">{nearbyLabel ?? "Nearby"}:</span>{" "}
              {nearby.map((n, i) => (
                <span key={n.href}>
                  {i > 0 ? " · " : ""}
                  <Link href={n.href} className="hover:text-flame-700">
                    {n.label}
                  </Link>
                </span>
              ))}
              {nearby.length ? " · " : ""}
              <Link href="/locations" className="hover:text-flame-700">
                All service areas
              </Link>
            </div>
          </div>
          {footnote ? <div className="pt-2 text-xs leading-relaxed text-clay-600 lg:text-[13px]">{footnote}</div> : null}
        </FinalCta>
      </div>
    </div>
  )
}
