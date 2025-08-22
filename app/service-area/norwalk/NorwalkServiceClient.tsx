"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function NorwalkServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Norwalk"
      region="California"
      description="Welcoming hibachi service in diverse Norwalk, bringing authentic flavors to this vibrant community."
      zipCodes={["90650"]}
      neighborhoods={["Downtown Norwalk","Norwalk Square area","Santa Fe Springs border","Cerritos border"]}
      popularVenues={["Family Homes","Community Centers","Cultural Venues","Local Event Spaces"]}
      cityHighlights={["Diverse suburban community","Family-oriented neighborhoods","Growing arts and cultural scene","Strong community programs and local events"]}
      storyContent="At a Norwalk community center gathering, we brought hibachi at home excitement to a neighborhood celebration. Our private chef's engaging personality matched the city's friendly, welcoming spirit. The hibachi party brought together families from throughout the community, creating new friendships over delicious food. This private birthday hibachi party demonstrated how shared meals strengthen community bonds."
      nearbyCities={["Cerritos","Downey","Whittier","Bellflower","La Mirada"]}
    />
  )
}