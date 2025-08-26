"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function IdyllwildServiceClient() {
  const cityData = {
    name: "Idyllwild",
    slug: "idyllwild",
    zipCodes: ["92549"],
    neighborhoods: ["Idyllwild Village", "Pine Cove", "Fern Valley", "Mountain Center"],
    popularVenues: ["Art Galleries", "Mountain Cabins", "Retreat Centers", "Artist Studios"],
    highlights: [
      "Charming mountain arts community and creative village",
      "Beautiful pine forests and scenic mountain setting",
      "Year-round arts festivals and cultural events",
      "Popular weekend retreat destination for artists"
    ],
    story: "When renowned sculptor David decided to celebrate his gallery opening in Idyllwild's arts district, he wanted an experience as creative as his mountain community. Our hibachi chef arrived at his stunning mountain studio, where towering pines created a natural cathedral and David's sculptures dotted the landscape. As our chef performed culinary artistry on the studio's outdoor deck, guests marveled at how the flames and sizzling sounds became part of the mountain's symphony. This hibachi at home experience captured Idyllwild's artistic spirit - where creativity flourishes in the San Jacinto Mountains and every gathering becomes a masterpiece of mountain hospitality.",
    nearbyCities: ["Mountain Center", "Anza", "Cabazon", "Desert Hot Springs"]
  }

  return (
    <CityServiceTemplate
      cityName={cityData.name}
      region="Riverside"
      description="Charming mountain arts community with beautiful pine forests and creative village atmosphere, offering professional hibachi at home service for artist gatherings and mountain retreat celebrations."
      zipCodes={cityData.zipCodes}
      neighborhoods={cityData.neighborhoods}
      popularVenues={cityData.popularVenues}
      cityHighlights={cityData.highlights}
      storyContent={cityData.story}
      nearbyCities={cityData.nearbyCities}
    />
  )
}





