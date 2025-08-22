"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function FountainValleyServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Fountain Valley"
      region="Orange County"
      description="Where meaningful moments deserve extraordinary celebrations - hibachi at home experiences that create lasting memories in Orange County's fountain valley community."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues","Family Residences"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="When the Garcia family's youngest daughter graduated from nursing school during the pandemic, they couldn't celebrate properly with extended family. They'd watched her sacrifice social events, work double shifts, and push through exhaustion to achieve her dream of helping others. A simple dinner felt inadequate for someone who'd given so much during such difficult times. The hibachi at home experience in their Fountain Valley home became a tribute to resilience. As our chef performed with healing flames, three generations gathered to honor not just a degree, but a calling. When the chef presented her with a heart-shaped dish and called her a 'healing hero,' tears flowed freely. This wasn't just about graduation - it was about recognizing that some people are born to serve, and they deserve to be celebrated for choosing to make the world better."
      nearbyCities={["Costa Mesa","Huntington Beach","Westminster","Garden Grove","Santa Ana"]}
    />
  )
}