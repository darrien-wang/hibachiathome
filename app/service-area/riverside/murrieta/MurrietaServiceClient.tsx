"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"
import { getRiversideCityBySlug } from "@/config/riverside-cities"

export default function MurrietaServiceClient() {
  const cityData = getRiversideCityBySlug("murrieta")
  
  if (!cityData) {
    return <div>City not found</div>
  }

  return (
    <CityServiceTemplate
      cityName={cityData.name}
      region="Riverside County"
      description="Master-planned community with excellent schools and family-oriented neighborhoods, offering professional hibachi at home service for graduation celebrations and family gatherings."
      zipCodes={cityData.zipCodes}
      neighborhoods={cityData.neighborhoods}
      popularVenues={cityData.popularVenues}
      cityHighlights={cityData.highlights}
      storyContent={cityData.story}
      nearbyCities={cityData.nearbyCities}
    />
  )
}




