"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function GlendaleServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Glendale"
      region="California"
      description="Diverse cultural hibachi experience in Glendale, celebrating the area's rich multicultural community."
      zipCodes={["91201","91202","91203","91204","91205","91206","91207","91208"]}
      neighborhoods={["Downtown Glendale","Verdugo Mountains","Rossmoyne","Sparr Heights","Adams Hill"]}
      popularVenues={["Cultural Community Centers","Family Homes","Corporate Venues","Mountain View Properties"]}
      cityHighlights={["Large Armenian community and cultural heritage","Beautiful hillside neighborhoods with mountain views","Growing arts and cultural scene","Family-friendly suburban atmosphere"]}
      storyContent="In Glendale's Armenian community, we adapted our hibachi at home service to honor both Japanese and Armenian hospitality traditions. Our private chef impressed three generations with skillful cooking while sharing cultural cooking techniques. The hibachi party became a beautiful cultural exchange, with guests teaching each other traditional toasts. This private birthday hibachi party celebrated diversity through delicious food and friendship."
      nearbyCities={["Burbank","Pasadena","Los Angeles","North Hollywood","Arcadia"]}
    />
  )
}