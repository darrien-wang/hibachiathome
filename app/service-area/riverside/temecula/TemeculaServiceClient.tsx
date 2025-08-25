"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"
import { getRiversideCityBySlug } from "@/config/riverside-cities"

export default function TemeculaServiceClient() {
  const cityData = getRiversideCityBySlug("temecula")
  
  if (!cityData) {
    return <div>City not found</div>
  }

  return (
    <CityServiceTemplate
      cityName={cityData.name}
      region="Riverside County"
      description="Famous wine country with beautiful vineyards and historic Old Town, offering professional hibachi at home service for wine country celebrations and sophisticated gatherings."
      zipCodes={cityData.zipCodes}
      neighborhoods={cityData.neighborhoods}
      popularVenues={cityData.popularVenues}
      cityHighlights={cityData.highlights}
      storyContent={cityData.story}
      nearbyCities={cityData.nearbyCities}
    />
  )
}




