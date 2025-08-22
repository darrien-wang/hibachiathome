"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function ElCajonServiceClient() {
  return (
    <CityServiceTemplate
      cityName="El Cajon"
      region="San Diego County"
      description="Western heritage meets authentic Japanese tradition - hibachi at home experiences where family values and community service create strong foundations for life."
      zipCodes={["92019", "92020", "92021"]}
      neighborhoods={["Downtown El Cajon", "Fletcher Hills", "Bostonia", "Granite Hills"]}
      popularVenues={["Suburban Homes", "Family Communities", "Commercial Districts", "Historic Neighborhoods"]}
      cityHighlights={[
        "Valley community with rich Western heritage",
        "Family-friendly neighborhoods and parks",
        "Growing downtown area with local businesses",
        "Close to outdoor recreation and hiking trails"
      ]}
      storyContent="When the Williams family celebrated their son's Eagle Scout achievement, they wanted a ceremony that honored years of dedication and community service. At their El Cajon home, our hibachi chef created a celebration that brought together scout leaders, family, and fellow scouts. The precise cooking techniques reminded everyone of the attention to detail and commitment that defines the scouting journey. This hibachi at home experience reflected El Cajon's spirit - where hard work, family values, and community service create strong foundations for life."
      nearbyCities={["La Mesa", "Santee", "Rancho San Diego", "Bonita"]}
    />
  )
}
