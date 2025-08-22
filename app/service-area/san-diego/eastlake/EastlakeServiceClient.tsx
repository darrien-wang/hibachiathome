"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function EastlakeServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Eastlake"
      region="San Diego County"
      description="Family dreams meet authentic Japanese tradition - hibachi at home experiences in premier master-planned communities where dreams and community spirit create beautiful celebrations."
      zipCodes={["91913", "91915"]}
      neighborhoods={["Eastlake Village", "Eastlake Greens", "Eastlake Woods", "Eastlake Trails"]}
      popularVenues={["Master-planned Communities", "Golf Course Homes", "Family Properties", "New Developments"]}
      cityHighlights={[
        "Premier master-planned community in Chula Vista",
        "Beautiful lakes and recreational facilities",
        "Top-rated schools and family amenities",
        "Modern suburban lifestyle"
      ]}
      storyContent="The Johnson family had dreamed of living in Eastlake since moving to San Diego, and when they finally bought their home overlooking the lake, it was time to celebrate. Our hibachi chef transformed their new backyard into a stage for family joy as neighbors welcomed them to the community. The theatrical performance brought together old friends and new neighbors, creating connections that would last for years. This hibachi at home experience captured Eastlake's essence - where family dreams meet community spirit."
      nearbyCities={["Chula Vista", "Otay Ranch", "Bonita", "San Diego"]}
    />
  )
}
