import type { ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import LazyVideo from "@/components/lazy-video"
import OccasionEstimator from "@/components/occasion/occasion-estimator"
import type { OccasionPage } from "@/config/occasion-pages"
import { GUEST_TIERS, MINIMUM_SPEND, DEPOSIT_AMOUNT } from "@/config/pricing-rules"
import { phone } from "@/config/site"

// /party/{occasion} and /party/{occasion}/{city} from the Claude Design
// "Realhibachi Party" board (2026-09-08): first screen = occasion + price +
// estimator; then the story, the designed moments (with the occasion clip),
// what's included, three verbatim reviews, FAQ, other occasions, cities.

const INCLUDED = [
  "Professional hibachi chef & mobile teppanyaki grill",
  "2 proteins per guest (chicken, steak, shrimp, salmon, or tofu)",
  "Garlic butter fried rice, fresh vegetables & house salad",
  "Live fire show, games, and chef entertainment",
  "Complete setup and cleanup",
]

const CITY_LINKS = [
  { slug: "los-angeles", name: "Los Angeles" },
  { slug: "san-diego", name: "San Diego" },
  { slug: "irvine", name: "Irvine" },
  { slug: "anaheim", name: "Anaheim" },
  { slug: "long-beach", name: "Long Beach" },
  { slug: "pasadena", name: "Pasadena" },
  { slug: "riverside", name: "Riverside" },
  { slug: "santa-monica", name: "Santa Monica" },
]

export type OccasionTemplateProps = {
  page: OccasionPage
  title: ReactNode
  breadcrumb: Array<{ label: string; href?: string }>
  /** Story paragraphs — the occasion intro, or the city-specific intro on combo pages. */
  intro: string[]
  source: string
  smsHref: string
  others: Array<{ label: string; href: string }>
  othersHeading?: string
  faqHeading?: string
  /** Extra cross-links rendered under "Where we cook it". */
  footnote?: ReactNode
}

export default function OccasionTemplate({ page, title, breadcrumb, intro, source, smsHref, others, othersHeading, faqHeading, footnote }: OccasionTemplateProps) {
  const hero = page.photos[0]
  const second = page.photos[1]
  const label = page.occasion.toLowerCase()
  const chips = [`From $${GUEST_TIERS.adult.price.toFixed(2)}/adult`, "500+ parties", "Full refund up to 72h"]

  const crumbs = (
    <nav aria-label="Breadcrumb" className="text-xs lg:text-[13px]">
      {breadcrumb.map((c, i) => (
        <span key={c.label}>
          {i > 0 ? " / " : ""}
          {c.href ? (
            <Link href={c.href} className="hover:underline">
              {c.label}
            </Link>
          ) : (
            c.label
          )}
        </span>
      ))}
    </nav>
  )

  return (
    <div className="bg-cream pb-28 text-ink lg:pb-16">
      {/* ── Phone hero: photo, gradient, breadcrumb, h1, tagline, chips ── */}
      <section className="relative isolate overflow-hidden bg-cocoa text-white lg:hidden">
        <Image src={hero.src} alt={hero.alt} fill priority sizes="100vw" className="object-cover object-[50%_40%] saturate-[1.12] contrast-[1.05]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(42,26,16,.55)_0%,rgba(42,26,16,.15)_30%,rgba(42,26,16,.55)_60%,#2a1a10_100%)]" />
        <div className="relative px-5 pb-9 pt-[calc(var(--header-height,60px)+120px)]">
          <div className="text-white/75">{crumbs}</div>
          <h1 className="mt-3 font-serif text-[38px] font-extrabold leading-[0.98] [text-shadow:0_2px_24px_rgba(0,0,0,.35)]">{title}</h1>
          <p className="mt-3 text-base leading-snug text-white/90">{page.subline}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            {chips.map((chip) => (
              <span key={chip} className="rounded-full border border-white/40 px-3 py-1.5">
                {chip}
              </span>
            ))}
          </div>
        </div>
      </section>
      <div className="relative z-[2] -mt-3.5 px-4 lg:hidden">
        <OccasionEstimator occasionLabel={label} source={source} smsHref={smsHref} />
      </div>

      <div className="mx-auto max-w-7xl px-5 pt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-14 lg:px-8 lg:pt-[calc(var(--header-height,72px)+40px)]">
        <div className="flex flex-col gap-8 lg:gap-9">
          {/* ── Desktop hero: text + two photos ── */}
          <div className="hidden lg:flex lg:flex-col lg:gap-3.5">
            <div className="text-clay-600">{crumbs}</div>
            <h1 className="font-serif text-[52px] font-extrabold leading-[0.98]">{title}</h1>
            <p className="text-xl leading-snug text-clay-700">{page.subline}</p>
            <div className="flex flex-wrap gap-2 text-[13px] font-semibold text-clay-700">
              {[...chips, "SoCal only — a local team"].map((chip) => (
                <span key={chip} className="rounded-full border border-ink/15 px-3 py-1.5">
                  {chip}
                </span>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-[3fr_2fr] gap-3">
              <div className="relative aspect-[3/2] overflow-hidden rounded-[28px]">
                <Image src={hero.src} alt={hero.alt} fill priority sizes="600px" className="object-cover saturate-[1.12]" />
              </div>
              <div className="relative aspect-square overflow-hidden rounded-[28px]">
                <LazyVideo className="absolute inset-0 h-full w-full object-cover" poster={page.video.poster} src={page.video.src} />
              </div>
            </div>
          </div>

          {/* ── Story ── */}
          <div className="flex flex-col gap-3 text-[15px] leading-relaxed lg:max-w-[680px] lg:text-[17px]">
            {intro.map((p, i) => (
              <p key={p.slice(0, 32)} className={i > 0 ? "text-clay-700" : ""}>
                {p}
              </p>
            ))}
          </div>

          {/* ── Moments + clip ── */}
          <section className="flex flex-col gap-3 lg:gap-3.5">
            <div>
              <h2 className="font-serif text-[26px] font-extrabold leading-[1.1] lg:text-[32px]">The moments we design</h2>
              <p className="mt-1.5 text-sm text-clay-700 lg:text-[15px]">Every {label} has a highlight. Our chefs build the show around yours.</p>
            </div>
            <div className="flex flex-col gap-3 lg:grid lg:grid-cols-3">
              {page.moments.map((m) => (
                <div key={m.title} className="flex flex-col gap-1 rounded-[28px] border border-ink/10 bg-surface p-4 shadow-organic lg:p-[18px] lg:gap-1.5">
                  <h3 className="font-serif text-[17px] font-extrabold leading-tight lg:text-lg">{m.title}</h3>
                  <p className="text-sm leading-relaxed text-clay-700">{m.description}</p>
                </div>
              ))}
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] lg:hidden">
              <LazyVideo className="absolute inset-0 h-full w-full object-cover" poster={page.video.poster} src={page.video.src} />
            </div>
            {second ? (
              <div className="relative hidden aspect-[21/9] overflow-hidden rounded-[28px] lg:block">
                <Image src={second.src} alt={second.alt} fill sizes="800px" className="object-cover saturate-[1.12]" />
              </div>
            ) : null}
          </section>

          {/* ── Included ── */}
          <section className="flex flex-col gap-3.5">
            <h2 className="font-serif text-[26px] font-extrabold leading-[1.1] lg:text-[32px]">Everything&apos;s included</h2>
            <div className="flex flex-col gap-2 text-sm leading-snug lg:text-[15px]">
              {INCLUDED.map((line) => (
                <div key={line} className="flex gap-2.5">
                  <span className="font-bold text-gold-700" aria-hidden="true">✓</span>
                  {line}
                </div>
              ))}
            </div>
            <div className="flex items-baseline gap-3.5">
              <span className="font-serif text-3xl font-extrabold leading-none">
                ${GUEST_TIERS.adult.price.toFixed(2)}
                <span className="font-sans text-sm font-medium text-clay-600">/adult</span>
              </span>
              <span className="font-serif text-3xl font-extrabold leading-none">
                ${GUEST_TIERS.child.price.toFixed(2)}
                <span className="font-sans text-sm font-medium text-clay-600">/child</span>
              </span>
            </div>
            <p className="text-xs text-clay-600">
              ${MINIMUM_SPEND} event minimum · ${DEPOSIT_AMOUNT.toFixed(2)} refundable deposit locks your date · exact quote in 30 seconds
            </p>
          </section>

          {/* ── Reviews ── */}
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-serif text-[26px] font-extrabold leading-[1.1] lg:text-[32px]">What Our Guests Say</h2>
              <span className="shrink-0 text-xs text-clay-600">5-star Google reviews</span>
            </div>
            <div className="flex flex-col gap-3 lg:grid lg:grid-cols-3">
              {page.reviews.slice(0, 3).map((r) => (
                <blockquote key={r.name} className="flex flex-col gap-2 rounded-[28px] border border-ink/10 bg-surface p-4 shadow-organic lg:p-[18px]">
                  <p className="text-sm leading-relaxed">{r.text}</p>
                  <span className="text-xs text-clay-600">{r.name} · Google review</span>
                </blockquote>
              ))}
            </div>
          </section>

          {/* ── FAQ ── */}
          <section className="flex flex-col gap-2 lg:max-w-[720px]">
            <h2 className="mb-1 font-serif text-[26px] font-extrabold leading-[1.1] lg:text-[32px]">{faqHeading ?? `${page.occasion} FAQ`}</h2>
            {page.faqs.map((f, i) => (
              <details key={f.question} open={i === 0 || undefined} className="group rounded-[22px] border border-ink/10 bg-white shadow-organic">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 lg:px-5 lg:py-4 [&::-webkit-details-marker]:hidden">
                  <h3 className="font-sans text-[15px] font-semibold leading-snug tracking-normal lg:text-base">{f.question}</h3>
                  <span className="text-xl leading-none text-flame transition group-open:rotate-45" aria-hidden="true">+</span>
                </summary>
                <p className="px-4 pb-4 text-sm leading-relaxed text-clay-700 lg:px-5 lg:pb-[18px] lg:text-[15px]">{f.answer}</p>
              </details>
            ))}
            <p className="mt-1 text-[13px] text-clay-700">
              More questions?{" "}
              <Link href="/faq" className="text-flame-700 underline">See the full FAQ</Link>
            </p>
          </section>

          {/* ── Other occasions + cities ── */}
          <section className="flex flex-col gap-2.5 lg:border-t lg:border-ink/10 lg:pt-3">
            <h2 className="font-serif text-xl font-extrabold leading-[1.1]">{othersHeading ?? "Other occasions"}</h2>
            <div className="flex flex-wrap gap-2">
              {others.map((o) => (
                <Link key={o.href} href={o.href} className="inline-flex h-9 items-center whitespace-nowrap rounded-full border border-ink/10 bg-white px-3.5 text-[13px] font-semibold text-ink transition hover:border-flame-300 hover:bg-flame-100">
                  {o.label}
                </Link>
              ))}
            </div>
            <p className="pt-1 text-xs leading-[1.7] text-clay-600 lg:text-[13px]">
              Where we cook it:{" "}
              {CITY_LINKS.map((c, i) => (
                <span key={c.slug}>
                  {i > 0 ? " · " : ""}
                  <Link href={`/hibachi-at-home/${c.slug}`} className="hover:text-flame-700">
                    {c.name}
                  </Link>
                </span>
              ))}
              {" · "}
              <Link href="/locations" className="hover:text-flame-700">
                All cities
              </Link>
            </p>
            {footnote ? <p className="text-xs leading-[1.7] text-clay-600 lg:text-[13px]">{footnote}</p> : null}
          </section>
        </div>

        {/* ── Desktop: sticky estimator ── */}
        <aside className="hidden lg:block">
          <div className="sticky top-[calc(var(--header-height,72px)+24px)]">
            <OccasionEstimator occasionLabel={label} source={source} smsHref={smsHref} />
          </div>
        </aside>
      </div>

      <OccasionEstimator occasionLabel={label} source={source} smsHref={smsHref} variant="sticky" />
      <span className="sr-only">Or call {phone.voice.display}</span>
    </div>
  )
}
