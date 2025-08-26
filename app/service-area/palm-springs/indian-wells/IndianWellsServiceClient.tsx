"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"
import { getPalmSpringsCityBySlug } from "@/config/palm-springs-cities"

export default function IndianWellsServiceClient() {
  const cityData = getPalmSpringsCityBySlug("indian-wells")
  
  if (!cityData) {
    return <div>City not found</div>
  }

  return (
    <CityServiceTemplate
      cityName={cityData.name}
      region="Palm Springs"
      description="Elite tennis tournament destination with ultra-exclusive residential community and world-renowned resorts, offering professional hibachi at home service for championship celebrations and athletic achievements."
      zipCodes={cityData.zipCodes}
      neighborhoods={cityData.neighborhoods}
      popularVenues={cityData.popularVenues}
      cityHighlights={cityData.highlights}
      storyContent={cityData.story}
      nearbyCities={cityData.nearbyCities}
    />
  )
}









