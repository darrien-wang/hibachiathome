"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"
import { getRiversideCityBySlug } from "@/config/riverside-cities"

export default function RiversideCityServiceClient() {
  const cityData = getRiversideCityBySlug("riverside-city")
  
  if (!cityData) {
    return <div>City not found</div>
  }

  return (
    <CityServiceTemplate
      cityName={cityData.name}
      region="Riverside County"
      description="Historic citrus capital with University of California Riverside, offering professional hibachi at home service for academic celebrations and family gatherings."
      zipCodes={cityData.zipCodes}
      neighborhoods={cityData.neighborhoods}
      popularVenues={cityData.popularVenues}
      cityHighlights={cityData.highlights}
      storyContent={cityData.story}
      nearbyCities={cityData.nearbyCities}
    />
  )
}




