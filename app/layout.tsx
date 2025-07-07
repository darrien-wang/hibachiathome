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
    default: "Real Hibachi | Private Chef & Hibachi At Home Experience",
    template: "%s - Real Hibachi",
  },
  description:
    "Book a live-show hibachi chef at your home. Flat-rate $49.9 pp, tables & utensils optional. Reserve now for an unforgettable night!",
  keywords: "Hibachi at home, private chef, hibachi catering, teppanyaki, party catering, Real Hibachi",
  robots: "index,follow",
  authors: [{ name: "Real Hibachi" }],
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
