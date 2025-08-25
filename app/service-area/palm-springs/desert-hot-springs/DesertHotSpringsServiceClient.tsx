"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function DesertHotSpringsServiceClient() {
  const cityData = {
    name: "Desert Hot Springs",
    slug: "desert-hot-springs",
    zipCodes: ["92240", "92241"],
    neighborhoods: ["Two Bunch Palms", "Mission Lakes", "Desert Hot Springs Spa District", "North Desert Hot Springs"],
    popularVenues: ["Spa Resorts", "Hot Springs Hotels", "Wellness Retreats", "Vacation Rentals"],
    highlights: [
      "Famous natural hot springs and spa destination",
      "Wellness tourism and rejuvenation retreats",
      "Stunning mountain views and healing waters",
      "Growing luxury spa resort community"
    ],
    story: "When wellness entrepreneur Lisa booked her women's retreat at a luxury spa resort in Desert Hot Springs, she wanted to combine healing with celebration. After a day of natural hot springs therapy and mountain meditation, our hibachi chef arrived to create a spectacular dinner experience on the resort's mineral pool deck. As the therapeutic steam from the natural springs mingled with the aromatic sizzle of our teppanyaki performance, guests experienced the perfect harmony of Japanese culinary artistry and Desert Hot Springs' legendary healing waters. This hibachi at home experience captured the city's wellness essence - where ancient natural springs meet modern luxury and celebration.",
    nearbyCities: ["Palm Springs", "Cathedral City", "Whitewater", "Morongo Valley"]
  }

  return (
    <CityServiceTemplate
      cityName={cityData.name}
      region="Palm Springs"
      description="Famous natural hot springs and spa destination with stunning mountain views and growing wellness community, offering professional hibachi at home service for spa anniversaries and wellness retreat celebrations."
      zipCodes={cityData.zipCodes}
      neighborhoods={cityData.neighborhoods}
      popularVenues={cityData.popularVenues}
      cityHighlights={cityData.highlights}
      storyContent={cityData.story}
      nearbyCities={cityData.nearbyCities}
    />
  )
}




