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
    "Enjoy a professional hibachi chef experience in the comfort of your own home or venue with Real Hibachi. Serving delicious food and unforgettable entertainment.",
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
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-5QDRG6LHBN" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-5QDRG6LHBN');
        `}
        </Script>
        <Script id="google-tag-manager" strategy="afterInteractive">
          {`
  (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','GTM-WQZNBK82');
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
