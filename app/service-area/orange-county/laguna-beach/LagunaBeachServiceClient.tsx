"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function LagunaBeachServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Laguna Beach"
      region="Orange County"
      description="Premium hibachi at home experiences in laguna beach, bringing authentic Japanese tradition to your Orange County celebration."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="When artist Maya sold her first major painting after years of struggle, she realized she'd been living in survival mode so long that she'd forgotten how to celebrate her wins. Her partner suggested dinner out, but Maya craved something more intentional - a moment to pause and acknowledge that her dreams weren't naive, they were finally real. The hibachi at home experience in their Laguna Beach cottage became an art performance of its own. As our chef created flames and flavors, Maya saw her own creative process reflected - the patience, the precision, the moment when separate elements become something beautiful. Her artist friends gathered around the grill, sharing stories of their own breakthroughs and setbacks, bonding over the universal truth that creating anything meaningful requires faith in the invisible. When the chef presented her with a dish arranged like a palette of colors, Maya felt seen not just as a customer, but as a creator. Sometimes you need to celebrate not just what you've achieved, but who you've become in the process."
      nearbyCities={["Dana Point","Aliso Viejo","Laguna Hills","Newport Beach","Mission Viejo"]}
    />
  )
}