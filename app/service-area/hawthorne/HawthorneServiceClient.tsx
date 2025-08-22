"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function HawthorneServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Hawthorne"
      region="California"
      description="Neighborhood hibachi service in working-class Hawthorne, bringing affordable luxury to local families."
      zipCodes={["90250"]}
      neighborhoods={["Downtown Hawthorne","Del Aire border","Lawndale border","El Segundo area"]}
      popularVenues={["Family Homes","Community Centers","Local Event Spaces","Neighborhood Gatherings"]}
      cityHighlights={["Historic aviation and aerospace heritage","Diverse working-class community","Growing arts and cultural scene","Close to beaches and LAX airport"]}
      storyContent="In Hawthorne's aerospace community, we delivered a hibachi at home experience that impressed engineers and aviation professionals. Our private chef's precision cooking techniques resonated with their appreciation for technical excellence. The hibachi party combined entertainment with the methodical approach that Hawthorne's tech industry values. This private birthday hibachi party celebrated both innovation and tradition."
      nearbyCities={["Inglewood","El Segundo","Torrance","Gardena","Lawndale"]}
    />
  )
}