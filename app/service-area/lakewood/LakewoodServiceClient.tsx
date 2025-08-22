"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function LakewoodServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Lakewood"
      region="California"
      description="Suburban hibachi service in family-friendly Lakewood, bringing restaurant-quality dining to your neighborhood home."
      zipCodes={["90712","90713"]}
      neighborhoods={["Lakewood Village","Lakewood Park","Mayfair area","Long Beach border"]}
      popularVenues={["Residential Homes","Community Centers","Family-friendly Venues","Neighborhood Spaces"]}
      cityHighlights={["Family-oriented suburban community","Well-planned neighborhoods with parks","Strong schools and community programs","Safe, residential atmosphere"]}
      storyContent="In Lakewood's planned community, we delivered a hibachi at home experience that matched the neighborhood's family-focused values. Our private chef's wholesome approach and interactive cooking delighted parents and children alike. The hibachi party became the talk of the subdivision, with neighbors asking for referrals. This private birthday hibachi party showcased why Lakewood families choose experiences that bring people together."
      nearbyCities={["Long Beach","Cerritos","Bellflower","Norwalk","Carson"]}
    />
  )
}