"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"
import { getPalmSpringsCityBySlug } from "@/config/palm-springs-cities"

export default function PalmDesertServiceClient() {
  const cityData = getPalmSpringsCityBySlug("palm-desert")
  
  if (!cityData) {
    return <div>City not found</div>
  }

  return (
    <CityServiceTemplate
      cityName={cityData.name}
      region="Palm Springs"
      description="Cultural and shopping capital of the desert with vibrant arts scene and prestigious golf tournaments, offering professional hibachi at home service for gallery openings and cultural celebrations."
      zipCodes={cityData.zipCodes}
      neighborhoods={cityData.neighborhoods}
      popularVenues={cityData.popularVenues}
      cityHighlights={cityData.highlights}
      storyContent={cityData.story}
      nearbyCities={cityData.nearbyCities}
    />
  )
}





