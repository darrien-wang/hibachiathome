"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowRight, Check, MessageSquare, Sparkles, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AnimateOnScroll } from "@/components/animate-on-scroll"
import InstagramVideosSection from "@/components/instagram-videos-section"
import PartyPlannerSectionEs from "@/components/es/party-planner-section-es"
import LazyVideo from "@/components/lazy-video"
import { trackEvent } from "@/lib/tracking"
import { faqItemsEs } from "@/config/faq-es"
import { phone, smsHref } from "@/config/site"

// Spanish homepage — additive surface: mirrors the key EN sections with
// native Mexican-Spanish copy. Conversion CTAs route Spanish speakers to
// channels the team answers in Spanish (WhatsApp/SMS) plus the EN quote tool.
const WHATSAPP_URL =
  "https://wa.me/1" + phone.sms.raw + "?text=" +
  encodeURIComponent("¡Hola! Quiero cotizar una fiesta hibachi a domicilio 🎉")
const SMS_URL = smsHref("Hola, quiero cotizar una fiesta hibachi (español)")

const TRUST_MARKERS = ["Reserva y modifica en línea 24/7", "Más de 500 fiestas servidas", "Depósito reembolsable hasta 72h antes"]

const standardFeatures = [
  "$29.90 por niño (5–12), $5 menores de 5",
  "Consumo mínimo de $599 por evento",
  "2 proteínas regulares por invitado incluidas",
  "Arroz frito, verduras frescas y ensalada incluidos",
  "Show del chef en vivo y cocina en tu casa",
  "Montaje completo opcional: +$15 por invitado",
  "Mejoras de proteínas premium disponibles",
]

// Verbatim 5-star Google reviews (real hosts, in English) — do not translate
// quotes; translating would put words in the reviewers' mouths.
const realReviews = [
  {
    name: "Lisa Craven",
    text: "Chef blue was absolutely amazing!!! Super friendly and personable. So fun and interactive. Knew how to switch it up between adults and kids. Food was delicious and he was great! Highly recommend !",
  },
  {
    name: "Judy Gothelf",
    text: "What a great experience having Blue as our chef! Aside from the fact that he made delicious food, he was so much fun and so engaging! We loved having him here to celebrate our friend's BIG birthday!",
  },
  {
    name: "Max Schwenk",
    text: "Unbelievable experience! Bling was the best chef ever!",
  },
]

export default function HomeEs() {
  const [isMobile, setIsMobile] = useState(false)
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null)
  const faqPreview = [faqItemsEs[0], faqItemsEs[1], faqItemsEs[3], faqItemsEs[12] ?? faqItemsEs[faqItemsEs.length - 1]]

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const heroCta = () => trackEvent("lead_start", { contact_surface: "hero_primary_cta", locale: "es" })
  const whatsappCta = () => trackEvent("contact_whatsapp_click", { locale: "es" })
  const smsCta = () => trackEvent("contact_sms_click", { locale: "es" })

  return (
    <div>
      {/* ES banner back to English */}
      <div className="bg-stone-100 border-b border-stone-200 text-center text-sm py-2 px-4 text-stone-600">
        Estás viendo la versión en español ·{" "}
        <Link href="/" className="underline font-medium hover:text-stone-900">
          View in English
        </Link>
      </div>

      {/* Hero */}
      <section className="relative h-screen min-h-[600px] flex items-center justify-center">
        {isMobile ? (
          <div className="absolute inset-0 overflow-hidden bg-black z-0">
            <video className="w-full h-full object-cover" autoPlay muted loop playsInline poster="/images/hibachi-dinner-party.jpg">
              <source src="/videos/hero-loop.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-black/30"></div>
          </div>
        ) : (
          <div className="absolute inset-0 overflow-hidden bg-black z-0">
            <img
              src="/images/hibachi-dinner-party.jpg"
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover blur-lg scale-110"
            />
            <div className="absolute inset-0 bg-black/50"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative h-full max-w-[500px] w-full max-h-[90vh] aspect-[9/16] bg-black rounded-lg overflow-hidden shadow-2xl">
                <video className="w-full h-full object-cover" autoPlay muted loop playsInline poster="/images/hibachi-dinner-party.jpg">
                  <source src="/videos/hero-loop.mp4" type="video/mp4" />
                </video>
                <div className="absolute inset-0 border border-white/10 rounded-lg pointer-events-none"></div>
              </div>
            </div>
          </div>
        )}

        <div className="container mx-auto px-4 relative z-30 text-center text-white h-full flex flex-col justify-start py-16">
          <div
            className="relative max-w-3xl mx-auto"
            style={{ marginTop: isMobile ? "calc(24vh - 80px)" : "calc(14vh - 40px)", fontFamily: "var(--font-montserrat)" }}
          >
            <p className="text-base md:text-lg font-semibold tracking-wide text-amber-200 drop-shadow">Hibachi Privado a Domicilio</p>
            <h1 className="mt-2 text-4xl md:text-6xl font-extrabold leading-[1.02] tracking-tight text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.55)]">
              Hibachi en Casa,
              <br />
              Sin Complicaciones
            </h1>
            <p className="mt-4 text-xl md:text-3xl font-bold text-white drop-shadow-[0_3px_10px_rgba(0,0,0,0.5)]">
              Planea la fiesta en 3 minutos — pasa la noche con los tuyos.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-4">
              <Button
                asChild
                onClick={heroCta}
                className="bg-white text-black hover:bg-white/90 min-w-[240px] rounded-full h-14 text-lg font-extrabold tracking-wide"
              >
                <Link href="/es/cotizar">Cotiza al Instante</Link>
              </Button>
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13px] font-medium text-white/85 drop-shadow">
                {TRUST_MARKERS.map((item, i) => (
                  <span key={item} className="flex items-center gap-3">
                    {i > 0 && <span className="text-white/40">·</span>}
                    {item}
                  </span>
                ))}
              </div>
              <Link href="/menu" className="text-white/85 text-sm underline underline-offset-4 hover:text-white">
                Ver Menú
              </Link>
            </div>
          </div>
          <div className="mt-auto mb-12 md:mb-20 relative"></div>
        </div>
      </section>

      {/* Pricing */}
      <AnimateOnScroll>
        <section id="precios" className="py-16 bg-[#f7f4ec]">
          <div className="container mx-auto px-4">
            <AnimateOnScroll direction="down">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-center mb-3 text-[hsl(24_79%_55%)]">Precios</h2>
              <p className="text-3xl md:text-5xl font-serif font-bold text-center text-gray-900 max-w-4xl mx-auto leading-tight mb-5">
                Elige el plan para tu fiesta
              </p>
              <p className="text-base md:text-lg text-center text-gray-600 max-w-3xl mx-auto mb-12">
                Precios publicados, sin sorpresas. Reserva en línea cuando tu evento cumpla las reglas, o
                escríbenos para un plan a la medida — te atendemos en español.
              </p>
            </AnimateOnScroll>

            <div className="grid gap-6 lg:grid-cols-3 max-w-6xl mx-auto">
              <AnimateOnScroll direction="up" delay={60}>
                <div className="rounded-3xl bg-emerald-50 border border-emerald-200 p-8 md:p-10 text-stone-700 shadow-[0_12px_28px_rgba(5,150,105,0.15)]">
                  <p className="text-lg font-semibold text-emerald-900">Especial Entre Semana</p>
                  <div className="mt-5 flex items-baseline gap-2">
                    <p className="text-5xl font-black text-emerald-950">$45.9</p>
                    <p className="text-lg font-medium text-emerald-800">/adulto</p>
                  </div>
                  <p className="mt-3 text-base text-emerald-900">
                    Domingo a jueves, con menú simplificado — la misma experiencia, mejor precio.
                  </p>
                  <Button
                    asChild
                    className="mt-7 h-12 w-full rounded-full bg-emerald-600 text-white hover:bg-emerald-700 text-base font-semibold shadow-md"
                  >
                    <Link href="/es/cotizar">
                      Ver el especial
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </AnimateOnScroll>

              <AnimateOnScroll direction="up">
                <div className="relative rounded-3xl bg-[#fffdf8] border border-[#e7dbc6] p-8 md:p-10 text-stone-700 shadow-[0_12px_30px_rgba(120,80,20,0.12)]">
                  <div className="absolute -top-4 left-8 inline-flex items-center gap-1 rounded-full bg-[hsl(24_79%_55%)] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-md">
                    <Sparkles className="h-3.5 w-3.5" />
                    El más popular
                  </div>
                  <p className="mt-4 text-lg font-semibold text-gray-800">Plan Estándar</p>
                  <div className="mt-5 flex items-baseline gap-2">
                    <p className="text-5xl font-black text-gray-900">$59.90</p>
                    <p className="text-lg font-medium text-gray-500">/adulto</p>
                  </div>
                  <p className="mt-3 text-base text-gray-600">Ideal para cumpleaños, fiestas familiares y eventos en el patio.</p>
                  <Button asChild className="mt-7 h-12 w-full rounded-full bg-[hsl(24_79%_55%)] text-white hover:bg-[hsl(24_79%_48%)] text-base font-semibold shadow-md">
                    <Link href="/es/cotizar">
                      Cotiza al Instante
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <div className="mt-7 space-y-3 border-t border-[#eadfcf] pt-7">
                    {standardFeatures.map((item) => (
                      <div key={item} className="flex items-start gap-3 text-[15px] leading-relaxed text-gray-700">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(24_79%_42%)]" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </AnimateOnScroll>

              <AnimateOnScroll direction="up" delay={180}>
                <div className="rounded-3xl bg-[#fcfcfc] border border-[#dfe2e8] p-8 md:p-10 text-stone-700 shadow-[0_10px_24px_rgba(31,41,55,0.08)]">
                  <p className="text-lg font-semibold text-gray-800">Plan Personalizado</p>
                  <h3 className="mt-5 text-4xl font-black tracking-tight text-gray-900">Hablemos</h3>
                  <p className="mt-3 text-base text-gray-600">
                    Para grupos grandes, menús especiales o logística a la medida de tu evento.
                  </p>
                  <Button asChild className="mt-7 h-12 w-full rounded-full bg-[#1f2a44] text-white hover:bg-[#111a2f] text-base font-semibold shadow-md">
                    <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" onClick={whatsappCta}>
                      Escríbenos por WhatsApp
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </AnimateOnScroll>
            </div>
          </div>
        </section>
      </AnimateOnScroll>

      {/* Party planner story (Spanish dub) */}
      <PartyPlannerSectionEs />

      {/* Food videos */}
      <AnimateOnScroll>
        <section className="py-16 bg-gradient-to-r from-orange-50 to-amber-50">
          <div className="container mx-auto px-4">
            <AnimateOnScroll direction="down">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-center mb-4">
                Recién Salido <span className="text-primary">de la Plancha</span>
              </h2>
              <p className="text-lg text-center text-gray-600 max-w-3xl mx-auto mb-10">
                Arroz frito con mantequilla de ajo, camarones jumbo y bistec al término que pidas — todo en
                vivo, en tu mesa.
              </p>
            </AnimateOnScroll>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {[
                { title: "Arroz frito con mantequilla de ajo", poster: "/videos/posters/fried-rice.jpg", src: "/videos/fried-rice.mp4" },
                { title: "Camarones jumbo a la plancha", poster: "/videos/posters/hibachi-show.jpg", src: "/videos/hibachi-show.mp4" },
                { title: "Bistec al término que pidas", poster: "/videos/posters/party-highlight.jpg", src: "/videos/party-highlight.mp4" },
              ].map((dish, i) => (
                <AnimateOnScroll key={dish.src} direction="up" delay={i * 100}>
                  <div className="rounded-xl overflow-hidden shadow-xl bg-white">
                    <div className="relative pb-[56.25%] h-0">
                      <LazyVideo className="absolute top-0 left-0 w-full h-full object-cover" controls poster={dish.poster} src={dish.src} />
                    </div>
                    <p className="px-4 py-3 text-center text-sm font-semibold text-gray-800">{dish.title}</p>
                  </div>
                </AnimateOnScroll>
              ))}
            </div>
          </div>
        </section>
      </AnimateOnScroll>

      {/* Instagram strip (shared component, ES copy via props) */}
      <InstagramVideosSection
        title="Fiestas reales, momentos reales"
        subtitle="Mira nuestras experiencias hibachi recientes por todo Los Ángeles"
      />

      {/* FAQ preview */}
      <AnimateOnScroll>
        <section className="py-16 bg-gradient-to-r from-orange-50 to-amber-50">
          <div className="container mx-auto px-4">
            <AnimateOnScroll direction="down">
              <h3 className="text-2xl md:text-3xl font-serif font-bold text-center mb-8">Preguntas Frecuentes</h3>
            </AnimateOnScroll>

            <div className="space-y-4 max-w-3xl mx-auto">
              {faqPreview.map((faq, index) => (
                <div key={faq.question} className="bg-white rounded-lg shadow-md overflow-hidden">
                  <button
                    className="w-full p-6 text-left flex justify-between items-center hover:bg-amber-50 transition-colors"
                    onClick={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
                  >
                    <h4 className="font-bold text-lg text-amber-600 pr-4">{faq.question}</h4>
                    <span className={`text-amber-600 text-xl transition-transform ${expandedFAQ === index ? "rotate-180" : ""}`}>▼</span>
                  </button>
                  {expandedFAQ === index && (
                    <div className="px-6 pb-6">
                      <p className="text-gray-600 whitespace-pre-line">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <AnimateOnScroll direction="up" delay={200}>
              <div className="mt-8 text-center">
                <Button asChild variant="outline" className="rounded-full border-2 border-amber-500 text-amber-600 hover:bg-amber-50">
                  <Link href="/es/preguntas-frecuentes">Ver todas las preguntas</Link>
                </Button>
              </div>
            </AnimateOnScroll>
          </div>
        </section>
      </AnimateOnScroll>

      {/* Real reviews (verbatim, in English) */}
      <AnimateOnScroll>
        <section className="py-12 bg-white border-y border-amber-100">
          <div className="container mx-auto px-4">
            <div className="text-center mb-8">
              <h3 className="text-2xl md:text-3xl font-serif font-bold text-gray-900">Reseñas reales</h3>
              <p className="mt-2 text-sm text-gray-600">Reseñas de Google de anfitriones reales, citadas textualmente (en inglés)</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {realReviews.map((review) => (
                <div key={review.name} className="bg-[#fffdf8] border border-amber-100 rounded-lg shadow-md p-6">
                  <div className="flex mb-3">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-gray-700 text-sm italic">"{review.text}"</p>
                  <p className="mt-4 font-semibold text-gray-900">{review.name}</p>
                  <p className="text-xs text-gray-500">Reseña de Google</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </AnimateOnScroll>

      {/* Final CTA */}
      <AnimateOnScroll>
        <section className="py-20 bg-gradient-to-r from-amber-600 to-orange-600">
          <div className="container mx-auto px-4 text-center">
            <AnimateOnScroll direction="down">
              <h2 className="text-3xl md:text-5xl font-serif font-bold text-white mb-6">¿Listos para encender la fiesta?</h2>
              <p className="text-xl text-amber-100 max-w-3xl mx-auto mb-10">
                Nuestro equipo te atiende en español por WhatsApp o mensaje de texto — o cotiza en línea en 3
                minutos.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button asChild className="bg-white text-amber-700 hover:bg-amber-50 min-w-[190px]" onClick={whatsappCta}>
                  <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    WhatsApp
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="min-w-[190px] border-white text-white bg-transparent hover:bg-white/10 hover:text-white"
                  onClick={smsCta}
                >
                  <a href={SMS_URL}>Mensaje de texto</a>
                </Button>
                <Button asChild variant="outline" className="min-w-[190px] border-white text-white bg-transparent hover:bg-white/10 hover:text-white">
                  <Link href="/es/cotizar">Cotizar en línea</Link>
                </Button>
              </div>
            </AnimateOnScroll>
          </div>
        </section>
      </AnimateOnScroll>
    </div>
  )
}
