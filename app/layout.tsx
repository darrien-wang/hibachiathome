import type React from "react"
import type { Metadata } from "next"
import { Playfair_Display, Montserrat, Poppins } from "next/font/google"
import Script from "next/script"
import "./globals.css"
import { Header } from "@/components/header"
import Footer from "@/components/footer"
import { Analytics } from "@vercel/analytics/react"
import { Suspense } from "react"

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
  title: "Hibachi at home in NY - Real Hibachi | Private Chef Experience",
  description:
    "Hibachi at home in NY - Enjoy a professional hibachi chef experience in the comfort of your own home or venue.",
  keywords: "Hibachi at home in NY,Real Hibachi",
  robots: "index,follow",
  authors: [{ name: "Real Hibachi" }],
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png" }],
    shortcut: ["/favicon.ico"],
  },
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-5QDRG6LHBN" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-5QDRG6LHBN');
          `}
        </Script>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className={`${poppins.variable} ${playfair.variable} ${montserrat.variable} font-sans`}>
        <Suspense>
          <Header />
          <main>{children}</main>
          <Footer />
          <Analytics />
        </Suspense>
      </body>
    </html>
  )
}
