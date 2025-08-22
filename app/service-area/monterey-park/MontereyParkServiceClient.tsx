"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function MontereyParkServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Monterey Park"
      region="California"
      description="Authentic Asian community hibachi service in Monterey Park, blending Japanese and Chinese culinary traditions."
      zipCodes={["91754","91755"]}
      neighborhoods={["East LA border","Garvey Avenue","Atlantic Boulevard","Monterey Park Highlands"]}
      popularVenues={["Asian Family Homes","Community Centers","Cultural Event Spaces","Multi-family Residences"]}
      cityHighlights={["Large Chinese-American community","Authentic Asian cuisine and cultural experiences","Family-oriented residential neighborhoods","Cultural festivals and community events"]}
      storyContent="At a Monterey Park family reunion, we brought hibachi at home excitement to four generations of a Chinese-American family. Our private chef amazed grandparents who immigrated decades ago while entertaining American-born grandchildren. The hibachi party created bridges between traditional and modern dining experiences. This private birthday hibachi party became a cherished family memory spanning cultures and generations."
      nearbyCities={["Alhambra","San Gabriel"]}
    />
  )
}