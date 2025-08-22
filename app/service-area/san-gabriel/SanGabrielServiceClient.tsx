"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function SanGabrielServiceClient() {
  return (
    <CityServiceTemplate
      cityName="San Gabriel"
      region="California"
      description="Authentic Asian fusion hibachi in San Gabriel, honoring the area's rich Asian heritage and culture."
      zipCodes={["91775","91776"]}
      neighborhoods={["San Gabriel Square","Mission District","Temple City border","Rosemead border"]}
      popularVenues={["Asian Community Centers","Cultural Venues","Family Homes","Community Gathering Spaces"]}
      cityHighlights={["Rich Mission heritage and California history","Large Asian community with authentic cuisine","Historic San Gabriel Mission","Cultural diversity and traditional festivals"]}
      storyContent="At a San Gabriel family celebration, we created a unique hibachi at home fusion experience honoring both Japanese and Chinese culinary traditions. Our private chef delighted guests by incorporating local Asian market ingredients into classic teppanyaki dishes. The hibachi party became a beautiful cultural bridge, celebrating the area's rich heritage. This private birthday hibachi party proved that great food transcends cultural boundaries."
      nearbyCities={["Alhambra","Monterey Park","Arcadia","Rosemead","Temple City"]}
    />
  )
}