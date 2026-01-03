"use client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Image from "next/image"
import { useRouter } from "next/navigation"

export function PromotionBanner() {
  const router = useRouter()

  // Update the promotion object to remove beef mentions
  const promotion = {
    id: "seasonal-menu",
    title: "Seasonal New Menu Item: Sea Urchin Fried Rice",
    description:
      "We're excited to introduce our new seasonal specialty: Sea Urchin Fried Rice. This premium dish features fresh sea urchin in our signature fried rice. To upgrade your package with this exclusive item, please contact our booking manager.",
    buttonText: "Contact Us",
    buttonLink: "/contact",
  }

  return (
    <div className="w-full max-w-5xl mx-auto mb-10">
      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 overflow-hidden">
        <div className="md:flex">
          <div className="md:w-2/3 p-6">
            <CardHeader className="pb-2 px-0">
              <div className="flex justify-between items-start">
                <CardTitle className="text-2xl font-bold text-amber-800">{promotion.title}</CardTitle>
                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
                  Seasonal Special
                </Badge>
              </div>
              <CardDescription className="text-amber-700">Available for a limited time this season</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <p className="text-lg text-amber-900">{promotion.description}</p>
            </CardContent>
        
          </div>
          <div className="md:w-1/3 relative h-48 md:h-auto">
            <Image
              src="/images/design-mode/fried-rice.jpg"
              alt="Sea Urchin Fried Rice"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
          </div>
        </div>
      </Card>
    </div>
  )
}
