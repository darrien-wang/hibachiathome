"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { getMenuImageById } from "@/config/images"
import { phone } from "@/config/site"

interface MenuDetailsProps {
  proteins: any[]
  premiumProteins: any[]
  sides: any[]
}

export default function MenuDetails({ proteins, premiumProteins, sides }: MenuDetailsProps) {
  const [activeTab, setActiveTab] = useState("proteins")

  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  return (
    <div className="mb-16">
      <h2 className="text-3xl font-bold text-center mb-8">Menu Details</h2>

      <Tabs defaultValue="proteins" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 mb-8 h-auto">
          <TabsTrigger value="proteins" className="text-xs sm:text-sm px-2 py-3 whitespace-nowrap">
            Regular Proteins
          </TabsTrigger>
          <TabsTrigger value="premium" className="text-xs sm:text-sm px-2 py-3 whitespace-nowrap">
            Premium Proteins
          </TabsTrigger>
          <TabsTrigger value="sides" className="text-xs sm:text-sm px-2 py-3 whitespace-nowrap">
            Sides & Appetizers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="proteins" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {proteins.map((protein) => {
              // Every id maps to a real photo of that exact dish.
              const proteinImageMap: Record<string, string> = {
                chicken: "/images/menu/chicken.jpg",
                steak: "/images/menu/steak.jpg",
                shrimp: "/images/menu/shrimp.jpg",
                salmon: "/images/menu/salmon.jpg",
                tofu: "/images/menu/tofu.jpg",
                scallops: "/images/menu/scallops.jpg",
              }

              const imageUrl = proteinImageMap[protein.id] || getMenuImageById("chicken-steak")

              return (
                <div
                  key={protein.id}
                  className={`border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all ${
                    protein.id === "tofu" ? "border-green-400 bg-green-50/30" : ""
                  }`}
                >
                  <div className="relative h-48 overflow-hidden">
                    <Image
                      src={imageUrl || "/placeholder.svg"}
                      alt={protein.name}
                      fill
                      className="object-cover hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-bold mb-1">{protein.name}</h3>
                    <p className="text-gray-600 text-sm mb-3">{protein.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="premium" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {premiumProteins
              .filter((protein) => protein.id === "filet" || protein.id === "lobster" || protein.id === "scallops-premium")
              .map((protein) => {
                // Real photos where we have them; no photo beats a wrong photo.
                const premiumImageMap: Record<string, string> = {
                  filet: "/images/menu/filet.jpg",
                  lobster: "/images/menu/lobster.jpg",
                  "scallops-premium": "/images/menu/scallops.jpg",
                }
                const premiumImage = premiumImageMap[protein.id]
                return (
                <div
                  key={protein.id}
                  className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all"
                >
                  {premiumImage && (
                  <div className="relative h-48 overflow-hidden">
                    <Image
                      src={premiumImage}
                      alt={protein.name}
                      fill
                      className="object-cover hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  </div>
                  )}
                  <div className="p-4">
                    <h3 className="text-lg font-bold mb-1">{protein.name}</h3>
                    <p className="text-gray-600 text-sm mb-3">{protein.description}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-amber-600">${protein.price}</span>
                      <Button asChild size="sm" variant="outline">
                        {isMobile ? (
                          <a
                            href={`sms:${phone.sms.e164}?body=Hi! I'd like to order ${protein.name} for my hibachi catering. Please contact me for details.`}
                          >
                            Order via SMS
                          </a>
                        ) : (
                          <Link href="/book">Add to Order</Link>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )})}
          </div>
        </TabsContent>

        <TabsContent value="sides" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sides
              .filter((side) => side.id !== "soup")
              .map((side) => {
                const sideImageMap: Record<string, string> = {
                  noodles: "/images/menu/noodles.jpg",
                  gyoza: "/images/menu/gyoza.jpg",
                  edamame: "/images/menu/edamame.jpg",
                  "spring-rolls": "/images/menu/spring-rolls.jpg",
                  "diy-fried-rice": "/images/menu/rice.jpg",
                }
                const sideImage = sideImageMap[side.id]
                return (
                <div
                  key={side.id}
                  className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all"
                >
                  {sideImage && (
                  <div className="relative h-48 overflow-hidden">
                    <Image
                      src={sideImage}
                      alt={side.name}
                      fill
                      className="object-cover hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  </div>
                  )}
                  <div className="p-4">
                    <h3 className="text-lg font-bold mb-1">{side.name}</h3>
                    <p className="text-gray-600 text-sm mb-3">{side.description}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-amber-600">${side.price}</span>
                      <Button asChild size="sm" variant="outline">
                        {isMobile ? (
                          <a
                            href={`sms:${phone.sms.e164}?body=Hi! I'd like to order ${side.name} for my hibachi catering. Please contact me for details.`}
                          >
                            Order via SMS
                          </a>
                        ) : (
                          <Link href="/book">Add to Order</Link>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )})}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
