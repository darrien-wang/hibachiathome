"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function ArcadiaServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Arcadia"
      region="California"
      description="Upscale hibachi service in beautiful Arcadia, bringing premium dining to this prestigious foothill community."
      zipCodes={["91006","91007"]}
      neighborhoods={["Arcadia Highlands","Santa Anita area","Foothill Boulevard","Live Oak area"]}
      popularVenues={["Luxury Estates","Gated Communities","Country Club Venues","Foothill Properties"]}
      cityHighlights={["Upscale residential community in the San Gabriel foothills","Home to Santa Anita Park horse racing track","Beautiful tree-lined streets and luxury homes","Strong Asian community and cultural diversity"]}
      storyContent="At a beautiful Arcadia estate near Santa Anita Park, we delivered a hibachi at home experience as elegant as the surrounding horse country. Our private chef prepared wagyu beef with the same attention to quality that Arcadia residents expect. The hibachi party unfolded in their magnificent backyard with mountain views, creating an atmosphere of luxury and tranquility. This private birthday hibachi party felt like dining at an exclusive country club."
      nearbyCities={["Pasadena","Monrovia","San Gabriel","Alhambra","Temple City"]}
    />
  )
}