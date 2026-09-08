"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronDown, Search } from "lucide-react"
import { faqGroups, type FaqGroup } from "@/config/faq-groups"
import { phone, smsHref } from "@/config/site"
import { trackEvent } from "@/lib/tracking"

// Answers are plain text with "\n\n" paragraphs and "- " bullets.
function formatText(text: string) {
  return text.split("\n\n").map((paragraph, index) => {
    const lines = paragraph.split("\n").map((l) => l.trim()).filter(Boolean)
    const bullets = lines.filter((l) => l.startsWith("-") || l.startsWith("•"))
    if (bullets.length > 0) {
      const lead = lines.filter((l) => !(l.startsWith("-") || l.startsWith("•")))
      return (
        <div key={index} className="mb-2.5 last:mb-0">
          {lead.map((l) => (
            <p key={l} className="mb-1.5">
              {l}
            </p>
          ))}
          <ul className="list-disc space-y-1 pl-5">
            {bullets.map((l) => (
              <li key={l}>{l.replace(/^[-•]\s*/, "")}</li>
            ))}
          </ul>
        </div>
      )
    }
    return (
      <p key={index} className="mb-2.5 last:mb-0">
        {paragraph}
      </p>
    )
  })
}

const POPULAR = [
  { name: "San Diego", slug: "san-diego" },
  { name: "Irvine", slug: "irvine" },
  { name: "Anaheim", slug: "anaheim" },
  { name: "Long Beach", slug: "long-beach" },
  { name: "Pasadena", slug: "pasadena" },
  { name: "Santa Monica", slug: "santa-monica" },
  { name: "Huntington Beach", slug: "huntington-beach" },
  { name: "Riverside", slug: "riverside" },
]

const SERVICES = [
  { name: "Hibachi at Home", href: "/hibachi-at-home" },
  { name: "Hibachi Catering", href: "/hibachi-catering/los-angeles" },
  { name: "Mobile Hibachi", href: "/mobile-hibachi" },
  { name: "Private Hibachi Chef", href: "/private-hibachi-chef" },
]

type Cat = "all" | FaqGroup["id"]

export default function FAQClientPage() {
  const [q, setQ] = useState("")
  const [cat, setCat] = useState<Cat>("all")
  const ql = q.trim().toLowerCase()
  const total = faqGroups.reduce((n, g) => n + g.items.length, 0)

  const groups = useMemo(
    () =>
      faqGroups.map((g) => ({
        ...g,
        items: g.items.map((f) => ({ ...f, match: !ql || `${f.question} ${f.answer}`.toLowerCase().includes(ql) })),
      })),
    [ql],
  )
  const visible = groups.reduce((n, g) => n + (cat === "all" || cat === g.id ? g.items.filter((i) => i.match).length : 0), 0)
  const tabs: Array<{ id: Cat; label: string; count: number }> = [
    { id: "all", label: "All questions", count: total },
    ...faqGroups.map((g) => ({ id: g.id, label: g.name, count: g.items.length })),
  ]

  const onQuote = (surface: string) => () => trackEvent("lead_start", { contact_surface: surface })
  const onSms = (surface: string) => () => trackEvent("sms_click", { contact_surface: surface })
  const sms = smsHref("Hi! I have a question about a hibachi party.")

  const stillCard = (
    <div className="flex flex-col gap-1.5 rounded-[28px] bg-gold-100 p-4 text-gold-800 lg:p-4">
      <p className="text-sm font-bold lg:text-[15px]">Still have questions?</p>
      <p className="text-[13px] leading-relaxed lg:text-sm">
        Call or text us at{" "}
        <a href={phone.voice.tel} className="font-bold">
          {phone.voice.display}
        </a>{" "}
        — a real person, 9am–9pm. Or skip the reading: a quote takes 30 seconds and shows the exact total before you pay.
      </p>
      <Link
        href="/quote?source=faq"
        onClick={onQuote("faq_still")}
        className="mt-1.5 inline-flex h-11 items-center justify-center rounded-full bg-flame text-sm font-bold text-white hover:bg-flame-600"
      >
        Get instant quote
      </Link>
    </div>
  )

  const links = (
    <div className="text-xs leading-[1.8] text-clay-600 lg:text-[13px]">
      Popular cities:{" "}
      {POPULAR.map((c, i) => (
        <span key={c.slug}>
          {i > 0 ? " · " : ""}
          <Link href={`/hibachi-at-home/${c.slug}`} className="hover:text-flame-700">
            {c.name}
          </Link>
        </span>
      ))}
      {" · "}
      <Link href="/locations" className="hover:text-flame-700">
        View all service areas
      </Link>
      <br />
      Services:{" "}
      {SERVICES.map((s, i) => (
        <span key={s.href}>
          {i > 0 ? " · " : ""}
          <Link href={s.href} className="hover:text-flame-700">
            {s.name}
          </Link>
        </span>
      ))}
    </div>
  )

  const searchBox = (big: boolean) => (
    <label className="relative block">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-clay-600" aria-hidden="true" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={big ? "Search questions…" : "Search: weather, deposit, vegan…"}
        aria-label="Search questions"
        className={`w-full rounded-full border border-ink/10 bg-white pl-11 pr-4 text-[15px] text-ink outline-none placeholder:text-clay-600 focus:border-flame ${big ? "h-[50px]" : "h-12"}`}
      />
    </label>
  )

  const list = (
    <div className="flex flex-col gap-7 lg:gap-10">
      {groups.map((g) => {
        const show = (cat === "all" || cat === g.id) && g.items.some((i) => i.match)
        if (!show) return null
        return (
          <section key={g.id} id={g.id} className="flex flex-col gap-2 scroll-mt-40 lg:gap-2.5">
            <h2 className="mb-1 font-serif text-[22px] font-extrabold leading-[1.1] lg:text-[28px]">{g.name}</h2>
            {g.items.map((f) => (
              <details
                key={f.question}
                open={f.open || Boolean(ql) || undefined}
                className={`group rounded-[22px] border border-ink/10 bg-white shadow-organic ${f.match ? "" : "hidden"}`}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 lg:px-5 lg:py-4 [&::-webkit-details-marker]:hidden">
                  <h3 className="font-sans text-[15px] font-semibold leading-snug tracking-normal lg:text-base">{f.question}</h3>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-flame-100 text-flame-700 transition group-open:rotate-180">
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  </span>
                </summary>
                <div className="px-4 pb-4 text-sm leading-relaxed text-clay-700 lg:px-5 lg:pb-[18px] lg:text-[15px]">
                  {formatText(f.answer)}
                  {f.cta ? (
                    <Link href={f.cta.href} onClick={onQuote("faq_answer")} className="mt-2 inline-block text-[13px] font-bold text-flame-700 hover:text-flame-800 lg:text-sm">
                      {f.cta.label} →
                    </Link>
                  ) : null}
                </div>
              </details>
            ))}
          </section>
        )
      })}
      {visible === 0 ? (
        <div className="flex flex-col gap-2 rounded-[28px] border border-ink/10 bg-white p-[18px] shadow-organic lg:max-w-[520px] lg:p-[22px]">
          <p className="text-base font-bold lg:text-lg">Nothing matches &ldquo;{q}&rdquo;</p>
          <p className="text-sm leading-relaxed text-clay-700">Text us and a real person answers within minutes, 9am–9pm.</p>
          <a href={sms} onClick={onSms("faq_empty")} className="inline-flex h-[46px] items-center justify-center rounded-full bg-flame px-6 text-[15px] font-bold text-white lg:self-start">
            Text {phone.sms.display}
          </a>
        </div>
      ) : null}
    </div>
  )

  return (
    <div className="bg-cream pb-28 text-ink lg:pb-[72px]">
      <div className="mx-auto max-w-7xl px-5 pt-[calc(var(--header-height,60px)+16px)] lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-14 lg:px-8 lg:pt-[calc(var(--header-height,72px)+48px)]">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-[calc(var(--header-height,72px)+24px)] flex flex-col gap-[18px]">
            <h1 className="font-serif text-[44px] font-extrabold leading-none">Frequently Asked Questions</h1>
            <p className="text-[15px] leading-relaxed text-clay-700">Everything you need to know about our hibachi service.</p>
            {searchBox(true)}
            <div className="flex flex-col gap-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setCat(t.id)}
                  aria-pressed={cat === t.id}
                  className={`flex h-10 items-center justify-between rounded-full px-3.5 text-sm font-semibold transition ${
                    cat === t.id ? "bg-ink text-white" : "bg-white text-ink hover:bg-ink/5"
                  }`}
                >
                  <span>{t.label}</span>
                  <span className="text-xs opacity-70">{t.count}</span>
                </button>
              ))}
            </div>
            {stillCard}
          </div>
        </aside>

        <div className="lg:max-w-[760px]">
          {/* Phone header + sticky search */}
          <div className="flex flex-col gap-2.5 lg:hidden">
            <h1 className="font-serif text-[34px] font-extrabold leading-[1.02]">Frequently Asked Questions</h1>
            <p className="text-[15px] leading-relaxed text-clay-700">Everything you need to know about our hibachi service.</p>
          </div>
          <div className="sticky top-[var(--header-height,60px)] z-[3] -mx-5 mt-4 flex flex-col gap-2.5 border-b border-ink/10 bg-cream px-5 pb-3 pt-3 lg:hidden">
            {searchBox(false)}
            <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setCat(t.id)}
                  aria-pressed={cat === t.id}
                  className={`h-[34px] shrink-0 whitespace-nowrap rounded-full border px-3.5 text-xs font-semibold transition ${
                    cat === t.id ? "border-ink bg-ink text-white" : "border-ink/15 bg-white text-ink"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 lg:pt-0">{list}</div>

          <div className="mt-8 flex flex-col gap-3.5 lg:mt-10 lg:border-t lg:border-ink/10 lg:pt-3">
            <div className="lg:hidden">{stillCard}</div>
            {links}
          </div>
        </div>
      </div>

      {/* Phones: Text us + Get instant quote, always in reach. */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 bg-[linear-gradient(180deg,rgba(247,239,226,0)_0%,#f7efe2_30%)] px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 lg:hidden">
        <a href={sms} onClick={onSms("faq_sticky")} className="inline-flex h-[50px] items-center rounded-full border border-ink/15 bg-white px-[18px] text-sm font-semibold text-ink">
          Text us
        </a>
        <Link href="/quote?source=faq" onClick={onQuote("faq_sticky")} className="flex h-[50px] flex-1 items-center justify-center rounded-full bg-flame text-[15px] font-bold text-white shadow-organic-lg">
          Get instant quote
        </Link>
      </div>
    </div>
  )
}
