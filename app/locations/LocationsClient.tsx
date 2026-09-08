"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"
import { phone } from "@/config/site"
import { trackEvent } from "@/lib/tracking"

// /locations from the Claude Design "Realhibachi Locations" board (2026-09-08):
// every city link rendered in the HTML (search / filter only hide), grouped
// by county under H2s, a dot per city for "travel included" vs "fee shown in
// quote", catering metros, three service-area questions, sticky quote CTA.

export type LocationCity = { name: string; slug: string; far: boolean }
export type LocationRegion = { id: string; name: string; short: string; note: string; cities: LocationCity[] }
export type CateringMetro = { name: string; slug: string }

const QUOTE_HREF = "/quote?source=locations"

const QUESTIONS = [
  {
    q: "How far do you travel?",
    a: "The first 50 miles of travel are included. Beyond that a travel fee of $1 per extra mile is calculated from your address and shown in your quote before any deposit.",
  },
  {
    q: "Do you serve San Diego and the desert?",
    a: "Yes — San Diego, La Jolla, Oceanside, Palm Springs, La Quinta, Joshua Tree and Big Bear Lake are all regular routes. These usually carry a travel fee, listed in the quote.",
  },
  {
    q: "What if my city isn't listed?",
    a: "We're expanding our service areas regularly. Enter your address in the quote tool or contact us to check if we can accommodate your location.",
    contact: true,
  },
]

export default function LocationsClient({ regions, catering }: { regions: LocationRegion[]; catering: CateringMetro[] }) {
  const [q, setQ] = useState("")
  const [region, setRegion] = useState("all")
  const ql = q.trim().toLowerCase()
  const total = regions.reduce((n, r) => n + r.cities.length, 0)

  const view = useMemo(
    () =>
      regions.map((r) => ({
        ...r,
        cities: r.cities.map((c) => ({ ...c, match: !ql || c.name.toLowerCase().includes(ql) })),
      })),
    [regions, ql],
  )
  const visible = view.reduce((n, r) => n + (region === "all" || region === r.id ? r.cities.filter((c) => c.match).length : 0), 0)
  const tabs = [{ id: "all", label: "All Southern California", count: total }, ...regions.map((r) => ({ id: r.id, label: r.short, count: r.cities.length }))]

  const onQuote = (surface: string) => () => trackEvent("lead_start", { contact_surface: surface })

  const searchBox = (big: boolean) => (
    <label className="relative block">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-clay-600" aria-hidden="true" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={big ? "Search your city…" : "Search your city or ZIP area…"}
        aria-label="Search cities"
        className={`w-full rounded-full border border-ink/10 bg-white pl-11 pr-4 text-[15px] text-ink outline-none placeholder:text-clay-600 focus:border-flame ${big ? "h-[50px]" : "h-12"}`}
      />
    </label>
  )

  const legend = (
    <div className="flex gap-4 text-xs text-clay-600 lg:text-[13px]">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-gold" /> Travel included
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-flame-300" /> Travel fee shown in quote
      </span>
    </div>
  )

  const dontSee = (
    <div className="flex flex-col gap-1.5 rounded-[28px] bg-gold-100 p-4 text-gold-800">
      <p className="text-sm font-bold">Don&apos;t see your area?</p>
      <p className="text-[13px] leading-relaxed">We&apos;re expanding our service areas regularly. Enter your address and we&apos;ll confirm the travel fee before you pay.</p>
      <Link href={QUOTE_HREF} onClick={onQuote("locations_card")} className="mt-1.5 inline-flex h-11 items-center justify-center rounded-full bg-flame text-sm font-bold text-white hover:bg-flame-600">
        Check my address
      </Link>
    </div>
  )

  const links = (
    <div className="text-xs leading-[1.7] text-clay-600 lg:text-[13px]">
      <Link href="/locations/la-orange-county" className="hover:text-flame-700">Learn more about Southern California service</Link>
      {" · "}
      <Link href="/hibachi-at-home" className="hover:text-flame-700">Hibachi at Home</Link>
      {" · "}
      <Link href="/hibachi-catering/los-angeles" className="hover:text-flame-700">Hibachi Catering</Link>
      {" · "}
      <Link href="/mobile-hibachi" className="hover:text-flame-700">Mobile Hibachi</Link>
      {" · "}
      <Link href="/private-hibachi-chef" className="hover:text-flame-700">Private Hibachi Chef</Link>
    </div>
  )

  return (
    <div className="bg-cream pb-28 text-ink lg:pb-[72px]">
      <div className="mx-auto max-w-7xl px-5 pt-[calc(var(--header-height,60px)+16px)] lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-14 lg:px-8 lg:pt-[calc(var(--header-height,72px)+48px)]">
        <aside className="hidden lg:block">
          <div className="sticky top-[calc(var(--header-height,72px)+24px)] flex flex-col gap-[18px]">
            <h1 className="font-serif text-[44px] font-extrabold leading-none">Hibachi at Home Service Locations</h1>
            <p className="text-[15px] leading-relaxed text-clay-700">
              We serve all of Southern California. Our professional chefs bring authentic Japanese teppanyaki experiences directly to your location.
            </p>
            {searchBox(true)}
            <div className="flex flex-col gap-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setRegion(t.id)}
                  aria-pressed={region === t.id}
                  className={`flex h-10 items-center justify-between rounded-full px-3.5 text-sm font-semibold transition ${region === t.id ? "bg-ink text-white" : "bg-white text-ink hover:bg-ink/5"}`}
                >
                  <span>{t.label}</span>
                  <span className="text-xs opacity-70">{t.count}</span>
                </button>
              ))}
            </div>
            {dontSee}
          </div>
        </aside>

        <div>
          <div className="flex flex-col gap-2.5 lg:hidden">
            <h1 className="font-serif text-[34px] font-extrabold leading-[1.02]">Hibachi at Home Service Locations</h1>
            <p className="text-[15px] leading-relaxed text-clay-700">
              We serve all of Southern California. Our professional chefs bring authentic Japanese teppanyaki experiences directly to your location.
            </p>
            <div className="flex flex-wrap gap-2 text-xs font-semibold text-clay-700">
              {[`${total} cities`, "6 counties", "50 mi travel free"].map((chip) => (
                <span key={chip} className="rounded-full border border-ink/15 px-3 py-1.5">
                  {chip}
                </span>
              ))}
            </div>
          </div>
          <div className="sticky top-[var(--header-height,60px)] z-[3] -mx-5 mt-4 flex flex-col gap-2.5 border-b border-ink/10 bg-cream px-5 pb-3 pt-3 lg:hidden">
            {searchBox(false)}
            <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setRegion(t.id)}
                  aria-pressed={region === t.id}
                  className={`h-[34px] shrink-0 whitespace-nowrap rounded-full border px-3.5 text-xs font-semibold transition ${region === t.id ? "border-ink bg-ink text-white" : "border-ink/15 bg-white text-ink"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-7 pt-3 lg:gap-10 lg:pt-0">
            {view.map((r) => {
              const show = (region === "all" || region === r.id) && r.cities.some((c) => c.match)
              return (
                <section key={r.id} className={`flex flex-col gap-2.5 lg:gap-3.5 ${show ? "" : "hidden"}`}>
                  <div className="flex items-baseline justify-between gap-3 lg:justify-start lg:gap-3.5">
                    <h2 className="font-serif text-[22px] font-extrabold leading-[1.1] lg:text-[28px]">{r.name}</h2>
                    <span className="text-xs text-clay-600 lg:text-[13px]">
                      {r.cities.length} cities<span className="hidden lg:inline"> · {r.note}</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:grid lg:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
                    {r.cities.map((c) => (
                      <Link
                        key={c.slug}
                        href={`/hibachi-at-home/${c.slug}`}
                        className={`items-center gap-2 rounded-full border border-ink/10 bg-white px-3.5 text-sm font-semibold text-ink transition hover:border-flame-300 hover:bg-flame-100 h-10 lg:h-[46px] lg:px-4 ${c.match ? "inline-flex" : "hidden"}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${c.far ? "bg-flame-300" : "bg-gold"}`} aria-hidden="true" />
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </section>
              )
            })}
            {visible === 0 ? (
              <div className="flex flex-col gap-2 rounded-[28px] border border-ink/10 bg-white p-[18px] shadow-organic lg:max-w-[520px] lg:p-[22px]">
                <p className="text-base font-bold lg:text-lg">No exact match for &ldquo;{q}&rdquo;</p>
                <p className="text-sm leading-relaxed text-clay-700">We still likely cover you — most of Southern California is within range. Get a quote and we&apos;ll confirm the travel fee before you pay.</p>
                <Link href={QUOTE_HREF} onClick={onQuote("locations_empty")} className="inline-flex h-[46px] items-center justify-center rounded-full bg-flame px-6 text-[15px] font-bold text-white lg:self-start">
                  Check my address
                </Link>
              </div>
            ) : null}
            {legend}

            <section className="flex flex-col gap-2.5 lg:gap-3.5 lg:border-t lg:border-ink/10 lg:pt-3">
              <div>
                <h2 className="font-serif text-[22px] font-extrabold leading-[1.1] lg:text-[28px]">Hibachi Catering by Metro</h2>
                <p className="mt-1 text-sm text-clay-700">
                  Bigger events, corporate parties, and full-service catering pages. Planning a specific celebration?{" "}
                  <Link href="/party" className="text-flame-700 underline">Browse party ideas by occasion</Link>.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-2.5">
                {catering.map((k) => (
                  <Link key={k.slug} href={`/hibachi-catering/${k.slug}`} className="flex flex-col rounded-[22px] border border-ink/10 bg-surface px-3.5 py-3 shadow-organic transition hover:border-flame-300 lg:px-4 lg:py-3.5">
                    <span className="text-sm font-bold lg:text-[15px]">{k.name}</span>
                    <span className="text-xs text-clay-600">Catering · 20+ guests</span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-2 lg:max-w-[720px] lg:gap-2.5">
              <h2 className="mb-1 font-serif text-[22px] font-extrabold leading-[1.1] lg:text-[28px]">Service area questions</h2>
              {QUESTIONS.map((item) => (
                <details key={item.q} className="group rounded-[22px] border border-ink/10 bg-surface px-4 py-3.5 shadow-organic lg:px-[18px] lg:py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span className="text-xl leading-none text-flame transition group-open:rotate-45" aria-hidden="true">+</span>
                  </summary>
                  <p className="pt-2 text-sm leading-relaxed text-clay-700">
                    {item.contact ? (
                      <>
                        We&apos;re expanding our service areas regularly. Enter your address in the quote tool or{" "}
                        <Link href="/contact" className="text-flame-700 underline">contact us</Link> to check if we can accommodate your location.
                      </>
                    ) : (
                      item.a
                    )}
                  </p>
                </details>
              ))}
              <div className="pt-1.5">{links}</div>
            </section>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 bg-[linear-gradient(180deg,rgba(247,239,226,0)_0%,#f7efe2_30%)] px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 lg:hidden">
        <a href={phone.voice.tel} onClick={() => trackEvent("phone_click", { contact_surface: "locations_sticky" })} className="inline-flex h-[50px] items-center rounded-full border border-ink/15 bg-white px-[18px] text-sm font-semibold text-ink">
          Call
        </a>
        <Link href={QUOTE_HREF} onClick={onQuote("locations_sticky")} className="flex h-[50px] flex-1 items-center justify-center rounded-full bg-flame text-[15px] font-bold text-white shadow-organic-lg">
          Get instant quote for my city
        </Link>
      </div>
    </div>
  )
}
