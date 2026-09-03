"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, Copy, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AnimateOnScroll } from "@/components/animate-on-scroll"
import { trackEvent } from "@/lib/tracking"
import { CLOTHS, PLATES, CHARGERS, COMING_SOON_SET } from "@/config/table-studio"

// URL state lives in plain location.search (read once on mount, written via
// replaceState) — deliberately NOT useSearchParams, which once bailed this
// site's pages out to client-side rendering. Links stay shareable either way.
function readParam(key: string): string | null {
  if (typeof window === "undefined") return null
  return new URLSearchParams(window.location.search).get(key)
}

export default function TableStudioClient() {
  const [clothId, setClothId] = useState(CLOTHS[0].id)
  const [chairCovers, setChairCovers] = useState(false)
  const [plateId, setPlateId] = useState(PLATES[0].id)
  const [chargerId, setChargerId] = useState(CHARGERS[0].id)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const c = readParam("cloth")
    if (c && CLOTHS.some((o) => o.id === c)) setClothId(c)
    if (readParam("chairs") === "1") setChairCovers(true)
    const p = readParam("plate")
    if (p && PLATES.some((o) => o.id === p)) setPlateId(p)
    const ch = readParam("charger")
    if (ch && CHARGERS.some((o) => o.id === ch)) setChargerId(ch)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const q = new URLSearchParams({ cloth: clothId, plate: plateId, charger: chargerId })
    if (chairCovers) q.set("chairs", "1")
    window.history.replaceState(null, "", `${window.location.pathname}?${q.toString()}`)
  }, [clothId, chairCovers, plateId, chargerId])

  const cloth = CLOTHS.find((o) => o.id === clothId) ?? CLOTHS[0]
  const plate = PLATES.find((o) => o.id === plateId) ?? PLATES[0]
  const charger = CHARGERS.find((o) => o.id === chargerId) ?? CHARGERS[0]
  const pricePerGuest = chairCovers ? cloth.priceWithChairCovers : cloth.pricePerGuest
  const onDarkCloth = cloth.id === "black"

  const copyLink = () => {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="bg-[#faf7f0] min-h-screen">
      <div className="container mx-auto px-4 py-14 max-w-5xl">
        {/* header */}
        <AnimateOnScroll direction="down">
          <div className="text-center mb-12">
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-[hsl(24_79%_55%)] mb-3">
              Table Studio · Preview
            </p>
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-gray-900">Design Your Table</h1>
            <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
              Pick your colors — we bring the tables, chairs, linens, and place settings, set everything up,
              and pack it all away. One price per guest, zero errands for you.
            </p>
          </div>
        </AnimateOnScroll>

        {/* step 1 — linens */}
        <AnimateOnScroll>
          <section className="mb-14">
            <h2 className="text-xl font-bold text-gray-900 mb-1">1 · Tables, chairs &amp; linens</h2>
            <p className="text-sm text-gray-600 mb-5">
              Black folding tables and chairs with fitted spandex skirting — the exact gear we bring.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl">
              {CLOTHS.map((option) => {
                const selected = option.id === clothId
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setClothId(option.id)}
                    aria-pressed={selected}
                    className={`rounded-2xl overflow-hidden bg-white text-left shadow-md transition-all ${
                      selected ? "ring-4 ring-[hsl(24_79%_55%)] shadow-xl" : "ring-1 ring-gray-200 hover:shadow-lg"
                    }`}
                  >
                    <img src={option.photo} alt={`${option.label} table cover`} className="w-full aspect-[16/10] object-cover bg-white" />
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="font-semibold text-gray-900">{option.label}</span>
                      {selected && <Check className="h-5 w-5 text-[hsl(24_79%_45%)]" />}
                    </div>
                  </button>
                )
              })}
            </div>

            <label className="mt-5 flex max-w-2xl cursor-pointer items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-gray-200">
              <span>
                <span className="font-semibold text-gray-900">Spandex chair covers</span>
                <span className="block text-sm text-gray-500">Fitted covers to match your linens</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={chairCovers}
                onClick={() => setChairCovers((v) => !v)}
                className={`relative h-7 w-12 rounded-full transition-colors ${chairCovers ? "bg-[hsl(24_79%_55%)]" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${chairCovers ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </label>

            <p className="mt-4 text-lg font-bold text-gray-900">
              ${pricePerGuest} <span className="text-sm font-semibold text-gray-500">per guest · tables + chairs + linens{chairCovers ? " + chair covers" : ""}, delivered &amp; set up</span>
            </p>
          </section>
        </AnimateOnScroll>

        {/* step 2 — place setting */}
        <AnimateOnScroll>
          <section className="mb-14">
            <h2 className="text-xl font-bold text-gray-900 mb-1">2 · Your place setting</h2>
            <p className="text-sm text-gray-600 mb-5">Every seat gets the same setting — pick the plate and charger.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start max-w-4xl">
              {/* live preview */}
              <div className="rounded-2xl p-6 shadow-lg transition-colors" style={{ background: cloth.hex }}>
                <svg viewBox="0 0 340 260" className="w-full" role="img" aria-label={`Place setting preview: ${plate.label} plate on a ${charger.label.toLowerCase()} charger over ${cloth.label.toLowerCase()} linens`}>
                  {/* placemat */}
                  <rect x="35" y="30" width="270" height="200" rx="14" fill="#d9c39a" opacity="0.95" />
                  <rect x="35" y="30" width="270" height="200" rx="14" fill="none" stroke="#b89f6f" strokeWidth="2" />
                  {/* charger */}
                  <circle cx="170" cy="130" r="86" fill={charger.hex} stroke={onDarkCloth ? "#ffffff33" : "#00000022"} strokeWidth="2" />
                  {/* plate */}
                  <circle cx="170" cy="130" r="66" fill={plate.hex} stroke="#00000022" strokeWidth="1.5" />
                  <circle cx="170" cy="130" r="50" fill="none" stroke={plate.id === "black" ? "#ffffff2e" : "#00000014"} strokeWidth="2" />
                  {/* chopsticks */}
                  <rect x="286" y="52" width="6" height="152" rx="3" fill="#8b5a2b" transform="rotate(4 289 128)" />
                  <rect x="298" y="52" width="6" height="152" rx="3" fill="#a06a35" transform="rotate(7 301 128)" />
                  {/* fork */}
                  <rect x="52" y="76" width="7" height="110" rx="3.5" fill="#b9bec6" />
                  <rect x="47" y="62" width="4" height="26" rx="2" fill="#b9bec6" />
                  <rect x="54" y="62" width="4" height="26" rx="2" fill="#b9bec6" />
                  <rect x="61" y="62" width="4" height="26" rx="2" fill="#b9bec6" />
                  {/* cup */}
                  <circle cx="262" cy="42" r="20" fill="#e8eef2" opacity="0.92" stroke="#9fb3bf" strokeWidth="2" />
                </svg>
                <p className={`mt-3 text-center text-xs font-semibold ${onDarkCloth ? "text-white/80" : "text-gray-600"}`}>
                  {plate.label} plate · {charger.label} charger · {cloth.label.toLowerCase()}
                </p>
              </div>

              {/* swatches */}
              <div className="space-y-7">
                <div>
                  <p className="font-semibold text-gray-900 mb-3">Plates</p>
                  <div className="flex gap-4">
                    {PLATES.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setPlateId(option.id)}
                        aria-pressed={option.id === plateId}
                        className="text-center"
                      >
                        <span
                          className={`block h-14 w-14 rounded-full border-4 transition-all ${
                            option.id === plateId ? "border-[hsl(24_79%_55%)] scale-110" : "border-gray-200"
                          }`}
                          style={{ background: option.hex }}
                        />
                        <span className="mt-1.5 block text-xs font-medium text-gray-600">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 mb-3">Charger plates</p>
                  <div className="flex gap-4">
                    {CHARGERS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setChargerId(option.id)}
                        aria-pressed={option.id === chargerId}
                        className="text-center"
                      >
                        <span
                          className={`block h-14 w-14 rounded-full border-4 transition-all ${
                            option.id === chargerId ? "border-[hsl(24_79%_55%)] scale-110" : "border-gray-200"
                          }`}
                          style={{ background: option.hex }}
                        />
                        <span className="mt-1.5 block text-xs font-medium text-gray-600">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-dashed border-gray-300 bg-white/60 px-4 py-3">
                  <p className="text-sm font-semibold text-gray-700">Full-set styling — coming soon</p>
                  <p className="mt-1 text-xs text-gray-500">{COMING_SOON_SET.join(" · ")}</p>
                </div>
              </div>
            </div>
          </section>
        </AnimateOnScroll>

        {/* place cards */}
        <AnimateOnScroll>
          <section className="mb-14">
            <h2 className="text-xl font-bold text-gray-900 mb-1">3 · Printed place cards</h2>
            <p className="text-sm text-gray-600 mb-5">
              We can print a card for every guest — their name, their menu picks, colors to match your table.
            </p>
            <div className="flex flex-wrap gap-5">
              {[
                { name: "Mia", menu: "Chicken · Shrimp", note: "Birthday girl 🎂" },
                { name: "Carlos", menu: "Steak (med-rare) · Chicken", note: "Extra noodles" },
                { name: "Ana", menu: "Salmon · Chicken", note: "No shellfish" },
              ].map((card) => (
                <div
                  key={card.name}
                  className="w-52 rounded-lg bg-white p-4 shadow-md"
                  style={{ borderTop: `6px solid ${charger.hex}` }}
                >
                  <p className="font-serif text-xl font-bold text-gray-900">{card.name}</p>
                  <p className="mt-1 text-sm text-gray-700">{card.menu}</p>
                  <p className="mt-0.5 text-xs font-medium" style={{ color: charger.hex === "#141414" ? "#8a6d3b" : charger.hex }}>
                    {card.note}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </AnimateOnScroll>

        {/* summary */}
        <AnimateOnScroll>
          <section className="rounded-2xl bg-white p-6 shadow-xl ring-1 ring-gray-200">
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-1">Your setup</p>
            <p className="text-lg font-bold text-gray-900">
              {cloth.label}{chairCovers ? " + chair covers" : ""} · {plate.label} plates · {charger.label} chargers
            </p>
            <p className="mt-1 text-2xl font-black text-[hsl(24_79%_45%)]">
              ${pricePerGuest}<span className="text-sm font-semibold text-gray-500"> per guest, all set up for you</span>
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                asChild
                className="h-12 rounded-full bg-[hsl(24_79%_55%)] px-8 text-base font-semibold text-white shadow-md hover:bg-[hsl(24_79%_48%)]"
                onClick={() => trackEvent("lead_start", { contact_surface: "table_studio" })}
              >
                <Link href="/quote?utm_source=table_studio">Get Instant Quote</Link>
              </Button>
              <Button variant="outline" className="h-12 rounded-full border-2 px-6" onClick={copyLink}>
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? "Link copied" : "Share this setup"}
              </Button>
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <Link2 className="h-3.5 w-3.5" /> Your color choices are saved in the link
              </span>
            </div>
            <p className="mt-4 text-xs text-gray-500">
              Preview page — styling options are confirmed with our team when you book. Table &amp; chair setup is
              optional; bring your own and skip the fee entirely.
            </p>
          </section>
        </AnimateOnScroll>
      </div>
    </div>
  )
}
