"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"
import { getPalmSpringsCityBySlug } from "@/config/palm-springs-cities"

export default function IndioServiceClient() {
  const cityData = getPalmSpringsCityBySlug("indio")
  
  if (!cityData) {
    return <div>City not found</div>
  }

  return (
    <CityServiceTemplate
      cityName={cityData.name}
      region="Palm Springs"
      description="Home to world-famous Coachella Music Festival with rich agricultural heritage and growing cultural scene, offering professional hibachi at home service for Grammy celebrations and music industry gatherings."
      zipCodes={cityData.zipCodes}
      neighborhoods={cityData.neighborhoods}
      popularVenues={cityData.popularVenues}
      cityHighlights={cityData.highlights}
      storyContent={cityData.story}
      nearbyCities={cityData.nearbyCities}
    />
  )
}





