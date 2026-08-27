import { sourcing, sourcingAllergenNote } from "@/config/sourcing"

type SourcingSpecProps = {
  /** Named on a city landing page, omitted on /menu. */
  city?: string
  adultPrice?: number
}

export default function SourcingSpec({ city, adultPrice = 59.9 }: SourcingSpecProps) {
  return (
    <section aria-labelledby="sourcing-heading" className="max-w-4xl mx-auto">
      <h2 id="sourcing-heading" className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-4">
        What We Actually <span className="text-primary">Buy</span>
      </h2>
      <p className="text-gray-600 mb-8 max-w-3xl">
        Almost nobody in mobile hibachi will tell you the grade of what goes on the grill &mdash; you get
        &ldquo;fresh ingredients&rdquo; and a photo. Here is the actual spec for
        {city ? ` a ${city} party` : " every party"}, because at ${adultPrice.toFixed(2)} a head you should be able
        to check.
      </p>
      <dl className="grid sm:grid-cols-2 gap-px bg-gray-200 rounded-xl overflow-hidden border border-gray-200">
        {sourcing.map((row) => (
          <div key={row.item} className="bg-white p-5">
            <dt className="text-xs font-medium uppercase tracking-widest text-gray-500 mb-1">{row.item}</dt>
            <dd>
              <p className="font-bold text-gray-900">{row.spec}</p>
              <p className="mt-1 text-sm text-gray-600 leading-relaxed">{row.note}</p>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm text-gray-500">
        <strong className="text-gray-700">Allergies:</strong> {sourcingAllergenNote}
      </p>
    </section>
  )
}
