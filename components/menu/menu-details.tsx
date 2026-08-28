"use client"

import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { getMenuImageById } from "@/config/images"

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
              // Map protein IDs to their specific image URLs
              const proteinImageMap = {
                chicken:
                  "/images/menu/chicken-and-beef.jpg",
                shrimp:
                  "/images/menu/filet-chicken-shrimp.jpg",
                tofu: "/images/menu/hibachi-plate.png",
                scallops:
                  "/images/menu/hibachi-plate.png",
                salmon:
                  "/images/menu/hibachi-plate.png",
                steak:
                  "/images/menu/chicken-and-beef.jpg",
              }

              // Get the specific image URL or fall back to a default
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
              .map((protein) => (
                <div
                  key={protein.id}
                  className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all"
                >
                  <div className="relative h-48 overflow-hidden">
                    <Image
                      src={
                        protein.id === "lobster"
                          ? "/images/menu/hibachi-plate.png"
                          : protein.id === "scallops-premium"
                          ? "/images/menu/hibachi-plate.png"
                          : "/images/menu/hibachi-plate.png"
                      } // Premium protein image
                      alt={protein.name}
                      fill
                      className="object-cover hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-bold mb-1">{protein.name}</h3>
                    <p className="text-gray-600 text-sm mb-3">{protein.description}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-amber-600">${protein.price}</span>
                      <Button asChild size="sm" variant="outline">
                        {isMobile ? (
                          <a
                            href={`sms:2137707788?body=Hi! I'd like to order ${protein.name} for my hibachi catering. Please contact me for details.`}
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
              ))}
          </div>
        </TabsContent>

        <TabsContent value="sides" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sides
              .filter((side) => side.id !== "soup")
              .map((side) => (
                <div
                  key={side.id}
                  className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all"
                >
                  <div className="relative h-48 overflow-hidden">
                    <Image
                      src={
                        side.id === "gyoza"
                          ? "/images/menu/hibachi-plate.png"
                          : side.id === "edamame"
                            ? "/images/menu/hibachi-plate.png"
                            : side.id === "noodles"
                              ? "/images/design-mode/fried-rice.jpg"
                              : getMenuImageById("steak-shrimp") || "/placeholder.svg"
                      }
                      alt={side.name}
                      fill
                      className="object-cover hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-bold mb-1">{side.name}</h3>
                    <p className="text-gray-600 text-sm mb-3">{side.description}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-amber-600">${side.price}</span>
                      <Button asChild size="sm" variant="outline">
                        {isMobile ? (
                          <a
                            href={`sms:2137707788?body=Hi! I'd like to order ${side.name} for my hibachi catering. Please contact me for details.`}
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
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
