"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function PlacentiaServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Placentia"
      region="Orange County"
      description="Where meaningful moments deserve extraordinary celebrations - hibachi at home experiences that create lasting memories in Orange County's placentia community."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues","Family Residences"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="When high school sweethearts Tom and Lisa celebrated their 50th anniversary, their children wanted to create something that would capture five decades of love, laughter, and partnership. They'd weathered job losses, raised three kids, nursed each other through illness, and somehow still held hands during movies. The hibachi at home experience in their Placentia home became a love story told in flames. As our chef performed, family members shared favorite memories of the couple, creating an impromptu roast that had everyone in tears from laughter. When the chef asked for the secret to lasting love, Tom looked at Lisa and said, 'choose each other every day, and never stop being surprised by how wonderful they are.' This private anniversary hibachi party didn't just celebrate their past - it reminded everyone that true love isn't a fairy tale ending, it's a daily choice to keep writing the story together."
      nearbyCities={["Fullerton","Brea","Anaheim","Yorba Linda","Orange"]}
    />
  )
}