"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { PartyType } from "@/config/party-types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Instagram, Facebook, Play, Check, Star, Phone, Mail } from "lucide-react"

interface PartyPageLayoutProps {
  partyType: PartyType
  children?: React.ReactNode
}

export default function PartyPageLayout({ partyType }: PartyPageLayoutProps) {
  const [selectedImage, setSelectedImage] = useState(0)
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Hero Section */}
      <section className="pt-32 pb-16 relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src={partyType.heroImage}
            alt={partyType.title}
            fill
            className="object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-orange-600/80 to-amber-600/80" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center text-white">
            <Badge className="mb-4 bg-white/20 text-white border-white/30">
              {partyType.name}
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              {partyType.title}
            </h1>
            <p className="text-xl mb-8 opacity-90 leading-relaxed">
              {partyType.description}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="bg-white text-orange-600 hover:bg-orange-50">
                <Link href="/book">Book This Party Type</Link>
              </Button>
              <Button variant="outline" size="lg" className="border-white text-white hover:bg-white/10">
                <Link href="/menu">View Menu Options</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features & Perfect For Section */}
      <section className="py-16 bg-white/70 backdrop-blur-sm">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Features */}
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">What's Included</h2>
              <div className="space-y-4">
                {partyType.features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-orange-600 rounded-full flex items-center justify-center mt-0.5">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Perfect For */}
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Perfect For</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {partyType.perfectFor.map((occasion, index) => (
                  <Badge key={index} variant="secondary" className="justify-start p-3 text-sm">
                    {occasion}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            See Our {partyType.name} in Action
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {partyType.galleryImages.map((image, index) => (
              <Dialog key={index}>
                <DialogTrigger asChild>
                  <div className="relative h-64 cursor-pointer group overflow-hidden rounded-lg">
                    <Image
                      src={image}
                      alt={`${partyType.name} gallery ${index + 1}`}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                        <Play className="w-6 h-6 text-gray-900" />
                      </div>
                    </div>
                  </div>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <div className="relative h-96">
                    <Image
                      src={image}
                      alt={`${partyType.name} gallery ${index + 1}`}
                      fill
                      className="object-contain"
                    />
                  </div>
                </DialogContent>
              </Dialog>
            ))}
          </div>
        </div>
      </section>

      {/* Social Media & Videos Section */}
      <section className="py-16 bg-gradient-to-r from-gray-900 to-gray-800 text-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            Follow Our {partyType.name} Adventures
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Social Media Links */}
            <div>
              <h3 className="text-2xl font-semibold mb-6">Connect With Us</h3>
              <p className="text-gray-300 mb-6">
                Follow us on social media to see more {partyType.name.toLowerCase()}, get party ideas, 
                and stay updated on our latest events and special offers.
              </p>
              
              <div className="space-y-4">
                {partyType.socialMediaLinks?.instagram && (
                  <Link
                    href={partyType.socialMediaLinks.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    <Instagram className="w-8 h-8 text-pink-400" />
                    <div>
                      <div className="font-semibold">Follow us on Instagram</div>
                      <div className="text-sm text-gray-300">See our latest {partyType.name.toLowerCase()} photos & videos</div>
                    </div>
                  </Link>
                )}
                
                {partyType.socialMediaLinks?.facebook && (
                  <Link
                    href={partyType.socialMediaLinks.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    <Facebook className="w-8 h-8 text-blue-400" />
                    <div>
                      <div className="font-semibold">Like us on Facebook</div>
                      <div className="text-sm text-gray-300">Join our community and see event updates</div>
                    </div>
                  </Link>
                )}
              </div>
            </div>

            {/* Video Content */}
            <div>
              <h3 className="text-2xl font-semibold mb-6">Watch Our Work</h3>
              <p className="text-gray-300 mb-6">
                Check out these videos from recent {partyType.name.toLowerCase()} we've catered. 
                See the excitement, entertainment, and delicious food that awaits your celebration.
              </p>
              
              {partyType.videoLinks && partyType.videoLinks.length > 0 ? (
                <div className="space-y-4">
                  {partyType.videoLinks.map((videoLink, index) => (
                    <Link
                      key={index}
                      href={videoLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-4 p-4 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                    >
                      <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center">
                        <Play className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className="font-semibold">Watch {partyType.name} Video {index + 1}</div>
                        <div className="text-sm text-gray-300">See our hibachi experience in action</div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="bg-white/10 rounded-lg p-6 text-center">
                  <Play className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-300">
                    Videos coming soon! Follow us on social media to see our latest {partyType.name.toLowerCase()}.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      {partyType.testimonials && partyType.testimonials.length > 0 && (
        <section className="py-16 bg-white/70 backdrop-blur-sm">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
              What Our {partyType.name} Clients Say
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {partyType.testimonials.map((testimonial, index) => (
                <Card key={index} className="bg-white/80 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex items-center gap-1 mb-2">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <CardTitle className="text-lg">{testimonial.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 italic">"{testimonial.review}"</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-orange-600 to-amber-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Book Your {partyType.name}?
          </h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Don't wait - our calendar fills up quickly, especially for popular party types like {partyType.name.toLowerCase()}. 
            Book today to secure your perfect hibachi experience.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button size="lg" className="bg-white text-orange-600 hover:bg-orange-50">
              <Link href="/book">Book Now</Link>
            </Button>
            <Button variant="outline" size="lg" className="border-white text-white hover:bg-white/10">
              <Link href="/faq">View FAQ</Link>
            </Button>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center text-sm opacity-90">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              <span>Call for immediate booking: (555) 123-4567</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              <span>Email: bookings@realhibachiathome.com</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

