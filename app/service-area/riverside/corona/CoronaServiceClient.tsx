"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"
import { getRiversideCityBySlug } from "@/config/riverside-cities"

export default function CoronaServiceClient() {
  const cityData = getRiversideCityBySlug("corona")
  
  if (!cityData) {
    return <div>City not found</div>
  }

  return (
    <CityServiceTemplate
      cityName={cityData.name}
      region="Riverside County"
      description="Circle City with historic downtown charm and beautiful golf courses, offering professional hibachi at home service for business celebrations and family gatherings."
      zipCodes={cityData.zipCodes}
      neighborhoods={cityData.neighborhoods}
      popularVenues={cityData.popularVenues}
      cityHighlights={cityData.highlights}
      storyContent={cityData.story}
      nearbyCities={cityData.nearbyCities}
    />
  )
}




