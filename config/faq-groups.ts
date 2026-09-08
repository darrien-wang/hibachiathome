import { faqItems } from "@/config/faq"

// /faq layout from the Claude Design "Realhibachi FAQ" board (2026-09-08):
// four H2 groups, every answer in the HTML, the three high-drop-off questions
// open by default, and a quote / SMS action inside the answers that lead to
// one. Content comes from config/faq.ts (official copy, shared with the
// FAQPage JSON-LD); the three "top concerns" that were already published on
// the old page live here so they stay in the structured data too.

export type FaqEntry = {
  question: string
  answer: string
  open?: boolean
  cta?: { label: string; href: string }
}

export type FaqGroup = {
  id: "price" | "book" | "day" | "food"
  name: string
  items: FaqEntry[]
}

const QUOTE_HREF = "/quote?source=faq"

const byQuestion = (q: string) => faqItems.find((item) => item.question === q)

const EXTRA: Record<string, FaqEntry> = {
  weather: {
    question: "What if weather changes on event day?",
    answer:
      "Cooking is outdoors, so if the forecast is uncertain we recommend a 10'x10' pop-up tent over the chef's station — they are inexpensive to buy or rent, and we do not supply them. Your guests can also eat indoors while the chef cooks outside. If you still need to cancel for weather, notify us at least 72 hours in advance for a full deposit refund.",
    open: true,
  },
  allergies: {
    question: "Can you handle allergies and dietary restrictions?",
    answer:
      "Yes. We can accommodate common dietary restrictions when informed in advance. Please include allergy details during booking so the chef can prepare safely.",
  },
}

function pick(question: string, extra?: Partial<FaqEntry>): FaqEntry[] {
  const item = byQuestion(question)
  return item ? [{ question: item.question, answer: item.answer, ...extra }] : []
}

export const faqGroups: FaqGroup[] = [
  {
    id: "price",
    name: "Pricing & Deposit",
    items: [
      ...pick("How much does your hibachi experience cost?", { open: true, cta: { label: "Get my exact quote", href: QUOTE_HREF } }),
      ...pick("Do you offer military, nurse, teacher, or first-responder discounts?"),
    ],
  },
  {
    id: "book",
    name: "Booking & Cancellation",
    items: [
      EXTRA.weather,
      ...pick("What is your cancellation policy?", { open: true }),
      ...pick("How do I make a reservation?", { cta: { label: "Start a booking", href: QUOTE_HREF } }),
      ...pick("What if the chef doesn't show up?"),
    ],
  },
  {
    id: "day",
    name: "On the Day",
    items: [
      ...pick("When will the chef arrive?"),
      ...pick("Can you provide tables and chairs?"),
      ...pick("Will the grill damage or dirty my patio?"),
      ...pick("Do you cook indoors?"),
    ],
  },
  {
    id: "food",
    name: "Food & Dietary",
    items: [
      ...pick("How much food does each guest get?"),
      EXTRA.allergies,
      ...pick("Do you use nuts or sesame?"),
      ...pick("Can you handle gluten-free guests?"),
      ...pick("What about vegetarians or vegans?"),
      ...pick("Can guests bring their own protein?"),
    ],
  },
]

/** Every question on the page, for the FAQPage JSON-LD. */
export const faqAllEntries: FaqEntry[] = faqGroups.flatMap((group) => group.items)
