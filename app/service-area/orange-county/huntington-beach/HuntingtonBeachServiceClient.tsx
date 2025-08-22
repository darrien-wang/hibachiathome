"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function HuntingtonBeachServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Huntington Beach"
      region="Orange County"
      description="Premium hibachi at home experiences in huntington beach, bringing authentic Japanese tradition to your Orange County celebration."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="Emma had been dreading her 40th birthday. Forty felt like a deadline she wasn't ready to meet - career transitions, kids growing up, dreams deferred. Her sister knew Emma needed more than a typical party; she needed to remember that life's best chapters might still be unwritten. The hibachi at home celebration in Emma's Huntington Beach home wasn't about the food - it was about reclaiming joy. As our chef juggled spatulas and created towering flames, Emma found herself laughing for the first time in months. Her friends shared stories of their own fears and triumphs, bonds deepening over the shared experience. When the chef presented Emma with a perfectly cooked meal shaped like a birthday cake, she realized this wasn't an ending - it was a beginning. Sometimes you need a moment that interrupts the ordinary to remember how extraordinary life can be."
      nearbyCities={["Costa Mesa","Newport Beach","Fountain Valley","Westminster","Seal Beach"]}
    />
  )
}