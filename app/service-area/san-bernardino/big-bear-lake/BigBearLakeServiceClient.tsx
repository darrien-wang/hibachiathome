"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function BigBearLakeServiceClient() {
  const cityData = {
    name: "Big Bear Lake",
    slug: "big-bear-lake",
    zipCodes: ["92314", "92315", "92333"],
    neighborhoods: ["Big Bear Lake Village", "Big Bear City", "Fawnskin", "Sugarloaf", "Moonridge"],
    popularVenues: ["Mountain Cabins", "Vacation Rentals", "Ski Lodges", "Lakefront Properties"],
    highlights: [
      "Premier Southern California mountain resort destination",
      "Year-round outdoor recreation and vacation rentals",
      "Scenic lake views and mountain cabin atmosphere",
      "Popular ski destination and summer retreat"
    ],
    story: "When tech entrepreneur Michael planned his company retreat at a lakefront Big Bear cabin, he wanted something beyond the typical corporate dining experience. Our hibachi chef arrived with portable equipment perfectly suited for the mountain altitude, creating an unforgettable teppanyaki show on the cabin's spacious deck overlooking the pristine lake. As snow-capped peaks reflected in the water and the chef's flames danced against the mountain backdrop, the team experienced the perfect fusion of Japanese culinary artistry and California's most beloved mountain destination. This hibachi at home experience captured Big Bear's magic - where adventure meets luxury in the San Bernardino Mountains.",
    nearbyCities: ["Lake Arrowhead", "Running Springs", "Crestline", "San Bernardino"]
  }

  return (
    <CityServiceTemplate
      cityName={cityData.name}
      region="San Bernardino"
      description="Premier Southern California mountain resort destination with year-round recreation, offering professional hibachi at home service for vacation rental celebrations and mountain retreat gatherings."
      zipCodes={cityData.zipCodes}
      neighborhoods={cityData.neighborhoods}
      popularVenues={cityData.popularVenues}
      cityHighlights={cityData.highlights}
      storyContent={cityData.story}
      nearbyCities={cityData.nearbyCities}
    />
  )
}





