import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { MessageSquare, Star, MapPin, HandCoins, Share2, PartyPopper, Check } from "lucide-react"
import { JsonLd } from "@/components/structured-data"
import { pickReviews } from "@/config/reviews"
import {
  REFERRAL_TIERS,
  REFERRAL_FRIEND_DISCOUNT,
  REFERRAL_SMS_KEYWORD,
  REFERRAL_PAYOUT_HOURS,
  formatTierRange,
} from "@/config/referral-program"

const BASE_URL = "https://www.realhibachi.com"
const PHONE_DISPLAY = "213-770-7788"
const PHONE_RAW = "2137707788"
const PAGE_URL = `${BASE_URL}/referral`

const codeSmsHref = `sms:${PHONE_RAW}?body=${encodeURIComponent(
  `${REFERRAL_SMS_KEYWORD} - please send me my referral code!`,
)}`

export const metadata: Metadata = {
  title: "Referral Rewards",
  description: `Give friends $${REFERRAL_FRIEND_DISCOUNT} off their first hibachi party and earn $50–$200 cash for every party they book. Paid by Zelle within ${REFERRAL_PAYOUT_HOURS} hours — no limits, no gimmicks.`,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Referral Rewards | Real Hibachi",
    description: `Give friends $${REFERRAL_FRIEND_DISCOUNT} off, earn up to $200 cash per party they book. Paid by Zelle within ${REFERRAL_PAYOUT_HOURS} hours.`,
    url: PAGE_URL,
    siteName: "Real Hibachi",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: `${BASE_URL}/images/hibachi-flame-og.png`,
        width: 1200,
        height: 630,
        alt: "Real Hibachi referral rewards",
      },
    ],
  },
}

const faqs = [
  {
    question: "How do I get my referral code?",
    answer: `Text the word ${REFERRAL_SMS_KEYWORD} to ${PHONE_DISPLAY} and we'll reply with your personal code. Anyone can have one — past hosts, party guests, or friends who just love sharing a good thing.`,
  },
  {
    question: "When and how do I get paid?",
    answer: `We pay by Zelle within ${REFERRAL_PAYOUT_HOURS} hours after your friend's party actually happens — not when they book. You'll get a text confirming the payout. Prefer booking credit toward your own next party? Take it as credit instead and we bump it about 1.5x.`,
  },
  {
    question: "Is there a limit to how much I can earn?",
    answer:
      "No cap. Refer five parties, get paid five times. Your code never expires, and bigger parties pay bigger rewards — up to $200 cash each.",
  },
  {
    question: "What does my friend get?",
    answer: `$${REFERRAL_FRIEND_DISCOUNT} off their first party, applied on their final invoice. They just enter your code when they get a quote at realhibachi.com/quote, or mention it when they text us.`,
  },
  {
    question: "What if my friend forgets to use the code?",
    answer:
      'No problem — as long as they name you before their party is booked. Our quote form asks "How did you hear about us?", and a text works too. The first referrer on record gets the reward.',
  },
  {
    question: "Can I use my own code on my own party?",
    answer:
      "No — rewards are for bringing us new customers, so your code works for everyone except your own bookings. One referral reward per new household's first party.",
  },
]

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
}

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
    { "@type": "ListItem", position: 2, name: "Referral Rewards", item: PAGE_URL },
  ],
}

const steps = [
  {
    icon: MessageSquare,
    title: "Text us for your code",
    description: `Text ${REFERRAL_SMS_KEYWORD} to ${PHONE_DISPLAY}. We reply with a personal code like RH-MARIA50 — that code is yours forever.`,
  },
  {
    icon: Share2,
    title: "Share it with anyone planning a party",
    description: `They get $${REFERRAL_FRIEND_DISCOUNT} off their first party when they use your code on the quote form or mention it by text.`,
  },
  {
    icon: HandCoins,
    title: "Get cash after their party",
    description: `Once their party happens, we Zelle you $50–$200 within ${REFERRAL_PAYOUT_HOURS} hours — bigger party, bigger reward. No caps, no waiting for payday.`,
  },
]

export default function ReferralPage() {
  const reviews = pickReviews("referral")

  return (
    <div className="min-h-screen bg-white">
      <JsonLd data={[faqJsonLd, breadcrumbJsonLd]} />

      {/* Hero */}
      <section className="bg-gradient-to-r from-amber-50 to-orange-50 pt-10 pb-14">
        <div className="container mx-auto px-4">
          <nav className="text-sm text-gray-500 mb-6" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-primary">
              Home
            </Link>
            {" / "}
            <span className="text-gray-700">Referral Rewards</span>
          </nav>
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Share the show. Get paid cash.</h1>
            <p className="text-2xl font-semibold text-orange-800 mb-3">
              Friends get ${REFERRAL_FRIEND_DISCOUNT} off. You get up to $200 per party — by Zelle, within{" "}
              {REFERRAL_PAYOUT_HOURS} hours.
            </p>
            <p className="text-sm text-gray-600 mb-8">
              Fire up your story. · Serving all of Southern California · No caps, your code never expires
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild className="h-12 rounded-full bg-[hsl(24_79%_55%)] px-8 text-white hover:bg-[hsl(24_79%_48%)]">
                <a href={codeSmsHref}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Text {REFERRAL_SMS_KEYWORD} — get my code
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-12 rounded-full border-2 border-[hsl(24_79%_55%)] bg-white px-8 text-[hsl(24_79%_55%)] hover:bg-[hsl(24_79%_96%)]"
              >
                <Link href="/quote?source=referral_page">Have a code? Get a quote</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-14">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-3xl font-bold">
              Three steps to <span className="text-primary">cash</span>
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-center text-gray-600">
              Every party you've hosted was watched by a backyard full of future hosts. This is how you get paid for the
              introductions you were already making.
            </p>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {steps.map((step, index) => (
                <div key={step.title} className="rounded-2xl border border-amber-100 bg-white p-6">
                  <div className="flex items-center gap-3">
                    <step.icon className="h-6 w-6 text-orange-600" aria-hidden="true" />
                    <span className="text-sm font-semibold text-orange-700">Step {index + 1}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-gray-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-700">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Reward tiers */}
      <section className="bg-[#fdf8f2] py-14">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-center text-3xl font-bold">
              Bigger party, <span className="text-primary">bigger reward</span>
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-center text-gray-600">
              Your reward is based on the size of the party your friend books. Cash by Zelle — or take it as booking
              credit toward your own next party and we bump it about 1.5x.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {REFERRAL_TIERS.map((tier) => (
                <div
                  key={tier.minAdults}
                  className="rounded-2xl border border-amber-200 bg-white p-6 text-center"
                >
                  <PartyPopper className="mx-auto h-6 w-6 text-orange-600" aria-hidden="true" />
                  <p className="mt-3 text-sm font-medium text-gray-600">{formatTierRange(tier)}</p>
                  <p className="mt-1 text-3xl font-bold text-orange-800">${tier.cashReward}</p>
                  <p className="text-xs text-gray-500">cash · or ${tier.creditReward} credit</p>
                </div>
              ))}
            </div>
            <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5">
              <p className="text-sm font-semibold text-gray-900">The fine print, kept short:</p>
              <ul className="mt-3 space-y-2">
                {[
                  `Paid within ${REFERRAL_PAYOUT_HOURS} hours after your friend's completed party — not months later.`,
                  "Your friend must be a new customer, and your code (or your name) must come up before their party is booked.",
                  "One referral reward per new household's first party. No limit on how many households you refer.",
                  "Rewards are per completed party — if they cancel, there's nothing to pay out.",
                ].map((rule) => (
                  <li key={rule} className="flex items-start gap-2 text-sm text-gray-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Why it works + photos */}
      <section className="py-14">
        <div className="container mx-auto px-4">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
            <div className="space-y-5">
              <h2 className="text-3xl font-bold">
                The easiest money you'll make <span className="text-primary">this year</span>
              </h2>
              <p className="text-lg leading-8 text-gray-700">
                If you've hosted a Real Hibachi party, your friends already saw the onion volcano, the fire show, and the
                chef tossing eggs. Half of them said &ldquo;we have to do this.&rdquo; Now when they finally book it, you
                get paid for the introduction.
              </p>
              <p className="text-lg leading-8 text-gray-700">
                And your friend doesn't pay extra for it — they pay ${REFERRAL_FRIEND_DISCOUNT} <em>less</em>. Same
                published pricing as everyone else, same chef-on-time guarantee, minus your discount.
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                <span className="inline-flex items-center gap-1">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
                  4.9 average rating
                </span>
                <span>500+ parties served</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-orange-700" aria-hidden="true" />
                  SoCal only — a local team
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative col-span-2 h-64 overflow-hidden rounded-2xl">
                <Image
                  src="/gallery/real-hibachi-party-orange-county-night-fire-show-18.jpg"
                  alt="Real Hibachi chef performing a night fire show at a backyard party"
                  fill
                  sizes="(max-width: 1024px) 100vw, 560px"
                  className="object-cover"
                />
              </div>
              <div className="relative h-40 overflow-hidden rounded-2xl">
                <Image
                  src="/gallery/real-hibachi-party-los-angeles-birthday-event-13.jpg"
                  alt="Guests celebrating a birthday at a Real Hibachi backyard party"
                  fill
                  sizes="(max-width: 1024px) 50vw, 300px"
                  className="object-cover"
                />
              </div>
              <div className="relative h-40 overflow-hidden rounded-2xl">
                <Image
                  src="/gallery/real-hibachi-party-los-angeles-chef-guest-game-17.jpg"
                  alt="Real Hibachi chef playing a game with party guests"
                  fill
                  sizes="(max-width: 1024px) 50vw, 300px"
                  className="object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="bg-[#fdf8f2] py-14">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-3xl font-bold">The parties your friends keep hearing about</h2>
            <div className="mt-1.5 flex items-center justify-center gap-1 text-sm text-gray-600">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
              ))}
              <span className="ml-1">5-star Google reviews</span>
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {reviews.map((review) => (
                <div key={review.name} className="rounded-2xl border border-amber-100 bg-white p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-amber-400 to-orange-500 text-base font-bold text-white">
                      {review.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{review.name}</p>
                      <p className="text-xs text-gray-500">Google review</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-gray-700">{review.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-14">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-bold">
              Referral <span className="text-primary">FAQ</span>
            </h2>
            <div className="mt-8 space-y-6">
              {faqs.map((faq) => (
                <div key={faq.question} className="rounded-2xl border border-gray-200 p-6">
                  <h3 className="font-semibold text-gray-900">{faq.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-700">{faq.answer}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-sm text-gray-600">
              Run a party business — rentals, decor, planning, or a vacation rental?{" "}
              <Link href="/partner-opportunities" className="font-medium text-primary underline">
                Our partner program pays per booking too
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-gradient-to-r from-amber-50 to-orange-50 py-14">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold">Fire up your story.</h2>
          <p className="mx-auto mt-2 max-w-xl text-gray-700">
            One text gets you a code. One share gets a friend the best party of their year — and gets you paid.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild className="h-12 rounded-full bg-[hsl(24_79%_55%)] px-8 text-white hover:bg-[hsl(24_79%_48%)]">
              <a href={codeSmsHref}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Text {REFERRAL_SMS_KEYWORD} to {PHONE_DISPLAY}
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 rounded-full border-2 border-[hsl(24_79%_55%)] bg-white px-8 text-[hsl(24_79%_55%)] hover:bg-[hsl(24_79%_96%)]"
            >
              <Link href="/quote?source=referral_page">Get an Instant Quote</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
