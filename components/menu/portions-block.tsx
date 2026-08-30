// Owner-confirmed per-guest portions, published as a promise. Same numbers
// drive the chef prep list in the invoice system - keep the two in sync.
const PORTIONS = [
  { label: "Chicken", amount: "5 oz" },
  { label: "Steak", amount: "4.5 oz" },
  { label: "Salmon", amount: "4 oz" },
  { label: "Shrimp", amount: "5 pcs" },
  { label: "Scallops", amount: "4 pcs" },
  { label: "Fried Rice", amount: "8 oz" },
  { label: "Vegetables", amount: "4 oz" },
  { label: "Side Salad", amount: "1 serving" },
]

export default function PortionsBlock() {
  return (
    <section className="mb-16 rounded-2xl border border-amber-200 bg-amber-50/60 px-6 py-8">
      <h2 className="text-2xl md:text-3xl font-serif font-bold text-center mb-2">
        What Every Guest Gets — <span className="text-primary">Exact Portions</span>
      </h2>
      <p className="text-center text-sm text-gray-600 mb-6">
        Pick any 2 proteins per guest. These are the real per-person amounts our chefs prep — in writing.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
        {PORTIONS.map((p) => (
          <div key={p.label} className="rounded-lg bg-white border border-amber-100 px-3 py-3 text-center shadow-sm">
            <p className="text-xl font-bold text-amber-700">{p.amount}</p>
            <p className="text-xs font-medium text-gray-700">{p.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 text-center text-sm font-medium text-amber-900">
        Kids 5-12 eat half portions. Nobody leaves a Real Hibachi party hungry.
      </p>
    </section>
  )
}
