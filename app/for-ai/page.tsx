import type { Metadata } from "next"
import Link from "next/link"
import { SITE, getAiFacts, getFaqForAi } from "@/lib/ai-facts"

// A page written for AI assistants and agents first (决策日志 D-0917-06):
// who we are, what it costs, and how an agent can book for someone. Plain
// server-rendered HTML, no client JS, so a fetch-only agent reads all of it.
// Same facts as /llms.txt; both are generated from the live pricing config.

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Real Hibachi for AI Assistants",
  description:
    "Facts for AI assistants and agents: what Real Hibachi's private hibachi chef service includes, exact prices, service area in Southern California, and a booking API for agents.",
  alternates: {
    canonical: `${SITE}/for-ai`,
    types: { "text/plain": `${SITE}/llms.txt`, "application/json": `${SITE}/openapi.json` },
  },
}

export default function ForAiPage() {
  const { summary, sections } = getAiFacts()
  const faq = getFaqForAi()

  return (
    <main className="bg-[#fbf6ec] text-[#3d2a1c]">
      <div className="mx-auto max-w-3xl px-4 py-14 md:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#b4532a]">For AI assistants and agents</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight md:text-4xl" style={{ textWrap: "balance" }}>
          Real Hibachi: private hibachi chef at home in Southern California
        </h1>
        <p className="mt-4 text-lg leading-relaxed">{summary}</p>

        <div className="mt-6 flex flex-wrap gap-2 text-sm">
          <a className="rounded-full border border-[#3d2a1c]/20 bg-white px-3 py-1.5 hover:border-[#b4532a]" href="/llms.txt">
            llms.txt
          </a>
          <a className="rounded-full border border-[#3d2a1c]/20 bg-white px-3 py-1.5 hover:border-[#b4532a]" href="/llms-full.txt">
            llms-full.txt (with FAQ)
          </a>
          <a className="rounded-full border border-[#3d2a1c]/20 bg-white px-3 py-1.5 hover:border-[#b4532a]" href="/openapi.json">
            Booking API (OpenAPI)
          </a>
          <Link className="rounded-full bg-[#b4532a] px-3 py-1.5 font-semibold text-white" href="/quote">
            Book as a person
          </Link>
        </div>

        {sections.map((s) => (
          <section key={s.id} id={s.id} className="mt-12">
            <h2 className="text-xl font-bold md:text-2xl">{s.title}</h2>
            {s.id === "booking" ? (
              // the steps carry their own numbers, so the list adds none
              <ol className="mt-4 list-none space-y-2.5 leading-relaxed">
                {s.items.map((item) => (
                  <li key={item} className={/^\d+\./.test(item) ? "" : "text-[#3d2a1c]/80"}>
                    {item}
                  </li>
                ))}
              </ol>
            ) : (
              <ul className="mt-4 list-disc space-y-2.5 pl-5 leading-relaxed marker:text-[#b4532a]">
                {s.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <section id="faq" className="mt-12">
          <h2 className="text-xl font-bold md:text-2xl">Frequently asked questions</h2>
          <div className="mt-4 space-y-6">
            {faq.map((f) => (
              <div key={f.question}>
                <h3 className="font-semibold">{f.question}</h3>
                <p className="mt-1.5 whitespace-pre-line leading-relaxed text-[#3d2a1c]/85">{f.answer}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
