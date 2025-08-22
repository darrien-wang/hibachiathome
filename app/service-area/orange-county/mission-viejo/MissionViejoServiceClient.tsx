"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function MissionViejoServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Mission Viejo"
      region="Orange County"
      description="Premium hibachi at home experiences in mission viejo, bringing authentic Japanese tradition to your Orange County celebration."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="After Jake's cancer treatment ended, his family struggled with how to celebrate. The word 'remission' felt too clinical, 'survivor' felt too dramatic, but 'grateful' - that felt right. They wanted a celebration that honored the fight without dwelling on the fear, that welcomed the future without forgetting the journey. The hibachi at home experience in their Mission Viejo home became a ritual of renewal. As our chef created flames that danced and disappeared, Jake saw a metaphor for his own resilience - moments of intensity followed by calm, beauty emerging from heat and pressure. His teenage kids, who'd been so serious for so long, erupted in genuine laughter for the first time in months. When the chef presented Jake with a heart-shaped portion of food and said 'to new beginnings,' the family understood: this wasn't just about surviving cancer - it was about choosing to thrive. Some victories require a celebration as vibrant as your will to live."
      nearbyCities={["Lake Forest","Laguna Hills","Aliso Viejo","Rancho Santa Margarita","Tustin"]}
    />
  )
}