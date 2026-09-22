import type { ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import LazyVideo from "@/components/lazy-video"
import LandingHero, { FIRST_MILES_FREE } from "@/components/city/landing-hero"
import LandingDiffs from "@/components/city/landing-diffs"
import { CheckList, FinalCta, LandingBody, LandingShell, SectionTitle } from "@/components/city/landing-parts"
import type { OccasionPage } from "@/config/occasion-pages"
import { GUEST_TIERS, MINIMUM_SPEND } from "@/config/pricing-rules"
import { phone } from "@/config/site"

// /party/{occasion} and /party/{occasion}/{city}. 2026-09-21: the first screen
// is the Joshua Tree one (photo hero + the card that asks for the phone first)
// instead of the range-only estimator that linked out to /quote - LA Occasions
// sends 7 of its 8 ad groups here. Everything under the hero is the page's own
// story, moments, included, reviews, FAQ and links, with the same headings.
// The old layout rendered the h1 twice (phone hero + desktop hero); now once.

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

export default function OccasionTemplate({ page, title, breadcrumb, intro, source, others, othersHeading, faqHeading, footnote }: OccasionTemplateProps) {
  const hero = page.photos[0]
  const second = page.photos[1]
  const label = page.occasion.toLowerCase()
  const chips = [`From $${GUEST_TIERS.adult.price.toFixed(2)}/adult`, "500+ parties", "Full refund up to 72h", "SoCal only — a local team"]

  const crumbs = (
    <nav aria-label="Breadcrumb">
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
    <LandingShell>
      <LandingHero
        breadcrumb={crumbs}
        kicker={`${page.occasion} · private hibachi chef`}
        title={title}
        subhead={page.subline}
        chips={chips}
        image={hero.src}
        imageAlt={hero.alt}
        imageClassName="object-[50%_40%] saturate-[1.12] contrast-[1.05]"
        estimator={{
          citySlug: "socal",
          cityName: "Southern California",
          source,
          travelNote: FIRST_MILES_FREE,
          cardLabel: `Your ${label}`,
          defaults: { adults: 10, kids: 2 },
        }}
      />

      <LandingBody>
        <LandingDiffs distanceLine="Most SoCal addresses carry no travel fee" />

        {/* ── Story ── */}
        <section className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-12">
          <div className="flex flex-col gap-3 text-[15px] leading-relaxed lg:text-[17px]">
            <p className="text-lg font-semibold leading-snug lg:hidden">{page.subline}</p>
            {intro.map((p, i) => (
              <p key={p.slice(0, 32)} className={i > 0 ? "text-clay-700" : ""}>
                {p}
              </p>
            ))}
          </div>
          <div className="grid grid-cols-[3fr_2fr] gap-3">
            {second ? (
              <div className="relative aspect-[3/4] overflow-hidden rounded-[28px]">
                <Image src={second.src} alt={second.alt} fill sizes="(max-width: 1024px) 60vw, 360px" className="object-cover saturate-[1.12]" />
              </div>
            ) : null}
            <div className={`relative overflow-hidden rounded-[28px] ${second ? "aspect-[2/3]" : "col-span-2 aspect-[4/3]"}`}>
              <LazyVideo className="absolute inset-0 h-full w-full object-cover" poster={page.video.poster} src={page.video.src} />
            </div>
          </div>
        </section>

        {/* ── Moments ── */}
        <section className="flex flex-col gap-3.5 lg:gap-5">
          <div className="flex flex-col gap-1.5">
            <SectionTitle>The moments we design</SectionTitle>
            <p className="text-sm text-clay-700 lg:text-base">Every {label} has a highlight. Our chefs build the show around yours.</p>
          </div>
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-3 lg:gap-4">
            {page.moments.map((m) => (
              <div key={m.title} className="flex flex-col gap-1 rounded-[28px] border border-ink/10 bg-surface p-4 shadow-organic lg:gap-1.5 lg:p-5">
                <h3 className="font-serif text-[17px] font-extrabold leading-tight lg:text-lg">{m.title}</h3>
                <p className="text-sm leading-relaxed text-clay-700">{m.description}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-2 lg:gap-14">
          {/* ── Included ── */}
          <section className="flex flex-col gap-3.5 lg:gap-4">
            <SectionTitle>Everything&apos;s included</SectionTitle>
            <CheckList items={INCLUDED} />
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
            <p className="text-xs text-clay-600">${MINIMUM_SPEND} event minimum · price range in 30 seconds, exact quote by text</p>
          </section>

          {/* ── Reviews ── */}
          <section className="flex flex-col gap-3 lg:gap-4">
            <SectionTitle aside="5-star Google reviews">What Our Guests Say</SectionTitle>
            {page.reviews.slice(0, 3).map((r) => (
              <blockquote key={r.name} className="flex flex-col gap-2 rounded-[28px] border border-ink/10 bg-surface p-4 shadow-organic lg:p-5">
                <p className="text-sm leading-relaxed lg:text-[15px]">{r.text}</p>
                <span className="text-xs text-clay-600 lg:text-[13px]">{r.name} · Google review</span>
              </blockquote>
            ))}
          </section>
        </div>

        {/* ── FAQ ── */}
        <section className="flex flex-col lg:max-w-[820px]">
          <h2 className="mb-1.5 font-serif text-[26px] font-extrabold leading-[1.1] lg:mb-2 lg:text-4xl">{faqHeading ?? `${page.occasion} FAQ`}</h2>
          {page.faqs.map((f, i) => (
            <details key={f.question} open={i === 0 || undefined} className="group border-b border-ink/15">
              <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 py-3.5 text-left [&::-webkit-details-marker]:hidden">
                <h3 className="font-sans text-[15px] font-semibold leading-snug tracking-normal lg:text-base">{f.question}</h3>
                <span className="text-xl leading-none text-flame transition group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="pb-4 text-sm leading-relaxed text-clay-700 lg:text-[15px]">{f.answer}</p>
            </details>
          ))}
          <p className="pt-3 text-[13px] text-clay-700">
            More questions?{" "}
            <Link href="/faq" className="text-flame-700 underline">
              See the full FAQ
            </Link>
          </p>
        </section>

        <FinalCta heading={`Ready to book your ${label}?`}>
          {/* ── Other occasions + cities ── */}
          <div className="flex flex-col gap-2.5 pt-6 lg:pt-8">
            <h2 className="font-serif text-xl font-extrabold leading-[1.1]">{othersHeading ?? "Other occasions"}</h2>
            <div className="flex flex-wrap gap-2">
              {others.map((o) => (
                <Link
                  key={o.href}
                  href={o.href}
                  className="inline-flex h-9 items-center whitespace-nowrap rounded-full border border-ink/10 bg-white px-3.5 text-[13px] font-semibold text-ink transition hover:border-flame-300 hover:bg-flame-100"
                >
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
          </div>
        </FinalCta>
      </LandingBody>
      <span className="sr-only">Or call {phone.voice.display}</span>
    </LandingShell>
  )
}
