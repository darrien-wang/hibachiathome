import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Phone, MapPin, ChevronRight } from "lucide-react"
import { AnimateOnScroll } from "@/components/animate-on-scroll"

const regions = [
  {
    id: "northeast",
    name: "Northeast",
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
    image: "/images/northeast-map.png",
  },
  {
    id: "midwest",
    name: "Midwest",
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
    image: "/images/northeast-map.png", // Using placeholder image
  },
  {
    id: "southeast",
    name: "Southeast",
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
    image: "/images/northeast-map.png", // Using placeholder image
  },
  {
    id: "west-coast",
    name: "West Coast",
    states: ["Arizona", "California", "Colorado", "Nevada", "New Mexico", "Oregon", "Utah", "Washington"],
    phone: "(928) 723-1390",
    image: "/images/northeast-map.png", // Using placeholder image
  },
]

export default function ServiceAreasPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section with Fire Background */}
      <div className="relative h-[40vh] min-h-[300px] flex items-center justify-center overflow-hidden">
        <video
          className="absolute top-0 left-0 w-full h-full object-cover z-0 opacity-60"
          autoPlay
          muted
          loop
          playsInline
          src="https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachi%20video/smallfire-EtpxGU9GpXZMkOHfBSrfm4qWNxXChh.mp4"
        />
        <div className="absolute inset-0 bg-black bg-opacity-50 z-10"></div>
        <div className="container mx-auto px-4 relative z-20 text-center">
          <AnimateOnScroll direction="down">
            <h1 className="text-5xl md:text-6xl font-energy mb-4 tracking-wide">
              <span className="text-[#FFF4E0] drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">BOOK YOUR </span>
              <span className="fire-text-gradient animate-pulse">HIBACHI PARTY</span>
            </h1>
            <p className="text-xl md:text-2xl max-w-3xl mx-auto text-amber-100">
              Select your region to start your unforgettable hibachi experience
            </p>
          </AnimateOnScroll>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {regions.map((region, index) => (
            <AnimateOnScroll key={region.id} delay={index * 100} direction={index % 2 === 0 ? "left" : "right"}>
              <div className="bg-gradient-to-br from-gray-900 to-black rounded-2xl overflow-hidden border border-orange-500/20 shadow-2xl hover:shadow-fire transition-all duration-300 hover:-translate-y-1 group">
                <div className="relative h-64 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent z-10"></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-600/20 to-red-600/20 z-[5] group-hover:opacity-70 transition-opacity duration-300"></div>
                  <Image
                    src={region.image || "/placeholder.svg"}
                    alt={`${region.name} service area map`}
                    width={600}
                    height={400}
                    className="w-full h-full object-contain p-4 transform group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-6 z-20">
                    <h2 className="text-3xl font-energy text-white fire-text-glow">{region.name.toUpperCase()}</h2>
                  </div>
                </div>

                <div className="p-6">
                  <div className="mb-6">
                    <h3 className="text-lg font-bold mb-3 text-amber-200 flex items-center">
                      <MapPin className="w-5 h-5 mr-2 text-orange-500" />
                      States We Serve
                    </h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {region.states.map((state) => (
                        <p key={state} className="text-gray-300 text-sm flex items-center">
                          <span className="text-orange-500 mr-1">•</span> {state}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-4 items-center">
                    <Button
                      asChild
                      className="relative overflow-hidden bg-gradient-to-r from-amber-500 to-red-600 text-white font-bold py-3 px-6 rounded-full w-full md:w-auto border-2 border-amber-300/30 shadow-[0_0_15px_rgba(255,106,0,0.5)] hover:shadow-[0_0_25px_rgba(255,106,0,0.8)] transition-all duration-300 group"
                    >
                      <Link href="/book" className="flex items-center justify-center">
                        <span className="relative z-10">BOOK {region.name.toUpperCase()}</span>
                        <ChevronRight className="ml-2 h-5 w-5" />
                        <span className="absolute inset-0 bg-gradient-to-t from-orange-600 to-amber-400 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0"></span>
                        <span className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-transparent to-amber-500/20 opacity-0 group-hover:opacity-100 animate-pulse z-0"></span>
                        <span className="absolute -inset-1 rounded-full blur-md bg-gradient-to-r from-amber-400 to-red-500 opacity-0 group-hover:opacity-30 transition-opacity duration-300 group-hover:duration-700"></span>
                      </Link>
                    </Button>

                    <div className="flex items-center text-amber-100">
                      <Phone className="h-5 w-5 mr-2 text-orange-500 animate-pulse" />
                      <span className="text-sm md:text-base">{region.phone}</span>
                    </div>
                  </div>
                </div>
              </div>
            </AnimateOnScroll>
          ))}
        </div>

        {/* Call to Action */}
        <AnimateOnScroll direction="up">
          <div className="mt-20 text-center">
            <div className="max-w-3xl mx-auto bg-gradient-to-br from-gray-900 to-black p-8 rounded-2xl border border-orange-500/30 shadow-2xl fire-glow-subtle">
              <h2 className="text-3xl font-energy mb-4 fire-text-gradient">Don't See Your Area?</h2>
              <p className="text-gray-300 mb-6">
                We're constantly expanding our service areas. Contact us to check if we can accommodate your location or
                for special arrangements.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild className="cta-secondary hover:fire-glow-intense transition-all duration-300 font-bold">
                  <Link href="/contact">Contact Us</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-orange-500/50 text-orange-400 hover:bg-orange-950/30 hover:text-orange-300"
                >
                  <Link href="/faq">View FAQs</Link>
                </Button>
              </div>
            </div>
          </div>
        </AnimateOnScroll>
      </div>
    </div>
  )
}
