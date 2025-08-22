"use client"

import CityServiceTemplate from "@/components/service-area/CityServiceTemplate"

export default function LaHabraServiceClient() {
  return (
    <CityServiceTemplate
      cityName="La Habra"
      region="Orange County"
      description="Where meaningful moments deserve extraordinary celebrations - hibachi at home experiences that create lasting memories in Orange County's la habra community."
      zipCodes={[]}
      neighborhoods={[]}
      popularVenues={["Private Homes","Community Centers","Event Venues","Family Residences"]}
      cityHighlights={["Beautiful Orange County community","Family-friendly neighborhoods","Diverse local culture","Great dining and entertainment"]}
      storyContent="When grandmother Elena's granddaughter asked her to teach the family's traditional tamale recipe before the holiday season, four generations of women gathered in her La Habra kitchen for what they thought would be a cooking lesson. But Elena, at 89, struggled to remember the exact measurements she'd made by feel for decades. The hibachi at home experience became an unexpected bridge between traditions old and new. As our chef demonstrated precision techniques, Elena found herself remembering not just recipes, but stories - why this spice mattered, how her own grandmother had taught her, what each ingredient represented in their family history. When the chef invited Elena to share her own cooking wisdom, she became the teacher again, passing down not just tamale secrets but the love that makes any recipe sacred. This wasn't just dinner - it was the preservation of heritage through the sharing of stories and the honoring of traditions that bind families across generations."
      nearbyCities={["Brea","Fullerton","Whittier","Yorba Linda","Diamond Bar"]}
    />
  )
}