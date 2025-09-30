import type React from "react"
import type { Metadata } from "next"
import { Playfair_Display, Montserrat, Poppins } from "next/font/google"
import Script from "next/script"
import "./globals.css"
import { Header } from "@/components/header"
import Footer from "@/components/footer"
import { Analytics } from "@vercel/analytics/react"
import { Suspense } from "react"
import { FloatingContactButtons } from "@/components/floating-contact-buttons"

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-sans",
})

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
})

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
})

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
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Permanent+Marker&display=swap" rel="stylesheet" />
        <script async src="https://www.googletagmanager.com/gtag/js?id=AW-17018331447"></script>

        <Script id="google-analytics" strategy="afterInteractive">
          {`
     window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'AW-17018331447');
        `}
        </Script>
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
      <body className={`${poppins.variable} ${playfair.variable} ${montserrat.variable} font-sans`}>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-WQZNBK82"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          ></iframe>
        </noscript>
        <Suspense>
          <Header />
          <main>{children}</main>
          <Footer />
          <FloatingContactButtons />
          <Analytics />
          {/* 在生产环境中取消注释下面这行 */}
          {/* <SpeedInsights /> */}
        </Suspense>
      </body>
    </html>
  )
}
