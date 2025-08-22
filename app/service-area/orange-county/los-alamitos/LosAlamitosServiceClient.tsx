"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function LosAlamitosServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Los Alamitos"
      region="Orange County"
      description="Where meaningful moments deserve extraordinary celebrations - hibachi at home experiences that create lasting memories in Orange County's los alamitos community."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues","Family Residences"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="When military wife Sarah's husband returned from his third deployment, their family faced an unexpected challenge: how do you reconnect after months of separate lives? Their kids had grown, she'd learned independence, and he felt like a guest in his own home. The hibachi at home experience in their Los Alamitos home became their bridge back to each other. As our chef performed, the structured entertainment gave them a shared focus while allowing natural conversation to flow. Their children, initially shy around their father, gradually warmed up as they all laughed at the same tricks and shared the excitement of the performance. When the chef thanked him for his service and asked about his experiences, the family heard stories they'd never heard before. This hibachi party didn't just welcome him home - it helped them remember they were a team, and home wasn't a place but the people who choose to build it together."
      nearbyCities={["Cypress","Seal Beach","Garden Grove","Westminster","Long Beach"]}
    />
  )
}