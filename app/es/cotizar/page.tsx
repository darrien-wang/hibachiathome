import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, MessageSquare, Phone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { phone } from "@/config/site"

// Spanish quote landing. The interactive quote builder itself is English-only
// for now, so this page states the published pricing plainly and routes
// Spanish speakers to the channels the team answers in Spanish. Mirrors
// /quote's robots policy (noindex, follow).
export const metadata: Metadata = {
  title: "Cotiza tu Fiesta Hibachi | Real Hibachi",
  description:
    "Precios publicados de hibachi a domicilio: $59.90 por adulto, niños a mitad de precio. Cotiza por WhatsApp o mensaje — te atendemos en español.",
  robots: { index: false, follow: true },
  alternates: { canonical: "https://www.realhibachi.com/es/cotizar" },
}

const WHATSAPP_URL =
  "https://wa.me/1" + phone.sms.raw + "?text=" +
  encodeURIComponent("¡Hola! Quiero cotizar una fiesta hibachi a domicilio 🎉 Somos ___ adultos y ___ niños, fecha: ___")
const SMS_URL =
  "sms:" + phone.sms.e164 + "?body=" +
  encodeURIComponent("Hola, quiero cotizar una fiesta hibachi (español). Somos ___ adultos y ___ niños, fecha: ___")

const PRICE_ROWS = [
  ["Adultos (13+)", "$59.90 por persona"],
  ["Niños (5–12)", "$29.90 · mitad de precio"],
  ["Pequeños (3–4)", "$5"],
  ["Bebés (0–2)", "Gratis"],
  ["Consumo mínimo", "$599 por evento"],
  ["Especial entre semana (dom–jue)", "$45.9 por adulto"],
  ["Mesas, sillas y mantel", "+$10 por persona (opcional)"],
  ["Cubiertos y vajilla", "+$5 por persona (opcional)"],
  ["Depósito para apartar", "$19.90 — reembolsable hasta 72h antes"],
]

export default function CotizarPage() {
  return (
    <div className="bg-[#f7f4ec] min-h-screen">
      {/* pt clears the fixed header's overhanging round logo */}
      <div className="container mx-auto px-4 pt-32 md:pt-40 pb-14 max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[hsl(24_79%_55%)] mb-3 text-center">
          Precios publicados, sin sorpresas
        </p>
        <h1 className="text-3xl md:text-5xl font-serif font-bold text-center text-gray-900 mb-4">
          Cotiza tu fiesta hibachi
        </h1>
        <p className="text-center text-gray-600 mb-10">
          Cada adulto incluye 2 proteínas, arroz frito, verduras y ensalada — más el show del chef en tu
          casa. El equipo te atiende <b>en español</b>.
        </p>

        <div className="rounded-3xl bg-white border border-[#e7dbc6] shadow-[0_12px_30px_rgba(120,80,20,0.10)] overflow-hidden mb-10">
          {PRICE_ROWS.map(([label, value], i) => (
            <div
              key={label}
              className={`flex items-center justify-between gap-4 px-6 py-4 text-[15px] ${
                i % 2 ? "bg-[#fffdf8]" : "bg-white"
              }`}
            >
              <span className="text-gray-700">{label}</span>
              <span className="font-semibold text-gray-900 text-right">{value}</span>
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          <Button asChild className="h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-base font-semibold shadow-md">
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <MessageSquare className="mr-2 h-5 w-5" />
              Cotizar por WhatsApp
            </a>
          </Button>
          <Button asChild className="h-14 rounded-full bg-[hsl(24_79%_55%)] hover:bg-[hsl(24_79%_48%)] text-white text-base font-semibold shadow-md">
            <a href={SMS_URL}>
              <MessageSquare className="mr-2 h-5 w-5" />
              Cotizar por mensaje
            </a>
          </Button>
        </div>
        <div className="text-center text-sm text-gray-600 mb-10">
          <a href={phone.voice.tel} className="inline-flex items-center gap-1.5 underline underline-offset-4 hover:text-gray-900">
            <Phone className="h-4 w-4" /> O llámanos: {phone.voice.display}
          </a>
        </div>

        <div className="rounded-2xl bg-white border border-[#e7dbc6] p-6 text-center">
          <p className="text-gray-700 mb-4">
            ¿Prefieres armar tu cotización tú mismo? Nuestra calculadora en línea está en inglés y tarda unos
            3 minutos:
          </p>
          <Button asChild variant="outline" className="rounded-full border-2 border-amber-500 text-amber-600 hover:bg-amber-50">
            <Link href="/quote">
              Usar la cotización en línea (in English)
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
