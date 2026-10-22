import type { Metadata } from "next"
import { pickReviews } from "@/config/reviews"
import { cityPages } from "@/config/city-pages"
import LandingTemplate from "@/components/city/landing-template"
import { LandingSection } from "@/components/city/landing-parts"
import { JsonLd, BUSINESS_ID } from "@/components/structured-data"
import { smsHref } from "@/config/site"

// 2026-10-21 (owner: "做一页长尾页面吧"). Catches the "on-site bbq catering" /
// "hire someone to grill at my party" long tail that a competitor serves with
// SEO tag pages. Keyword Planner says the exact phrase is tiny (20/mo in all
// of California) and the wider "bbq catering" cluster wants brisket buffets
// for 75+, so this page is honest about what we are: a hibachi chef who
// grills live at the party. It is not a paid landing page - no campaign
// points here (D-1021-03).

const BASE_URL = "https://www.realhibachi.com"
const URL = `${BASE_URL}/on-site-grill-catering`

export const metadata: Metadata = {
  title: "On-Site Grill Catering LA & OC | Hibachi Chef Comes to You",
  description:
    "Live grill catering in Los Angeles, Orange County and all of Southern California: a hibachi chef sets up the grill at your party and cooks 2 proteins, fried rice and veggies in front of your guests. From $54.90 per adult.",
  alternates: { canonical: URL },
  openGraph: {
    title: "On-Site Grill Catering in Southern California | Real Hibachi",
    description:
      "Looking for on-site BBQ catering? Get a hibachi chef instead: live grill, fire show, 2 proteins per guest, cooked at your place. Published pricing.",
    url: URL,
    siteName: "Real Hibachi",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: `${BASE_URL}/images/hibachi-flame-og.png`,
        width: 1200,
        height: 630,
        alt: "Hibachi chef grilling on-site at a backyard party in Southern California",
      },
    ],
  },
}

const included = [
  "A hibachi chef and the teppanyaki grill — we bring the grill, propane and ingredients",
  "2 proteins per guest, grilled in front of them: chicken, steak, shrimp, salmon or tofu",
  "Garlic butter fried rice, grilled vegetables & salad — refills free",
  "The show: onion volcano, egg toss, fire tricks, crowd games",
  "Tarp under the grill, nothing left behind when we leave",
]

const faqs = [
  {
    question: "Can I hire someone to grill for a party?",
    answer:
      "Yes — that is exactly what a hibachi chef is. The chef arrives with a teppanyaki grill, propane and all the ingredients, sets up in your backyard, driveway or patio, and cooks course by course in front of your guests. You don't buy, prep, grill or clean a single thing. Most parties are 10 to 40 guests; bigger groups get one chef and grill per 28 guests.",
  },
  {
    question: "Is a hibachi chef the same as BBQ catering?",
    answer:
      "Same backyard, different dinner. BBQ catering usually means smoked meats delivered in trays or a pit crew for 75+ guests. A hibachi chef cooks live on a flat-top grill at your table: steak, chicken, shrimp or salmon with fried rice and vegetables, plus the fire show. It works best for 10 to 40 guests who want dinner and entertainment in one, not a buffet line.",
  },
  {
    question: "Do you grill burgers, hot dogs, ribs or brisket?",
    answer:
      "No. Our menu is hibachi: chicken, steak, shrimp, salmon, tofu, filet mignon, scallops and lobster tail, with garlic butter fried rice, vegetables and salad. If your party needs ribs and brisket, a BBQ pit caterer is the right call. If you want the grill to be the entertainment, that's us.",
  },
  {
    question: "How much does on-site grill catering cost?",
    answer:
      "$59.90 per adult, $29.90 per child 5–12, kids under 5 eat free, with a $599 event minimum. Monday–Thursday parties get the Weekday Special at any size: $54.90 per adult plus a free appetizer of your choice (gyoza, edamame or spring rolls). Parties of 10–14 adults save $30, 15–24 save $60, 25–30 save $90, 31–40 save $120, 41–50 save $150, 51–60 save $180 — any day, applied automatically. See your price range with no sign-up; the exact total comes by text.",
  },
  {
    question: "What do you need at the party?",
    answer:
      "A flat outdoor spot about the size of a king-size bed with roughly 10 feet of overhead clearance: backyard, patio, deck, driveway, courtyard or roof terrace. No power, no water, no kitchen — the grill runs on propane we bring and the chef arrives prepped. Cooking is always outdoors; your guests can eat inside or out.",
  },
  {
    question: "Can the chef grill at a park, an office or a vacation rental?",
    answer:
      "Yes, as long as the site allows open-flame cooking outdoors — most parks with BBQ areas, office patios and courtyards, and vacation rentals from Palm Springs to Big Bear do. Tell us the address and we handle the rest. The first 50 miles of travel are free, then $1 per additional mile, shown in your quote before anything is booked.",
  },
]

const compare = [
  { what: "Who cooks", bbq: "Pit crew or drop-off trays", us: "A hibachi chef at your table" },
  { what: "Group size", bbq: "Often 50–75 guests minimum", us: "10 adults minimum, 10–40 is the sweet spot" },
  { what: "The food", bbq: "Brisket, ribs, pulled pork in chafing dishes", us: "Steak, chicken, shrimp, salmon — grilled to order" },
  { what: "The evening", bbq: "A buffet line", us: "Dinner and the show in one" },
  { what: "Setup", bbq: "Tables of trays and warmers", us: "One grill, a tarp, done in 90 minutes" },
]

export default function OnSiteGrillCateringPage() {
  const reviews = pickReviews("on-site-grill-catering")

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${URL}#service`,
    name: "On-Site Grill Catering in Southern California",
    serviceType: "On-site hibachi grill catering",
    provider: { "@id": BUSINESS_ID },
    description:
      "A hibachi chef and teppanyaki grill set up at your home, backyard, office or vacation rental anywhere in Southern California and cook 2 proteins per guest, fried rice and vegetables live in front of your guests.",
    areaServed: [
      { "@type": "AdministrativeArea", name: "Los Angeles County, CA" },
      { "@type": "AdministrativeArea", name: "Orange County, CA" },
      { "@type": "AdministrativeArea", name: "San Diego County, CA" },
      { "@type": "AdministrativeArea", name: "Riverside County, CA" },
      { "@type": "AdministrativeArea", name: "San Bernardino County, CA" },
      { "@type": "AdministrativeArea", name: "Ventura County, CA" },
    ],
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: "59.90",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "59.90",
        priceCurrency: "USD",
        unitText: "per adult ($29.90 per child 5–12, kids under 5 free, $599 event minimum)",
      },
      availability: "https://schema.org/InStock",
      url: URL,
    },
  }

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
      { "@type": "ListItem", position: 2, name: "Hibachi Catering", item: `${BASE_URL}/hibachi-catering` },
      { "@type": "ListItem", position: 3, name: "On-Site Grill Catering", item: URL },
    ],
  }

  const topCities = cityPages.slice(0, 12)

  return (
    <>
      <JsonLd data={[serviceJsonLd, faqJsonLd, breadcrumbJsonLd]} />
      <LandingTemplate
        city="Southern California"
        citySlug="on-site-grill-catering"
        source="seo_grill_catering"
        smsHref={smsHref("Hi! I'd like a quote for a hibachi chef to grill at my party.")}
        kicker="On-site grill catering · Los Angeles, Orange County & all of SoCal"
        title={
          <>
            Looking for on-site BBQ catering? <span className="text-flame-300">Get a hibachi chef instead.</span>
          </>
        }
        subhead="A chef, a teppanyaki grill and the fire show set up in your backyard and cook course by course in front of your guests."
        chips={["Chef Grills at Your Party", "10–40 Guests Is the Sweet Spot", "Our Own Chefs", "Free to Cancel Up to 48h"]}
        reviews={reviews}
        included={included}
        includedHeading="Every on-site booking includes"
        reviewsHeading="Hosts who hired the grill"
        hoods={topCities.map((c) => c.city)}
        hoodsHeading="Where the grill travels"
        bestEvening="April – November"
        details={[
          {
            title: "What 'on-site' means here",
            body: (
              <>
                <p>
                  Nothing is cooked ahead and driven over in trays. The chef lights the grill at your place and cooks each protein to order, so the steak is seared and the shrimp are hot when they hit the plate. Guests sit, watch, eat, repeat.
                </p>
                <p>
                  The grill needs a flat outdoor spot and about 10 feet of clearance. Propane, ingredients, utensils and a tarp come with the chef — you provide the people and the plates, or rent tables, chairs and place settings from us.
                </p>
              </>
            ),
          },
          {
            title: "Who books a grill chef instead of BBQ",
            body: (
              <>
                <p>
                  Backyard birthdays of 15 to 30, family dinners at a Palm Springs or Big Bear rental, office patios on a Friday, bachelorette weekends by the pool: parties that want dinner to be the event, not a line at a buffet.
                </p>
                <p>
                  If you need 100 plates of ribs on a budget, a BBQ pit caterer will serve you better and we'll say so. If you want the grill to be the entertainment, text us your date.
                </p>
              </>
            ),
          },
        ]}
        detailsHeading="On-site grill details"
        faqs={faqs}
        faqHeading="Grill catering questions"
        ctaHeading="Your backyard. Our grill."
        ctaBody="See your price range in 30 seconds. Exact quote and your party discount by text."
        nearby={[
          { label: "Hibachi catering", href: "/hibachi-catering" },
          { label: "Mobile hibachi", href: "/mobile-hibachi" },
          { label: "Private hibachi chef", href: "/private-hibachi-chef" },
          { label: "Backyard party", href: "/party/backyard-party" },
          { label: "Corporate event", href: "/party/corporate-event" },
          { label: "Employee appreciation lunch", href: "/party/employee-appreciation-lunch" },
        ]}
        nearbyLabel="Related pages"
      >
        <LandingSection title="BBQ catering vs. a hibachi chef" lead="Same backyard, different dinner. Here is the honest comparison.">
          <div className="overflow-x-auto rounded-[28px] border border-ink/10 bg-surface shadow-organic">
            <table className="w-full min-w-[560px] text-left text-sm lg:text-[15px]">
              <thead>
                <tr className="border-b border-ink/10 text-[11px] font-bold uppercase tracking-[0.08em] text-clay-600">
                  <th scope="col" className="px-4 py-3 lg:px-5">&nbsp;</th>
                  <th scope="col" className="px-4 py-3 lg:px-5">BBQ catering</th>
                  <th scope="col" className="px-4 py-3 text-flame-700 lg:px-5">Hibachi chef on-site</th>
                </tr>
              </thead>
              <tbody>
                {compare.map((row) => (
                  <tr key={row.what} className="border-b border-ink/10 last:border-b-0">
                    <th scope="row" className="px-4 py-3 font-semibold lg:px-5">{row.what}</th>
                    <td className="px-4 py-3 text-clay-700 lg:px-5">{row.bbq}</td>
                    <td className="px-4 py-3 lg:px-5">{row.us}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </LandingSection>
      </LandingTemplate>
    </>
  )
}
