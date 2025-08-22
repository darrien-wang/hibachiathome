"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function BellflowerServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Bellflower"
      region="California"
      description="Neighborhood hibachi service in close-knit Bellflower, bringing people together through authentic Japanese cuisine."
      zipCodes={["90706"]}
      neighborhoods={["Downtown Bellflower","Lakewood border","Artesia border","Paramount border"]}
      popularVenues={["Family Homes","Community Centers","Local Gathering Spaces","Neighborhood Venues"]}
      cityHighlights={["Close-knit suburban community","Diverse residential neighborhoods","Family-friendly atmosphere","Growing local business district"]}
      storyContent="In Bellflower's close-knit neighborhood, we created a hibachi at home experience that felt like a family gathering. Our private chef's warm, personal approach won over this tight community where everyone knows each other. The hibachi party had neighbors dropping by to see what smelled so amazing! This private birthday hibachi party became the kind of local legend that makes small communities special."
      nearbyCities={["Cerritos","Lakewood","Norwalk","Downey"]}
    />
  )
}