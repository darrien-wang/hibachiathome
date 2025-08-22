"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function GardenGroveServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Garden Grove"
      region="Orange County"
      description="Where meaningful moments deserve extraordinary celebrations - hibachi at home experiences that create lasting memories in Orange County's garden grove community."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues","Family Residences"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="When teenage Miguel came out to his traditional Mexican family, his parents struggled - not with rejection, but with worry about a world that might not accept their son. His quinceañera sister suggested they throw him his own celebration, a 'quinceañero' to show their love and support. The hibachi at home experience in their Garden Grove home became a beautiful fusion of cultures and acceptance. As our chef performed, the extended family rallied around Miguel with cheers in both Spanish and English. The chef, sensing the special energy, dedicated extra flourishes to the guest of honor. When Miguel's father stood up and toasted his son's courage to be authentic, there wasn't a dry eye around the grill. This wasn't just a hibachi party - it was a family declaring that love has no conditions, and their son would always have a safe place to call home."
      nearbyCities={["Westminster","Fountain Valley","Santa Ana","Anaheim","Cypress"]}
    />
  )
}