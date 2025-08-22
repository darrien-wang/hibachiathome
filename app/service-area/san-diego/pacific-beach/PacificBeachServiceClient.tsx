"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function PacificBeachServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Pacific Beach"
      region="San Diego County"
      description="Youthful energy meets authentic Japanese tradition - hibachi at home experiences where vibrant beach culture and endless possibilities create unforgettable celebrations."
      zipCodes={["92109"]}
      neighborhoods={["Pacific Beach Proper", "North Pacific Beach", "Crown Point", "Mission Bay"]}
      popularVenues={["Beach Houses", "Coastal Condos", "Party Venues", "Boardwalk Properties"]}
      cityHighlights={[
        "Vibrant nightlife and beach party scene",
        "Young professional and college community",
        "Famous Crystal Pier and beach activities",
        "Energetic coastal lifestyle"
      ]}
      storyContent="When marketing executive Lisa turned 30, she wanted a celebration that captured the energy of Pacific Beach life. Our hibachi chef set up on her rooftop deck overlooking the pier as friends from college, work, and the local community gathered. The interactive performance got everyone involved, just like the collaborative spirit that defines PB. This hibachi at home party reflected Pacific Beach's vibe - where youthful energy meets endless possibilities."
      nearbyCities={["Mission Beach", "La Jolla", "San Diego", "Mission Bay"]}
    />
  )
}
