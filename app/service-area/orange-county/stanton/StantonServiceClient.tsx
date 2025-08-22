"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function StantonServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Stanton"
      region="Orange County"
      description="Where meaningful moments deserve extraordinary celebrations - hibachi at home experiences that create lasting memories in Orange County's stanton community."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues","Family Residences"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="When factory worker Luis finally saved enough to buy his first home after years of renting, his family understood this wasn't just about real estate - it was about dignity, stability, and the American dream made real through sacrifice and determination. The hibachi at home experience in their new Stanton home became a housewarming that honored the journey as much as the destination. As our chef performed in their very own kitchen, Luis kept touching the walls, still amazed that this space belonged to them. When neighbors came over to investigate the delicious smells and exciting sounds, they were welcomed into an impromptu block party that immediately made the family feel at home. This hibachi party didn't just celebrate homeownership - it marked the beginning of putting down roots and building community in a place they could finally call their own forever."
      nearbyCities={["Buena Park","Cypress","Garden Grove","Westminster","La Palma"]}
    />
  )
}