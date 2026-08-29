import type React from "react"
import type { Metadata } from "next"
import Script from "next/script"
import "./globals.css"
import { Header } from "@/components/header"
import Footer from "@/components/footer"
import { Analytics } from "@vercel/analytics/react"
import { Suspense } from "react"
import { TrackingBootstrap } from "@/components/tracking-bootstrap"
import { SocialProofToast } from "@/components/social-proof-toast"
import { LiveChatLoader } from "@/components/live-chat-loader"
import { HideOnAdmin } from "@/components/hide-on-admin"
import { JsonLd, localBusinessJsonLd, webSiteJsonLd } from "@/components/structured-data"

const DEFAULT_GTM_ID = "GTM-WQZNBK82"

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

  icons: {
    icon: [
      {
        url: "https://www.realhibachi.com/images/logo-realhibachi.png",
      },
    ],
    apple: {
      url: "https://www.realhibachi.com/images/logo-realhibachi.png",
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID || DEFAULT_GTM_ID

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Permanent+Marker&display=swap" rel="stylesheet" />
        {gtmId ? (
          <Script id="gtm-base" strategy="beforeInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`}
          </Script>
        ) : null}
        <link
          rel="icon"
          href="https://www.realhibachi.com/images/logo-realhibachi.png"
          type="image/png"
        />
        <link
          rel="apple-touch-icon"
          href="https://www.realhibachi.com/images/logo-realhibachi.png"
        />
        <JsonLd data={[localBusinessJsonLd, webSiteJsonLd]} />
      </head>
      <body className="font-sans">
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
        {/* Keep client-only trackers inside their own Suspense boundary so a
            useSearchParams() bailout never swallows the page content below. */}
        <Suspense fallback={null}>
          <HideOnAdmin>
            <TrackingBootstrap />
            <LiveChatLoader />
          </HideOnAdmin>
        </Suspense>
        <HideOnAdmin>
          <Header />
        </HideOnAdmin>
        <main>{children}</main>
        <HideOnAdmin>
          <Footer />
        </HideOnAdmin>
        <Suspense fallback={null}>
          <HideOnAdmin>
            <SocialProofToast />
          </HideOnAdmin>
        </Suspense>
        <Analytics />
      </body>
    </html>
  )
}
