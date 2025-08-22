"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function OceansideServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Oceanside"
      region="San Diego County"
      description="Military heritage meets authentic Japanese tradition - hibachi at home experiences that honor service and family in Oceanside's coastal community."
      zipCodes={["92049", "92051", "92052", "92054", "92056", "92057", "92058"]}
      neighborhoods={["Downtown Oceanside", "South Oceanside", "Fire Mountain", "Morro Hills", "Ranch Creek"]}
      popularVenues={["Beachfront Homes", "Military Housing", "Family Communities", "Historic Neighborhoods"]}
      cityHighlights={[
        "Beautiful sandy beaches and iconic wooden pier",
        "Rich military heritage with Camp Pendleton nearby",
        "Growing arts district and craft beer scene", 
        "Family-friendly community with affordable living"
      ]}
      storyContent="Sergeant Thompson was being promoted after 15 years of dedicated service, and his family wanted to create a celebration worthy of his sacrifice. In their Oceanside home near the base, our hibachi chef created an experience that honored both military tradition and family bonds. As the chef performed with precision and discipline, it reminded everyone of the values that define military families. This hibachi at home party became more than a promotion celebration - it was a tribute to service, dedication, and the strength of military communities in Oceanside."
      nearbyCities={["Carlsbad", "Vista", "San Marcos", "Camp Pendleton"]}
    />
  )
}

