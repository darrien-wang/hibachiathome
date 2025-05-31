import { Button } from "@/components/ui/button"
import Link from "next/link"
import { MapPin, Phone, Clock, Users } from "lucide-react"
import { AnimateOnScroll } from "@/components/animate-on-scroll"

const serviceRegions = [
  {
    id: "northeast",
    name: "Northeast",
    description: "Serving the Northeast region with premium hibachi experiences",
    states: [
      "Connecticut",
      "Delaware",
      "Kentucky",
      "Maine",
      "Maryland",
      "Massachusetts",
      "New Hampshire",
      "New Jersey",
      "New York",
      "Pennsylvania",
      "Rhode Island",
      "Vermont",
      "Virginia",
      "Washington D.C.",
    ],
    phone: "(973) 566-1360",
    coverage: "14 States + D.C.",
    responseTime: "24-48 hours",
    teamSize: "15+ Chefs",
  },
  {
    id: "midwest",
    name: "Midwest",
    description: "Bringing authentic hibachi to the heart of America",
    states: [
      "Illinois",
      "Indiana",
      "Iowa",
      "Michigan",
      "Minnesota",
      "Missouri",
      "North Dakota",
      "Ohio",
      "South Dakota",
      "Wisconsin",
    ],
    phone: "(973) 566-1360",
    coverage: "10 States",
    responseTime: "24-48 hours",
    teamSize: "12+ Chefs",
  },
  {
    id: "southeast",
    name: "Southeast",
    description: "Serving the Southeast with fire and flavor",
    states: [
      "Alabama",
      "Florida",
      "Georgia",
      "Louisiana",
      "North Carolina",
      "South Carolina",
      "Tennessee",
      "Virginia",
      "West Virginia",
    ],
    phone: "(321) 360-4308",
    coverage: "9 States",
    responseTime: "24-48 hours",
    teamSize: "18+ Chefs",
  },
  {
    id: "westcoast",
    name: "West Coast",
    description: "Pacific coast hibachi experiences from California to Washington",
    states: ["Arizona", "California", "Colorado", "Nevada", "New Mexico", "Oregon", "Utah", "Washington"],
    phone: "(928) 723-1390",
    coverage: "8 States",
    responseTime: "24-48 hours",
    teamSize: "20+ Chefs",
  },
]

export default function LocationsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800">
      {/* Fire background overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-orange-500/10 via-transparent to-yellow-500/5 pointer-events-none"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-transparent to-orange-500/10 pointer-events-none"></div>

      <div className="container mx-auto px-4 py-12 relative z-10">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <AnimateOnScroll direction="down">
            <div className="text-center mb-16">
              <h1 className="text-5xl md:text-6xl font-energy font-bold mb-6 fire-text-gradient">
                🔥 SERVICE LOCATIONS 🔥
              </h1>
              <p className="text-xl text-amber-100 max-w-3xl mx-auto mb-6">
                We bring the authentic hibachi experience directly to your location across the United States
              </p>
              <div className="flex flex-wrap justify-center gap-4 text-sm text-orange-300">
                <span className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  50+ States Covered
                </span>
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  65+ Professional Chefs
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  24-48 Hour Response
                </span>
              </div>
            </div>
          </AnimateOnScroll>

          {/* Service Regions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
            {serviceRegions.map((region, index) => (
              <AnimateOnScroll key={region.id} delay={index * 100} direction={index % 2 === 0 ? "left" : "right"}>
                <div className="bg-gradient-to-br from-amber-900/40 via-orange-900/30 to-red-900/40 backdrop-blur-sm border border-orange-500/30 rounded-2xl overflow-hidden transition-all duration-500 hover:border-orange-400/50 hover:shadow-2xl hover:shadow-orange-500/20 relative group">
                  {/* Fire glow overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-orange-500/5 via-transparent to-yellow-500/5 pointer-events-none"></div>

                  <div className="p-8 relative z-10">
                    {/* Region Header */}
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-3xl font-energy font-bold fire-text-gradient mb-2">{region.name}</h2>
                        <p className="text-amber-100">{region.description}</p>
                      </div>
                      <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30">
                        <MapPin className="h-8 w-8 text-white" />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="text-center">
                        <div className="text-orange-400 font-bold text-lg">{region.coverage}</div>
                        <div className="text-amber-200 text-sm">Coverage</div>
                      </div>
                      <div className="text-center">
                        <div className="text-orange-400 font-bold text-lg">{region.teamSize}</div>
                        <div className="text-amber-200 text-sm">Team Size</div>
                      </div>
                      <div className="text-center">
                        <div className="text-orange-400 font-bold text-lg">{region.responseTime}</div>
                        <div className="text-amber-200 text-sm">Response</div>
                      </div>
                    </div>

                    {/* States List */}
                    <div className="mb-6">
                      <h3 className="text-yellow-400 font-bold mb-3">States Served:</h3>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {region.states.map((state) => (
                          <div key={state} className="text-amber-100 text-sm flex items-center">
                            <span className="text-orange-400 mr-2">•</span>
                            {state}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        asChild
                        className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white font-bold py-3 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/30 border-none"
                      >
                        <Link href="/book">Book in {region.name}</Link>
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        className="flex-1 border-2 border-orange-500 text-orange-400 hover:bg-orange-500/10 font-bold py-3 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/30"
                      >
                        <a href={`tel:${region.phone}`} className="flex items-center justify-center gap-2">
                          <Phone className="h-4 w-4" />
                          {region.phone}
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              </AnimateOnScroll>
            ))}
          </div>

          {/* Expansion Notice */}
          <AnimateOnScroll direction="up">
            <div className="bg-gradient-to-br from-amber-900/40 via-orange-900/30 to-red-900/40 backdrop-blur-sm border border-orange-500/30 rounded-2xl p-8 text-center relative overflow-hidden">
              {/* Fire glow overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-orange-500/5 via-transparent to-yellow-500/5 pointer-events-none"></div>

              <div className="relative z-10">
                <h2 className="text-3xl font-energy font-bold fire-text-gradient mb-4">Don't See Your Area?</h2>
                <p className="text-amber-100 text-lg mb-6 max-w-2xl mx-auto">
                  We're rapidly expanding our service areas! Contact us to check if we can accommodate your location or
                  to be notified when we expand to your area.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button
                    asChild
                    className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white font-bold px-8 py-3 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/30 border-none"
                  >
                    <Link href="/contact">Contact Us</Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="border-2 border-orange-500 text-orange-400 hover:bg-orange-500/10 font-bold px-8 py-3 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/30"
                  >
                    <Link href="/book">Check Availability</Link>
                  </Button>
                </div>
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </div>
    </div>
  )
}
