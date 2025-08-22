"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function EscondidoServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Escondido"
      region="San Diego County"
      description="Hidden valley charm meets authentic Japanese tradition - hibachi at home experiences where diverse cultures blend in beautiful harmony."
      zipCodes={["92025", "92026", "92027", "92029", "92030", "92033", "92046"]}
      neighborhoods={["Downtown Escondido", "Hidden Meadows", "San Pasqual Valley", "Bear Valley", "Harmony Grove"]}
      popularVenues={["Ranch Properties", "Suburban Homes", "Valley Communities", "Rural Estates"]}
      cityHighlights={[
        "Hidden valley community with rural charm",
        "Rich agricultural heritage and wine country",
        "Beautiful parks and outdoor recreation",
        "Growing arts scene and cultural events"
      ]}
      storyContent="Maria's quinceañera was approaching, and her family wanted to honor both their Mexican heritage and their new life in America. In their Escondido home surrounded by hills and gardens, our hibachi chef created a unique fusion celebration. The theatrical Japanese cooking style perfectly complemented the festive spirit of quinceañera tradition. As family from both sides of the border gathered around the hibachi grill, cultures blended in beautiful harmony. This hibachi at home experience embodied Escondido's character - where diverse traditions create something uniquely American."
      nearbyCities={["Vista", "San Marcos", "Poway", "Rancho Bernardo"]}
    />
  )
}

