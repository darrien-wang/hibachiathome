import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { faqItemsEs } from "@/config/faq-es"
import { JsonLd } from "@/components/structured-data"

export const metadata: Metadata = {
  title: "Preguntas Frecuentes | Hibachi a Domicilio | Real Hibachi",
  description:
    "Respuestas en español sobre nuestro servicio de hibachi a domicilio en Los Ángeles y el sur de California: precios, montaje, reservaciones, alergias y política de cancelación.",
  alternates: {
    canonical: "https://www.realhibachi.com/es/preguntas-frecuentes",
    languages: {
      en: "https://www.realhibachi.com/faq",
      es: "https://www.realhibachi.com/es/preguntas-frecuentes",
    },
  },
  openGraph: {
    title: "Preguntas Frecuentes | Real Hibachi",
    description: "Todo sobre el hibachi a domicilio, en español.",
    url: "https://www.realhibachi.com/es/preguntas-frecuentes",
    siteName: "Real Hibachi",
    type: "website",
  },
}

const faqJsonLdEs = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  inLanguage: "es",
  mainEntity: faqItemsEs.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
}

export default function PreguntasFrecuentesPage() {
  return (
    <div className="bg-gradient-to-r from-orange-50 to-amber-50 min-h-screen">
      <JsonLd data={faqJsonLdEs} />
      {/* pt clears the fixed header's overhanging round logo */}
      <div className="container mx-auto px-4 pt-32 md:pt-40 pb-14 max-w-3xl">
        <h1 className="text-3xl md:text-5xl font-serif font-bold text-center text-gray-900 mb-3">
          Preguntas Frecuentes
        </h1>
        <p className="text-center text-gray-600 mb-10">
          Todo lo que necesitas saber sobre tu fiesta hibachi ·{" "}
          <Link href="/faq" className="underline underline-offset-4 hover:text-gray-900">
            View in English
          </Link>
        </p>

        <div className="space-y-4">
          {faqItemsEs.map((faq) => (
            <details key={faq.question} className="group bg-white rounded-lg shadow-md overflow-hidden">
              <summary className="cursor-pointer list-none p-6 flex justify-between items-center hover:bg-amber-50 transition-colors">
                <h2 className="font-bold text-lg text-amber-600 pr-4">{faq.question}</h2>
                <span className="text-amber-600 text-xl transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="px-6 pb-6">
                <p className="text-gray-600 whitespace-pre-line">{faq.answer}</p>
              </div>
            </details>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Button asChild className="rounded-full bg-[hsl(24_79%_55%)] hover:bg-[hsl(24_79%_48%)] text-white px-8 h-12 text-base font-semibold">
            <Link href="/es/cotizar">Cotiza tu fiesta</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
