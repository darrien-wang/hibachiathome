// What Real Hibachi tells AI assistants and agents (ChatGPT, Claude, Codex,
// Perplexity...) about itself - one source for /llms.txt, /llms-full.txt and
// the /for-ai page (决策日志 D-0917-06).
//
// Every number is read from config/pricing-rules.ts and config/menu-items.ts,
// never typed here. The hand-written llms.txt this replaces drifted within two
// weeks (old weekday price, wrong kids' price, a "nut-free" claim the FAQ
// contradicts), and AI answers repeat whatever this file says to customers.
//
// Owner decisions for this surface (2026-09-17): agents get exact prices (the
// human-facing pages show ranges, D-0913-06), the refundable deposit is
// explained (an agent booking for someone needs the whole process, unlike the
// marketing pages, D-0913-01), and agents may submit a quote request on a
// customer's behalf through the documented API.
//
// Deliberately NOT here: the returning-customer discount (a quiet perk, never
// advertised), sake/alcohol, and claims we cannot back (insurance, ratings).

import {
  CARD_SURCHARGE_RATE,
  DEPOSIT_AMOUNT,
  EXTRA_PROTEIN_PRICE,
  GUESTS_PER_CHEF,
  GUEST_TIERS,
  INCLUDED_PROTEINS_PER_PERSON,
  MINIMUM_SPEND,
  PARTY_SIZE_CUSTOM_FROM,
  PARTY_SIZE_DISCOUNT_TIERS,
  TABLES_CHAIRS_PER_GUEST,
  TRAVEL_FREE_RADIUS_MILES,
  TRAVEL_RATE_PER_MILE,
  UTENSILS_PER_GUEST,
  WEEKDAY_SPECIAL,
  WEEKDAY_SPECIAL_BLACKOUTS,
  isPromotionActive,
} from "@/config/pricing-rules"
import { premiumProteins, sides } from "@/config/menu-items"
import { faqGroups } from "@/config/faq-groups"
import { phone, siteConfig } from "@/config/site"

export const SITE = "https://www.realhibachi.com"

/** Free appetizer (one of the customer's choice) for parties of 20+ (large-party promo, owner extended to Oct 31). */
const LARGE_PARTY_PLATTER = { minGuests: 20, until: "2026-10-31" }

export type FactSection = { id: string; title: string; items: string[] }

const usd = (n: number) => `$${n.toFixed(2).replace(/\.00$/, "")}`
const usd2 = (n: number) => `$${n.toFixed(2)}`

function todayLA(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(now)
}

export function getAiFacts(now = new Date()): { summary: string; sections: FactSection[] } {
  const today = todayLA(now)
  const adult = GUEST_TIERS.adult
  const child = GUEST_TIERS.child
  const blackouts = WEEKDAY_SPECIAL_BLACKOUTS.filter((b) => b.end >= today)
    .slice(0, 4)
    .map((b) => (b.start === b.end ? `${b.label} (${b.start})` : `${b.label} (${b.start} to ${b.end})`))
  const platterOn = today <= LARGE_PARTY_PLATTER.until
  const addOn = (id: string) => sides.find((s) => s.id === id)

  const pricing: string[] = [
    `Standard rate, any day: ${usd2(adult.price)} per adult (13+), ${usd2(child.price)} per child (5-12), kids under 5 eat free.`,
    `Event minimum: ${usd(MINIMUM_SPEND)} (the food total after discounts, before travel and tip).`,
    `Weekday Special, Monday-Thursday: ${usd2(adult.weekdayPrice)} per adult, ${usd2(child.weekdayPrice)} per child, plus a free ${WEEKDAY_SPECIAL.appetizerPlatter.label.replace(/^Free /, "").toLowerCase()} (${WEEKDAY_SPECIAL.appetizerPlatter.detail}): one tray for the table to share, gyoza if the customer doesn't choose. Any party size, full menu.${blackouts.length ? ` Not available on major holidays: ${blackouts.join("; ")}.` : ""}`,
    `Party Size Discount, automatic on any day and on top of the Weekday Special (counts adults + kids 5-12): ${PARTY_SIZE_DISCOUNT_TIERS.map((t) => `${t.minGuests}-${t.maxGuests} guests ${usd(t.amount)} off`).join(", ")}. ${PARTY_SIZE_CUSTOM_FROM}+ guests get a custom quote.`,
    ...(platterOn
      ? [`Parties of ${LARGE_PARTY_PLATTER.minGuests}+ guests also get a free ${WEEKDAY_SPECIAL.appetizerPlatter.label.replace(/^Free /, "").toLowerCase()} (${WEEKDAY_SPECIAL.appetizerPlatter.detail}) through October 31, 2026.`]
      : []),
    `Travel: first ${TRAVEL_FREE_RADIUS_MILES} driving miles free, then ${usd(TRAVEL_RATE_PER_MILE)} per mile. Most of Los Angeles and Orange County is inside the free radius.`,
    ...(isPromotionActive("call_out_fee_waived") ? ["No chef call-out fee right now (waived)."] : []),
    `Premium protein upgrades, per guest: ${premiumProteins.map((p) => `${p.name.replace(/ Upgrade$/, "")} +${usd(p.price)}`).join(", ")}. A third protein is +${usd(EXTRA_PROTEIN_PRICE)} per guest.`,
    `Add-ons: ${[
      addOn("gyoza") && `gyoza ${usd(addOn("gyoza")!.price)} per tray of 10`,
      addOn("spring-rolls") && `spring rolls ${usd(addOn("spring-rolls")!.price)} per tray of 10`,
      addOn("edamame") && `edamame ${usd(addOn("edamame")!.price)} (feeds 3)`,
      addOn("noodles") && `hibachi noodles +${usd(addOn("noodles")!.price)} per guest`,
      `tables, chairs & tablecloths +${usd(TABLES_CHAIRS_PER_GUEST)} per guest`,
      `plates & utensils +${usd(UTENSILS_PER_GUEST)} per guest`,
    ]
      .filter(Boolean)
      .join(", ")}.`,
    `Gratuity is not included; 20-25% for the chef is customary.`,
    `Example: 15 adults on a Saturday = 15 x ${usd2(adult.price)} = ${usd2(15 * adult.price)} - ${usd(60)} party size discount = ${usd2(15 * adult.price - 60)}, plus travel if over ${TRAVEL_FREE_RADIUS_MILES} miles. The /api/agent/price endpoint computes any party exactly.`,
  ]

  const included: string[] = [
    "A private hibachi (teppanyaki) chef cooks live at the customer's home, backyard or venue, with the full show: onion volcano, egg tricks, food tossed to guests.",
    `Per guest: ${INCLUDED_PROTEINS_PER_PERSON} proteins (chicken, steak, shrimp, salmon or tofu), garlic butter fried rice, seasonal vegetables, and house salad.`,
    "The chef brings the grill, propane, ingredients, and sauces, sets up, cooks, and cleans the cooking area afterward.",
    `One chef per ${GUESTS_PER_CHEF} guests; larger parties get more chefs.`,
    "The customer provides tables, chairs and plates, or adds them (see add-ons).",
  ]

  const booking: string[] = [
    `1. Check a date: GET ${SITE}/api/quote/slot-availability?date=YYYY-MM-DD returns open start times.`,
    `2. Get the exact price: GET ${SITE}/api/agent/price?adults=N&kids=N&date=YYYY-MM-DD&zip=ZIP.`,
    `3. Only with the customer's permission, submit a quote request: POST ${SITE}/api/agent/quote-request with their name, mobile and email. We text and email them the exact quote and a secure deposit link, and a real person follows up by text.`,
    `4. The customer pays a ${usd2(DEPOSIT_AMOUNT)} deposit to lock the date themselves. Agents never handle payment. The deposit is fully refundable with 72+ hours notice.`,
    `5. The balance is paid on the day: cash (no fee), or card, Venmo or Zelle (+${Math.round(CARD_SURCHARGE_RATE * 100)}%).`,
    `Full API description (OpenAPI 3.1): ${SITE}/openapi.json. Humans can book at ${SITE}/quote.`,
    `Prefer a person? Call or text ${phone.voice.display}, or email ${siteConfig.contact.email}.`,
  ]

  const area: string[] = [
    "Southern California only: Los Angeles, Orange, San Diego, Riverside, San Bernardino and Ventura counties.",
    `Travel: first ${TRAVEL_FREE_RADIUS_MILES} driving miles free; pass the event ZIP to /api/agent/price for the exact fee.`,
    `City pages: ${SITE}/hibachi-at-home (all cities), ${SITE}/locations/la-orange-county.`,
  ]

  const rules: string[] = [
    "Cooking is outdoors only: patio, backyard, balcony, deck, driveway or under a tent. Never indoors.",
    "Rain: the chef can cook under a covered patio or a 10x10 pop-up tent (the customer provides it; we don't). Cancel or move the date with 72+ hours notice for a full deposit refund.",
    "Allergies: tell us in the quote request. We accommodate gluten-free, vegetarian and vegan guests, but we cannot promise a nut-free or sesame-free table (see the FAQ for details).",
    "Real Hibachi's own chefs cook every party. It is not a marketplace or app.",
  ]

  const contact: string[] = [
    `Phone and text: ${phone.voice.display} (${phone.voice.e164})`,
    `Email: ${siteConfig.contact.email}`,
    `Website: ${SITE}`,
    `Instagram: ${siteConfig.social.instagram}`,
  ]

  return {
    summary:
      "Real Hibachi is a private hibachi chef service in Southern California. A chef comes to your home, backyard or event with a mobile teppanyaki grill, fresh ingredients and a live cooking show, for birthdays, bachelorette parties, family gatherings, weddings and company events.",
    sections: [
      { id: "included", title: "What's included", items: included },
      { id: "pricing", title: "Prices", items: pricing },
      { id: "booking", title: "How to book (for AI agents)", items: booking },
      { id: "area", title: "Service area", items: area },
      { id: "rules", title: "Good to know", items: rules },
      { id: "contact", title: "Contact", items: contact },
    ],
  }
}

export function getFaqForAi(): { group: string; question: string; answer: string }[] {
  return faqGroups.flatMap((g) => g.items.map((i) => ({ group: g.name, question: i.question, answer: i.answer.trim() })))
}

const KEY_PAGES: [string, string, string][] = [
  ["For AI assistants", "/for-ai", "this information as a web page"],
  ["Hibachi at Home", "/hibachi-at-home", "what's included, how it works, all cities"],
  ["Menu", "/menu", "proteins, sides, upgrades"],
  ["FAQ", "/faq", "pricing, setup space, weather, dietary needs, cancellation"],
  ["Instant quote", "/quote", "the booking page for people"],
  ["Contact", "/contact", "talk to a person"],
]

/** Markdown for /llms.txt (short) and /llms-full.txt (adds the whole FAQ). */
export function renderLlmsTxt(full: boolean, now = new Date()): string {
  const { summary, sections } = getAiFacts(now)
  const out: string[] = ["# Real Hibachi", "", `> ${summary}`, ""]
  out.push(`Prices and policies below are generated from our live pricing rules (as of ${todayLA(now)}).`, "")
  for (const s of sections) {
    out.push(`## ${s.title}`, "")
    for (const item of s.items) out.push(/^\d+\./.test(item) ? item : `- ${item}`)
    out.push("")
  }
  out.push("## Key pages", "")
  for (const [label, path, note] of KEY_PAGES) out.push(`- [${label}](${SITE}${path}): ${note}`)
  out.push("")
  if (full) {
    out.push("## FAQ", "")
    for (const f of getFaqForAi()) out.push(`### ${f.question}`, "", f.answer, "")
  } else {
    out.push("## More", "", `- [Full version with the complete FAQ](${SITE}/llms-full.txt)`, `- [Booking API (OpenAPI)](${SITE}/openapi.json)`, "")
  }
  return out.join("\n")
}
