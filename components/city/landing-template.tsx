import type { ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import LandingEstimator from "@/components/city/landing-estimator"
import { phone } from "@/config/site"
import { DEPOSIT_AMOUNT, TRAVEL_FREE_RADIUS_MILES } from "@/config/pricing-rules"
import type { GoogleReview } from "@/config/reviews"

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
}

// 2560px sharpened/denoised master of gallery/…night-fire-show-18.jpg (the 48MP
// original is a soft phone upscale; served large it read as blur — 2026-09-08).
const HERO_IMG = "/images/hero/fire-show-hero.jpg"

const DISHES = [
  { src: "/images/menu/steak.jpg", label: "Steak 4.5 oz" },
  { src: "/images/menu/shrimp.jpg", label: "Shrimp 5 pcs" },
  { src: "/images/menu/chicken.jpg", label: "Chicken 5 oz" },
  { src: "/images/menu/salmon.jpg", label: "Salmon 4 oz" },
] as const

const STEPS = [
  { title: "Get an instant quote", body: "Date, guest count, address — price and any travel fee shown upfront." },
  { title: "Lock your date", body: `A $${DEPOSIT_AMOUNT.toFixed(2)} deposit reserves your chef. Full refund with 72+ hours notice.` },
  { title: "We bring the restaurant", body: "Chef arrives ~10 min early, sets up, performs, feeds everyone, cleans up." },
] as const

function Accordion({ items, idPrefix }: { items: Array<{ title: string; body: ReactNode }>; idPrefix: string }) {
  return (
    <div>
      {items.map((item, i) => (
        <details key={`${idPrefix}-${i}`} className="group border-b border-ink/15">
          <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 py-3.5 text-left text-[15px] font-semibold [&::-webkit-details-marker]:hidden lg:text-base">
            {item.title}
            <span className="text-xl leading-none text-flame transition group-open:rotate-45" aria-hidden="true">
              +
            </span>
          </summary>
          <div className="pb-4 text-sm leading-relaxed text-clay-700 [&>p+p]:mt-3">{item.body}</div>
        </details>
      ))}
    </div>
  )
}

function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 className="font-serif text-[26px] font-extrabold leading-[1.1] lg:text-4xl">{children}</h2>
      {aside ? <span className="shrink-0 text-xs text-clay-600 lg:text-[13px]">{aside}</span> : null}
    </div>
  )
}

export default function LandingTemplate(props: LandingTemplateProps) {
  const {
    city,
    citySlug,
    source,
    smsHref,
    kicker,
    title,
    subhead,
    distanceMiles,
    travelFee,
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
  } = props

  const noTravelFee = travelFee != null ? travelFee <= 0 : distanceMiles != null ? distanceMiles <= TRAVEL_FREE_RADIUS_MILES : null
  const travelLine = noTravelFee === false ? "travel fee shown upfront" : `no travel fee for ${city}`
  // Never says where the base is — only whether this city carries a fee.
  const distanceLine =
    noTravelFee === true
      ? `No travel fee for ${city}`
      : noTravelFee === false && travelFee != null
        ? `${city}: about $${travelFee} travel, shown in your quote`
        : "Most SoCal addresses carry no travel fee"

  const diffs = [
    { big: `$${DEPOSIT_AMOUNT.toFixed(2)}`, label: "deposit, not $150", body: "Full refund with 72h notice" },
    { big: `${TRAVEL_FREE_RADIUS_MILES} mi`, label: "of travel free", body: distanceLine },
    { big: "$0", label: "setup surcharge", body: "Tarp, setup and cleanup in the price" },
    { big: "48h", label: "chef named ahead", body: "If we ever cancel, double deposit back" },
  ]

  return (
    <div className="bg-cream pb-28 text-ink lg:pb-16">
      {/* ── Hero ── */}
      <section className="relative isolate overflow-hidden bg-cocoa text-white">
        <Image src={HERO_IMG} alt={`Live hibachi fire show at a backyard party — hibachi at home in ${city}`} fill priority quality={90} sizes="100vw" className="object-cover object-[60%_40%] saturate-[1.15] contrast-[1.06] lg:object-[center_45%]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(42,26,16,.6)_0%,rgba(42,26,16,.2)_30%,rgba(42,26,16,.5)_60%,#2a1a10_100%)] lg:bg-[linear-gradient(90deg,rgba(42,26,16,.9)_0%,rgba(42,26,16,.65)_50%,rgba(42,26,16,.25)_100%),linear-gradient(180deg,rgba(42,26,16,.3),transparent_30%,#2a1a10_100%)]" />
        <div className="relative mx-auto max-w-7xl px-5 pb-9 pt-[calc(var(--header-height,60px)+130px)] lg:grid lg:grid-cols-[1fr_400px] lg:items-center lg:gap-14 lg:px-8 lg:pb-[70px] lg:pt-[calc(var(--header-height,72px)+48px)]">
          <div className="flex flex-col gap-3 lg:gap-5">
            <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-flame-300 lg:text-[13px] lg:tracking-[0.14em]">{kicker}</span>
            <h1 className="font-serif text-[40px] font-extrabold leading-[0.98] [text-shadow:0_2px_24px_rgba(0,0,0,.35)] lg:text-[64px] lg:leading-[0.95]">{title}</h1>
            <p className="text-[15px] leading-relaxed text-white/85 lg:max-w-[520px] lg:text-lg">
              {subhead} Setup &amp; cleanup included, {travelLine}.
            </p>
            <div className="flex flex-wrap gap-2 text-[12px] font-semibold lg:text-[13px]">
              {[`$${DEPOSIT_AMOUNT.toFixed(2)} refundable deposit`, "Licensed & insured", "500+ parties"].map((chip) => (
                <span key={chip} className="rounded-full border border-white/40 px-3 py-1.5">
                  {chip}
                </span>
              ))}
            </div>
          </div>
          <div className="hidden lg:block">
            <LandingEstimator citySlug={citySlug} cityName={city} source={source} smsHref={smsHref} />
          </div>
        </div>
      </section>

      {/* Phones: the estimator overlaps the hero's bottom edge. */}
      <div className="relative z-[2] -mt-3.5 px-4 lg:hidden">
        <LandingEstimator citySlug={citySlug} cityName={city} source={source} smsHref={smsHref} />
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 pt-8 lg:gap-[72px] lg:px-8 lg:pt-16">
        {/* ── Differentiators ── */}
        <section className="flex flex-col gap-3.5">
          <h2 className="font-serif text-[26px] font-extrabold leading-[1.1] lg:sr-only">What your quote actually includes</h2>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
            {diffs.map((d) => (
              <div key={d.label} className="flex flex-col gap-1 rounded-[28px] border border-ink/10 bg-surface p-3.5 shadow-organic lg:p-[22px] lg:gap-1.5">
                <span className="font-serif text-2xl font-extrabold leading-none text-flame lg:text-[34px]">{d.big}</span>
                <span className="text-[13px] font-semibold lg:text-[15px]">{d.label}</span>
                <span className="text-xs leading-snug text-clay-600 lg:text-[13px]">{d.body}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-2 lg:gap-14">
          {/* ── Included + menu ── */}
          <section className="flex flex-col gap-3.5 lg:gap-4 lg:order-1">
            <SectionTitle>Every {city} booking includes</SectionTitle>
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
            <SectionTitle aside="Google reviews">{city} hosts say</SectionTitle>
            {reviews.slice(0, 3).map((review, i) => (
              <blockquote key={review.name} className={`flex flex-col gap-2 rounded-[28px] border border-ink/10 bg-surface p-4 shadow-organic lg:p-5 ${i === 2 ? "hidden lg:flex" : ""}`}>
                <p className="text-sm leading-relaxed lg:text-[15px]">&ldquo;{review.text}&rdquo;</p>
                <span className="text-xs text-clay-600 lg:text-[13px]">{review.name} · Google review</span>
              </blockquote>
            ))}
          </section>
        </div>

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
                <p className="text-[15px] font-semibold lg:text-[17px]">6×8 ft flat, outdoors</p>
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
        <section>
          <div className="flex flex-col gap-3 rounded-[28px] bg-cocoa px-5 py-6 text-white lg:flex-row lg:items-center lg:gap-8 lg:px-12 lg:py-11">
            <div className="flex flex-1 flex-col gap-2">
              <h2 className="font-serif text-[28px] font-extrabold leading-[1.05] lg:text-4xl">{ctaHeading}</h2>
              <p className="text-sm leading-relaxed text-white/80 lg:text-base">
                {ctaBody ?? `Date, guest count, address — done. A $${DEPOSIT_AMOUNT.toFixed(2)} deposit locks your chef.`}
              </p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Link
                href={`/quote?source=${source ?? `city_${citySlug.replace(/-/g, "_")}`}`}
                className="flex h-[50px] w-full items-center justify-center rounded-full bg-flame px-8 text-[15px] font-bold text-white transition hover:bg-flame-600 lg:h-14 lg:w-auto lg:text-[17px]"
              >
                Get instant quote
              </Link>
              <a href={phone.voice.tel} className="text-sm font-semibold text-flame-300">
                or call {phone.voice.display}
              </a>
            </div>
          </div>
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
        </section>
      </div>
    </div>
  )
}
