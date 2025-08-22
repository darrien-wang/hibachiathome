"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function VeniceServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Venice"
      region="California"
      description="Bohemian hibachi experience in artistic Venice, bringing Japanese flair to this creative coastal community."
      zipCodes={["90291","90292"]}
      neighborhoods={["Venice Beach","Abbot Kinney","Rose Avenue","Marina Peninsula"]}
      popularVenues={["Artistic Lofts","Beach Properties","Creative Spaces","Canal-side Homes"]}
      cityHighlights={["Bohemian arts community and creative culture","Famous Venice Beach boardwalk and street performers","Unique canal neighborhoods and artistic murals","Vibrant street art and graffiti scene"]}
      storyContent="In a converted warehouse loft near the Venice canals, we brought our hibachi at home magic to an eclectic group of artists and surfers. The private chef's performance fit perfectly with Venice's bohemian vibe. Local musicians played while we cooked, creating a unique hibachi party atmosphere. The private birthday hibachi party honoree, a street artist, said it was the most creative dining experience they'd ever had."
      nearbyCities={["Santa Monica","Marina del Rey","Culver City","El Segundo"]}
    />
  )
}