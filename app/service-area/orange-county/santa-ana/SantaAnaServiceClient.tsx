"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function SantaAnaServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Santa Ana"
      region="Orange County"
      description="Premium hibachi at home experiences in santa ana, bringing authentic Japanese tradition to your Orange County celebration."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="When Rosa became an American citizen after fifteen years of hoping and waiting, her family wanted to honor not just her achievement, but her journey. The struggles, the English classes after long work days, the dreams she carried from El Salvador, the courage it took to build a new life. A restaurant celebration felt too ordinary for such an extraordinary milestone. The hibachi at home experience in their Santa Ana home became a bridge between her past and future. As our chef performed with theatrical flair, Rosa's children translated the excitement for their Spanish-speaking abuela, creating a beautiful blend of cultures around the grill. When the chef presented Rosa with a special dish and the whole family erupted in applause, tears mixed with laughter. This wasn't just about becoming American - it was about honoring the strength it took to get here while celebrating the family love that made it all worthwhile. Some dreams are too big for ordinary celebrations."
      nearbyCities={["Orange","Costa Mesa","Tustin","Garden Grove","Fountain Valley"]}
    />
  )
}