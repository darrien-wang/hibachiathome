"use client"

import { AnimateOnScroll } from "@/components/animate-on-scroll"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { MapPin, Phone } from "lucide-react"

const serviceRegions = [
  {
    id: "northeast",
    name: "NORTHEAST",
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
    mapPosition: "top-left",
  },
  {
    id: "midwest",
    name: "MIDWEST",
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
    mapPosition: "top-center",
  },
  {
    id: "southeast",
    name: "SOUTHEAST",
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
    mapPosition: "bottom-center",
  },
  {
    id: "westcoast",
    name: "WEST COAST",
    states: ["Arizona", "California", "Colorado", "Nevada", "New Mexico", "Oregon", "Utah", "Washington"],
    phone: "(928) 723-1390",
    mapPosition: "top-right",
  },
]

export default function ServiceAreasSection() {
  return (
    <section className="py-16 bg-gradient-to-br from-gray-900 via-black to-gray-800 relative overflow-hidden">
      {/* Fire background overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-orange-500/10 via-transparent to-yellow-500/5 pointer-events-none"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-transparent to-orange-500/10 pointer-events-none"></div>

      <div className="container mx-auto px-4 relative z-10">
        <AnimateOnScroll direction="down">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-energy font-bold mb-6 fire-text-gradient">🔥 SERVICE AREAS 🔥</h2>
            <p className="text-xl text-amber-100 max-w-3xl mx-auto mb-4">
              Select Your Region To Start Your Hibachi Experience
            </p>
            <p className="text-gray-300 max-w-2xl mx-auto">
              We bring the authentic hibachi experience directly to your location across multiple regions
            </p>
          </div>
        </AnimateOnScroll>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {serviceRegions.map((region, index) => (
            <AnimateOnScroll key={region.id} delay={index * 100} direction="up">
              <div className="bg-gradient-to-br from-amber-900/40 via-orange-900/30 to-red-900/40 backdrop-blur-sm border border-orange-500/30 rounded-2xl overflow-hidden transition-all duration-500 hover:border-orange-400/50 hover:shadow-2xl hover:shadow-orange-500/20 hover:scale-105 relative group">
                {/* Fire glow overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-orange-500/5 via-transparent to-yellow-500/5 pointer-events-none"></div>

                <div className="p-6 relative z-10">
                  {/* Region Header */}
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/30">
                      <MapPin className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-2xl font-energy font-bold fire-text-gradient mb-2">{region.name}</h3>
                  </div>

                  {/* States List */}
                  <div className="mb-6">
                    <div className="grid grid-cols-1 gap-1 text-sm">
                      {region.states.slice(0, 6).map((state) => (
                        <span key={state} className="text-amber-100 flex items-center">
                          <span className="text-orange-400 mr-2">•</span>
                          {state}
                        </span>
                      ))}
                      {region.states.length > 6 && (
                        <span className="text-orange-300 text-xs mt-1">+{region.states.length - 6} more states</span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    <Button
                      asChild
                      className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 text-white font-bold py-3 text-sm rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/30 border-none"
                    >
                      <Link href="/book">BOOK {region.name}</Link>
                    </Button>

                    <div className="text-center">
                      <p className="text-amber-200 text-xs mb-2">OR CALL TO BOOK</p>
                      <a
                        href={`tel:${region.phone}`}
                        className="inline-flex items-center gap-2 text-orange-300 hover:text-orange-200 transition-colors border border-orange-500/30 rounded-lg px-3 py-2 text-sm hover:border-orange-400/50"
                      >
                        <Phone className="h-4 w-4" />
                        {region.phone}
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </AnimateOnScroll>
          ))}
        </div>

        <AnimateOnScroll direction="up" delay={400}>
          <div className="text-center mt-12">
            <p className="text-amber-200 mb-4">Don't see your area? We're expanding rapidly!</p>
            <Button
              asChild
              className="bg-gray-800 border-2 border-orange-500 text-orange-400 hover:bg-orange-500/10 font-bold px-8 py-3 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/30"
            >
              <Link href="/contact">Contact Us About Your Area</Link>
            </Button>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  )
}
