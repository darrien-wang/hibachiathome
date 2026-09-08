"use client"

import { useState } from "react"
import Image from "next/image"
import { PORTIONS } from "@/components/menu/portions-block"
import { sourcing, sourcingAllergenNote } from "@/config/sourcing"
import { GUEST_TIERS } from "@/config/pricing-rules"

// 2026-09-08 redesign: the menu as three tabs instead of six stacked sections.
// Regular proteins / premium upgrades / allergens, exact portions, sourcing spec.

type Tab = "proteins" | "portions" | "sourcing"

const REGULAR = [
  { name: "Chicken", desc: "Boneless breast, house marinade", qty: "5 oz", img: "/images/menu/chicken.jpg" },
  { name: "Steak", desc: "USDA Choice Angus top sirloin", qty: "4.5 oz", img: "/images/menu/steak.jpg" },
  { name: "Shrimp", desc: "Colossal 16/22, BAP-certified", qty: "5 pcs", img: "/images/menu/shrimp.jpg" },
  { name: "Salmon", desc: "Skinless Atlantic fillet", qty: "4 oz", img: "/images/menu/salmon.jpg" },
  { name: "Tofu", desc: "Firm, marinated and grilled", qty: "5 oz", img: "/images/menu/tofu.jpg" },
] as const

const PREMIUM = [
  { name: "Filet Mignon", desc: "4.5 oz", qty: "+$8" },
  { name: "Jumbo Scallops 10/20", desc: "4 oz", qty: "+$6" },
  { name: "Lobster Tail", desc: "6 oz wild-caught Caribbean spiny", qty: "+$12" },
] as const

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "proteins", label: "Proteins" },
  { id: "portions", label: "Portions" },
  { id: "sourcing", label: "Sourcing" },
]

export default function MenuTabs() {
  const [tab, setTab] = useState<Tab>("proteins")

  return (
    <div>
      <div className="sticky top-[var(--header-height,60px)] z-10 bg-cream py-3">
        <div role="tablist" aria-label="Menu sections" className="flex rounded-full bg-surface p-1 lg:inline-flex">
          {TABS.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`h-[42px] flex-1 rounded-full px-6 text-[13px] font-semibold transition lg:text-sm ${
                  active ? "bg-flame text-cream" : "text-ink hover:bg-ink/5"
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {tab === "proteins" ? (
        <div className="flex flex-col gap-6 pt-2 lg:gap-8">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-gold-700">Regular · included</p>
            <div className="flex flex-col gap-3 lg:grid lg:grid-cols-5 lg:gap-4">
              {REGULAR.map((p) => (
                <div key={p.name} className="flex items-center gap-3.5 lg:flex-col lg:items-stretch lg:gap-2.5">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full lg:aspect-square lg:h-auto lg:w-full">
                    <Image src={p.img} alt={p.name} fill sizes="(max-width: 1024px) 64px, 200px" className="object-cover saturate-[1.15]" />
                  </div>
                  <div className="min-w-0 flex-1 lg:flex lg:items-baseline lg:justify-between lg:gap-2">
                    <p className="text-base font-semibold">{p.name}</p>
                    <p className="text-[13px] leading-snug text-clay-700 lg:hidden">{p.desc}</p>
                    <span className="hidden shrink-0 rounded-full bg-surface px-2.5 py-0.5 text-[11px] lg:inline-flex">{p.qty}</span>
                  </div>
                  <span className="shrink-0 rounded-full bg-surface px-2.5 py-0.5 text-[11px] lg:hidden">{p.qty}</span>
                  <p className="hidden text-[13px] leading-snug text-clay-700 lg:block">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-flame-700">Premium · per guest upgrade</p>
            <div className="flex flex-col gap-3 lg:grid lg:grid-cols-3 lg:gap-4">
              {PREMIUM.map((p) => (
                <div key={p.name} className="flex items-center gap-3.5 rounded-2xl bg-flame-100 px-4 py-3.5 lg:px-5 lg:py-[18px]">
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold">{p.name}</p>
                    <p className="text-[13px] leading-snug text-clay-700">{p.desc}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-flame-200 px-2.5 py-0.5 text-[12px] font-bold text-flame-800">{p.qty}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-surface px-4 py-3.5 text-[13px] leading-relaxed text-clay-700 lg:text-sm">
            <strong className="text-ink">Allergies:</strong> {sourcingAllergenNote}
          </div>
        </div>
      ) : null}

      {tab === "portions" ? (
        <div className="flex flex-col gap-3.5 pt-2 lg:gap-4">
          <p className="text-sm leading-relaxed text-clay-700 lg:text-[15px]">
            The real per-person amounts our chefs prep — in writing. Kids 5–12 get half portions.
          </p>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-5 lg:gap-3">
            {PORTIONS.map((p) => (
              <div key={p.label} className="rounded-[28px] border border-ink/10 bg-surface p-4 shadow-organic lg:p-[18px]">
                <p className="font-serif text-[26px] font-extrabold leading-none lg:text-[28px]">{p.amount}</p>
                <p className="mt-1 text-[13px] text-clay-700">{p.label}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-gold-100 px-4 py-3.5 text-[13px] leading-relaxed text-gold-800 lg:text-sm">
            Still hungry? Fried rice and vegetable refills are free — nobody leaves a Real Hibachi party hungry.
          </div>
        </div>
      ) : null}

      {tab === "sourcing" ? (
        <div className="flex flex-col gap-3.5 pt-2 lg:gap-4">
          <p className="max-w-[620px] text-sm leading-relaxed text-clay-700 lg:text-[15px]">
            Here is the actual spec for every party — at ${GUEST_TIERS.adult.price.toFixed(2)} a head you should be able to check.
          </p>
          <div className="lg:grid lg:grid-cols-2 lg:gap-x-10">
            {sourcing.map((row) => (
              <div key={row.item} className="flex flex-col gap-1 border-b border-ink/15 py-3.5 lg:py-[18px]">
                <span className="text-xs font-bold uppercase tracking-[0.06em] text-flame-700">{row.item}</span>
                <p className="text-base font-semibold lg:text-[17px]">{row.spec}</p>
                <p className="text-[13px] leading-snug text-clay-700 lg:text-sm">{row.note}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
