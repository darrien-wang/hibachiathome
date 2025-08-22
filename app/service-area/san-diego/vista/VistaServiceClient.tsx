"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function VistaServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Vista"
      region="San Diego County"
      description="Community spirit meets authentic Japanese tradition - hibachi at home experiences that celebrate family values and American dreams in Vista's welcoming neighborhoods."
      zipCodes={["92081", "92083", "92084", "92085"]}
      neighborhoods={["Downtown Vista", "Shadowridge", "Rancho Minerva", "Alta Vista", "Buena Creek"]}
      popularVenues={["Family Homes", "Community Centers", "Suburban Neighborhoods", "Vista Village"]}
      cityHighlights={[
        "Diverse community with strong family values",
        "Beautiful rolling hills and suburban charm",
        "Growing downtown area with local businesses",
        "Close-knit neighborhoods and community spirit"
      ]}
      storyContent="The Rodriguez family had just bought their first home in Vista after years of saving and dreaming. They wanted to celebrate this milestone with extended family, but restaurant reservations for 20 people seemed impossible. Our hibachi at home experience transformed their new backyard into a stage for joy and gratitude. As our chef performed, aunts, uncles, cousins, and grandparents all gathered around the sizzling grill, sharing stories of hard work and American dreams. This celebration perfectly captured Vista's spirit - where families grow roots and dreams come true."
      nearbyCities={["Oceanside", "Carlsbad", "San Marcos", "Escondido"]}
    />
  )
}

