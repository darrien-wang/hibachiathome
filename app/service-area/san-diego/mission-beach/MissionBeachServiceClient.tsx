"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function MissionBeachServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Mission Beach"
      region="San Diego County"
      description="California beach culture meets authentic Japanese tradition - hibachi at home experiences where beach culture meets community spirit in endless summer celebrations."
      zipCodes={["92109"]}
      neighborhoods={["Mission Beach Boardwalk", "Belmont Park", "Ocean Front Walk", "Mission Bay"]}
      popularVenues={["Beach Rentals", "Boardwalk Properties", "Vacation Homes", "Seaside Condos"]}
      cityHighlights={[
        "Classic California beach town atmosphere",
        "Famous boardwalk and Belmont Park amusement",
        "Water sports and beach activities",
        "Laid-back coastal lifestyle"
      ]}
      storyContent="Jake's surf shop was celebrating 15 years on the boardwalk, and he wanted to thank the community that supported his dream. Our hibachi chef set up on the deck of his Mission Beach rental as surfers, locals, and tourists gathered to celebrate. The sound of waves and the Belmont Park roller coaster provided the perfect soundtrack as the chef performed against the backdrop of endless summer. This hibachi at home experience embodied Mission Beach's soul - where beach culture meets community spirit."
      nearbyCities={["Pacific Beach", "San Diego", "Ocean Beach", "Mission Bay"]}
    />
  )
}
