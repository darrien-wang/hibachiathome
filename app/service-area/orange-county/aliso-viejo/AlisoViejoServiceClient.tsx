"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function AlisoViejoServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Aliso Viejo"
      region="Orange County"
      description="Where meaningful moments deserve extraordinary celebrations - hibachi at home experiences that create lasting memories in Orange County's aliso viejo community."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues","Family Residences"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="When single mom Rachel's teenage son was accepted to Stanford with a full scholarship, she felt overwhelming pride mixed with terror. She'd worked three jobs to give him opportunities, often missing games and concerts. Now he was leaving, and she worried he'd remember her absence more than her love. The hibachi at home experience in their Aliso Viejo home became her chance to create one perfect memory. As our chef performed, she watched her son's face light up with pure joy, taking photos to send to friends, calling her over to see every trick. When the chef asked about his college plans and congratulated both of them for their partnership in achieving this dream, her son put his arm around her and said, 'my mom made this possible.' This private birthday hibachi party didn't just celebrate his achievement - it honored the sacrifice and love that made it possible."
      nearbyCities={["Laguna Hills","Lake Forest","Mission Viejo","Laguna Niguel","Laguna Beach"]}
    />
  )
}