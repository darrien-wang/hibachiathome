import type React from "react"
import type { Metadata } from "next"
import { Playfair_Display, Montserrat, Poppins, Dancing_Script } from "next/font/google"
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

const dancingScript = Dancing_Script({
  subsets: ["latin"],
  variable: "--font-dancing-script",
})

export const metadata: Metadata = {
  title: {
    default: "Real Hibachi | Private Chef & Hibachi At Home Los Angeles",
    template: "%s - Real Hibachi LA",
  },
  description:
    "Book a professional hibachi chef at your home in Los Angeles & Orange County. Flat-rate $59.9 per person, authentic Japanese teppanyaki experience. Reserve now!",
  keywords: "Hibachi at home Los Angeles, private chef LA, hibachi catering Los Angeles, teppanyaki Orange County, Hibachi Chef Los Angeles, hibachi party catering LA, Real Hibachi",
  robots: "index,follow",
  authors: [{ name: "Real Hibachi" }],
  alternates: {
    canonical: "https://www.realhibachi.com",
  },
  
  // Open Graph tags for social media
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://www.realhibachi.com',
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
    title: 'Real Hibachi | Professional Hibachi Chef At Your Home in Los Angeles',
    description: 'Book a professional hibachi chef at your home in Los Angeles & Orange County. Flat-rate $59.9 per person, authentic Japanese teppanyaki experience. Reserve now!',
    images: ['https://realhibachi.com/images/hibachi-flame-og.png'],
  },
  
  // Additional meta tags
  category: 'Food & Catering',
  classification: 'Business',
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
  },
}

// Structured Data for SEO
const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Real Hibachi',
  description: 'Professional hibachi chef and teppanyaki catering service in Los Angeles, Orange County, and Southern California. Authentic Japanese cuisine at your home.',
  url: 'https://realhibachi.com',
  telephone: '+1-213-770-7788',
  email: 'realhibachiathome@gmail.com',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Los Angeles',
    addressRegion: 'CA',
    addressCountry: 'US'
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 34.0522,
    longitude: -118.2437
  },
  areaServed: [
    {
      '@type': 'City',
      name: 'Los Angeles',
      addressRegion: 'CA'
    },
    {
      '@type': 'City', 
      name: 'Orange County',
      addressRegion: 'CA'
    },
    {
      '@type': 'City',
      name: 'San Diego',
      addressRegion: 'CA'
    },
    {
      '@type': 'City',
      name: 'San Bernardino',
      addressRegion: 'CA'
    }
  ],
  serviceType: 'Hibachi Catering',
  priceRange: '$59.9 per person',
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.9',
    reviewCount: '500'
  },
  openingHours: 'Mo-Su 00:00-23:59',
  sameAs: [
    'https://www.instagram.com/realhibachi',
    'https://www.facebook.com/realhibachi'
  ]
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${poppins.variable} ${playfair.variable} ${montserrat.variable} ${dancingScript.variable}`}>
      <head>
        {/* Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className={`${poppins.className} antialiased bg-white text-gray-900 relative`}>
        <Suspense fallback={null}>
          <Header />
        </Suspense>

        <main className="relative">
          {children}
        </main>

        <Suspense fallback={null}>
          <Footer />
        </Suspense>

        <Suspense fallback={null}>
          <FloatingContactButtons />
        </Suspense>

        {/* Analytics */}
        <Analytics />

        {/* Google Maps Script */}
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
          strategy="lazyOnload"
        />

        {/* 在生产环境中取消注释下面这行 */}
        {/* <Script id="google-analytics" strategy="lazyOnload" src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX" /> */}
      </body>
    </html>
  )
}