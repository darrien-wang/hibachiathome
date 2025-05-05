"use client"

import { useState } from "react"
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

  return (
    <div className="mb-16">
      <h2 className="text-3xl font-bold text-center mb-8">Menu Details</h2>

      <Tabs defaultValue="proteins" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="proteins">Regular Proteins</TabsTrigger>
          <TabsTrigger value="premium">Premium Proteins</TabsTrigger>
          <TabsTrigger value="sides">Sides & Appetizers</TabsTrigger>
        </TabsList>

        <TabsContent value="proteins" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {proteins.map((protein) => {
              // Map protein IDs to their specific image URLs
              const proteinImageMap = {
                chicken:
                  "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/menu-side/Benihana-Chicken-Copycat-1-683x1024-qvNitJQ5mMHcmjzwHcRriIWROECxU6.jpg",
                shrimp:
                  "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/menu-side/Hibachi-Shrimp-3-kVLM2utoEN7thpJbPBicfUta8mrvac.jpg",
                tofu: "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/menu-side/Teriyaki-Tofu-Steps-10-460x460-Agvw3gs0zb0hnbpJFawG6qDFNoU59a.jpg",
                scallops:
                  "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/menu-side/benihana-hibachi-scallops-n4M84f7dlGvTfIRetEp2wYqy8zd1kk.jpeg",
                salmon:
                  "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/menu-side/grill-blackstone-hibachi-salmon-16-1024x683-I9oX7ZwRDEmyXa8sBQBlDMQWcocdks.webp",
                steak:
                  "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/menu-side/hibachisteak-J0gZFIRapQe3u0oATa5thRAs3lmEAa.jpg",
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
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-amber-600">${protein.price}</span>
                      <Button asChild size="sm" variant="outline">
                        <Link href="/book">Add to Order</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="premium" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {premiumProteins
              .filter((protein) => protein.id === "filet" || protein.id === "lobster")
              .map((protein) => (
                <div
                  key={protein.id}
                  className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all"
                >
                  <div className="relative h-48 overflow-hidden">
                    <Image
                      src={
                        protein.id === "lobster"
                          ? "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/menu-side/36996-Grilled-Rock-Lobsters-109-4x3-fb4e7e3c2ea34a5b8de9caf3697ed5b9-7CrqVYQUItKQGGwjfc7i4AJqkIxNOP.jpg"
                          : "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/menu-side/istockphoto-844731188-612x612-ZN07NpCqj0LP0BrtajkCjMbPDip5dT.jpg"
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
                        <Link href="/book">Add to Order</Link>
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
                          ? "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/menu-side/handmade-gyoza-feat-zw3iQhdGEyIwMmLRuEsLVQYGdaPz1w.jpg"
                          : side.id === "edamame"
                            ? "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/menu-side/SideDish_1024_Edamame-recipe-image-768x588-PRUQpdoeHxQ4b7gNYb5c9Cvav5s8a1.webp"
                            : side.id === "noodles"
                              ? "https://pr65kebnwwqnqr8l.public.blob.vercel-storage.com/hibachiimage/menu-side/Oil-Free-Hibachi-Noodles_13-ofABNWwAG0GPRFDWbsTP3bfphCsFf0.jpg"
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
                        <Link href="/book">Add to Order</Link>
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
