"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"
import { getPalmSpringsCityBySlug } from "@/config/palm-springs-cities"

export default function LaQuintaServiceClient() {
  const cityData = getPalmSpringsCityBySlug("la-quinta")
  
  if (!cityData) {
    return <div>City not found</div>
  }

  return (
    <CityServiceTemplate
      cityName={cityData.name}
      region="Palm Springs"
      description="Home to prestigious PGA West golf courses with beautiful mountain views and luxury resort destinations, offering professional hibachi at home service for Masters qualifications and golfing achievements."
      zipCodes={cityData.zipCodes}
      neighborhoods={cityData.neighborhoods}
      popularVenues={cityData.popularVenues}
      cityHighlights={cityData.highlights}
      storyContent={cityData.story}
      nearbyCities={cityData.nearbyCities}
    />
  )
}





