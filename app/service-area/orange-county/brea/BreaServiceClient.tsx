"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function BreaServiceClient() {
  return (
    <CityServiceTemplate
      cityName="Brea"
      region="Orange County"
      description="Where meaningful moments deserve extraordinary celebrations - hibachi at home experiences that create lasting memories in Orange County's brea community."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues","Family Residences"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="When Maria received her American citizenship after fifteen years of paperwork, English classes, and uncertainty, her family wanted to honor not just her achievement, but her courage. She'd left everything familiar in Mexico to give her children opportunities she'd never had. A restaurant celebration felt too ordinary for such an extraordinary journey. The hibachi at home experience in their Brea home became a bridge between her past and future. As our chef performed with theatrical flair, Maria's children translated the excitement for their Spanish-speaking relatives, creating a beautiful blend of cultures around the grill. When the chef presented her with a special dish shaped like a star and led everyone in a toast to 'new Americans,' tears mixed with laughter. This wasn't just about citizenship - it was about honoring the strength it takes to build a new life while celebrating the love that makes any place home."
      nearbyCities={["Fullerton","La Habra","Placentia","Yorba Linda","Diamond Bar"]}
    />
  )
}