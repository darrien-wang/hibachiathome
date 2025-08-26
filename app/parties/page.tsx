import { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { partyTypes } from "@/config/party-types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Users, Sparkles, Heart, Building, Home } from "lucide-react"

export const metadata: Metadata = {
  title: "Hibachi Party Catering Los Angeles | All Occasions | Hibachi at Home",
  description: "Professional hibachi party catering for all occasions in Los Angeles. Birthday parties, graduations, anniversaries, corporate events, and family gatherings with interactive teppanyaki entertainment.",
  keywords: "hibachi party catering, teppanyaki parties Los Angeles, birthday party hibachi, corporate hibachi events, graduation party catering, anniversary hibachi, family gathering catering",
  openGraph: {
    title: "Hibachi Party Catering for All Occasions | Los Angeles",
    description: "Make every celebration unforgettable with our hibachi party catering. Interactive teppanyaki entertainment for birthdays, graduations, corporate events & more.",
    images: ["/hibachi-party.png"],
  },
  alternates: {
    canonical: "https://realhibachiathome.com/parties"
  }
}

const partyIcons = {
  "birthday-party": Calendar,
  "graduation-party": Sparkles,
  "anniversary-party": Heart,
  "corporate-event": Building,
  "family-gathering": Home,
  "holiday-party": Sparkles
}

export default function PartiesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Hero Section */}
      <section className="pt-36 md:pt-44 lg:pt-48 pb-16">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Hibachi Parties for
              <span className="text-orange-600 block">Every Celebration</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Transform any occasion into an unforgettable experience with our interactive hibachi party catering. 
              From intimate family gatherings to grand corporate events, we bring the excitement of teppanyaki 
              entertainment directly to you.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="bg-orange-600 hover:bg-orange-700 text-white">
                <Link href="/book">Book Your Party Today</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-orange-600 text-orange-600 hover:bg-orange-50">
                <Link href="/menu">View Party Menus</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-white/70 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-orange-600 mb-2">500+</div>
              <div className="text-gray-600">Successful Parties</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-orange-600 mb-2">6</div>
              <div className="text-gray-600">Party Types</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-orange-600 mb-2">100%</div>
              <div className="text-gray-600">Satisfaction Rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* Party Types Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Choose Your Perfect Party Type
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Each party type is specially designed with unique entertainment, menu options, 
              and experiences tailored to your celebration.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {partyTypes.map((party) => {
              const IconComponent = partyIcons[party.id as keyof typeof partyIcons] || Users
              
              return (
                <Card key={party.id} className="group hover:shadow-xl transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm hover:-translate-y-2 flex flex-col h-full">
                  <div className="relative h-48 overflow-hidden rounded-t-lg">
                    <Image
                      src={party.heroImage}
                      alt={party.title}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <div className="absolute top-4 left-4">
                      <Badge className="bg-orange-600 text-white">
                        <IconComponent className="w-4 h-4 mr-1" />
                        {party.name}
                      </Badge>
                    </div>
                  </div>
                  
                  <CardHeader>
                    <CardTitle className="text-xl text-gray-900 group-hover:text-orange-600 transition-colors">
                      {party.title}
                    </CardTitle>
                    <CardDescription className="text-gray-600 line-clamp-2">
                      {party.description}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="flex-1 flex flex-col">
                    <div className="space-y-3 flex-1">
                      <div>
                        <h4 className="font-semibold text-sm text-gray-700 mb-2">Perfect For:</h4>
                        <div className="flex flex-wrap gap-1">
                          {party.perfectFor.slice(0, 3).map((item, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {item}
                            </Badge>
                          ))}
                          {party.perfectFor.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{party.perfectFor.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <Button asChild className="w-full group-hover:bg-orange-600 group-hover:text-white transition-colors mt-4">
                      <Link href={party.href}>
                        Learn More & Book
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-16 bg-gradient-to-r from-orange-600 to-amber-600 text-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why Choose Our Hibachi Party Catering?
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Interactive Entertainment</h3>
              <p className="text-orange-100">
                Our skilled teppanyaki chefs don't just cook - they put on a show that keeps guests 
                engaged and entertained throughout the entire experience.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Customized Experience</h3>
              <p className="text-orange-100">
                Every party is tailored to your specific celebration, with customized menus, 
                entertainment styles, and special moments designed just for you.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Memorable Moments</h3>
              <p className="text-orange-100">
                We create Instagram-worthy moments and lasting memories that you and your guests 
                will treasure long after the last bite.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-br from-gray-50 to-orange-50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
            Ready to Plan Your Perfect Hibachi Party?
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Don't settle for ordinary catering. Give your guests an unforgettable hibachi experience 
            that they'll be talking about for years to come.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="bg-orange-600 hover:bg-orange-700 text-white">
              <Link href="/book">Book Your Party Now</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-orange-600 text-orange-600 hover:bg-orange-50">
              <Link href="/gallery">See Our Work</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

