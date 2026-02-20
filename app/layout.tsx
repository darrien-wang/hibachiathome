import type React from "react"
import type { Metadata } from "next"
import Script from "next/script"
import "./globals.css"
import { Header } from "@/components/header"
import Footer from "@/components/footer"
import { Analytics } from "@vercel/analytics/react"
import { Suspense } from "react"
import { FloatingContactButtons } from "@/components/floating-contact-buttons"
import { TrackingBootstrap } from "@/components/tracking-bootstrap"
import { SocialProofToast } from "@/components/social-proof-toast"

export const metadata: Metadata = {
  title: {
    default: "Real Hibachi | Private Chef & Hibachi At Home Los Angeles",
    template: "%s - Real Hibachi LA",
  },
  description:
    "Book a professional hibachi chef at your home in Los Angeles & Orange County. Flat-rate $59.9 per person, authentic Japanese teppanyaki experience. Reserve now!",
  keywords: "Hibachi at home Los Angeles, private chef LA, hibachi catering Los Angeles, teppanyaki Orange County, Japanese chef Los Angeles, hibachi party catering LA, Real Hibachi",
  robots: "index,follow",
  authors: [{ name: "Real Hibachi" }],
  
  // Open Graph tags for social media
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://realhibachi.com',
    siteName: 'Real Hibachi',
    title: 'Real Hibachi | Professional Hibachi Chef At Your Home in Los Angeles',
    description: 'Book a professional hibachi chef at your home in Los Angeles & Orange County. Flat-rate $59.9 per person, authentic Japanese teppanyaki experience. Reserve now!',
    images: [
      {
        url: 'https://realhibachi.com/images/hibachi-flame-og.png', // 请将图片上传到这个路径
        width: 1200,
        height: 630,
        alt: 'Real Hibachi - Authentic Hibachi Cooking with Amazing Flames',
      },
    ],
  },
  
  // Twitter Cards
  twitter: {
    card: 'summary_large_image',
    site: '@realhibachi',
    creator: '@realhibachi',
    title: 'Real Hibachi | Professional Hibachi Chef At Your Home in LA',
    description: 'Premium hibachi catering service in Los Angeles and Orange County. Book now for an authentic Japanese experience!',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
  
  icons: {
    icon: [
      {
        url: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/logo/realhibachiathome-Gn1I9pZdsKZZZyYtU2kuyfGH4XaAdN.png",
      },
    ],
    apple: {
      url: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/logo/realhibachiathome-Gn1I9pZdsKZZZyYtU2kuyfGH4XaAdN.png",
    },
  },
  generator: "v0.dev",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID

  return (
    <html lang="en">
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
          href="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/logo/realhibachiathome-Gn1I9pZdsKZZZyYtU2kuyfGH4XaAdN.png"
          type="image/png"
        />
        <link
          rel="apple-touch-icon"
          href="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/logo/realhibachiathome-Gn1I9pZdsKZZZyYtU2kuyfGH4XaAdN.png"
        />
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
        <TrackingBootstrap />
        <Suspense>
          <Header />
          <main className="pb-16 md:pb-0">{children}</main>
          <Footer />
          <SocialProofToast />
          <FloatingContactButtons />
          <Analytics />
          {/* 在生产环境中取消注释下面这行 */}
          {/* <SpeedInsights /> */}
        </Suspense>
      </body>
    </html>
  )
}
