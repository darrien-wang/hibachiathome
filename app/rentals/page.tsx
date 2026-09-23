import Image from "next/image"
import Link from "next/link"
import type { Metadata } from "next"
import { JsonLd } from "@/components/structured-data"
import { FULL_SETUP_PER_GUEST, TABLES_CHAIRS_PER_GUEST, UTENSILS_PER_GUEST, WHITE_CLOTH_PER_GUEST } from "@/config/pricing-rules"
import RentalsBuilder from "./RentalsBuilder"

// What we actually rent, and nothing else. Until 2026-09-17 this page was a
// template left over from the first build: per-table/per-chair prices, linens,
// a beverage station and string lights we have never offered, placeholder
// images - and AI assistants read it as fact (决策日志 D-0917-06). Prices come
// from config/pricing-rules.ts, the same source as /quote and the invoices.
//
// 2026-09-20: rebuilt from the Claude Design comp "Rentals Organic".
// 2026-09-23: rebuilt again from comp 4a704199 "Rentals Page" - the two
// read-only cards became a setup builder, and picking a table theme became a
// thing customers can do. Same money either way: $10 seating, $5 tableware,
// $15 together. Nothing here changes price, only what we know before we pack
// the van. The choice rides to /quote for a browser, or straight onto the
// order for someone who already booked (?lead_id=...).

export const metadata: Metadata = {
  title: "Tables, Chairs & Tableware for Your Hibachi Party",
  description: `Add tables, chairs and tablecloths ($${TABLES_CHAIRS_PER_GUEST}/guest) and plates & utensils ($${UTENSILS_PER_GUEST}/guest) to your at-home hibachi party in Southern California. Delivered with your chef, set up and taken away.`,
  alternates: { canonical: "https://www.realhibachi.com/rentals" },
  openGraph: {
    title: "Party Rentals | Real Hibachi",
    description: "Tables, chairs, tablecloths and tableware for your at-home hibachi party, delivered with your chef.",
    url: "https://www.realhibachi.com/rentals",
    siteName: "Real Hibachi",
    type: "website",
  },
}

const FAQS = [
  {
    q: "What's the difference between the two options?",
    a: `Tables & chairs ($${TABLES_CHAIRS_PER_GUEST}/guest) covers seating and tablecloths. Full setup ($${FULL_SETUP_PER_GUEST}/guest) adds plates, napkins and silverware at every seat, in the theme you choose.`,
  },
  {
    q: "Does picking a theme cost more?",
    a: `The plates never do — every theme costs the same. The only thing that changes the price is white linen: white tablecloths are $${WHITE_CLOTH_PER_GUEST} more per guest than black, so a theme that comes on white costs that much more. The builder shows it on the line before you decide.`,
  },
  {
    q: "When do you set up and take it away?",
    a: "Everything is set up before the chef starts and taken away after the party.",
  },
  { q: "Do you bring chopsticks?", a: "Chopsticks are available on request at no extra charge." },
  {
    q: "Can I rent tables without booking a chef?",
    a: "No. Rentals are optional and only come with a hibachi party.",
  },
]

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
}

export default function RentalsPage() {
  return (
    <>
      <JsonLd data={faqJsonLd} />
      <main className="bg-cream text-ink">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-12">
          {/* Hero: text hugs the left, the room we actually set holds the right. */}
          <section className="grid items-center gap-10 py-14 md:grid-cols-2 md:gap-20 md:py-24">
            <div>
              <span className="inline-block rounded-full bg-gold-100 px-4 py-1.5 text-xs font-semibold tracking-wide text-gold-800">
                Add-ons for your party
              </span>
              <h1
                className="mt-6 font-serif text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl"
                style={{ textWrap: "balance" }}
              >
                Tables, chairs &amp; tableware, delivered with your chef
              </h1>
              <p className="mt-7 max-w-[46ch] text-lg leading-relaxed text-clay-700">
                Nothing to borrow or rent elsewhere. Add seating and place settings to your booking and we bring them,
                set them up, and take them away after the party.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="#build"
                  className="rounded-full bg-flame px-6 py-3.5 font-semibold text-cream transition-colors hover:bg-flame-800"
                >
                  Choose your setup
                </a>
                <Link
                  href="/quote?source=rentals"
                  className="rounded-full bg-surface px-6 py-3.5 font-semibold text-ink transition-colors hover:bg-gold-100"
                >
                  Get your quote
                </Link>
              </div>
            </div>
            <figure className="m-0 aspect-[4/3] overflow-hidden rounded-[32px] bg-surface">
              <Image
                src="/gallery/real-hibachi-tables-chairs-black-linen-backyard.jpg"
                alt="Folding tables in a U shape under black fitted tablecloths with black folding chairs, set up on a backyard patio beside the Real Hibachi grill"
                width={1448}
                height={1086}
                sizes="(min-width: 768px) 46vw, 92vw"
                priority
                className="h-full w-full object-cover"
                style={{ objectPosition: "50% 50%" }}
              />
            </figure>
          </section>

          {/* The builder. Everything a customer can decide before we pack. */}
          <section id="build" className="scroll-mt-24 pb-20 md:pb-24">
            <div className="mb-8 flex max-w-[680px] flex-col gap-2">
              <h2 className="font-serif text-3xl font-extrabold leading-tight md:text-4xl">Choose your setup</h2>
              <p className="text-[17px] leading-relaxed text-clay-700">
                Two options. Bring your own plates, or let us set every place at the table.
              </p>
            </div>
            <RentalsBuilder />
          </section>

          <section className="grid items-start gap-6 pb-20 md:grid-cols-2 md:gap-20 md:pb-24">
            <h2 className="font-serif text-3xl font-extrabold leading-tight">
              Have your own tables? That&apos;s fine too.
            </h2>
            <p className="max-w-[46ch] text-[17px] leading-relaxed text-clay-700">
              Rentals are optional and only come with a hibachi party. Add them when you get your quote.
            </p>
          </section>

          <section className="mx-auto max-w-[760px] pb-20 md:pb-24">
            <h2 className="mb-6 font-serif text-3xl font-extrabold leading-tight md:text-4xl">Setup questions</h2>
            <div className="flex flex-col gap-3">
              {FAQS.map((f) => (
                <details key={f.q} className="group rounded-[24px] bg-surface px-6 py-4">
                  <summary className="cursor-pointer list-none font-semibold marker:content-none">{f.q}</summary>
                  <p className="mt-2.5 text-[15px] leading-relaxed text-clay-700">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="relative mb-16 grid items-center gap-8 overflow-hidden rounded-[32px] bg-flame p-10 text-cream md:grid-cols-2 md:p-16">
            <span
              className="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-flame-300/60"
              aria-hidden="true"
            />
            <h2 className="relative font-serif text-[32px] font-extrabold leading-[1.08] md:text-5xl">
              Seats, plates, chef. All delivered.
            </h2>
            <div className="relative flex flex-wrap gap-3 md:justify-end">
              <Link
                href="/quote"
                className="rounded-full bg-cream px-6 py-3.5 font-semibold text-flame-800 transition-colors hover:bg-surface"
              >
                Get your quote
              </Link>
              <Link
                href="/faq"
                className="rounded-full border border-cream/60 px-6 py-3.5 font-semibold text-cream transition-colors hover:border-cream hover:bg-white/10"
              >
                Read the FAQ
              </Link>
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
