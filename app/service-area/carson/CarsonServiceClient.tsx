"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function CarsonServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Carson"
      region="California"
      description="Family-oriented hibachi service in suburban Carson, perfect for community celebrations and family gatherings."
      zipCodes={["90745","90746","90747","90810"]}
      neighborhoods={["West Carson","Carson Park","Dominguez Hills area","Harbor area"]}
      popularVenues={["Family Homes","Community Centers","Sports Complexes","Suburban Event Venues"]}
      cityHighlights={["Diverse suburban community","Home to major sports venues and events","Family-friendly neighborhoods and parks","Strong community spirit and local pride"]}
      storyContent="At a large Carson family gathering with multiple generations, we created a hibachi at home experience that brought everyone together around our cooking station. Our private chef's family-friendly approach delighted children while satisfying adults' sophisticated tastes. The hibachi party became the centerpiece of their reunion, creating lasting memories. This private birthday hibachi party exemplified Carson's strong family values and community spirit."
      nearbyCities={["Gardena","Torrance","Long Beach","Compton"]}
    />
  )
}