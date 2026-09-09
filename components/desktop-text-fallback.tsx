"use client"

import { type MouseEvent, useState } from "react"
import { phone } from "@/config/site"
import { contactDeviceLabel, copyText } from "@/lib/device-contact"

// Every "Text us" affordance on the site used to be a bare `<a href="sms:...">`.
// On a desktop browser that navigates nowhere and reports nothing: the visitor
// clicks, the page does not move, and they conclude the site is broken.
//
// On 2026-09-07 a visitor came in on `hibachi catering temecula`, priced a
// 30-guest party (~$1,800), clicked "Text us this quote" three times — Clarity
// logged the last two as dead clicks — and left. The SMS-intent ping fired
// every time, so the workbench recorded "tapped but never texted", which reads
// like a flaky customer rather than a broken button. See 决策日志 D-0908-04.
//
// This hook + panel are the shared fix. Phones keep the `sms:` behaviour
// untouched; desktops get the number, the priced summary, and a working
// channel. Use them anywhere an `sms:` link is offered.

type IntentMeta = {
  /** Plain-text quote summary the visitor can paste into a text themselves. */
  summary: string
  guests?: number
  eventDate?: string
  location?: string
}

export function useDesktopTextFallback(meta: IntentMeta) {
  const [open, setOpen] = useState(false)

  const onSmsClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const device = contactDeviceLabel()
    // Report the intent either way: this is how the workbench learns someone
    // is mid-quote, and `device` is what makes a desktop tap readable later.
    try {
      const payload = JSON.stringify({
        channel: "sms",
        summary: meta.summary,
        guests: meta.guests ?? 0,
        eventDate: meta.eventDate ?? "",
        location: meta.location ?? "",
        device,
      })
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/quote/contact-intent", new Blob([payload], { type: "application/json" }))
      } else {
        fetch("/api/quote/contact-intent", { method: "POST", body: payload, keepalive: true })
      }
    } catch {}

    if (device === "desktop") {
      event.preventDefault()
      setOpen(true)
    }
  }

  return { open, close: () => setOpen(false), onSmsClick }
}

export function DesktopTextPanel({
  summary,
  onClose,
  emailHref,
}: {
  summary: string
  onClose: () => void
  /** Shown as the "or email us" escape hatch when the caller has one. */
  emailHref?: string
}) {
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null)

  return (
    <div className="rounded-2xl border border-flame/30 bg-cream p-3.5">
      <p className="text-[13px] font-semibold leading-snug text-ink">
        Texting doesn&apos;t open from a computer — here&apos;s our number.
      </p>
      <p className="mt-1.5 font-serif text-[22px] font-extrabold leading-none text-ink">{phone.sms.display}</p>
      {/* On the page and selectable, so a blocked clipboard call still leaves
          the visitor something they can act on. */}
      <textarea
        readOnly
        value={summary}
        onFocus={(event) => event.currentTarget.select()}
        rows={3}
        aria-label="Your quote, ready to copy"
        className="mt-2 w-full resize-none rounded-lg border border-ink/10 bg-white p-2 text-[12px] leading-snug text-clay-700"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={async () => {
            const ok = await copyText(summary)
            setCopied(ok ? "yes" : "failed")
            window.setTimeout(() => setCopied(null), ok ? 2200 : 5000)
          }}
          className="inline-flex h-9 items-center rounded-full border border-ink/15 bg-white px-3.5 text-[13px] font-semibold text-ink transition hover:bg-cream"
        >
          {copied === "yes" ? "Quote copied" : copied === "failed" ? "Copy blocked — select the text" : "Copy this quote"}
        </button>
        {emailHref ? (
          <a
            href={emailHref}
            className="inline-flex h-9 items-center rounded-full border border-ink/15 bg-white px-3.5 text-[13px] font-semibold text-ink transition hover:bg-cream"
          >
            Email it instead
          </a>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 items-center rounded-full px-3 text-[13px] font-semibold text-clay-600 transition hover:text-ink"
        >
          Close
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-clay-600">We reply within hours, whichever you use.</p>
    </div>
  )
}
