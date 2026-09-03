import type { Metadata } from "next"
import type React from "react"

// Base metadata for the Spanish surface. /es child pages that are server
// components (faq, quote) override these fields with their own exports.
export const metadata: Metadata = {
  title: "Hibachi a Domicilio en Los Ángeles y el Sur de California | Real Hibachi",
  description:
    "Chef privado de hibachi en tu casa: show en vivo, comida deliciosa y reservación en línea en 3 minutos. Servimos Los Ángeles, Orange County y todo el sur de California. Hablamos español.",
  alternates: {
    canonical: "https://www.realhibachi.com/es",
    languages: {
      en: "https://www.realhibachi.com/",
      es: "https://www.realhibachi.com/es",
    },
  },
  openGraph: {
    title: "Hibachi a Domicilio | Real Hibachi",
    description: "Planea tu fiesta hibachi en 3 minutos — el equipo te atiende en español.",
    url: "https://www.realhibachi.com/es",
    siteName: "Real Hibachi",
    type: "website",
  },
}

export default function EsLayout({ children }: { children: React.ReactNode }) {
  // The root <html> stays lang="en"; this wrapper marks the Spanish subtree
  // for assistive tech and crawlers without touching the global layout.
  return <div lang="es">{children}</div>
}
