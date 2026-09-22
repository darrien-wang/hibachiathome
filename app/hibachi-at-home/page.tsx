import Image from "next/image"
import Link from "next/link"
import LazyVideo from "@/components/lazy-video"
import { JsonLd, hibachiAtHomeServiceJsonLd } from "@/components/structured-data"
import LandingHero, { FIRST_MILES_FREE } from "@/components/city/landing-hero"
import LandingDiffs from "@/components/city/landing-diffs"
import LandingCtaButton from "@/components/city/landing-cta-button"
import {
  CheckList,
  FactCards,
  FaqList,
  FinalCta,
  LandingBody,
  LandingSection,
  LandingShell,
  LinkPills,
  PlaceChips,
  ReviewCards,
  SectionTitle,
} from "@/components/city/landing-parts"
import { cityPages } from "@/config/city-pages"
import { GOOGLE_REVIEWS } from "@/config/reviews"
import { phone, smsHref, whatsappHref } from "@/config/site"

// 2026-09-21: rebuilt on the Joshua Tree shell (photo hero + the card that
// asks for the phone first), and as a server component - the old page was a
// client component with click handlers on every button. Metadata is in
// layout.tsx and unchanged; every heading, paragraph, FAQ, review and city
// link keeps its text. The crossed-out "$60" beside $59.90 is gone: nobody was
// ever charged $60.

const faqs = [
  {
    question: "Do I need to prepare anything?",
    answer: "No! We bring the grill, table, and all ingredients. You just provide the space and guests.",
  },
  {
    question: "Is cleanup included?",
    answer: "Yes. We leave your space as clean as it was. Complete setup and cleanup included.",
  },
  {
    question: "Can you cook for kids or vegetarians?",
    answer: "Of course! Let us know dietary restrictions and we'll adjust the menu accordingly.",
  },
  {
    question: "How do I pay?",
    answer: "Zelle, Venmo, or cash, with the balance due on the day of service.",
  },
  {
    question: "What if it rains?",
    answer: "The grill needs cover, not the whole party. Most clients put up a 10'x10' pop-up tent over the chef's station — cheap to buy or rent, and we do not supply them. Guests can also eat indoors while the chef cooks outside. If you still need to cancel for weather, give us at least 72 hours notice and there is no charge.",
  },
  {
    question: "Can I cancel or reschedule?",
    answer: "Yes. Cancel or reschedule at least 72 hours before your event at no cost. Inside 72 hours we may not be able to refund in full.",
  },
]

const serviceFeatures = [
  { title: "What's Included", description: "Private chef, grill, full setup, cleanup. You host, we cook." },
  { title: "What You Eat", description: "Fried rice, salad, veggies, and 2 proteins per guest. Add lobster or filet upgrades!" },
  { title: "What to Expect", description: "Live hibachi show with fire tricks, food tossing, and crowd interaction." },
  { title: "Duration", description: "~1.5 to 2 hours depending on guest count and menu." },
  { title: "Guest Minimum", description: "$599 event minimum — about 10 adults. Perfect for birthdays or backyard dinners." },
  { title: "Optional Add-ons", description: "We offer table, chair & utensil rentals — or you're welcome to use your own!" },
]

// Customer reviews
// Verbatim 5-star Google reviews from the Real Hibachi listing (owner-supplied,
// 2026-08) — same pool as /quote and the homepage; do not invent locations/dates.
const reviews = [
  {
    name: "Warren Zhang",
    rating: 5,
    text: "Bling was a great chef and also very personable! He made our night and it was my birthday! Best night ever!",
  },
  {
    name: "Laura Gallop",
    rating: 5,
    text: "Chef Bling and Chef Noodle was great! Very entertaining and food was delicious.",
  },
  {
    name: "Karen Wertheimer",
    rating: 5,
    text: "Just had a wonderful dinner prepared by Blue. He was engaging and entertaining. I would recommend this for any occasion.",
  },
]


// The four verbatim Google reviews the old TestimonialsSection showed.
const MORE_REVIEWS = GOOGLE_REVIEWS.filter((r) => ["Kelsey Molnar", "Lisa Craven", "Judy Gothelf", "Beatrix Barrera"].includes(r.name))

const TRUST_MARKERS = ["Book & modify online 24/7", "500+ parties served", "Free cancellation up to 72h"]

function VideoBlock({ poster, src, lead, note }: { poster: string; src: string; lead: string; note: string }) {
  return (
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-center lg:gap-10">
      <div className="relative aspect-video overflow-hidden rounded-[28px] bg-cocoa">
        <LazyVideo className="absolute inset-0 h-full w-full object-cover" controls poster={poster} src={src} />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="font-semibold text-flame-700">{lead}</p>
        <p className="text-sm leading-relaxed text-clay-700">{note}</p>
      </div>
    </div>
  )
}

export default function HibachiAtHomePage() {
  return (
    <LandingShell>
      <JsonLd data={hibachiAtHomeServiceJsonLd} />
      <LandingHero
        kicker="Private Hibachi Catering"
        title="The Effortless Hibachi At Home Experience"
        subhead="Plan the party in 3 minutes — spend the evening with the people you love."
        chips={TRUST_MARKERS}
        imageAlt="Live hibachi fire show at a backyard party - private hibachi chef at home in Los Angeles"
        estimator={{ citySlug: "hibachi-at-home", cityName: "LA & Orange County", source: "seo_hibachi_at_home", travelNote: FIRST_MILES_FREE }}
      />

      <LandingBody>
        <LandingDiffs distanceLine="Most of LA and Orange County sits inside the free 50 miles" />

        <p className="text-lg font-semibold leading-snug lg:hidden">Plan the party in 3 minutes — spend the evening with the people you love.</p>

        <LandingSection
          title="Now Serving Los Angeles & Orange County"
          lead="Experience authentic hibachi at home in Los Angeles, Beverly Hills, Santa Monica, Irvine, and nearby Orange County cities."
        >
          <PlaceChips places={["Los Angeles County", "Orange County", "Same Day Available"]} />
          <div className="grid grid-cols-3 gap-2.5 lg:gap-4">
            {[
              { big: "500+", label: "Parties Served" },
              { big: "6", label: "SoCal Counties Covered" },
              { big: "24/7", label: "Online Self-Service Booking" },
            ].map((c) => (
              <div key={c.label} className="flex flex-col gap-1 rounded-2xl bg-surface/70 p-3.5 lg:p-[22px]">
                <span className="font-serif text-2xl font-extrabold leading-none text-flame lg:text-[34px]">{c.big}</span>
                <span className="text-xs text-clay-700 lg:text-sm">{c.label}</span>
              </div>
            ))}
          </div>
          <div>
            <LandingCtaButton surface="seo_hibachi_at_home_la_oc" className="inline-flex h-11 items-center rounded-full bg-flame px-6 text-sm font-semibold text-white hover:bg-flame-600">
              Book Hibachi at Home in LA
            </LandingCtaButton>
          </div>
        </LandingSection>

        <LandingSection
          title="Hibachi at Home Service in Los Angeles & Orange County"
          lead="Real Hibachi brings a private hibachi chef to your house, backyard, apartment community, or event space. We handle the cooking experience on-site so you can host without turning dinner into another project."
        >
          <FactCards
            items={[
              {
                title: "What is included",
                body: (
                  <>
                    <p>Private chef, mobile grill, fresh ingredients, chef show, setup, and cleanup.</p>
                    <p>Guests typically receive fried rice, salad, vegetables, and two protein choices.</p>
                  </>
                ),
              },
              {
                title: "Pricing & minimums",
                body: (
                  <>
                    <p>
                      Standard hibachi at home pricing is $59.90 per adult, $29.90 per child 5–12, under 5 free. Mon–Thu Weekday Special $54.90 per adult with a free appetizer platter. Parties of 10+ save $30–$90 automatically.
                    </p>
                    <p>Every event carries a $599 minimum (about 10 adults), with optional upgrades and rentals.</p>
                  </>
                ),
              },
              {
                title: "Service areas",
                body: (
                  <>
                    <p>Serving Los Angeles County and Orange County, including LA, Santa Monica, Beverly Hills, Irvine, Anaheim, and Newport Beach.</p>
                    <p>Enter your city or ZIP code in the quote form to confirm availability and any travel fee.</p>
                  </>
                ),
              },
            ]}
          />
          <div>
            <LandingCtaButton surface="seo_hibachi_at_home_summary" className="inline-flex h-11 items-center rounded-full bg-flame px-6 text-sm font-semibold text-white hover:bg-flame-600">
              Get a Hibachi at Home Quote
            </LandingCtaButton>
          </div>
        </LandingSection>

        <section className="flex flex-col gap-3.5 lg:gap-5">
          <div className="flex flex-col gap-1.5">
            <SectionTitle as="h3">&ldquo;We bring the restaurant to your backyard.&rdquo;</SectionTitle>
            <p className="max-w-[760px] text-sm leading-relaxed text-clay-700 lg:text-base">
              A professional hibachi chef comes to your home with the grill, ingredients, setup, show, and cleanup needed for an authentic Japanese-style private dining experience.
            </p>
          </div>
          <FactCards items={serviceFeatures.map((f) => ({ title: f.title, body: <p>{f.description}</p> }))} />
        </section>

        <LandingSection title="Our Popular Packages" lead="Choose from our carefully crafted packages designed to provide the perfect hibachi experience for any occasion">
          <div className="flex flex-col overflow-hidden rounded-[28px] border border-ink/10 bg-surface shadow-organic lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="relative aspect-[4/3] lg:aspect-auto">
              <Image src="/images/design-mode/Chicken-and-Beef-Hibachi-Catering-LA.jpg" alt="Basic Package" fill sizes="(max-width: 1024px) 100vw, 520px" className="object-cover" />
            </div>
            <div className="flex flex-col gap-3 p-5 lg:p-8">
              <span className="w-fit rounded-full bg-flame-100 px-3 py-1 text-xs font-semibold text-flame-700">Most Popular</span>
              <h3 className="font-serif text-2xl font-extrabold leading-tight">Hibachi Show Package</h3>
              <p className="font-serif text-3xl font-extrabold leading-none">
                $59.90<span className="font-sans text-sm font-medium text-clay-600"> per person</span>
              </p>
              <p className="text-xs text-clay-600">($599 minimum)</p>
              <CheckList items={["2 proteins of your choice", "Fried rice & vegetables", "Chef performance included", "Perfect for intimate gatherings"]} />
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <LandingCtaButton surface="seo_hibachi_at_home_package" className="inline-flex h-11 items-center rounded-full bg-flame px-6 text-sm font-semibold text-white hover:bg-flame-600">
                  Book Now
                </LandingCtaButton>
                <Link href="/menu" className="text-sm font-semibold text-flame-700 underline">
                  View Menu
                </Link>
              </div>
            </div>
          </div>
        </LandingSection>

        <LandingSection title="Perfect for Birthday Parties & Celebrations" lead="Make your special occasions unforgettable with a private hibachi chef and an exciting dining experience">
          <VideoBlock
            poster="/videos/posters/party-highlight.jpg"
            src="/gallery/real-hibachi-party-orange-county-backyard-video-02.mp4"
            lead="Create lasting memories with friends and family at your next celebration!"
            note="Our chefs bring the entertainment and delicious food directly to your home or venue"
          />
          <div>
            <LandingCtaButton surface="seo_hibachi_at_home_party" className="inline-flex h-11 items-center rounded-full bg-flame px-6 text-sm font-semibold text-white hover:bg-flame-600">
              Book Your Party Experience
            </LandingCtaButton>
          </div>
        </LandingSection>

        <LandingSection title="When Our Fire Gets Too Real" lead="Sometimes our hibachi fire is so authentic, even the fire department wants to join the party!">
          <VideoBlock
            poster="/videos/posters/real-fire.jpg"
            src="/videos/real-fire.mp4"
            lead="Our hibachi fire is so real, sometimes we get unexpected guests!"
            note="Don't worry - our chefs are trained professionals who know how to handle the heat safely."
          />
        </LandingSection>

        <LandingSection title="Experience the Atmosphere" lead="See how our hibachi experience transforms your home into an exciting dining venue">
          <div className="relative aspect-video overflow-hidden rounded-[28px] bg-cocoa">
            <LazyVideo className="absolute inset-0 h-full w-full object-cover" controls poster="/videos/posters/atmosphere.jpg" src="/videos/atmosphere.mp4" />
          </div>
          <FactCards
            items={[
              { title: "Lively Atmosphere", body: <p>Experience the excitement and energy of a hibachi restaurant in your own home.</p> },
              { title: "Family Friendly", body: <p>Perfect entertainment for guests of all ages, creating memorable experiences.</p> },
              { title: "Spectacular Show", body: <p>Watch as our skilled chefs perform impressive cooking techniques and fire tricks.</p> },
            ]}
          />
        </LandingSection>

        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-2 lg:gap-14">
          <FaqList
            heading="Frequently Asked Questions"
            faqs={faqs}
            footer={
              <Link href="/faq" className="font-semibold text-flame-700 underline">
                View All FAQs
              </Link>
            }
          />
          <section className="flex flex-col gap-3">
            <SectionTitle as="h3">What Our Customers Say</SectionTitle>
            <ReviewCards reviews={reviews.map((r) => ({ name: r.name, text: r.text, source: "Google review" }))} />
            <a href={smsHref("I'm interested in booking a REAL HIBACHI experience")} className="text-sm font-semibold text-flame-700 underline">
              Text for Instant Quote
            </a>
          </section>
        </div>

        <LandingSection title="Real Reviews, Real Parties" lead="Verbatim 5-star Google reviews from SoCal events">
          <ReviewCards reviews={MORE_REVIEWS.map((r) => ({ name: r.name, text: r.text, source: "Google review" }))} />
        </LandingSection>

        <LandingSection title="Signature Fried Rice" lead="Watch our chef prepare our signature fried rice.">
          <VideoBlock
            poster="/videos/posters/fried-rice.jpg"
            src="/videos/fried-rice.mp4"
            lead="Our signature fried rice is a crowd favorite!"
            note="Made with fresh ingredients and cooked to perfection."
          />
        </LandingSection>

        <LandingSection title="Hibachi at Home Across Southern California" lead="Find your city for local pricing, popular occasions, and neighborhood coverage.">
          <LinkPills links={cityPages.map((city) => ({ label: city.city, href: `/hibachi-at-home/${city.slug}` }))} />
        </LandingSection>

        <FinalCta
          heading="Ready to Create Unforgettable Memories?"
          body="Book your hibachi experience today and bring the excitement of Japanese cuisine directly to your home. Our professional chefs are ready to create an amazing show and delicious meal for you and your guests."
        >
          <div className="flex flex-col gap-4 pt-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-10 lg:pt-8">
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { big: "500+", label: "Parties Served" },
                { big: "1 per 28", label: "A Dedicated Chef & Griddle per 28 Guests" },
                { big: "72h", label: "Full-Refund Cancellation Window" },
              ].map((c) => (
                <div key={c.label} className="flex flex-col gap-1 rounded-2xl bg-surface/70 p-3.5">
                  <span className="font-serif text-xl font-extrabold leading-none text-flame lg:text-2xl">{c.big}</span>
                  <span className="text-xs text-clay-700">{c.label}</span>
                </div>
              ))}
            </div>
            <div className="relative aspect-[16/9] overflow-hidden rounded-[28px]">
              <Image src="/hibachi-group-selfie.jpg" alt="Happy customers enjoying hibachi experience at home" fill sizes="(max-width: 1024px) 100vw, 560px" className="object-cover" />
            </div>
          </div>
          <p className="pt-4 text-xs leading-[1.8] text-clay-600 lg:text-[13px]">
            Online Booking — book at your convenience, 24/7 Service Available ·{" "}
            <a href={whatsappHref("Hello, I would like to book a hibachi experience")} className="hover:text-flame-700">
              WhatsApp
            </a>{" "}
            — fastest response time ·{" "}
            <a href={smsHref("I'm interested in booking a REAL HIBACHI experience")} className="hover:text-flame-700">
              SMS
            </a>{" "}
            — text us directly · Phone — speak with us:{" "}
            <a href={phone.voice.tel} className="hover:text-flame-700">
              {phone.voice.dashed}
            </a>
          </p>
        </FinalCta>
      </LandingBody>
    </LandingShell>
  )
}
