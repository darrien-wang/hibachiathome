import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { pricing } from "@/config/pricing"

// Honest math: tables/chairs are OPTIONAL and travel is free within 50
// miles, so the headline number is what most parties actually pay - the
// base price alone. Optional costs are listed as optional, not baked in.
const FULL_SETUP_PER_PERSON = 15

type ExampleCard = {
  guests: number
  baseTotal: number
  setupIfNeeded: number
}

function getExampleForGuests(guests: number): ExampleCard {
  const rawBase = guests * pricing.packages.basic.perPerson
  return {
    guests,
    baseTotal: Math.round(Math.max(rawBase, pricing.packages.basic.minimum)),
    setupIfNeeded: guests * FULL_SETUP_PER_PERSON,
  }
}

const examples = [10, 15, 20].map(getExampleForGuests)

export default function PriceTransparency() {
  return (
    <section className="my-10 rounded-xl border border-amber-200 bg-amber-50/40 p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Total Price Examples (Fast Estimate)</h2>
      <p className="text-sm text-gray-700 mb-6">
        The big number is what most parties actually pay — food, chef, live show, setup and cleanup all
        included, with free travel within 50 miles. Add-ons are optional and listed separately.
      </p>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        {examples.map((example) => (
          <Card key={example.guests} className="border-amber-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{example.guests} Guests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-gray-700">
              <p className="text-2xl font-bold text-gray-900">${example.baseTotal.toFixed(0)}</p>
              <p className="text-xs text-gray-500">Most parties pay exactly this — no travel fee within 50 miles.</p>
              <div className="pt-2 border-t border-amber-100 text-xs text-gray-600 space-y-0.5">
                <p>Optional: tables, chairs &amp; utensils +${example.setupIfNeeded} (skip it if you have your own)</p>
                <p>Optional: premium upgrades, appetizers, DIY fried rice add-ins</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 text-sm">
        <div className="rounded-lg bg-white p-4 border border-amber-200">
          <p className="font-semibold text-gray-900 mb-1">Included in the price above</p>
          <p className="text-gray-700">
            Chef service, grill setup, live cooking show, 2 proteins per guest, fried rice, vegetables, salad,
            cleanup — and travel within 50 miles.
          </p>
        </div>
        <div className="rounded-lg bg-white p-4 border border-amber-200">
          <p className="font-semibold text-gray-900 mb-1">Only if you choose them</p>
          <p className="text-gray-700">
            Table/chair/utensil rental, premium upgrades (filet mignon, jumbo scallops, lobster tail),
            appetizers, and travel beyond 50 miles ($1/mile past the free radius). Gratuity for your chef
            (20-25% customary) is not included.
          </p>
        </div>
      </div>
    </section>
  )
}
