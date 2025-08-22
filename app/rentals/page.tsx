import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

// Rental items data
const rentalItems = [
  {
    id: "tables",
    name: "Tables",
    description: "8-foot rectangular tables, perfect for hibachi service. Seats 8 people per table.",
    rate: "$20 per table",
    image: "/placeholder.svg?height=300&width=400&query=rectangular dining table",
  },
  {
    id: "chairs",
    name: "Chairs",
    description: "Folding chairs with padded seats for comfort during your meal.",
    rate: "$3 per chair",
    image: "/placeholder.svg?height=300&width=400&query=folding chair with padded seat",
  },
  {
    id: "dinnerware",
    name: "Dinnerware Sets",
    description: "Complete dinnerware sets including plate, bowl, chopsticks, fork, and napkin.",
    rate: "$5 per person",
    image: "/placeholder.svg?height=300&width=400&query=asian style dinnerware set with chopsticks",
  },
  {
    id: "linens",
    name: "Table Linens",
    description: "Quality tablecloths and table runners in various colors to match your event theme.",
    rate: "$10 per table",
    image: "/placeholder.svg?height=300&width=400&query=elegant tablecloth on dining table",
  },
  {
    id: "beveragestation",
    name: "Beverage Station",
    description: "Complete setup including ice bins, drink dispensers, and glassware.",
    rate: "$50 flat rate",
    image: "/placeholder.svg?height=300&width=400&query=beverage station with drink dispensers",
  },
  {
    id: "lighting",
    name: "Ambient Lighting",
    description: "String lights and lanterns to create the perfect atmosphere for your event.",
    rate: "$35 flat rate",
    image: "/placeholder.svg?height=300&width=400&query=outdoor string lights for parties",
  },
]

export default function RentalsPage() {
  return (
    <div className="page-container container mx-auto px-4 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold mb-4">Equipment Rentals</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Enhance your hibachi experience with our premium rental equipment. All items are delivered and set up before
            your event.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {rentalItems.map((item) => (
            <Card key={item.id}>
              <div className="aspect-video w-full overflow-hidden">
                <img src={item.image || "/placeholder.svg"} alt={item.name} className="w-full h-full object-cover" />
              </div>
              <CardHeader>
                <CardTitle>{item.name}</CardTitle>
                <CardDescription>{item.rate}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">{item.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="bg-gray-50 rounded-lg p-6 mb-10">
          <h2 className="text-2xl font-bold mb-4">Rental Policies</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-bold text-lg mb-2">Delivery & Setup</h3>
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li>All equipment is delivered and set up before your scheduled event time</li>
                <li>Delivery is included within our service areas</li>
                <li>Additional fees apply for locations outside our service areas</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-2">Damages & Returns</h3>
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li>A security deposit may be required for certain rental items</li>
                <li>Client is responsible for any damaged or missing items</li>
                <li>All equipment is collected immediately after the event</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold mb-4">Full-Service Package</h2>
          <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
            For the ultimate hassle-free experience, consider our full-service package which includes all necessary
            equipment, setup, service staff, and cleanup.
          </p>
          <Button asChild size="lg">
            <Link href="/service-area">Check Service Area & Contact</Link>
          </Button>
        </div>

        <div className="bg-primary/10 rounded-lg p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between">
            <div className="mb-4 md:mb-0">
              <h2 className="text-xl font-bold mb-2">Ready to Reserve Equipment?</h2>
              <p className="text-gray-600">
                Add equipment rental to your booking or contact us for a standalone rental.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild variant="outline">
                <Link href="/service-area">Ask a Question</Link>
              </Button>
              <Button asChild>
                <Link href="/book">Add to Booking</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
