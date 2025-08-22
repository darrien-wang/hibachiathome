"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function AlhambraServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Alhambra"
      region="California"
      description="Culturally rich hibachi experience in Alhambra, celebrating diversity through authentic Japanese cuisine."
      zipCodes={["91801","91802","91803"]}
      neighborhoods={["Downtown Alhambra","Monterey Park border","South Pasadena area","San Gabriel border"]}
      popularVenues={["Cultural Centers","Multi-generational Homes","Community Spaces","Cultural Event Venues"]}
      cityHighlights={["Diverse multicultural community","Strong Asian community with authentic restaurants","Historic neighborhoods with Craftsman homes","Central location with easy access to downtown LA"]}
      storyContent="In Alhambra's diverse community, our hibachi at home service brought together families from different backgrounds for a heartwarming celebration. The private chef's entertaining cooking style delighted children while impressing adults from various cultures. This hibachi party showcased how food creates universal joy and connection. The private birthday hibachi party became a neighborhood legend, with requests for repeat performances."
      nearbyCities={["San Gabriel","Monterey Park","Pasadena","Los Angeles","South Pasadena"]}
    />
  )
}