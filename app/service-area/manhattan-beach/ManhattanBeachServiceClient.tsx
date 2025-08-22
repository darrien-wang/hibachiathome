"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function ManhattanBeachServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Manhattan Beach"
      region="California"
      description="Upscale beachside hibachi service in Manhattan Beach, bringing premium dining to luxury coastal homes."
      zipCodes={["90266"]}
      neighborhoods={["The Strand","Manhattan Village","Sand Section","Hill Section","Tree Section"]}
      popularVenues={["Beachfront Mansions","Luxury Beach Houses","Strand Properties","Private Beach Clubs"]}
      cityHighlights={["Upscale beachfront community with luxury homes","Famous for beach volleyball and surfing culture","Beautiful wide sandy beaches and ocean views","Family-friendly residential neighborhoods"]}
      storyContent="On The Strand with million-dollar ocean views, we delivered an upscale hibachi at home experience for the Thompson family reunion. Our private chef prepared fresh lobster and wagyu beef while beach volleyball players practiced nearby. This exclusive hibachi party showcased why Manhattan Beach is perfect for luxury celebrations. The private birthday hibachi party atmosphere matched the sophisticated beachfront community perfectly."
      nearbyCities={["Hermosa Beach","Redondo Beach","El Segundo","Santa Monica","Torrance"]}
    />
  )
}