"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { COPY, PHONE, SCRIPT_LINES, SMS_HREF, type JobsLocale } from "./copy"

const LOCALES: JobsLocale[] = ["zh", "en", "es"]

// Someone arriving from a Chinese forum post should not land on English, and
// someone from a Spanish-language group should not land on Chinese. ?lang wins
// (we can pin it per channel in the link we post); otherwise follow the browser.
function detectLocale(): JobsLocale {
  if (typeof window === "undefined") return "zh"

  const fromQuery = new URLSearchParams(window.location.search).get("lang")?.toLowerCase()
  if (fromQuery && LOCALES.includes(fromQuery as JobsLocale)) return fromQuery as JobsLocale

  const nav = (window.navigator.language || "").toLowerCase()
  if (nav.startsWith("zh")) return "zh"
  if (nav.startsWith("es")) return "es"
  return "en"
}

type Status = "idle" | "sending" | "done"

export default function JobsPageClient() {
  const [locale, setLocale] = useState<JobsLocale>("zh")
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [cityOrZip, setCityOrZip] = useState("")
  const [hasCar, setHasCar] = useState(true)
  const [vehicle, setVehicle] = useState("")
  const [days, setDays] = useState<string[]>(["sat"])
  const [experience, setExperience] = useState("")
  const [earliestStart, setEarliestStart] = useState("")
  const [acceptsTerms, setAcceptsTerms] = useState(false)

  useEffect(() => {
    setLocale(detectLocale())
  }, [])

  const t = useMemo(() => COPY[locale], [locale])

  function toggleDay(day: string) {
    setDays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day]))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!name.trim() || !phone.trim() || !cityOrZip.trim()) {
      setError(t.f.required)
      return
    }

    setStatus("sending")
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email,
          cityOrZip,
          hasCar,
          vehicle,
          availability: days,
          experience,
          earliestStart,
          acceptsTerms,
          locale,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        setError(payload?.error || t.errorGeneric)
        setStatus("idle")
        return
      }

      setStatus("done")
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch {
      setError(t.errorGeneric)
      setStatus("idle")
    }
  }

  const langSwitch = (
    <div className="flex gap-1" role="group" aria-label="Language">
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            locale === code
              ? "bg-orange-600 text-white"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          }`}
        >
          {COPY[code].langLabel}
        </button>
      ))}
    </div>
  )

  if (status === "done") {
    return (
      <main className="mx-auto max-w-2xl px-5 py-16">
        <div className="mb-8 flex justify-end">{langSwitch}</div>

        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">{t.doneTitle}</h1>
        <p className="mt-2 text-neutral-600">{t.doneLede}</p>

        <section className="mt-8 rounded-xl border-2 border-orange-200 bg-orange-50 p-6">
          <h2 className="text-lg font-bold text-neutral-900">{t.doneStepTitle}</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-700">{t.doneStep}</p>

          <ol className="mt-5 space-y-3">
            {SCRIPT_LINES.map((line, index) => (
              <li key={line} className="flex gap-3 rounded-lg bg-white p-3 shadow-sm">
                <span className="mt-0.5 text-xs font-semibold text-orange-600">{index + 1}</span>
                <span className="font-mono text-sm leading-relaxed text-neutral-800">{line}</span>
              </li>
            ))}
          </ol>

          <a
            href={SMS_HREF}
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-700"
          >
            {PHONE}
          </a>
          <p className="mt-3 text-xs text-neutral-500">{t.doneHint}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-orange-600">{t.eyebrow}</p>
        {langSwitch}
      </div>

      <h1 className="text-3xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-4xl">{t.h1}</h1>
      <p className="mt-4 leading-relaxed text-neutral-600">{t.lede}</p>

      <ul className="mt-8 space-y-4">
        {t.points.map((point) => (
          <li key={point.k} className="border-l-2 border-orange-500 pl-4">
            <p className="font-semibold text-neutral-900">{point.k}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-neutral-600">{point.v}</p>
          </li>
        ))}
      </ul>

      <section className="mt-8 rounded-xl bg-neutral-50 p-5">
        <h2 className="text-sm font-bold text-neutral-900">{t.upfrontTitle}</h2>
        <ol className="mt-3 space-y-2">
          {t.upfront.map((item, index) => (
            <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-neutral-700">
              <span className="font-mono text-xs text-neutral-400">{index + 1}</span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-bold text-neutral-900">{t.areaTitle}</h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">{t.area}</p>
      </section>

      <hr className="my-10 border-neutral-200" />

      <h2 className="text-2xl font-bold tracking-tight text-neutral-900">{t.formTitle}</h2>
      <p className="mt-1.5 text-sm text-neutral-600">{t.formLede}</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="job-name">{t.f.name}</Label>
            <Input id="job-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" required />
          </div>
          <div>
            <Label htmlFor="job-phone">{t.f.phone}</Label>
            <Input
              id="job-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1.5"
              required
            />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="job-city">{t.f.city}</Label>
            <Input
              id="job-city"
              value={cityOrZip}
              onChange={(e) => setCityOrZip(e.target.value)}
              className="mt-1.5"
              required
            />
            <p className="mt-1 text-xs text-neutral-500">{t.f.cityHint}</p>
          </div>
          <div>
            <Label htmlFor="job-email">
              {t.f.email} <span className="font-normal text-neutral-400">({t.f.emailHint})</span>
            </Label>
            <Input
              id="job-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 p-4">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={hasCar}
              onChange={(e) => setHasCar(e.target.checked)}
              className="mt-1 h-4 w-4 accent-orange-600"
            />
            <span>
              <span className="text-sm font-medium text-neutral-900">{t.f.hasCar}</span>
              <span className="mt-0.5 block text-xs text-neutral-500">{t.f.carHint}</span>
            </span>
          </label>
          {hasCar ? (
            <div className="mt-3">
              <Label htmlFor="job-vehicle" className="text-xs text-neutral-600">
                {t.f.vehicle}
              </Label>
              <Input
                id="job-vehicle"
                value={vehicle}
                onChange={(e) => setVehicle(e.target.value)}
                placeholder={t.f.vehiclePlaceholder}
                className="mt-1.5"
              />
            </div>
          ) : null}
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-neutral-900">{t.f.availability}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["fri", t.f.fri],
                ["sat", t.f.sat],
                ["sun", t.f.sun],
              ] as const
            ).map(([value, label]) => {
              const active = days.includes(value)
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleDay(value)}
                  aria-pressed={active}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    active
                      ? "border-orange-600 bg-orange-600 text-white"
                      : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400"
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </fieldset>

        <div>
          <Label htmlFor="job-earliest">{t.f.earliest}</Label>
          <Input
            id="job-earliest"
            value={earliestStart}
            onChange={(e) => setEarliestStart(e.target.value)}
            placeholder={t.f.earliestPlaceholder}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="job-experience">{t.f.experience}</Label>
          <Textarea
            id="job-experience"
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            placeholder={t.f.experiencePlaceholder}
            rows={3}
            className="mt-1.5"
          />
          <p className="mt-1 text-xs text-neutral-500">{t.f.experienceHint}</p>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={acceptsTerms}
            onChange={(e) => setAcceptsTerms(e.target.checked)}
            className="mt-1 h-4 w-4 accent-orange-600"
          />
          <span className="text-sm leading-relaxed text-neutral-700">{t.f.terms}</span>
        </label>

        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={status === "sending"} className="w-full bg-orange-600 py-6 text-base hover:bg-orange-700">
          {status === "sending" ? t.f.submitting : t.f.submit}
        </Button>

        <p className="text-center text-sm text-neutral-500">
          {t.f.orText}{" "}
          <a href={SMS_HREF} className="font-semibold text-orange-600 underline underline-offset-2">
            {PHONE}
          </a>
        </p>
      </form>
    </main>
  )
}
