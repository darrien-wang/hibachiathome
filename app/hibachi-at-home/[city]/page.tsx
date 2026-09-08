import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { cityPages, getCityPage, getNearbyCityPages } from "@/config/city-pages"
import { getCityClimate } from "@/config/city-climate"
import { getCityTravel } from "@/config/city-travel"
import { pickReviews } from "@/config/reviews"
import { hasCateringPage } from "@/config/catering-cities"
import { sourcing, sourcingAllergenNote } from "@/config/sourcing"
import LandingTemplate, { type LandingDetail } from "@/components/city/landing-template"
import GeoCityName from "@/components/city/geo-city-name"
import { JsonLd, BUSINESS_ID } from "@/components/structured-data"
import { smsHref } from "@/config/site"

const BASE_URL = "https://www.realhibachi.com"

export async function generateStaticParams() {
  return cityPages.map((page) => ({ city: page.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const { city } = await params
  const page = getCityPage(city)

  if (!page) {
    return { title: "Page Not Found" }
  }

  const url = `${BASE_URL}/hibachi-at-home/${page.slug}`

  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      title: `${page.metaTitle} | Real Hibachi`,
      description: page.metaDescription,
      url,
      siteName: "Real Hibachi",
      locale: "en_US",
      type: "website",
      images: [
        {
          url: `${BASE_URL}/images/hibachi-flame-og.png`,
          width: 1200,
          height: 630,
          alt: `Hibachi at home private chef in ${page.city}, CA`,
        },
      ],
    },
  }
}

const included = [
  "Professional chef & mobile teppanyaki grill — we bring everything",
  "2 proteins per guest: chicken, steak, shrimp, salmon or tofu",
  "Garlic butter fried rice, vegetables & salad — refills free",
  "Onion volcano, egg toss, fire tricks, crowd games",
  "Complete setup and cleanup",
]

// 2026-09-08: the page now follows the "Realhibachi Landing Page" board —
// conversion path first, and the city long-form (parking, weather table,
// sourcing, occasions, venues, intro, chef story) folded into "{city} details"
// so it stays indexed without sitting between the visitor and the price.
export default async function CityPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params
  const page = getCityPage(city)

  if (!page) {
    notFound()
  }

  const nearby = getNearbyCityPages(page)
  const climate = getCityClimate(page.slug)
  const travel = getCityTravel(page.slug)
  const url = `${BASE_URL}/hibachi-at-home/${page.slug}`

  // City-specific questions first, then the ones every city gets asked.
  const faqs = [
    ...page.faqs,
    {
      question: `How much space do you need in ${page.city}?`,
      answer: `About a 6x8 ft flat area for the grill plus roughly 10 ft of overhead clearance, in open air — a patio, deck, driveway, or yard all work. Enclosed rooms and covered balconies do not. Send a photo when you book and we'll confirm the setup spot before your date.`,
    },
    {
      question: `Is this an indoor or outdoor party?`,
      answer: `The cooking is outdoors; the eating does not have to be. A live teppanyaki grill throws real smoke and grease and will set off a smoke alarm indoors, so the grill always stays outside — on a patio, deck, driveway, yard, or roof terrace, with about 10 ft of overhead clearance. Your guests can absolutely sit and eat inside. Plenty of ${page.city} parties run exactly that way: the chef cooks on the patio and plates come indoors, which is what we'd suggest on a hot afternoon or a cold night.`,
    },
    {
      question: `Can we book a lunch or daytime slot?`,
      answer: `Yes. Because the party is outdoors, the right answer depends on your city and the season — midday stays comfortable near the coast for most of the year, while inland and Valley cities are best at lunch roughly October through May and better at sunset in high summer. Daytime slots are usually easier to get than weekend evenings. Tell us your date and preferred time and we'll tell you honestly whether it works.`,
    },
    {
      question: `What happens if we need to cancel or reschedule?`,
      answer: `Cancel or reschedule at least 72 hours before your event and your $19.90 deposit is refunded in full. Inside 72 hours the deposit may become non-refundable. If rain is the problem, a 10'x10' pop-up tent over the chef's station usually saves the party — you provide the tent, we do not supply them — and guests can eat indoors while the chef cooks outside.`,
    },
  ]

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${url}#service`,
    name: `Hibachi at Home in ${page.city}, CA`,
    serviceType: "Private hibachi chef catering",
    provider: { "@id": BUSINESS_ID },
    description: page.metaDescription,
    areaServed: [
      { "@type": "City", name: `${page.city}, CA` },
      ...page.neighborhoods.map((name) => ({ "@type": "Place", name: `${name}, CA` })),
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
      url,
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
      { "@type": "ListItem", position: 2, name: "Hibachi at Home", item: `${BASE_URL}/hibachi-at-home` },
      { "@type": "ListItem", position: 3, name: page.city, item: url },
    ],
  }

  // The party package as a Product carrying only real, verbatim on-page Google
  // reviews. No aggregateRating: the live GBP profile can't verify one, and an
  // unverifiable self-serving rating in structured data is a Google penalty
  // risk. The reviews below are rendered verbatim on this page.
  const cityReviews = pickReviews(page.slug)
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#package`,
    name: `Hibachi at Home Party Package — ${page.city}, CA`,
    description: `Private hibachi chef, mobile teppanyaki grill, live fire show, 2 proteins per guest, fried rice, vegetables, salad, setup and cleanup — at your home in ${page.city}, CA.`,
    image: `${BASE_URL}/images/hibachi-flame-og.png`,
    brand: { "@type": "Brand", name: "Real Hibachi" },
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: "59.90",
      priceValidUntil: "2027-12-31",
      availability: "https://schema.org/InStock",
      url,
    },
    review: cityReviews.map((review) => ({
      "@type": "Review",
      reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
      author: { "@type": "Person", name: review.name },
      reviewBody: review.text,
    })),
  }

  const details: LandingDetail[] = [
    {
      title: "Parking, stairs & setup",
      body: (
        <>
          {page.logistics.map((paragraph) => (
            <p key={paragraph.slice(0, 32)}>{paragraph}</p>
          ))}
          <p>Not sure your space works? Send a photo with your quote request and we will confirm the setup spot before your date.</p>
        </>
      ),
    },
    ...(climate
      ? [
          {
            title: "Space & weather plan",
            body: (
              <>
                <p>
                  We need roughly a 6×8 ft flat outdoor area and about 10 ft of overhead clearance. Best evening months in {page.city}: {climate.bestEvening || "ask us — comfortable evenings are limited here"}; best lunch months: {climate.bestLunch || "evening is the better booking here"}.
                </p>
                <p>
                  July averages a high of {climate.julyHigh}°F against {climate.januaryHigh}°F in January.{" "}
                  {climate.hotMonths
                    ? `From ${climate.hotMonths} the afternoon is genuinely hot next to a teppanyaki grill, so start at or after sunset in those months.`
                    : `No month here averages above 93°F, so ${page.city} takes daytime bookings comfortably across most of the year.`}{" "}
                  Rain is worth planning around in {climate.wettestMonth}, when about {climate.wettestPct}% of days see measurable rain — a 10×10 pop-up tent over the chef station saves the party, and guests can eat indoors. Evenings run longest in {climate.latestSunsetMonth} (sunset around {climate.latestSunset}); start 90 minutes before sunset for the golden-hour show.
                </p>
                <p>
                  {travel && travel.fee > 0
                    ? `Travel: about $${travel.fee} on a ${page.city} booking — the first 50 miles are free, then $1 per mile, and the exact amount is shown in your quote before you pay.`
                    : `Travel: none for ${page.city} — it sits inside our free 50-mile radius, so your quote carries no travel fee at all.`}
                </p>
                <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-surface">
                  <table className="w-full text-xs">
                    <caption className="sr-only">Monthly averages for {page.city}, 2019–2024</caption>
                    <thead className="text-clay-600">
                      <tr>
                        <th scope="col" className="px-3 py-2 text-left font-medium">Month</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">High</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Low</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Rainy days</th>
                        <th scope="col" className="px-3 py-2 text-right font-medium">Sunset</th>
                      </tr>
                    </thead>
                    <tbody>
                      {climate.months.map((m) => (
                        <tr key={m.month} className="border-t border-ink/10">
                          <th scope="row" className="px-3 py-1.5 text-left font-medium text-ink">{m.month}</th>
                          <td className="px-3 py-1.5 text-right tabular-nums">{m.high}°F</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{m.low}°F</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{m.rainPct}%</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{m.sunset}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs">Averages from the Open-Meteo historical archive, 2019–2024.</p>
              </>
            ),
          },
        ]
      : []),
    {
      title: "What we actually buy",
      body: (
        <>
          {sourcing.map((row) => (
            <p key={row.item}>
              <strong className="text-ink">{row.item}:</strong> {row.spec}. {row.note}
            </p>
          ))}
          <p>
            <strong className="text-ink">Allergies:</strong> {sourcingAllergenNote}
          </p>
        </>
      ),
    },
    {
      title: `Popular ${page.city} parties`,
      body: (
        <>
          {page.occasions.map((occasion) => (
            <p key={occasion.title}>
              <strong className="text-ink">{occasion.title}.</strong> {occasion.description}
            </p>
          ))}
          <p>
            See how each celebration plays out: <Link href="/party/birthday-party" className="underline">birthdays</Link>,{" "}
            <Link href="/party/pool-party" className="underline">pool parties</Link>,{" "}
            <Link href="/party/family-reunion" className="underline">family reunions</Link> and{" "}
            <Link href="/party" className="underline">more party ideas</Link>.
          </p>
        </>
      ),
    },
    {
      title: `Where we set up in ${page.city}`,
      body: (
        <>
          {page.venues.map((venue) => (
            <p key={venue.title}>
              <strong className="text-ink">{venue.title}.</strong> {venue.description}
            </p>
          ))}
        </>
      ),
    },
    {
      title: `Why ${page.city} hosts book us`,
      body: (
        <>
          {page.intro.map((paragraph) => (
            <p key={paragraph.slice(0, 32)}>{paragraph}</p>
          ))}
        </>
      ),
    },
    ...(page.story
      ? [
          {
            title: page.story.heading,
            body: (
              <>
                {page.story.body.map((paragraph) => (
                  <p key={paragraph.slice(0, 32)}>{paragraph}</p>
                ))}
                <p>
                  — Chef Bling, Real Hibachi
                  {page.story.readMore ? (
                    <>
                      {" · "}
                      <Link href={page.story.readMore.href} className="underline">
                        {page.story.readMore.label}
                      </Link>
                    </>
                  ) : null}
                </p>
              </>
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      <JsonLd data={[serviceJsonLd, faqJsonLd, breadcrumbJsonLd, productJsonLd]} />
      <LandingTemplate
        city={page.city}
        citySlug={page.slug}
        smsHref={smsHref(`Hi! I'd like a quote for a hibachi party in ${page.city}.`)}
        kicker={`Private hibachi chef · ${page.city} & all of SoCal`}
        title={
          <>
            Hibachi at Home in <GeoCityName fallback={page.city} />
          </>
        }
        subhead="Private chef, teppanyaki grill and the full fire show in your backyard."
        distanceMiles={travel?.miles ?? null}
        travelFee={travel?.fee ?? null}
        reviews={cityReviews}
        included={included}
        hoods={page.neighborhoods}
        bestEvening={climate?.bestEvening}
        details={details}
        faqs={faqs}
        ctaHeading={`Ready to book hibachi at home in ${page.city}?`}
        nearby={nearby.map((n) => ({ label: n.city, href: `/hibachi-at-home/${n.slug}` }))}
        nearbyLabel="Hibachi at home nearby"
        footnote={
          hasCateringPage(page.slug) ? (
            <>
              Hosting a bigger event?{" "}
              <Link href={`/hibachi-catering/${page.slug}`} className="underline hover:text-flame-700">
                Hibachi catering in {page.city}
              </Link>
              .
            </>
          ) : null
        }
      />
    </>
  )
}
