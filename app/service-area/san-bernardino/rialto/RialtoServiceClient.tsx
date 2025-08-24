"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"
import { getSBCityBySlug } from "@/config/san-bernardino-cities"

export default function RialtoServiceClient() {
  const cityData = getSBCityBySlug("rialto")
  
  if (!cityData) {
    return <div>City not found</div>
  }

  return (
    <CityServiceTemplate
      cityName={cityData.name}
      region="San Bernardino County"
      description="Experience authentic hibachi at home in Rialto! Our professional Japanese teppanyaki chefs bring the excitement of hibachi grilling directly to your home, creating unforgettable dining experiences for families and celebrations."
      zipCodes={cityData.zipCodes}
      neighborhoods={cityData.neighborhoods}
      popularVenues={cityData.popularVenues}
      cityHighlights={cityData.highlights}
      storyContent={cityData.story}
      nearbyCities={cityData.nearbyCities}
    />
  )
}

