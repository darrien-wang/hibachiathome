import type { ReactNode } from "react"
import Link from "next/link"
import LandingCtaButton from "@/components/city/landing-cta-button"
import { phone } from "@/config/site"

// ============================================================
// Building blocks of the Joshua Tree page, for pages that keep their own
// sections (2026-09-21)
// ============================================================
// LandingTemplate is the full city page. Hub, location, menu and occasion
// pages have their own headings and copy that search engines and ChatGPT
// already index, so they are not forced into the city template's fixed
// sections: they take the shell (LandingHero + LandingDiffs), these parts for
// their own sections, and the same cocoa closing block. Headings keep their
// original text; only the styling changes.

/** Page root: cream, ink, and room at the bottom for the card's phone bar. */
export function LandingShell({ children }: { children: ReactNode }) {
  return <div className="bg-cream pb-28 text-ink lg:pb-16">{children}</div>
}

/** The content column under the hero, same rhythm as the city pages. */
export function LandingBody({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 pt-8 lg:gap-[72px] lg:px-8 lg:pt-16">{children}</div>
}

export function SectionTitle({ children, aside, as: Tag = "h2" }: { children: ReactNode; aside?: ReactNode; as?: "h2" | "h3" }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <Tag className="font-serif text-[26px] font-extrabold leading-[1.1] lg:text-4xl">{children}</Tag>
      {aside ? <span className="shrink-0 text-xs text-clay-600 lg:text-[13px]">{aside}</span> : null}
    </div>
  )
}

/** A titled section; `lead` is the one-line intro under the heading. */
export function LandingSection({ title, lead, aside, children, id }: { title: ReactNode; lead?: ReactNode; aside?: ReactNode; children?: ReactNode; id?: string }) {
  return (
    <section id={id} className="flex flex-col gap-3.5 lg:gap-5">
      <div className="flex flex-col gap-1.5">
        <SectionTitle aside={aside}>{title}</SectionTitle>
        {lead ? <p className="max-w-[760px] text-sm leading-relaxed text-clay-700 lg:text-base">{lead}</p> : null}
      </div>
      {children}
    </section>
  )
}

export function Accordion({ items, idPrefix }: { items: Array<{ title: string; body: ReactNode }>; idPrefix: string }) {
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

/** FAQ as an accordion; the heading is the page's own (it may be indexed). */
export function FaqList({ heading, faqs, footer }: { heading: ReactNode; faqs: Array<{ question: string; answer: string }>; footer?: ReactNode }) {
  return (
    <section className="flex flex-col">
      <h2 className="mb-1.5 font-serif text-[26px] font-extrabold leading-[1.1] lg:mb-2 lg:text-4xl">{heading}</h2>
      <Accordion items={faqs.map((f) => ({ title: f.question, body: <p>{f.answer}</p> }))} idPrefix="faq" />
      {footer ? <div className="pt-3 text-[13px] text-clay-700">{footer}</div> : null}
    </section>
  )
}

export function CheckList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-col gap-2 text-sm leading-snug lg:gap-2.5 lg:text-[15px]">
      {items.map((line) => (
        <div key={line} className="flex gap-2.5">
          <span className="font-bold text-gold-700" aria-hidden="true">
            ✓
          </span>
          {line}
        </div>
      ))}
    </div>
  )
}

/** Quotes as the city pages show them; `source` is the line under each. */
export function ReviewCards({ reviews }: { reviews: Array<{ name: string; text: string; source?: string }> }) {
  return (
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-3 lg:gap-4">
      {reviews.map((review) => (
        <blockquote key={review.name} className="flex flex-col gap-2 rounded-[28px] border border-ink/10 bg-surface p-4 shadow-organic lg:p-5">
          <p className="text-sm leading-relaxed lg:text-[15px]">&ldquo;{review.text}&rdquo;</p>
          <span className="text-xs text-clay-600 lg:text-[13px]">
            {review.name}
            {review.source ? ` · ${review.source}` : ""}
          </span>
        </blockquote>
      ))}
    </div>
  )
}

/** Title + text cards in a grid (features, packages, moments). */
export function FactCards({ items, columns = 3 }: { items: Array<{ title: string; body: ReactNode }>; columns?: 2 | 3 }) {
  return (
    <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${columns === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"} lg:gap-4`}>
      {items.map((item) => (
        <div key={item.title} className="flex flex-col gap-1.5 rounded-[28px] border border-ink/10 bg-surface p-4 shadow-organic lg:p-5">
          <h3 className="font-serif text-[17px] font-extrabold leading-tight lg:text-lg">{item.title}</h3>
          <div className="text-sm leading-relaxed text-clay-700 [&>p+p]:mt-2">{item.body}</div>
        </div>
      ))}
    </div>
  )
}

/** Internal links as pills (occasions, cities). */
export function LinkPills({ links }: { links: Array<{ label: string; href: string }> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="inline-flex h-9 items-center whitespace-nowrap rounded-full border border-ink/10 bg-white px-3.5 text-[13px] font-semibold text-ink transition hover:border-flame-300 hover:bg-flame-100"
        >
          {l.label}
        </Link>
      ))}
    </div>
  )
}

/** Plain chips (non-link place names). */
export function PlaceChips({ places }: { places: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {places.map((n) => (
        <span key={n} className="whitespace-nowrap rounded-full bg-surface px-3 py-1.5 text-xs lg:text-[13px]">
          {n}
        </span>
      ))}
    </div>
  )
}

/** The cocoa closing block with the one action; `children` renders under it. */
export function FinalCta({ heading, body, children }: { heading: ReactNode; body?: ReactNode; children?: ReactNode }) {
  return (
    <section>
      <div className="flex flex-col gap-3 rounded-[28px] bg-cocoa px-5 py-6 text-white lg:flex-row lg:items-center lg:gap-8 lg:px-12 lg:py-11">
        <div className="flex flex-1 flex-col gap-2">
          <h2 className="font-serif text-[28px] font-extrabold leading-[1.05] lg:text-4xl">{heading}</h2>
          <p className="text-sm leading-relaxed text-white/80 lg:text-base">{body ?? "Your quote is ready above. One number, one text, and we confirm your chef."}</p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <LandingCtaButton className="flex h-[50px] w-full items-center justify-center rounded-full bg-flame px-8 text-[15px] font-bold text-white transition hover:bg-flame-600 lg:h-14 lg:w-auto lg:text-[17px]" />
          <a href={phone.voice.tel} className="text-sm font-semibold text-flame-300">
            or call {phone.voice.display}
          </a>
        </div>
      </div>
      {children}
    </section>
  )
}
