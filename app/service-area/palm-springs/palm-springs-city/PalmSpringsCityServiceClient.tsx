"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"
import { getPalmSpringsCityBySlug } from "@/config/palm-springs-cities"

export default function PalmSpringsCityServiceClient() {
  const cityData = getPalmSpringsCityBySlug("palm-springs-city")
  
  if (!cityData) {
    return <div>City not found</div>
  }

  return (
    <CityServiceTemplate
      cityName={cityData.name}
      region="Palm Springs"
      description="World-famous desert resort destination with iconic mid-century modern architecture, offering professional hibachi at home service for celebrity retreats and luxury celebrations."
      zipCodes={cityData.zipCodes}
      neighborhoods={cityData.neighborhoods}
      popularVenues={cityData.popularVenues}
      cityHighlights={cityData.highlights}
      storyContent={cityData.story}
      nearbyCities={cityData.nearbyCities}
    />
  )
}



