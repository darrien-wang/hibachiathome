import type React from "react"
import type { Metadata } from "next"
import Script from "next/script"
import "./globals.css"
import { Header } from "@/components/header"
import Footer from "@/components/footer"
import { Analytics } from "@vercel/analytics/react"
import { Suspense } from "react"
import { TrackingBootstrap } from "@/components/tracking-bootstrap"
import { HideOnAdmin } from "@/components/hide-on-admin"
import LanguageSuggestBanner from "@/components/language-suggest-banner"
import { JsonLd, localBusinessJsonLd, webSiteJsonLd } from "@/components/structured-data"

const DEFAULT_GTM_ID = "GTM-WQZNBK82"
// Google Ads conversion tag (account tag; conversion labels live in lib/tracking.ts).
const DEFAULT_GOOGLE_ADS_ID = "AW-17018331447"

export const metadata: Metadata = {
  metadataBase: new URL("https://www.realhibachi.com"),
  title: {
    default: "Hibachi at Home Los Angeles, OC & SoCal | Real Hibachi",
    template: "%s | Real Hibachi",
  },
  description:
    "Private hibachi chef at your home in Los Angeles, Orange County, San Diego & all of Southern California. $59.90 per adult flat rate — chef, grill, food, show, setup & cleanup included. Get an instant quote!",
  keywords:
    "hibachi at home, hibachi at home Los Angeles, private hibachi chef, mobile hibachi catering, hibachi party Orange County, teppanyaki at home Southern California, Real Hibachi",
  robots: "index,follow",
  authors: [{ name: "Real Hibachi" }],
  alternates: {
    // Self-referencing canonical for every route (resolved against metadataBase)
    canonical: "./",
  },

  // Open Graph tags for social media
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://www.realhibachi.com",
    siteName: "Real Hibachi",
    title: "Real Hibachi | Private Hibachi Chef At Your Home in Southern California",
    description:
      "Book a professional hibachi chef at your home in Los Angeles, Orange County & all of SoCal. $59.90 per adult flat rate, authentic Japanese teppanyaki experience. Reserve now!",
    images: [
      {
        url: "https://www.realhibachi.com/images/hibachi-flame-og.png",
        width: 1200,
        height: 630,
        alt: "Real Hibachi - Authentic Hibachi Cooking with Amazing Flames",
      },
    ],
  },

  // Twitter Cards
  twitter: {
    card: "summary_large_image",
    site: "@realhibachi",
    creator: "@realhibachi",
    title: "Real Hibachi | Private Hibachi Chef At Your Home in SoCal",
    description:
      "Premium hibachi catering at your home across Los Angeles, Orange County & Southern California. Book now for an authentic Japanese experience!",
    images: ["https://www.realhibachi.com/images/hibachi-flame-og.png"],
  },

  // The 1024px logo PNG (1.2 MB) was the favicon and touch icon, so every
  // page load pulled it - the single heaviest asset on the ad landing pages
  // (Lighthouse 2026-09-10). These are the same mark at icon sizes.
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: { url: "/icons/apple-touch-icon.png", sizes: "180x180" },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID || DEFAULT_GTM_ID
  const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || DEFAULT_GOOGLE_ADS_ID

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&family=Permanent+Marker&display=swap"
          rel="stylesheet"
        />
        {/* No tag manager on the /admin workbench: the owner's own sessions
            were landing in Clarity (26-minute recordings, LCP 6.8 s) and in
            GA4/Ads as visitors, skewing every customer metric. HideOnAdmin
            reads the pathname during SSR too, so the scripts never ship. */}
        <HideOnAdmin>
        {gtmId ? (
          <Script id="gtm-base" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`}
          </Script>
        ) : null}
        {googleAdsId ? (
          <>
            {/* The AW library itself is loaded by GTM's Google tag (googtag
                AW-17018331447). This only installs the gtag() queue shim so
                lib/tracking.ts can push conversion + user_data commands; loading
                gtag/js here as well was a duplicate ~350ms of JS bootup and two
                long tasks on every page (Clarity INP 0.9–2.1s, 2026-09-08). */}
            <Script id="aw-gtag-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
window.gtag=window.gtag||gtag;
gtag('js',new Date());
gtag('config','${googleAdsId}',{allow_enhanced_conversions:true});`}
            </Script>
          </>
        ) : null}
        </HideOnAdmin>
        <JsonLd data={[localBusinessJsonLd, webSiteJsonLd]} />
      </head>
      <body className="font-sans">
        <HideOnAdmin>
        {gtmId ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            ></iframe>
          </noscript>
        ) : null}
        </HideOnAdmin>
        {/* Keep client-only trackers inside their own Suspense boundary so a
            useSearchParams() bailout never swallows the page content below. */}
        <Suspense fallback={null}>
          <HideOnAdmin>
            <TrackingBootstrap />
          </HideOnAdmin>
        </Suspense>
        <HideOnAdmin>
          <LanguageSuggestBanner />
          <Header />
        </HideOnAdmin>
        <main>{children}</main>
        <HideOnAdmin>
          <Footer />
        </HideOnAdmin>
        <HideOnAdmin>
          <Analytics />
        </HideOnAdmin>
      </body>
    </html>
  )
}
