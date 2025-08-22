"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function HermosaBeachServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Hermosa Beach"
      region="California"
      description="Fun and energetic hibachi service in party-loving Hermosa Beach, perfect for celebrations."
      zipCodes={["90254"]}
      neighborhoods={["The Strand","Hermosa Valley","North Hermosa","South Hermosa"]}
      popularVenues={["Beach Condos","Party Houses","Beachfront Properties","Group Vacation Rentals"]}
      cityHighlights={["Vibrant nightlife and beach party atmosphere","Popular destination for young professionals","Active beach volleyball and surfing scene","Lively pier and beachfront dining"]}
      storyContent="During a lively Hermosa Beach house party, our hibachi at home service brought restaurant-quality entertainment to a group of young professionals. The private chef's fire tricks energized the party crowd, and the hibachi party vibe matched Hermosa's legendary nightlife scene. This private birthday hibachi party had guests dancing between courses, creating the ultimate beach town celebration experience."
      nearbyCities={["Manhattan Beach","Redondo Beach","Torrance","El Segundo"]}
    />
  )
}