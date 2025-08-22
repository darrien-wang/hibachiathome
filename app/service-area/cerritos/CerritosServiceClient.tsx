"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function CerritosServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Cerritos"
      region="California"
      description="Upscale suburban hibachi service in beautiful Cerritos, bringing premium dining to this well-planned community."
      zipCodes={["90703"]}
      neighborhoods={["Cerritos Towne Center area","Whitney High area","Artesia border","Norwalk border"]}
      popularVenues={["Modern Homes","Community Centers","Shopping Center venues","Cultural Venues"]}
      cityHighlights={["Well-planned suburban community","Large Asian-American population","Excellent schools and family amenities","Modern shopping and cultural facilities"]}
      storyContent="At a modern Cerritos home in this well-planned community, we delivered a hibachi at home experience that impressed the area's diverse, educated residents. Our private chef's international background resonated with families from around the world. The hibachi party showcased the global appreciation for quality food and entertainment. This private birthday hibachi party reflected Cerritos' reputation for embracing diverse cultures and excellence."
      nearbyCities={["Lakewood","Norwalk","Bellflower","La Palma","Artesia"]}
    />
  )
}