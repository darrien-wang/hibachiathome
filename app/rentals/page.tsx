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

const ITEMS = [
  {
    name: "Tables, chairs & tablecloths",
    price: TABLES_CHAIRS_PER_GUEST,
    points: ["Seating for every guest", "Tablecloths on every table", "Set up before the chef starts, taken away after"],
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
    },
  },
] as const

export default function RentalsPage() {
  return (
    <main className="bg-cream text-ink">
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-2 md:items-center md:py-16">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-flame-700">Add-ons for your party</p>
          <h1 className="mt-3 text-3xl font-bold leading-tight md:text-5xl" style={{ textWrap: "balance" }}>
            Tables, chairs &amp; tableware, delivered with your chef
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-clay-700">
            Nothing to borrow or rent elsewhere. Add seating and place settings to your booking and we bring them, set
            them up, and take them away after the party.
          </p>
          <p className="mt-4 font-semibold">
            Both together: ${FULL_SETUP_PER_GUEST} per guest, the same price every day.
          </p>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
          <Image
            src="/gallery/real-hibachi-table-setup-black-linen-place-settings.jpg"
            alt="Real Hibachi tables and chairs set up in a U shape with black tablecloths, a gold runner, red and black place settings and roses, next to the chef's grill"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
            priority
          />
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-12 md:grid-cols-2">
        {ITEMS.map((item) => (
          <div key={item.name} className="rounded-2xl border border-ink/10 bg-surface p-6">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-xl font-bold">{item.name}</h2>
              <p className="shrink-0 text-lg font-bold text-flame-700">
                +${item.price}
                <span className="text-sm font-semibold text-clay-600"> / guest</span>
              </p>
            </div>
            {"photo" in item && item.photo ? (
              <div className="relative mt-4 aspect-[4/3] overflow-hidden rounded-xl">
                <Image
                  src={item.photo.src}
                  alt={item.photo.alt}
                  fill
                  sizes="(min-width: 768px) 45vw, 92vw"
                  className="object-cover"
                />
              </div>
            ) : null}
            <ul className="mt-4 space-y-2">
              {item.points.map((p) => (
                <li key={p} className="flex gap-2 text-clay-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-flame-600" aria-hidden="true" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16">
        <div className="rounded-2xl bg-cocoa p-6 text-cream md:flex md:items-center md:justify-between md:p-8">
          <div>
            <h2 className="text-xl font-bold md:text-2xl">Have your own tables? That&apos;s fine too.</h2>
            <p className="mt-2 text-cream/80">
              Rentals are optional and only come with a hibachi party. Add them when you get your quote.
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3 md:mt-0">
            <Link href="/quote" className="rounded-full bg-flame px-5 py-3 font-semibold text-white hover:bg-flame-600">
              Get your quote
            </Link>
            <Link href="/faq" className="rounded-full border border-cream/40 px-5 py-3 font-semibold hover:border-cream">
              Read the FAQ
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
