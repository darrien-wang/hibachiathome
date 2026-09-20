import Image from "next/image"
import Link from "next/link"
import type { Metadata } from "next"
import { Check } from "lucide-react"
import { FULL_SETUP_PER_GUEST, TABLES_CHAIRS_PER_GUEST, UTENSILS_PER_GUEST } from "@/config/pricing-rules"

// What we actually rent, and nothing else. Until 2026-09-17 this page was a
// template left over from the first build: per-table/per-chair prices, linens,
// a beverage station and string lights we have never offered, placeholder
// images - and AI assistants read it as fact (决策日志 D-0917-06). Prices come
// from config/pricing-rules.ts, the same source as /quote and the invoices.
//
// 2026-09-20: rebuilt from the Claude Design comp "Rentals Organic"
// (project df06fd05). Same Organic system as the rest of the site, so it is
// written in the site's own tokens rather than the comp's raw hexes: cream
// ground, flame as the accent, gold as the second voice, over-rounded
// containers, pills for anything small, photographs washed back into the page.

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

// The comp's `.washed` treatment: photographs sit back into the warm ground
// instead of on top of it. Softened from the system's own values because our
// photos are dark linen at dusk and the full wash flattened them.
const WASHED = "saturate(0.82) contrast(0.94) brightness(1.04)"

const ITEMS = [
  {
    name: "Tables, chairs & tablecloths",
    price: TABLES_CHAIRS_PER_GUEST,
    points: ["Seating for every guest", "Tablecloths on every table", "Set up before the chef starts, taken away after"],
    photo: {
      src: "/gallery/real-hibachi-table-setup-black-linen-place-settings.jpg",
      alt: "Tables in a U shape dressed in black linen with folding chairs, a gold runner and roses, ready before the party",
      position: "50% 70%",
    },
  },
  {
    name: "Plates & utensils",
    price: UTENSILS_PER_GUEST,
    points: ["A place setting for every guest", "Plates, napkins and silverware, ready at the table", "Chopsticks on request, no extra charge"],
    // Asked twice in one week: are these paper plates? They are not, and a
    // photo settles it faster than a sentence.
    photo: {
      src: "/gallery/real-hibachi-place-settings-hard-plastic-plates.jpg",
      alt: "Place settings on black tablecloths: white hard-plastic plates with a gold rim, gold cutlery, clear cups and sunflowers",
      position: "50% 65%",
    },
  },
] as const

export default function RentalsPage() {
  return (
    <main className="bg-cream text-ink">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-12">
        {/* Hero: text hugs the left, soft shapes hold the right. */}
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
              Nothing to borrow or rent elsewhere. Add seating and place settings to your booking and we bring them, set
              them up, and take them away after the party.
            </p>
            <div className="mt-8 inline-flex items-center gap-3.5 rounded-full bg-gold-100 py-3.5 pl-3.5 pr-6 text-gold-800">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-gold-500 font-serif text-[15px] font-bold text-cream">
                ${FULL_SETUP_PER_GUEST}
              </span>
              <span className="text-base font-semibold">Both together, per guest. Same price every day.</span>
            </div>
          </div>
          <div className="relative mx-auto aspect-[5/4] w-full max-w-[520px] md:justify-self-end" aria-hidden="true">
            <span className="absolute left-[8%] top-[6%] h-[62%] w-[62%] rounded-full bg-gold-200" />
            <span className="absolute bottom-[8%] right-[4%] h-[46%] w-[46%] rounded-full bg-flame-200" />
            <span className="absolute bottom-[4%] left-[38%] h-[26%] w-[26%] rounded-full bg-gold-500" />
          </div>
        </section>

        {/* What you can add, one card each, photo first. */}
        <section className="grid gap-8 pb-20 md:grid-cols-2 md:pb-24">
          {ITEMS.map((item) => (
            <article key={item.name} className="overflow-hidden rounded-[32px] bg-surface">
              <figure className="m-0 aspect-[3/2] overflow-hidden bg-cream">
                <Image
                  src={item.photo.src}
                  alt={item.photo.alt}
                  width={1448}
                  height={1086}
                  sizes="(min-width: 768px) 46vw, 92vw"
                  className="h-full w-full object-cover"
                  style={{ objectPosition: item.photo.position, filter: WASHED }}
                />
              </figure>
              <div className="flex flex-col gap-5 px-8 pb-8 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <h2 className="font-serif text-[28px] font-extrabold leading-tight">{item.name}</h2>
                  <span className="whitespace-nowrap rounded-full bg-flame-100 px-4 py-2 text-[15px] font-bold text-flame-800">
                    +${item.price} / guest
                  </span>
                </div>
                <ul className="flex list-none flex-col gap-3 p-0 text-base leading-relaxed">
                  {item.points.map((p) => (
                    <li key={p} className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-[22px] w-[22px] flex-none place-items-center rounded-full bg-gold-200 text-gold-800">
                        <Check className="h-3 w-3" strokeWidth={2.75} aria-hidden="true" />
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </section>

        <section className="grid items-start gap-6 pb-20 md:grid-cols-2 md:gap-20 md:pb-24">
          <h2 className="font-serif text-3xl font-extrabold leading-tight">Have your own tables? That&apos;s fine too.</h2>
          <p className="max-w-[46ch] text-[17px] leading-relaxed text-clay-700">
            Rentals are optional and only come with a hibachi party. Add them when you get your quote.
          </p>
        </section>

        <section className="relative mb-16 grid items-center gap-8 overflow-hidden rounded-[32px] bg-flame p-10 text-cream md:grid-cols-2 md:p-16">
          <span className="pointer-events-none absolute -bottom-32 -right-20 h-80 w-80 rounded-full bg-flame-300/60" aria-hidden="true" />
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
  )
}
