interface CounterItemProps {
  value: string
  label: string
}

const CounterItem = ({ value, label }: CounterItemProps) => (
  <div className="text-center">
    <div className="text-3xl font-bold text-amber-600 mb-2">{value}</div>
    <div className="text-gray-600">{label}</div>
  </div>
)

export default function SocialProofCounter() {
  return (
    <section className="py-8 bg-white">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <CounterItem value="500+" label="Happy Customers" />
          <CounterItem value="4.9★" label="Average Rating" />
          <CounterItem value="100%" label="Satisfaction Rate" />
        </div>
      </div>
    </section>
  )
}
