import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { pricing } from "@/config/pricing"

const TAX_RATE = 0.095
const TRAVEL_FEE_RANGE = { low: 25, high: 60 }
const TABLEWARE_PER_PERSON = 2.5

type ExampleCard = {
  guests: number
  baseSubtotal: number
  tax: number
  equipment: number
  totalLow: number
  totalHigh: number
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

function getExampleForGuests(guests: number): ExampleCard {
  const rawBase = guests * pricing.packages.basic.perPerson
  const baseSubtotal = Math.max(rawBase, pricing.packages.basic.minimum)
  const tax = baseSubtotal * TAX_RATE
  const equipment = guests * TABLEWARE_PER_PERSON

  return {
    guests,
    baseSubtotal: roundCurrency(baseSubtotal),
    tax: roundCurrency(tax),
    equipment: roundCurrency(equipment),
    totalLow: roundCurrency(baseSubtotal + tax + equipment + TRAVEL_FEE_RANGE.low),
    totalHigh: roundCurrency(baseSubtotal + tax + equipment + TRAVEL_FEE_RANGE.high),
  }
}

const examples = [10, 15, 20].map(getExampleForGuests)

export default function PriceTransparency() {
  return (
    <section className="my-10 rounded-xl border border-amber-200 bg-amber-50/40 p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Total Price Examples (Fast Estimate)</h2>
      <p className="text-sm text-gray-700 mb-6">
        These examples include base menu price, estimated tax, tableware rental, and local travel range so you can
        understand likely totals quickly.
      </p>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        {examples.map((example) => (
          <Card key={example.guests} className="border-amber-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{example.guests} Guests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-gray-700">
              <p>Base food subtotal: ${example.baseSubtotal.toFixed(0)}</p>
              <p>Estimated tax (9.5%): ${example.tax.toFixed(0)}</p>
              <p>Tableware rental: ${example.equipment.toFixed(0)}</p>
              <p>
                Travel fee: ${TRAVEL_FEE_RANGE.low} - ${TRAVEL_FEE_RANGE.high}
              </p>
              <p className="pt-2 font-bold text-gray-900">
                Estimated total: ${example.totalLow.toFixed(0)} - ${example.totalHigh.toFixed(0)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 text-sm">
        <div className="rounded-lg bg-white p-4 border border-amber-200">
          <p className="font-semibold text-gray-900 mb-1">Included in base menu price</p>
          <p className="text-gray-700">Chef service, grill setup, cooking show, and standard cleanup.</p>
        </div>
        <div className="rounded-lg bg-white p-4 border border-amber-200">
          <p className="font-semibold text-gray-900 mb-1">Potential additional costs</p>
          <p className="text-gray-700">
            Tax, travel fee by distance, table/chair/utensil rentals, and premium add-ons (steak/shrimp/lobster).
          </p>
        </div>
      </div>
    </section>
  )
}
